/**
 * Vendored replacement for the archived `bloomrpc-mock` package.
 *
 * Why this exists: `bloomrpc-mock` requires the deprecated native `grpc`
 * module at import time. We replicate the small set of functions we use
 * (fromFileName, walkServices, mockRequestMethods) on top of
 * `@grpc/grpc-js` + `@grpc/proto-loader` + `protobufjs`.
 */
import * as fs from 'fs';
import * as path from 'path';
import { loadPackageDefinition, GrpcObject } from '@grpc/grpc-js';
import { load as protoLoaderLoad } from '@grpc/proto-loader';
import * as protobufjs from 'protobufjs';
import { Root, Service, Type, Field, Enum, MapField, OneOf, Namespace, Method } from 'protobufjs';
import * as uuid from 'uuid';
// `lodash.get` exports a single function via CommonJS `module.exports = ...`.
// `import * as get` would yield the module namespace object, not the function,
// so we use require() to get the bare function.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const get: (obj: any, path: string | string[], defaultValue?: any) => any = require('lodash.get');

export interface Proto {
  fileName: string;
  filePath: string;
  protoText: string;
  ast: GrpcObject | any;
  root: Root;
}

export interface ServiceMethodsPayload {
  [methodName: string]: () => { plain: any; message: any };
}

export async function fromFileName(protoPath: string, includeDirs?: string[]): Promise<Proto> {
  const includes = includeDirs ? [...includeDirs] : [];
  if (path.isAbsolute(protoPath)) {
    includes.push(path.dirname(protoPath));
  } else {
    includes.push(path.dirname(path.join(process.cwd(), protoPath)));
  }

  const packageDefinition = await protoLoaderLoad(path.basename(protoPath), {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: includes,
  });

  const protoAST = loadPackageDefinition(packageDefinition);

  const protoRoot = new Root();
  addIncludePathToRoot(protoRoot, includes);

  const root = await protoRoot.load(protoPath, { keepCase: true });
  const protoText = await fs.promises.readFile(protoPath, 'utf8');

  return {
    fileName: protoPath.split(path.sep).pop() || '',
    filePath: protoPath,
    protoText,
    ast: protoAST,
    root,
  };
}

type OnServiceCallback = (service: Service, ast: any, fullyQualifiedName: string) => void;

export function walkServices(proto: Proto, onService: OnServiceCallback) {
  const { ast, root } = proto;

  walkNamespace(root, (namespace) => {
    const nestedNamespaceTypes = (namespace as any).nested;
    if (!nestedNamespaceTypes) {
      return;
    }
    Object.keys(nestedNamespaceTypes).forEach((nestedTypeName) => {
      const fullNamespaceName = (namespace.fullName || '').startsWith('.')
        ? (namespace.fullName || '').replace('.', '')
        : (namespace.fullName || '');
      const nestedType = root.lookup(`${fullNamespaceName}.${nestedTypeName}`);
      if (nestedType instanceof Service) {
        const serviceNameParts = [
          ...fullNamespaceName.split('.').filter(Boolean),
          nestedType.name,
        ];
        const fullyQualifiedServiceName = serviceNameParts.join('.');
        onService(nestedType, get(ast, serviceNameParts), fullyQualifiedServiceName);
      }
    });
  });

  Object.keys(ast).forEach((serviceName) => {
    const lookupType = root.lookup(serviceName);
    if (lookupType instanceof Service) {
      onService(serviceByName(root, serviceName), ast[serviceName], serviceName);
    }
  });
}

function walkNamespace(root: Root, onNamespace: (n: Namespace) => void, parentNamespace?: Namespace) {
  const namespace: Namespace = parentNamespace || root;
  const nestedType = (namespace as any).nested;
  if (!nestedType) {
    return;
  }
  Object.keys(nestedType).forEach((typeName) => {
    const fullName = namespace.fullName || '';
    const nestedNamespace = root.lookup(`${fullName}.${typeName}`);
    if (nestedNamespace && isNamespace(nestedNamespace)) {
      onNamespace(nestedNamespace as Namespace);
      walkNamespace(root, onNamespace, nestedNamespace as Namespace);
    }
  });
}

