import { Clockodo } from "clockodo";
import { requireAuth } from "./config.js";

let clientInstance: Clockodo | null = null;

/** Create or return a cached Clockodo API client */
export function getClient(): Clockodo {
  if (!clientInstance) {
    const { email, apiKey } = requireAuth();

    clientInstance = new Clockodo({
      client: {
        name: "clockodo-cli",
        email,
      },
      authentication: {
        user: email,
        apiKey,
      },
    });
  }

  return clientInstance;
}

/** Reset client instance (for testing or re-auth) */
export function resetClient(): void {
  clientInstance = null;
}
