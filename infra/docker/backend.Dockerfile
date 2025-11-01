FROM oven/bun:1-slim

WORKDIR /app

# Copy only package files first
COPY package.json bun.lock ./
COPY packages/backend/package.json ./packages/backend/

# Install dependencies
RUN bun install

# Copy source files
COPY packages/backend/src/features/processing/main.ts ./packages/backend/src/main.ts

EXPOSE 3000

ENTRYPOINT ["bun", "packages/backend/src/main.ts"]