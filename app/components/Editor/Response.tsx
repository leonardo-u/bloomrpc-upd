import * as React from 'react';
import { Tabs } from 'antd';
import { Viewer } from './Viewer';
import { EditorResponse } from './Editor';

interface ResponseProps {
  streamResponse: EditorResponse[];
  response: EditorResponse;
}

export function Response({ response, streamResponse }: ResponseProps) {
  const defaultKey = `responseTab`;

  const items =
    streamResponse.length === 0
      ? [
          {
            key: 'unaryResponse',
            label: 'Response',
            children: (
              <Viewer
                output={response.output}
                responseTime={response.responseTime}
                emptyContent={
                  <div style={{ position: 'relative', height: '325px' }}>
                    <div style={styles.introContainer}>
                      <img
                        src={require('./../../../resources/blue/128x128.png')}
                        style={{
                          opacity: 0.1,
                          pointerEvents: 'none',
                          userSelect: 'none',
                        }}
                      />
                      <h1 style={styles.introTitle}>
                        Hit the play button to get a response here
                      </h1>
                    </div>
                  </div>
                }
              />
            ),
          },
        ]
      : streamResponse.map((data, key) => ({
          key: `response-${key}`,
          label: `Stream ${key + 1}`,
          children: <Viewer output={data.output} responseTime={data.responseTime} />,
        }));

  return (
    <Tabs
      defaultActiveKey={defaultKey}
      tabPosition={'top'}
      style={{ width: '100%', height: 'height: calc(100vh - 181px)' }}
      items={items}
    />
  );
}

const styles = {
  introContainer: {
    textAlign: 'center' as 'center',
    margin: '20% 30% auto',
    width: '45%',
    position: 'absolute' as 'absolute',
    zIndex: 7,
  },
  introTitle: {
    userSelect: 'none' as 'none',
    color: 'rgba(17, 112, 134, 0.58)',
    fontSize: '25px',
    top: '120px',
  },
};
