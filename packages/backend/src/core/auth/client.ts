import { createAuthClient } from "better-auth/client"
import { magicLinkClient, organizationClient } from "better-auth/client/plugins"
import { apiKey } from "better-auth/plugins"

export function createTestAuthClient(
	baseURL: string,
	customFetch?: typeof fetch,
) {
	const config: Parameters<typeof createAuthClient>[0] = {
		plugins: [apiKey(), magicLinkClient(), organizationClient()],
		baseURL,
	}

	if (customFetch) {
		config.fetchOptions = {
			customFetchImpl: customFetch,
		}
	}

	return createAuthClient(config)
}
