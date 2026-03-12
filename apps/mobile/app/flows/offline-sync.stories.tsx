import type { Meta, StoryObj } from "@storybook/react";
import {
	Camera,
	Check,
	CheckCircle,
	ChevronLeft,
	Clock,
	Cloud,
	CloudOff,
	Crosshair,
	Grid3X3,
	MapPin,
	Maximize,
	Mic,
	AlertTriangle,
	Copy,
	RefreshCw,
	Upload,
	Wifi,
	WifiOff,
	X,
	Zap,
	ZoomIn,
	ZoomOut,
} from "lucide-react-native";
import * as React from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import { StoryToast } from "@/app/_story-components";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

type FlowPhase = "online" | "offline-browsing" | "offline-capture" | "sync-queue" | "syncing" | "sync-complete" | "conflict";

interface QueueItem {
	id: string;
	type: "photo" | "voice";
	label: string;
	timestamp: string;
	size: string;
	thumbnail: string;
	status: "pending" | "uploading" | "done";
}

const MOCK_QUEUE: QueueItem[] = [
	{ id: "q1", type: "photo", label: "Foundation pour — Grid A7", timestamp: "2:34 PM", size: "4.2 MB", thumbnail: "https://picsum.photos/seed/construct11/200/200", status: "pending" },
	{ id: "q2", type: "photo", label: "Rebar at junction box", timestamp: "2:31 PM", size: "3.8 MB", thumbnail: "https://picsum.photos/seed/construct22/200/200", status: "pending" },
	{ id: "q3", type: "photo", label: "Slab S2 — North side", timestamp: "1:55 PM", size: "5.1 MB", thumbnail: "https://picsum.photos/seed/construct33/200/200", status: "pending" },
	{ id: "q4", type: "voice", label: "Note: Missing anchor bolts at F2", timestamp: "1:48 PM", size: "0.3 MB", thumbnail: "", status: "pending" },
];

const MOCK_MARKERS = [
	{ id: "m1", label: "5/A7", top: "48%", left: "12%", color: "#22c55e" },
	{ id: "m2", label: "3/A2", top: "56%", left: "25%", color: "#3b82f6" },
	{ id: "m3", label: "2/A1", top: "38%", left: "42%", color: "#22c55e" },
	{ id: "m4", label: "E1", top: "32%", left: "68%", color: "#f59e0b" },
];

function ConnectionBadge({ isOnline }: { isOnline: boolean }) {
	return (
		<View
			className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
			style={{
				backgroundColor: isOnline ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.15)",
				borderWidth: 1,
				borderColor: isOnline ? "rgba(34,197,94,0.3)" : "rgba(245,158,11,0.3)",
			}}
		>
			<Icon as={isOnline ? Wifi : WifiOff} style={{ color: isOnline ? "#22c55e" : "#f59e0b" }} className="size-3.5" />
			<Text style={{ color: isOnline ? "#22c55e" : "#f59e0b", fontSize: 12, fontWeight: "700" }}>
				{isOnline ? "Online" : "Offline"}
			</Text>
		</View>
	);
}

function SyncIndicator({ count }: { count?: number }) {
	if (!count) {
		return (
			<View className="flex-row items-center gap-1 rounded-full px-2.5 py-1" style={{ backgroundColor: "rgba(34,197,94,0.1)" }}>
				<Icon as={Cloud} style={{ color: "#22c55e" }} className="size-3" />
				<Text style={{ color: "#22c55e", fontSize: 10, fontWeight: "600" }}>Synced</Text>
			</View>
		);
	}
	return (
		<View className="flex-row items-center gap-1 rounded-full px-2.5 py-1" style={{ backgroundColor: "rgba(245,158,11,0.15)" }}>
			<Icon as={CloudOff} style={{ color: "#f59e0b" }} className="size-3" />
			<Text style={{ color: "#f59e0b", fontSize: 10, fontWeight: "600" }}>{count} pending</Text>
		</View>
	);
}

