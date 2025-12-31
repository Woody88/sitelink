#!/bin/bash

# Script to test sequential media uploads
# This reproduces the bug: uploading two photos in sequence

set -e

echo "🧪 Testing sequential media uploads..."
echo ""

# Configuration
API_URL="http://localhost:8787"
EMAIL="test@example.com"
PASSWORD="password123"

# Create test images
echo "📸 Creating test images..."
echo -n -e '\xFF\xD8\xFF\xE0' > /tmp/test-photo-1.jpg
echo -n -e '\xFF\xD8\xFF\xE1' > /tmp/test-photo-2.jpg

# Login to get session cookie
echo "🔐 Logging in..."
LOGIN_RESPONSE=$(curl -s -c /tmp/cookies.txt -X POST "$API_URL/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

echo "Login response: $LOGIN_RESPONSE"

# Get or create organization and project
# Note: You'll need to replace these with actual IDs from your test data
ORG_ID="your-org-id"
PROJECT_ID="your-project-id"

echo ""
echo "📤 Uploading first photo..."
UPLOAD1=$(curl -s -b /tmp/cookies.txt -X POST "$API_URL/api/projects/$PROJECT_ID/media" \
  -F "photo=@/tmp/test-photo-1.jpg;type=image/jpeg" \
  -F "description=First test photo" \
  -F "status=complete")

echo "First upload response: $UPLOAD1"

echo ""
echo "📤 Uploading second photo (this was causing the crash)..."
UPLOAD2=$(curl -s -b /tmp/cookies.txt -X POST "$API_URL/api/projects/$PROJECT_ID/media" \
  -F "photo=@/tmp/test-photo-2.jpg;type=image/jpeg" \
  -F "description=Second test photo" \
  -F "status=complete")

echo "Second upload response: $UPLOAD2"

echo ""
echo "✅ Test completed successfully!"
echo ""
echo "If both uploads returned 200 OK with media IDs, the bug is fixed!"

# Cleanup
rm -f /tmp/test-photo-1.jpg /tmp/test-photo-2.jpg /tmp/cookies.txt
