import { createAuthClient } from "better-auth/client"
import { magicLinkClient, organizationClient } from "better-auth/client/plugins"

export function createTestAuthClient(
	baseURL: string,
	customFetch?: typeof fetch,
) {
	const config: Parameters<typeof createAuthClient>[0] = {
		plugins: [magicLinkClient(), organizationClient()],
		baseURL,
	}

	if (customFetch) {
		config.fetchOptions = {
			customFetchImpl: customFetch,
		}
	}

	return createAuthClient(config)
}