function PlanViewerScreen({ isOnline, pendingCount, onOpenQueue }: { isOnline: boolean; pendingCount?: number; onOpenQueue?: () => void }) {
	return (
		<View style={{ flex: 1, position: "relative", backgroundColor: "#0a0a0a" }}>
			<Image source={{ uri: "/plan-sample.png" }} style={{ width: "100%", height: "100%", position: "absolute" }} resizeMode="contain" />

			{MOCK_MARKERS.map((marker) => (
				<View
					key={marker.id}
					style={{
						position: "absolute",
						top: marker.top as any,
						left: marker.left as any,
						zIndex: 5,
					}}
				>
					<View style={{ borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: marker.color + "26", borderWidth: 1.5, borderColor: marker.color }}>
						<Text style={{ color: marker.color, fontSize: 12, fontWeight: "700" }}>{marker.label}</Text>
					</View>
				</View>
			))}

			{/* Nav pill - top left */}
			<View style={{ position: "absolute", top: 52, left: 12, zIndex: 20 }}>
				<Pressable
					className="flex-row items-center"
					style={{ backgroundColor: "rgba(0,0,0,0.72)", borderRadius: 18, height: 36, gap: 8, paddingHorizontal: 14 }}
				>
					<Icon as={ChevronLeft} style={{ color: "#ffffff" }} className="size-4" />
					<Text style={{ color: "#ebebeb", fontSize: 13, fontWeight: "600" }}>S1.0 · Foundation Plan</Text>
				</Pressable>
			</View>

			{/* Connection + sync indicators - top right */}
			<View style={{ position: "absolute", top: 52, right: 12, zIndex: 20, flexDirection: "row", gap: 8, alignItems: "center" }}>
				<SyncIndicator count={pendingCount} />
				<ConnectionBadge isOnline={isOnline} />
			</View>

			{/* Vertical glass toolbar - matches plan-navigation */}
			<View style={{ position: "absolute", top: 120, right: 12, zIndex: 20, backgroundColor: "rgba(0,0,0,0.72)", borderRadius: 24, padding: 4, gap: 2, width: 44 }}>
				{([ZoomIn, ZoomOut, Maximize, Crosshair, Grid3X3] as const).map((IconComp, i) => (
					<Pressable key={i} className="items-center justify-center" style={{ width: 36, height: 44, borderRadius: 22 }}>
						<Icon as={IconComp} className="size-5 text-white" />
					</Pressable>
				))}
			</View>

			{/* Offline banner */}
			{!isOnline && (
				<View style={{ position: "absolute", top: 100, left: 12, right: 60, zIndex: 15 }}>
					<View className="flex-row items-center gap-2.5 rounded-xl px-4 py-2.5" style={{ backgroundColor: "rgba(245,158,11,0.12)", borderWidth: 1, borderColor: "rgba(245,158,11,0.2)" }}>
						<Icon as={WifiOff} style={{ color: "#f59e0b" }} className="size-4" />
						<Text style={{ color: "#f59e0b", fontSize: 12, fontWeight: "600" }}>Offline — cached sheets, AI paused</Text>
					</View>
				</View>
			)}

			{/* Bottom pills */}
			<View style={{ position: "absolute", bottom: 24, left: 12, right: 12, zIndex: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
				<View className="flex-row items-center" style={{ backgroundColor: "rgba(0,0,0,0.72)", borderRadius: 18, height: 36, gap: 6, paddingHorizontal: 14 }}>
					<Icon as={MapPin} style={{ color: "#ebebeb" }} className="size-3.5" />
					<Text style={{ color: "#ebebeb", fontSize: 13, fontWeight: "600" }}>S1.0</Text>
					<Text style={{ color: "#ebebeb", fontSize: 13, fontWeight: "400" }}>Foundation Plan</Text>
				</View>
				{pendingCount && pendingCount > 0 ? (
					<Pressable
						onPress={onOpenQueue}
						className="flex-row items-center"
						style={{ backgroundColor: "rgba(245,158,11,0.2)", borderRadius: 18, height: 36, gap: 6, paddingHorizontal: 14 }}
					>
						<Icon as={Upload} style={{ color: "#f59e0b" }} className="size-3.5" />
						<Text style={{ color: "#f59e0b", fontSize: 13, fontWeight: "600" }}>{pendingCount} queued</Text>
					</Pressable>
				) : (
					<View className="flex-row items-center" style={{ backgroundColor: "rgba(0,0,0,0.72)", borderRadius: 18, height: 36, gap: 6, paddingHorizontal: 14 }}>
						<Icon as={MapPin} className="text-primary size-3.5" />
						<Text style={{ color: "#ebebeb", fontSize: 13, fontWeight: "600" }}>4</Text>
					</View>
				)}
			</View>
		</View>
	);
}

function OfflineCaptureScreen({ onCapture }: { onCapture?: () => void }) {
	const [captured, setCaptured] = React.useState(false);

	return (
		<View style={{ flex: 1, position: "relative" }}>
			<Image source={{ uri: "https://picsum.photos/seed/constructsite7/1080/1920" }} style={{ width: "100%", height: "100%", position: "absolute" }} resizeMode="cover" />

			<View style={{ position: "absolute", top: 44, left: 0, right: 0, zIndex: 20, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 8 }}>
				<Pressable className="items-center justify-center rounded-full" style={{ width: 48, height: 48, backgroundColor: "rgba(0,0,0,0.4)" }}>
					<Icon as={X} className="size-5 text-white" />
				</Pressable>
				<View style={{ flex: 1 }} />
				<ConnectionBadge isOnline={false} />
			</View>

			{captured && (
				<View style={{ position: "absolute", top: 110, left: 16, right: 16, zIndex: 25 }}>
					<View className="flex-row items-center gap-3 rounded-xl px-4 py-3" style={{ backgroundColor: "rgba(245,158,11,0.15)", borderWidth: 1, borderColor: "rgba(245,158,11,0.25)" }}>
						<View className="items-center justify-center rounded-full" style={{ width: 32, height: 32, backgroundColor: "rgba(245,158,11,0.2)" }}>
							<Icon as={Clock} style={{ color: "#f59e0b" }} className="size-4" />
						</View>
						<View className="flex-1">
							<Text style={{ color: "#f59e0b", fontSize: 14, fontWeight: "700" }}>Queued for upload</Text>
							<Text style={{ color: "rgba(245,158,11,0.7)", fontSize: 12 }}>Will sync when back online</Text>
						</View>
						<SyncIndicator count={2} />
					</View>
				</View>
			)}

			<View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 212, backgroundColor: "rgba(0,0,0,0.52)", zIndex: 10 }} />

			<View style={{ position: "absolute", bottom: 126, left: 34, zIndex: 15 }}>
				<View style={{ width: 60, height: 60, borderRadius: 30, overflow: "hidden", backgroundColor: "#333" }}>
					<Image source={{ uri: "https://picsum.photos/seed/construct99/200/200" }} style={{ width: 60, height: 60 }} />
				</View>
				<View style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(245,158,11,0.9)", alignItems: "center", justifyContent: "center" }}>
					<Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>2</Text>
				</View>
			</View>

			<View style={{ position: "absolute", bottom: 104, left: 0, right: 0, zIndex: 15, alignItems: "center" }}>
				<Pressable onPress={() => { setCaptured(true); onCapture?.(); }}>
					<View className="items-center justify-center rounded-full" style={{ width: 88, height: 88, borderWidth: 3, borderColor: "#ffffff" }}>
						<View className="rounded-full" style={{ width: 74, height: 74, backgroundColor: "#ffffff" }} />
					</View>
				</Pressable>
			</View>

			<View style={{ position: "absolute", bottom: 44, left: 0, right: 0, zIndex: 15, alignItems: "center" }}>
				<Text style={{ color: "#ebebeb", fontSize: 13, fontWeight: "700" }}>PHOTO</Text>
			</View>
		</View>
	);
}

