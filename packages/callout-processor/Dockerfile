# Callout Processor Service
# Bun + Python + vips for PDF processing and marker detection

FROM oven/bun:1 AS base
WORKDIR /app

# Install system dependencies
# - libvips for PDF → PNG conversion
# - poppler-utils for PDF utilities
# - Python 3 for OpenCV shape detection
# - OpenCV dependencies (libgl1, libglib2.0, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips-tools \
    poppler-utils \
    python3 \
    python3-pip \
    python3-venv \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create Python virtual environment and install dependencies
RUN python3 -m venv /app/venv
ENV PATH="/app/venv/bin:$PATH"

# Copy and install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy package.json and install Bun dependencies
COPY package.json ./
RUN bun install --production

# Copy source code with correct ownership
COPY --chown=bun:bun src/ ./src/
COPY --chown=bun:bun tsconfig.json ./

# Copy .env file for API keys (Bun auto-loads .env files)
COPY --chown=bun:bun .env ./

# Fix ownership for venv and node_modules
RUN chown -R bun:bun /app

# Environment configuration
ENV NODE_ENV=production
ENV PORT=8000

# Expose the service port
EXPOSE 8000

# Health check - verify the service is responding
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run as non-root user for security
USER bun

# Start the API server
CMD ["bun", "run", "src/api/server.ts"]
