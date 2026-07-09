import * as React from 'react';
import { useEffect, useState } from "react";
import { Button, Dropdown, Input, Modal, Tree, Tooltip } from 'antd';
import {
  DeleteOutlined,
  EyeOutlined,
  FileOutlined,
  FileSearchOutlined,
  MenuFoldOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { Badge } from '../Badge/Badge';
import {OnProtoUpload, ProtoFile, ProtoService, importProtos, importProtosFromServerReflection} from '../../behaviour';
import { PathResolution } from "./PathResolution";
import { getImportPaths } from "../../storage";
import {UrlResolution} from "./UrlResolution";

interface SidebarProps {
  protos: ProtoFile[]
  onMethodSelected: (methodName: string, protoService: ProtoService) => void
  onProtoUpload: OnProtoUpload
  onDeleteAll: () => void
  onReload: () => void
  onMethodDoubleClick: (methodName: string, protoService: ProtoService) => void
  onCollapse?: () => void
}

export function Sidebar({ protos, onMethodSelected, onProtoUpload, onDeleteAll, onReload, onMethodDoubleClick, onCollapse }: SidebarProps) {

  const [importPaths, setImportPaths] = useState<string[]>([""]);
  const [importPathVisible, setImportPathsVisible] = useState(false);
  const [filterMatch, setFilterMatch] = useState<string|null>(null);
  const [importReflectionVisible, setImportReflectionVisible] = useState(false);

  useEffect(() => {
    setImportPaths(getImportPaths());
  }, []);

  function processSelectedKey(selected: string | undefined) {
    if (!selected || !selected.includes("method:")) {
      return undefined;
    }

    const fragments = selected.split('||');
    const fileName = fragments[0];
    const methodName = fragments[1].replace('method:', '');
    const serviceName = fragments[2].replace('service:', '');

    const protodef = protos.find((protoFile) => {
      const match = Object.keys(protoFile.services).find(
        (service) => service === serviceName &&
          fileName === protoFile.services[serviceName].proto.filePath
      );
      return Boolean(match);
    });

    if (!protodef) {
      return undefined;
    }
    return {methodName, protodef, serviceName}
  }

  const treeData = protos.map((proto) => ({
    icon: () => <Badge type="protoFile"> P </Badge>,
    title: proto.fileName,
    key: proto.fileName,
    children: Object.keys(proto.services).map((service) => ({
      icon: <Badge type="service"> S </Badge>,
      title: service,
      key: `${proto.fileName}-${service}`,
      children: proto.services[service].methodsName
        .filter((name) => filterMatch === null
          ? true
          : name.toLowerCase().includes(filterMatch.toLowerCase()))
        .map((method: string) => ({
          icon: <Badge type="method"> M </Badge>,
          title: method,
          key: `${proto.services[service].proto.filePath}||method:${method}||service:${service}`,
          isLeaf: true,
        })),
    })),
  }));

  const importMenuItems = [
    {
      key: '1',
      icon: <FileOutlined />,
      label: 'Import from file',
      onClick: () => importProtos(onProtoUpload, importPaths),
    },
    {
      key: '2',
      icon: <EyeOutlined />,
      label: 'Import from server reflection',
      onClick: () => setImportReflectionVisible(true),
    },
  ];

  return (
    <>
      <div style={styles.sidebarTitleContainer}>
        <div>
          <h3 style={styles.sidebarTitle}>Protos</h3>
        </div>

        <div style={{display: "flex", flexDirection: "row", alignItems: "center", gap: 6}}>
          <Dropdown menu={{ items: importMenuItems }} trigger={["click"]}>
            <Tooltip title="Import protos" placement="bottomRight">
              <Button type="primary" icon={<PlusOutlined />} />
            </Tooltip>
          </Dropdown>
          {onCollapse && (
            <Tooltip title="Collapse sidebar" placement="bottomRight">
              <Button
                type="primary"
                icon={<MenuFoldOutlined />}
                onClick={onCollapse}
              />
            </Tooltip>
          )}
        </div>
      </div>

      <div style={styles.optionsContainer}>
        <div style={{width: "50%"}}>
          <Tooltip title="Reload" placement="bottomLeft" align={{offset: [-8, 0]}}>
            <Button
              type="default"
              style={{height: 24, paddingRight: 5, paddingLeft: 5}}
              onClick={onReload}
              icon={<ReloadOutlined style={{cursor: "pointer", color: "#1d93e6"}}/>}
            />
          </Tooltip>

          <Tooltip title="Import Paths" placement="bottomLeft" align={{offset: [-8, 0]}}>
            <Button
              type="default"
              style={{height: 24, paddingRight: 5, paddingLeft: 5, marginLeft: 5}}
              onClick={() => setImportPathsVisible(true)}
              icon={<FileSearchOutlined style={{cursor: "pointer", color: "#1d93e6"}}/>}
            />
          </Tooltip>

          <Modal
            title={(
              <div>
                <FileSearchOutlined />
                <span style={{marginLeft: 10}}> Import Paths </span>
              </div>
            )}
            open={importPathVisible}
            onCancel={() => setImportPathsVisible(false)}
            onOk={() => setImportPathsVisible(false)}
            styles={{ body: { padding: 0 } }}
            width={750}
            footer={[
              <Button key="back" onClick={() => setImportPathsVisible(false)}>Close</Button>
            ]}
          >
            <PathResolution
              onImportsChange={setImportPaths}
              importPaths={importPaths}
            />
          </Modal>

          <Modal
            title={(
              <div>
                <EyeOutlined />
                <span style={{marginLeft: 10}}> Import from server reflection </span>
              </div>
            )}
            open={importReflectionVisible}
            onCancel={() => setImportReflectionVisible(false)}
            onOk={() => setImportReflectionVisible(false)}
            width={750}
            footer={[
              <Button key="back" onClick={() => setImportReflectionVisible(false)}>Close</Button>
            ]}
          >
            <UrlResolution
              onImportFromUrl={(url) => {
                importProtosFromServerReflection(onProtoUpload, url)
                setImportReflectionVisible(false)
              }}
            />
          </Modal>
        </div>
        <div style={{width: "50%", textAlign: "right"}}>
          <Tooltip title="Delete all" placement="bottomRight" align={{offset: [10, 0]}}>
            <Button
              type="default"
              style={{height: 24, paddingRight: 5, paddingLeft: 5}}
              onClick={onDeleteAll}
              icon={<DeleteOutlined style={{cursor: "pointer", color: "red" }} />}
            />
          </Tooltip>
        </div>
      </div>

      <div style={{
        overflow: "auto",
        maxHeight: "calc(100vh - 85px)",
        height: "100%"
      }}>

        <Input
          placeholder={"Filter methods"}
          allowClear
          value={filterMatch || ""}
          onChange={(v) => setFilterMatch(v.target.value || null)}
        />

        {protos.length > 0 && (
          <Tree.DirectoryTree
            showIcon
            defaultExpandAll
            treeData={treeData}
            onSelect={async (selectedKeys) => {
              const selected = selectedKeys[selectedKeys.length - 1] as string | undefined;
              const protoDefinitions = processSelectedKey(selected);

              if (!protoDefinitions){
                return;
              }

              onMethodSelected(protoDefinitions.methodName, protoDefinitions.protodef.services[protoDefinitions.serviceName]);
            }}
            onDoubleClick={async (_event, node) => {
              const selected = (node as any).key as string;
              const protoDefinitions = processSelectedKey(selected);

              if (!protoDefinitions){
                return;
              }

              onMethodDoubleClick(protoDefinitions.methodName, protoDefinitions.protodef.services[protoDefinitions.serviceName])
            }}
          />
        )}
      </div>
    </>
  );
}

const styles = {
  sidebarTitleContainer: {
    display: "flex",
    justifyContent: "space-between",
    paddingTop: 6,
    paddingBottom: 4,
    paddingLeft: 20,
    paddingRight: 10,
    borderBottom: "1px solid #eee",
    background: "#001529"
  },
  sidebarTitle: {
    color: "#fff",
    marginTop: "0.5em"
  },
  icon: {
    fontSize: 23,
    marginBottom: 7,
    marginRight: 12,
    marginTop: -2,
    color: "#28d440",
    border: "2px solid #f3f6f9",
    borderRadius: "50%",
    cursor: "pointer"
  },
  optionsContainer: {
    background: "#fafafa",
    padding: "3px 6px",
    display: "flex",
    alignContent: "space-between",
    borderBottom: "1px solid #e0e0e0",
  }
};
