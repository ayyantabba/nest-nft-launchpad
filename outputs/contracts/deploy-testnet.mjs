import { readFile } from "node:fs/promises";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  formatEther,
  getAddress,
  http
} from "../backend/node_modules/viem/_esm/index.js";
import { privateKeyToAccount } from "../backend/node_modules/viem/_esm/accounts/index.js";

const TESTNET_CHAIN_ID = 46630;
const broadcast = process.argv.includes("--broadcast");
const privateKey = process.env.TESTNET_DEPLOYER_PRIVATE_KEY;
const rpcUrl = process.env.ROBINHOOD_TESTNET_RPC_URL;
const treasury = process.env.PLATFORM_TREASURY_ADDRESS;

if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) throw new Error("INVALID_TESTNET_DEPLOYER_PRIVATE_KEY");
if (!rpcUrl || !rpcUrl.includes("testnet.chain.robinhood.com")) throw new Error("INVALID_TESTNET_RPC_URL");
if (!treasury || !/^0x[0-9a-fA-F]{40}$/.test(treasury)) throw new Error("INVALID_PLATFORM_TREASURY_ADDRESS");

const chain = defineChain({
  id: TESTNET_CHAIN_ID,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
  blockExplorers: { default: { name: "Robinhood Testnet Explorer", url: "https://explorer.testnet.chain.robinhood.com" } },
  testnet: true
});
const account = privateKeyToAccount(privateKey);
const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });
const rpcChainId = await publicClient.getChainId();
if (rpcChainId !== TESTNET_CHAIN_ID) throw new Error(`WRONG_CHAIN_ID:${rpcChainId}`);

const balance = await publicClient.getBalance({ address: account.address });
const artifact = JSON.parse(await readFile(new URL("./artifacts/RobinhoodNFTFactory.json", import.meta.url), "utf8"));
const check = {
  mode: broadcast ? "broadcast" : "check-only",
  chainId: rpcChainId,
  deployer: account.address,
  balanceEth: formatEther(balance),
  treasury: getAddress(treasury),
  feeBps: 500,
  version: "1.1.0-testnet"
};

if (!broadcast) {
  console.log(JSON.stringify(check));
} else {
  if (balance === 0n) throw new Error("TESTNET_DEPLOYER_NOT_FUNDED");

  const transactionHash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: [account.address, getAddress(treasury), 500, "1.1.0-testnet"]
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash, confirmations: 1 });
  if (receipt.status !== "success" || !receipt.contractAddress) throw new Error("FACTORY_DEPLOYMENT_FAILED");
  const bytecode = await publicClient.getCode({ address: receipt.contractAddress });
  if (!bytecode || bytecode === "0x") throw new Error("FACTORY_BYTECODE_MISSING");

  console.log(JSON.stringify({
    ...check,
    transactionHash,
    contractAddress: receipt.contractAddress,
    blockNumber: receipt.blockNumber.toString(),
    bytecodeVerified: true
  }));
}
