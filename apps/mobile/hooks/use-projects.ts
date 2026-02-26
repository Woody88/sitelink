import { queryDb } from "@livestore/livestore";
import { tables } from "@sitelink/domain";
import { formatDistanceToNow } from "date-fns";
import { useMemo } from "react";
import { useSessionContext } from "@/lib/session-context";
import { useAppStore } from "@/livestore/store";

export interface ProjectWithStats {
	id: string;
	name: string;
	address: string | undefined;
	sheetCount: number;
	photoCount: number;
	memberCount: number;
	updatedAt: string;
	status: "active" | "archived" | "completed";
}

export function useProjects() {
	const { organizationId, sessionToken, sessionId } = useSessionContext();

	if (!organizationId) {
		console.warn(
			"[useProjects] Called without organizationId - session not ready",
		);
		return { projects: undefined, store: undefined };
	}

	const store = useAppStore(organizationId, sessionToken, sessionId);

	const projects = store.useQuery(
		queryDb(tables.projects.orderBy("updatedAt", "desc")),
	);

	const sheets = store.useQuery(queryDb(tables.sheets));
	const photos = store.useQuery(queryDb(tables.photos));
	const organizationMembers = store.useQuery(
		queryDb(tables.organizationMembers),
	);

	if (projects) {
		console.log(
			`[useProjects] Found ${projects.length} projects:`,
			projects.map((p) => p.name).join(", "),
		);
	}

	const projectStats = useMemo(() => {
		if (!projects) return undefined;

		const projectsArray = projects;
		const sheetsArray = Array.isArray(sheets) ? sheets : [];
		const photosArray = Array.isArray(photos) ? photos : [];
		const membersArray = Array.isArray(organizationMembers)
			? organizationMembers
			: [];

		return projectsArray.map((project) => {
			const projectSheets = sheetsArray.filter(
				(s) => s.projectId === project.id,
			);
			const projectPhotos = photosArray.filter(
				(p) => p.projectId === project.id,
			);
			const memberCount = membersArray.length || 1;

			const status: "active" | "archived" | "completed" = project.isArchived
				? "archived"
				: "active";

			return {
				id: project.id,
				name: project.name,
				address: project.address ?? undefined,
				sheetCount: projectSheets.length,
				photoCount: projectPhotos.length,
				memberCount,
				updatedAt: formatDistanceToNow(new Date(project.updatedAt), {
					addSuffix: true,
				}),
				status,
			};
		});
	}, [projects, sheets, photos, organizationMembers]);

	return { projects: projectStats, store };
}
