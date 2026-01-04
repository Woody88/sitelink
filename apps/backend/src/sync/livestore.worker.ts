// apps/backend/src/sync/livestore.worker.ts
/**
 * LiveStore worker for client-side sync setup
 * This file is used by the web adapter to configure the sync backend
 */

import { makeCfSync } from '@livestore/sync-cf';
import { makeWorker } from '@livestore/adapter-web/worker';
import { schema } from '@sitelink/domain';

// Get the WebSocket URL from environment or use localhost for development
const isDev = process.env.NODE_ENV === 'development';
const syncUrl = isDev 
  ? 'ws://localhost:8787'
  : 'wss://your-worker-url.workers.dev'; // Update with your production URL

/**
 * Create the LiveStore worker with Cloudflare sync backend
 * This worker runs in the browser and handles all LiveStore operations
 */
makeWorker({
  schema,
  sync: {
    backend: makeCfSync({
      url: syncUrl,
      // This function is called to get the auth token
      // It will be passed to the sync backend for validation
      getAuthToken: async () => {
        // Get the auth token from your auth system
        // For Better Auth, you'd get it from cookies or localStorage
        const token = localStorage.getItem('auth-token');
        
        if (!token) {
          throw new Error('Not authenticated');
        }
        
        return token;
      },
    }),
  },
});

