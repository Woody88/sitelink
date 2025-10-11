import { createAuthClient } from "better-auth/client"
import { magicLinkClient, organizationClient } from "better-auth/client/plugins"

export function createTestAuthClient(
	baseURL: string,
	customFetch?: typeof fetch,
) {
	return createAuthClient({
		plugins: [magicLinkClient(), organizationClient()],
		baseURL,
		fetchOptions: {
			customFetchImpl: customFetch,
		},
	})
}
