# Cloudflare Container for PDF Processing
# Python-based server with VIPS, OpenCV, and Tesseract OCR

FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libvips-dev \
    libvips-tools \
    tesseract-ocr \
    libtesseract-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

EXPOSE 3001

CMD ["python", "server.py"]
