import { nanoid } from "@livestore/livestore";
import { events } from "@sitelink/domain";
import { Stack, useRouter } from "expo-router";
import {
	Bell,
	FolderOpen,
	MapPin,
	Moon,
	Plus,
	Sun,
	User,
} from "lucide-react-native";
import * as React from "react";
import {
	ActivityIndicator,
	Appearance,
	FlatList,
	Pressable,
	ScrollView,
	View,
} from "react-native";
import { useUniwind } from "uniwind";
import { CreateProjectModal } from "@/components/project/create-project-modal";
import type { Project } from "@/components/project/project-card";
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
import { SyncStatus } from "@/components/SyncStatus";
import { WorkspaceFAB } from "@/components/workspace/camera-fab";
import { useProject } from "@/context/project-context";
import { useProjects } from "@/hooks/use-projects";
import { useSessionContext } from "@/lib/session-context";
import { cn } from "@/lib/utils";

interface FilterChipProps {
	label: string;
	isActive: boolean;
	onPress: () => void;
}

const FilterChip = React.memo(function FilterChip({
	label,
	isActive,
	onPress,
}: FilterChipProps) {
	return (
		<Pressable
			onPress={onPress}
			className={cn(
				"mr-2 items-center justify-center rounded-full px-4",
				isActive ? "bg-foreground" : "bg-muted",
			)}
			style={{ height: 32, borderRadius: 16 }}
			accessibilityRole="button"
			accessibilityLabel={`Filter by ${label}`}
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
});

// Project List Item - Wealthsimple style with separator
interface ProjectListItemProps {
	project: Project;
	onPress: (project: Project) => void;
	isLast?: boolean;
}

const ProjectListItem = React.memo(function ProjectListItem({
	project,
	onPress,
	isLast = false,
}: ProjectListItemProps) {
	// Mock activity data - in real app, this would come from project stats
	const todayActivity = project.id === "1" ? { photos: 12, issues: 1 } : null;

	return (
		<>
			<Pressable
				onPress={() => onPress(project)}
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

				{/* Activity Indicator */}
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
});

export default function ProjectsScreen() {
	const { organizationId, userId, isReady } = useSessionContext();

	if (!organizationId || !userId || !isReady) {
		return (
			<>
				<Stack.Screen
					options={{
						headerTitle: () => (
							<Text className="text-foreground text-lg font-bold">
								Projects
							</Text>
						),
						headerShown: true,
						headerShadowVisible: false,
						headerTitleAlign: "center",
					}}
				/>
				<View className="bg-background flex-1 items-center justify-center">
					<ActivityIndicator size="large" />
					<Text className="text-muted-foreground mt-4">
						Loading your workspace...
					</Text>
				</View>
			</>
		);
	}

	return <ProjectsContent organizationId={organizationId} userId={userId} />;
}

function ProjectsContent({
	organizationId,
	userId,
}: {
	organizationId: string;
	userId: string;
}) {
	const router = useRouter();
	const { setActiveProjectId } = useProject();
	const { theme } = useUniwind();
	const [createModalVisible, setCreateModalVisible] = React.useState(false);
	const [activeFilter, setActiveFilter] = React.useState("all");

	const { projects, store } = useProjects();
	const isLoading = !Array.isArray(projects);

	const toggleTheme = React.useCallback(() => {
		Appearance.setColorScheme(theme === "dark" ? "light" : "dark");
	}, [theme]);

	const filteredProjects = React.useMemo(() => {
		if (isLoading || !projects) return [];
		if (activeFilter === "all") return projects;
		return projects.filter((p) => p.status === activeFilter);
	}, [activeFilter, projects, isLoading]);

	const handleProjectPress = React.useCallback(
		(project: Project) => {
			setActiveProjectId(project.id);
			router.push(`/project/${project.id}/` as any);
		},
		[setActiveProjectId, router],
	);

	const handleNotifications = React.useCallback(() => {
		router.push("/notifications" as any);
	}, [router]);

	const handleProfile = React.useCallback(() => {
		router.push("/settings" as any);
	}, [router]);

	return (
		<>
			<Stack.Screen
				options={{
					headerTitle: () => (
						<View className="items-center gap-0.5">
							<Text className="text-foreground text-lg font-bold">Projects</Text>
							<SyncStatus showText size="sm" checkInterval={15000} />
						</View>
					),
					headerShown: true,
					headerShadowVisible: false,
					headerTitleAlign: "center",
					headerLeft: () => (
						<Pressable
							onPress={handleNotifications}
							className="-ml-2 items-center justify-center"
							style={{ width: 44, height: 44 }}
							accessibilityRole="button"
							accessibilityLabel="Notifications"
						>
							<Icon as={Bell} className="text-foreground size-6" />
							{/* TODO: Add badge for unread count */}
						</Pressable>
					),
					headerRight: () => (
						<View className="flex-row items-center pr-1">
							<Pressable
								onPress={handleProfile}
								className="items-center justify-center"
								style={{ width: 44, height: 44 }}
								accessibilityRole="button"
								accessibilityLabel="Profile"
							>
								<Icon as={User} className="text-foreground size-6" />
							</Pressable>
							<Pressable
								onPress={toggleTheme}
								className="-mr-2 items-center justify-center"
								style={{ width: 44, height: 44 }}
								accessibilityRole="button"
								accessibilityLabel="Toggle theme"
							>
								<Icon
									as={theme === "dark" ? Sun : Moon}
									className="text-foreground size-6"
								/>
							</Pressable>
						</View>
					),
				}}
			/>

			<View className="bg-background flex-1">
				{/* Horizontal Filter Chips - Sleek Design */}
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

				{/* Project List - Clean design matching other screens */}
				{isLoading ? (
					<View className="flex-1 items-center justify-center">
						<ActivityIndicator size="large" />
						<Text className="text-muted-foreground mt-4">
							Loading projects...
						</Text>
					</View>
				) : filteredProjects.length > 0 ? (
					<FlatList
						data={filteredProjects}
						renderItem={({ item, index }) => (
							<ProjectListItem
								project={item}
								onPress={handleProjectPress}
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
							<Button
								onPress={() => setCreateModalVisible(true)}
								className="h-12 rounded-xl px-8"
							>
								<Text className="text-primary-foreground text-base font-bold">
									Create Project
								</Text>
							</Button>
						</EmptyContent>
					</Empty>
				)}
			</View>

			<CreateProjectModal
				isVisible={createModalVisible}
				onClose={() => setCreateModalVisible(false)}
				onSubmit={(data) => {
					if (!store) return;

					const projectId = nanoid();
					store.commit(
						events.projectCreated({
							id: projectId,
							organizationId,
							name: data.name,
							address: data.address || undefined,
							createdBy: userId,
							createdAt: Date.now(),
						}),
					);
					setCreateModalVisible(false);
				}}
			/>

			<WorkspaceFAB onPress={() => setCreateModalVisible(true)} icon={Plus} />
		</>
	);
}
