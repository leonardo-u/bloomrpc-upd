import * as React from 'react';
import { Button, Dropdown, Modal, Switch, Tooltip } from 'antd';
import { CaretDownOutlined, FileOutlined, LockOutlined, UnlockOutlined } from '@ant-design/icons';
import { setInteractive, setProtoVisibility, setGrpcWeb } from './actions';
import { EditorAction } from './Editor';
import { useState } from 'react';
import { TLSManager } from './TLSManager';
import { ProtoInfo, Certificate } from '../../behaviour';

interface OptionsProps {
  protoInfo: ProtoInfo;
  dispatch: React.Dispatch<EditorAction>;
  interactiveChecked: boolean;
  grpcWebChecked: boolean;
  onInteractiveChange?: (checked: boolean) => void;
  tlsSelected?: Certificate;
  onTLSSelected?: (selected: Certificate) => void;
  onClickExport?: () => void;
}

export function Options({
  dispatch,
  grpcWebChecked,
  interactiveChecked,
  onInteractiveChange,
  tlsSelected,
  onTLSSelected,
  onClickExport,
}: OptionsProps) {
  const [tlsModalVisible, setTlsModalVisible] = useState(false);

  const exportMenuItems = [
    {
      key: 'export',
      label: 'Export response',
      onClick: () => onClickExport && onClickExport(),
    },
  ];

  return (
    <div style={{ ...styles.optionContainer, ...styles.inline }}>
      <div style={{ paddingLeft: 15 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Tooltip
            placement="bottom"
            title={tlsSelected ? 'Secure Connection' : 'Unsecure Connection'}
          >
            {tlsSelected ? (
              <LockOutlined style={{ fontSize: 18, color: '#28d440' }} />
            ) : (
              <UnlockOutlined style={{ fontSize: 18, color: '#bdbcbc' }} />
            )}
          </Tooltip>
          <span onClick={() => setTlsModalVisible(true)} style={styles.tlsButton}>
            <span>TLS</span>
          </span>
        </div>

        <Modal
          title={
            <div>
              <LockOutlined />
              <span style={{ marginLeft: 10 }}> TLS / SSL Manager </span>
            </div>
          }
          open={tlsModalVisible}
          onCancel={() => setTlsModalVisible(false)}
          onOk={() => setTlsModalVisible(false)}
          styles={{ body: { padding: 0 } }}
          width={750}
          okText="Done"
          cancelText="Close"
        >
          <TLSManager selected={tlsSelected} onSelected={onTLSSelected} />
        </Modal>
      </div>

      <div style={{ ...styles.inline }}>
        <Dropdown menu={{ items: exportMenuItems }} trigger={['click']}>
          <div
            style={{ marginRight: 5, marginTop: 2, cursor: 'pointer', color: '#b5b5b5' }}
          >
            <CaretDownOutlined />
          </div>
        </Dropdown>
        <div style={{ paddingRight: 10 }}>
          <Switch
            checkedChildren="WEB &nbsp;"
            defaultChecked={grpcWebChecked}
            unCheckedChildren="GRPC"
            onChange={(checked) => {
              dispatch(setGrpcWeb(checked));
            }}
          />
        </div>
        <div style={{ paddingRight: 10 }}>
          <Switch
            checkedChildren="Interactive"
            defaultChecked={interactiveChecked}
            unCheckedChildren="Manual &nbsp; &nbsp; &nbsp;"
            onChange={(checked) => {
              dispatch(setInteractive(checked));
              onInteractiveChange && onInteractiveChange(checked);
            }}
          />
        </div>

        <Button
          icon={<FileOutlined />}
          type="dashed"
          onClick={() => dispatch(setProtoVisibility(true))}
        >
          View Proto
        </Button>
      </div>
    </div>
  );
}

const styles = {
  optionContainer: {
    width: '50%',
  },
  inline: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tlsButton: {
    marginLeft: 10,
    cursor: 'pointer',
    background: '#fafafa',
    padding: '1px 10px',
    borderRadius: '3px',
    fontWeight: 500,
    fontSize: '13px',
    border: '1px solid #d8d8d8',
  },
};
