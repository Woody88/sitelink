# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:1 AS base
WORKDIR /usr/src/app

# Install libvips for PDF → DZI tile generation
RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips-tools \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Create minimal package.json with only the dependencies the server needs
# The server only uses: pdf-lib, tar-stream (no workspace deps needed)
RUN echo '{"name":"sitelink-tile-server","type":"module","dependencies":{"pdf-lib":"^1.17.1","tar-stream":"^3.1.7"}}' > package.json

# Install only the minimal dependencies needed
RUN bun install

# Copy the server source files
COPY src/core/pdf-manager ./src/core/pdf-manager

# run the app
USER bun
WORKDIR /usr/src/app
EXPOSE 3001/tcp
ENTRYPOINT [ "bun", "run", "src/core/pdf-manager/server.ts" ]
