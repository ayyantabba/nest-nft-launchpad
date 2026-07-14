export type RobinhoodNetworkKey = "robinhood-testnet" | "robinhood-mainnet";

export const robinhoodChains = {
  "robinhood-testnet": {
    name: "Robinhood Chain Testnet",
    chainId: 46630,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrl: "https://rpc.testnet.chain.robinhood.com",
    blockExplorer: "https://explorer.testnet.chain.robinhood.com"
  },
  "robinhood-mainnet": {
    name: "Robinhood Chain",
    chainId: 4663,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrl: "https://rpc.mainnet.chain.robinhood.com",
    blockExplorer: "https://robinhoodchain.blockscout.com"
  }
} as const;

export const defaultNetwork: RobinhoodNetworkKey = "robinhood-testnet";
