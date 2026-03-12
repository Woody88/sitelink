import type { Meta, StoryObj } from "@storybook/react";
import {
	ArrowLeft,
	ChevronRight,
	Plus,
	Search,
	UserPlus,
	Users,
	X,
} from "lucide-react-native";
import * as React from "react";
import { Pressable, ScrollView, View } from "react-native";
import { StoryHeader, StoryToast } from "@/app/_story-components";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

const STORY_MEMBERS = [
	{ id: "1", name: "John Smith", email: "john@sitelink.com", role: "Owner", status: "active" as const },
	{ id: "2", name: "Mike Chen", email: "mike@sitelink.com", role: "Admin", status: "active" as const },
	{ id: "3", name: "Sarah Johnson", email: "sarah@sitelink.com", role: "Member", status: "active" as const },
	{ id: "4", name: "David Lee", email: "david@sitelink.com", role: "Member", status: "active" as const },
	{ id: "5", name: "Emily Brown", email: "emily@sitelink.com", role: "Viewer", status: "active" as const },
];

type FlowScreen = "settings" | "members" | "invite" | "pending";

function TeamManagementFlow({ initialScreen = "settings" as FlowScreen }: { initialScreen?: FlowScreen }) {
	const [screen, setScreen] = React.useState<FlowScreen>(initialScreen);
	const [searchQuery, setSearchQuery] = React.useState("");
	const [showAddModal, setShowAddModal] = React.useState(initialScreen === "invite");
	const [newEmail, setNewEmail] = React.useState("");
	const [newRole, setNewRole] = React.useState<"Admin" | "Member" | "Viewer">("Member");
	const [pendingMembers, setPendingMembers] = React.useState<{ email: string; role: string }[]>([]);
	const [toastMsg, setToastMsg] = React.useState("");

	const filteredMembers = React.useMemo(() => {
		if (!searchQuery) return STORY_MEMBERS;
		return STORY_MEMBERS.filter((m) => m.name.toLowerCase().includes(searchQuery.toLowerCase()) || m.email.toLowerCase().includes(searchQuery.toLowerCase()));
	}, [searchQuery]);

	if (screen === "settings") {
		return (
			<View className="bg-background" style={{ minHeight: "100vh" } as any}>
				<StoryHeader title="Project Settings" />
				<ScrollView className="flex-1" contentContainerClassName="pb-12" showsVerticalScrollIndicator={false}>
					<View className="px-4 pt-6">
						<Text className="text-muted-foreground mb-3 text-sm font-semibold tracking-wider uppercase">Team</Text>
						<View className="bg-card border-border/50 overflow-hidden rounded-2xl border">
							<Pressable onPress={() => setScreen("members")} className="active:bg-muted/30 flex-row items-center justify-between px-4 py-4">
								<View className="flex-row items-center gap-3">
									<View className="bg-muted size-8 items-center justify-center rounded-full">
										<Icon as={Users} className="text-foreground size-4" />
									</View>
									<View>
										<Text className="text-foreground text-base font-medium">Team Members</Text>
										<Text className="text-muted-foreground text-sm">{STORY_MEMBERS.length} members</Text>
									</View>
								</View>
								<Icon as={ChevronRight} className="text-muted-foreground size-5" />
							</Pressable>
						</View>
					</View>
				</ScrollView>
			</View>
		);
	}

	return (
		<View className="bg-background" style={{ minHeight: "100vh", position: "relative" } as any}>
			<View className="bg-background" style={{ paddingTop: 8 }}>
				<View className="min-h-[56px] flex-row items-center justify-between px-4">
					<Pressable onPress={() => setScreen("settings")} className="-ml-1 items-center justify-center" style={{ width: 44, height: 44 }}>
						<Icon as={ArrowLeft} className="text-foreground size-6" />
					</Pressable>
					<Text className="text-foreground text-base font-bold">Project Members</Text>
					<Pressable onPress={() => setShowAddModal(true)} className="-mr-1 items-center justify-center" style={{ width: 44, height: 44 }}>
						<Icon as={Plus} className="text-primary size-6" />
					</Pressable>
				</View>
			</View>

			<View className="border-border border-b px-4 py-2">
				<View className="bg-muted/40 flex-row items-center rounded-xl px-3" style={{ height: 40 }}>
					<Icon as={Search} className="text-muted-foreground mr-2 size-4" />
					<Input placeholder="Search members..." value={searchQuery} onChangeText={setSearchQuery} className="h-10 flex-1 border-transparent bg-transparent" />
				</View>
			</View>

			<ScrollView className="flex-1" contentContainerClassName="p-4 gap-3">
				{filteredMembers.map((member) => (
					<View key={member.id} className="bg-card border-border/50 flex-row items-center justify-between rounded-2xl border p-4">
						<View className="flex-row items-center gap-3">
							<View className="bg-secondary size-10 items-center justify-center rounded-full">
								<Text className="text-secondary-foreground font-semibold">{member.name.split(" ").map((n) => n[0]).join("")}</Text>
							</View>
							<View>
								<Text className="text-foreground font-medium">{member.name}</Text>
								<Text className="text-muted-foreground text-sm">{member.email}</Text>
							</View>
						</View>
						<Badge variant={member.role === "Owner" ? "default" : "outline"}>
							<Text className={member.role === "Owner" ? "text-primary-foreground" : "text-foreground"}>{member.role}</Text>
						</Badge>
					</View>
				))}
				{pendingMembers.map((pm, i) => (
					<View key={`pending-${i}`} className="bg-card border-border/50 flex-row items-center justify-between rounded-2xl border p-4 opacity-70">
						<View className="flex-row items-center gap-3">
							<View className="bg-muted size-10 items-center justify-center rounded-full">
								<Icon as={UserPlus} className="text-muted-foreground size-4" />
							</View>
							<View>
								<Text className="text-foreground font-medium">{pm.email}</Text>
								<Text className="text-muted-foreground text-sm">Invitation pending</Text>
							</View>
						</View>
						<Badge variant="outline"><Text className="text-foreground">{pm.role}</Text></Badge>
					</View>
				))}
			</ScrollView>

			{showAddModal && (
				<View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 100 }}>
					<Pressable onPress={() => setShowAddModal(false)} style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.5)" }} />
					<View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#1c1c1c", borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
						<View className="items-center py-3"><View className="bg-muted-foreground/30 h-1 w-10 rounded-full" /></View>
						<View className="flex-row items-center justify-between px-6 pb-3">
							<Text className="text-foreground text-lg font-bold">Add Team Member</Text>
							<Pressable onPress={() => setShowAddModal(false)} className="bg-muted/20 active:bg-muted/40 size-8 items-center justify-center rounded-full">
								<Icon as={X} className="text-foreground size-5" />
							</Pressable>
						</View>
						<View className="gap-6 px-6 pb-8">
							<View className="gap-2">
								<Text className="text-foreground text-sm font-medium">Email Address</Text>
								<Input placeholder="member@example.com" value={newEmail} onChangeText={setNewEmail} className="h-12 rounded-xl" />
							</View>
							<View className="gap-2">
								<Text className="text-foreground text-sm font-medium">Role</Text>
								<View className="flex-row gap-2">
									{(["Admin", "Member", "Viewer"] as const).map((role) => (
										<Pressable key={role} onPress={() => setNewRole(role)} className={cn("flex-1 rounded-xl border-2 px-4 py-3", newRole === role ? "bg-primary border-primary" : "bg-muted/10 border-border")}>
											<Text className={cn("text-center font-medium", newRole === role ? "text-primary-foreground" : "text-foreground")}>{role}</Text>
										</Pressable>
									))}
								</View>
							</View>
							<Button onPress={() => {
								if (newEmail.trim()) {
									setPendingMembers((prev) => [...prev, { email: newEmail, role: newRole }]);
									setToastMsg(`Invitation sent to ${newEmail}`);
								}
								setNewEmail("");
								setNewRole("Member");
								setShowAddModal(false);
							}} className="h-12 rounded-xl">
								<Icon as={UserPlus} className="text-primary-foreground mr-2 size-5" />
								<Text className="text-primary-foreground text-base font-semibold">Send Invitation</Text>
							</Button>
						</View>
					</View>
				</View>
			)}
			<StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
		</View>
	);
}

const meta: Meta<typeof TeamManagementFlow> = {
	title: "Flows/9. Team Management",
	component: TeamManagementFlow,
	parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof TeamManagementFlow>;

export const ProjectSettings: Story = { name: "1. Project Settings", args: { initialScreen: "settings" } };
export const MembersList: Story = { name: "2. Members List", args: { initialScreen: "members" } };
export const InviteMember: Story = { name: "3. Invite Member", args: { initialScreen: "invite" } };
export const FullFlow: Story = { name: "Full Flow", args: { initialScreen: "settings" } };
