import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { randomBytes } from "node:crypto";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { createPublicClient, decodeEventLog, encodeFunctionData, getAddress, http, verifyMessage } from "viem";
import { z, ZodError } from "zod";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "./config.js";
import { db } from "./db.js";
import "./types.js";

const app = Fastify({ logger: env.NODE_ENV === "development" ? { transport: { target: "pino-pretty" } } : true });
await app.register(cors, { origin: env.APP_ORIGIN.split(",").map((v) => v.trim()), credentials: true });
await app.register(helmet);
await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });
await app.register(jwt, { secret: env.NEST_SESSION_SECRET, sign: { expiresIn: "7d" } });
await app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024, files: 1000 } });

const address = z.string().transform((value, ctx) => {
  try { return getAddress(value); } catch { ctx.addIssue({ code: "custom", message: "Invalid EVM address" }); return z.NEVER; }
});
const auth = async (request: FastifyRequest) => request.jwtVerify();

declare module "fastify" {
  interface FastifyInstance { authenticate: typeof auth }
}
app.decorate("authenticate", auth);

const factoryCreateAbi = [{
  type: "function", name: "createCollection", stateMutability: "nonpayable",
  inputs: [{ name: "cfg", type: "tuple", components: [
    { name: "name", type: "string" }, { name: "symbol", type: "string" },
    { name: "maxSupply", type: "uint256" }, { name: "mintPrice", type: "uint256" },
    { name: "maxMintPerWallet", type: "uint256" }, { name: "maxMintPerTransaction", type: "uint256" },
    { name: "mintStart", type: "uint64" }, { name: "mintEnd", type: "uint64" },
    { name: "baseURI", type: "string" }, { name: "contractURI", type: "string" },
    { name: "creatorPayout", type: "address" }, { name: "royaltyRecipient", type: "address" },
    { name: "royaltyBps", type: "uint96" }, { name: "publicMintEnabled", type: "bool" }
  ]}], outputs: [{ name: "collection", type: "address" }]
}] as const;
const collectionCreatedAbi = [{ type: "event", name: "CollectionCreated", anonymous: false, inputs: [
  { indexed: true, name: "collection", type: "address" }, { indexed: true, name: "creator", type: "address" },
  { indexed: true, name: "owner", type: "address" }, { indexed: false, name: "name", type: "string" },
  { indexed: false, name: "symbol", type: "string" }, { indexed: false, name: "maxSupply", type: "uint256" },
  { indexed: false, name: "mintPrice", type: "uint256" }, { indexed: false, name: "contractVersion", type: "string" }
]}] as const;
const mintEventsAbi = [
  { type: "event", name: "Minted", anonymous: false, inputs: [
    { indexed: true, name: "buyer", type: "address" }, { indexed: false, name: "quantity", type: "uint256" }, { indexed: false, name: "paid", type: "uint256" }
  ]},
  { type: "event", name: "Transfer", anonymous: false, inputs: [
    { indexed: true, name: "from", type: "address" }, { indexed: true, name: "to", type: "address" }, { indexed: true, name: "tokenId", type: "uint256" }
  ]}
] as const;
function rpcForChain(chainId: number) {
  if (chainId === 46630) return env.ROBINHOOD_TESTNET_RPC_URL;
  if (chainId === 4663) return env.ROBINHOOD_MAINNET_RPC_URL;
  throw Object.assign(new Error("UNSUPPORTED_CHAIN"), { statusCode: 400 });
}
function clientForChain(chainId: number) { return createPublicClient({ transport: http(rpcForChain(chainId)) }); }
function factoryForChain(chainId: number) {
  const configured = chainId === 4663 ? env.FACTORY_MAINNET_ADDRESS : env.FACTORY_TESTNET_ADDRESS;
  if (!configured || !/^0x[a-fA-F0-9]{40}$/.test(configured)) throw Object.assign(new Error("FACTORY_NOT_CONFIGURED"), { statusCode: 503 });
  return getAddress(configured);
}
function unixSeconds(value: Date | null) { return value ? BigInt(Math.floor(value.getTime() / 1000)) : 0n; }


