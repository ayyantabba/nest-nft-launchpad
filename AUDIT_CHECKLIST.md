# Nest smart-contract audit checklist (TASK 7)

This is a **gate for high-value mainnet use**, not a substitute for a third-party audit.

## Scope

- `outputs/contracts/src/RobinhoodNFTCollection.sol`
- `outputs/contracts/src/RobinhoodNFTFactory.sol`
- Exact bytecode produced by `outputs/contracts/compile.cjs` (pinned solc `0.8.24`, OZ `5.0.2`)

## Required review areas

1. Reentrancy on `mint`, `withdrawCreator`, `withdrawPlatform` / `withdrawTreasury` (guards + CEI).
2. Access control: Ownable2Step, factory pause, fee/treasury setters.
3. Exact payment only on `mint` (reject under/over payment).
4. Integer/fee math for `platformFeeBps` and supply caps.
5. Immutable `creatorPayout` and `platformTreasury` (caller cannot redirect withdrawals).
6. `totalSupply()` / ERC-2981 marketplace compatibility.
7. Factory `createCollection` bytecode embedding and version string.

## Local regression (must pass before audit package)

```bash
cd outputs/contracts
npm ci
npm test
```

## Status

- [ ] Independent auditor engaged
- [ ] Report received for the **exact** mainnet factory bytecode
- [ ] Critical/high findings remediated and re-tested
- [ ] Canary collection mint + both withdrawals reconciled

Until the boxes above are checked, treat mainnet as operationally enabled only after the platform owner accepts residual smart-contract risk.
