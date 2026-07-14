# Robinhood Chain Deployment Architecture

The application should use a single production network path for Robinhood Chain, with environment switching between testnet and mainnet.

## Shared Collection Record

- network key
- chain ID
- contract address
- transaction hash
- explorer link
- mint currency: ETH
- gas estimate
- deployment status
- creator wallet
- platform treasury
- royalty settings
- contract version

## Deployment Router

- load `NEXT_PUBLIC_NETWORK`
- resolve centralized chain configuration
- validate connected wallet chain ID
- simulate the factory transaction with Viem
- send the transaction from the creator wallet
- persist deployment manifest
- wait for confirmations
- wait for indexer
- verify metadata
- mark OpenSea indexing as pending until marketplace data is available

## Contract Path

Robinhood Chain is EVM-compatible. Collections use `RobinhoodNFTCollection`, an ERC-721 contract with ERC-2981 royalty signaling and pull-payment accounting for creator/platform revenue.

Secondary royalties are marketplace-dependent and not guaranteed everywhere.
