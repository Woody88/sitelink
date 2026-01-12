#!/bin/bash
# Test script to build and verify the container

set -e

echo "Building PDF processing container..."
docker build -t pdf-processor .

echo "Starting container..."
docker run -d -p 3001:3001 --name pdf-processor-test pdf-processor

sleep 5

echo "Testing health endpoint..."
curl -f http://localhost:3001/health

echo "Stopping container..."
docker stop pdf-processor-test
docker rm pdf-processor-test

echo "Build and basic tests passed!"
