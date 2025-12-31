#!/bin/bash

TOKEN="JKiz8US2DGVxKm9wolWeuhjuYbbrEviG"

echo "=== Testing Session Endpoints ==="
echo ""

echo "1. Get current active project:"
curl -s -X GET 'http://localhost:8787/api/session/active-project' \
  -H "Authorization: Bearer $TOKEN" | jq .

echo ""
echo "2. Create a project:"
PROJECT_RESPONSE=$(curl -s -X POST 'http://localhost:8787/api/projects' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Session Test Project","description":"Testing session management"}')

echo "$PROJECT_RESPONSE" | jq .
PROJECT_ID=$(echo "$PROJECT_RESPONSE" | jq -r '.projectId')

if [ -n "$PROJECT_ID" ] && [ "$PROJECT_ID" != "null" ]; then
  echo ""
  echo "3. Set active project to $PROJECT_ID:"
  curl -s -X POST 'http://localhost:8787/api/session/active-project' \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"projectId\":\"$PROJECT_ID\"}" | jq .

  echo ""
  echo "4. Get active project again (should be $PROJECT_ID):"
  curl -s -X GET 'http://localhost:8787/api/session/active-project' \
    -H "Authorization: Bearer $TOKEN" | jq .
else
  echo "Failed to create project"
fi