function SyncQueueSheet({ items, isSyncing, syncProgress, onClose, onSync }: {
	items: QueueItem[];
	isSyncing?: boolean;
	syncProgress?: { current: number; total: number };
	onClose: () => void;
	onSync?: () => void;
}) {
	const totalSize = items.reduce((sum, item) => sum + parseFloat(item.size), 0).toFixed(1);
	const photoCount = items.filter((i) => i.type === "photo").length;
	const voiceCount = items.filter((i) => i.type === "voice").length;
	const doneCount = items.filter((i) => i.status === "done").length;

	const summaryParts: string[] = [];
	if (photoCount > 0) summaryParts.push(`${photoCount} photo${photoCount > 1 ? "s" : ""}`);
	if (voiceCount > 0) summaryParts.push(`${voiceCount} voice note${voiceCount > 1 ? "s" : ""}`);

	return (
		<View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 40 }}>
			<Pressable onPress={onClose} style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.5)" }} />
			<View style={{ position: "absolute", bottom: 0, left: 0, right: 0, maxHeight: "80%", backgroundColor: "#1c1c1c", borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
				<View className="items-center py-3"><View className="bg-muted-foreground/30 h-1 w-10 rounded-full" /></View>

				{isSyncing && syncProgress && (
					<View style={{ paddingHorizontal: 24, paddingBottom: 16 }}>
						<View className="flex-row items-center justify-between mb-2">
							<Text style={{ color: "#3b82f6", fontSize: 13, fontWeight: "700" }}>
								Uploading {syncProgress.current} of {syncProgress.total}...
							</Text>
							<Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
								{Math.round((syncProgress.current / syncProgress.total) * 100)}%
							</Text>
						</View>
						<View style={{ height: 4, borderRadius: 2, backgroundColor: "rgba(59,130,246,0.2)" }}>
							<View style={{ height: 4, borderRadius: 2, backgroundColor: "#3b82f6", width: `${(syncProgress.current / syncProgress.total) * 100}%` as any }} />
						</View>
					</View>
				)}

				<View className="flex-row items-center justify-between px-6 pb-3">
					<View>
						<Text className="text-foreground text-lg font-bold">Sync Queue</Text>
						<Text className="text-muted-foreground text-sm">
							{summaryParts.join(", ")} pending upload · {totalSize} MB
						</Text>
					</View>
					<Pressable onPress={onClose} className="bg-muted/20 active:bg-muted/40 size-8 items-center justify-center rounded-full">
						<Icon as={X} className="text-foreground size-5" />
					</Pressable>
				</View>

				<ScrollView className="flex-1" showsVerticalScrollIndicator>
					{items.map((item) => (
						<View key={item.id} className="flex-row items-center gap-3 px-6 py-3" style={{ opacity: item.status === "done" ? 0.5 : 1 }}>
							{item.type === "photo" ? (
								<View style={{ width: 48, height: 48, borderRadius: 10, overflow: "hidden", backgroundColor: "#333" }}>
									<Image source={{ uri: item.thumbnail }} style={{ width: 48, height: 48 }} resizeMode="cover" />
								</View>
							) : (
								<View className="items-center justify-center" style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: "rgba(59,130,246,0.15)" }}>
									<Icon as={Mic} style={{ color: "#3b82f6" }} className="size-5" />
								</View>
							)}
							<View className="flex-1">
								<Text className="text-foreground text-sm font-semibold" numberOfLines={1}>{item.label}</Text>
								<View className="flex-row items-center gap-2 mt-0.5">
									<Text className="text-muted-foreground text-xs">{item.timestamp}</Text>
									<View className="size-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.2)" }} />
									<Text className="text-muted-foreground text-xs">{item.size}</Text>
								</View>
							</View>
							{item.status === "done" ? (
								<View className="items-center justify-center rounded-full" style={{ width: 28, height: 28, backgroundColor: "rgba(34,197,94,0.15)" }}>
									<Icon as={Check} style={{ color: "#22c55e" }} className="size-4" />
								</View>
							) : item.status === "uploading" ? (
								<View className="items-center justify-center rounded-full" style={{ width: 28, height: 28, backgroundColor: "rgba(59,130,246,0.15)" }}>
									<Icon as={Upload} style={{ color: "#3b82f6" }} className="size-4" />
								</View>
							) : (
								<View className="items-center justify-center rounded-full" style={{ width: 28, height: 28, backgroundColor: "rgba(255,255,255,0.08)" }}>
									<Icon as={Clock} style={{ color: "rgba(255,255,255,0.4)" }} className="size-3.5" />
								</View>
							)}
						</View>
					))}
					<View style={{ height: 20 }} />
				</ScrollView>

				{!isSyncing && (
					<View style={{ paddingHorizontal: 24, paddingBottom: 40 }}>
						<Pressable
							onPress={onSync}
							className="bg-primary flex-row items-center justify-center gap-2 rounded-xl py-3.5"
						>
							<Icon as={RefreshCw} className="text-primary-foreground size-4" />
							<Text className="text-primary-foreground text-sm font-bold">Sync Now</Text>
						</Pressable>
					</View>
				)}
			</View>
		</View>
	);
}

