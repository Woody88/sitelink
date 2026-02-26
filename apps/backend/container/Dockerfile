# Cloudflare Container for PDF Processing
# Optimized for <2GB image size (Cloudflare Containers limit)

# ---------- builder stage ----------
FROM python:3.11-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libvips-dev \
    libglib2.0-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .

# Install PyTorch CPU-only (no CUDA = ~200MB instead of ~2.5GB)
RUN pip install --no-cache-dir \
    torch torchvision \
    --index-url https://download.pytorch.org/whl/cpu

# Install core dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Install ultralytics and doclayout-yolo without their heavy transitive deps
# (polars, matplotlib, pandas, seaborn, albumentations, scipy are NOT needed for inference)
RUN pip install --no-cache-dir --no-deps ultralytics>=8.3.0 doclayout-yolo>=0.0.1 \
    && pip install --no-cache-dir ultralytics-thop>=2.0.18

# Remove only safe-to-strip packages (pip/setuptools/wheel not needed at runtime)
RUN rm -rf /usr/local/lib/python3.11/site-packages/pip \
    /usr/local/lib/python3.11/site-packages/setuptools \
    /usr/local/lib/python3.11/site-packages/wheel \
    /usr/local/lib/python3.11/site-packages/torch/test

# ---------- runtime stage ----------
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips42 \
    tesseract-ocr \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install pmtiles CLI
RUN curl -L https://github.com/protomaps/go-pmtiles/releases/download/v1.22.3/go-pmtiles_1.22.3_Linux_x86_64.tar.gz \
    | tar -xz -C /usr/local/bin pmtiles \
    && rm -f /usr/local/bin/pmtiles.1

# Copy installed Python packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

WORKDIR /app
COPY . .

EXPOSE 3001

CMD ["python", "server.py"]
