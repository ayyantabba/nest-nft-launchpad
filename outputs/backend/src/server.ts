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
import { createJsonDirectoryForm } from "./pinata.js";
import {
  assertContiguousTokenIds,
  assertMintLimits,
  clearSessionCookieHeader,
  parseCookies,
  plainDescription,
  plainName,
  plainSymbol,
  SESSION_COOKIE,
  sessionCookieHeader
} from "./validation.js";
import "./types.js";

const app = Fastify({ logger: env.NODE_ENV === "development" ? { transport: { target: "pino-pretty" } } : true });
const allowedOrigins = env.APP_ORIGIN.split(",").map((v) => v.trim()).filter(Boolean);
await app.register(cors, { origin: allowedOrigins, credentials: true });
await app.register(helmet);
await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });
await app.register(jwt, { secret: env.NEST_SESSION_SECRET, sign: { expiresIn: "12h" } });
await app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024, files: 1000 } });

const address = z.string().transform((value, ctx) => {
  try { return getAddress(value); } catch { ctx.addIssue({ code: "custom", message: "Invalid EVM address" }); return z.NEVER; }
});

/** Accept Authorization Bearer (in-memory client) or httpOnly nest_session cookie. */
const auth = async (request: FastifyRequest) => {
  const header = request.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    await request.jwtVerify();
    return;
  }
  const token = parseCookies(request.headers.cookie)[SESSION_COOKIE];
  if (!token) {
    throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
  }
  const payload = app.jwt.verify<{ sub: string; walletAddress: string }>(token);
  request.user = payload;
};

declare module "fastify" {
  interface FastifyInstance { authenticate: typeof auth }
}
app.decorate("authenticate", auth);

