#!/bin/bash
#
# Copyright IBM Corp All Rights Reserved
#
# SPDX-License-Identifier: Apache-2.0
#
# Berhenti saat ada galat. / Exit on first error.
set -ex

# Muat parameter terpusat. / Load the central parameters.
source "$(dirname "$0")/load-config.sh"
cd "$REPO_ROOT"

# Matikan jaringan uji. / Bring the test network down.
pushd ./test-network
./network.sh down
popd

# Hapus identitas lama di wallet. / Clean out old identities in the wallets.
rm -rf "${API_WALLET_DIR:?}"/*
