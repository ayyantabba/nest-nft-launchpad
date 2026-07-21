# Grok Build Continuation Prompt: Nest NFT Launchpad

You are continuing development of **Nest**, a production-oriented NFT launchpad for Robinhood Chain. Work as a senior full-stack and smart-contract engineer. Preserve existing functionality and visual direction. Do not invent deployment results, do not expose secrets, and do not enable mainnet until every release gate below is satisfied.

## Project locations

- GitHub repository: `https://github.com/ayyantabba/nest-nft-launchpad`
- Frontend production URL: `https://nest-nft-launchpad.vercel.app`
- Backend production base: `https://nest-nft-launchpad-production.up.railway.app/v1`
- Backend health: `https://nest-nft-launchpad-production.up.railway.app/v1/health`
- Vercel project deploys the repository root using `vercel.json` and `scripts/prepare-vercel.mjs`.
- Railway deploys the backend using the root `Dockerfile` / `railway.json`; backend source is under `outputs/backend`.
- Supabase PostgreSQL is accessed only by Railway through `DATABASE_URL`.

## Product and network

- Product name: Nest
- Production chain: Robinhood Chain mainnet, chain ID `4663`, ETH gas.
- Test chain: Robinhood Chain Testnet, chain ID `46630`.
- Mainnet public RPC fallback: `https://rpc.mainnet.chain.robinhood.com`.
- Testnet RPC: `https://rpc.testnet.chain.robinhood.com`.
- Mainnet explorer: `https://robinhoodchain.blockscout.com`.
- Testnet explorer: `https://explorer.testnet.chain.robinhood.com`.
- Treasury: `0xaB81d488395EdebC6632c7546d223439bD8FBdD1`.
- Fee: 5% of primary mint revenue; creator share: 95%.
- Use a paid production RPC provider for production traffic. The official public RPC is rate-limited.

## Repository map

- `outputs/index.html`: frontend shell.
- `outputs/app.js`: client routing, wallet auth, launch flow, deployment, minting, dashboards, revenue withdrawals, marketplace handoff.
- `outputs/styles.css`: responsive premium Nest UI.
- `outputs/runtime-config.js`: two-factor testnet/mainnet frontend guard.
- `outputs/assets/`: NFT imagery, fallback collection artwork, compiled factory web artifact.
- `outputs/contracts/src/RobinhoodNFTCollection.sol`: ERC-721, ERC-2981, mint limits, metadata, pull-payment revenue accounting.
- `outputs/contracts/src/RobinhoodNFTFactory.sol`: collection factory, treasury/fee configuration, pause controls.
- `outputs/contracts/test/collection.test.mjs`: local Ganache regression suite.
- `outputs/contracts/compile.cjs`: pinned Solidity compiler build.
- `outputs/contracts/test-revenue-flow.mjs`: hosted testnet end-to-end paid mint and withdrawal test.
- `outputs/backend/src/server.ts`: Fastify API, SIWE-style wallet auth, collections, Pinata, deploy/mint confirmation, revenue reads, OpenSea adapter, health.
- `outputs/backend/src/config.ts`: validated server environment.
- `outputs/backend/prisma/schema.prisma`: Supabase/PostgreSQL schema.
- `outputs/backend/prisma/migrations/`: production database migrations.
- `outputs/backend/openapi.yaml`: API contract, including revenue prepare/record/confirm routes; keep it synchronized with routes.
- `scripts/prepare-vercel.mjs`: builds `vercel-dist`, copies assets, and injects same-origin SRI hashes.
- `.github/workflows/ci.yml`: contract, backend, and frontend CI.
- `MAINNET_RELEASE.md`: authoritative mainnet release runbook.
- `outputs/SECURITY.md`, `outputs/CONTRACTS.md`, `outputs/ARCHITECTURE.md`: architecture and security notes.

## Current contract behavior (v1.1.0 source)

The collection uses a pull-payment model. Minting leaves ETH in the collection contract while enforcing allocation in storage:

- `creatorAccrued += 95%`
- `platformAccrued += 5%`
- `withdrawCreator()` pays only immutable `creatorPayout`.
- `withdrawPlatform()` pays only immutable `platformTreasury`.
- `withdrawTreasury()` is a compatibility alias for the same fixed platform payout.
- Anyone can trigger a withdrawal, but nobody can change its recipient.
- Both withdrawal paths use reentrancy protection, checks-effects-interactions, and reject zero balances.
- `totalSupply()` returns `totalMinted` for marketplace/indexer compatibility.
- Exact payment, max supply, per-wallet limit, and per-transaction limit are enforced onchain.
- ERC-2981 royalties are signaled but marketplace-dependent.

Local contract tests currently cover exact payment, under/overpayment rejection, independent wallet cap, 95/5 accrual, creator payout, treasury payout, totalSupply, ERC-2981, and zero-withdraw revert. Always run `npm ci && npm test` in `outputs/contracts` after contract changes.

