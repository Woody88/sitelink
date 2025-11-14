// Re-export auth tables (managed by better-auth)
export * from "./_auth"

export * from "./subscriptions"
export * from "./projects"
export * from "./plans"
export * from "./plan-uploads"
export * from "./plan-sheets"
export * from "./processing-jobs"
export * from "./media"
export * from "./annotations"
export * from "./usage-events"


import {
	accounts,
	apikeys,
	invitations,
	members,
	organizations,
	sessions,
	users,
	verifications,
} from "./_auth"
import { annotations } from "./annotations"
import { media } from "./media"
import { planSheets } from "./plan-sheets"
import { planUploads } from "./plan-uploads"
import { plans } from "./plans"
import { processingJobs } from "./processing-jobs"
import { projects } from "./projects"
import { subscriptions } from "./subscriptions"
import { usageEvents } from "./usage-events"

export const schema = {
	// Auth tables
	users,
	sessions,
	accounts,
	verifications,
	apikeys,
	organizations,
	members,
	invitations,
	// Business tables
	subscriptions,
	projects,
	plans,
	planUploads,
	planSheets,
	processingJobs,
	media,
	annotations,
	usageEvents,
}
