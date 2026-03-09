import type { Meta, StoryObj } from "@storybook/react";
import {
	Camera,
	ChevronDown,
	ChevronRight,
	ExternalLink,
	Eye,
	Layers,
	MapPin,
	Maximize,
	Plus,
	ScanLine,
	TableProperties,
	X,
	ZoomIn,
	ZoomOut,
} from "lucide-react-native";
import * as React from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Icon } from "@/components/ui/icon";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

const MARKER_COLORS = {
	detail: "#22c55e",
	section: "#3b82f6",
	note: "#a855f7",
	selected: "#facc15",
} as const;

interface Marker {
	id: string;
	label: string;
	type: keyof typeof MARKER_COLORS;
	description: string;
	top: string;
	left: string;
	width: string;
	height: string;
}

const MOCK_MARKERS: Marker[] = [
	{ id: "m1", label: "5/A7", type: "detail", description: "Electrical Junction Detail — Referenced from Sheet S1.0", top: "52%", left: "7%", width: "6%", height: "4%" },
	{ id: "m2", label: "3/A2", type: "section", description: "Stage Framing Section — See Sheet S2.0", top: "60%", left: "18%", width: "8%", height: "5%" },
	{ id: "m3", label: "N1", type: "note", description: "Foundation Notes — General structural notes", top: "4%", left: "78%", width: "16%", height: "12%" },
	{ id: "m4", label: "2/A1", type: "detail", description: "Footing Detail — Strip footing at grid line W", top: "42%", left: "28%", width: "5%", height: "4%" },
];

interface MockScheduleEntry {
	id: string;
	mark: string;
	confidence: number;
	properties: Record<string, string>;
}

interface MockScheduleGroup {
	id: string;
	title: string;
	sheetNumber: string;
	entries: MockScheduleEntry[];
}

const MOCK_SCHEDULE_GROUPS: MockScheduleGroup[] = [
	{
		id: "sg1",
		title: "Slab on Grade Schedule",
		sheetNumber: "S1.0",
		entries: [
			{ id: "se1", mark: "SL1", confidence: 0.95, properties: { thickness: "6\"", concrete: "4000 PSI", reinforcement: "6x6 W2.9/W2.9 WWF", finish: "Broom" } },
			{ id: "se2", mark: "SL2", confidence: 0.92, properties: { thickness: "8\"", concrete: "4000 PSI", reinforcement: "#4 @ 16\" O.C. E.W.", finish: "Hard Trowel" } },
			{ id: "se3", mark: "SL3", confidence: 0.88, properties: { thickness: "6\"", concrete: "4000 PSI", reinforcement: "6x6 W2.9/W2.9 WWF", finish: "Broom" } },
			{ id: "se4", mark: "SL4", confidence: 0.71, properties: { thickness: "10\"", concrete: "5000 PSI" } },
		],
	},
	{
		id: "sg2",
		title: "Footing Schedule",
		sheetNumber: "S1.0",
		entries: [
			{ id: "se5", mark: "F1", confidence: 0.97, properties: { width: "24\"", depth: "12\"", reinforcement: "3-#5 Cont. T&B", concrete: "4000 PSI" } },
			{ id: "se6", mark: "F2", confidence: 0.94, properties: { width: "36\"", depth: "18\"", reinforcement: "4-#5 Cont. T&B", concrete: "4000 PSI" } },
			{ id: "se7", mark: "F3", confidence: 0.91, properties: { width: "30\"", depth: "15\"", reinforcement: "3-#5 Cont. T&B", concrete: "4000 PSI" } },
		],
	},
];

function GlassButton({
	children,
	size = 44,
	onPress,
}: {
	children: React.ReactNode;
	size?: number;
	onPress?: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			className="items-center justify-center rounded-full"
			style={{ width: size, height: size, backgroundColor: "rgba(0,0,0,0.6)" }}
		>
			{children}
		</Pressable>
	);
}

function MarkerOverlay({
	marker,
	isSelected,
	onPress,
}: {
	marker: Marker;
	isSelected?: boolean;
	onPress: () => void;
}) {
	const color = isSelected ? MARKER_COLORS.selected : MARKER_COLORS[marker.type];
	return (
		<Pressable
			onPress={onPress}
			style={{
				position: "absolute",
				top: marker.top as any,
				left: marker.left as any,
				width: marker.width as any,
				height: marker.height as any,
				borderWidth: isSelected ? 3 : 2,
				borderColor: color,
				borderRadius: 4,
				backgroundColor: isSelected ? "rgba(250,204,21,0.12)" : "transparent",
				zIndex: 5,
			}}
		>
			<View
				style={{
					position: "absolute",
					top: -22,
					left: 0,
					backgroundColor: color,
					borderRadius: 4,
					paddingHorizontal: 6,
					paddingVertical: 2,
				}}
			>
				<Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
					{marker.label}
				</Text>
			</View>
		</Pressable>
	);
}