function serviceByName(root: Root, serviceName: string): Service {
  if (!root.nested) {
    throw new Error('Empty PROTO!');
  }
  const serviceLeaf: any = root.nested[serviceName];
  return root.lookupService(serviceLeaf.fullName);
}

function addIncludePathToRoot(root: Root, includePaths: string[]) {
  const originalResolvePath = root.resolvePath;
  root.resolvePath = (origin: string, target: string) => {
    if (path.isAbsolute(target)) {
      return target;
    }
    for (const directory of includePaths) {
      const fullPath = path.join(directory, target);
      try {
        fs.accessSync(fullPath, fs.constants.R_OK);
        return fullPath;
      } catch {
        continue;
      }
    }
    return originalResolvePath(origin, target);
  };
}

function isNamespace(lookupType: any): boolean {
  return (
    lookupType instanceof Namespace &&
    !(lookupType instanceof Service) &&
    !(lookupType instanceof Type) &&
    !(lookupType instanceof Enum) &&
    !(lookupType instanceof Field) &&
    !(lookupType instanceof MapField) &&
    !(lookupType instanceof OneOf) &&
    !(lookupType instanceof Method)
  );
}

// --------- Mocking (vendored from bloomrpc-mock/automock) ---------

const MAX_STACK_SIZE = 3;

export function mockRequestMethods(service: Service): ServiceMethodsPayload {
  return mockMethodReturnType(service, 'request');
}

function mockMethodReturnType(service: Service, type: 'request' | 'response'): ServiceMethodsPayload {
  const root = service.root as Root;
  const serviceMethods = service.methods;

  return Object.keys(serviceMethods).reduce<ServiceMethodsPayload>((methods, method) => {
    const serviceMethod = serviceMethods[method];
    const methodMessageType = type === 'request' ? serviceMethod.requestType : serviceMethod.responseType;
    const messageType = root.lookupType(methodMessageType);

    methods[method] = () => {
      const data = mockTypeFields(messageType);
      return { plain: data, message: messageType.fromObject(data) };
    };
    return methods;
  }, {});
}

function mockTypeFields(type: Type, stackDepth: Record<string, number> = {}): any {
  if ((stackDepth[type.name] || 0) > MAX_STACK_SIZE) {
    return {};
  }
  stackDepth[type.name] = (stackDepth[type.name] || 0) + 1;

  return type.fieldsArray.reduce<Record<string, any>>((data, field) => {
    field.resolve();
    if (field.parent !== field.resolvedType) {
      if (field.repeated) {
        data[field.name] = [mockField(field, stackDepth)];
      } else {
        data[field.name] = mockField(field, stackDepth);
      }
    }
    return data;
  }, {});
}

function mockField(field: Field, stackDepth: Record<string, number>): any {
  if (field.resolvedType instanceof Type) {
    return mockTypeFields(field.resolvedType, stackDepth);
  }
  if (field.resolvedType instanceof Enum) {
    const enumValues = Object.keys(field.resolvedType.values);
    return enumValues.length > 0 ? enumValues[0] : 0;
  }
  return mockScalar(field.type, field.name);
}

function mockScalar(type: string, fieldName: string): any {
  switch (type) {
    case 'string':
      return interpretMockViaFieldName(fieldName);
    case 'number':
    case 'double':
    case 'float':
    case 'int32':
    case 'int64':
    case 'uint32':
    case 'uint64':
    case 'sint32':
    case 'sint64':
    case 'fixed32':
    case 'fixed64':
    case 'sfixed32':
    case 'sfixed64':
      return 0;
    case 'bool':
      return true;
    case 'bytes':
      return Buffer.from('');
    default:
      return null;
  }
}

function interpretMockViaFieldName(fieldName: string): string {
  const lower = fieldName.toLowerCase();
  if (lower.endsWith('id') || lower.endsWith('_id')) {
    return uuid.v4();
  }
  return 'Hello';
}
