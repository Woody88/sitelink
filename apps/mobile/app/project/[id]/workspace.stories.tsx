import type { Meta, StoryObj } from "@storybook/react";
import {
	ArrowLeft,
	Camera,
	ChevronDown,
	ChevronRight,
	Download,
	FileText,
	Folder,
	LayoutGrid,
	List,
	MapPin,
	Mic,
	Play,
	Plus,
	Search,
	Settings,
	Share2,
} from "lucide-react-native";
import * as React from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

function StorySegmentedControl({
	options,
	selectedIndex,
	onIndexChange,
}: {
	options: string[];
	selectedIndex: number;
	onIndexChange: (index: number) => void;
}) {
	return (
		<View
			className="bg-muted/40 border-border/10 flex-row self-center rounded-full border p-1"
			style={{ height: 40 }}
		>
			{options.map((option, index) => {
				const isSelected = index === selectedIndex;
				return (
					<Pressable
						key={index}
						onPress={() => onIndexChange(index)}
						className={cn(
							"items-center justify-center rounded-full px-5",
							isSelected && "bg-foreground/10 border border-white/5",
						)}
						style={{ height: 32 }}
					>
						<Text
							className={cn(
								"text-sm",
								isSelected
									? "text-foreground font-semibold"
									: "text-muted-foreground font-medium",
							)}
							numberOfLines={1}
						>
							{option}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
}

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

const MOCK_MEMBERS = [
	{ id: "1", name: "John Smith", role: "Owner" },
	{ id: "2", name: "Mike Chen", role: "Member" },
	{ id: "3", name: "Sarah Johnson", role: "Member" },
	{ id: "4", name: "David Lee", role: "Member" },
	{ id: "5", name: "Emily Brown", role: "Member" },
];

const MOCK_ACTIVITY = [
	{ id: "1", time: "2:47 PM", message: "Mike flagged issue at 5/A7" },
	{ id: "2", time: "11:30 AM", message: "Sarah added 3 photos to 3/A2" },
	{ id: "3", time: "9:15 AM", message: "John added photo to 5/A7" },
	{ id: "4", time: "Yesterday 4:20 PM", message: "David uploaded new plan sheet" },
	{ id: "5", time: "Yesterday 2:10 PM", message: "Emily shared project with client" },
];

const MOCK_PHOTOS = [
	{
		title: "Today",
		groups: [
			{
				markerLabel: "5/A7 - Electrical Junction",
				hasIssue: true,
				voiceNote: {
					duration: "0:15",
					transcript: "Junction box needs to move about six inches to the left to clear the conduit run",
				},
				photos: [
					{ id: "p1", seed: "elect1", time: "2:30 PM", isIssue: false },
					{ id: "p2", seed: "elect2", time: "1:30 PM", isIssue: true, hasVoiceNote: true },
					{ id: "p3", seed: "elect3", time: "12:00 PM", isIssue: false },
				],
			},
			{
				markerLabel: "3/A2 - Panel Rough-in",
				hasIssue: false,
				photos: [
					{ id: "p4", seed: "panel1", time: "11:00 AM", isIssue: false },
					{ id: "p5", seed: "panel2", time: "10:30 AM", isIssue: false },
				],
			},
		],
	},
	{
		title: "Yesterday",
		groups: [
			{
				markerLabel: "2/A1 - HVAC Duct",
				hasIssue: false,
				photos: [
					{ id: "p6", seed: "hvac1", time: "4:15 PM", isIssue: false },
					{ id: "p7", seed: "hvac2", time: "3:00 PM", isIssue: false },
				],
			},
		],
	},
];

function PhotoThumbnailStory({
	seed,
	time,
	isIssue,
	hasVoiceNote,
}: {
	seed: string;
	time: string;
	isIssue?: boolean;
	hasVoiceNote?: boolean;
}) {
	return (
		<Pressable
			className="bg-muted relative overflow-hidden rounded-xl"
			style={{ width: 160, height: 160 }}
		>
			<Image
				source={{ uri: `https://picsum.photos/seed/${seed}/300/300` }}
				className="h-full w-full"
				resizeMode="cover"
			/>
			{isIssue && (
				<View
					className="bg-destructive absolute top-2 right-2 items-center justify-center rounded-full"
					style={{ width: 20, height: 20 }}
				>
					<Text className="text-[12px] font-bold text-white">!</Text>
				</View>
			)}
			{hasVoiceNote && (
				<View
					className="absolute right-2 bottom-2 items-center justify-center rounded-full bg-blue-500"
					style={{ width: 20, height: 20 }}
				>
					<Icon as={Mic} className="size-3 text-white" />
				</View>
			)}
			<View className="absolute bottom-2 left-2">
				<View className="rounded bg-black/40 px-1.5 py-0.5">
					<Text className="text-[11px] font-medium text-white">{time}</Text>
				</View>
			</View>
		</Pressable>
	);
}

function MediaTabPopulated() {
	return (
		<ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
			{MOCK_PHOTOS.map((section) => (
				<View key={section.title}>
					<View className="bg-background px-4 pt-6 pb-2">
						<Text className="text-foreground text-base font-bold">{section.title}</Text>
					</View>
					{section.groups.map((group, groupIdx) => (
						<React.Fragment key={group.markerLabel}>
							<View className="py-4">
								<View className="mb-3 px-4">
									<View className="mb-2 flex-row items-center gap-2">
										<Icon as={MapPin} className="text-muted-foreground size-4" />
										<Text className="text-foreground text-sm font-semibold">
											{group.markerLabel}
										</Text>
										<Text className="text-muted-foreground text-xs">
											({group.photos.length} photos)
										</Text>
									</View>
									{group.hasIssue && (
										<Pressable className="bg-primary/10 flex-row items-center gap-1.5 self-start rounded-full px-3 py-1.5 active:opacity-70">
											<Icon as={FileText} className="text-primary size-3.5" />
											<Text className="text-primary text-xs font-medium">Generate RFI</Text>
										</Pressable>
									)}
								</View>
								<ScrollView
									horizontal
									showsHorizontalScrollIndicator={false}
									contentContainerClassName="px-4 gap-3"
								>
									{group.photos.map((photo) => (
										<PhotoThumbnailStory
											key={photo.id}
											seed={photo.seed}
											time={photo.time}
											isIssue={photo.isIssue}
											hasVoiceNote={photo.hasVoiceNote}
										/>
									))}
								</ScrollView>
								{group.voiceNote && (
									<View className="mt-3 px-4">
										<View className="bg-muted/20 flex-row items-start gap-2 rounded-lg p-3">
											<Icon as={Mic} className="text-primary mt-0.5 size-4" />
											<View className="flex-1">
												<Text className="text-muted-foreground mb-1 text-xs">
													{group.voiceNote.duration}
												</Text>
												<Text className="text-foreground text-sm leading-relaxed">
													"{group.voiceNote.transcript}"
												</Text>
											</View>
											<Pressable className="p-1">
												<Icon as={Play} className="text-primary size-4" />
											</Pressable>
										</View>
									</View>
								)}
							</View>
							{groupIdx < section.groups.length - 1 && <Separator className="ml-4" />}
						</React.Fragment>
					))}
				</View>
			))}
		</ScrollView>
	);
}

function PlansTab() {
	const [searchQuery, setSearchQuery] = React.useState("");
	const [viewMode, setViewMode] = React.useState<"grid" | "list">("list");
	const [expandedFolders, setExpandedFolders] = React.useState<string[]>(["f1"]);

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
								viewMode === "grid" ? "bg-background shadow-sm" : "bg-transparent",
							)}
						>
							<Icon
								as={LayoutGrid}
								className={cn("size-4", viewMode === "grid" ? "text-foreground" : "text-muted-foreground")}
							/>
						</Pressable>
						<Pressable
							onPress={() => setViewMode("list")}
							className={cn(
								"rounded-lg p-1.5",
								viewMode === "list" ? "bg-background shadow-sm" : "bg-transparent",
							)}
						>
							<Icon
								as={List}
								className={cn("size-4", viewMode === "list" ? "text-foreground" : "text-muted-foreground")}
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
									<Icon as={Folder} className="text-muted-foreground size-5" />
									<View className="flex-1">
										<Text className="text-foreground text-base font-semibold" numberOfLines={1}>
											{folder.name}
										</Text>
										<Text className="text-muted-foreground text-xs">
											{folder.sheets.length} plans
										</Text>
									</View>
								</View>
								<Icon
									as={expandedFolders.includes(folder.id) ? ChevronDown : ChevronRight}
									className="text-muted-foreground size-5"
								/>
							</Pressable>
						</CollapsibleTrigger>
						<CollapsibleContent>
							<View className="gap-1 pt-2">
								{folder.sheets.map((sheet) => (
									<Pressable
										key={sheet.id}
										className="active:bg-muted/10 flex-row items-center gap-4 rounded-lg px-2 py-3"
									>
										<View className="bg-muted/20 size-10 items-center justify-center rounded-lg">
											<Icon as={FileText} className="text-muted-foreground size-5" />
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
						</CollapsibleContent>
					</Collapsible>
				))}
			</ScrollView>
		</View>
	);
}

function MediaTab({ isEmpty = true }: { isEmpty?: boolean }) {
	if (!isEmpty) {
		return <MediaTabPopulated />;
	}
	return (
		<Empty className="mx-4 mb-4">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<Icon as={Camera} className="text-muted-foreground size-8" />
				</EmptyMedia>
				<EmptyTitle>No Media Yet</EmptyTitle>
				<EmptyDescription>
					Photos and recordings from this project will appear here as they are captured.
				</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}

function ActivityTab() {
	return (
		<ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
			<View className="gap-6 p-4">
				{/* Daily Summary */}
				<View className="bg-muted/10 rounded-xl p-4">
					<Text className="text-foreground mb-1 text-base font-bold">
						Today's Summary
					</Text>
					<Text className="text-muted-foreground text-sm">
						5 photos captured, 1 issue flagged, 1 voice note recorded
					</Text>
				</View>

				{/* Quick Actions */}
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

				{/* Team Members */}
				<View>
					<View className="mb-3 flex-row items-end justify-between">
						<Text className="text-foreground text-lg font-bold">Team Members</Text>
						<Text className="text-primary text-sm font-medium">Manage</Text>
					</View>
					{MOCK_MEMBERS.map((member, index) => (
						<React.Fragment key={member.id}>
							<View className="flex-row items-center py-2.5">
								<View className="bg-primary/20 mr-3 size-8 items-center justify-center rounded-full">
									<Text className="text-primary text-xs font-semibold">
										{member.name.split(" ").map((n) => n[0]).join("")}
									</Text>
								</View>
								<Text className="text-foreground flex-1 text-base font-medium">
									{member.name}
									{member.role === "Owner" && (
										<Text className="text-muted-foreground ml-2 text-xs"> (you)</Text>
									)}
								</Text>
								<Text className="text-muted-foreground text-sm">{member.role}</Text>
							</View>
							{index < MOCK_MEMBERS.length - 1 && <Separator className="ml-11" />}
						</React.Fragment>
					))}
				</View>

				{/* Recent Activity */}
				<View>
					<Text className="text-foreground mb-3 text-lg font-bold">Recent Activity</Text>
					{MOCK_ACTIVITY.map((activity, index) => (
						<React.Fragment key={activity.id}>
							<View className="border-muted border-l-2 py-2.5 pl-4">
								<Text className="text-muted-foreground mb-0.5 text-xs">{activity.time}</Text>
								<Text className="text-foreground text-sm">{activity.message}</Text>
							</View>
							{index < MOCK_ACTIVITY.length - 1 && <View className="h-1" />}
						</React.Fragment>
					))}
				</View>
			</View>
		</ScrollView>
	);
}

type ActiveView = "plans" | "media" | "activity";

function ProjectWorkspace({
	initialTab = "plans",
	mediaEmpty = true,
}: {
	initialTab?: ActiveView;
	mediaEmpty?: boolean;
}) {
	const [activeView, setActiveView] = React.useState<ActiveView>(initialTab);

	return (
		<View className="bg-background" style={{ minHeight: "100vh", position: "relative" } as any}>
			{/* Header */}
			<View className="bg-background" style={{ paddingTop: 8 }}>
				<View className="min-h-[56px] flex-row items-center justify-between px-4">
					<Pressable
						className="-ml-1 items-center justify-center"
						style={{ width: 44, height: 44 }}
					>
						<Icon as={ArrowLeft} className="text-foreground size-6" />
					</Pressable>
					<View className="flex-1 items-center justify-center px-2">
						<Text className="text-foreground text-center text-base leading-tight font-bold" numberOfLines={1}>
							Holabird Ave Warehouse
						</Text>
						<Text className="text-muted-foreground mt-0.5 text-center text-[11px] leading-snug">
							4200 Holabird Ave, Baltimore, MD
						</Text>
					</View>
					<Pressable
						className="-mr-1 items-center justify-center"
						style={{ width: 44, height: 44 }}
					>
						<Icon as={Settings} className="text-foreground size-5" />
					</Pressable>
				</View>
				<View className="items-center pt-3 pb-4">
					<StorySegmentedControl
						options={["Plans", "Media", "Activity"]}
						selectedIndex={activeView === "plans" ? 0 : activeView === "media" ? 1 : 2}
						onIndexChange={(index) => {
							if (index === 0) setActiveView("plans");
							else if (index === 1) setActiveView("media");
							else setActiveView("activity");
						}}
					/>
				</View>
			</View>

			{/* Tab Content */}
			{activeView === "plans" && <PlansTab />}
			{activeView === "media" && <MediaTab isEmpty={mediaEmpty} />}
			{activeView === "activity" && <ActivityTab />}

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
				<Pressable className="bg-primary h-14 w-14 items-center justify-center rounded-full">
					<Icon
						as={activeView === "plans" ? Plus : Camera}
						className="text-primary-foreground size-6"
						strokeWidth={2.5}
					/>
				</Pressable>
			</View>
		</View>
	);
}

const meta: Meta<typeof ProjectWorkspace> = {
	title: "Screens/Project Workspace",
	component: ProjectWorkspace,
	parameters: {
		layout: "fullscreen",
	},
};

export default meta;
type Story = StoryObj<typeof ProjectWorkspace>;

export const PlansView: Story = {
	args: { initialTab: "plans" },
};

export const MediaView: Story = {
	args: { initialTab: "media", mediaEmpty: false },
};

export const MediaEmptyView: Story = {
	args: { initialTab: "media", mediaEmpty: true },
};

export const ActivityView: Story = {
	args: { initialTab: "activity" },
};
