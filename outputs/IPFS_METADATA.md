# IPFS Metadata

## Storage Provider Adapter

```ts
interface StorageProvider {
  uploadFile(file: File): Promise<{ cid: string }>
  uploadDirectory(files: File[]): Promise<{ cid: string }>
  uploadJSON(json: unknown): Promise<{ cid: string }>
  pinCID(cid: string): Promise<void>
  verifyCID(cid: string): Promise<boolean>
}
```

Provider credentials must remain server-side.

## Token Metadata

```json
{
  "name": "Collection Name #1",
  "description": "Collection description",
  "image": "ipfs://IMAGE_CID/1.png",
  "external_url": "https://example.com",
  "attributes": [
    {
      "trait_type": "Background",
      "value": "Lime"
    }
  ]
}
```

## Contract Metadata

```json
{
  "name": "Collection Name",
  "description": "Collection description",
  "image": "ipfs://COLLECTION_IMAGE_CID",
  "banner_image": "ipfs://BANNER_CID",
  "external_link": "https://collection-site.example",
  "seller_fee_basis_points": 500,
  "fee_recipient": "0xCREATOR_OR_ROYALTY_RECIPIENT"
}
```

Before deployment, verify every artwork CID, metadata CID, token image URI, and collection contract URI.