app.setErrorHandler((error, _request, reply) => {
  if (error instanceof ZodError) return reply.code(400).send({ error: "VALIDATION_ERROR", details: error.flatten() });
  if ((error as { code?: string }).code === "P2002") return reply.code(409).send({ error: "CONFLICT" });
  app.log.error(error);
  const apiError = error as { statusCode?: number; message?: string };
  const statusCode = apiError.statusCode && apiError.statusCode >= 400 ? apiError.statusCode : 500;
  return reply.code(statusCode).send({ error: statusCode < 500 ? apiError.message : "INTERNAL_ERROR" });
});

app.get("/health", async () => {
  await db.$queryRawUnsafe("SELECT 1");
  return { status: "ok", service: "nest-api", environment: env.NODE_ENV, integrations: { database: true, pinata: env.IPFS_PROVIDER === "pinata" && Boolean(env.PINATA_JWT), testnetFactory: Boolean(env.FACTORY_TESTNET_ADDRESS), mainnetEnabled: env.CONFIRM_MAINNET_DEPLOYMENT === "true" && Boolean(env.FACTORY_MAINNET_ADDRESS), opensea: Boolean(env.OPENSEA_API_KEY && env.OPENSEA_CHAIN_SLUG) } };
});

app.post("/v1/auth/nonce", async (request) => {
  const body = z.object({ walletAddress: address }).parse(request.body);
  const nonce = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await db.walletSession.deleteMany({ where: { walletAddress: body.walletAddress, signature: null } });
  const session = await db.walletSession.create({ data: { walletAddress: body.walletAddress, nonce, expiresAt } });
  const message = `Sign in to Nest\n\nWallet: ${body.walletAddress}\nNonce: ${nonce}\nExpires: ${expiresAt.toISOString()}\nSession: ${session.id}`;
  return { sessionId: session.id, message, expiresAt };
});

app.post("/v1/auth/verify", async (request, reply) => {
  const body = z.object({ sessionId: z.string(), signature: z.string(), message: z.string() }).parse(request.body);
  const pending = await db.walletSession.findUnique({ where: { id: body.sessionId } });
  const expectedMessage = pending ? `Sign in to Nest\n\nWallet: ${pending.walletAddress}\nNonce: ${pending.nonce}\nExpires: ${pending.expiresAt.toISOString()}\nSession: ${pending.id}` : "";
  if (!pending || pending.signature || pending.expiresAt < new Date() || body.message !== expectedMessage) {
    return reply.code(401).send({ error: "INVALID_OR_EXPIRED_NONCE" });
  }
  const valid = await verifyMessage({ address: getAddress(pending.walletAddress), message: body.message, signature: body.signature as `0x${string}` });
  if (!valid) return reply.code(401).send({ error: "INVALID_SIGNATURE" });
  const user = await db.user.upsert({ where: { walletAddress: pending.walletAddress }, update: {}, create: { walletAddress: pending.walletAddress } });
  await db.walletSession.update({ where: { id: pending.id }, data: { signature: body.signature, userId: user.id } });
  return { token: app.jwt.sign({ sub: user.id, walletAddress: user.walletAddress }), user };
});

const collectionInput = z.object({
  name: z.string().min(1).max(100), symbol: z.string().min(1).max(12), description: z.string().max(5000),
  chainId: z.number().int(), chainName: z.string().min(1), mintCurrency: z.string().min(1).max(10),
  mintPriceWei: z.string().regex(/^\d+$/), maxSupply: z.number().int().positive().max(10000),
  maxPerWallet: z.number().int().positive(), maxPerTransaction: z.number().int().positive().default(1), royaltyBps: z.number().int().min(0).max(1000),
  creatorPayoutWallet: address, websiteUrl: z.string().url().optional(), socialUrl: z.string().url().optional(),
  mintStartAt: z.coerce.date().optional(), mintEndAt: z.coerce.date().optional(), referralCode: z.string().max(64).optional()
});

app.post("/v1/collections", { preHandler: [app.authenticate] }, async (request, reply) => {
  const input = collectionInput.parse(request.body);
  const collection = await db.collection.create({ data: { ...input, creatorWallet: request.user.walletAddress } });
  return reply.code(201).send(collection);
});

