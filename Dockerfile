FROM node:20-alpine AS build
WORKDIR /app
COPY outputs/backend/package*.json ./
COPY outputs/backend/prisma ./prisma
COPY outputs/backend/scripts ./scripts
RUN npm ci
COPY outputs/backend/tsconfig.json ./
COPY outputs/backend/src ./src
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY outputs/backend/package*.json ./
COPY outputs/backend/prisma ./prisma
COPY outputs/backend/scripts ./scripts
COPY --from=build /app/node_modules ./node_modules
RUN npm prune --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY outputs/index.html outputs/app.js outputs/styles.css outputs/runtime-config.js outputs/cyberpunk_card.glb ./public/
COPY outputs/assets ./public/assets
USER node
EXPOSE 8787
CMD ["sh", "-c", "node scripts/migrate-production.mjs && node dist/server.js"]