app.addHook("onRequest", async (request, reply) => {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return;
  const origin = request.headers.origin;
  if (!origin) return;
  if (!allowedOrigins.includes(origin)) {
    return reply.code(403).send({ error: "ORIGIN_FORBIDDEN" });
  }
});

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
const collectionRevenueAbi = [
  { type: "function", name: "creatorAccrued", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "platformAccrued", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "withdrawCreator", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "withdrawPlatform", stateMutability: "nonpayable", inputs: [], outputs: [] }
] as const;
const collectionRevenueEventsAbi = [
  { type: "event", name: "CreatorWithdrawal", anonymous: false, inputs: [
    { indexed: true, name: "to", type: "address" }, { indexed: false, name: "amount", type: "uint256" }
  ]},
  { type: "event", name: "PlatformWithdrawal", anonymous: false, inputs: [
    { indexed: true, name: "to", type: "address" }, { indexed: false, name: "amount", type: "uint256" }
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
  const errorId = randomBytes(8).toString("hex");
  app.log.error({ errorId, err: error });
  const apiError = error as { statusCode?: number; message?: string; details?: unknown };
  const statusCode = apiError.statusCode && apiError.statusCode >= 400 ? apiError.statusCode : 500;
  const publicOperationalErrors = new Set([
    "FACTORY_NOT_CONFIGURED", "IPFS_NOT_CONFIGURED",
    "MAX_PER_TRANSACTION_EXCEEDS_WALLET", "MAX_PER_WALLET_EXCEEDS_SUPPLY", "MAX_PER_TRANSACTION_EXCEEDS_SUPPLY",
    "METADATA_DUPLICATE_TOKEN_ID", "METADATA_TOKEN_ID_SEQUENCE", "METADATA_SUPPLY_MISMATCH",
    "NAME_HTML_NOT_ALLOWED", "DESCRIPTION_HTML_NOT_ALLOWED", "SYMBOL_HTML_NOT_ALLOWED",
    "ROYALTY_BPS_OUT_OF_RANGE"
  ]);
  if (statusCode >= 500) {
    return reply.code(statusCode).send({ error: "INTERNAL_ERROR", errorId });
  }
  const publicMessage = apiError.message && (publicOperationalErrors.has(apiError.message) || statusCode < 500)
    ? apiError.message
    : "REQUEST_ERROR";
  return reply.code(statusCode).send({
    error: publicMessage,
    errorId,
    ...(apiError.details ? { details: apiError.details } : {})
  });
});

async function probePinata(): Promise<boolean> {
  if (env.IPFS_PROVIDER !== "pinata" || !env.PINATA_JWT) return false;
  try {
    const response = await fetch("https://api.pinata.cloud/data/testAuthentication", {
      headers: { authorization: `Bearer ${env.PINATA_JWT}` },
      signal: AbortSignal.timeout(5000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function probeFactory(chainId: number, addressValue?: string): Promise<boolean> {
  if (!addressValue || !/^0x[a-fA-F0-9]{40}$/.test(addressValue)) return false;
  try {
    const code = await clientForChain(chainId).getBytecode({ address: getAddress(addressValue) });
    return Boolean(code && code !== "0x");
  } catch {
    return false;
  }
}

const healthHandler = async (_request: FastifyRequest, reply: FastifyReply) => {
  let database = false;
  try {
    await db.$queryRawUnsafe("SELECT 1");
    database = true;
  } catch {
    database = false;
  }
  const [testnetChainId, mainnetChainId, pinata, testnetFactoryLive, mainnetFactoryLive] = await Promise.all([
    clientForChain(46630).getChainId().catch(() => null),
    clientForChain(4663).getChainId().catch(() => null),
    probePinata(),
    probeFactory(46630, env.FACTORY_TESTNET_ADDRESS),
    probeFactory(4663, env.FACTORY_MAINNET_ADDRESS)
  ]);
  const rpc = { testnet: testnetChainId === 46630, mainnet: mainnetChainId === 4663 };
  const mainnetEnabled = env.CONFIRM_MAINNET_DEPLOYMENT === "true" && Boolean(env.FACTORY_MAINNET_ADDRESS);
  const healthyCore = database && rpc.testnet;
  const body = {
    status: healthyCore && rpc.mainnet ? "ok" : database ? "degraded" : "down",
    service: "nest-api",
    environment: env.NODE_ENV,
    integrations: {
      database,
      pinata,
      rpc,
      testnetFactory: Boolean(env.FACTORY_TESTNET_ADDRESS),
      testnetFactoryLive,
      mainnetEnabled,
      mainnetFactoryLive: mainnetEnabled ? mainnetFactoryLive : false,
      opensea: Boolean(env.OPENSEA_API_KEY && env.OPENSEA_CHAIN_SLUG)
    }
  };
  if (!database) return reply.code(503).send(body);
  return body;
};
app.get("/health", healthHandler);
app.get("/v1/health", healthHandler);

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
  const token = app.jwt.sign({ sub: user.id, walletAddress: user.walletAddress });
  reply.header("Set-Cookie", sessionCookieHeader(token));
  // Token is also returned for in-memory Authorization use; clients must not persist it in localStorage.
  return { token, user, sessionStorage: "httpOnly_cookie_and_memory" };
});

app.get("/v1/auth/me", { preHandler: [app.authenticate] }, async (request) => {
  return { walletAddress: request.user.walletAddress, sub: request.user.sub };
});

app.post("/v1/auth/logout", async (_request, reply) => {
  reply.header("Set-Cookie", clearSessionCookieHeader());
  return { ok: true };
});

const collectionInput = z.object({
  name: plainName, symbol: plainSymbol, description: plainDescription,
  chainId: z.union([z.literal(46630), z.literal(4663)]), chainName: z.enum(["Robinhood Chain Testnet", "Robinhood Chain"]), mintCurrency: z.literal("ETH"),
  mintPriceWei: z.string().regex(/^\d+$/), maxSupply: z.number().int().positive().max(10000),
  maxPerWallet: z.number().int().positive(), maxPerTransaction: z.number().int().positive().default(1),
  // royaltyBps max 1000 = 10% secondary royalty signal (ERC-2981); primary Nest fee is separate (5% onchain).
  royaltyBps: z.number().int().min(0).max(1000),
  creatorPayoutWallet: address, websiteUrl: z.string().url().optional(), socialUrl: z.string().url().optional(),
  mintStartAt: z.coerce.date().optional(), mintEndAt: z.coerce.date().optional(), referralCode: z.string().max(64).optional()
});

app.post("/v1/collections", { preHandler: [app.authenticate] }, async (request, reply) => {
  const input = collectionInput.parse(request.body);
  assertMintLimits({
    maxSupply: input.maxSupply,
    maxPerWallet: input.maxPerWallet,
    maxPerTransaction: input.maxPerTransaction,
    royaltyBps: input.royaltyBps
  });
  const expectedName = input.chainId === 4663 ? "Robinhood Chain" : "Robinhood Chain Testnet";
  if (input.chainName !== expectedName) return reply.code(400).send({ error: "CHAIN_CONFIGURATION_MISMATCH" });
  if (input.chainId === 4663 && env.CONFIRM_MAINNET_DEPLOYMENT !== "true") return reply.code(403).send({ error: "MAINNET_DISABLED" });
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
  assertMintLimits({
    maxSupply: input.maxSupply ?? existing.maxSupply,
    maxPerWallet: input.maxPerWallet ?? existing.maxPerWallet,
    maxPerTransaction: input.maxPerTransaction ?? existing.maxPerTransaction,
    royaltyBps: input.royaltyBps ?? existing.royaltyBps
  });
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
  const form = createJsonDirectoryForm(items, name);
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
    tokenId: z.number().int().positive(), name: plainName, description: plainDescription, image: z.string().startsWith("ipfs://"),
    attributes: z.array(z.object({ trait_type: z.string().max(64), value: z.union([z.string().max(256), z.number()]) })).default([])
  })).min(1).max(10000) }).parse(request.body);
  const ownership = await requireOwnedCollection(body.collectionId, request.user.walletAddress);
  if (ownership.error || !ownership.collection) return reply.code(ownership.error === "NOT_FOUND" ? 404 : 403).send({ error: ownership.error });
  assertContiguousTokenIds(body.items.map((item) => item.tokenId), ownership.collection.maxSupply);
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

app.get("/v1/collections/:id/revenue", async (request, reply) => {
  const { id } = z.object({ id: z.string() }).parse(request.params);
  const collection = await db.collection.findUnique({ where: { id } });
  if (!collection?.contractAddress) return reply.code(404).send({ error: "COLLECTION_NOT_LIVE" });
  const client = clientForChain(collection.chainId);
  const contractAddress = getAddress(collection.contractAddress);
  const [creatorAccrued, platformAccrued, totalSupply, withdrawals] = await Promise.all([
    client.readContract({ address: contractAddress, abi: collectionRevenueAbi, functionName: "creatorAccrued" }),
    client.readContract({ address: contractAddress, abi: collectionRevenueAbi, functionName: "platformAccrued" }),
    client.readContract({ address: contractAddress, abi: collectionRevenueAbi, functionName: "totalSupply" }),
    db.revenueWithdrawal.findMany({ where: { collectionId: id, status: "CONFIRMED" } })
  ]);
  const creatorSettled = withdrawals.filter((item) => item.recipient === "CREATOR").reduce((sum, item) => sum + BigInt(item.amountWei), 0n);
  const platformSettled = withdrawals.filter((item) => item.recipient === "PLATFORM").reduce((sum, item) => sum + BigInt(item.amountWei), 0n);
  return {
    settlementModel: "PULL_PAYMENT",
    accounting: {
      note: "Accrued balances live in the collection contract until withdraw. nestFeeAmountWei on mints is allocation, not settled cash.",
      creator: { accruedWei: creatorAccrued.toString(), settledWei: creatorSettled.toString(), withdrawableWei: creatorAccrued.toString() },
      platform: { accruedWei: platformAccrued.toString(), settledWei: platformSettled.toString(), withdrawableWei: platformAccrued.toString() }
    },
    creatorAccruedWei: creatorAccrued.toString(),
    platformAccruedWei: platformAccrued.toString(),
    creatorSettledWei: creatorSettled.toString(),
    platformSettledWei: platformSettled.toString(),
    totalSupply: totalSupply.toString(),
    creatorPayoutWallet: collection.creatorPayoutWallet,
    platformTreasuryWallet: env.PLATFORM_TREASURY_ADDRESS,
    withdrawalFunctions: { creator: "withdrawCreator", platform: "withdrawPlatform" }
  };
});

app.post("/v1/collections/:id/revenue/prepare", { preHandler: [app.authenticate] }, async (request, reply) => {
  const { id } = z.object({ id: z.string() }).parse(request.params);
  const { recipient } = z.object({ recipient: z.enum(["creator", "platform"]) }).parse(request.body);
  const collection = await db.collection.findUnique({ where: { id } });
  if (!collection?.contractAddress) return reply.code(404).send({ error: "COLLECTION_NOT_LIVE" });
  const wallet = request.user.walletAddress.toLowerCase();
  const isCreator = collection.creatorWallet.toLowerCase() === wallet;
  const isAdmin = env.ADMIN_WALLETS.split(",").some((entry) => entry.trim().toLowerCase() === wallet);
  if ((recipient === "creator" && !isCreator) || (recipient === "platform" && !isAdmin)) return reply.code(403).send({ error: "FORBIDDEN" });
  const functionName = recipient === "creator" ? "withdrawCreator" : "withdrawPlatform";
  const accruedFunction = recipient === "creator" ? "creatorAccrued" : "platformAccrued";
  const amount = await clientForChain(collection.chainId).readContract({ address: getAddress(collection.contractAddress), abi: collectionRevenueAbi, functionName: accruedFunction });
  if (amount === 0n) return reply.code(409).send({ error: "NOTHING_TO_WITHDRAW" });
  return {
    settlementModel: "PULL_PAYMENT",
    recipient,
    amountWei: amount.toString(),
    transactionRequest: {
      chainId: collection.chainId,
      from: request.user.walletAddress,
      to: getAddress(collection.contractAddress),
      data: encodeFunctionData({ abi: collectionRevenueAbi, functionName }),
      value: "0"
    }
  };
});

app.post("/v1/collections/:id/revenue/record", { preHandler: [app.authenticate] }, async (request, reply) => {
  const { id } = z.object({ id: z.string() }).parse(request.params);
  const body = z.object({ recipient: z.enum(["creator", "platform"]), amountWei: z.string().regex(/^\d+$/), txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/) }).parse(request.body);
  const collection = await db.collection.findUnique({ where: { id } });
  if (!collection?.contractAddress) return reply.code(404).send({ error: "COLLECTION_NOT_LIVE" });
  const wallet = request.user.walletAddress.toLowerCase();
  const isCreator = collection.creatorWallet.toLowerCase() === wallet;
  const isAdmin = env.ADMIN_WALLETS.split(",").some((entry) => entry.trim().toLowerCase() === wallet);
  if ((body.recipient === "creator" && !isCreator) || (body.recipient === "platform" && !isAdmin)) return reply.code(403).send({ error: "FORBIDDEN" });
  const recipient = body.recipient === "creator" ? "CREATOR" : "PLATFORM";
  const withdrawal = await db.revenueWithdrawal.create({ data: { collectionId: id, requesterWallet: request.user.walletAddress, recipient, amountWei: body.amountWei, txHash: body.txHash, status: "PENDING" } });
  return reply.code(201).send(withdrawal);
});

