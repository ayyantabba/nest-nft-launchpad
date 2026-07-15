FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
COPY scripts ./scripts
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY prisma ./prisma
COPY scripts ./scripts
COPY --from=build /app/node_modules ./node_modules
RUN npm prune --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/dist ./dist
USER node
EXPOSE 8787
CMD ["sh", "-c", "node scripts/migrate-production.mjs && node dist/server.js"]
