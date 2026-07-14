import "@fastify/jwt";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; walletAddress: string };
    user: { sub: string; walletAddress: string };
  }
}
