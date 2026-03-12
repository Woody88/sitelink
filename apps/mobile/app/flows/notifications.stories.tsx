import type { Meta, StoryObj } from "@storybook/react";
import {
	AlertTriangle,
	Camera,
	CheckCircle,
	ChevronLeft,
	Crosshair,
	Grid3X3,
	Info,
	Loader,
	MapPin,
	Maximize,
	ZoomIn,
	ZoomOut,
} from "lucide-react-native";
import * as React from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import { StoryHeader, StoryToast } from "@/app/_story-components";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

const NOTIFICATIONS = [
	{ id: "1", title: "Plan Processing Complete", body: "Riverside Apartments plans are ready to view.", time: "2h ago", type: "success" as const },
	{ id: "2", title: "New Issue Flagged", body: "Mike flagged an issue at 5/A7.", time: "5h ago", type: "alert" as const },
	{ id: "3", title: "Trial Ending Soon", body: "Your Pro trial ends in 3 days.", time: "2 days ago", type: "info" as const },
	{ id: "4", title: "Sheet Updated", body: "Floor 2 Electrical has been updated.", time: "3 days ago", type: "info" as const },
	{ id: "5", title: "New Team Member", body: "Sarah Johnson accepted your invitation.", time: "4 days ago", type: "success" as const },
	{ id: "6", title: "RFI Response Received", body: "Thompson Structural responded to RFI-2026-0045.", time: "5 days ago", type: "info" as const },
];

const ICON_MAP = { success: CheckCircle, alert: AlertTriangle, info: Info };
const COLOR_MAP = { success: "text-green-500", alert: "text-amber-500", info: "text-blue-500" };

type FlowScreen = "list" | "detail" | "navigating-plan" | "plan-destination" | "navigating-photos" | "photo-destination";

function NavigatingScreen({ label, onArrived }: { label: string; onArrived: () => void }) {
	React.useEffect(() => {
		const timer = setTimeout(onArrived, 1500);
		return () => clearTimeout(timer);
	}, [onArrived]);

	return (
		<View className="bg-background flex-1 items-center justify-center" style={{ minHeight: "100vh" } as any}>
			<View className="items-center gap-4">
				<Icon as={Loader} className="text-primary size-8" />
				<Text className="text-foreground text-lg font-bold">Navigating...</Text>
				<Text className="text-muted-foreground text-sm">{label}</Text>
			</View>
		</View>
	);
}