function SyncCompleteOverlay({ itemCount, onDismiss }: { itemCount: number; onDismiss: () => void }) {
	React.useEffect(() => {
		const timer = setTimeout(onDismiss, 3000);
		return () => clearTimeout(timer);
	}, [onDismiss]);

	return (
		<View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 40 }}>
			<Pressable onPress={onDismiss} style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.5)" }} />
			<View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#1c1c1c", borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
				<View className="items-center py-3"><View className="bg-muted-foreground/30 h-1 w-10 rounded-full" /></View>
				<View className="items-center px-6 pb-12 pt-4">
					<View className="mb-4 items-center justify-center rounded-full" style={{ width: 72, height: 72, backgroundColor: "rgba(34,197,94,0.15)" }}>
						<Icon as={CheckCircle} style={{ color: "#22c55e" }} className="size-10" />
					</View>
					<Text className="text-foreground text-xl font-bold mb-1">All caught up</Text>
					<Text className="text-muted-foreground text-sm">{itemCount} items synced</Text>
					<View className="mt-6 flex-row items-center gap-2 rounded-full px-4 py-2" style={{ backgroundColor: "rgba(34,197,94,0.1)" }}>
						<Icon as={Cloud} style={{ color: "#22c55e" }} className="size-4" />
						<Text style={{ color: "#22c55e", fontSize: 13, fontWeight: "600" }}>Everything is backed up</Text>
					</View>
				</View>
			</View>
		</View>
	);
}