app.get("/v1/collections", async (request) => {
  const query = z.object({ status: z.enum(["UPCOMING", "LIVE", "ENDED"]).default("LIVE"), creator: z.string().optional(), take: z.coerce.number().min(1).max(100).default(24), cursor: z.string().optional() }).parse(request.query);
  const status = query.status === "UPCOMING"
    ? { in: ["STORAGE_READY", "READY_TO_DEPLOY", "DEPLOYING", "LIVE"] }
    : query.status;
  const rows = await db.collection.findMany({
    where: { status: status as never, creatorWallet: query.creator }, take: query.take + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}), orderBy: { createdAt: "desc" },
    include: {
      assets: { where: { status: "PINNED" }, take: 1, orderBy: { createdAt: "asc" } },
      metadataItems: { take: 1, orderBy: { tokenId: "asc" } },
      deployments: { take: 1, orderBy: { createdAt: "desc" } }
    }
  });
  return { items: rows.slice(0, query.take), nextCursor: rows.length > query.take ? rows[query.take]?.id : null };
});

app.get("/v1/collections/:id", async (request, reply) => {
  const { id } = z.object({ id: z.string() }).parse(request.params);
  const collection = await db.collection.findUnique({ where: { id }, include: { assets: true, metadataItems: { take: 20, orderBy: { tokenId: "asc" } }, deployments: true } });
  return collection ? collection : reply.code(404).send({ error: "NOT_FOUND" });
});

app.patch("/v1/collections/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
  const { id } = z.object({ id: z.string() }).parse(request.params);
  const existing = await db.collection.findUnique({ where: { id } });
  if (!existing) return reply.code(404).send({ error: "NOT_FOUND" });
  if (existing.creatorWallet.toLowerCase() !== request.user.walletAddress.toLowerCase()) return reply.code(403).send({ error: "FORBIDDEN" });
  const input = collectionInput.partial().parse(request.body);
  return db.collection.update({ where: { id }, data: input });
});

async function requireOwnedCollection(collectionId: string, walletAddress: string) {
  const collection = await db.collection.findUnique({ where: { id: collectionId } });
  if (!collection) return { error: "NOT_FOUND" as const, collection: null };
  if (collection.creatorWallet.toLowerCase() !== walletAddress.toLowerCase()) return { error: "FORBIDDEN" as const, collection: null };
  return { error: null, collection };
}

async function pinFile(buffer: Buffer, filename: string, mimeType: string) {
  if (env.IPFS_PROVIDER !== "pinata" || !env.PINATA_JWT) throw new Error("IPFS_NOT_CONFIGURED");
  const form = new FormData();
  const bytes = Uint8Array.from(buffer);
  form.append("file", new Blob([bytes.buffer], { type: mimeType }), filename);
  form.append("pinataMetadata", JSON.stringify({ name: filename }));
  form.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));
  const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST", headers: { authorization: `Bearer ${env.PINATA_JWT}` }, body: form
  });
  const result = await response.json() as { IpfsHash?: string; error?: string };
  if (!response.ok || !result.IpfsHash) throw new Error(result.error || "IPFS_UPLOAD_FAILED");
  return result.IpfsHash;
}

async function pinJson(content: unknown, filename: string) {
  if (env.IPFS_PROVIDER !== "pinata" || !env.PINATA_JWT) throw new Error("IPFS_NOT_CONFIGURED");
  const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: { authorization: `Bearer ${env.PINATA_JWT}`, "content-type": "application/json" },
    body: JSON.stringify({ pinataContent: content, pinataMetadata: { name: filename }, pinataOptions: { cidVersion: 1 } })
  });
  const result = await response.json() as { IpfsHash?: string; error?: string };
  if (!response.ok || !result.IpfsHash) throw new Error(result.error || "IPFS_UPLOAD_FAILED");
  return result.IpfsHash;
}

async function pinJsonDirectory(items: Array<{ filename: string; content: unknown }>, name: string) {
  if (env.IPFS_PROVIDER !== "pinata" || !env.PINATA_JWT) throw new Error("IPFS_NOT_CONFIGURED");
  const form = new FormData();
  for (const item of items) form.append("file", new Blob([JSON.stringify(item.content)], { type: "application/json" }), item.filename);
  form.append("pinataMetadata", JSON.stringify({ name }));
  form.append("pinataOptions", JSON.stringify({ cidVersion: 1, wrapWithDirectory: true }));
  const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", { method: "POST", headers: { authorization: "Bearer " + env.PINATA_JWT }, body: form });
  const result = await response.json() as { IpfsHash?: string; error?: string };
  if (!response.ok || !result.IpfsHash) throw new Error(result.error || "IPFS_METADATA_UPLOAD_FAILED");
  return result.IpfsHash;
}

