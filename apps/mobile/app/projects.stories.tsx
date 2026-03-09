import type { Meta, StoryObj } from "@storybook/react";
import {
	AlertTriangle,
	ArrowLeft,
	Bell,
	Camera,
	Check,
	ChevronDown,
	ChevronRight,
	Copy,
	Download,
	Edit2,
	ExternalLink,
	Eye,
	FileText,
	Folder,
	FolderOpen,
	LayoutGrid,
	Layers,
	List,
	MapPin,
	Maximize,
	Mic,
	Moon,
	Plus,
	RefreshCcw,
	RotateCcw,
	ScanLine,
	Search,
	Settings,
	Share2,
	Sparkles,
	Sun,
	TableProperties,
	X,
	Zap,
	ZapOff,
	ZoomIn,
	ZoomOut,
} from "lucide-react-native";
import * as React from "react";
import { FlatList, Image, Pressable, ScrollView, View } from "react-native";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import {
	CreateProjectOverlay,
	MembersScreen,
	NotificationsScreen,
	ProcessingBanner,
	ProcessingOverlay,
	ProfileScreen,
	ProjectSettingsScreen,
	StorySegmentedControl,
	UploadPlanOverlay,
	useProcessingState,
} from "./_story-components";
import { SubscriptionScreen } from "./subscription.stories";

interface Project {
	id: string;
	name: string;
	address?: string;
	sheetCount: number;
	photoCount: number;
	memberCount: number;
	updatedAt: string;
	status: "active" | "archived" | "completed";
}

interface Sheet {
	id: string;
	number: string;
	title: string;
}

const MOCK_PROJECTS: Project[] = [
	{
		id: "1",
		name: "Holabird Ave Warehouse",
		address: "4200 Holabird Ave, Baltimore, MD",
		sheetCount: 12,
		photoCount: 48,
		memberCount: 5,
		updatedAt: "2h ago",
		status: "active",
	},
	{
		id: "2",
		name: "Riverside Office Park",
		address: "1500 Riverside Dr, Austin, TX",
		sheetCount: 8,
		photoCount: 23,
		memberCount: 3,
		updatedAt: "1d ago",
		status: "active",
	},
	{
		id: "3",
		name: "Harbor Point Phase II",
		address: "1 Harbor Point Rd, Baltimore, MD",
		sheetCount: 24,
		photoCount: 156,
		memberCount: 8,
		updatedAt: "3d ago",
		status: "active",
	},
	{
		id: "4",
		name: "Summit Ridge Residential",
		address: "700 Summit Ridge Blvd, Denver, CO",
		sheetCount: 6,
		photoCount: 12,
		memberCount: 2,
		updatedAt: "1w ago",
		status: "completed",
	},
];

const MOCK_FOLDERS = [
	{
		id: "f1",
		name: "Structural Plans",
		sheets: [
			{ id: "s1", number: "S1.0", title: "Foundation Plan" },
			{ id: "s2", number: "S2.0", title: "Second Floor Framing" },
			{ id: "s3", number: "S3.0", title: "Slab on Grade Schedule" },
			{ id: "s4", number: "S4.0", title: "Roof Framing Plan" },
		],
	},
	{
		id: "f2",
		name: "Architectural Plans",
		sheets: [
			{ id: "a1", number: "A1.0", title: "Site Plan" },
			{ id: "a2", number: "A2.0", title: "Floor Plan - Level 1" },
			{ id: "a3", number: "A3.0", title: "Floor Plan - Level 2" },
		],
	},
	{
		id: "f3",
		name: "Electrical Plans",
		sheets: [
			{ id: "e1", number: "E1.0", title: "Lighting Plan" },
			{ id: "e2", number: "E2.0", title: "Power Plan" },
		],
	},
];

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
		],
	},
];

type Screen =
	| { type: "projects" }
	| { type: "notifications" }
	| { type: "profile" }
	| { type: "subscription" }
	| { type: "workspace"; project: Project }
	| { type: "project-settings"; project: Project }
	| { type: "members"; project: Project }
	| { type: "plan-viewer"; project: Project; sheet: Sheet }
	| { type: "camera"; project: Project; returnTo: "workspace" | "plan-viewer" };

function FilterChip({
	label,
	isActive,
	onPress,
}: {
	label: string;
	isActive: boolean;
	onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			className={cn(
				"mr-2 items-center justify-center rounded-full px-4",
				isActive ? "bg-foreground" : "bg-muted",
			)}
			style={{ height: 32, borderRadius: 16 }}
		>
			<Text
				className={cn(
					"text-xs font-medium",
					isActive ? "text-background" : "text-muted-foreground",
				)}
			>
				{label}
			</Text>
		</Pressable>
	);
}

function ProjectListItem({
	project,
	isLast = false,
	onPress,
}: {
	project: Project;
	isLast?: boolean;
	onPress?: () => void;
}) {
	const todayActivity = project.id === "1" ? { photos: 12, issues: 1 } : null;

	return (
		<>
			<Pressable
				onPress={onPress}
				className="active:bg-muted/50 px-4 py-5"
				style={{ minHeight: 80 }}
			>
				<View className="flex-row items-start justify-between">
					<View className="flex-1 pr-4">
						<Text className="text-foreground text-lg leading-tight font-semibold">
							{project.name}
						</Text>
						<Text className="text-muted-foreground mt-1 text-sm">
							{project.sheetCount} sheets • {project.photoCount} photos •{" "}
							{project.memberCount} members
						</Text>
						{project.address && (
							<View className="mt-1 flex-row items-center">
								<Icon
									as={MapPin}
									className="text-muted-foreground mr-1 size-3"
								/>
								<Text className="text-muted-foreground text-xs">
									{project.address}
								</Text>
							</View>
						)}
					</View>
					<Text className="text-muted-foreground text-xs">
						{project.updatedAt}
					</Text>
				</View>

				{todayActivity && (
					<View className="border-border/50 mt-4 flex-row items-center border-t pt-4">
						<View className="mr-2 size-2 rounded-full bg-blue-500" />
						<Text className="text-foreground/80 text-xs font-medium">
							Today: {todayActivity.photos} photos
							{todayActivity.issues > 0
								? `, ${todayActivity.issues} issue${todayActivity.issues > 1 ? "s" : ""} flagged`
								: ""}
						</Text>
					</View>
				)}
			</Pressable>
			{!isLast && <Separator className="ml-4" />}
		</>
	);
}

