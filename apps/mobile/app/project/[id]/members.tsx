import { queryDb } from "@livestore/livestore";
import { useStore } from "@livestore/react";
import { events, tables } from "@sitelink/domain";
import { Stack, useLocalSearchParams } from "expo-router";
import { Mail, MoreHorizontal, Plus, Search, UserPlus, X } from "lucide-react-native";
import * as React from "react";
import {
	Alert,
	FlatList,
	Modal,
	Pressable,
	TextInput,
	View,
} from "react-native";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useMembers } from "@/hooks/use-members";
import { authClient } from "@/lib/auth";
import { useSessionContext } from "@/lib/session-context";
import { createAppStoreOptions } from "@/lib/store-config";

export default function MembersScreen() {
	const params = useLocalSearchParams<{ id: string }>();
	const projectId = params.id;
	const members = useMembers(projectId);
	const [search, setSearch] = React.useState("");
	const [isAddModalVisible, setIsAddModalVisible] = React.useState(false);
	const [newMemberEmail, setNewMemberEmail] = React.useState("");
	const [newMemberRole, setNewMemberRole] = React.useState<
		"Admin" | "Member" | "Viewer"
	>("Member");

	const { sessionToken, userId } = useSessionContext();

	const storeOptions = React.useMemo(
		() => createAppStoreOptions(sessionToken),
		[sessionToken],
	);

	const store = useStore(storeOptions);

	const projectQuery = React.useMemo(
		() => queryDb(tables.projects.where({ id: projectId })),
		[projectId],
	);
	const project = store?.useQuery(projectQuery);

	const organizationId = React.useMemo(() => {
		const projectsArray = Array.isArray(project) ? project : [];
		return projectsArray[0]?.organizationId;
	}, [project]);

	const usersQuery = React.useMemo(() => queryDb(tables.users), []);
	const allUsers = store.useQuery(usersQuery);

	const filteredMembers = React.useMemo(() => {
		if (!search) return members;
		return members.filter(
			(m) =>
				m.name.toLowerCase().includes(search.toLowerCase()) ||
				m.email.toLowerCase().includes(search.toLowerCase()),
		);
	}, [search, members]);

	const handleAddMember = async () => {
		if (!newMemberEmail.trim()) {
			Alert.alert("Error", "Please enter an email address");
			return;
		}

		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(newMemberEmail)) {
			Alert.alert("Error", "Please enter a valid email address");
			return;
		}

		if (
			members.some(
				(m) => m.email.toLowerCase() === newMemberEmail.toLowerCase(),
			)
		) {
			Alert.alert("Error", "This member is already in the project");
			return;
		}

		if (!userId || !organizationId || !store) {
			console.error("[MEMBERS] Cannot add member: missing user, org, or store");
			return;
		}

		const usersArray = Array.isArray(allUsers) ? allUsers : [];
		const targetUser = usersArray.find(
			(u) => u.email.toLowerCase() === newMemberEmail.toLowerCase(),
		);

		if (targetUser) {
			// User already has an account — add them directly via LiveStore
			await store.commit(
				events.memberAdded({
					organizationId,
					userId: targetUser.id,
					role: newMemberRole.toLowerCase(),
					addedBy: userId,
				}),
			);
			console.log("[MEMBERS] Member added:", targetUser.id);
		} else {
			// User doesn't have an account yet — send an invitation email
			const result = await authClient.organization.inviteMember({
				email: newMemberEmail.trim().toLowerCase(),
				role: newMemberRole.toLowerCase() as "admin" | "member",
				organizationId,
			});
			if (result.error) {
				Alert.alert("Invitation Failed", result.error.message ?? "Could not send invitation");
				return;
			}
			console.log("[MEMBERS] Invitation sent to:", newMemberEmail);
			Alert.alert(
				"Invitation Sent",
				`An invitation email has been sent to ${newMemberEmail}. They'll be added when they accept.`,
			);
		}

		setNewMemberEmail("");
		setNewMemberRole("Member");
		setIsAddModalVisible(false);
	};

	const handleRemoveMember = (targetUserId: string, memberName: string) => {
		Alert.alert(
			"Remove Member",
			`Are you sure you want to remove ${memberName} from this project?`,
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Remove",
					style: "destructive",
					onPress: async () => {
						if (!userId || !organizationId || !store) {
							console.error(
								"[MEMBERS] Cannot remove member: missing user, org, or store",
							);
							return;
						}

						await store.commit(
							events.memberRemoved({
								organizationId,
								userId: targetUserId,
								removedBy: userId,
							}),
						);
						console.log("[MEMBERS] Member removed:", targetUserId);
					},
				},
			],
		);
	};

	const handleManageMember = (memberId: string) => {
		const member = members.find((m) => m.id === memberId);
		if (!member) return;

		Alert.alert("Manage Member", "Change role or remove member", [
			{ text: "Cancel", style: "cancel" },
			{
				text: "Remove",
				style: "destructive",
				onPress: () => {
					handleRemoveMember(member.userId, member.name);
				},
			},
		]);
	};

	return (
		<View className="bg-background flex-1">
			<Stack.Screen
				options={{
					title: "Project Members",
					headerShown: true,
					headerTitleAlign: "center",
					headerRight: () => (
						<Button
							size="icon"
							variant="ghost"
							onPress={() => setIsAddModalVisible(true)}
						>
							<Icon as={Plus} className="text-primary size-6" />
						</Button>
					),
				}}
			/>

			<View className="bg-background border-border border-b px-4 py-2">
				<View className="bg-muted h-10 flex-row items-center rounded-xl px-3">
					<Icon as={Search} className="text-muted-foreground mr-2 size-4" />
					<TextInput
						className="text-foreground h-full flex-1"
						placeholder="Search members..."
						placeholderTextColor="hsl(var(--muted-foreground))"
						value={search}
						onChangeText={setSearch}
					/>
				</View>
			</View>

			{filteredMembers.length === 0 && search === "" ? (
				<View className="flex-1 items-center justify-center p-8">
					<Text className="text-foreground mb-2 text-lg font-semibold">
						No Members Yet
					</Text>
					<Text className="text-muted-foreground text-center text-sm">
						Add team members to collaborate on this project
					</Text>
				</View>
			) : filteredMembers.length === 0 && search !== "" ? (
				<View className="flex-1 items-center justify-center p-8">
					<Text className="text-foreground mb-2 text-lg font-semibold">
						No Results
					</Text>
					<Text className="text-muted-foreground text-center text-sm">
						No members match your search
					</Text>
				</View>
			) : (
				<FlatList
					data={filteredMembers}
					contentContainerClassName="p-4 gap-4"
					keyExtractor={(item) => item.id}
					renderItem={({ item }) => (
						<Card>
							<CardContent className="flex-row items-center justify-between p-4">
								<View className="flex-row items-center gap-3">
									<View className="bg-secondary size-10 items-center justify-center rounded-full">
										<Text className="text-secondary-foreground font-semibold">
											{item.name.charAt(0)}
										</Text>
									</View>
									<View>
										<Text className="font-medium">{item.name}</Text>
										<Text className="text-muted-foreground text-sm">
											{item.email}
										</Text>
									</View>
								</View>
								<View className="flex-row items-center gap-2">
									<Badge
										variant={item.role === "owner" ? "default" : "outline"}
									>
										<Text
											className={
												item.role === "owner"
													? "text-primary-foreground"
													: "text-foreground"
											}
										>
											{item.role.charAt(0).toUpperCase() + item.role.slice(1)}
										</Text>
									</Badge>
									<Button
										variant="ghost"
										size="icon"
										className="h-8 w-8"
										onPress={() => handleManageMember(item.id)}
									>
										<Icon
											as={MoreHorizontal}
											className="text-muted-foreground size-4"
										/>
									</Button>
								</View>
							</CardContent>
						</Card>
					)}
				/>
			)}

			{/* Add Member Modal */}
			<Modal
				visible={isAddModalVisible}
				animationType="slide"
				presentationStyle="pageSheet"
				onRequestClose={() => setIsAddModalVisible(false)}
			>
				<View className="bg-background flex-1">
					{/* Header */}
					<View className="border-border/10 flex-row items-center justify-between border-b px-6 py-4">
						<Text className="text-lg font-bold">Add Team Member</Text>
						<Pressable
							onPress={() => setIsAddModalVisible(false)}
							className="bg-muted/20 active:bg-muted/40 size-8 items-center justify-center rounded-full"
						>
							<Icon as={X} className="text-foreground size-5" />
						</Pressable>
					</View>

					{/* Content */}
					<View className="flex-1 gap-6 p-6">
						<View className="gap-2">
							<Text className="text-foreground text-sm font-medium">
								Email Address
							</Text>
							<Input
								placeholder="member@example.com"
								value={newMemberEmail}
								onChangeText={setNewMemberEmail}
								keyboardType="email-address"
								autoCapitalize="none"
								autoComplete="email"
							/>
						</View>

						<View className="gap-2">
							<Text className="text-foreground text-sm font-medium">Role</Text>
							<View className="flex-row gap-2">
								{(["Admin", "Member", "Viewer"] as const).map((role) => (
									<Pressable
										key={role}
										onPress={() => setNewMemberRole(role)}
										className={`flex-1 rounded-xl border-2 px-4 py-3 ${
											newMemberRole === role
												? "bg-primary border-primary"
												: "bg-muted/10 border-border"
										} `}
									>
										<Text
											className={`text-center font-medium ${
												newMemberRole === role
													? "text-primary-foreground"
													: "text-foreground"
											} `}
										>
											{role}
										</Text>
									</Pressable>
								))}
							</View>
						</View>

						<View className="mt-auto gap-3">
							<Text className="text-muted-foreground text-center text-xs">
								If they don't have a SiteLink account, an invitation email will be sent.
							</Text>
							<Button onPress={handleAddMember} className="h-12">
								<Icon
									as={newMemberEmail && !allUsers?.find((u: any) => u.email?.toLowerCase() === newMemberEmail.toLowerCase()) ? Mail : UserPlus}
									className="text-primary-foreground mr-2 size-5"
								/>
								<Text className="text-primary-foreground text-base font-semibold">
									Add / Invite Member
								</Text>
							</Button>
							<Button
								variant="outline"
								onPress={() => setIsAddModalVisible(false)}
								className="h-12"
							>
								<Text className="text-base font-semibold">Cancel</Text>
							</Button>
						</View>
					</View>
				</View>
			</Modal>
		</View>
	);
}
