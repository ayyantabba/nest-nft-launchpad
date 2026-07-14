# Nest Backend Product Requirements Document

**Product:** Nest NFT Launchpad
**Document version:** 1.0
**Owner:** Nest
**Audience:** backend, web3, infrastructure, and frontend engineers
**Initial chain:** Robinhood Chain testnet (`46630`) and mainnet (`4663`)

## 1. Product summary

Nest lets a creator upload NFT artwork and metadata, configure a collection, deploy through a factory contract, publish a mint page, and monitor mint revenue. Buyers connect a wallet and mint from collections deployed through Nest.

The backend is the source of truth for offchain product data and indexed blockchain state. The blockchain remains the source of truth for ownership, mint supply, contract configuration, payments, and transaction finality.

## 2. Goals

- Authenticate users by wallet ownership without passwords.
- Persist collection drafts, artwork, metadata, deployments, mints, referrals, and admin actions.
- Upload immutable artwork and metadata to IPFS through server-only credentials.
- Prepare safe unsigned deployment and mint transactions for browser wallets.
- Index factory and collection events and reconcile database state.
- Power public mint pages, creator dashboards, and the Nest admin dashboard.
- Support Robinhood testnet first and promote the same release to mainnet after approval.
- Provide a containerized service that can be hosted on Railway, Render, Fly.io, ECS, or another Docker host.

## 3. Non-goals for version 1

- Custodying user wallets, seed phrases, or creator private keys.
- Operating a secondary NFT marketplace or order book.
- Guaranteeing ERC-2981 royalty payment by third-party marketplaces.
- Arbitrary user-supplied smart contract bytecode.
- Solana deployment in the initial Robinhood release.
- Fiat checkout, card payments, or tax reporting.

## 4. Users and permissions

### Visitor

Can browse live collections, public metadata, mint progress, and confirmed activity.

### Authenticated wallet

Can create collection drafts, upload assets, prepare deployments, record transactions, mint, and view wallet-specific data.

### Collection creator

Can update owned drafts, manage metadata before freeze, deploy, pause supported contract actions through their wallet, and view revenue analytics.

### Nest administrator

Can feature/unfeature collections, review reports, see operational metrics, retry indexing, and annotate incidents. Admin authorization is an allowlist for MVP and should move to role records plus multisig-controlled operations.

## 5. Core flows

### Wallet authentication

1. Browser posts checksummed wallet address to `POST /v1/auth/nonce`.
2. API creates a random one-time nonce with a ten-minute expiry.
3. Browser asks the wallet to sign the exact returned message.
4. Browser sends the message, signature, and session ID to `POST /v1/auth/verify`.
5. API validates message integrity, nonce, expiry, address, and signature.
6. API consumes the nonce and returns a short-lived access session.
7. Replayed or expired challenges fail.

Production implementation should follow SIWE/EIP-4361 where Robinhood wallet compatibility permits it. Include domain, URI, chain ID, nonce, issued time, and expiry to prevent cross-site replay.

### Create and publish a collection

1. Creator authenticates and creates a draft.
2. Creator uploads artwork with MIME, size, count, and malware checks.
3. API pins artwork and records immutable CIDs.
4. Creator edits names, descriptions, and traits.
5. API generates deterministic ERC-721 metadata JSON and pins it.
6. API validates that every metadata URI resolves and supply matches token count.
7. API simulates the factory call and returns an unsigned transaction request.
8. Creator signs and broadcasts from the browser wallet.
9. Browser records the transaction hash.
10. Indexer confirms `CollectionCreated`, writes the contract address, and marks the collection live.
11. Public mint page becomes discoverable only after required confirmations.

### Mint and revenue

1. Buyer opens a live Nest collection and connects a compatible wallet.
2. API/frontend validates mint window, remaining supply, wallet limit, quantity, and expected value.
3. Browser simulates and submits the mint directly to the collection contract.
4. Browser records the hash for immediate pending UI.
5. Indexer confirms mint events and updates supply and activity idempotently.
6. Contract accrues exactly 500 basis points to the Nest treasury and 9500 basis points to the creator for primary revenue.
7. Dashboard reports indexed onchain values; it never trusts client-supplied fee calculations.

## 6. Functional requirements

### Authentication and sessions

- Normalize/checksum EVM addresses at the boundary.
- Nonces must be random, single-use, and expire within ten minutes.
- Rate-limit nonce creation by IP and wallet.
- Revoke active sessions on explicit logout.
- Store refresh tokens as hashes, never plaintext, in the production revision.
- Protected routes must derive wallet identity from the session, not request bodies.

### Collections

