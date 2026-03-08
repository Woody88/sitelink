import type { Meta, StoryObj } from "@storybook/react";
import {
	Bell,
	FolderOpen,
	MapPin,
	Moon,
	Plus,
} from "lucide-react-native";
import * as React from "react";
import { FlatList, Pressable, ScrollView, View } from "react-native";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Icon } from "@/components/ui/icon";
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
}: {
	project: Project;
	isLast?: boolean;
}) {
	const todayActivity = project.id === "1" ? { photos: 12, issues: 1 } : null;

	return (
		<>
			<Pressable
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

function ProjectsScreen({
	projects = MOCK_PROJECTS,
	isEmpty = false,
}: {
	projects?: Project[];
	isEmpty?: boolean;
}) {
	const [activeFilter, setActiveFilter] = React.useState("all");
	const displayProjects = isEmpty ? [] : projects;

	const filteredProjects = React.useMemo(() => {
		if (activeFilter === "all") return displayProjects;
		return displayProjects.filter((p) => p.status === activeFilter);
	}, [activeFilter, displayProjects]);

	return (
		<View className="bg-background flex-1">
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
						/>
					)}
					keyExtractor={(item) => item.id}
				/>
			) : (
				<Empty>
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
