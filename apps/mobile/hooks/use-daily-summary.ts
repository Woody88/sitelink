import { queryDb } from "@livestore/livestore";
import { tables } from "@sitelink/domain";
import { useCallback, useState } from "react";
import { useSessionContext } from "@/lib/session-context";
import { useAppStore } from "@/livestore/store";

export interface DailySummary {
	text: string;
	lastGenerated: Date;
}

export interface SummaryPhoto {
	time: string;
	location: string | null;
	isIssue: boolean;
	voiceNote?: string | null;
}

export function useDailySummary(projectId: string) {
	const { sessionToken, organizationId, sessionId } =
		useSessionContext();
	const store = useAppStore(organizationId!, sessionToken, sessionId);

	const projects = store.useQuery(
		queryDb(tables.projects.where({ id: projectId })),
	);
	const project = Array.isArray(projects) ? projects[0] : null;

	const [summary, setSummary] = useState<DailySummary | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const generateSummary = useCallback(
		async (photos: SummaryPhoto[]) => {
			setIsLoading(true);
			setError(null);
			try {
				const baseUrl =
					process.env.EXPO_PUBLIC_BETTER_AUTH_URL ||
					"http://localhost:8787";
				const response = await fetch(
					`${baseUrl}/api/projects/${projectId}/summary`,
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							Authorization: `Bearer ${sessionToken}`,
						},
						body: JSON.stringify({
							projectName: project?.name ?? "Unknown Project",
							date: new Date().toLocaleDateString("en-US", {
								weekday: "long",
								year: "numeric",
								month: "long",
								day: "numeric",
							}),
							address: project?.address ?? undefined,
							photos,
						}),
					},
				);

				if (!response.ok) {
					const body = await response.json().catch(() => ({})) as {
						error?: string;
					};
					throw new Error(
						body?.error ?? `Request failed (${response.status})`,
					);
				}

				const data = (await response.json()) as { summary: string };
				setSummary({ text: data.summary, lastGenerated: new Date() });
			} catch (err) {
				setError(
					err instanceof Error
						? err.message
						: "Failed to generate summary",
				);
				console.error("[useDailySummary] Error:", err);
			} finally {
				setIsLoading(false);
			}
		},
		[projectId, sessionToken, project],
	);

	return {
		summary,
		isLoading,
		error,
		generateSummary,
	};
}
