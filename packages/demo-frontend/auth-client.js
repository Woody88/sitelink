import { createAuthClient } from "better-auth/client";

// Use the frontend proxy to avoid CORS issues
// The proxy at http://localhost:3000 forwards /api/* to the backend
export const authClient = createAuthClient({
  baseURL: "http://localhost:3000",
});