function PlansTab({ onSheetPress }: { onSheetPress?: (sheet: Sheet) => void }) {
	const [searchQuery, setSearchQuery] = React.useState("");
	const [viewMode, setViewMode] = React.useState<"grid" | "list">("list");
	const [expandedFolders, setExpandedFolders] = React.useState<string[]>([
		"f1",
	]);

	const toggleFolder = (id: string) => {
		setExpandedFolders((prev) =>
			prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id],
		);
	};

	return (
		<View className="flex-1">
			<View className="px-4 py-4">
				<View className="flex-row items-center gap-2">
					<View className="relative flex-1">
						<View className="absolute top-2.5 left-3 z-10">
							<Icon as={Search} className="text-muted-foreground size-4" />
						</View>
						<Input
							placeholder="Search plans"
							value={searchQuery}
							onChangeText={setSearchQuery}
							className="bg-muted/40 h-10 rounded-xl border-transparent pl-10"
						/>
					</View>
					<View className="bg-muted/20 flex-row rounded-xl p-1">
						<Pressable
							onPress={() => setViewMode("grid")}
							className={cn(
								"rounded-lg p-1.5",
								viewMode === "grid"
									? "bg-background shadow-sm"
									: "bg-transparent",
							)}
						>
							<Icon
								as={LayoutGrid}
								className={cn(
									"size-4",
									viewMode === "grid"
										? "text-foreground"
										: "text-muted-foreground",
								)}
							/>
						</Pressable>
						<Pressable
							onPress={() => setViewMode("list")}
							className={cn(
								"rounded-lg p-1.5",
								viewMode === "list"
									? "bg-background shadow-sm"
									: "bg-transparent",
							)}
						>
							<Icon
								as={List}
								className={cn(
									"size-4",
									viewMode === "list"
										? "text-foreground"
										: "text-muted-foreground",
								)}
							/>
						</Pressable>
					</View>
				</View>
			</View>

			<ScrollView className="flex-1" contentContainerClassName="px-4 pb-8">
				{MOCK_FOLDERS.map((folder) => (
					<Collapsible
						key={folder.id}
						open={expandedFolders.includes(folder.id)}
						onOpenChange={() => toggleFolder(folder.id)}
						className="mb-4"
					>
						<CollapsibleTrigger asChild>
							<Pressable className="bg-muted/10 flex-row items-center justify-between rounded-xl px-4 py-3">
								<View className="flex-1 flex-row items-center gap-3">
									<Icon
										as={Folder}
										className="text-muted-foreground size-5"
									/>
									<View className="flex-1">
										<Text
											className="text-foreground text-base font-semibold"
											numberOfLines={1}
										>
											{folder.name}
										</Text>
										<Text className="text-muted-foreground text-xs">
											{folder.sheets.length} plans
										</Text>
									</View>
								</View>
								<Icon
									as={
										expandedFolders.includes(folder.id)
											? ChevronDown
											: ChevronRight
									}
									className="text-muted-foreground size-5"
								/>
							</Pressable>
						</CollapsibleTrigger>
						<CollapsibleContent>
							{viewMode === "grid" ? (
								<View
									className="pt-2"
									style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}
								>
									{folder.sheets.map((sheet) => (
										<Pressable
											key={sheet.id}
											onPress={() => onSheetPress?.(sheet)}
											className="border-border active:bg-muted/10 overflow-hidden rounded-2xl border"
											style={{ width: "48%" }}
										>
											<Image
												source={{ uri: "/plan-sample.png" }}
												style={{ width: "100%", aspectRatio: 3 / 2 }}
												resizeMode="cover"
											/>
											<View className="p-3">
												<Text className="text-foreground text-sm font-bold">
													{sheet.number}
												</Text>
												<Text className="text-muted-foreground text-xs" numberOfLines={1}>
													{sheet.title}
												</Text>
											</View>
										</Pressable>
									))}
								</View>
							) : (
								<View className="gap-1 pt-2">
									{folder.sheets.map((sheet) => (
										<Pressable
											key={sheet.id}
											onPress={() => onSheetPress?.(sheet)}
											className="active:bg-muted/10 flex-row items-center gap-4 rounded-lg px-2 py-3"
										>
											<View className="bg-muted/20 size-10 items-center justify-center rounded-lg">
												<Icon
													as={FileText}
													className="text-muted-foreground size-5"
												/>
											</View>
											<View className="flex-1">
												<Text className="text-foreground text-base font-bold">
													{sheet.number}
												</Text>
												<Text className="text-muted-foreground text-sm">
													{sheet.title}
												</Text>
											</View>
										</Pressable>
									))}
								</View>
							)}
						</CollapsibleContent>
					</Collapsible>
				))}
			</ScrollView>
		</View>
	);
}

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
			style={{
				width: size,
				height: size,
				backgroundColor: "rgba(0,0,0,0.6)",
			}}
		>
			{children}
		</Pressable>
	);
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
	const badge =
		confidence >= 0.9
			? { label: "High", color: "#16a34a", bg: "rgba(22, 163, 74, 0.15)" }
			: confidence >= 0.8
				? {
						label: "Medium",
						color: "#ca8a04",
						bg: "rgba(202, 138, 4, 0.15)",
					}
				: {
						label: "Review",
						color: "#ea580c",
						bg: "rgba(234, 88, 12, 0.15)",
					};
	return (
		<View
			className="rounded-full px-2 py-0.5"
			style={{ backgroundColor: badge.bg }}
		>
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

function ScheduleRow({ entry, index }: { entry: MockScheduleEntry; index: number }) {
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
				<Text className="text-foreground w-14 text-base font-semibold">
					{entry.mark}
				</Text>
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
								<Text className="text-foreground mt-0.5 text-base">
									{value || "\u2014"}
								</Text>
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
							<Text className="text-primary-foreground text-base font-semibold">
								View on Sheet
							</Text>
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
					<Text
						className="text-foreground flex-1 text-base font-semibold"
						numberOfLines={1}
					>
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
					<ScheduleRow key={entry.id} entry={entry} index={index} />
				))}
			</CollapsibleContent>
		</Collapsible>
	);
}

