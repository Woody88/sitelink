FROM oven/bun:1-slim

WORKDIR /app

# Copy only package files first
COPY package.json bun.lock ./
COPY packages/backend/package.json ./packages/backend/

# Install dependencies
RUN bun install

# Copy source files
COPY packages/backend/src/core/pdf-manager/server.ts ./packages/backend/src/server.ts
COPY packages/backend/src/core/pdf-manager/tile-processor.ts ./packages/backend/src/tile-processor.ts

EXPOSE 3000

ENTRYPOINT ["bun", "packages/backend/src/server.ts"]