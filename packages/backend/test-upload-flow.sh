#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

API_BASE="http://localhost:8787"
TEST_PDF="/home/woodson/Code/projects/sitelink/packages/backend/tests/fixtures/sample-single-plan.pdf"

echo -e "${BLUE}=== Sitelink PDF Upload & Tile Generation Test ===${NC}\n"

# Step 1: Sign in to get session cookie
echo -e "${YELLOW}Step 1: Signing in...${NC}"
SIGNIN_RESPONSE=$(curl -s -c /tmp/sitelink-cookies.txt -X POST "$API_BASE/auth/signin" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "password123"
  }')

if echo "$SIGNIN_RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
  echo -e "${RED}Authentication failed: $SIGNIN_RESPONSE${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Signed in successfully${NC}\n"

# Step 2: Get organizations
echo -e "${YELLOW}Step 2: Fetching organizations...${NC}"
ORG_RESPONSE=$(curl -s -b /tmp/sitelink-cookies.txt "$API_BASE/organizations")
ORG_ID=$(echo "$ORG_RESPONSE" | jq -r '.[0].id // empty')

if [ -z "$ORG_ID" ]; then
  echo -e "${RED}No organization found: $ORG_RESPONSE${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Organization ID: $ORG_ID${NC}\n"

# Step 3: Get or create a project
echo -e "${YELLOW}Step 3: Getting projects...${NC}"
PROJECTS_RESPONSE=$(curl -s -b /tmp/sitelink-cookies.txt "$API_BASE/projects?organizationId=$ORG_ID")
PROJECT_ID=$(echo "$PROJECTS_RESPONSE" | jq -r '.[0].id // empty')

if [ -z "$PROJECT_ID" ]; then
  echo -e "${YELLOW}No project found, creating one...${NC}"
  CREATE_PROJECT_RESPONSE=$(curl -s -b /tmp/sitelink-cookies.txt -X POST "$API_BASE/projects" \
    -H "Content-Type: application/json" \
    -d "{
      \"organizationId\": \"$ORG_ID\",
      \"name\": \"Test Project $(date +%s)\",
      \"description\": \"Test project for PDF upload\"
    }")

  PROJECT_ID=$(echo "$CREATE_PROJECT_RESPONSE" | jq -r '.id // empty')

  if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Failed to create project: $CREATE_PROJECT_RESPONSE${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ Created project: $PROJECT_ID${NC}\n"
else
  echo -e "${GREEN}✓ Using existing project: $PROJECT_ID${NC}\n"
fi

# Step 4: Upload PDF
echo -e "${YELLOW}Step 4: Uploading PDF...${NC}"
echo -e "${BLUE}PDF: $TEST_PDF${NC}"

UPLOAD_RESPONSE=$(curl -s -b /tmp/sitelink-cookies.txt -X POST "$API_BASE/projects/$PROJECT_ID/plans" \
  -F "file=@$TEST_PDF" \
  -F "name=Test Plan $(date +%H:%M:%S)" \
  -F "sheetNumber=A-1")

echo -e "\n${BLUE}Upload Response:${NC}"
echo "$UPLOAD_RESPONSE" | jq .

PLAN_ID=$(echo "$UPLOAD_RESPONSE" | jq -r '.id // empty')

if [ -z "$PLAN_ID" ]; then
  echo -e "${RED}Failed to upload PDF${NC}"
  exit 1
fi

echo -e "\n${GREEN}✓ PDF uploaded! Plan ID: $PLAN_ID${NC}\n"

# Step 5: Monitor processing
echo -e "${YELLOW}Step 5: Monitoring processing status...${NC}\n"

for i in {1..30}; do
  PLAN_STATUS=$(curl -s -b /tmp/sitelink-cookies.txt "$API_BASE/plans/$PLAN_ID")
  STATUS=$(echo "$PLAN_STATUS" | jq -r '.status // "unknown"')
  TILE_COUNT=$(echo "$PLAN_STATUS" | jq -r '.tileCount // 0')

  echo -e "${BLUE}[$i/30] Status: $STATUS | Tiles: $TILE_COUNT${NC}"

  if [ "$STATUS" = "ready" ]; then
    echo -e "\n${GREEN}✓✓✓ Processing complete! Generated $TILE_COUNT tiles${NC}\n"
    break
  elif [ "$STATUS" = "failed" ]; then
    echo -e "\n${RED}Processing failed!${NC}\n"
    break
  fi

  sleep 2
done

# Step 6: Check database for processing job
echo -e "\n${YELLOW}Step 6: Checking database...${NC}"
echo -e "${BLUE}Processing Jobs:${NC}"
bun wrangler d1 execute SitelinkDB --local --command "SELECT id, status, progress, error FROM processing_jobs ORDER BY created_at DESC LIMIT 1"

echo -e "\n${BLUE}Plan Sheets:${NC}"
bun wrangler d1 execute SitelinkDB --local --command "SELECT id, status, tile_count, width, height FROM plan_sheets WHERE plan_id = '$PLAN_ID'"

# Step 7: Check R2 storage
echo -e "\n${YELLOW}Step 7: Checking R2 storage...${NC}"
echo -e "${BLUE}Listing directories with '_files' (tiles):${NC}"
find .wrangler/state/v3/r2/sitelink-storage-preview/ -type d -name "*_files" 2>/dev/null | tail -5

echo -e "\n${GREEN}=== Test Complete ===${NC}"
echo -e "${YELLOW}Check /tmp/backend-new.log for detailed backend logs${NC}\n"
