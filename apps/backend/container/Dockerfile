# Cloudflare Container for PDF Processing
# Python-based server with VIPS, OpenCV, and Tesseract OCR

FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libvips-dev \
    libvips-tools \
    tesseract-ocr \
    libtesseract-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install pmtiles CLI (Go binary)
RUN curl -L https://github.com/protomaps/go-pmtiles/releases/download/v1.22.3/go-pmtiles_1.22.3_Linux_x86_64.tar.gz \
    | tar -xz -C /usr/local/bin pmtiles

# Install Python dependencies
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

EXPOSE 3001

CMD ["python", "server.py"]
