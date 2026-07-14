import { defaultNetwork, robinhoodChains, type RobinhoodNetworkKey } from "./chains";

export function getActiveNetworkKey(): RobinhoodNetworkKey {
  const value = process.env.NEXT_PUBLIC_NETWORK as RobinhoodNetworkKey | undefined;
  if (!value) return defaultNetwork;
  if (!(value in robinhoodChains)) {
    throw new Error(`Unsupported NEXT_PUBLIC_NETWORK: ${value}`);
  }
  return value;
}

export const activeNetwork = robinhoodChains[getActiveNetworkKey()];

export const environmentConfig = {
  ipfsProvider: process.env.IPFS_PROVIDER || "unset",
  ipfsApiKeySet: Boolean(process.env.IPFS_API_KEY),
  requireMainnetProductionFlag: process.env.CONFIRM_MAINNET_DEPLOYMENT === "true",
  treasuryAddress: process.env.PLATFORM_TREASURY_ADDRESS || "",
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ""
} as const;