app.post("/v1/storage/artwork", { preHandler: [app.authenticate] }, async (request, reply) => {
  let collectionId = "";
  const uploads: Array<{ filename: string; mimeType: string; buffer: Buffer }> = [];
  for await (const part of request.parts()) {
    if (part.type === "field" && part.fieldname === "collectionId") collectionId = String(part.value);
    if (part.type === "file") {
      const mimeType = part.filename.toLowerCase().endsWith(".glb") ? "model/gltf-binary" : part.mimetype;
      uploads.push({ filename: part.filename, mimeType, buffer: await part.toBuffer() });
    }
  }
  if (!collectionId || !uploads.length) return reply.code(400).send({ error: "COLLECTION_AND_FILES_REQUIRED" });
  const ownership = await requireOwnedCollection(collectionId, request.user.walletAddress);
  if (ownership.error) return reply.code(ownership.error === "NOT_FOUND" ? 404 : 403).send({ error: ownership.error });
  const allowed = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "video/mp4", "model/gltf-binary"]);
  if (uploads.some((item) => !allowed.has(item.mimeType))) return reply.code(415).send({ error: "UNSUPPORTED_MEDIA_TYPE" });
  const assets = [];
  for (const upload of uploads) {
    const cid = await pinFile(upload.buffer, upload.filename, upload.mimeType);
    assets.push(await db.artworkAsset.create({ data: {
      collectionId, originalFilename: upload.filename, mimeType: upload.mimeType,
      sizeBytes: upload.buffer.length, ipfsUri: `ipfs://${cid}`, status: "PINNED"
    } }));
  }
  await db.collection.update({ where: { id: collectionId }, data: { status: "STORAGE_READY" } });
  return reply.code(201).send({ assets });
});

app.post("/v1/storage/metadata", { preHandler: [app.authenticate] }, async (request, reply) => {
  const body = z.object({ collectionId: z.string(), externalUrl: z.string().url().optional(), items: z.array(z.object({
    tokenId: z.number().int().positive(), name: z.string().min(1), description: z.string(), image: z.string().startsWith("ipfs://"),
    attributes: z.array(z.object({ trait_type: z.string(), value: z.union([z.string(), z.number()]) })).default([])
  })).min(1).max(10000) }).parse(request.body);
  const ownership = await requireOwnedCollection(body.collectionId, request.user.walletAddress);
  if (ownership.error || !ownership.collection) return reply.code(ownership.error === "NOT_FOUND" ? 404 : 403).send({ error: ownership.error });
  if (body.items.length !== ownership.collection.maxSupply) return reply.code(400).send({ error: "METADATA_SUPPLY_MISMATCH" });
  const files = body.items.map((item) => ({ filename: item.tokenId + ".json", content: { name: item.name, description: item.description, image: item.image, external_url: body.externalUrl, attributes: item.attributes } }));
  const metadataCid = await pinJsonDirectory(files, ownership.collection.name + "-metadata");
  const contractCid = await pinJson({ name: ownership.collection.name, description: ownership.collection.description, image: body.items[0]?.image, external_link: body.externalUrl, seller_fee_basis_points: ownership.collection.royaltyBps, fee_recipient: ownership.collection.creatorPayoutWallet }, ownership.collection.symbol + "-contract.json");
  const metadataBaseUri = "ipfs://" + metadataCid + "/";
  const contractUri = "ipfs://" + contractCid;
  await db.$transaction([
    ...body.items.map((item) => db.metadataItem.upsert({
      where: { collectionId_tokenId: { collectionId: body.collectionId, tokenId: item.tokenId } },
      update: { name: item.name, description: item.description, imageUri: item.image, metadataUri: metadataBaseUri + item.tokenId + ".json", traitsJson: item.attributes },
      create: { collectionId: body.collectionId, tokenId: item.tokenId, name: item.name, description: item.description, imageUri: item.image, metadataUri: metadataBaseUri + item.tokenId + ".json", traitsJson: item.attributes }
    })),
    db.collection.update({ where: { id: body.collectionId }, data: { metadataBaseUri, contractUri, status: "READY_TO_DEPLOY" } })
  ]);
  return reply.code(201).send({ metadataBaseUri, contractUri, count: body.items.length });
});

