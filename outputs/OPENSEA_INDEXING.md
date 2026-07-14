# OpenSea Indexing

OpenSea is treated as an external indexer and marketplace.

Correct flow:

1. Store artwork on IPFS.
2. Store metadata on IPFS.
3. Deploy the ERC-721 contract on Robinhood Chain.
4. Mint tokens onchain.
5. Expose tokenURI and contractURI correctly.
6. Wait for OpenSea to index the contract and NFTs.
7. Link users to collection or asset pages when indexed.

## Adapter Interface

```ts
interface MarketplaceProvider {
  getCollectionUrl(chain: string, contractAddress: string): string
  getAssetUrl(chain: string, contractAddress: string, tokenId: string): string
  checkCollectionIndexed(contractAddress: string): Promise<boolean>
  requestMetadataRefresh(contractAddress: string, tokenId: string): Promise<void>
}
```

OpenSea URL patterns and chain slug must be configured through environment variables. Do not guess silently.

The OpenSea API requires an `x-api-key` header. Keep `OPENSEA_API_KEY` server-side and have the backend call:

- supported chains before enabling Robinhood Chain discovery
- collection/listing/floor/activity endpoints for marketplace views
- NFT-by-contract endpoints for collection detail pages
- metadata refresh endpoints only after a deployed contract exposes valid `tokenURI`

If indexing is delayed, show `OpenSea indexing pending` and never block a successful launch solely because OpenSea has not indexed it.

Do not ship fabricated fallback collections. If OpenSea returns no Robinhood Chain records, render an empty state with attribution and the integration requirement.
