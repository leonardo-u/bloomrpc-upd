import * as React from 'react';
import { useEffect, useState } from 'react';
import { Button, Input, Radio, Table } from "antd";
import { CloseOutlined, PlusCircleOutlined } from "@ant-design/icons";
import { Certificate, importCertChain, importPrivateKey, importRootCert } from "../../behaviour";
import { getTLSList, storeTLSList } from "../../storage";

interface TLSManagerProps {
    selected?: Certificate
    onSelected?: (value?: Certificate) => void
}

export function TLSManager({ selected, onSelected }: TLSManagerProps) {
    const [certs, setStateCerts] = useState<Certificate[]>([]);

    function setCerts(newCerts: Certificate[]) {
      setStateCerts(newCerts);
      storeTLSList(newCerts);
    }

    useEffect(() => {
      setStateCerts(getTLSList());
    }, []);

    return (
        <>
        <div>
            <Button
                type="primary"
                onClick={async () => {
                  const cert = await handleImportRootCert(certs, setCerts);

                  if (cert && cert.rootCert.filePath === (selected && selected.rootCert.filePath)) {
                    onSelected && onSelected(cert);
                  }
                }}
                style={{
                    borderRadius: 0,
                    width: "100%"
                }}
            >
              <PlusCircleOutlined /> Add Root Certificate
            </Button>
        </div>
        <Table
            dataSource={certs}
            pagination={false}
            rowKey={(certificate: Certificate) => certificate.rootCert.filePath}
        >
            <Table.Column
                title={(
                    <Radio
                        name={"tls"}
                        value={""}
                        checked={!selected}
                        onChange={() => onSelected && onSelected()}
                    />
                )}
                key="radio"
                render={(text, certificate: Certificate) => (
                    <div>
                        <Radio
                            name={"tls"}
                            value={certificate.rootCert.filePath}
                            checked={selected && certificate.rootCert.filePath === selected.rootCert.filePath}
                            onChange={() => onSelected && onSelected(certificate)}
                        />
                    </div>
                )}
            />
            <Table.Column
                title="Root Certificate"
                key="rootCert"
                render={(text, record: Certificate) => (
                    <div>
                        <span title={record.rootCert.filePath}>{record.rootCert.fileName}</span>
                    </div>
                )}
            />
            <Table.Column
                title="Private Key"
                key="privateKey"
                render={(text, certificate: Certificate) => {
                    const {privateKey} = certificate;
                    if (certificate.useServerCertificate === true) {
                      return <div>-</div>
                    }
                    return (
                        <>
                            {privateKey ? (
                                <span>{privateKey.fileName}</span>
                            ) : (
                                <a onClick={async (e) => {
                                  e.preventDefault();
                                  const cert = await handleImportPrivateKey(certificate, certs, setCerts);
                                  if (cert && cert.rootCert.filePath === (selected && selected.rootCert.filePath)) {
                                    onSelected && onSelected(cert);
                                  }
                                }}>Import Key</a>
                            )}
                        </>
                    )
                }}
            />
            <Table.Column
                title="Cert Chain"
                dataIndex="certChain"
                key="certChain"
                render={(text, certificate: Certificate) => {
                    if (certificate.useServerCertificate === true) {
                      return <div>-</div>
                    }
                    return (
                        <>
                            {certificate.certChain ? (
                                <span title={certificate.certChain.filePath}>
                                  {certificate.certChain.fileName}
                                </span>
                            ) : (
                                <a onClick={async (e) => {
                                  e.preventDefault();
                                  const cert = await handleImportCertChain(certificate, certs, setCerts);
                                  if (cert && cert.rootCert.filePath === (selected && selected.rootCert.filePath)) {
                                    onSelected && onSelected(cert);
                                  }
                                }}>Import Cert Chain</a>
                            )}
                        </>
                    )
                }}
            />
            <Table.Column
              key="sslTarget"
              render={(text, certificate: Certificate) => {
                if(certificate.useServerCertificate === true) {
                  return <div />
                }
                return (
                    <Input placeholder={"ssl target host"} defaultValue={certificate.sslTargetHost} onChange={(e) => {
                      const cert = setSslTargetHost(
                          e.target.value,
                          certificate,
                          certs,
                          setCerts
                      );

                      if (cert && cert.rootCert.filePath === (selected && selected.rootCert.filePath)) {
                        onSelected && onSelected(cert);
                      }
                    }}/>
                )
              }}
            />
            <Table.Column
              key="delete"
              render={(text, certificate: Certificate) => {
                if(certificate.useServerCertificate === true) {
                  return <div />
                }
                return (
                    <CloseOutlined
                        onClick={() => {
                          if (selected && selected.rootCert.filePath === certificate.rootCert.filePath) {
                            onSelected && onSelected();
                          }
                          deleteCertificateEntry(certificate, certs, setCerts);
                        }}
                        style={{
                          cursor: "pointer",
                        }}
                    />
                )
              }}
            />
        </Table>
        </>
    );
}

async function handleImportRootCert(certs: Certificate[], setCerts: React.Dispatch<Certificate[]>): Promise<Certificate | void> {
  try {
    const certificate = await importRootCert();

    const newCerts = certs
        .filter((cert) => cert.rootCert.filePath !== certificate.rootCert.filePath);

    newCerts.push(certificate);

    setCerts(newCerts);

    return certificate;
  } catch (e) {
    // No file selected.
  }
}

async function handleImportPrivateKey(
    certificate: Certificate,
    certs: Certificate[],
    setCerts: React.Dispatch<Certificate[]>
): Promise<Certificate | void> {
  try {
    const updated: Certificate = {
      ...certificate,
      privateKey: await importPrivateKey(),
    };

    const certIndex = certs.findIndex((cert) => cert.rootCert.filePath === certificate.rootCert.filePath);
    const newCerts = [...certs];
    newCerts[certIndex] = updated;

    setCerts(newCerts);
    return updated;
  } catch (e) {
    // No file Selected
  }
}

async function handleImportCertChain(
    certificate: Certificate,
    certs: Certificate[],
    setCerts: React.Dispatch<Certificate[]>
): Promise<Certificate | void> {
  try {
    const updated: Certificate = {
      ...certificate,
      certChain: await importCertChain(),
    };

    const certIndex = certs.findIndex((cert) => cert.rootCert.filePath === certificate.rootCert.filePath);
    const newCerts = [...certs];
    newCerts[certIndex] = updated;

    setCerts(newCerts);
    return updated;
  } catch (e) {
    // No file Selected
  }
}

function deleteCertificateEntry(
  certificate: Certificate,
  certs: Certificate[],
  setCerts: React.Dispatch<Certificate[]>
) {
  const certIndex = certs.findIndex((cert) => cert.rootCert.filePath === certificate.rootCert.filePath);

  const certificates = [...certs];
  certificates.splice(certIndex, 1);

  setCerts(certificates);
}

function setSslTargetHost(
    value: string,
    certificate: Certificate,
    certs: Certificate[],
    setCerts: React.Dispatch<Certificate[]>
): Certificate {
  const certIndex = certs.findIndex((cert) => cert.rootCert.filePath === certificate.rootCert.filePath);
  const updated: Certificate = { ...certificate, sslTargetHost: value };
  const newCerts = [...certs];
  newCerts[certIndex] = updated;

  setCerts(newCerts);

  return updated;
}
