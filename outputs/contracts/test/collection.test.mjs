import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ganache from "ganache";
import {
  createPublicClient,
  createWalletClient,
  custom,
  decodeEventLog,
  defineChain,
  getAddress,
  parseEther
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const provider = ganache.provider({
  chain: { chainId: 46630 },
  logging: { quiet: true },
  wallet: { totalAccounts: 5, defaultBalance: 100 }
});
const chain = defineChain({
  id: 46630,
  name: "Nest Contract Test",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1"] } },
  testnet: true
});
const initialAccounts = provider.getInitialAccounts();
const accounts = Object.values(initialAccounts).map(({ secretKey }) => privateKeyToAccount(secretKey));
const [owner, buyer, treasury] = accounts;
const transport = custom(provider);
const publicClient = createPublicClient({ chain, transport });
const ownerClient = createWalletClient({ account: owner, chain, transport });
const buyerClient = createWalletClient({ account: buyer, chain, transport });

const factoryArtifact = JSON.parse(await readFile(new URL("../artifacts/RobinhoodNFTFactory.json", import.meta.url), "utf8"));
const collectionArtifact = JSON.parse(await readFile(new URL("../artifacts/RobinhoodNFTCollection.json", import.meta.url), "utf8"));

const factoryHash = await ownerClient.deployContract({
  abi: factoryArtifact.abi,
  bytecode: factoryArtifact.bytecode,
  args: [owner.address, treasury.address, 500, "1.1.0-test"]
});
const factoryReceipt = await publicClient.waitForTransactionReceipt({ hash: factoryHash });
assert.equal(factoryReceipt.status, "success");
const factory = factoryReceipt.contractAddress;
assert.ok(factory);

const mintPrice = parseEther("0.1");
const config = {
  name: "Nest Revenue Test",
  symbol: "NESTREV",
  maxSupply: 5n,
  mintPrice,
  maxMintPerWallet: 2n,
  maxMintPerTransaction: 2n,
  mintStart: 0n,
  mintEnd: 0n,
  baseURI: "ipfs://metadata/",
  contractURI: "ipfs://contract",
  creatorPayout: owner.address,
  royaltyRecipient: owner.address,
  royaltyBps: 500n,
  publicMintEnabled: true
};
const createHash = await ownerClient.writeContract({
  address: factory,
  abi: factoryArtifact.abi,
  functionName: "createCollection",
  args: [config]
});
const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createHash });
const createdLog = createReceipt.logs
  .filter((log) => log.address.toLowerCase() === factory.toLowerCase())
  .map((log) => {
    try { return decodeEventLog({ abi: factoryArtifact.abi, data: log.data, topics: log.topics }); }
    catch { return null; }
  })
  .find((log) => log?.eventName === "CollectionCreated");
assert.ok(createdLog);
const collection = getAddress(createdLog.args.collection);

for (const value of [mintPrice - 1n, mintPrice + 1n]) {
  await assert.rejects(() => buyerClient.writeContract({
    address: collection,
    abi: collectionArtifact.abi,
    functionName: "mint",
    args: [1n],
    value
  }));
}

const paid = mintPrice * 2n;
const mintHash = await buyerClient.writeContract({
  address: collection,
  abi: collectionArtifact.abi,
  functionName: "mint",
  args: [2n],
  value: paid
});
await publicClient.waitForTransactionReceipt({ hash: mintHash });

const expectedPlatform = paid * 500n / 10_000n;
const expectedCreator = paid - expectedPlatform;
const [totalSupply, totalMinted, creatorAccrued, platformAccrued, royalty] = await Promise.all([
  publicClient.readContract({ address: collection, abi: collectionArtifact.abi, functionName: "totalSupply" }),
  publicClient.readContract({ address: collection, abi: collectionArtifact.abi, functionName: "totalMinted" }),
  publicClient.readContract({ address: collection, abi: collectionArtifact.abi, functionName: "creatorAccrued" }),
  publicClient.readContract({ address: collection, abi: collectionArtifact.abi, functionName: "platformAccrued" }),
  publicClient.readContract({ address: collection, abi: collectionArtifact.abi, functionName: "royaltyInfo", args: [1n, parseEther("1")] })
]);
assert.equal(totalSupply, 2n);
assert.equal(totalMinted, 2n);
assert.equal(creatorAccrued, expectedCreator);
assert.equal(platformAccrued, expectedPlatform);
assert.equal(royalty[0], owner.address);
assert.equal(royalty[1], parseEther("0.05"));