- Draft fields: name, symbol, description, artwork, supply, mint price, wallet limit, royalties, start/end, payout wallet, website, social link, reveal mode, chain, and referral code.
- `nestFeeBps` is server-controlled and fixed at `500`; clients cannot override it.
- A creator can mutate a draft, but immutable/deployed contract values cannot be silently edited.
- Public list endpoints return only safe, published fields.
- Pagination must be cursor-based.

### Storage and metadata

- Supported artwork: PNG, JPEG, WebP, GIF, MP4, and GLB, subject to product limits.
- Default max upload is 25 MB per file; larger media requires an explicit plan.
- Validate actual file signatures, not only browser MIME headers.
- Strip filenames from storage paths and generate server-side object names.
- Pin artwork before metadata because metadata contains final content URIs.
- Metadata follows the ERC-721/OpenSea shape: `name`, `description`, `image`, optional `animation_url`, and `attributes`.
- Return per-file errors and make batch operations resumable.
- Never expose Pinata/IPFS credentials to the browser.

### Deployment

- Support chain IDs `46630` and `4663`; reject unknown chains in the initial release.
- Read factory address and ABI from versioned configuration.
- Simulate factory deployment against the selected RPC before returning calldata.
- Verify creator, payout wallet, supply, price, mint window, royalty cap, base URI, contract URI, fee, and treasury.
- Return `to`, `data`, `value`, `chainId`, estimated gas, factory version, and human-readable summary.
- Require the browser wallet to sign and broadcast.
- Never use a backend deployer private key for user collections.
- Mainnet preparation is disabled by default and requires an explicit environment gate.

### Indexer

- Watch factory `CollectionCreated` events and collection mint/withdrawal/admin events.
- Persist chain ID, transaction hash, log index, block number, and decoded payload.
- Enforce uniqueness on `(chainId, transactionHash, logIndex)`.
- Wait a configurable number of confirmations before finalizing.
- Handle reorgs by retaining block hashes and replaying from the last finalized checkpoint.
- Reconcile `mintedSupply`, collection status, creator revenue, and Nest fee from chain events.
- Run independently from HTTP traffic as a worker process in production.
- Alert when lag exceeds five minutes or RPC requests repeatedly fail.

### Dashboards and admin

- Creator metrics: active collections, confirmed minted supply, gross revenue, creator share, Nest fees, holder count, recent activity, contract links, and withdrawal state.
- Admin metrics: launches, volume, fees, active mints, failed deployments, reports, top creators, indexer lag, and RPC/storage health.
- All monetary values are stored as base-unit decimal strings and formatted only at presentation time.
- Admin actions require authentication, authorization, and an immutable audit record.

### Referrals

- Generate unique referral codes/links.
- Attribute the creator/collection at draft creation and preserve attribution through deployment.
- Track confirmed referred primary revenue separately from calculated commission.
- Commission payout remains disabled until commercial and legal rules are approved.

## 7. API contract

`openapi.yaml` is the machine-readable baseline. The developer must complete schemas and responses as routes are implemented. Every response should include a request ID in production.

Required route groups:

- `GET /health` and `GET /ready`
- `/v1/auth/*`
- `/v1/collections/*`
- `/v1/storage/*`
- `/v1/metadata/*`
- `/v1/deployments/*`
- `/v1/mints/*`
- `/v1/dashboard/*`
- `/v1/referrals/*`
- `/v1/admin/*`
- internal indexer/webhook endpoints protected by service authentication

