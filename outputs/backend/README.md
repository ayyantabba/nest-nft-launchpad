# Nest Backend

Production handoff scaffold for the Nest NFT launchpad on Robinhood Chain. The API stores launch data, authenticates wallets, prepares unsigned transactions, and indexes creator-signed transactions. It never accepts wallet seed phrases or private keys.

Read `PRD.md` before implementation. `openapi.yaml` is the frontend/backend contract.

## Local start

Requirements: Node.js 20+, Docker Desktop, and npm.

```bash
cp .env.example .env
docker compose up -d postgres
npm install
npm run db:generate
npm run db:migrate:dev -- --name init
npm run dev
```

The API is available at `http://127.0.0.1:8787`. Check `GET /health` before connecting the frontend.

## Connect the frontend

Set the frontend environment value:

```env
NEXT_PUBLIC_NEST_API_URL=http://127.0.0.1:8787/v1
```

The browser connects the wallet, requests a nonce, asks the wallet to sign the returned message, verifies the signature, and uses the returned bearer token for protected requests.

## Required production secrets

- `DATABASE_URL`: managed PostgreSQL connection string.
- `NEST_SESSION_SECRET`: at least 32 random characters; use a secrets manager.
- `APP_ORIGIN`: exact production frontend URL. Separate multiple origins with commas.
- `ROBINHOOD_TESTNET_RPC_URL` and `ROBINHOOD_MAINNET_RPC_URL`: private RPC provider URLs where possible.
- `PLATFORM_TREASURY_ADDRESS`: multisig wallet receiving Nest's enforced 5% share.
- `FACTORY_TESTNET_ADDRESS` and `FACTORY_MAINNET_ADDRESS`: deployed audited factory addresses.
- `PINATA_JWT`: server-only upload credential.
- `OPENSEA_API_KEY`: server-only marketplace credential.

Never put `NEST_SESSION_SECRET`, `PINATA_JWT`, RPC credentials, or deployer keys in frontend variables. Creator deployment and mint transactions must be signed in the creator/buyer wallet.

## Hosting

### Railway

1. Create a Railway project from this `backend` folder.
2. Add PostgreSQL to the project.
3. Add every required environment variable from `.env.example`.
4. Deploy using `railway.json` and `Dockerfile`.
5. Run the first schema migration from CI or a one-off shell with `npm run db:migrate`.
6. Point `api.nest.example` at the Railway service and set `APP_ORIGIN` to the frontend origin.

### Render

Create a Blueprint from `render.yaml`, then provide the missing secrets and addresses in the dashboard. Upgrade the database plan and enable backups before mainnet.

### Any Docker host

```bash
docker build -t nest-api .
docker run --env-file .env -p 8787:8787 nest-api
```

## Production gates

The `/deployments/prepare` route currently returns placeholder calldata (`0x`). The assigned backend/web3 developer must connect the audited factory ABI, run `simulateContract`, and return encoded calldata before any public deployment. Mainnet remains disabled unless `CONFIRM_MAINNET_DEPLOYMENT=true`.

Before mainnet: complete IPFS upload routes, implement the chain indexer, add idempotency keys, replace bearer tokens with hashed refresh-session records, finish admin authorization, add automated tests, audit contracts, and run a testnet launch/mint/withdrawal rehearsal.
