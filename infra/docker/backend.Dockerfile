FROM oven/bun:1-slim

WORKDIR /app

# Copy root package files for workspace setup
COPY package.json bun.lock ./

# Copy workspace package.json files (for dependency resolution)
COPY packages/backend/package.json ./packages/backend/
COPY packages/drizzle-effect/package.json ./packages/drizzle-effect/

# Install dependencies (this will install workspace packages too)
RUN bun install

# Copy workspace package source (drizzle-effect is needed at runtime)
COPY packages/drizzle-effect ./packages/drizzle-effect

# Copy backend source files
COPY packages/backend/src/core/pdf-manager/server.ts ./packages/backend/src/server.ts
COPY packages/backend/src/core/pdf-manager/tile-processor.ts ./packages/backend/src/tile-processor.ts

EXPOSE 3000

ENTRYPOINT ["bun", "packages/backend/src/server.ts"]