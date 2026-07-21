# Nest Mainnet Release Runbook

## Current gate

The frontend and Railway confirmation flag were switched to mainnet mode at the user's direction on 2026-07-21. No verified `v1.1.0` mainnet factory address exists yet, so collection deployment remains intentionally blocked by `FACTORY_NOT_CONFIGURED`. Do not bypass that guard with a zero, testnet, or unverified address.

## Verified network values

- Network: Robinhood Chain
- Chain ID: `4663`
- Native currency: `ETH`
- Production RPC: use an Alchemy, QuickNode, or equivalent authenticated Robinhood Chain endpoint
- Public fallback RPC: `https://rpc.mainnet.chain.robinhood.com`
- Explorer: `https://robinhoodchain.blockscout.com`
- Explorer API: `https://robinhoodchain.blockscout.com/api/`
- Nest treasury: `0xaB81d488395EdebC6632c7546d223439bD8FBdD1`
- Platform fee: `500` basis points (5%)

## Contract settlement model

Mint payments use pull-payment accounting. Each collection permanently reserves 95% in `creatorAccrued` and 5% in `platformAccrued`. `withdrawCreator()` pays only the fixed creator payout wallet. `withdrawPlatform()` and its compatibility alias `withdrawTreasury()` pay only the fixed Nest treasury. Anyone may trigger either payout, but callers cannot alter the destination.

## Release sequence

1. Run `npm ci && npm test` in `outputs/contracts`.
2. Deploy a new `1.1.0-testnet` factory from the platform-owner wallet using `#/admin`.
3. Update Railway `FACTORY_TESTNET_ADDRESS` with the confirmed address and redeploy.
4. Create a test collection where `maxSupply` is greater than `maxPerWallet`.
5. Mint to the wallet cap, verify another mint from that wallet reverts, and mint from a second wallet.
6. Verify `totalSupply()`, `creatorAccrued`, `platformAccrued`, `royaltyInfo`, and exact-payment rejection.
7. Execute `withdrawCreator()` and `withdrawTreasury()` and verify the two fixed recipients receive exactly 95% and 5%.
8. Obtain an independent review of the exact compiled `v1.1.0` artifact.
9. Bridge enough ETH to the platform-owner wallet for one factory deployment. Do not store its key in GitHub, Vercel, Railway, or local project files.
10. Temporarily open `#/admin`, connect the owner wallet on chain `4663`, and deploy the `1.1.0` mainnet factory.
11. Verify constructor parameters and source on Blockscout.
12. Set Railway `FACTORY_MAINNET_ADDRESS` to the verified address and `CONFIRM_MAINNET_DEPLOYMENT=true`.
13. Use a production provider URL for `ROBINHOOD_MAINNET_RPC_URL`; keep the public RPC only as fallback.
14. Change `outputs/runtime-config.js` to `network: "mainnet"` and `confirmMainnetDeployment: true`, then deploy Vercel.
15. Confirm `/v1/health` reports database, Pinata, both RPCs, and mainnet factory healthy.
16. Launch one low-price canary collection, mint from a second wallet, withdraw both shares, and reconcile database records against chain events.

## Rollback

Frontend rollback is immediate: set runtime configuration back to testnet. Backend mainnet deployment preparation can be disabled by setting `CONFIRM_MAINNET_DEPLOYMENT=false`. Existing contracts remain immutable and cannot be rolled back; pause the factory if an issue is discovered.

## Mainnet acceptance criteria

- Independent contract review completed for the deployed bytecode.
- Factory owner and treasury are intentional production wallets.
- Factory source verified on Blockscout.
- 95/5 canary withdrawal reconciles exactly.
- Creator and buyer wallet journeys pass in the hosted UI.
- Railway health is green and CORS contains only production origins.
- Pinata credentials, database credentials, WalletConnect project ID, and RPC provider keys are configured in hosting dashboards, never committed.
