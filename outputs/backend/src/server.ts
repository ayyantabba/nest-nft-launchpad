import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { randomBytes } from "node:crypto";
import { getAddress, verifyMessage } from "viem";
import { z, ZodError } from "zod";
import type { FastifyRequest } from "fastify";
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

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof ZodError) return reply.code(400).send({ error: "VALIDATION_ERROR", details: error.flatten() });
  if ((error as { code?: string }).code === "P2002") return reply.code(409).send({ error: "CONFLICT" });
  app.log.error(error);
  const apiError = error as { statusCode?: number; message?: string };
  const statusCode = apiError.statusCode && apiError.statusCode >= 400 ? apiError.statusCode : 500;
  return reply.code(statusCode).send({ error: statusCode < 500 ? apiError.message : "INTERNAL_ERROR" });
});

app.get("/health", async () => {
  await db.$queryRaw`SELECT 1`;
  return { status: "ok", service: "nest-api", environment: env.NODE_ENV };
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
  mintPriceWei: z.string().regex(/^\d+$/), maxSupply: z.number().int().positive().max(100000),
  maxPerWallet: z.number().int().positive(), royaltyBps: z.number().int().min(0).max(1000),
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

app.post("/v1/storage/artwork", { preHandler: [app.authenticate] }, async (request, reply) => {
  let collectionId = "";
  const uploads: Array<{ filename: string; mimeType: string; buffer: Buffer }> = [];
  for await (const part of request.parts()) {
    if (part.type === "field" && part.fieldname === "collectionId") collectionId = String(part.value);
    if (part.type === "file") uploads.push({ filename: part.filename, mimeType: part.mimetype, buffer: await part.toBuffer() });
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
  const body = z.object({ collectionId: z.string(), items: z.array(z.object({
    tokenId: z.number().int().nonnegative(), name: z.string().min(1), description: z.string(),
    image: z.string().startsWith("ipfs://"), attributes: z.array(z.object({ trait_type: z.string(), value: z.union([z.string(), z.number()]) })).default([])
  })).min(1).max(100000) }).parse(request.body);
  const ownership = await requireOwnedCollection(body.collectionId, request.user.walletAddress);
  if (ownership.error) return reply.code(ownership.error === "NOT_FOUND" ? 404 : 403).send({ error: ownership.error });
  const metadataItems = [];
  for (const item of body.items) {
    const metadata = { name: item.name, description: item.description, image: item.image, attributes: item.attributes };
    const cid = await pinJson(metadata, `${item.tokenId}.json`);
    metadataItems.push(await db.metadataItem.upsert({
      where: { collectionId_tokenId: { collectionId: body.collectionId, tokenId: item.tokenId } },
      update: { name: item.name, description: item.description, imageUri: item.image, metadataUri: `ipfs://${cid}`, traitsJson: item.attributes },
      create: { collectionId: body.collectionId, tokenId: item.tokenId, name: item.name, description: item.description, imageUri: item.image, metadataUri: `ipfs://${cid}`, traitsJson: item.attributes }
    }));
  }
  return reply.code(201).send({ items: metadataItems });
});

app.post("/v1/deployments/prepare", { preHandler: [app.authenticate] }, async (request, reply) => {
  const { collectionId } = z.object({ collectionId: z.string() }).parse(request.body);
  const collection = await db.collection.findUnique({ where: { id: collectionId } });
  if (!collection) return reply.code(404).send({ error: "NOT_FOUND" });
  if (collection.creatorWallet.toLowerCase() !== request.user.walletAddress.toLowerCase()) return reply.code(403).send({ error: "FORBIDDEN" });
  if (collection.chainId === 4663 && env.CONFIRM_MAINNET_DEPLOYMENT !== "true") return reply.code(403).send({ error: "MAINNET_DISABLED" });
  const deployment = await db.deployment.create({ data: { collectionId, chainId: collection.chainId, deployerWallet: request.user.walletAddress, status: "WAITING_FOR_WALLET" } });
  return { deployment, transactionRequest: { chainId: collection.chainId, to: collection.chainId === 4663 ? env.FACTORY_MAINNET_ADDRESS : env.FACTORY_TESTNET_ADDRESS, data: "0x", value: "0" }, warning: "Backend must encode factory calldata before production." };
});

app.post("/v1/deployments/record", { preHandler: [app.authenticate] }, async (request, reply) => {
  const body = z.object({ deploymentId: z.string(), txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/) }).parse(request.body);
  const deployment = await db.deployment.findUnique({ where: { id: body.deploymentId }, include: { collection: true } });
  if (!deployment) return reply.code(404).send({ error: "NOT_FOUND" });
  if (deployment.deployerWallet.toLowerCase() !== request.user.walletAddress.toLowerCase()) return reply.code(403).send({ error: "FORBIDDEN" });
  await db.collection.update({ where: { id: deployment.collectionId }, data: { status: "DEPLOYING", txHash: body.txHash } });
  return db.deployment.update({ where: { id: deployment.id }, data: { txHash: body.txHash, status: "PENDING" } });
});

app.post("/v1/mints/record", { preHandler: [app.authenticate] }, async (request, reply) => {
  const body = z.object({ collectionId: z.string(), quantity: z.number().int().positive(), txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/), totalPaidWei: z.string().regex(/^\d+$/) }).parse(request.body);
  const total = BigInt(body.totalPaidWei); const fee = total * 500n / 10000n;
  const mint = await db.mint.create({ data: { ...body, minterWallet: request.user.walletAddress, creatorAmountWei: (total - fee).toString(), nestFeeAmountWei: fee.toString() } });
  return reply.code(201).send(mint);
});

app.get("/v1/dashboard/creator", { preHandler: [app.authenticate] }, async (request) => {
  const collections = await db.collection.findMany({ where: { creatorWallet: request.user.walletAddress }, include: { mints: { where: { status: "CONFIRMED" } }, deployments: { take: 1, orderBy: { createdAt: "desc" } } } });
  return { collections, totals: { collections: collections.length, minted: collections.reduce((n, c) => n + c.mintedSupply, 0), revenueWei: collections.flatMap((c) => c.mints).reduce((n, m) => n + BigInt(m.creatorAmountWei), 0n).toString() } };
});

const shutdown = async () => { await app.close(); await db.$disconnect(); process.exit(0); };
process.on("SIGINT", shutdown); process.on("SIGTERM", shutdown);
await app.listen({ port: env.PORT, host: env.HOST });

