import { ProjectFilters } from '@/components/project/project-filters';
import { ProjectList } from '@/components/project/project-list';
import { CreateProjectModal } from '@/components/project/create-project-modal';
import type { Project } from '@/components/project/project-card';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { useProject } from '@/context/project-context';
import { Stack, useRouter } from 'expo-router';
import { Filter, Plus } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

// Mock data
const MOCK_PROJECTS: Project[] = [
  {
    id: '1',
    name: 'Riverside Apartments',
    address: '123 Main St, Denver, CO',
    sheetCount: 47,
    photoCount: 84,
    memberCount: 5,
    updatedAt: '2h ago',
    status: 'active',
  },
  {
    id: '2',
    name: 'Downtown Office Remodel',
    address: '456 Market St, San Francisco, CA',
    sheetCount: 23,
    photoCount: 31,
    memberCount: 3,
    updatedAt: '1 day ago',
    status: 'active',
  },
  {
    id: '3',
    name: 'Sunset Villa',
    address: '789 Ocean Dr, Miami, FL',
    sheetCount: 12,
    photoCount: 156,
    memberCount: 8,
    updatedAt: '3 days ago',
    status: 'completed',
  },
  {
    id: '4',
    name: 'Highland Park Demo',
    sheetCount: 5,
    photoCount: 10,
    memberCount: 1,
    updatedAt: '1 week ago',
    status: 'archived',
  },
];

export default function ProjectsScreen() {
  const router = useRouter();
  const { setActiveProjectId } = useProject();
  const [filterVisible, setFilterVisible] = React.useState(false);
  const [createModalVisible, setCreateModalVisible] = React.useState(false);
  const [activeFilter, setActiveFilter] = React.useState('all');

  const filteredProjects = React.useMemo(() => {
    if (activeFilter === 'all') return MOCK_PROJECTS;
    return MOCK_PROJECTS.filter((p) => p.status === activeFilter);
  }, [activeFilter]);

  const handleCreateProject = (data: { name: string; address?: string }) => {
    console.log('Create project:', data);
    setCreateModalVisible(false);
  };

  const handleProjectPress = (project: Project) => {
    setActiveProjectId(project.id);
    router.push(`/project/${project.id}/` as any);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Projects',
          headerShown: true,
          headerRight: () => (
            <View className="flex-row gap-2">
              <Button
                size="icon"
                variant="ghost"
                className="rounded-full"
                onPress={() => setFilterVisible(true)}
              >
                <Icon as={Filter} className="size-6 text-foreground" />
              </Button>
              <Button
                size="icon"
                className="rounded-full bg-primary"
                onPress={() => setCreateModalVisible(true)}
              >
                <Icon as={Plus} className="size-6 text-primary-foreground" />
              </Button>
            </View>
          ),
        }}
      />
      <View className="flex-1 bg-background pt-4">
        <ProjectList 
          projects={filteredProjects} 
          activeProjectId={null}
          onProjectPress={handleProjectPress}
        />
      </View>

      <ProjectFilters
        isVisible={filterVisible}
        onClose={() => setFilterVisible(false)}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      <CreateProjectModal
        isVisible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSubmit={handleCreateProject}
      />
    </>
  );
}