app.post("/v1/deployments/prepare", { preHandler: [app.authenticate] }, async (request, reply) => {
  const { collectionId } = z.object({ collectionId: z.string() }).parse(request.body);
  const collection = await db.collection.findUnique({ where: { id: collectionId } });
  if (!collection) return reply.code(404).send({ error: "NOT_FOUND" });
  if (collection.creatorWallet.toLowerCase() !== request.user.walletAddress.toLowerCase()) return reply.code(403).send({ error: "FORBIDDEN" });
  if (collection.chainId === 4663 && env.CONFIRM_MAINNET_DEPLOYMENT !== "true") return reply.code(403).send({ error: "MAINNET_DISABLED" });
  if (!collection.metadataBaseUri || !collection.contractUri) return reply.code(409).send({ error: "METADATA_NOT_READY" });
  const factoryAddress = factoryForChain(collection.chainId);
  const data = encodeFunctionData({ abi: factoryCreateAbi, functionName: "createCollection", args: [{
    name: collection.name, symbol: collection.symbol, maxSupply: BigInt(collection.maxSupply), mintPrice: BigInt(collection.mintPriceWei),
    maxMintPerWallet: BigInt(collection.maxPerWallet), maxMintPerTransaction: BigInt(collection.maxPerTransaction || collection.maxPerWallet),
    mintStart: unixSeconds(collection.mintStartAt), mintEnd: unixSeconds(collection.mintEndAt), baseURI: collection.metadataBaseUri,
    contractURI: collection.contractUri, creatorPayout: getAddress(collection.creatorPayoutWallet), royaltyRecipient: getAddress(collection.creatorPayoutWallet),
    royaltyBps: BigInt(collection.royaltyBps), publicMintEnabled: true
  }] });
  const client = clientForChain(collection.chainId);
  const gas = await client.estimateGas({ account: getAddress(request.user.walletAddress), to: factoryAddress, data });
  const deployment = await db.deployment.create({ data: { collectionId, chainId: collection.chainId, deployerWallet: request.user.walletAddress, status: "WAITING_FOR_WALLET", gasEstimateWei: gas.toString() } });
  return { deployment, transactionRequest: { chainId: collection.chainId, from: request.user.walletAddress, to: factoryAddress, data, value: "0", gas: gas.toString() }, summary: { name: collection.name, supply: collection.maxSupply, mintPriceWei: collection.mintPriceWei, creatorPayout: collection.creatorPayoutWallet, nestFeeBps: collection.nestFeeBps } };
});

app.post("/v1/deployments/record", { preHandler: [app.authenticate] }, async (request, reply) => {
  const body = z.object({ deploymentId: z.string(), txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/) }).parse(request.body);
  const deployment = await db.deployment.findUnique({ where: { id: body.deploymentId }, include: { collection: true } });
  if (!deployment) return reply.code(404).send({ error: "NOT_FOUND" });
  if (deployment.deployerWallet.toLowerCase() !== request.user.walletAddress.toLowerCase()) return reply.code(403).send({ error: "FORBIDDEN" });
  await db.collection.update({ where: { id: deployment.collectionId }, data: { status: "DEPLOYING", txHash: body.txHash } });
  return db.deployment.update({ where: { id: deployment.id }, data: { txHash: body.txHash, status: "PENDING" } });
});

