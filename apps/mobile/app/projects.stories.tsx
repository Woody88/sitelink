import type { Meta, StoryObj } from "@storybook/react";
import {
	ArrowLeft,
	Bell,
	Camera,
	ChevronDown,
	ChevronRight,
	FileText,
	Folder,
	FolderOpen,
	MapPin,
	Moon,
	Plus,
	Search,
	Settings,
} from "lucide-react-native";
import * as React from "react";
import { FlatList, Pressable, ScrollView, View } from "react-native";
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
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

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

function PlansTab() {
	const [searchQuery, setSearchQuery] = React.useState("");
	const [expandedFolders, setExpandedFolders] = React.useState<string[]>(["f1"]);

	const toggleFolder = (id: string) => {
		setExpandedFolders((prev) =>
			prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id],
		);
	};

	return (
		<View className="flex-1">
			<View className="px-4 py-4">
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

function InlineWorkspace({
	project,
	onBack,
}: {
	project: Project;
	onBack: () => void;
}) {
	const [activeTab, setActiveTab] = React.useState(0);

	return (
		<View className="bg-background" style={{ minHeight: "100vh", position: "relative" } as any}>
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
						<Text className="text-foreground text-center text-base leading-tight font-bold" numberOfLines={1}>
							{project.name}
						</Text>
						{project.address && (
							<Text className="text-muted-foreground mt-0.5 text-center text-[11px] leading-snug">
								{project.address}
							</Text>
						)}
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
						selectedIndex={activeTab}
						onIndexChange={setActiveTab}
					/>
				</View>
			</View>

			{/* Tab Content */}
			{activeTab === 0 && <PlansTab />}
			{activeTab === 1 && (
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
			)}
			{activeTab === 2 && (
				<View className="p-4">
					<View className="bg-muted/10 rounded-xl p-4">
						<Text className="text-foreground mb-1 text-base font-bold">
							{"Today's Summary"}
						</Text>
						<Text className="text-muted-foreground text-sm">
							{project.photoCount} photos captured, {project.memberCount} team members active
						</Text>
					</View>
				</View>
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
				<Pressable className="bg-primary h-14 w-14 items-center justify-center rounded-full">
					<Icon
						as={activeTab === 0 ? Plus : Camera}
						className="text-primary-foreground size-6"
						strokeWidth={2.5}
					/>
				</Pressable>
			</View>
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
	const [activeFilter, setActiveFilter] = React.useState("all");
	const [activeProject, setActiveProject] = React.useState<Project | null>(null);
	const displayProjects = isEmpty ? [] : projects;

	const filteredProjects = React.useMemo(() => {
		if (activeFilter === "all") return displayProjects;
		return displayProjects.filter((p) => p.status === activeFilter);
	}, [activeFilter, displayProjects]);

	if (activeProject) {
		return (
			<InlineWorkspace
				project={activeProject}
				onBack={() => setActiveProject(null)}
			/>
		);
	}

	return (
		<View className="bg-background" style={{ minHeight: "100vh", position: "relative" } as any}>
			{/* Header */}
			<View className="border-border flex-row items-center justify-between border-b px-4 py-3">
				<Pressable
					className="items-center justify-center"
					style={{ width: 44, height: 44 }}
				>
					<Icon as={Bell} className="text-foreground size-6" />
				</Pressable>
				<Text className="text-foreground text-lg font-bold">Projects</Text>
				<Pressable
					className="items-center justify-center"
					style={{ width: 44, height: 44 }}
				>
					<Icon as={Moon} className="text-foreground size-6" />
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
							onPress={() => setActiveProject(item)}
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
						<Button className="h-12 rounded-xl px-8">
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
					className="bg-primary h-14 w-14 items-center justify-center rounded-full"
				>
					<Icon
						as={Plus}
						className="text-primary-foreground size-6"
						strokeWidth={2.5}
					/>
				</Pressable>
			</View>
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