function PlanDestinationScreen({ onBack }: { onBack: () => void }) {
	const markers = [
		{ id: "m1", label: "5/A7", top: "48%", left: "12%", color: "#22c55e" },
		{ id: "m2", label: "3/A2", top: "56%", left: "25%", color: "#3b82f6" },
	];

	return (
		<View style={{ flex: 1, position: "relative", backgroundColor: "#0a0a0a", minHeight: "100vh" } as any}>
			<Image source={{ uri: "/plan-sample.png" }} style={{ width: "100%", height: "100%", position: "absolute" }} resizeMode="contain" />

			{markers.map((marker) => (
				<View
					key={marker.id}
					style={{ position: "absolute", top: marker.top as any, left: marker.left as any, zIndex: 5 }}
				>
					<View style={{ borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: marker.color + "26", borderWidth: 1.5, borderColor: marker.color }}>
						<Text style={{ color: marker.color, fontSize: 12, fontWeight: "700" }}>{marker.label}</Text>
					</View>
				</View>
			))}

			<View style={{ position: "absolute", top: 52, left: 12, zIndex: 20 }}>
				<Pressable
					onPress={onBack}
					className="flex-row items-center"
					style={{ backgroundColor: "rgba(0,0,0,0.72)", borderRadius: 18, height: 36, gap: 8, paddingHorizontal: 14 }}
				>
					<Icon as={ChevronLeft} style={{ color: "#ffffff" }} className="size-4" />
					<Text style={{ color: "#ebebeb", fontSize: 13, fontWeight: "600" }}>S1.0 · Foundation Plan</Text>
				</Pressable>
			</View>

			<View style={{ position: "absolute", top: 120, right: 12, zIndex: 20, backgroundColor: "rgba(0,0,0,0.72)", borderRadius: 24, padding: 4, gap: 2, width: 44 }}>
				{([ZoomIn, ZoomOut, Maximize, Crosshair, Grid3X3] as const).map((IconComp, i) => (
					<Pressable key={i} className="items-center justify-center" style={{ width: 36, height: 44, borderRadius: 22 }}>
						<Icon as={IconComp} className="size-5 text-white" />
					</Pressable>
				))}
			</View>

			<View style={{ position: "absolute", top: 52, right: 12, zIndex: 20 }}>
				<View className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5" style={{ backgroundColor: "rgba(34,197,94,0.15)", borderWidth: 1, borderColor: "rgba(34,197,94,0.3)" }}>
					<Icon as={CheckCircle} style={{ color: "#22c55e" }} className="size-3.5" />
					<Text style={{ color: "#22c55e", fontSize: 12, fontWeight: "700" }}>From notification</Text>
				</View>
			</View>

			<View style={{ position: "absolute", bottom: 24, left: 12, right: 12, zIndex: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
				<View className="flex-row items-center" style={{ backgroundColor: "rgba(0,0,0,0.72)", borderRadius: 18, height: 36, gap: 6, paddingHorizontal: 14 }}>
					<Icon as={MapPin} style={{ color: "#ebebeb" }} className="size-3.5" />
					<Text style={{ color: "#ebebeb", fontSize: 13, fontWeight: "600" }}>S1.0</Text>
					<Text style={{ color: "#ebebeb", fontSize: 13, fontWeight: "400" }}>Foundation Plan</Text>
				</View>
			</View>
		</View>
	);
}

function PhotoTimelineDestination({ onBack }: { onBack: () => void }) {
	const photos = [
		{ id: "p1", time: "2:34 PM", label: "Foundation pour — Grid A7" },
		{ id: "p2", time: "2:31 PM", label: "Rebar at junction box" },
		{ id: "p3", time: "1:55 PM", label: "Slab S2 — North side" },
		{ id: "p4", time: "11:20 AM", label: "Column C4 formwork" },
	];

	return (
		<View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
			<StoryHeader title="Photo Timeline" onBack={onBack} />
			<View className="flex-row items-center gap-2 px-4 pt-3 pb-1">
				<Icon as={CheckCircle} style={{ color: "#22c55e" }} className="size-4" />
				<Text style={{ color: "#22c55e", fontSize: 12, fontWeight: "600" }}>Opened from notification</Text>
			</View>
			<ScrollView className="flex-1" contentContainerClassName="px-4 pt-4 gap-3">
				<Text className="text-muted-foreground text-xs font-bold tracking-wider uppercase">Today</Text>
				{photos.map((photo) => (
					<View key={photo.id} className="flex-row items-center gap-3 py-3">
						<View
							className="items-center justify-center rounded-xl"
							style={{ width: 64, height: 64, backgroundColor: "rgba(255,255,255,0.06)" }}
						>
							<Icon as={Camera} className="text-muted-foreground size-6" />
						</View>
						<View className="flex-1">
							<Text className="text-foreground text-base font-medium">{photo.label}</Text>
							<Text className="text-muted-foreground text-sm">{photo.time}</Text>
						</View>
					</View>
				))}
			</ScrollView>
		</View>
	);
}

function NotificationsFlow({ initialScreen = "list" as FlowScreen }: { initialScreen?: FlowScreen }) {
	const [screen, setScreen] = React.useState<FlowScreen>(initialScreen);
	const [readIds, setReadIds] = React.useState<Set<string>>(new Set(["3", "4", "5", "6"]));
	const [selectedId, setSelectedId] = React.useState<string | null>(initialScreen === "detail" ? "1" : null);

	const hasUnread = NOTIFICATIONS.some((n) => !readIds.has(n.id));
	const selected = selectedId ? NOTIFICATIONS.find((n) => n.id === selectedId) : null;

	if (screen === "navigating-plan") {
		return (
			<NavigatingScreen
				label="Opening Riverside Apartments plans..."
				onArrived={() => setScreen("plan-destination")}
			/>
		);
	}

	if (screen === "plan-destination") {
		return <PlanDestinationScreen onBack={() => setScreen("list")} />;
	}

	if (screen === "navigating-photos") {
		return (
			<NavigatingScreen
				label="Opening Photo Timeline..."
				onArrived={() => setScreen("photo-destination")}
			/>
		);
	}

	if (screen === "photo-destination") {
		return <PhotoTimelineDestination onBack={() => setScreen("list")} />;
	}

	if (screen === "detail" && selected) {
		return (
			<View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
				<StoryHeader title="Notification" onBack={() => setScreen("list")} />
				<View className="flex-1 px-4 pt-6">
					<View className="items-center gap-4">
						<View className="bg-muted/20 size-16 items-center justify-center rounded-full">
							<Icon as={ICON_MAP[selected.type]} className={cn("size-8", COLOR_MAP[selected.type])} />
						</View>
						<Text className="text-foreground text-xl font-bold">{selected.title}</Text>
						<Text className="text-muted-foreground text-center text-sm leading-relaxed">{selected.body}</Text>
						<Text className="text-muted-foreground text-xs">{selected.time}</Text>
					</View>
				</View>
			</View>
		);
	}

	return (
		<View className="bg-background" style={{ minHeight: "100vh" } as any}>
			<StoryHeader title="Notifications" />

			<View className="border-border/50 border-b">
				<View className="flex-row items-center justify-between px-4 py-3">
					<View className="flex-row items-center gap-2">
						<Text className="text-foreground text-sm font-semibold">All</Text>
						{hasUnread && (
							<View className="size-5 items-center justify-center rounded-full bg-blue-500">
								<Text className="text-[10px] font-bold text-white">{NOTIFICATIONS.filter((n) => !readIds.has(n.id)).length}</Text>
							</View>
						)}
					</View>
					{hasUnread && (
						<Pressable onPress={() => setReadIds(new Set(NOTIFICATIONS.map((n) => n.id)))}>
							<Text className="text-primary text-xs font-semibold">Mark All Read</Text>
						</Pressable>
					)}
				</View>
			</View>

			<ScrollView className="flex-1">
				{NOTIFICATIONS.map((item) => {
					const isRead = readIds.has(item.id);
					return (
						<Pressable
							key={item.id}
							onPress={() => {
								setReadIds((prev) => new Set([...prev, item.id]));
								if (item.id === "1") {
									setScreen("navigating-plan");
									return;
								}
								if (item.id === "4") {
									setScreen("navigating-photos");
									return;
								}
								setSelectedId(item.id);
								setScreen("detail");
							}}
							className="active:bg-muted/30 flex-row gap-4 px-4 py-4"
						>
							{!isRead && (
								<View className="absolute top-0 bottom-0 left-0" style={{ width: 3, backgroundColor: "#3b82f6", borderTopRightRadius: 2, borderBottomRightRadius: 2 }} />
							)}
							<View className="bg-muted/20 size-8 items-center justify-center rounded-full">
								<Icon as={ICON_MAP[item.type]} className={cn("size-4", COLOR_MAP[item.type])} />
							</View>
							<View className="flex-1 gap-0.5">
								<View className="flex-row items-start justify-between">
									<Text className={cn("flex-1 pr-2 text-base leading-tight", isRead ? "font-medium" : "font-bold")}>{item.title}</Text>
									<Text className="text-muted-foreground mt-0.5 text-xs">{item.time}</Text>
								</View>
								<Text className={cn("text-sm leading-snug", isRead ? "text-muted-foreground/60" : "text-muted-foreground")}>{item.body}</Text>
							</View>
						</Pressable>
					);
				})}
			</ScrollView>
		</View>
	);
}

const meta: Meta<typeof NotificationsFlow> = {
	title: "Flows/10. Notifications",
	component: NotificationsFlow,
	parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof NotificationsFlow>;

export const NotificationList: Story = { name: "1. Notification List", args: { initialScreen: "list" } };
export const NotificationDetail: Story = { name: "2. Notification Detail", args: { initialScreen: "detail" } };
export const DeepLinkToPlan: Story = { name: "3. Deep Link to Plan", args: { initialScreen: "navigating-plan" } };
export const DeepLinkToPhotos: Story = { name: "4. Deep Link to Photos", args: { initialScreen: "navigating-photos" } };
export const FullFlow: Story = { name: "Full Flow", args: { initialScreen: "list" } };
