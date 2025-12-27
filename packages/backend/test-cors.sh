#!/bin/bash

echo "Testing CORS headers on backend..."
echo ""
echo "1. Testing OPTIONS (preflight) request:"
echo "========================================"
curl -v -X OPTIONS http://localhost:8787/api/auth/sign-up/email \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  2>&1 | grep -i "access-control"

echo ""
echo "2. Testing POST request with CORS:"
echo "==================================="
curl -v -X POST http://localhost:8787/api/auth/sign-up/email \
  -H "Origin: http://localhost:3000" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123","name":"Test User"}' \
  2>&1 | grep -i "access-control"

echo ""
echo "3. Testing GET request with CORS:"
echo "==================================="
curl -v -X GET http://localhost:8787/api/auth/get-session \
  -H "Origin: http://localhost:3000" \
  2>&1 | grep -i "access-control"

echo ""
echo "Done!"
