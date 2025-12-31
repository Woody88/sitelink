#!/bin/bash

# Login and get cookie
echo "Logging in..."
RESPONSE=$(curl -s -c cookies.txt -X POST 'http://localhost:8787/api/auth/sign-in/email' \
  -H 'Content-Type: application/json' \
  -d '{"email":"sessiontest@example.com","password":"testpass123"}')

echo "Login response:"
echo "$RESPONSE" | jq .

echo ""
echo "Getting active project with cookie..."
curl -s -b cookies.txt -X GET 'http://localhost:8787/api/session/active-project' | jq .

echo ""
echo "Creating project with cookie..."
PROJECT_RESP=$(curl -s -b cookies.txt -X POST 'http://localhost:8787/api/projects' \
  -H 'Content-Type: application/json' \
  -d '{"name":"Cookie Test Project"}')

echo "$PROJECT_RESP" | jq .
PROJECT_ID=$(echo "$PROJECT_RESP" | jq -r '.projectId')

if [ -n "$PROJECT_ID" ] && [ "$PROJECT_ID" != "null" ]; then
  echo ""
  echo "Setting active project to $PROJECT_ID with cookie..."
  curl -s -b cookies.txt -X POST 'http://localhost:8787/api/session/active-project' \
    -H 'Content-Type: application/json' \
    -d "{\"projectId\":\"$PROJECT_ID\"}" | jq .
    
  echo ""
  echo "Getting active project again..."
  curl -s -b cookies.txt -X GET 'http://localhost:8787/api/session/active-project' | jq .
fi

rm -f cookies.txt