The backend has a `RevenueWithdrawal` table and verifies withdrawal transaction destination, sender, receipt status, fixed-recipient event, and amount before marking settlement confirmed. Dashboard totals expose onchain accrued balances separately from database-confirmed settled balances.

## Important production state

- Release commit `e331331` passed GitHub Actions run `#79` on 2026-07-21: contracts, backend, and frontend all succeeded.
- Railway `/v1/health` was verified after deployment: database and Pinata are healthy, testnet and mainnet RPC probes pass, testnet factory configuration is present, and mainnet remains disabled.
- Vercel was verified after deployment: home and `robots.txt` return 200, SRI hashes are present, and `runtime-config.js` remains on guarded testnet mode.
- Previous testnet factory: `0xa3EbB73a56723159C03f1C682A57E1d4D99F560d` (v1.0 test artifact). It cannot deploy updated v1.1 collection bytecode.
- Backend was healthy with database, Pinata, and testnet factory enabled.
- Mainnet was intentionally disabled and had no verified `FACTORY_MAINNET_ADDRESS` at the time of this handoff.
- The v1.1 testnet factory has not yet been broadcast. No `TESTNET_DEPLOYER_PRIVATE_KEY` exists in the current workspace environment. Do not ask the user to paste one; deploy through the connected owner wallet at `#/admin`, or inject a disposable testnet key only into a private local process outside source control.
- Do not change `outputs/runtime-config.js` to mainnet until a verified v1.1 mainnet factory exists and Railway is configured.
- Testnet artifacts from earlier QA are listed in the user's re-test report; do not treat them as production contracts.

## Required environment variables (names only; never print values)

Railway backend:

- `NODE_ENV`
- `PORT`
- `HOST`
- `APP_ORIGIN`
- `DATABASE_URL`
- `NEST_SESSION_SECRET`
- `ROBINHOOD_TESTNET_RPC_URL`
- `ROBINHOOD_MAINNET_RPC_URL`
- `PLATFORM_TREASURY_ADDRESS`
- `FACTORY_TESTNET_ADDRESS`
- `FACTORY_MAINNET_ADDRESS`
- `CONFIRM_MAINNET_DEPLOYMENT`
- `IPFS_PROVIDER`
- `PINATA_JWT`
- `IPFS_GATEWAY`
- `OPENSEA_API_KEY`
- `OPENSEA_CHAIN_SLUG`
- `ADMIN_WALLETS`

Frontend/runtime:

- WalletConnect project ID is currently loaded by the frontend configuration.
- API base defaults to the Railway URL.
- Runtime mainnet activation requires both `network: "mainnet"` and `confirmMainnetDeployment: true`.

## Security invariants

1. Never request, store, log, commit, or paste a seed phrase/private key.
2. All deploy and mint transactions are user-wallet signed.
3. Backend must verify transaction recipient, sender, chain, event data, paid amount, token IDs, and receipt success before writing confirmed state.
4. Collection mutation, storage, deployment, and creator-withdraw preparation require wallet ownership authorization.
5. Platform-withdraw preparation requires an `ADMIN_WALLETS` address.
6. Escape all attacker-controlled collection names, descriptions, URLs, traits, and filenames before rendering.
7. Mainnet is disabled unless both the factory address and explicit confirmation flag are present.
8. Never count `nestFeeAmountWei` as settled cash. It is accrued until a verified platform withdrawal transaction succeeds.
9. Preserve CORS allowlisting, rate limits, Helmet headers, nonce expiry, JWT expiry, and IDOR protections.
10. Contract changes require new factory deployment because factory bytecode embeds collection creation bytecode.

## Next required work

1. Deploy the v1.1 factory to testnet from the platform-owner wallet through `#/admin`.
2. Update Railway `FACTORY_TESTNET_ADDRESS`, then repeat the two-wallet paid-mint and both-withdrawal regression against hosted infrastructure.
3. Obtain an independent smart-contract audit/review of the exact compiled mainnet artifact.
4. Follow every step in `MAINNET_RELEASE.md`; do not skip the canary launch.
5. Only after those gates, deploy v1.1 to mainnet, verify it on Blockscout, configure Railway, and switch Vercel runtime to mainnet.
6. Add an event-reconciliation worker so permissionless withdrawals initiated outside Nest are imported into `RevenueWithdrawal` automatically.
7. Confirm whether OpenSea officially accepts the Robinhood Chain slug before promising marketplace indexing. Keep Blockscout/tokenURI links available regardless.

## Working style

- Inspect existing code before editing.
- Keep changes scoped and backward-compatible.
- Use deterministic contract builds and pinned dependencies.
- Add tests for every bug fix.
- Report exact commands, test results, transaction hashes, factory addresses, and deployment URLs, but redact secrets.
- Do not claim a deployment is complete until bytecode, constructor values, health, hosted UI, mint, both withdrawals, and database reconciliation have all been verified.
