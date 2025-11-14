import { createAuthClient } from "better-auth/client"
import { magicLinkClient, organizationClient } from "better-auth/client/plugins"
import { apiKey } from "better-auth/plugins"

export function createTestAuthClient(
	baseURL: string,
	customFetch?: (
		input: RequestInfo | URL,
		init?: RequestInit,
	) => Promise<Response>,
) {
	const config = {
		plugins: [apiKey(), magicLinkClient(), organizationClient()],
		baseURL,
		...(customFetch && {
			fetchOptions: {
				customFetchImpl: customFetch,
			},
		}),
	}

	return createAuthClient(config)
}
