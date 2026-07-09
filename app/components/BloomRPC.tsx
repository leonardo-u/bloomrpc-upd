import * as React from 'react';
import { useEffect, useState } from 'react';
import { Button, Layout, Tooltip, notification } from 'antd';
import { MenuUnfoldOutlined } from '@ant-design/icons';
import { Resizable } from 're-resizable';
import { Sidebar } from './Sidebar';
import { TabData, TabList, arrayMove } from './TabList';
import {loadProtos, ProtoFile, ProtoService} from '../behaviour';
import {
  EditorTabsStorage,
  deleteRequestInfo,
  getImportPaths,
  getProtos,
  getRequestInfo,
  getTabs,
  storeProtos,
  storeRequestInfo,
  storeTabs,
} from '../storage';
import { EditorEnvironment } from "./Editor";
import { getEnvironments } from "../storage/environments";
import { v4 as uuidv4 } from 'uuid';

export interface EditorTabs {
  activeKey: string
  tabs: TabData[]
}

const SIDER_WIDTH_KEY = 'bloomrpc.siderWidth';
const SIDER_COLLAPSED_KEY = 'bloomrpc.siderCollapsed';
const SIDER_MIN_WIDTH = 200;
const SIDER_MAX_WIDTH = 800;
const SIDER_DEFAULT_WIDTH = 300;

function readSiderWidth(): number {
  try {
    const raw = window.localStorage.getItem(SIDER_WIDTH_KEY);
    if (!raw) return SIDER_DEFAULT_WIDTH;
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n >= SIDER_MIN_WIDTH && n <= SIDER_MAX_WIDTH) return n;
  } catch {}
  return SIDER_DEFAULT_WIDTH;
}

export function BloomRPC() {

  const [protos, setProtosState] = useState<ProtoFile[]>([]);
  const [editorTabs, setEditorTabs] = useState<EditorTabs>({
    activeKey: "0",
    tabs: [],
  });

  const [environments, setEnvironments] = useState<EditorEnvironment[]>(getEnvironments());
  const [siderWidth, setSiderWidth] = useState<number>(readSiderWidth);
  const [siderCollapsed, setSiderCollapsed] = useState<boolean>(() => {
    try { return window.localStorage.getItem(SIDER_COLLAPSED_KEY) === '1'; } catch { return false; }
  });

  const toggleSiderCollapsed = () => {
    setSiderCollapsed(prev => {
      const next = !prev;
      try { window.localStorage.setItem(SIDER_COLLAPSED_KEY, next ? '1' : '0'); } catch {}
      return next;
    });
  };

  function setTabs(props: EditorTabs) {
    setEditorTabs(props);
    storeTabs(props);
  }

  function setProtos(props: ProtoFile[]) {
    setProtosState(props);
    storeProtos(props);
  }

  // Preload editor with stored data.
  useEffect(() => {
    hydrateEditor(setProtos, setTabs);
  }, []);

  return (
    <Layout style={styles.layout}>
      <Layout hasSider style={{ flexDirection: 'row', height: '100vh', overflow: 'hidden' }}>
        {!siderCollapsed && (
          <Resizable
            size={{ width: siderWidth, height: '100%' }}
            minWidth={SIDER_MIN_WIDTH}
            maxWidth={SIDER_MAX_WIDTH}
            enable={{ right: true }}
            onResizeStop={(_e, _dir, _ref, d) => {
              const next = Math.min(SIDER_MAX_WIDTH, Math.max(SIDER_MIN_WIDTH, siderWidth + d.width));
              setSiderWidth(next);
              try { window.localStorage.setItem(SIDER_WIDTH_KEY, String(next)); } catch {}
            }}
            handleStyles={{ right: styles.resizeHandle }}
            style={{ ...styles.sider, overflow: 'hidden' }}
          >
            <Sidebar
              protos={protos}
              onProtoUpload={handleProtoUpload(setProtos, protos)}
              onReload={() => {
                hydrateEditor(setProtos, setTabs);
              }}
              onMethodSelected={handleMethodSelected(editorTabs, setTabs)}
              onDeleteAll={() => {
                setProtos([]);
              }}
              onMethodDoubleClick={handleMethodDoubleClick(editorTabs, setTabs)}
              onCollapse={toggleSiderCollapsed}
            />
          </Resizable>
        )}

        {siderCollapsed && (
          <div style={styles.collapsedRail}>
            <Tooltip title="Expand sidebar" placement="right">
              <Button
                type="primary"
                icon={<MenuUnfoldOutlined />}
                onClick={toggleSiderCollapsed}
                size="small"
              />
            </Tooltip>
          </div>
        )}

        <Layout.Content style={{ overflow: 'hidden', minWidth: 0, minHeight: 0, height: '100vh' }}>
          <TabList
            tabs={editorTabs.tabs || []}
            onDragEnd={({oldIndex, newIndex}) => {
              const newTab = editorTabs.tabs[oldIndex];

              setTabs({
                activeKey: (newTab && newTab.tabKey) || editorTabs.activeKey,
                tabs: arrayMove(
                    editorTabs.tabs,
                    oldIndex,
                    newIndex,
                ).filter(e => e),
              })
            }}
            activeKey={editorTabs.activeKey}
            environmentList={environments}
            onEnvironmentChange={() => {
              setEnvironments(getEnvironments());
            }}
            onEditorRequestChange={(editorRequestInfo) => {
              storeRequestInfo(editorRequestInfo);
            }}
            onDelete={(activeKey: string) => {
              let newActiveKey = "0";

              const index = editorTabs.tabs
                .findIndex(tab => tab.tabKey === activeKey);

              if (index === -1) {
                return;
              }

              if (editorTabs.tabs.length > 1) {
                if (activeKey === editorTabs.activeKey) {
                  const newTab = editorTabs.tabs[index - 1] || editorTabs.tabs[index + 1];
                  newActiveKey = newTab.tabKey;
                } else {
                  newActiveKey = editorTabs.activeKey;
                }
              }

              deleteRequestInfo(activeKey);

              setTabs({
                activeKey: newActiveKey,
                tabs: editorTabs.tabs.filter(tab => tab.tabKey !== activeKey),
              });

            }}
            onDeleteAll={() => {
              editorTabs.tabs.forEach(tab => deleteRequestInfo(tab.tabKey));
              setTabs({ activeKey: "0", tabs: [] });
            }}
            onChange={(activeKey: string) => {
              setTabs({
                activeKey,
                tabs: editorTabs.tabs || [],
              })
            }}
          />
        </Layout.Content>
      </Layout>

    </Layout>
  );
}

