#!/usr/bin/env bun

import Database from "bun:sqlite";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const SYNC_BACKEND_DO_PATH = join(
	import.meta.dir,
	"../.wrangler/state/v3/do/sitelink-backend-SyncBackendDO",
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

function main() {
	const sqlitePath = findSqliteFile();

	if (!sqlitePath) {
		console.log("No SyncBackendDO SQLite file found.");
		console.log("Run 'bun run dev' and trigger some events first.");
		process.exit(1);
	}

	console.log(`Reading: ${sqlitePath}\n`);

	const db = new Database(sqlitePath, { readonly: true });

	const tables = db
		.query(
			"SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'eventlog_%'",
		)
		.all() as { name: string }[];

	if (tables.length === 0) {
		console.log("No eventlog tables found.");
		process.exit(0);
	}

	for (const { name: tableName } of tables) {
		const storeId = tableName.replace("eventlog_7_", "");
		console.log(`\n=== Store: ${storeId} ===\n`);

		const count = db
			.query(`SELECT COUNT(*) as count FROM ${tableName}`)
			.get() as { count: number };
		console.log(`Total events: ${count.count}\n`);

		const events = db
			.query(
				`SELECT seqNum, name, args, createdAt FROM ${tableName} ORDER BY seqNum DESC LIMIT 20`,
			)
			.all() as {
			seqNum: number;
			name: string;
			args: string;
			createdAt: string;
		}[];

		if (events.length === 0) {
			console.log("No events yet.");
			continue;
		}

		console.log("Recent events (newest first):");
		console.log("-".repeat(80));

		for (const event of events) {
			const args = JSON.parse(event.args);
			console.log(`[${event.seqNum}] ${event.name}`);
			console.log(`    ${event.createdAt}`);
			console.log(
				`    ${JSON.stringify(args, null, 2).split("\n").join("\n    ")}`,
			);
			console.log();
		}
	}

	db.close();
}

main();