function ConflictResolutionSheet({ onResolve, onClose }: { onResolve: (choice: string) => void; onClose: () => void }) {
	return (
		<View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 40 }}>
			<Pressable onPress={onClose} style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.78)" }} />
			<View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#1c1c1c", borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
				<View className="items-center py-3">
					<View className="bg-muted-foreground/30 h-1 w-10 rounded-full" />
				</View>

				<View className="px-6 pb-4">
					<View className="mb-4 flex-row items-center gap-3">
						<View className="items-center justify-center rounded-full" style={{ width: 44, height: 44, backgroundColor: "rgba(245,158,11,0.15)" }}>
							<Icon as={AlertTriangle} style={{ color: "#f59e0b" }} className="size-5" />
						</View>
						<View className="flex-1">
							<Text className="text-foreground text-lg font-bold">Conflict Detected</Text>
							<Text className="text-muted-foreground text-sm">1 item needs your attention</Text>
						</View>
						<Pressable onPress={onClose} className="bg-muted/20 active:bg-muted/40 size-8 items-center justify-center rounded-full">
							<Icon as={X} className="text-foreground size-5" />
						</Pressable>
					</View>

					<View className="mb-5 rounded-xl px-4 py-3" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
						<Text className="text-foreground text-sm font-semibold">Foundation pour — Grid A7</Text>
						<Text className="text-muted-foreground mt-1 text-sm leading-relaxed">
							This photo was modified on another device while you were offline. Your version has different annotations.
						</Text>
						<View className="mt-3 flex-row items-center gap-4">
							<View className="flex-1">
								<Text className="text-muted-foreground mb-1 text-xs font-bold tracking-wider uppercase">Your version</Text>
								<Text className="text-foreground text-sm">Edited 2:34 PM today</Text>
							</View>
							<View className="flex-1">
								<Text className="text-muted-foreground mb-1 text-xs font-bold tracking-wider uppercase">Their version</Text>
								<Text className="text-foreground text-sm">Edited 1:15 PM today</Text>
							</View>
						</View>
					</View>

					<View className="gap-2 pb-6">
						<Pressable
							onPress={() => onResolve("mine")}
							className="flex-row items-center justify-center gap-2 rounded-xl py-3.5"
							style={{ backgroundColor: "rgba(59,130,246,0.15)", borderWidth: 1, borderColor: "rgba(59,130,246,0.3)" }}
						>
							<Icon as={Check} style={{ color: "#3b82f6" }} className="size-4" />
							<Text style={{ color: "#3b82f6", fontSize: 15, fontWeight: "700" }}>Keep Mine</Text>
						</Pressable>
						<Pressable
							onPress={() => onResolve("theirs")}
							className="flex-row items-center justify-center gap-2 rounded-xl py-3.5"
							style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
						>
							<Icon as={Cloud} style={{ color: "rgba(255,255,255,0.7)" }} className="size-4" />
							<Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 15, fontWeight: "700" }}>Keep Theirs</Text>
						</Pressable>
						<Pressable
							onPress={() => onResolve("both")}
							className="flex-row items-center justify-center gap-2 rounded-xl py-3.5"
							style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
						>
							<Icon as={Copy} style={{ color: "rgba(255,255,255,0.7)" }} className="size-4" />
							<Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 15, fontWeight: "700" }}>Keep Both</Text>
						</Pressable>
					</View>
				</View>
			</View>
		</View>
	);
}

