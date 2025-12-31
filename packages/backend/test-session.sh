#!/bin/bash

BASE_URL="http://localhost:8787"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Testing Session Management ===${NC}\n"

# Step 1: Register/Login
echo -e "${BLUE}Step 1: Registering test user...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/sign-up/email" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sessiontest@example.com",
    "password": "testpass123",
    "name": "Session Test User"
  }')

echo "Login response: $LOGIN_RESPONSE"

# Extract session token (assuming it's in the response)
SESSION_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.session.token // .token // empty')

if [ -z "$SESSION_TOKEN" ]; then
  echo -e "${RED}Failed to get session token${NC}"
  exit 1
fi

echo -e "${GREEN}Session token: $SESSION_TOKEN${NC}\n"

# Step 2: Create a test project
echo -e "${BLUE}Step 2: Creating test project...${NC}"
PROJECT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/projects" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -d '{
    "name": "Test Project for Session",
    "description": "Testing active project session management"
  }')

echo "Project response: $PROJECT_RESPONSE"

PROJECT_ID=$(echo "$PROJECT_RESPONSE" | jq -r '.projectId // empty')

if [ -z "$PROJECT_ID" ]; then
  echo -e "${RED}Failed to create project${NC}"
  exit 1
fi

echo -e "${GREEN}Project ID: $PROJECT_ID${NC}\n"

# Step 3: Set active project
echo -e "${BLUE}Step 3: Setting active project...${NC}"
SET_ACTIVE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/session/active-project" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -d "{
    \"projectId\": \"$PROJECT_ID\"
  }")

echo "Set active project response: $SET_ACTIVE_RESPONSE"
echo ""

# Step 4: Get active project
echo -e "${BLUE}Step 4: Getting active project...${NC}"
GET_ACTIVE_RESPONSE=$(curl -s -X GET "$BASE_URL/api/session/active-project" \
  -H "Authorization: Bearer $SESSION_TOKEN")

echo "Get active project response: $GET_ACTIVE_RESPONSE"

ACTIVE_PROJECT_ID=$(echo "$GET_ACTIVE_RESPONSE" | jq -r '.activeProjectId // empty')

if [ "$ACTIVE_PROJECT_ID" = "$PROJECT_ID" ]; then
  echo -e "\n${GREEN}✓ Success! Active project matches the project we set${NC}"
else
  echo -e "\n${RED}✗ Failed! Active project ID doesn't match${NC}"
  echo "Expected: $PROJECT_ID"
  echo "Got: $ACTIVE_PROJECT_ID"
fi

echo -e "\n${BLUE}=== Test Complete ===${NC}"
