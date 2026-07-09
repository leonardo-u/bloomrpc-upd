import * as remote from '@electron/remote';
import {fromFileName, mockRequestMethods, Proto, walkServices} from './protoLoader';
import * as path from 'path';
import {ProtoFile, ProtoService} from './protobuf';
import {Service} from 'protobufjs';
import {Client} from 'grpc-reflection-js';
import * as fs from 'fs';
import {credentials, loadPackageDefinition} from '@grpc/grpc-js';

/**
 * Decide whether a stored proto reference is a local file path or a gRPC
 * server reflection target. We deliberately do NOT use validator's isURL —
 * with the permissive options it used to be called with, every Linux/Mac
 * absolute path was misclassified as a URL and routed through the
 * reflection client, which then failed with "Name resolution failed for
 * target dns:/home/...". This regressed every subsequent gRPC call.
 */
function looksLikeFilePath(p: string): boolean {
  if (!p) return false;
  // Absolute POSIX or Windows path
  if (p.startsWith('/') || /^[A-Za-z]:[\\/]/.test(p)) return true;
  // Relative path
  if (p.startsWith('./') || p.startsWith('../') || p.startsWith('~')) return true;
  // Has the .proto extension and contains a separator → almost certainly a file
  if (/[\\/]/.test(p) && /\.proto$/i.test(p)) return true;
  // Final safety net: it actually exists on disk
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

const commonProtosPath = [
  // @ts-ignore
  path.join(__static),
];

export type OnProtoUpload = (protoFiles: ProtoFile[], err?: Error) => void

/**
 * Upload protofiles
 * @param onProtoUploaded
 * @param importPaths
 */
export async function importProtos(onProtoUploaded: OnProtoUpload, importPaths?: string[]) {
  const openDialogResult = await remote.dialog.showOpenDialog(remote.getCurrentWindow(), {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Protos', extensions: ['proto'] },
    ]
  });

  const filePaths = openDialogResult.filePaths;

  if (!filePaths || filePaths.length === 0) {
    return;
  }
  await loadProtosFromFile(filePaths, importPaths, onProtoUploaded);
}

/**
 * Upload protofiles from gRPC server reflection
 * @param onProtoUploaded
 * @param host
 */
export async function importProtosFromServerReflection(onProtoUploaded: OnProtoUpload, host: string) {
  await loadProtoFromReflection(host, onProtoUploaded);
}

/**
 * Load protocol buffer files
 * @param filePaths
 * @param importPaths
 * @param onProtoUploaded
 */
export async function loadProtos(protoPaths: string[], importPaths?: string[], onProtoUploaded?: OnProtoUpload): Promise<ProtoFile[]> {
  const protoFiles = protoPaths.filter(looksLikeFilePath);
  const protoUrls = protoPaths.filter((p) => !looksLikeFilePath(p));

  const protoFileFromFiles = await loadProtosFromFile(protoFiles, importPaths, onProtoUploaded);

  let protoFileFromReflection: ProtoFile[] = [];
  for (const protoUrl of protoUrls) {
    protoFileFromReflection = protoFileFromReflection.concat(await loadProtoFromReflection(protoUrl, onProtoUploaded));
  }

  return protoFileFromFiles.concat(protoFileFromReflection);
}

/**
 * Load protocol buffer files from gRPC server reflection
 * @param host
 * @param onProtoUploaded
 */
export async function loadProtoFromReflection(host: string, onProtoUploaded?: OnProtoUpload): Promise<ProtoFile[]> {
  try {
    const reflectionClient = new Client(host, credentials.createInsecure());
    const services = (await reflectionClient.listServices()) as string[];
    const serviceRoots = await Promise.all(
        services
            .filter(s => s && s !== 'grpc.reflection.v1alpha.ServerReflection')
            .map((service: string) => reflectionClient.fileContainingSymbol(service))
    );

    const protos = serviceRoots.map((root: any) => {
      return {
        fileName: root.files[root.files.length - 1],
        filePath: host,
        protoText: "proto text not supported in gRPC reflection",
        ast: protobufRootToGrpcAst(root),
        root: root
      }
    });

    const protoList = protos.reduce((list: ProtoFile[], proto: Proto) => {
      // Services with methods
      const services = parseServices(proto);

      // Proto file
      list.push({
        proto,
        fileName: proto.fileName,
        services
      });

      return list;
    }, []);

    onProtoUploaded && onProtoUploaded(protoList, undefined);
    return protoList;

  } catch (e) {
    console.error(e);
    onProtoUploaded && onProtoUploaded([], e);

    if (!onProtoUploaded) {
      throw e;
    }

    return []
  }
}

/**
 * Load protocol buffer files from proto files
 * @param filePaths
 * @param importPaths
 * @param onProtoUploaded
 */
export async function loadProtosFromFile(filePaths: string[], importPaths?: string[], onProtoUploaded?: OnProtoUpload): Promise<ProtoFile[]> {
  try {
    const protos = await Promise.all(filePaths.map((fileName) =>
      fromFileName(fileName, [
        ...(importPaths ? importPaths : []),
        ...commonProtosPath,
      ])
    ));

    const protoList = protos.reduce((list: ProtoFile[], proto: Proto) => {

      // Services with methods
      const services = parseServices(proto);

      // Proto file
      list.push({
        proto,
        fileName: proto.fileName.split(path.sep).pop() || "",
        services,
      });

      return list;
    }, []);
    onProtoUploaded && onProtoUploaded(protoList, undefined);
    return protoList;

  } catch (e) {
    console.error(e);
    onProtoUploaded && onProtoUploaded([], e);

    if (!onProtoUploaded) {
      throw e;
    }

    return [];
  }
}

/**
 * Parse Grpc services from root
 * @param proto
 */
function parseServices(proto: Proto) {

  const services: {[key: string]: ProtoService} = {};

  walkServices(proto, (service: Service, _: any, serviceName: string) => {
    const mocks = mockRequestMethods(service);
    services[serviceName] = {
      serviceName: serviceName,
      proto,
      methodsMocks: mocks,
      methodsName: Object.keys(mocks),
    };
  });

  return services;
}

/**
 * Convert a protobufjs Root (returned by grpc-reflection-js) into the
 * grpc client object tree that the rest of the code expects (a GrpcObject
 * with service constructors). We do this by serialising to JSON and
 * re-parsing via @grpc/proto-loader.fromJSON, then loadPackageDefinition.
 */
function protobufRootToGrpcAst(root: any): any {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { fromJSON } = require('@grpc/proto-loader');
  const json = root.toJSON();
  const packageDefinition = fromJSON(json, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  return loadPackageDefinition(packageDefinition);
}

export function importResolvePath(): Promise<string> {
  return new Promise(async (resolve, reject) => {
    const openDialogResult = await remote.dialog.showOpenDialog(remote.getCurrentWindow(), {
      properties: ['openDirectory'],
      filters: []
    });

    const filePaths = openDialogResult.filePaths;

    if (!filePaths || filePaths.length === 0) {
      return reject("No folder selected");
    }
    resolve(filePaths[0]);
  });
}
