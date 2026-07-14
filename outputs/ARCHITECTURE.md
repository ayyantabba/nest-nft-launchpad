# Architecture

## Product Positioning

Nest is the permissionless NFT launchpad for Robinhood Chain. Creators upload artwork, generate metadata, configure a collection, deploy an ERC-721 contract on Robinhood Chain, and receive a public mint page without writing code.

## Application Layers

- `config/`: centralized network, marketplace, contract, and environment configuration.
- `config/backend.ts`: frontend-to-Nest API connectivity contract.
- `backend/prisma/schema.prisma`: starter PostgreSQL data model for Nest.
- `contracts/src/`: Foundry Solidity contracts for factory and creator collections.
- `contracts/test/`: Foundry test plan and test location.
- `contracts/script/`: deployment scripts for local, testnet, and mainnet flows.
- `lib/` target architecture: chain reads, contract calls, database, indexer, IPFS, metadata, OpenSea, security, validation.

## Source Of Truth

Onchain state is authoritative for ownership, supply, mint price, balances, and contract permissions. The database should cache indexed events, user-submitted profile data, marketplace state, and storage manifests.

## Required Runtime Stack

- Next.js
- TypeScript
- Wagmi
- Viem
- WalletConnect-compatible wallet support
- PostgreSQL with Prisma
- Server-side IPFS storage provider
- Robinhood Chain event indexer

## Backend Connectivity

Nest backend connectivity is documented in `NEST_BACKEND_CONNECTIVITY.md`.

The core pattern is:

1. Frontend connects wallet.
2. Nest verifies wallet ownership with a signed nonce.
3. Nest stores collection, artwork, metadata, deployment, mint, and referral records.
4. User signs deploy and mint transactions from their own wallet.
5. Nest records transaction hashes and indexes chain events.

## Current Preview Status

The included static interface is an art-directed product preview and implementation scaffold. It intentionally avoids pretending to send wallet transactions, deploy contracts, upload to IPFS, or read indexed marketplace data.
