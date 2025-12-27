import { generateTilesStream } from "./tile-processor"

interface SheetDataHeaders {
	sheetKey: string,
	sheetNumber: string,
	sheetTotalCount: number,
	uploadId: string,
	organizationId: string,
	projectId: string,
	planId: string
}

const PORT = parseInt(process.env.PORT || "3001")
console.log(`🚀 Starting tile generation server on port ${PORT}...`)

const server = Bun.serve({
	port: PORT, // Use 3001 to avoid conflict with frontend on 3000
	routes: {
		"/health": () => {
			console.log('🏥 Health check requested')
			return Response.json({ health: "ok" })
		},
		"/generate-tiles": {
			POST: async (req) => {
				try {
					console.log('📨 Received /generate-tiles POST request')
					const headers = req.headers
					const sheetHeaders = {
						sheetKey: headers.get("X-Sheet-Key") || '',
						sheetNumber: headers.get("X-Sheet-Number") || '',
						sheetTotalCount: Number.parseInt(headers.get("X-Sheet-Total-Count") || '0'),
						uploadId: headers.get("X-Upload-Id") || '',
						organizationId: headers.get("X-Organization-Id") || '',
						projectId: headers.get("X-Project-Id") || '',
						planId: headers.get("X-Plan-Id") || ''
					} satisfies SheetDataHeaders


					const sheetId = `sheet-${sheetHeaders.sheetNumber}`
					const sheetPdfFilePath = `/tmp/${sheetHeaders.uploadId}/${sheetId}.pdf`

					console.log(`📦 Streaming request body to ${sheetPdfFilePath}`)
					
					if (!req.body) {
						throw new Error('Request body is empty')
					}
					
					// Ensure directory exists
					const dir = sheetPdfFilePath.substring(0, sheetPdfFilePath.lastIndexOf('/'))
					await Bun.$`mkdir -p ${dir}`.quiet()
					
					// Use Bun.file() writer for streaming
					console.log(`📦 Creating file writer...`)
					const file = Bun.file(sheetPdfFilePath)
					const writer = file.writer()
					
					console.log(`📦 Reading request body stream...`)
					const reader = req.body.getReader()
					let totalBytes = 0
					
					try {
						while (true) {
							const { done, value } = await reader.read()
							if (done) break
							
							if (value) {
								writer.write(value)
								totalBytes += value.length
							}
						}
						await writer.end()
						console.log(`✅ File written successfully (${totalBytes} bytes)`)
					} catch (error) {
						await writer.end()
						console.error(`❌ Error writing file:`, error)
						throw error
					}

					const tilesTarFilename = `${sheetHeaders.organizationId}_${sheetHeaders.projectId}_${sheetHeaders.planId}_${sheetHeaders.uploadId}_${sheetId}.tar`
					const tiles = await generateTilesStream(sheetPdfFilePath, sheetId, sheetHeaders.uploadId)

					return new Response(tiles, {
						headers: {
							'Content-Type': 'application/x-tar',
							'Content-Disposition': `attachment; filename="${tilesTarFilename}"`
						}
					})
				} catch (error) {
					console.error('Error generating tiles:', error)
					return new Response(
						JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
						{
							status: 500,
							headers: { 'Content-Type': 'application/json' }
						}
					)
				}
			}
		},
		// Legacy /processPdf endpoint removed - use queue-based processing instead
		// Tests should use the tile generation queue consumer directly
	},
})

console.log(`✅ Server running at ${server.url}`)
console.log(`✅ Server is ready to accept requests on port ${PORT}`)