function InlinePlanViewer({
	project,
	sheet,
	onClose,
	onTakePhoto,
}: {
	project: Project;
	sheet: Sheet;
	onClose: () => void;
	onTakePhoto: () => void;
}) {
	const [selectedMarkerId, setSelectedMarkerId] = React.useState<string>();
	const [showScheduleDrawer, setShowScheduleDrawer] = React.useState(false);

	const selectedMarker = selectedMarkerId
		? MOCK_MARKERS.find((m) => m.id === selectedMarkerId)
		: undefined;

	const handleMarkerPress = (id: string) => {
		setSelectedMarkerId((prev) => (prev === id ? undefined : id));
		setShowScheduleDrawer(false);
	};

	return (
		<View
			style={{
				minHeight: "100vh",
				position: "relative",
				backgroundColor: "#0a0a0a",
			} as any}
		>
			<Image
				source={{ uri: "/plan-sample.png" }}
				style={{
					width: "100%",
					height: "100%",
					position: "absolute",
				}}
				resizeMode="contain"
			/>

			{MOCK_MARKERS.map((marker) => (
				<Pressable
					key={marker.id}
					onPress={() => handleMarkerPress(marker.id)}
					style={{
						position: "absolute",
						top: marker.top as any,
						left: marker.left as any,
						width: marker.width as any,
						height: marker.height as any,
						borderWidth: marker.id === selectedMarkerId ? 3 : 2,
						borderColor:
							marker.id === selectedMarkerId
								? MARKER_COLORS.selected
								: MARKER_COLORS[marker.type],
						borderRadius: 4,
						backgroundColor:
							marker.id === selectedMarkerId
								? "rgba(250,204,21,0.12)"
								: "transparent",
						zIndex: 5,
					}}
				>
					<View
						style={{
							position: "absolute",
							top: -22,
							left: 0,
							backgroundColor:
								marker.id === selectedMarkerId
									? MARKER_COLORS.selected
									: MARKER_COLORS[marker.type],
							borderRadius: 4,
							paddingHorizontal: 6,
							paddingVertical: 2,
						}}
					>
						<Text
							style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}
						>
							{marker.label}
						</Text>
					</View>
				</Pressable>
			))}

			{/* Close button */}
			<View style={{ position: "absolute", top: 16, left: 16, zIndex: 20 }}>
				<GlassButton onPress={onClose}>
					<Icon as={X} className="size-5 text-white" strokeWidth={2.5} />
				</GlassButton>
			</View>

			{/* Right controls */}
			<View
				style={{
					position: "absolute",
					top: 16,
					right: 16,
					zIndex: 20,
					gap: 12,
					alignItems: "center",
				}}
			>
				<View
					className="items-center justify-center rounded-xl"
					style={{
						backgroundColor: "rgba(0,0,0,0.6)",
						paddingHorizontal: 10,
						paddingVertical: 6,
					}}
				>
					<Text
						style={{
							color: "#fff",
							fontSize: 13,
							fontWeight: "600",
							fontVariant: ["tabular-nums"],
						}}
					>
						42%
					</Text>
				</View>
				<View
					className="items-center overflow-hidden rounded-2xl"
					style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
				>
					<Pressable
						className="items-center justify-center"
						style={{ width: 44, height: 44 }}
					>
						<Icon as={ZoomIn} className="size-5 text-white" />
					</Pressable>
					<View
						style={{
							height: 1,
							backgroundColor: "rgba(255,255,255,0.1)",
							alignSelf: "stretch",
						}}
					/>
					<Pressable
						className="items-center justify-center"
						style={{ width: 44, height: 44 }}
					>
						<Icon as={ZoomOut} className="size-5 text-white" />
					</Pressable>
					<View
						style={{
							height: 1,
							backgroundColor: "rgba(255,255,255,0.1)",
							alignSelf: "stretch",
						}}
					/>
					<Pressable
						className="items-center justify-center"
						style={{ width: 44, height: 44 }}
					>
						<Icon as={Maximize} className="size-5 text-white" />
					</Pressable>
				</View>
				<GlassButton>
					<Icon as={ScanLine} className="size-5 text-white" />
				</GlassButton>
				<GlassButton onPress={() => {
					setShowScheduleDrawer(true);
					setSelectedMarkerId(undefined);
				}}>
					<Icon as={TableProperties} className="size-5 text-white" />
				</GlassButton>
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
						<View
							className="flex-row items-center gap-2 rounded-xl px-4 py-2.5"
							style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
						>
							<Icon as={Layers} className="size-4 text-white/70" />
							<Text className="text-sm font-bold text-white">
								{sheet.number}
							</Text>
							<Text className="text-sm text-white/60">{sheet.title}</Text>
							<Icon as={ChevronDown} className="size-3.5 text-white/40" />
						</View>
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
					<Pressable
						onPress={() => setSelectedMarkerId(undefined)}
						className="mb-4 items-center"
					>
						<View className="bg-muted h-1 w-10 rounded-full" />
					</Pressable>
					<View className="mb-1 flex-row items-center gap-2">
						<View
							className="items-center justify-center rounded-full"
							style={{
								width: 28,
								height: 28,
								backgroundColor:
									MARKER_COLORS[selectedMarker.type] + "20",
							}}
						>
							<Icon
								as={MapPin}
								style={{ color: MARKER_COLORS[selectedMarker.type] }}
								className="size-4"
							/>
						</View>
						<Text className="text-foreground text-lg font-bold">
							{selectedMarker.label}
						</Text>
						<View
							className="rounded-full px-2 py-0.5"
							style={{
								backgroundColor:
									MARKER_COLORS[selectedMarker.type] + "20",
							}}
						>
							<Text
								style={{
									color: MARKER_COLORS[selectedMarker.type],
									fontSize: 11,
									fontWeight: "600",
								}}
							>
								{selectedMarker.type.charAt(0).toUpperCase() +
									selectedMarker.type.slice(1)}
							</Text>
						</View>
					</View>
					<Text className="text-muted-foreground mb-5 text-sm">
						{selectedMarker.description}
					</Text>
					<View className="flex-row gap-3">
						<Pressable
							className="flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3"
							style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
						>
							<Icon as={ExternalLink} className="text-foreground size-4" />
							<Text className="text-foreground text-sm font-semibold">
								Go to Sheet
							</Text>
						</Pressable>
						<Pressable
							onPress={onTakePhoto}
							className="bg-primary flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3"
						>
							<Icon as={Camera} className="text-primary-foreground size-4" />
							<Text className="text-primary-foreground text-sm font-semibold">
								Take Photo Here
							</Text>
						</Pressable>
					</View>
				</View>
			)}

			{/* Schedule drawer */}
			{showScheduleDrawer && (
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
					<Pressable
						onPress={() => setShowScheduleDrawer(false)}
						style={{
							position: "absolute",
							top: 0,
							bottom: 0,
							left: 0,
							right: 0,
							backgroundColor: "rgba(0,0,0,0.5)",
						}}
					/>
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
						<View className="items-center py-3">
							<View className="bg-muted-foreground/30 h-1 w-10 rounded-full" />
						</View>
						<View className="flex-row items-start justify-between px-6 pb-3">
							<View className="flex-1">
								<Text className="text-foreground text-2xl font-bold">
									Schedules
								</Text>
								<Text className="text-muted-foreground text-sm">
									{MOCK_SCHEDULE_GROUPS.length} schedules ·{" "}
									{MOCK_SCHEDULE_GROUPS.reduce(
										(sum, g) => sum + g.entries.length,
										0,
									)}{" "}
									entries
								</Text>
							</View>
							<Pressable
								onPress={() => setShowScheduleDrawer(false)}
								className="active:bg-muted/50 -m-2 rounded-full p-2"
								style={{
									minHeight: 44,
									minWidth: 44,
									alignItems: "center",
									justifyContent: "center",
								}}
							>
								<Icon as={X} className="text-muted-foreground size-5" />
							</Pressable>
						</View>
						<ScrollView className="flex-1" showsVerticalScrollIndicator>
							{MOCK_SCHEDULE_GROUPS.map((group) => (
								<ScheduleGroupSection key={group.id} group={group} />
							))}
						</ScrollView>
					</View>
				</View>
			)}
		</View>
	);
}

