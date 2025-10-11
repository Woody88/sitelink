import { defineWorkersProject, readD1Migrations } from '@cloudflare/vitest-pool-workers/config';
import path from 'node:path';

export default defineWorkersProject(async () => {
	const migrationsPath = path.join(__dirname, 'drizzle');
	const migrations = await readD1Migrations(migrationsPath);

	return {
		test: {
			setupFiles: ['./test/setup.ts'],
			poolOptions: {
				workers: {
					wrangler: { configPath: './wrangler.jsonc' },
					miniflare: {
						bindings: { TEST_MIGRATIONS: migrations },
					},
				},
			},
		},
	};
});