function OfflineSyncFlow({ initialPhase = "online" as FlowPhase }) {
	const [phase, setPhase] = React.useState<FlowPhase>(initialPhase);
	const [toastMsg, setToastMsg] = React.useState("");
	const [queueItems, setQueueItems] = React.useState<QueueItem[]>(MOCK_QUEUE.map((q) => ({ ...q })));
	const [syncProgress, setSyncProgress] = React.useState({ current: 0, total: 4 });

	React.useEffect(() => {
		if (phase !== "syncing") return;

		const items = MOCK_QUEUE.map((q) => ({ ...q }));
		const total = items.length;
		let current = 0;

		setSyncProgress({ current: 0, total });
		setQueueItems(items);

		const timer = setInterval(() => {
			current++;
			if (current <= total) {
				items[current - 1].status = "done";
				if (current < total) items[current].status = "uploading";
				setQueueItems([...items]);
				setSyncProgress({ current, total });
			}
			if (current >= total) {
				clearInterval(timer);
				setTimeout(() => setPhase("sync-complete"), 600);
			}
		}, 1200);

		items[0].status = "uploading";
		setQueueItems([...items]);

		return () => clearInterval(timer);
	}, [phase]);

	if (phase === "conflict") {
		return (
			<View style={{ minHeight: "100vh", position: "relative", backgroundColor: "#0a0a0a" } as any}>
				<PlanViewerScreen isOnline={true} />
				<ConflictResolutionSheet
					onResolve={(choice) => {
						setToastMsg(
							choice === "mine" ? "Kept your version" :
							choice === "theirs" ? "Kept their version" :
							"Both versions saved"
						);
						setPhase("online");
					}}
					onClose={() => setPhase("online")}
				/>
				<StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
			</View>
		);
	}

	if (phase === "sync-complete") {
		return (
			<View style={{ minHeight: "100vh", position: "relative", backgroundColor: "#0a0a0a" } as any}>
				<PlanViewerScreen isOnline={true} />
				<SyncCompleteOverlay
					itemCount={4}
					onDismiss={() => { setPhase("online"); setToastMsg("Back to browsing"); }}
				/>
				<StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
			</View>
		);
	}

	if (phase === "sync-queue" || phase === "syncing") {
		return (
			<View style={{ minHeight: "100vh", position: "relative", backgroundColor: "#0a0a0a" } as any}>
				<PlanViewerScreen isOnline={phase === "syncing"} pendingCount={phase === "syncing" ? undefined : queueItems.length} />
				<SyncQueueSheet
					items={queueItems}
					isSyncing={phase === "syncing"}
					syncProgress={phase === "syncing" ? syncProgress : undefined}
					onClose={() => setPhase("offline-browsing")}
					onSync={() => setPhase("syncing")}
				/>
				<StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
			</View>
		);
	}

	if (phase === "offline-capture") {
		return (
			<View style={{ minHeight: "100vh", position: "relative", backgroundColor: "#000" } as any}>
				<OfflineCaptureScreen onCapture={() => setToastMsg("Photo queued for upload")} />
				<StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
			</View>
		);
	}

	if (phase === "offline-browsing") {
		return (
			<View style={{ minHeight: "100vh", position: "relative", backgroundColor: "#0a0a0a" } as any}>
				<PlanViewerScreen
					isOnline={false}
					pendingCount={queueItems.length}
					onOpenQueue={() => setPhase("sync-queue")}
				/>
				<StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
			</View>
		);
	}

	return (
		<View style={{ minHeight: "100vh", position: "relative", backgroundColor: "#0a0a0a" } as any}>
			<PlanViewerScreen isOnline={true} />
			<StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
		</View>
	);
}

const meta: Meta<typeof OfflineSyncFlow> = {
	title: "Flows/15. Offline & Sync",
	component: OfflineSyncFlow,
	parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof OfflineSyncFlow>;

export const OnlineBrowsing: Story = {
	name: "1. Online Browsing",
	args: { initialPhase: "online" },
};

export const OfflineBrowsing: Story = {
	name: "2. Offline Browsing",
	args: { initialPhase: "offline-browsing" },
};

export const OfflineCapture: Story = {
	name: "3. Offline Capture",
	args: { initialPhase: "offline-capture" },
};

export const SyncQueue: Story = {
	name: "4. Sync Queue",
	args: { initialPhase: "sync-queue" },
};

export const Syncing: Story = {
	name: "5. Syncing",
	args: { initialPhase: "syncing" },
};

export const SyncComplete: Story = {
	name: "6. Sync Complete",
	args: { initialPhase: "sync-complete" },
};

export const ConflictResolution: Story = {
	name: "7. Conflict Resolution",
	args: { initialPhase: "conflict" },
};

export const FullFlow: Story = {
	name: "Full Flow",
	args: { initialPhase: "online" },
};
