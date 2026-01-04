import { Project, ProjectCard } from './project-card';
import { FlatList, View } from 'react-native';
import * as React from 'react';

interface ProjectListProps {
  projects: Project[];
  activeProjectId: string | null;
  onProjectPress?: (project: Project) => void;
}

export function ProjectList({ projects, activeProjectId, onProjectPress }: ProjectListProps) {
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