function MarkerDetailSheet({
	marker,
	onClose,
	onTakePhoto,
}: {
	marker: Marker;
	onClose: () => void;
	onTakePhoto?: () => void;
}) {
	return (
		<View
			style={{
				position: "absolute",
				bottom: 0,
				left: 0,
				right: 0,
				zIndex: 30,
				backgroundColor: "#1c1c1c",
				borderTopLeftRadius: 20,
				borderTopRightRadius: 20,
				paddingTop: 12,
				paddingBottom: 32,
				paddingHorizontal: 20,
			}}
		>
			<Pressable onPress={onClose} className="mb-4 items-center">
				<View className="bg-muted h-1 w-10 rounded-full" />
			</Pressable>

			<View className="mb-1 flex-row items-center gap-2">
				<View
					className="items-center justify-center rounded-full"
					style={{
						width: 28,
						height: 28,
						backgroundColor: MARKER_COLORS[marker.type] + "20",
					}}
				>
					<Icon as={MapPin} style={{ color: MARKER_COLORS[marker.type] }} className="size-4" />
				</View>
				<Text className="text-foreground text-lg font-bold">{marker.label}</Text>
				<View
					className="rounded-full px-2 py-0.5"
					style={{ backgroundColor: MARKER_COLORS[marker.type] + "20" }}
				>
					<Text style={{ color: MARKER_COLORS[marker.type], fontSize: 11, fontWeight: "600" }}>
						{marker.type.charAt(0).toUpperCase() + marker.type.slice(1)}
					</Text>
				</View>
			</View>

			<Text className="text-muted-foreground mb-5 text-sm">
				{marker.description}
			</Text>

			<View className="flex-row gap-3">
				<Pressable
					className="flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3"
					style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
				>
					<Icon as={ExternalLink} className="text-foreground size-4" />
					<Text className="text-foreground text-sm font-semibold">Go to Sheet</Text>
				</Pressable>
				<Pressable
					onPress={onTakePhoto}
					className="bg-primary flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3"
				>
					<Icon as={Camera} className="text-primary-foreground size-4" />
					<Text className="text-primary-foreground text-sm font-semibold">Take Photo Here</Text>
				</Pressable>
			</View>
		</View>
	);
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
	const badge =
		confidence >= 0.9
			? { label: "High", color: "#16a34a", bg: "rgba(22, 163, 74, 0.15)" }
			: confidence >= 0.8
				? { label: "Medium", color: "#ca8a04", bg: "rgba(202, 138, 4, 0.15)" }
				: { label: "Review", color: "#ea580c", bg: "rgba(234, 88, 12, 0.15)" };
	return (
		<View className="rounded-full px-2 py-0.5" style={{ backgroundColor: badge.bg }}>
			<Text style={{ color: badge.color }} className="text-xs font-semibold">
				{Math.round(confidence * 100)}% {badge.label}
			</Text>
		</View>
	);
}

function formatLabel(key: string): string {
	return key
		.replace(/([A-Z])/g, " $1")
		.replace(/[_-]/g, " ")
		.replace(/\b\w/g, (c) => c.toUpperCase())
		.trim();
}

function StoryScheduleRow({
	entry,
	index,
}: {
	entry: MockScheduleEntry;
	index: number;
}) {
	const [expanded, setExpanded] = React.useState(false);
	const summary = Object.values(entry.properties).slice(0, 2).join("  ");

	return (
		<View>
			<Pressable
				onPress={() => setExpanded((p) => !p)}
				className={cn(
					"flex-row items-center px-4 py-3 active:bg-muted/30",
					index % 2 === 1 && "bg-muted/10",
				)}
				style={{ minHeight: 48 }}
			>
				<Text className="text-foreground w-14 text-base font-semibold">{entry.mark}</Text>
				<Text className="text-foreground flex-1 text-sm" numberOfLines={1}>
					{summary || "\u2014"}
				</Text>
				<View className={cn("ml-2 transition-transform", expanded && "rotate-90")}>
					<Icon as={ChevronRight} className="text-muted-foreground size-4" />
				</View>
			</Pressable>

			{expanded && (
				<View className={cn("px-4 pb-4", index % 2 === 1 && "bg-muted/10")}>
					<Separator className="mb-3" />
					<View className="gap-3 px-2">
						{Object.entries(entry.properties).map(([key, value]) => (
							<View key={key}>
								<Text className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
									{formatLabel(key)}
								</Text>
								<Text className="text-foreground mt-0.5 text-base">{value || "\u2014"}</Text>
							</View>
						))}
					</View>
					<Separator className="my-3" />
					<View className="flex-row items-center justify-between px-2">
						<View className="flex-row items-center gap-1.5">
							<Text className="text-muted-foreground text-sm">Confidence:</Text>
							<ConfidenceBadge confidence={entry.confidence} />
						</View>
					</View>
					<View className="mt-3 px-2">
						<Pressable className="bg-primary h-12 flex-row items-center justify-center gap-2 rounded-lg">
							<Icon as={Eye} className="text-primary-foreground size-5" />
							<Text className="text-primary-foreground text-base font-semibold">View on Sheet</Text>
						</Pressable>
					</View>
				</View>
			)}
		</View>
	);
}

