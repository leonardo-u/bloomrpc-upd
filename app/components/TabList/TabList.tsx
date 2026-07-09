import * as React from 'react';
import { useEffect } from 'react';
import { Button, Modal, Tabs, Tooltip } from 'antd';
import { CloseSquareOutlined } from '@ant-design/icons';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { restrictToHorizontalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { Editor, EditorEnvironment, EditorRequest } from '../Editor';
import { ProtoInfo, ProtoService } from '../../behaviour';
import { SortableTabNode } from './DraggableTabList';
import * as Mousetrap from 'mousetrap';
import 'mousetrap/plugins/global-bind/mousetrap-global-bind';

interface TabListProps {
  tabs: TabData[]
  activeKey?: string
  onChange?: (activeKey: string) => void
  onDelete?: (activeKey: string) => void
  onDeleteAll?: () => void
  onEditorRequestChange?: (requestInfo: EditorTabRequest) => void
  onDragEnd: (indexes: { oldIndex: number; newIndex: number }) => void
  environmentList?: EditorEnvironment[]
  onEnvironmentChange?: () => void
}

export interface TabData {
  tabKey: string
  methodName: string
  service: ProtoService
  initialRequest?: EditorRequest
}

export interface EditorTabRequest extends EditorRequest {
  id: string
}

export { arrayMove };

export function TabList({
  tabs,
  activeKey,
  onChange,
  onDelete,
  onDeleteAll,
  onDragEnd,
  onEditorRequestChange,
  environmentList,
  onEnvironmentChange,
}: TabListProps) {
  const tabsWithMatchingKey = tabs.filter((tab) => tab.tabKey === activeKey);

  const tabActiveKey =
    tabsWithMatchingKey.length === 0
      ? [...tabs.map((tab) => tab.tabKey)].pop()
      : [...tabsWithMatchingKey.map((tab) => tab.tabKey)].pop();

  const confirmCloseAll = React.useCallback(() => {
    if (!onDeleteAll || tabs.length === 0) {
      return;
    }
    Modal.confirm({
      title: 'Close all tabs?',
      content: `This will close all ${tabs.length} open tab${tabs.length === 1 ? '' : 's'}.`,
      okText: 'Close all',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: () => onDeleteAll(),
    });
  }, [tabs.length, onDeleteAll]);

  useEffect(() => {
    Mousetrap.bindGlobal(['command+w', 'ctrl+w'], () => {
      if (tabActiveKey) {
        onDelete && onDelete(tabActiveKey);
      }
      return false;
    });

    Mousetrap.bindGlobal(['command+shift+w', 'ctrl+shift+w'], () => {
      confirmCloseAll();
      return false;
    });

    return () => {
      Mousetrap.unbind(['command+w', 'ctrl+w']);
      Mousetrap.unbind(['command+shift+w', 'ctrl+shift+w']);
    };
  }, [tabActiveKey, onDelete, confirmCloseAll]);

  // dnd-kit: require small drag distance before activation so plain clicks on
  // tabs still register.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const oldIndex = tabs.findIndex((t) => t.tabKey === active.id);
    const newIndex = tabs.findIndex((t) => t.tabKey === over.id);
    if (oldIndex >= 0 && newIndex >= 0) {
      onDragEnd({ oldIndex, newIndex });
    }
  };

  const items =
    tabs.length === 0
      ? [
          {
            key: '0',
            label: 'New Tab',
            closable: false,
            children: (
              <Editor
                active={true}
                environmentList={environmentList}
                onEnvironmentListChange={onEnvironmentChange}
              />
            ),
          },
        ]
      : tabs.map((tab) => ({
          key: tab.tabKey,
          label: `${tab.service.serviceName}.${tab.methodName}`,
          closable: true,
          children: (
            <Editor
              active={tab.tabKey === activeKey}
              environmentList={environmentList}
              protoInfo={new ProtoInfo(tab.service, tab.methodName)}
              key={tab.tabKey}
              initialRequest={tab.initialRequest}
              onEnvironmentListChange={onEnvironmentChange}
              onRequestChange={(editorRequest: EditorRequest) => {
                onEditorRequestChange &&
                  onEditorRequestChange({
                    id: tab.tabKey,
                    ...editorRequest,
                  });
              }}
            />
          ),
        }));

  return (
    <Tabs
      className="draggable-tabs"
      onEdit={(targetKey, action) => {
        if (action === 'remove' && typeof targetKey === 'string') {
          onDelete && onDelete(targetKey);
        }
      }}
      onChange={onChange}
      tabBarStyle={styles.tabBarStyle}
      style={styles.tabList}
      activeKey={tabActiveKey || '0'}
      hideAdd
      type="editable-card"
      items={items}
      tabBarExtraContent={
        tabs.length > 0 && (
          <Tooltip title="Close all tabs (Ctrl+Shift+W)" placement="bottomRight">
            <Button
              danger
              size="small"
              style={styles.closeAllButton}
              onClick={confirmCloseAll}
              icon={<CloseSquareOutlined />}
            >
              Close all
            </Button>
          </Tooltip>
        )
      }
      renderTabBar={(tabBarProps, DefaultTabBar) => (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToHorizontalAxis, restrictToParentElement]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={tabs.length > 0 ? tabs.map((t) => t.tabKey) : ['0']}
            strategy={horizontalListSortingStrategy}
          >
            <DefaultTabBar {...tabBarProps}>
              {(node: any) => (
                <SortableTabNode
                  key={node.key}
                  id={node.key}
                  active={node.key === activeKey}
                >
                  {node}
                </SortableTabNode>
              )}
            </DefaultTabBar>
          </SortableContext>
        </DndContext>
      )}
    />
  );
}

const styles = {
  tabList: {
    height: '100%',
  },
  tabBarStyle: {
    padding: '10px 0px 0px 20px',
    marginBottom: '0px',
  },
  closeAllButton: {
    marginRight: 12,
    height: 24,
    paddingLeft: 8,
    paddingRight: 8,
  },
};
