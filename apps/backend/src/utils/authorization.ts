// apps/backend/src/utils/authorization.ts
/**
 * Authorization utilities for validating user permissions
 * These helpers check if users can access/modify resources
 */

import type { AuthorizationResult, Env } from "../types/env";

/**
 * Check if user is a member of an organization
 */
export async function checkOrganizationMembership(
	organizationId: string,
	userId: string,
	env: Env,
): Promise<boolean> {
	// Query using raw SQL since we're using D1 directly
	const result = await env.DB.prepare(
		"SELECT 1 FROM organization_members WHERE organizationId = ? AND userId = ?",
	)
		.bind(organizationId, userId)
		.first();

	return result !== null;
}

/**
 * Check if user has access to a project
 */
export async function checkProjectAccess(
	projectId: string,
	userId: string,
	env: Env,
): Promise<boolean> {
	// Check if user owns the project or is a member of the organization
	const projectResult = await env.DB.prepare(
		"SELECT organizationId, createdBy FROM projects WHERE id = ?",
	)
		.bind(projectId)
		.first<{ organizationId: string; createdBy: string }>();

	if (!projectResult) {
		return false;
	}

	// User created the project
	if (projectResult.createdBy === userId) {
		return true;
	}

	// User is member of the organization
	return checkOrganizationMembership(projectResult.organizationId, userId, env);
}

/**
 * Check if user can modify a project
 */
export async function checkProjectEditPermission(
	projectId: string,
	userId: string,
	env: Env,
): Promise<AuthorizationResult> {
	const hasAccess = await checkProjectAccess(projectId, userId, env);

	if (!hasAccess) {
		return {
			allowed: false,
			reason: "User does not have access to this project",
			userId,
		};
	}

	// Additional checks: verify user role allows editing
	// For now, all members can edit
	return {
		allowed: true,
		userId,
	};
}

/**
 * Check if user is an admin of an organization
 */
export async function checkOrganizationAdmin(
	organizationId: string,
	userId: string,
	env: Env,
): Promise<boolean> {
	const result = await env.DB.prepare(
		"SELECT role FROM organization_members WHERE organizationId = ? AND userId = ?",
	)
		.bind(organizationId, userId)
		.first<{ role: string }>();

	if (!result) {
		return false;
	}

	return result.role === "owner" || result.role === "admin";
}

/**
 * Get all project IDs accessible to a user
 */
export async function getUserAccessibleProjects(
	userId: string,
	env: Env,
): Promise<string[]> {
	// Get all organizations user is a member of
	const orgs = await env.DB.prepare(
		"SELECT organizationId FROM organization_members WHERE userId = ?",
	)
		.bind(userId)
		.all<{ organizationId: string }>();

	if (!orgs.results || orgs.results.length === 0) {
		return [];
	}

	// Get all projects in those organizations
	const orgIds = orgs.results.map(
		(o: { organizationId: string }) => o.organizationId,
	);
	const placeholders = orgIds.map(() => "?").join(",");

	const projects = await env.DB.prepare(
		`SELECT id FROM projects WHERE organizationId IN (${placeholders})`,
	)
		.bind(...orgIds)
		.all<{ id: string }>();

	return projects.results?.map((p: { id: string }) => p.id) || [];
}

/**
 * Validate event authorization
 * Checks if user can push this event based on the event type and data
 */
export async function validateEventAuthorization(
	event: any,
	userId: string,
	env: Env,
): Promise<AuthorizationResult> {
	// Project-related events
	if (event.type === "v1.ProjectCreated") {
		const isAdmin = await checkOrganizationAdmin(
			event.organizationId,
			userId,
			env,
		);
		if (!isAdmin) {
			return {
				allowed: false,
				reason: "Only organization admins can create projects",
				userId,
			};
		}
	}

	if (
		event.type === "v1.ProjectUpdated" ||
		event.type === "v1.ProjectDeleted"
	) {
		const result = await checkProjectEditPermission(
			event.projectId,
			userId,
			env,
		);
		if (!result.allowed) {
			return result;
		}
	}

	// Organization events - only owners/admins can modify
	if (
		event.type === "v1.OrganizationUpdated" ||
		event.type === "v1.OrganizationDeleted" ||
		event.type === "v1.MemberAdded" ||
		event.type === "v1.MemberRemoved"
	) {
		const isAdmin = await checkOrganizationAdmin(
			event.organizationId,
			userId,
			env,
		);
		if (!isAdmin) {
			return {
				allowed: false,
				reason: "Only organization admins can perform this action",
				userId,
			};
		}
	}

	// Photo/marker events - check project access
	if (event.type === "v1.PhotoCaptured" || event.type === "v1.MarkerCreated") {
		const hasAccess = await checkProjectAccess(event.projectId, userId, env);
		if (!hasAccess) {
			return {
				allowed: false,
				reason: "User does not have access to this project",
				userId,
			};
		}
	}

	// Default: allow
	return {
		allowed: true,
		userId,
	};
}
