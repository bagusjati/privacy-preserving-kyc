#!/bin/bash
# Jalankan orderer sebagai proses native. / Start the orderer as a native process.
source "$(dirname "$0")/../load-config.sh"
B=$BENCH_DIR
ORDERER=$B/organizations/ordererOrganizations/example.com/orderers/orderer.example.com
OTLS=$ORDERER/tls
export FABRIC_CFG_PATH=$B/orderer/cfg
export ORDERER_GENERAL_LISTENADDRESS=$NODE_HOST ORDERER_GENERAL_LISTENPORT=$ORDERER_PORT
export ORDERER_GENERAL_LOCALMSPID=OrdererMSP
export ORDERER_GENERAL_LOCALMSPDIR=$ORDERER/msp
# TLS aktif. / TLS enabled.
export ORDERER_GENERAL_TLS_ENABLED=true
export ORDERER_GENERAL_TLS_CERTIFICATE=$OTLS/server.crt
export ORDERER_GENERAL_TLS_PRIVATEKEY=$OTLS/server.key
export ORDERER_GENERAL_TLS_ROOTCAS=[$OTLS/ca.crt]
export ORDERER_GENERAL_CLUSTER_CLIENTCERTIFICATE=$OTLS/server.crt
export ORDERER_GENERAL_CLUSTER_CLIENTPRIVATEKEY=$OTLS/server.key
# Tanpa system channel, channel dibuat lewat osnadmin. / No system channel, the channel is joined with osnadmin.
export ORDERER_GENERAL_BOOTSTRAPMETHOD=none ORDERER_CHANNELPARTICIPATION_ENABLED=true
export ORDERER_ADMIN_LISTENADDRESS=$NODE_HOST:$ORDERER_ADMIN_PORT ORDERER_ADMIN_TLS_ENABLED=false
export ORDERER_FILELEDGER_LOCATION=$B/orderer/data
export ORDERER_OPERATIONS_LISTENADDRESS=$NODE_HOST:$ORDERER_OPS_PORT
export ORDERER_CONSENSUS_WALDIR=$B/orderer/data/wal ORDERER_CONSENSUS_SNAPDIR=$B/orderer/data/snap
exec "$FABRIC_BIN/orderer"