function ScheduleGroupSection({ group }: { group: MockScheduleGroup }) {
	const [isOpen, setIsOpen] = React.useState(true);
	return (
		<Collapsible open={isOpen} onOpenChange={setIsOpen}>
			<CollapsibleTrigger asChild>
				<Pressable
					className="border-border bg-muted/30 active:bg-muted/50 flex-row items-center border-b px-4 py-3"
					style={{ minHeight: 48 }}
				>
					<View className="mr-2">
						<Icon
							as={isOpen ? ChevronDown : ChevronRight}
							className="text-muted-foreground size-4"
						/>
					</View>
					<Text className="text-foreground flex-1 text-base font-semibold" numberOfLines={1}>
						{group.title}
					</Text>
					<View className="bg-secondary rounded-full px-2 py-0.5">
						<Text className="text-secondary-foreground text-xs font-semibold">
							{group.entries.length}
						</Text>
					</View>
					<Text className="text-muted-foreground ml-3 text-sm">
						{group.sheetNumber}
					</Text>
				</Pressable>
			</CollapsibleTrigger>
			<CollapsibleContent>
				{group.entries.map((entry, index) => (
					<StoryScheduleRow key={entry.id} entry={entry} index={index} />
				))}
			</CollapsibleContent>
		</Collapsible>
	);
}

