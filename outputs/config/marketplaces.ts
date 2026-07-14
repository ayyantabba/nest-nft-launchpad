export const marketplaceConfig = {
  opensea: {
    name: "OpenSea",
    collectionUrlPattern: process.env.NEXT_PUBLIC_OPENSEA_COLLECTION_URL_PATTERN || "",
    assetUrlPattern: process.env.NEXT_PUBLIC_OPENSEA_ASSET_URL_PATTERN || "",
    apiChainSlug: process.env.NEXT_PUBLIC_OPENSEA_CHAIN_SLUG || "",
    apiKeyEnv: "OPENSEA_API_KEY"
  }
} as const;
