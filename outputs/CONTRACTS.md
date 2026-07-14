# Contracts

## Contracts

- `RobinhoodNFTFactory.sol`
- `RobinhoodNFTCollection.sol`

## Factory Responsibilities

- create collection contracts
- validate deployment parameters
- store platform treasury
- store platform fee basis points
- register deployed collections
- emit deployment events
- pause new deployments in emergency
- restrict treasury and fee changes to owner
- use two-step ownership transfer
- enforce maximum platform fee in code

## Collection Responsibilities

- ERC-721 compatibility
- ERC-721 metadata
- ERC-2981 royalty signaling
- ERC-165 interface support
- configurable max supply
- public mint
- max mint per wallet
- max mint per transaction
- mint start and optional end
- pause minting
- creator payout wallet
- platform treasury
- primary mint fee split accounting
- metadata base URI
- contractURI()
- pull withdrawals for creator and platform balances
- reentrancy protection
- safe minting
- custom errors and events

## Revenue Accounting

Primary mint revenue is split by basis points:

- `9500` bps creator share
- `500` bps platform share

The current contract uses accrued balances and explicit withdrawals instead of inline payment splitting during mint.

## Upgradeability Decision

Creator collection contracts are not upgradeable by default. Factory versions can be replaced by deploying a new factory and recording `factoryVersion` in deployment events and the application database.
