/**
 * Script to check marker detection status and manually trigger if needed
 * Uses wrangler d1 directly to query the database
 * 
 * Usage:
 *   bun run scripts/manual-trigger-markers.ts <planId|uploadId>
 * 
 * Examples:
 *   bun run scripts/manual-trigger-markers.ts 5ec76561-99e4-4866-8993-b71ae5b2a546
 *   bun run scripts/manual-trigger-markers.ts 898ba648-d4d3-43cc-9db6-0579d84884b8
 */

import { $ } from "bun"

async function checkMarkerStatus(planIdOrUploadId: string) {
  console.log(`🔍 Checking marker detection status for: ${planIdOrUploadId}`)
  
  // First, determine if it's a planId or uploadId by querying the database
  const checkPlan = await $`bun wrangler d1 execute sitelink-db --local --command "SELECT id, name FROM plans WHERE id = '${planIdOrUploadId}' LIMIT 1"`.quiet()
  const checkUpload = await $`bun wrangler d1 execute sitelink-db --local --command "SELECT upload_id, plan_id FROM plan_uploads WHERE upload_id = '${planIdOrUploadId}' LIMIT 1"`.quiet()
  
  let planId: string
  let uploadId: string
  
  if (checkPlan.exitCode === 0 && checkPlan.stdout.toString().includes(planIdOrUploadId)) {
    planId = planIdOrUploadId
    console.log(`✅ Found plan: ${planId}`)
    
    // Get uploadId from plan
    const uploadResult = await $`bun wrangler d1 execute sitelink-db --local --command "SELECT upload_id FROM plan_uploads WHERE plan_id = '${planId}' ORDER BY created_at DESC LIMIT 1"`.quiet()
    if (uploadResult.exitCode === 0) {
      const uploadMatch = uploadResult.stdout.toString().match(/([a-f0-9-]{36})/)
      if (uploadMatch) {
        uploadId = uploadMatch[1]
        console.log(`✅ Found uploadId: ${uploadId}`)
      }
    }
  } else if (checkUpload.exitCode === 0 && checkUpload.stdout.toString().includes(planIdOrUploadId)) {
    uploadId = planIdOrUploadId
    console.log(`✅ Found uploadId: ${uploadId}`)
    
    // Get planId from upload
    const planResult = await $`bun wrangler d1 execute sitelink-db --local --command "SELECT plan_id FROM plan_uploads WHERE upload_id = '${uploadId}' LIMIT 1"`.quiet()
    if (planResult.exitCode === 0) {
      const planMatch = planResult.stdout.toString().match(/([a-f0-9-]{36})/)
      if (planMatch) {
        planId = planMatch[1]
        console.log(`✅ Found planId: ${planId}`)
      }
    }
  } else {
    console.error(`❌ Could not find plan or upload with ID: ${planIdOrUploadId}`)
    process.exit(1)
  }
  
  if (!planId || !uploadId) {
    console.error(`❌ Could not determine both planId and uploadId`)
    process.exit(1)
  }
  
  // Check marker count
  console.log(`📊 Markers for plan ${planId}:`)
  const markerResult = await $`bun wrangler d1 execute sitelink-db --local --command "SELECT COUNT(*) as count FROM plan_markers WHERE plan_id = '${planId}'"`.quiet()
  if (markerResult.exitCode === 0) {
    const output = markerResult.stdout.toString()
    const countMatch = output.match(/\|\s*(\d+)\s*\|/)
    const count = countMatch ? countMatch[1] : "0"
    console.log(`   Total markers: ${count}`)
    
    if (count !== "0") {
      // Show sample markers
      const sampleMarkers = await $`bun wrangler d1 execute sitelink-db --local --command "SELECT sheet_number, marker_text, marker_type, is_valid FROM plan_markers WHERE plan_id = '${planId}' LIMIT 5"`.quiet()
      if (sampleMarkers.exitCode === 0) {
        console.log(`\n   Sample markers:`)
        console.log(sampleMarkers.stdout.toString())
      }
    }
  }
  
  // Check sheet status
  console.log(`\n📄 Sheets for upload ${uploadId}:`)
  const sheetsResult = await $`bun wrangler d1 execute sitelink-db --local --command "SELECT sheet_number, status, tile_count FROM plan_sheets WHERE upload_id = '${uploadId}' ORDER BY sheet_number"`.quiet()
  if (sheetsResult.exitCode === 0) {
    console.log(sheetsResult.stdout.toString())
  }
  
  // Check processing job status
  console.log(`\n⚙️ Processing job status:`)
  const jobResult = await $`bun wrangler d1 execute sitelink-db --local --command "SELECT status, progress, total_pages, completed_pages FROM processing_jobs WHERE upload_id = '${uploadId}' LIMIT 1"`.quiet()
  if (jobResult.exitCode === 0) {
    console.log(jobResult.stdout.toString())
  }
  
  console.log(`\n💡 Note: To trigger marker detection, re-upload the plan or use Worker context`)
}

const id = process.argv[2]
if (!id) {
  console.error("❌ Usage: bun run scripts/manual-trigger-markers.ts <planId|uploadId>")
  console.error("   Example: bun run scripts/manual-trigger-markers.ts 5ec76561-99e4-4866-8993-b71ae5b2a546")
  process.exit(1)
}

checkMarkerStatus(id).catch(console.error)

