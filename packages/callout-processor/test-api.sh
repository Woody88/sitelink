#!/bin/bash
# Simple curl-based test script for the callout-processor REST API
#
# Usage:
#   1. Start the server: bun run dev
#   2. Run this test: ./test-api.sh path/to/sheet.pdf

API_BASE="http://localhost:8000"
PDF_PATH="$1"

if [ -z "$PDF_PATH" ]; then
  echo "Usage: ./test-api.sh <path-to-pdf>"
  exit 1
fi

if [ ! -f "$PDF_PATH" ]; then
  echo "Error: PDF file not found: $PDF_PATH"
  exit 1
fi

echo "Testing Callout Processor API"
echo "=============================="
echo "PDF: $PDF_PATH"
echo ""

# 1. Health Check
echo "1. Testing health check..."
curl -s "$API_BASE/health" | jq .
echo ""

# 2. Extract Metadata
echo "2. Testing metadata extraction..."
curl -s -X POST "$API_BASE/api/extract-metadata" \
  -H "Content-Type: application/pdf" \
  --data-binary "@$PDF_PATH" | jq .
echo ""

# 3. Detect Markers
echo "3. Testing marker detection..."
curl -s -X POST "$API_BASE/api/detect-markers" \
  -H "Content-Type: application/pdf" \
  -H "X-Valid-Sheets: A1,A2,A3,A4,A5,A6,A7" \
  -H "X-Sheet-Number: A2" \
  --data-binary "@$PDF_PATH" | jq .
echo ""

echo "✅ API tests complete"
