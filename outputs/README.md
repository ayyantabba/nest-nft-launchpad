# Nest

Community-built NFT creation and launch infrastructure for Robinhood Chain.

This preview focuses the product on the real production path:

Artwork -> IPFS image -> IPFS metadata -> wallet transaction -> Robinhood Chain Testnet contract -> public mint -> onchain NFT -> explorer verification -> OpenSea-compatible indexing.

The static UI does not fake deployments, mints, balances, IPFS uploads, OpenSea listings, or indexed events. If OpenSea returns no Robinhood Chain records, the collection surfaces render an empty integration state instead of placeholder collections.

## Local Review

Open `index.html` or use the local preview URL.

## Backend Connectivity

Nest backend connectivity starts with:

- `NEST_BACKEND_CONNECTIVITY.md` for the API and wallet flow.
- `config/backend.ts` for frontend API configuration.
- `backend/prisma/schema.prisma` for the PostgreSQL schema.

Recommended local backend URL:

```env
NEXT_PUBLIC_NEST_API_URL=http://127.0.0.1:8787
NEST_API_PORT=8787
DATABASE_URL=postgresql://user:password@localhost:5432/nest_launchpad
```

## Network Defaults

Local development defaults to Robinhood Chain Testnet.

- Testnet chain ID: `46630`
- Testnet RPC: `https://rpc.testnet.chain.robinhood.com`
- Testnet explorer: `https://explorer.testnet.chain.robinhood.com`
- Mainnet chain ID: `4663`
- Mainnet RPC: `https://rpc.mainnet.chain.robinhood.com`
- Mainnet explorer: `https://robinhoodchain.blockscout.com`

## Mainnet Safety

Do not deploy to mainnet from automated setup. Mainnet deployment should require `CONFIRM_MAINNET_DEPLOYMENT=true` and a manual review of supply, mint price, payout wallet, metadata, ownership, treasury, and factory version.

## Disclaimer

This is an independent application built on Robinhood Chain and is not affiliated with or endorsed by Robinhood Markets, Inc. Marketplace availability and royalty enforcement depend on third-party platforms.