app.post("/v1/deployments/confirm", { preHandler: [app.authenticate] }, async (request, reply) => {
  const { deploymentId } = z.object({ deploymentId: z.string() }).parse(request.body);
  const deployment = await db.deployment.findUnique({ where: { id: deploymentId }, include: { collection: true } });
  if (!deployment || !deployment.txHash) return reply.code(404).send({ error: "DEPLOYMENT_NOT_FOUND" });
  if (deployment.deployerWallet.toLowerCase() !== request.user.walletAddress.toLowerCase()) return reply.code(403).send({ error: "FORBIDDEN" });
  if (deployment.status === "CONFIRMED" && deployment.contractAddress) return { deployment, collection: deployment.collection };
  const receipt = await clientForChain(deployment.chainId).getTransactionReceipt({ hash: deployment.txHash as `0x${string}` });
  if (receipt.status !== "success") { await db.deployment.update({ where: { id: deployment.id }, data: { status: "FAILED", errorMessage: "Transaction reverted" } }); return reply.code(409).send({ error: "DEPLOYMENT_REVERTED" }); }
  const factoryAddress = factoryForChain(deployment.chainId);
  if (receipt.to?.toLowerCase() !== factoryAddress.toLowerCase()) return reply.code(409).send({ error: "WRONG_FACTORY_TRANSACTION" });
  let created: { collection: string; creator: string; owner: string } | null = null;
  for (const log of receipt.logs) { if (log.address.toLowerCase() !== factoryAddress.toLowerCase()) continue; try { const decoded = decodeEventLog({ abi: collectionCreatedAbi, data: log.data, topics: log.topics }); if (decoded.eventName === "CollectionCreated") { created = decoded.args as unknown as { collection: string; creator: string; owner: string }; break; } } catch {} }
  if (!created) return reply.code(409).send({ error: "COLLECTION_CREATED_EVENT_MISSING" });
  if (created.owner.toLowerCase() !== request.user.walletAddress.toLowerCase()) return reply.code(409).send({ error: "DEPLOYER_MISMATCH" });
  if (created.creator.toLowerCase() !== deployment.collection.creatorPayoutWallet.toLowerCase()) return reply.code(409).send({ error: "PAYOUT_MISMATCH" });
  const results = await db.$transaction([
    db.deployment.update({ where: { id: deployment.id }, data: { status: "CONFIRMED", contractAddress: getAddress(created.collection), errorMessage: null } }),
    db.collection.update({ where: { id: deployment.collectionId }, data: { status: "LIVE", contractAddress: getAddress(created.collection), txHash: deployment.txHash } }),
    db.indexerEvent.create({ data: { chainId: deployment.chainId, contractAddress: getAddress(created.collection), eventName: "CollectionCreated", txHash: deployment.txHash, blockNumber: receipt.blockNumber, payloadJson: { creator: created.creator, owner: created.owner } } })
  ]);
  return { deployment: results[0], collection: results[1], receipt: { transactionHash: receipt.transactionHash, blockNumber: receipt.blockNumber.toString() } };
});

app.post("/v1/mints/record", { preHandler: [app.authenticate] }, async (request, reply) => {
  const body = z.object({ collectionId: z.string(), quantity: z.number().int().positive(), txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/), totalPaidWei: z.string().regex(/^\d+$/) }).parse(request.body);
  const collection = await db.collection.findUnique({ where: { id: body.collectionId } });
  if (!collection || collection.status !== "LIVE" || !collection.contractAddress) return reply.code(409).send({ error: "COLLECTION_NOT_LIVE" });
  if (body.quantity > collection.maxPerWallet || body.quantity > (collection.maxPerTransaction || collection.maxPerWallet)) return reply.code(400).send({ error: "MINT_LIMIT_EXCEEDED" });
  const expected = BigInt(collection.mintPriceWei) * BigInt(body.quantity);
  if (BigInt(body.totalPaidWei) !== expected) return reply.code(400).send({ error: "INCORRECT_MINT_VALUE" });
  const fee = expected * BigInt(collection.nestFeeBps) / 10000n;
  const mint = await db.mint.create({ data: { ...body, minterWallet: request.user.walletAddress, totalPaidWei: expected.toString(), creatorAmountWei: (expected - fee).toString(), nestFeeAmountWei: fee.toString(), status: "PENDING" } });
  return reply.code(201).send(mint);
});