app.post("/v1/revenue/confirm", { preHandler: [app.authenticate] }, async (request, reply) => {
  const { withdrawalId } = z.object({ withdrawalId: z.string() }).parse(request.body);
  const withdrawal = await db.revenueWithdrawal.findUnique({ where: { id: withdrawalId }, include: { collection: true } });
  if (!withdrawal) return reply.code(404).send({ error: "WITHDRAWAL_NOT_FOUND" });
  if (withdrawal.requesterWallet.toLowerCase() !== request.user.walletAddress.toLowerCase()) return reply.code(403).send({ error: "FORBIDDEN" });
  if (withdrawal.status === "CONFIRMED") return { withdrawal: { ...withdrawal, blockNumber: withdrawal.blockNumber?.toString() ?? null } };
  if (!withdrawal.collection.contractAddress) return reply.code(409).send({ error: "COLLECTION_NOT_LIVE" });
  const receipt = await clientForChain(withdrawal.collection.chainId).getTransactionReceipt({ hash: withdrawal.txHash as `0x${string}` });
  if (receipt.status !== "success") {
    await db.revenueWithdrawal.update({ where: { id: withdrawal.id }, data: { status: "FAILED" } });
    return reply.code(409).send({ error: "WITHDRAWAL_REVERTED" });
  }
  const contractAddress = withdrawal.collection.contractAddress.toLowerCase();
  if (receipt.to?.toLowerCase() !== contractAddress || receipt.from.toLowerCase() !== withdrawal.requesterWallet.toLowerCase()) return reply.code(409).send({ error: "WITHDRAWAL_TRANSACTION_MISMATCH" });
  const expectedEvent = withdrawal.recipient === "CREATOR" ? "CreatorWithdrawal" : "PlatformWithdrawal";
  const expectedRecipient = withdrawal.recipient === "CREATOR" ? withdrawal.collection.creatorPayoutWallet : env.PLATFORM_TREASURY_ADDRESS;
  let matched = false;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== contractAddress) continue;
    try {
      const decoded = decodeEventLog({ abi: collectionRevenueEventsAbi, data: log.data, topics: log.topics });
      if (decoded.eventName !== expectedEvent) continue;
      const args = decoded.args as unknown as { to: string; amount: bigint };
      matched = args.to.toLowerCase() === expectedRecipient.toLowerCase() && args.amount.toString() === withdrawal.amountWei;
      if (matched) break;
    } catch {}
  }
  if (!matched) return reply.code(409).send({ error: "WITHDRAWAL_EVENT_MISMATCH" });
  const confirmed = await db.revenueWithdrawal.update({ where: { id: withdrawal.id }, data: { status: "CONFIRMED", blockNumber: receipt.blockNumber, confirmedAt: new Date() } });
  return { withdrawal: { ...confirmed, blockNumber: confirmed.blockNumber?.toString() ?? null } };
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
  const allocatedCreatorWei = collections.flatMap((c) => c.mints).reduce((n, m) => n + BigInt(m.creatorAmountWei), 0n);
  const allocatedPlatformWei = collections.flatMap((c) => c.mints).reduce((n, m) => n + BigInt(m.nestFeeAmountWei), 0n);
  return {
    collections: safeCollections,
    totals: {
      collections: collections.length,
      minted: collections.reduce((n, c) => n + c.mintedSupply, 0),
      creatorAllocatedFromConfirmedMintsWei: allocatedCreatorWei.toString(),
      platformAllocatedFromConfirmedMintsWei: allocatedPlatformWei.toString(),
      // Legacy key kept but labeled as allocated (not settled cash).
      creatorAccruedFromConfirmedMintsWei: allocatedCreatorWei.toString(),
      settlementModel: "PULL_PAYMENT",
      accountingNote: "Mint fee fields are ACCRUED allocations only. Settled cash requires confirmed withdrawCreator / withdrawPlatform transactions. Never treat nestFeeAmountWei as treasury cash received."
    }
  };
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
