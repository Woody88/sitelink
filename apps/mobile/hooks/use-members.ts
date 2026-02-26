import { queryDb } from "@livestore/livestore";
import { tables } from "@sitelink/domain";
import { useMemo } from "react";
import { useSessionContext } from "@/lib/session-context";
import { useAppStore } from "@/livestore/store";

export interface Member {
	id: string;
	userId: string;
	name: string;
	email: string;
	role: string;
	avatarUrl: string | null;
}

export function useMembers(projectId: string) {
	const { sessionToken, organizationId, sessionId } = useSessionContext();

	const store = useAppStore(organizationId!, sessionToken, sessionId);

	const organizationMembers = store.useQuery(
		queryDb(
			tables.organizationMembers.where(
				organizationId ? { organizationId } : { organizationId: "__none__" },
			),
		),
	);

	const users = store.useQuery(queryDb(tables.users));

	return useMemo(() => {
		const membersArray = Array.isArray(organizationMembers)
			? organizationMembers
			: [];
		const usersArray = Array.isArray(users) ? users : [];

		const userMap = new Map(usersArray.map((u) => [u.id, u]));

		const members: Member[] = membersArray
			.map((member) => {
				const user = userMap.get(member.userId);
				if (!user) return null;

				return {
					id: member.id,
					userId: member.userId,
					name: user.name,
					email: user.email,
					role: member.role,
					avatarUrl: user.avatarUrl,
				};
			})
			.filter((m): m is Member => m !== null);

		return members;
	}, [organizationMembers, users]);
}
