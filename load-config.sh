#!/bin/bash
# Muat params.conf, dipanggil dengan "source". / Load params.conf, use with "source".
REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
export REPO_ROOT

while IFS='=' read -r key value; do
  case "$key" in ''|\#*) continue ;; esac
  # Nilai dari environment menang. / Environment values win.
  if [ -z "${!key+x}" ]; then export "$key=$value"; fi
done < "$REPO_ROOT/params.conf"

# Path relatif dijadikan absolut. / Relative paths become absolute.
for key in DATASET_CSV FIGURE_DIR CHAINCODE_DIR COLLECTION_CONFIG WALLET_DIR \
           CERTS_DIR API_WALLET_DIR BENCH_DIR FABRIC_BIN; do
  case "${!key}" in
    /*) ;;
    *) export "$key=$REPO_ROOT/${!key}" ;;
  esac
done