await assert.rejects(() => buyerClient.writeContract({
  address: collection,
  abi: collectionArtifact.abi,
  functionName: "mint",
  args: [1n],
  value: mintPrice
}));

const creatorBalanceBefore = await publicClient.getBalance({ address: owner.address });
const creatorWithdrawHash = await buyerClient.writeContract({
  address: collection,
  abi: collectionArtifact.abi,
  functionName: "withdrawCreator"
});
await publicClient.waitForTransactionReceipt({ hash: creatorWithdrawHash });
const creatorBalanceAfter = await publicClient.getBalance({ address: owner.address });
assert.equal(creatorBalanceAfter - creatorBalanceBefore, expectedCreator);

const treasuryBalanceBefore = await publicClient.getBalance({ address: treasury.address });
const platformWithdrawHash = await buyerClient.writeContract({
  address: collection,
  abi: collectionArtifact.abi,
  functionName: "withdrawTreasury"
});
await publicClient.waitForTransactionReceipt({ hash: platformWithdrawHash });
const treasuryBalanceAfter = await publicClient.getBalance({ address: treasury.address });
assert.equal(treasuryBalanceAfter - treasuryBalanceBefore, expectedPlatform);

const [creatorAfter, platformAfter, contractBalanceAfter] = await Promise.all([
  publicClient.readContract({ address: collection, abi: collectionArtifact.abi, functionName: "creatorAccrued" }),
  publicClient.readContract({ address: collection, abi: collectionArtifact.abi, functionName: "platformAccrued" }),
  publicClient.getBalance({ address: collection })
]);
assert.equal(creatorAfter, 0n);
assert.equal(platformAfter, 0n);
assert.equal(contractBalanceAfter, 0n);
await assert.rejects(() => buyerClient.writeContract({ address: collection, abi: collectionArtifact.abi, functionName: "withdrawTreasury" }));

// Second independent minter still succeeds after first wallet is at cap.
const secondBuyer = accounts[3];
const secondBuyerClient = createWalletClient({ account: secondBuyer, chain, transport });
const secondMintHash = await secondBuyerClient.writeContract({
  address: collection,
  abi: collectionArtifact.abi,
  functionName: "mint",
  args: [1n],
  value: mintPrice
});
await publicClient.waitForTransactionReceipt({ hash: secondMintHash });
const supplyAfterSecond = await publicClient.readContract({
  address: collection,
  abi: collectionArtifact.abi,
  functionName: "totalSupply"
});
assert.equal(supplyAfterSecond, 3n);

// Withdraw destinations are immutable fixed addresses (caller cannot redirect).
const creatorPayout = await publicClient.readContract({
  address: collection,
  abi: collectionArtifact.abi,
  functionName: "creatorPayout"
});
const platformTreasury = await publicClient.readContract({
  address: collection,
  abi: collectionArtifact.abi,
  functionName: "platformTreasury"
});
assert.equal(getAddress(creatorPayout), getAddress(owner.address));
assert.equal(getAddress(platformTreasury), getAddress(treasury.address));

console.log(JSON.stringify({
  status: "passed",
  checks: [
    "exact payment",
    "wallet cap",
    "second wallet mint",
    "95/5 accrual",
    "creator payout",
    "treasury payout",
    "totalSupply",
    "ERC-2981",
    "zero-withdraw revert",
    "immutable withdraw destinations"
  ],
  factory,
  collection
}));