function ScheduleDrawerPanel({ onClose }: { onClose: () => void }) {
	const totalEntries = MOCK_SCHEDULE_GROUPS.reduce((sum, g) => sum + g.entries.length, 0);
	return (
		<View
			style={{
				position: "absolute",
				top: 0,
				bottom: 0,
				left: 0,
				right: 0,
				zIndex: 40,
			}}
		>
			{/* Backdrop */}
			<Pressable
				onPress={onClose}
				style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.5)" }}
			/>

			{/* Sheet */}
			<View
				style={{
					position: "absolute",
					bottom: 0,
					left: 0,
					right: 0,
					maxHeight: "65%",
					backgroundColor: "#1c1c1c",
					borderTopLeftRadius: 24,
					borderTopRightRadius: 24,
				}}
			>
				{/* Handle */}
				<View className="items-center py-3">
					<View className="bg-muted-foreground/30 h-1 w-10 rounded-full" />
				</View>

				{/* Header */}
				<View className="flex-row items-start justify-between px-6 pb-3">
					<View className="flex-1">
						<Text className="text-foreground text-2xl font-bold">Schedules</Text>
						<Text className="text-muted-foreground text-sm">
							{MOCK_SCHEDULE_GROUPS.length} schedules · {totalEntries} entries
						</Text>
					</View>
					<Pressable
						onPress={onClose}
						className="active:bg-muted/50 -m-2 rounded-full p-2"
						style={{ minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" }}
					>
						<Icon as={X} className="text-muted-foreground size-5" />
					</Pressable>
				</View>

				{/* Content */}
				<ScrollView className="flex-1" showsVerticalScrollIndicator>
					{MOCK_SCHEDULE_GROUPS.map((group) => (
						<ScheduleGroupSection key={group.id} group={group} />
					))}
				</ScrollView>
			</View>
		</View>
	);
}

function PlanViewerScreen({
	initialMarker,
	initialDrawer = false,
	onClose,
	onTakePhoto,
}: {
	initialMarker?: string;
	initialDrawer?: boolean;
	onClose?: () => void;
	onTakePhoto?: () => void;
}) {
	const [selectedMarkerId, setSelectedMarkerId] = React.useState<string | undefined>(initialMarker);
	const [showScheduleDrawer, setShowScheduleDrawer] = React.useState(initialDrawer);

	const selectedMarker = selectedMarkerId
		? MOCK_MARKERS.find((m) => m.id === selectedMarkerId)
		: undefined;

	const handleMarkerPress = (id: string) => {
		setSelectedMarkerId((prev) => (prev === id ? undefined : id));
		setShowScheduleDrawer(false);
	};

	const handleSchedulePress = () => {
		setShowScheduleDrawer(true);
		setSelectedMarkerId(undefined);
	};

	return (
		<View style={{ minHeight: "100vh", position: "relative", backgroundColor: "#0a0a0a" } as any}>
			{/* Plan image background */}
			<Image
				source={{ uri: "/plan-sample.png" }}
				style={{ width: "100%", height: "100%", position: "absolute" }}
				resizeMode="contain"
			/>

			{/* Marker overlays */}
			{MOCK_MARKERS.map((marker) => (
				<MarkerOverlay
					key={marker.id}
					marker={marker}
					isSelected={marker.id === selectedMarkerId}
					onPress={() => handleMarkerPress(marker.id)}
				/>
			))}

			{/* Close button — top left */}
			<View style={{ position: "absolute", top: 16, left: 16, zIndex: 20 }}>
				<GlassButton onPress={onClose}>
					<Icon as={X} className="size-5 text-white" strokeWidth={2.5} />
				</GlassButton>
			</View>

			{/* Right-side controls */}
			<View style={{ position: "absolute", top: 16, right: 16, zIndex: 20, gap: 12, alignItems: "center" }}>
				{/* Zoom percentage */}
				<View
					className="items-center justify-center rounded-xl"
					style={{ backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 10, paddingVertical: 6 }}
				>
					<Text style={{ color: "#fff", fontSize: 13, fontWeight: "600", fontVariant: ["tabular-nums"] }}>
						42%
					</Text>
				</View>

				{/* Zoom controls stack */}
				<View
					className="items-center overflow-hidden rounded-2xl"
					style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
				>
					<Pressable className="items-center justify-center" style={{ width: 44, height: 44 }}>
						<Icon as={ZoomIn} className="size-5 text-white" />
					</Pressable>
					<View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.1)", alignSelf: "stretch" }} />
					<Pressable className="items-center justify-center" style={{ width: 44, height: 44 }}>
						<Icon as={ZoomOut} className="size-5 text-white" />
					</Pressable>
					<View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.1)", alignSelf: "stretch" }} />
					<Pressable className="items-center justify-center" style={{ width: 44, height: 44 }}>
						<Icon as={Maximize} className="size-5 text-white" />
					</Pressable>
				</View>

				{/* Region toggle */}
				<GlassButton>
					<Icon as={ScanLine} className="size-5 text-white" />
				</GlassButton>

				{/* Schedule drawer */}
				<GlassButton onPress={handleSchedulePress}>
					<Icon as={TableProperties} className="size-5 text-white" />
				</GlassButton>

				{/* Add marker */}
				<GlassButton>
					<Icon as={Plus} className="size-5 text-white" strokeWidth={2.5} />
				</GlassButton>
			</View>

			{/* Bottom sheet info bar */}
			{!selectedMarker && !showScheduleDrawer && (
				<View
					style={{
						position: "absolute",
						bottom: 0,
						left: 0,
						right: 0,
						zIndex: 10,
						paddingHorizontal: 16,
						paddingBottom: 24,
					}}
				>
					<View className="flex-row items-center justify-between">
						<Pressable
							className="flex-row items-center gap-2 rounded-xl px-4 py-2.5"
							style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
						>
							<Icon as={Layers} className="size-4 text-white/70" />
							<Text className="text-sm font-bold text-white">S1.0</Text>
							<Text className="text-sm text-white/60">Foundation Plan</Text>
							<Icon as={ChevronDown} className="size-3.5 text-white/40" />
						</Pressable>

						<View
							className="flex-row items-center gap-1.5 rounded-xl px-3 py-2"
							style={{ backgroundColor: "rgba(245,245,245,0.15)" }}
						>
							<Icon as={MapPin} className="text-primary size-3.5" />
							<Text className="text-primary text-sm font-semibold">
								{MOCK_MARKERS.length}
							</Text>
						</View>
					</View>
				</View>
			)}

			{/* Marker detail sheet */}
			{selectedMarker && (
				<MarkerDetailSheet
					marker={selectedMarker}
					onClose={() => setSelectedMarkerId(undefined)}
					onTakePhoto={onTakePhoto}
				/>
			)}

			{/* Schedule drawer */}
			{showScheduleDrawer && (
				<ScheduleDrawerPanel onClose={() => setShowScheduleDrawer(false)} />
			)}
		</View>
	);
}

const meta: Meta<typeof PlanViewerScreen> = {
	title: "Screens/Plan Viewer",
	component: PlanViewerScreen,
	parameters: {
		layout: "fullscreen",
	},
};

export default meta;
type Story = StoryObj<typeof PlanViewerScreen>;

export const Default: Story = {};

export const MarkerSelected: Story = {
	args: {
		initialMarker: "m1",
	},
};

export const ScheduleDrawer: Story = {
	args: {
		initialDrawer: true,
	},
};
