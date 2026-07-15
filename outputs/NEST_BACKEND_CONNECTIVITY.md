# Nest Backend Connectivity

Nest should be the backend and deployer layer behind the launchpad UI.

## Responsibilities

- Verify wallet ownership with signed nonces.
- Store collection, artwork, metadata, deployment, mint, referral, and admin records.
- Upload artwork and metadata through server-side IPFS credentials.
- Prepare contract deployment transactions for the connected creator wallet.
- Record submitted deployment and mint transactions.
- Index Robinhood Chain events after deployment.
- Sync OpenSea marketplace data when available.
- Power creator and admin dashboards.

## Connectivity Flow

1. Frontend connects wallet with Wagmi/RainbowKit or ConnectKit.
2. Frontend requests `POST /auth/nonce` with the wallet address.
3. User signs the nonce in wallet.
4. Frontend sends signature to `POST /auth/verify`.
5. Nest verifies the signature and returns a session token.
6. Frontend includes the token on protected requests.
7. Creator creates collection and uploads artwork.
8. Nest uploads artwork/metadata to IPFS and stores CIDs.
9. Frontend asks Nest to simulate/prepare deployment.
10. User signs deployment transaction in wallet.
11. Frontend records tx hash with Nest.
12. Nest indexer confirms contract address and updates status.

## API Routes

```txt
GET  /health

POST /auth/nonce
POST /auth/verify
POST /auth/logout

POST /collections
GET  /collections
GET  /collections/:id
PATCH /collections/:id

POST /storage/artwork
POST /storage/metadata
POST /storage/verify

POST /deployments/simulate
POST /deployments/prepare
POST /deployments/record
GET  /deployments/:id

POST /mints/record
GET  /mints/collection/:collectionId

GET  /dashboard/creator
GET  /dashboard/admin

POST /opensea/sync
GET  /opensea/collections

POST /referrals
GET  /referrals
```

## Environment

```env
NEXT_PUBLIC_NEST_API_URL=http://127.0.0.1:8787
NEST_API_PORT=8787
NEST_SESSION_SECRET=
DATABASE_URL=postgresql://user:password@localhost:5432/nest_launchpad

ROBINHOOD_TESTNET_RPC=https://rpc.testnet.chain.robinhood.com
ROBINHOOD_MAINNET_RPC=https://rpc.mainnet.chain.robinhood.com
CONFIRM_MAINNET_DEPLOYMENT=false

PLATFORM_TREASURY_ADDRESS=0xaB81d488395EdebC6632c7546d223439bD8FBdD1

IPFS_PROVIDER=
IPFS_API_KEY=
IPFS_API_SECRET=

OPENSEA_API_KEY=
```

## Testnet Checklist

- `NEXT_PUBLIC_NETWORK=robinhood-testnet`
- Chain ID must be `46630`.
- Creator wallet connects and signs nonce.
- Artwork uploads through Nest storage endpoint.
- Metadata URI resolves before deployment.
- Deployment simulation succeeds.
- User signs deployment from wallet.
- Nest stores transaction hash.
- Indexer confirms contract address.
- Second wallet mints from public mint page.
- Dashboard reflects minted supply and revenue split.

## Mainnet Checklist

- `NEXT_PUBLIC_NETWORK=robinhood-mainnet`
- Chain ID must be `4663`.
- `CONFIRM_MAINNET_DEPLOYMENT=true`
- Treasury wallet is set.
- Creator payout wallet is verified.
- Metadata and contract URI resolve.
- Gas estimate is shown before signing.
- User manually confirms mainnet deployment.
- First mainnet deployment should be a tiny internal collection.

## Frontend Integration Points

- Wallet connection stays frontend-side.
- Backend never receives private keys.
- Backend verifies signed messages only.
- Deployment and mint transactions are signed by the connected wallet.
- Nest records transaction hashes and indexes events afterward.