app.post("/v1/mints/confirm", { preHandler: [app.authenticate] }, async (request, reply) => {
  const { mintId } = z.object({ mintId: z.string() }).parse(request.body);
  const mint = await db.mint.findUnique({ where: { id: mintId }, include: { collection: true } });
  if (!mint) return reply.code(404).send({ error: "MINT_NOT_FOUND" });
  if (mint.minterWallet.toLowerCase() !== request.user.walletAddress.toLowerCase()) return reply.code(403).send({ error: "FORBIDDEN" });
  if (mint.status === "CONFIRMED") return { mint: { ...mint, blockNumber: mint.blockNumber?.toString() } };
  if (!mint.collection.contractAddress) return reply.code(409).send({ error: "CONTRACT_NOT_READY" });
  const receipt = await clientForChain(mint.collection.chainId).getTransactionReceipt({ hash: mint.txHash as `0x${string}` });
  if (receipt.status !== "success") { await db.mint.update({ where: { id: mint.id }, data: { status: "FAILED" } }); return reply.code(409).send({ error: "MINT_REVERTED" }); }
  if (receipt.to?.toLowerCase() !== mint.collection.contractAddress.toLowerCase()) return reply.code(409).send({ error: "WRONG_COLLECTION_TRANSACTION" });
  if (receipt.from.toLowerCase() !== mint.minterWallet.toLowerCase()) return reply.code(409).send({ error: "MINTER_MISMATCH" });
  let mintedEvent: { buyer: string; quantity: bigint; paid: bigint } | null = null; const tokenIds: number[] = [];
  for (const log of receipt.logs) { if (log.address.toLowerCase() !== mint.collection.contractAddress.toLowerCase()) continue; try { const decoded = decodeEventLog({ abi: mintEventsAbi, data: log.data, topics: log.topics }); if (decoded.eventName === "Minted") mintedEvent = decoded.args as unknown as { buyer: string; quantity: bigint; paid: bigint }; if (decoded.eventName === "Transfer") { const args = decoded.args as unknown as { from: string; to: string; tokenId: bigint }; if (args.from === "0x0000000000000000000000000000000000000000" && args.to.toLowerCase() === mint.minterWallet.toLowerCase()) tokenIds.push(Number(args.tokenId)); } } catch {} }
  if (!mintedEvent || mintedEvent.buyer.toLowerCase() !== mint.minterWallet.toLowerCase()) return reply.code(409).send({ error: "MINT_EVENT_MISSING" });
  if (Number(mintedEvent.quantity) !== mint.quantity || mintedEvent.paid.toString() !== mint.totalPaidWei || tokenIds.length !== mint.quantity) return reply.code(409).send({ error: "MINT_EVENT_MISMATCH" });
  const confirmedAt = new Date();
  const confirmed = await db.$transaction(async (tx) => {
    const current = await tx.mint.findUnique({ where: { id: mint.id } }); if (current?.status === "CONFIRMED") return current;
    for (const tokenId of tokenIds) await tx.tokenOwnership.upsert({ where: { collectionId_tokenId: { collectionId: mint.collectionId, tokenId } }, update: { ownerWallet: mint.minterWallet, mintTxHash: mint.txHash, acquiredAt: confirmedAt }, create: { collectionId: mint.collectionId, tokenId, ownerWallet: mint.minterWallet, mintTxHash: mint.txHash, acquiredAt: confirmedAt } });
    await tx.collection.update({ where: { id: mint.collectionId }, data: { mintedSupply: { increment: mint.quantity } } });
    await tx.indexerEvent.create({ data: { chainId: mint.collection.chainId, contractAddress: mint.collection.contractAddress!, eventName: "Minted", txHash: mint.txHash, blockNumber: receipt.blockNumber, payloadJson: { buyer: mint.minterWallet, quantity: mint.quantity, tokenIds } } });
    return tx.mint.update({ where: { id: mint.id }, data: { status: "CONFIRMED", tokenIds, blockNumber: receipt.blockNumber, confirmedAt } });
  });
  return { mint: { ...confirmed, blockNumber: confirmed.blockNumber?.toString() }, tokenIds };
});

app.get("/v1/wallet/:address/nfts", async (request) => {
  const { address: walletAddress } = z.object({ address }).parse(request.params);
  const items = await db.tokenOwnership.findMany({ where: { ownerWallet: { equals: walletAddress, mode: "insensitive" } }, include: { collection: { include: { metadataItems: true } } }, orderBy: { acquiredAt: "desc" } });
  return { items: items.map((item) => ({ ...item, metadata: item.collection.metadataItems.find((metadata) => metadata.tokenId === item.tokenId) || null })) };
});

