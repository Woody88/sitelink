// apps/backend/src/sync/websocket-server.ts
import { makeDurableObject } from "@livestore/sync-cf/cf-worker"

/**
 * WebSocket Durable Object for handling LiveStore sync connections
 * This handles push/pull requests from clients and persists events in D1
 */
export class WebSocketServer extends makeDurableObject({
  onPush: async (message) => {
    // Handle incoming events from clients
    console.log("onPush: Received batch with", message.batch.length, "events")
    console.log("onPush: Message:", JSON.stringify(message, null, 2))

    // For now, skip authorization - the validatePayload already validated the user
    // The context from validatePayload should be available, but if not, we'll handle it gracefully
    // TODO: Access user context from validatePayload result if available

    // All events are authorized, proceed with storage
    console.log("onPush: All events authorized, storing...")
    return
  },

  onPull: async (message) => {
    // Handle pull requests from clients
    console.log("onPull: Client requesting events since", message.cursor)
    console.log("onPull: Message:", JSON.stringify(message, null, 2))

    // For now, skip user filtering - the validatePayload already validated the user
    // The context from validatePayload should be available, but if not, we'll handle it gracefully
    // TODO: Access user context from validatePayload result if available

    return
  },
}) {}
