import type { Meta, StoryObj } from "@storybook/react";
import {
	Camera,
	Info,
	Plus,
	Shield,
	UserPlus,
} from "lucide-react-native";
import * as React from "react";
import { Pressable, View } from "react-native";
import { StoryHeader } from "@/app/_story-components";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

function DisabledActionRow({
	icon,
	label,
	tooltip,
}: {
	icon: React.ComponentType<any>;
	label: string;
	tooltip: string;
}) {
	const [showTooltip, setShowTooltip] = React.useState(false);

	return (
		<View className="gap-2">
			<Pressable
				onPress={() => setShowTooltip((s) => !s)}
				className="flex-row items-center gap-3 rounded-xl px-4 py-4 opacity-40"
				style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
			>
				<View
					className="items-center justify-center rounded-full"
					style={{ width: 44, height: 44, backgroundColor: "rgba(255,255,255,0.06)" }}
				>
					<Icon as={icon} className="text-muted-foreground size-5" />
				</View>
				<Text className="text-muted-foreground flex-1 text-base font-medium">{label}</Text>
				<Icon as={Info} className="text-muted-foreground size-4" />
			</Pressable>
			{showTooltip && (
				<View className="ml-4 rounded-lg px-4 py-2.5" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
					<Text className="text-muted-foreground text-sm">{tooltip}</Text>
				</View>
			)}
		</View>
	);
}

function EnabledActionRow({
	icon,
	label,
	color,
	onPress,
}: {
	icon: React.ComponentType<any>;
	label: string;
	color: string;
	onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			className="flex-row items-center gap-3 rounded-xl px-4 py-4 active:opacity-80"
			style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
		>
			<View
				className="items-center justify-center rounded-full"
				style={{ width: 44, height: 44, backgroundColor: color + "15" }}
			>
				<Icon as={icon} className="size-5" style={{ color }} />
			</View>
			<Text className="text-foreground flex-1 text-base font-medium">{label}</Text>
		</Pressable>
	);
}

function ViewerNoPhotosScreen() {
	return (
		<View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
			<StoryHeader title="Holabird Ave Warehouse" />
			<View className="px-4 pt-6 gap-6">
				<View className="flex-row items-center gap-2 rounded-xl px-4 py-2.5" style={{ backgroundColor: "rgba(59,130,246,0.08)" }}>
					<Icon as={Shield} className="size-4" style={{ color: "#3b82f6" }} />
					<Text className="text-sm font-medium" style={{ color: "#3b82f6" }}>Viewer Role</Text>
				</View>

				<View className="gap-3">
					<Text className="text-muted-foreground text-xs font-bold tracking-wider uppercase">Actions</Text>
					<DisabledActionRow
						icon={Camera}
						label="Take Photo"
						tooltip="Contact your project admin for access to photo capture."
					/>
					<DisabledActionRow
						icon={Plus}
						label="Add Note"
						tooltip="Contact your project admin for access to add notes."
					/>
				</View>
			</View>
		</View>
	);
}

function ViewerNoInviteScreen() {
	const members = [
		{ initials: "JS", name: "John Smith", role: "Owner" },
		{ initials: "MC", name: "Mike Chen", role: "Admin" },
		{ initials: "EB", name: "Emily Brown", role: "Viewer" },
	];

	return (
		<View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
			<StoryHeader title="Project Members" />
			<View className="px-4 pt-6 gap-6">
				<View className="flex-row items-center gap-2 rounded-xl px-4 py-2.5" style={{ backgroundColor: "rgba(59,130,246,0.08)" }}>
					<Icon as={Shield} className="size-4" style={{ color: "#3b82f6" }} />
					<Text className="text-sm font-medium" style={{ color: "#3b82f6" }}>Viewer Role</Text>
				</View>

				<View className="gap-2">
					{members.map((m) => (
						<View key={m.initials} className="flex-row items-center gap-3 rounded-xl px-4 py-3" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
							<View className="items-center justify-center rounded-full" style={{ width: 40, height: 40, backgroundColor: "rgba(59,130,246,0.12)" }}>
								<Text className="text-sm font-semibold" style={{ color: "#3b82f6" }}>{m.initials}</Text>
							</View>
							<View className="flex-1">
								<Text className="text-foreground text-sm font-medium">{m.name}</Text>
								<Text className="text-muted-foreground text-xs">{m.role}</Text>
							</View>
						</View>
					))}
				</View>

				<DisabledActionRow
					icon={UserPlus}
					label="Invite Member"
					tooltip="Contact your project admin for access to invite team members."
				/>
			</View>
		</View>
	);
}

function AdminFullAccessScreen() {
	return (
		<View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
			<StoryHeader title="Holabird Ave Warehouse" />
			<View className="px-4 pt-6 gap-6">
				<View className="flex-row items-center gap-2 rounded-xl px-4 py-2.5" style={{ backgroundColor: "rgba(34,197,94,0.08)" }}>
					<Icon as={Shield} className="size-4" style={{ color: "#22c55e" }} />
					<Text className="text-sm font-medium" style={{ color: "#22c55e" }}>Admin Role</Text>
				</View>

				<View className="gap-3">
					<Text className="text-muted-foreground text-xs font-bold tracking-wider uppercase">Actions</Text>
					<EnabledActionRow icon={Camera} label="Take Photo" color="#22c55e" onPress={() => {}} />
					<EnabledActionRow icon={Plus} label="Add Note" color="#3b82f6" onPress={() => {}} />
					<EnabledActionRow icon={UserPlus} label="Invite Member" color="#a855f7" onPress={() => {}} />
				</View>
			</View>
		</View>
	);
}

type ScreenType = "viewer-no-photos" | "viewer-no-invite" | "admin-full";

function PermissionStatesFlow({ screen = "viewer-no-photos" as ScreenType }: { screen?: ScreenType }) {
	switch (screen) {
		case "viewer-no-photos":
			return <ViewerNoPhotosScreen />;
		case "viewer-no-invite":
			return <ViewerNoInviteScreen />;
		case "admin-full":
			return <AdminFullAccessScreen />;
	}
}

const meta: Meta<typeof PermissionStatesFlow> = {
	title: "Flows/Permission States",
	component: PermissionStatesFlow,
	parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof PermissionStatesFlow>;

export const ViewerNoPhotos: Story = { name: "1. Viewer - No Photos", args: { screen: "viewer-no-photos" } };
export const ViewerNoInvite: Story = { name: "2. Viewer - No Invite", args: { screen: "viewer-no-invite" } };
export const AdminFullAccess: Story = { name: "3. Admin - Full Access", args: { screen: "admin-full" } };