app.get("/v1/collections/:id/activity", async (request) => {
  const { id } = z.object({ id: z.string() }).parse(request.params);
  const items = await db.mint.findMany({ where: { collectionId: id, status: "CONFIRMED" }, orderBy: { confirmedAt: "desc" }, take: 100 });
  return { items: items.map((item) => ({ ...item, blockNumber: item.blockNumber?.toString() })) };
});

app.post("/v1/marketplace/opensea/refresh", { preHandler: [app.authenticate] }, async (request, reply) => {
  const body = z.object({ collectionId: z.string(), tokenId: z.number().int().positive() }).parse(request.body);
  const collection = await db.collection.findUnique({ where: { id: body.collectionId } });
  if (!collection?.contractAddress) return reply.code(404).send({ error: "COLLECTION_NOT_FOUND" });
  if (!env.OPENSEA_API_KEY || !env.OPENSEA_CHAIN_SLUG) return reply.code(503).send({ error: "OPENSEA_NOT_CONFIGURED" });
  const endpoint = "https://api.opensea.io/api/v2/chain/" + encodeURIComponent(env.OPENSEA_CHAIN_SLUG) + "/contract/" + collection.contractAddress + "/nfts/" + body.tokenId + "/refresh";
  const response = await fetch(endpoint, { method: "POST", headers: { accept: "application/json", "x-api-key": env.OPENSEA_API_KEY } });
  if (!response.ok) return reply.code(response.status).send({ error: "OPENSEA_REFRESH_FAILED" });
  return { status: "queued", marketplaceUrl: "https://opensea.io/assets/" + env.OPENSEA_CHAIN_SLUG + "/" + collection.contractAddress + "/" + body.tokenId };
});

app.get("/v1/dashboard/creator", { preHandler: [app.authenticate] }, async (request) => {
  const collections = await db.collection.findMany({ where: { creatorWallet: request.user.walletAddress }, include: { mints: { where: { status: "CONFIRMED" } }, deployments: { take: 1, orderBy: { createdAt: "desc" } } } });
  const safeCollections = collections.map((collection) => ({ ...collection, mints: collection.mints.map((mint) => ({ ...mint, blockNumber: mint.blockNumber?.toString() ?? null })) }));
  return { collections: safeCollections, totals: { collections: collections.length, minted: collections.reduce((n, c) => n + c.mintedSupply, 0), revenueWei: collections.flatMap((c) => c.mints).reduce((n, m) => n + BigInt(m.creatorAmountWei), 0n).toString() } };
});

const publicRoot = join(process.cwd(), "public");
const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".glb": "model/gltf-binary"
};

function sendFrontendFile(reply: FastifyReply, requestedPath: string) {
  const cleanPath = normalize(requestedPath).replace(/^(\.\.(\\|\/|$))+/, "");
  const filePath = join(publicRoot, cleanPath);
  if (!filePath.startsWith(publicRoot) || !existsSync(filePath) || !statSync(filePath).isFile()) return false;
  const extension = extname(filePath).toLowerCase();
  return reply
    .header("cache-control", extension === ".html" ? "no-cache" : "public, max-age=86400")
    .type(contentTypes[extension] || "application/octet-stream")
    .send(createReadStream(filePath));
}

app.get("/", async (_request, reply) => {
  return sendFrontendFile(reply, "index.html") || reply.code(404).send({ error: "FRONTEND_NOT_BUILT" });
});

app.get("/*", async (request, reply) => {
  const requestedPath = decodeURIComponent(request.url.split("?", 1)[0] || "").replace(/^\/+/, "");
  const staticFile = sendFrontendFile(reply, requestedPath);
  if (staticFile) return staticFile;
  if (requestedPath.startsWith("v1/") || requestedPath === "health") return reply.code(404).send({ error: "NOT_FOUND" });
  return sendFrontendFile(reply, "index.html") || reply.code(404).send({ error: "FRONTEND_NOT_BUILT" });
});

const shutdown = async () => { await app.close(); await db.$disconnect(); process.exit(0); };
process.on("SIGINT", shutdown); process.on("SIGTERM", shutdown);
await app.listen({ port: env.PORT, host: env.HOST });
