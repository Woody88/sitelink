FROM python:3.10-slim

# Install system dependencies for OpenCV and OCR
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    tesseract-ocr \
    tesseract-ocr-eng \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy and install Python dependencies
COPY pyproject.toml ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -e .

# Copy application code
COPY src/ ./src/

# Copy few-shot example images
COPY cropped_example/ /app/cropped_example/

# Set environment variables
ENV OPENROUTER_API_KEY=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

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "src.api:app", "--host", "0.0.0.0", "--port", "8000"]
