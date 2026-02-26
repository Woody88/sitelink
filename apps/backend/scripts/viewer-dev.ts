import Database from "bun:sqlite";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import index from "../viewer/index.html";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8787";
const PORT = parseInt(process.env.PORT || "3003", 10);

const SYNC_BACKEND_DO_PATH = join(
	import.meta.dir,
	"../.wrangler/state/v3/do/sitelink-backend-SyncBackendDO",
);

const R2_METADATA_PATH = join(
	import.meta.dir,
	"../.wrangler/state/v3/r2/miniflare-R2BucketObject",
);

const R2_BLOBS_PATH = join(
	import.meta.dir,
	"../.wrangler/state/v3/r2/sitelink-files/blobs",
);

function findSqliteFile(): string | null {
	try {
		const files = readdirSync(SYNC_BACKEND_DO_PATH);
		const sqliteFile = files.find((f) => f.endsWith(".sqlite"));
		return sqliteFile ? join(SYNC_BACKEND_DO_PATH, sqliteFile) : null;
	} catch {
		return null;
	}
}

function findR2MetadataDb(): string | null {
	try {
		const files = readdirSync(R2_METADATA_PATH);
		const sqliteFile = files.find((f) => f.endsWith(".sqlite"));
		return sqliteFile ? join(R2_METADATA_PATH, sqliteFile) : null;
	} catch {
		return null;
	}
}

async function readR2File(
	key: string,
): Promise<{ data: ArrayBuffer; contentType: string } | null> {
	const metadataDbPath = findR2MetadataDb();
	if (!metadataDbPath) {
		console.log("[R2] No R2 metadata database found");
		return null;
	}

	try {
		const db = new Database(metadataDbPath, { readonly: true });

		// Query the R2 metadata table to find the blob for this key
		const row = db
			.query(`SELECT blob_id, http_metadata FROM _mf_objects WHERE key = ?`)
			.get(key) as { blob_id: string; http_metadata: string } | null;

		db.close();

		if (!row) {
			console.log(`[R2] Key not found: ${key}`);
			return null;
		}

		// Find the blob file
		const blobFiles = readdirSync(R2_BLOBS_PATH);
		const blobFile = blobFiles.find((f) => f.startsWith(row.blob_id));

		if (!blobFile) {
			console.log(`[R2] Blob file not found for: ${row.blob_id}`);
			return null;
		}

		const blobPath = join(R2_BLOBS_PATH, blobFile);
		const file = Bun.file(blobPath);
		const data = await file.arrayBuffer();

		// Parse HTTP metadata for content type
		let contentType = "application/octet-stream";
		try {
			const metadata = JSON.parse(row.http_metadata);
			contentType = metadata.contentType || contentType;
		} catch {}

		console.log(`[R2] Found: ${key} -> ${blobFile} (${contentType})`);
		return { data, contentType };
	} catch (error) {
		console.error("[R2] Error reading R2 file:", error);
		return null;
	}
}

function readEventsFromSqlite(): any[] {
	const sqlitePath = findSqliteFile();

	if (!sqlitePath) {
		console.log("[Events] No SyncBackendDO SQLite file found");
		return [];
	}

	console.log(`[Events] Reading from: ${sqlitePath}`);

	try {
		const db = new Database(sqlitePath, { readonly: true });

		const tables = db
			.query(
				"SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'eventlog_%'",
			)
			.all() as { name: string }[];

		if (tables.length === 0) {
			console.log("[Events] No eventlog tables found");
			db.close();
			return [];
		}

		const allEvents: any[] = [];

		for (const { name: tableName } of tables) {
			const storeId = tableName.replace("eventlog_7_", "");
			console.log(`[Events] Reading from store: ${storeId}`);

			const events = db
				.query(
					`SELECT seqNum, parentSeqNum, name, args, createdAt FROM ${tableName} ORDER BY seqNum ASC`,
				)
				.all() as {
				seqNum: number;
				parentSeqNum: number;
				name: string;
				args: string;
				createdAt: string;
			}[];

			for (const event of events) {
				const data = JSON.parse(event.args);
				allEvents.push({
					type: "synced",
					name: event.name,
					seqNum: event.seqNum,
					parentSeqNum: event.parentSeqNum,
					timestamp: new Date(event.createdAt).getTime(),
					data,
				});
			}
		}

		db.close();
		console.log(`[Events] Loaded ${allEvents.length} events`);
		return allEvents;
	} catch (error) {
		console.error("[Events] Error reading SQLite:", error);
		return [];
	}
}

console.log(`
╔════════════════════════════════════════════════════════════╗
║  LiveStore Event Viewer - Development Server               ║
╠════════════════════════════════════════════════════════════╣
║  Viewer:  http://localhost:${PORT}                           ║
║  Backend: ${BACKEND_URL}                            ║
╚════════════════════════════════════════════════════════════╝
`);

Bun.serve({
	port: PORT,
	routes: {
		"/": index,

		// Read R2 files directly from local miniflare storage
		"/api/r2/*": async (req) => {
			const url = new URL(req.url);
			const r2Key = decodeURIComponent(url.pathname.replace("/api/r2/", ""));

			console.log(`[R2] Requesting: ${r2Key}`);

			const result = await readR2File(r2Key);

			if (!result) {
				return Response.json(
					{ error: "Not found", key: r2Key },
					{ status: 404 },
				);
			}

			const headers = new Headers();
			headers.set("Content-Type", result.contentType);
			headers.set("Access-Control-Allow-Origin", "*");
			headers.set("Cache-Control", "public, max-age=3600");

			// Support range requests for PMTiles
			const rangeHeader = req.headers.get("Range");
			if (rangeHeader) {
				const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
				if (match) {
					const start = parseInt(match[1], 10);
					const end = match[2]
						? parseInt(match[2], 10)
						: result.data.byteLength - 1;
					const slice = result.data.slice(start, end + 1);

					headers.set(
						"Content-Range",
						`bytes ${start}-${end}/${result.data.byteLength}`,
					);
					headers.set("Content-Length", String(slice.byteLength));
					return new Response(slice, { status: 206, headers });
				}
			}

			return new Response(result.data, { headers });
		},

		// Read events directly from SQLite for local development
		"/api/events": async () => {
			console.log(`[Events] Reading events from local SQLite...`);

			const events = readEventsFromSqlite();

			return Response.json(events, {
				headers: {
					"Access-Control-Allow-Origin": "*",
					"Content-Type": "application/json",
				},
			});
		},
	},
	development: {
		hmr: true,
		console: true,
	},
});

console.log(`Viewer dev server running on http://localhost:${PORT}`);
