# Nest

Nest is an NFT creation, deployment, minting, and discovery product for Robinhood Chain. The repository includes the responsive frontend, wallet-authenticated backend API, PostgreSQL schema and migrations, IPFS adapters, smart-contract prototypes, and Docker hosting configuration.

## Repository layout

- `outputs/` - browser frontend and product documentation.
- `outputs/backend/` - Fastify, TypeScript, Prisma, and PostgreSQL API.
- `outputs/backend/prisma/migrations/` - versioned database schema applied during deployment.
- `outputs/contracts/` - Robinhood Chain NFT factory and collection contract prototypes.
- `docker-compose.yml` - frontend, API, and PostgreSQL local stack.
- `scripts/` - Windows setup and start helpers.

## Start locally

Install Git and Docker Desktop first, then open PowerShell in the repository:

```powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1
PowerShell -ExecutionPolicy Bypass -File .\scripts\start-local.ps1
```

Open:

- Frontend: `http://127.0.0.1:4178`
- Backend health: `http://127.0.0.1:8787/health`
- PostgreSQL: `127.0.0.1:5432`

The first backend boot runs committed Prisma migrations. PostgreSQL data is stored in the `nest_postgres` Docker volume and is not committed to Git.

## Required production configuration

Copy `.env.example` to `.env` with the setup script, then replace placeholder values. At minimum configure:

- `NEST_SESSION_SECRET`
- `PLATFORM_TREASURY_ADDRESS`
- `FACTORY_TESTNET_ADDRESS`
- Robinhood RPC URLs
- `PINATA_JWT` and `IPFS_PROVIDER=pinata`
- `OPENSEA_API_KEY`
- production `APP_ORIGIN`

Never commit `.env`, wallet private keys, seed phrases, API secrets, or database backups.

## Verification

```powershell
cd outputs\backend
npm install
npm run typecheck
npm audit --omit=dev
```

See [GITHUB_PUSH.md](./GITHUB_PUSH.md) for the exact first-push process and [outputs/backend/PRD.md](./outputs/backend/PRD.md) for production acceptance requirements.
