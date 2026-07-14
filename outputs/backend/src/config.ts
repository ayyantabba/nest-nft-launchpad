import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8787),
  HOST: z.string().default("0.0.0.0"),
  APP_ORIGIN: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  NEST_SESSION_SECRET: z.string().min(32),
  ROBINHOOD_TESTNET_RPC_URL: z.string().url(),
  ROBINHOOD_MAINNET_RPC_URL: z.string().url(),
  PLATFORM_TREASURY_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  FACTORY_TESTNET_ADDRESS: z.string().optional(),
  FACTORY_MAINNET_ADDRESS: z.string().optional(),
  CONFIRM_MAINNET_DEPLOYMENT: z.enum(["true", "false"]).default("false"),
  IPFS_PROVIDER: z.enum(["pinata", "disabled"]).default("disabled"),
  PINATA_JWT: z.string().optional(),
  IPFS_GATEWAY: z.string().url().default("https://ipfs.io/ipfs/"),
  OPENSEA_API_KEY: z.string().optional(),
  OPENSEA_CHAIN_SLUG: z.string().optional(),
  ADMIN_WALLETS: z.string().default("")
});

export const env = envSchema.parse(process.env);
export const adminWallets = new Set(
  env.ADMIN_WALLETS.split(",").map((address) => address.trim().toLowerCase()).filter(Boolean)
);