function InlineCamera({
	onClose,
}: {
	onClose: () => void;
}) {
	const [mode, setMode] = React.useState<"viewfinder" | "preview">(
		"viewfinder",
	);
	const [isIssueMode, setIsIssueMode] = React.useState(false);
	const [flashOn, setFlashOn] = React.useState(false);
	const [isLinked, setIsLinked] = React.useState(false);
	const [copied, setCopied] = React.useState(false);
	const [recording, setRecording] = React.useState(false);

	if (mode === "preview") {
		return (
			<View
				style={{
					minHeight: "100vh",
					position: "relative",
					backgroundColor: "#000",
				} as any}
			>
				<Image
					source={{
						uri: "https://picsum.photos/seed/construct99/1080/1920",
					}}
					style={{
						width: "100%",
						height: "100%",
						position: "absolute",
					}}
					resizeMode="cover"
				/>

				{/* Top bar */}
				<View
					style={{
						position: "absolute",
						top: 0,
						left: 0,
						right: 0,
						zIndex: 20,
						backgroundColor: "rgba(0,0,0,0.7)",
						paddingTop: 16,
						paddingBottom: 12,
						paddingHorizontal: 16,
					}}
				>
					<View className="flex-row items-center justify-between">
						<View className="flex-row items-center gap-2">
							<View
								className="items-center justify-center rounded-full bg-green-500/20"
								style={{ width: 28, height: 28 }}
							>
								<Icon as={Check} className="size-4 text-green-400" />
							</View>
							<Text className="text-sm font-semibold text-white">
								Photo Saved
							</Text>
						</View>
						<Text className="text-muted-foreground text-xs">Just now</Text>
					</View>
					{isLinked && (
						<View className="mt-2 flex-row items-center gap-1.5">
							<Icon as={MapPin} className="text-primary size-3.5" />
							<Text className="text-sm text-white/70">
								5/A7 - Electrical Junction
							</Text>
						</View>
					)}
				</View>

				{/* OCR card */}
				<View
					style={{
						position: "absolute",
						bottom: 120,
						left: 16,
						right: 16,
						zIndex: 20,
						backgroundColor: "rgba(28,28,28,0.95)",
						borderRadius: 16,
						padding: 16,
					}}
				>
					<Text className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wide">
						Detected Text
					</Text>
					<Text className="text-foreground mb-3 text-sm leading-relaxed">
						{`"PANEL SCH-2A\n208/120V 3PH 4W\nMLO 225A\nCKT 1: 20A 1P — LIGHTING"`}
					</Text>
					<View className="flex-row gap-2">
						<Pressable
							onPress={() => {
								setCopied(true);
								setTimeout(() => setCopied(false), 2000);
							}}
							className="flex-row items-center gap-1.5 rounded-lg px-3 py-2"
							style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
						>
							<Icon as={Copy} className="size-3.5 text-white/70" />
							<Text className="text-xs font-medium text-white/70">
								{copied ? "Copied!" : "Copy"}
							</Text>
						</Pressable>
						<Pressable
							className="flex-row items-center gap-1.5 rounded-lg px-3 py-2"
							style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
						>
							<Icon as={Edit2} className="size-3.5 text-white/70" />
							<Text className="text-xs font-medium text-white/70">Edit</Text>
						</Pressable>
					</View>
				</View>

				{/* Bottom actions */}
				<View
					style={{
						position: "absolute",
						bottom: 0,
						left: 0,
						right: 0,
						paddingBottom: 40,
						paddingHorizontal: 20,
						zIndex: 20,
					}}
				>
					<View className="flex-row items-center gap-3">
						<Pressable
							onPress={() => setMode("viewfinder")}
							className="flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3.5"
							style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
						>
							<Icon as={RotateCcw} className="size-4 text-white" />
							<Text className="text-sm font-semibold text-white">Retake</Text>
						</Pressable>
						<Pressable
							onPress={() => {
								setRecording((r) => !r);
								if (!recording) {
									setTimeout(() => setRecording(false), 3000);
								}
							}}
							className="flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3.5"
							style={{ backgroundColor: recording ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.1)" }}
						>
							<Icon as={Mic} className="size-4 text-white" />
							<Text className="text-sm font-semibold text-white">
								{recording ? "Recording..." : "Add Voice"}
							</Text>
						</Pressable>
						<Pressable
							onPress={onClose}
							className="bg-primary flex-1 items-center justify-center rounded-xl py-3.5"
						>
							<Text className="text-primary-foreground text-sm font-bold">
								Done
							</Text>
						</Pressable>
					</View>
				</View>
			</View>
		);
	}

	return (
		<View
			style={{
				minHeight: "100vh",
				position: "relative",
				backgroundColor: "#000",
			} as any}
		>
			<Image
				source={{
					uri: "https://picsum.photos/seed/constructsite7/1080/1920",
				}}
				style={{
					width: "100%",
					height: "100%",
					position: "absolute",
				}}
				resizeMode="cover"
			/>

			{/* Top controls */}
			<View
				style={{
					position: "absolute",
					top: 16,
					left: 16,
					right: 16,
					zIndex: 20,
					flexDirection: "row",
					justifyContent: "space-between",
					alignItems: "flex-start",
				}}
			>
				<Pressable
					onPress={onClose}
					className="items-center justify-center rounded-full"
					style={{
						width: 44,
						height: 44,
						backgroundColor: "rgba(0,0,0,0.4)",
					}}
				>
					<Icon as={X} className="size-5 text-white" strokeWidth={2.5} />
				</Pressable>
				<View style={{ flexDirection: "row", gap: 12 }}>
					<Pressable
						onPress={() => setFlashOn((f) => !f)}
						className="items-center justify-center rounded-full"
						style={{
							width: 44,
							height: 44,
							backgroundColor: "rgba(0,0,0,0.4)",
						}}
					>
						<Icon
							as={flashOn ? Zap : ZapOff}
							className="size-5 text-white"
						/>
					</Pressable>
					<Pressable
						className="items-center justify-center rounded-full"
						style={{
							width: 44,
							height: 44,
							backgroundColor: "rgba(0,0,0,0.4)",
						}}
					>
						<Icon as={RotateCcw} className="size-5 text-white" />
					</Pressable>
				</View>
			</View>

			{/* Issue mode banner */}
			{isIssueMode && (
				<View
					style={{
						position: "absolute",
						top: 76,
						left: 0,
						right: 0,
						zIndex: 15,
						alignItems: "center",
					}}
				>
					<View
						className="flex-row items-center gap-2 rounded-full px-4 py-2"
						style={{ backgroundColor: "rgba(239,68,68,0.85)" }}
					>
						<Icon as={AlertTriangle} className="size-4 text-white" />
						<Text className="text-sm font-bold text-white">Issue Mode</Text>
					</View>
				</View>
			)}

			{/* Link context bar */}
			<View
				style={{
					position: "absolute",
					bottom: 140,
					left: 16,
					right: 16,
					zIndex: 15,
				}}
			>
				{isLinked ? (
					<View
						className="flex-row items-center gap-2 self-center rounded-full px-4 py-2.5"
						style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
					>
						<Icon as={MapPin} className="text-primary size-4" />
						<Text className="text-sm font-medium text-white">
							5/A7 - Electrical Junction
						</Text>
					</View>
				) : (
					<View
						className="flex-row items-center justify-between self-center rounded-full px-4 py-2"
						style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
					>
						<Text className="text-muted-foreground text-sm">
							Not linked to a callout
						</Text>
						<Pressable
							onPress={() => setIsLinked(true)}
							className="bg-primary ml-3 rounded-full px-3 py-1.5"
						>
							<Text className="text-primary-foreground text-xs font-semibold">
								Link to Plan
							</Text>
						</Pressable>
					</View>
				)}
			</View>

			{/* Bottom controls */}
			<View
				style={{
					position: "absolute",
					bottom: 0,
					left: 0,
					right: 0,
					paddingBottom: 40,
					paddingHorizontal: 24,
					zIndex: 15,
				}}
			>
				<View className="flex-row items-center justify-center">
					<View className="flex-1 items-start">
						<Pressable
							onPress={() => setIsIssueMode((m) => !m)}
							className="flex-row items-center gap-2 rounded-full px-4 py-2.5"
							style={{
								backgroundColor: isIssueMode
									? "rgba(239,68,68,0.25)"
									: "rgba(255,255,255,0.1)",
							}}
						>
							<View
								className="rounded-full"
								style={{
									width: 8,
									height: 8,
									backgroundColor: isIssueMode ? "#ef4444" : "#666",
								}}
							/>
							<Text
								className="text-xs font-semibold"
								style={{ color: isIssueMode ? "#ef4444" : "#999" }}
							>
								Issue
							</Text>
						</Pressable>
					</View>
					<Pressable onPress={() => setMode("preview")}>
						<View
							className="items-center justify-center rounded-full"
							style={{
								width: 72,
								height: 72,
								borderWidth: 4,
								borderColor: isIssueMode ? "#ef4444" : "#ffffff",
								backgroundColor: "transparent",
							}}
						>
							<View
								className="rounded-full"
								style={{
									width: 58,
									height: 58,
									backgroundColor: isIssueMode ? "#ef4444" : "#ffffff",
								}}
							/>
						</View>
					</Pressable>
					<View className="flex-1" />
				</View>
			</View>
		</View>
	);
}

function StoryDailySummary() {
	const [state, setState] = React.useState<
		"default" | "loading" | "generated"
	>("default");
	const [isCollapsed, setIsCollapsed] = React.useState(false);

	const handleGenerate = () => {
		setState("loading");
		setTimeout(() => setState("generated"), 3000);
	};

	return (
		<View className="border-border bg-muted/20 overflow-hidden rounded-none border">
			<Pressable
				onPress={() => setIsCollapsed((c) => !c)}
				className="flex-row items-center justify-between p-4"
			>
				<View className="flex-1 flex-row items-center gap-2">
					<Icon as={Sparkles} className="text-foreground size-4" />
					<Text className="text-foreground text-base font-semibold">
						{"Today's Summary"}
					</Text>
				</View>
				{state === "generated" && !isCollapsed && (
					<Pressable className="bg-foreground/5 flex-row items-center gap-1.5 rounded-full px-3 py-1.5 active:opacity-70">
						<Icon as={ExternalLink} className="text-foreground size-4" />
						<Text className="text-foreground text-sm font-medium">Share</Text>
					</Pressable>
				)}
			</Pressable>
			{!isCollapsed && (
				<View className="px-4 pb-4">
					<View className="bg-border mb-4 h-px opacity-50" />
					{state === "loading" ? (
						<View className="gap-2">
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-[90%]" />
							<Skeleton className="h-4 w-[95%]" />
							<Skeleton className="h-4 w-[60%]" />
						</View>
					) : state === "generated" ? (
						<View className="gap-3">
							<Text className="text-foreground text-sm leading-relaxed">
								Good progress today on the project. The team captured 5 photos
								documenting current conditions, flagged 1 issue requiring
								attention, and recorded a voice note with additional context on
								the findings.
							</Text>
							<View className="mt-1 flex-row items-center justify-between">
								<Text className="text-muted-foreground text-xs">
									Generated just now
								</Text>
								<Pressable
									onPress={handleGenerate}
									className="flex-row items-center gap-1.5 p-1 active:opacity-70"
								>
									<Icon
										as={RefreshCcw}
										className="text-muted-foreground size-3.5"
									/>
									<Text className="text-muted-foreground text-xs">
										Refresh
									</Text>
								</Pressable>
							</View>
						</View>
					) : (
						<View className="gap-3">
							<View className="gap-2">
								<Text className="text-foreground text-sm leading-relaxed">
									📷 5 photos captured
								</Text>
								<Text className="text-foreground text-sm leading-relaxed">
									🎤 1 voice note
								</Text>
								<Text className="text-foreground text-sm leading-relaxed">
									⚠️ 1 issue flagged
								</Text>
							</View>
							<View className="mt-2 flex-row justify-end">
								<Pressable
									onPress={handleGenerate}
									className="bg-foreground flex-row items-center gap-2 rounded-full px-4 py-2 active:opacity-80"
								>
									<Icon as={Sparkles} className="text-background size-4" />
									<Text className="text-background text-sm font-semibold">
										Generate Summary
									</Text>
								</Pressable>
							</View>
						</View>
					)}
				</View>
			)}
		</View>
	);
}

function InlineWorkspace({
	project,
	onBack,
	onNavigate,
}: {
	project: Project;
	onBack: () => void;
	onNavigate: (screen: Screen) => void;
}) {
	const [activeTab, setActiveTab] = React.useState(0);
	const [modal, setModal] = React.useState<"upload-plan" | null>(null);
	const processing = useProcessingState();
	const [showProcessingOverlay, setShowProcessingOverlay] = React.useState(false);

	return (
		<View
			className="bg-background"
			style={{ minHeight: "100vh", position: "relative" } as any}
		>
			{/* Header */}
			<View className="bg-background" style={{ paddingTop: 8 }}>
				<View className="min-h-[56px] flex-row items-center justify-between px-4">
					<Pressable
						onPress={onBack}
						className="-ml-1 items-center justify-center"
						style={{ width: 44, height: 44 }}
					>
						<Icon as={ArrowLeft} className="text-foreground size-6" />
					</Pressable>
					<View className="flex-1 items-center justify-center px-2">
						<Text
							className="text-foreground text-center text-base leading-tight font-bold"
							numberOfLines={1}
						>
							{project.name}
						</Text>
						{project.address && (
							<Text className="text-muted-foreground mt-0.5 text-center text-[11px] leading-snug">
								{project.address}
							</Text>
						)}
					</View>
					<Pressable
						onPress={() =>
							onNavigate({ type: "project-settings", project })
						}
						className="-mr-1 items-center justify-center"
						style={{ width: 44, height: 44 }}
					>
						<Icon as={Settings} className="text-foreground size-5" />
					</Pressable>
				</View>
				<View className="items-center pt-3 pb-4">
					<StorySegmentedControl
						options={["Plans", "Media", "Activity"]}
						selectedIndex={activeTab}
						onIndexChange={setActiveTab}
					/>
				</View>
			</View>

			{/* Tab Content */}
			{activeTab === 0 && (
				<>
					{processing.isProcessing && !showProcessingOverlay && (
						<ProcessingBanner
							stageIndex={processing.stageIndex}
							onPress={() => setShowProcessingOverlay(true)}
						/>
					)}
					<PlansTab
						onSheetPress={(sheet) =>
							onNavigate({ type: "plan-viewer", project, sheet })
						}
					/>
				</>
			)}
			{activeTab === 1 && (
				<Empty className="mx-4 mb-4">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<Icon as={Camera} className="text-muted-foreground size-8" />
						</EmptyMedia>
						<EmptyTitle>No Media Yet</EmptyTitle>
						<EmptyDescription>
							Photos and recordings from this project will appear here as they
							are captured.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			)}
			{activeTab === 2 && (
				<ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
					<View className="gap-6 p-4">
						<StoryDailySummary />
						<View>
							<Text className="text-foreground mb-3 text-lg font-bold">
								Quick Actions
							</Text>
							<View className="flex-row gap-2">
								<Pressable className="bg-muted/20 flex-1 items-center justify-center rounded-full px-3 py-2 active:opacity-70">
									<Icon as={Share2} className="text-foreground mb-1 size-4" />
									<Text className="text-foreground text-center text-[11px] leading-tight font-medium">
										Share
									</Text>
								</Pressable>
								<Pressable className="bg-muted/20 flex-1 items-center justify-center rounded-full px-3 py-2 active:opacity-70">
									<Icon as={Download} className="text-foreground mb-1 size-4" />
									<Text className="text-foreground text-center text-[11px] leading-tight font-medium">
										Offline
									</Text>
								</Pressable>
							</View>
						</View>
					</View>
				</ScrollView>
			)}

			{/* FAB - hidden on Activity tab */}
			{activeTab !== 2 && (
				<View
					style={{
						position: "absolute",
						bottom: 16,
						right: 16,
						width: 56,
						height: 56,
						zIndex: 50,
					}}
				>
					<Pressable
						onPress={() => {
							if (activeTab === 0) {
								setModal("upload-plan");
							} else {
								onNavigate({
									type: "camera",
									project,
									returnTo: "workspace",
								});
							}
						}}
						className="bg-primary h-14 w-14 items-center justify-center rounded-full"
					>
						<Icon
							as={activeTab === 0 ? Plus : Camera}
							className="text-primary-foreground size-6"
							strokeWidth={2.5}
						/>
					</Pressable>
				</View>
			)}

			{modal === "upload-plan" && (
				<UploadPlanOverlay
					onClose={() => setModal(null)}
					onDeviceStorage={() => {
						setModal(null);
						processing.start();
						setShowProcessingOverlay(true);
					}}
				/>
			)}
			{showProcessingOverlay && processing.isProcessing && (
				<ProcessingOverlay
					onClose={() => setShowProcessingOverlay(false)}
					stageIndex={processing.stageIndex}
				/>
			)}
		</View>
	);
}

function ProjectsScreen({
	projects = MOCK_PROJECTS,
	isEmpty = false,
}: {
	projects?: Project[];
	isEmpty?: boolean;
}) {
	const [screen, setScreen] = React.useState<Screen>({ type: "projects" });
	const [modal, setModal] = React.useState<"create-project" | null>(null);
	const [activeFilter, setActiveFilter] = React.useState("all");
	const [darkMode, setDarkMode] = React.useState(false);
	const displayProjects = isEmpty ? [] : projects;

	const filteredProjects = React.useMemo(() => {
		if (activeFilter === "all") return displayProjects;
		return displayProjects.filter((p) => p.status === activeFilter);
	}, [activeFilter, displayProjects]);

	if (screen.type === "notifications") {
		return (
			<NotificationsScreen
				onBack={() => setScreen({ type: "projects" })}
			/>
		);
	}

	if (screen.type === "profile") {
		return (
			<ProfileScreen
				onBack={() => setScreen({ type: "projects" })}
				onNavigate={(target) => {
					if (target === "subscription") {
						setScreen({ type: "subscription" });
					}
				}}
			/>
		);
	}

	if (screen.type === "subscription") {
		return <SubscriptionScreen onBack={() => setScreen({ type: "profile" })} />;
	}

	if (screen.type === "workspace" || screen.type === "project-settings" || screen.type === "members" || screen.type === "plan-viewer" || screen.type === "camera") {
		const project = screen.type === "workspace" ? screen.project
			: screen.type === "project-settings" ? screen.project
			: screen.type === "members" ? screen.project
			: screen.type === "plan-viewer" ? screen.project
			: screen.project;

		if (screen.type === "project-settings") {
			return (
				<ProjectSettingsScreen
					onBack={() => setScreen({ type: "workspace", project })}
					onNavigateToMembers={() =>
						setScreen({ type: "members", project })
					}
				/>
			);
		}

		if (screen.type === "members") {
			return (
				<MembersScreen
					onBack={() =>
						setScreen({ type: "project-settings", project })
					}
				/>
			);
		}

		if (screen.type === "plan-viewer") {
			return (
				<InlinePlanViewer
					project={project}
					sheet={screen.sheet}
					onClose={() => setScreen({ type: "workspace", project })}
					onTakePhoto={() =>
						setScreen({
							type: "camera",
							project,
							returnTo: "plan-viewer",
						})
					}
				/>
			);
		}

		if (screen.type === "camera") {
			return (
				<InlineCamera
					onClose={() =>
						setScreen({ type: "workspace", project })
					}
				/>
			);
		}

		return (
			<InlineWorkspace
				project={project}
				onBack={() => setScreen({ type: "projects" })}
				onNavigate={setScreen}
			/>
		);
	}

	return (
		<View
			className="bg-background"
			style={{ minHeight: "100vh", position: "relative" } as any}
		>
			{/* Header */}
			<View className="border-border flex-row items-center justify-between border-b px-4 py-3">
				<Pressable
					onPress={() => setScreen({ type: "notifications" })}
					className="items-center justify-center"
					style={{ width: 44, height: 44 }}
				>
					<Icon as={Bell} className="text-foreground size-6" />
				</Pressable>
				<Text className="text-foreground text-lg font-bold">Projects</Text>
				<Pressable
					onPress={() => setDarkMode((d) => !d)}
					className="items-center justify-center"
					style={{ width: 44, height: 44 }}
				>
					<Icon
						as={darkMode ? Sun : Moon}
						className="text-foreground size-6"
					/>
				</Pressable>
			</View>

			{/* Filter Chips */}
			<View className="px-4 py-2">
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerClassName="gap-2"
				>
					<FilterChip
						label="All"
						isActive={activeFilter === "all"}
						onPress={() => setActiveFilter("all")}
					/>
					<FilterChip
						label="Active"
						isActive={activeFilter === "active"}
						onPress={() => setActiveFilter("active")}
					/>
					<FilterChip
						label="Completed"
						isActive={activeFilter === "completed"}
						onPress={() => setActiveFilter("completed")}
					/>
					<FilterChip
						label="Archived"
						isActive={activeFilter === "archived"}
						onPress={() => setActiveFilter("archived")}
					/>
				</ScrollView>
			</View>

			{/* Project List */}
			{filteredProjects.length > 0 ? (
				<FlatList
					data={filteredProjects}
					renderItem={({ item, index }) => (
						<ProjectListItem
							project={item}
							isLast={index === filteredProjects.length - 1}
							onPress={() =>
								setScreen({ type: "workspace", project: item })
							}
						/>
					)}
					keyExtractor={(item) => item.id}
					style={{ flex: 1 }}
				/>
			) : (
				<Empty className="mx-4 mb-4">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<Icon
								as={FolderOpen}
								className="text-muted-foreground size-8"
							/>
						</EmptyMedia>
						<EmptyTitle>No Projects Found</EmptyTitle>
						<EmptyDescription>
							{activeFilter === "all"
								? "No projects yet. Create your first project to get started."
								: `No ${activeFilter} projects. Try a different filter or create a new project.`}
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button
							className="h-12 rounded-xl px-8"
							onPress={() => setModal("create-project")}
						>
							<Text className="text-primary-foreground text-base font-bold">
								Create Project
							</Text>
						</Button>
					</EmptyContent>
				</Empty>
			)}

			{/* FAB */}
			<View
				style={{
					position: "absolute",
					bottom: 16,
					right: 16,
					width: 56,
					height: 56,
					zIndex: 50,
				}}
			>
				<Pressable
					onPress={() => setModal("create-project")}
					className="bg-primary h-14 w-14 items-center justify-center rounded-full"
				>
					<Icon
						as={Plus}
						className="text-primary-foreground size-6"
						strokeWidth={2.5}
					/>
				</Pressable>
			</View>

			{/* Create Project Overlay */}
			{modal === "create-project" && (
				<CreateProjectOverlay onClose={() => setModal(null)} />
			)}
		</View>
	);
}

const meta: Meta<typeof ProjectsScreen> = {
	title: "Screens/Projects",
	component: ProjectsScreen,
	parameters: {
		layout: "fullscreen",
	},
};

export default meta;
type Story = StoryObj<typeof ProjectsScreen>;

export const WithProjects: Story = {};

export const EmptyState: Story = {
	args: {
		isEmpty: true,
	},
};

function ProjectsLoading() {
	return (
		<View
			className="bg-background"
			style={{ minHeight: "100vh" } as any}
		>
			<View className="border-border flex-row items-center justify-between border-b px-4 py-3">
				<View style={{ width: 44, height: 44 }} />
				<Text className="text-foreground text-lg font-bold">Projects</Text>
				<View style={{ width: 44, height: 44 }} />
			</View>
			<View className="px-4 py-2">
				<View className="flex-row gap-2">
					<Skeleton className="h-8 w-12 rounded-full" />
					<Skeleton className="h-8 w-16 rounded-full" />
					<Skeleton className="h-8 w-20 rounded-full" />
				</View>
			</View>
			<View className="gap-0">
				{[1, 2, 3, 4].map((i) => (
					<View key={i} className="gap-3 px-4 py-5">
						<View className="flex-row items-start justify-between">
							<View className="flex-1 gap-2">
								<Skeleton className="h-5 w-[70%]" />
								<Skeleton className="h-3.5 w-[55%]" />
								<Skeleton className="h-3 w-[40%]" />
							</View>
							<Skeleton className="h-3 w-10" />
						</View>
						{i === 1 && (
							<View className="flex-row items-center gap-2 pt-2">
								<Skeleton className="size-2 rounded-full" />
								<Skeleton className="h-3 w-[45%]" />
							</View>
						)}
						{i < 4 && <Separator className="mt-3" />}
					</View>
				))}
			</View>
		</View>
	);
}

export const Loading: StoryObj<typeof ProjectsLoading> = {
	render: () => <ProjectsLoading />,
};
