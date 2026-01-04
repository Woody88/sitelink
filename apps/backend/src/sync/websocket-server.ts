// apps/backend/src/sync/websocket-server.ts
import { makeDurableObject } from '@livestore/sync-cf/cf-worker';
import { validateEventAuthorization, getUserAccessibleProjects } from '../utils/authorization';
import type { Env, SyncContext } from '../types/env';

/**
 * WebSocket Durable Object for handling LiveStore sync connections
 * This handles push/pull requests from clients and persists events in D1
 */
export class WebSocketServer extends makeDurableObject({
  onPush: async (message, context: SyncContext) => {
    // Handle incoming events from clients
    console.log('onPush: Received batch with', message.batch.length, 'events');
    
    const userId = context.userId;
    if (!userId) {
      throw new Error('User ID not found in context');
    }
    
    // Validate user has permission to push each event
    for (const event of message.batch) {
      const authResult = await validateEventAuthorization(
        event,
        userId,
        context.env as Env
      );
      
      if (!authResult.allowed) {
        throw new Error(
          `Authorization failed for event ${event.type}: ${authResult.reason}`
        );
      }
    }
    
    // All events are authorized, proceed with storage
    console.log('onPush: All events authorized, storing...');
    return;
  },
  
  onPull: async (message, context: SyncContext) => {
    // Handle pull requests from clients
    console.log('onPull: Client requesting events since', message.since);
    
    const userId = context.userId;
    if (!userId) {
      throw new Error('User ID not found in context');
    }
    
    // Get list of projects user has access to
    const accessibleProjects = await getUserAccessibleProjects(
      userId,
      context.env as Env
    );
    
    console.log(`onPull: User ${userId} has access to ${accessibleProjects.length} projects`);
    
    // The sync backend will automatically filter events
    // We can add additional filtering here if needed
    // For now, just log the accessible projects for debugging
    
    return;
  },
}) {}

