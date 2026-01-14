import * as React from "react";
import { FlatList, View } from "react-native";
import { type Project, ProjectCard } from "./project-card";

interface ProjectListProps {
	projects: Project[];
	activeProjectId: string | null;
	onProjectPress?: (project: Project) => void;
}

export function ProjectList({
	projects,
	activeProjectId,
	onProjectPress,
}: ProjectListProps) {
	return (
		<FlatList
			data={projects}
			renderItem={({ item }) => (
				<View className="mb-4 px-4">
					<ProjectCard
						project={item}
						onPress={onProjectPress}
						isActive={item.id === activeProjectId}
					/>
				</View>
			)}
			keyExtractor={(item) => item.id}
			contentContainerClassName="py-4"
		/>
	);
}