/**
 * Hydrate editor from persisted storage
 * @param setProtos
 * @param setEditorTabs
 */
async function hydrateEditor(setProtos: React.Dispatch<ProtoFile[]>, setEditorTabs: React.Dispatch<EditorTabs>) {
  const hydration = [];
  const savedProtos = getProtos();
  const importPaths = getImportPaths();

  if (savedProtos) {
    hydration.push(
      loadProtos(savedProtos, importPaths, handleProtoUpload(setProtos, []))
        .then(() => true)
    );

    const savedEditorTabs = getTabs();
    if (savedEditorTabs) {
      hydration.push(
        loadTabs(savedEditorTabs)
          .catch((): EditorTabs => ({activeKey: "0", tabs: []}))
          .then(setEditorTabs)
          .then(() => true)
      );
    }
  }

  return Promise.all(hydration);
}

/**
 * Load tabs
 * @param editorTabs
 */
async function loadTabs(editorTabs: EditorTabsStorage): Promise<EditorTabs> {
  const storedEditTabs: EditorTabs = {
    activeKey: editorTabs.activeKey,
    tabs: [],
  };

  const importPaths = getImportPaths();

  const protos = await loadProtos(editorTabs.tabs.map((tab) => {
    return tab.protoPath;
  }), importPaths);

  const previousTabs = editorTabs.tabs.map((tab) => {
    const def = protos.find((protoFile) => {
      const match = Object.keys(protoFile.services).find((service) => service === tab.serviceName);
      return Boolean(match);
    });

    // Old Definition Not found
    if (!def) {
      return false;
    }

    return {
      tabKey: tab.tabKey,
      methodName: tab.methodName,
      service: def.services[tab.serviceName],
      initialRequest: getRequestInfo(tab.tabKey),
    }
  });

  storedEditTabs.tabs = previousTabs.filter((tab) => tab) as TabData[];

  return storedEditTabs;
}

/**
 *
 * @param setProtos
 * @param protos
 */
function handleProtoUpload(setProtos: React.Dispatch<ProtoFile[]>, protos: ProtoFile[]) {
  return function (newProtos: ProtoFile[], err: Error | void) {
    if (err) {
      notification.error({
        message: "Error while importing protos",
        description: err.message,
        duration: 5,
        placement: "bottomLeft",
        style: {
          width: "89%",
          wordBreak: "break-all",
        }
      });
      return protos;
    }

    const protoMinusExisting = protos.filter((proto) => {
      return !newProtos.find((p) => p.fileName === proto.fileName)
    });

    const appProtos = [...protoMinusExisting, ...newProtos];
    setProtos(appProtos);

    return appProtos;
  }
}

/**
 * Handle method selected
 * @param editorTabs
 * @param setTabs
 */
function handleMethodSelected(editorTabs: EditorTabs, setTabs: React.Dispatch<EditorTabs>) {
  return (methodName: string, protoService: ProtoService) => {
    const tab = {
      tabKey: `${protoService.serviceName}${methodName}`,
      methodName,
      service: protoService
    };

    const tabExists = editorTabs.tabs
      .find(exisingTab => exisingTab.tabKey === tab.tabKey);

    if (tabExists) {
      setTabs({
        activeKey: tab.tabKey,
        tabs: editorTabs.tabs,
      });
      return;
    }

    const newTabs = [...editorTabs.tabs, tab];

    setTabs({
      activeKey: tab.tabKey,
      tabs: newTabs,
    });
  }
}

function handleMethodDoubleClick(editorTabs: EditorTabs, setTabs: React.Dispatch<EditorTabs>){
  return (methodName: string, protoService: ProtoService) => {
    const tab = {
      tabKey: `${protoService.serviceName}${methodName}-${uuidv4()}`,
      methodName,
      service: protoService
    };

    const newTabs = [...editorTabs.tabs, tab];

    setTabs({
      activeKey: tab.tabKey,
      tabs: newTabs,
    });
  }

}

const styles = {
  layout: {
    height: "100vh",
    overflow: "hidden",
  },
  header: {
    color: "#fff",
    fontWeight: 900,
    fontSize: 20,
    display: "flex",
    justifyContent: "space-between",
  },
  sider: {
    zIndex: 20,
    borderRight: "1px solid rgba(0, 21, 41, 0.18)",
    backgroundColor: "white",
    boxShadow: "3px 0px 4px 0px rgba(0,0,0,0.10)",
  },
  resizeHandle: {
    width: 6,
    right: -3,
    cursor: "col-resize",
    background: "transparent",
  } as React.CSSProperties,
  collapsedRail: {
    width: 36,
    flex: "0 0 36px",
    height: "100vh",
    borderRight: "1px solid rgba(0, 21, 41, 0.18)",
    background: "#fafafa",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    paddingTop: 8,
    boxShadow: "2px 0px 4px 0px rgba(0,0,0,0.06)",
  } as React.CSSProperties,
};
