#!/usr/bin/env bash
# Build, deploy and initialize Tempo contracts on Stellar testnet.
# Requires: stellar CLI (https://developers.stellar.org/docs/tools/cli)
set -euo pipefail

NETWORK=testnet
FEE_BPS=${FEE_BPS:-1000}   # 10% platform fee
# Circle's testnet USDC. Override with TOKEN_ASSET=native to use XLM for quick tests.
TOKEN_ASSET=${TOKEN_ASSET:-USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5}

cd "$(dirname "$0")/../contracts"

for k in tempo-admin tempo-oracle; do
  stellar keys address "$k" >/dev/null 2>&1 || stellar keys generate "$k" --network "$NETWORK" --fund
done
ADMIN=$(stellar keys address tempo-admin)
ORACLE=$(stellar keys address tempo-oracle)

echo "Building contracts..."
stellar contract build

WASM=target/wasm32v1-none/release
PAYMENT_ID=$(stellar contract deploy --wasm "$WASM/course_payment.wasm" --source tempo-admin --network "$NETWORK")
CERT_ID=$(stellar contract deploy --wasm "$WASM/certificate.wasm" --source tempo-admin --network "$NETWORK")
TOKEN_ID=$(stellar contract asset id --asset "$TOKEN_ASSET" --network "$NETWORK")

echo "Initializing..."
stellar contract invoke --id "$PAYMENT_ID" --source tempo-admin --network "$NETWORK" -- init \
  --admin "$ADMIN" --token "$TOKEN_ID" --treasury "$ADMIN" --platform_fee_bps "$FEE_BPS" --oracle "$ORACLE"

stellar contract invoke --id "$CERT_ID" --source tempo-admin --network "$NETWORK" -- init \
  --admin "$ADMIN" --issuer "$ORACLE"

cat <<OUT

✅ Deployed to $NETWORK

backend/.env
  ORACLE_SECRET=$(stellar keys show tempo-oracle)
  COURSE_PAYMENT_CONTRACT_ID=$PAYMENT_ID
  CERTIFICATE_CONTRACT_ID=$CERT_ID

frontend/.env.local
  NEXT_PUBLIC_COURSE_PAYMENT_CONTRACT_ID=$PAYMENT_ID

Next: list a course on-chain (id 1 matches the demo course in backend/src/store.js):
  stellar contract invoke --id $PAYMENT_ID --source <instructor-key> --network $NETWORK -- \\
    create_course --instructor <INSTRUCTOR_G_ADDRESS> --price 150000000 --splits '[]'
OUT
