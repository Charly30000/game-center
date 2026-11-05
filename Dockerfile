FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/package-lock.json ./package-lock.json
COPY . .
RUN node scripts/prepare-assets.mjs
EXPOSE 3000 3001
CMD ["node", "server/index.mjs"]
