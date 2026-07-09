import { Proto, ServiceMethodsPayload } from './protoLoader';

export { Proto, ServiceMethodsPayload };

export interface ProtoFile {
  proto: Proto,
  fileName: string
  services: ProtoServiceList;
}

export interface ProtoServiceList {
  [key: string]: ProtoService,
}

export interface ProtoService {
  proto: Proto,
  serviceName: string,
  methodsMocks: ServiceMethodsPayload,
  methodsName: string[],
}