Mutation routes must support idempotency keys before production. Errors use stable codes such as `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `CHAIN_UNAVAILABLE`, `SIMULATION_FAILED`, and `STORAGE_FAILED`.

## 8. Data model

The Prisma schema included in this package is the starting model:

- `User`: wallet identity.
- `WalletSession`: nonce/signature session lifecycle.
- `Collection`: offchain configuration and live contract reference.
- `ArtworkAsset`: source media and content-addressed locations.
- `MetadataItem`: per-token metadata and traits.
- `Deployment`: preparation, transaction, and confirmation state.
- `Mint`: pending/confirmed purchase record and indexed split.
- `IndexerEvent`: idempotent raw decoded chain event.
- `Referral`: attribution and commission placeholder.
- `AdminAction`: operational audit trail.

Add migrations for every schema change. Never use destructive `db push` against production. Enable daily backups and point-in-time recovery before mainnet.

## 9. Architecture and integrations

- API: Node.js 20, TypeScript, Fastify, Zod.
- Database: PostgreSQL 16 with Prisma.
- Chain client: Viem with separate public clients for testnet/mainnet.
- Storage: Pinata/IPFS adapter behind a provider interface.
- Queue/worker: Redis + BullMQ or managed queue before production indexing and large uploads.
- Observability: structured logs, Sentry, uptime checks, and provider alerts.
- Marketplace sync: OpenSea is enrichment only and must never decide Nest mint state.

The API and indexer should become separate runtime processes once traffic is public. One repository and shared domain modules are acceptable.

## 10. Security requirements

- No private keys, seed phrases, or signing credentials in the API.
- Secrets live only in the hosting provider's secret manager.
- Restrictive CORS with exact origins; HTTPS only in production.
- Helmet/security headers, body limits, upload limits, and route-specific rate limits.
- Validate every external URL and prevent server-side request forgery.
- Scan uploads and reject executable/polyglot content.
- Use parameterized ORM queries and least-privilege database credentials.
- Redact tokens, signatures, API keys, and RPC URLs from logs.
- Treasury should be a multisig; contract ownership should use two-step transfer.
- Contracts require independent audit before mainnet.
- Document incident response, key rotation, backup restore, and pause procedures.

## 11. Reliability and performance

- API availability target: 99.9% after public launch.
- Typical read endpoint p95: under 400 ms excluding third-party calls.
- Writes return without waiting for blockchain finality.
- Third-party calls use timeouts, bounded retries, and circuit-breaking behavior.
- Health checks distinguish process health from readiness/database/RPC health.
- Upload/index jobs expose progress and can resume safely.
- Database backups: daily minimum; restore drill before mainnet.

## 12. Environments and release process

### Local

Local PostgreSQL, mock/testnet RPC, and disabled external storage are acceptable.

### Testnet staging

Uses Robinhood Chain testnet, dedicated test treasury, test factory, separate IPFS project, staging database, and staging frontend origin. No production secrets are shared.

### Mainnet production

Uses Robinhood Chain mainnet, audited factory, multisig treasury, production database with PITR, production RPC, production storage account, alerts, and explicit mainnet gate.

Deploy database migrations as a controlled release step before rolling out compatible API code. Maintain backward compatibility during rolling deployments. Tag releases and record deployed factory version/address.

## 13. Testing requirements

- Unit tests for validation, fee arithmetic, metadata generation, authorization, and chain configuration.
- API integration tests against an isolated PostgreSQL database.
- Contract integration tests for deploy, mint, limits, timing, pause, withdrawals, royalties, and fee split.
- Indexer tests for duplicates, delayed logs, reorg rollback, and restart recovery.
- End-to-end testnet test: authenticate, upload, deploy, mint with second wallet, confirm dashboard, withdraw.
- Security tests for nonce replay, cross-wallet access, oversized uploads, malicious filenames, rate limits, and admin access.
- Load test public collection reads and mint activity ingestion.

CI must block release on lint, typecheck, tests, migration validation, dependency audit, and container build failure.

## 14. Delivery phases

### Phase 1: foundation

Runnable API, PostgreSQL migrations, health/readiness endpoints, wallet auth, collection CRUD, CI, Docker, and staging deployment.

### Phase 2: storage and deployment

IPFS upload/generation, ABI integration, Viem simulation, transaction preparation/recording, and factory testnet deployment.

### Phase 3: indexing and product integration

Indexer worker, public collection/mint APIs, creator dashboard, frontend integration, retries, and observability.

### Phase 4: mainnet readiness

Contract audit fixes, security review, load tests, backup restore test, multisig setup, runbooks, staging rehearsal, and controlled mainnet launch.

## 15. Acceptance criteria

- A new developer can start PostgreSQL and the API from this folder using the README.
- A wallet can authenticate; invalid, expired, or replayed signatures fail.
- Wallet A cannot edit Wallet B's collection.
- Artwork and generated metadata resolve from IPFS without server credentials.
- Deployment preparation returns real factory calldata and succeeds in `simulateContract`.
- Creator signs deployment; indexer discovers and confirms the resulting contract.
- A second wallet mints; indexed supply and activity match chain state.
- Contract accounting demonstrates 95% creator and 5% Nest primary revenue.
- Testnet dashboard values reconcile with contract events.
- Production deployment has HTTPS, restricted CORS, backups, monitoring, and no secrets in the frontend bundle or logs.
- Mainnet cannot be used until the explicit gate, audited addresses, and release checklist are complete.

## 16. Required developer deliverables

- Completed source code and committed Prisma migrations.
- Completed OpenAPI document and frontend integration notes.
- IPFS provider adapter and metadata validation.
- Versioned factory/collection ABI and addresses.
- Independent indexer worker with checkpoint/reorg handling.
- Unit, integration, contract, and E2E test suites.
- CI pipeline and hosted staging URL.
- Production infrastructure configuration, backups, alerts, and runbooks.
- Testnet demonstration with transaction/contract explorer links.
- Mainnet release checklist signed off by product, engineering, and contract auditor.
