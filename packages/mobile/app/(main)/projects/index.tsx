import { View, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { Link } from 'expo-router';
import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth-context';
import { useProjects } from '@/lib/api';

export default function ProjectsScreen() {
  const { session } = useAuth();
  const organizationId = session?.activeOrganizationId ?? null;

  const { data, error, isLoading, refetch } = useProjects(organizationId);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refetch();
    setRefreshing(false);
  }, [refetch]);

  // Loading state
  if (isLoading && !refreshing) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#0066CC" />
        <Text className="mt-4 text-muted-foreground">Loading projects...</Text>
      </View>
    );
  }

  // No organization selected
  if (!organizationId) {
    return (
      <View className="flex-1 bg-white px-6 py-6">
        <View className="gap-2 mb-4">
          <Text className="text-3xl font-bold text-foreground">Projects</Text>
        </View>
        <View className="flex-1 items-center justify-center">
          <Text className="text-lg text-muted-foreground text-center">
            No organization selected.
          </Text>
          <Text className="text-sm text-muted-foreground text-center mt-2">
            Please select an organization to view projects.
          </Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View className="flex-1 bg-white px-6 py-6">
        <View className="gap-2 mb-4">
          <Text className="text-3xl font-bold text-foreground">Projects</Text>
        </View>
        <View className="flex-1 items-center justify-center">
          <Text className="text-lg text-destructive text-center">
            Failed to load projects
          </Text>
          <Text className="text-sm text-muted-foreground text-center mt-2">
            {error._tag === 'NetworkError' ? 'Network error. Please check your connection.' : error.message}
          </Text>
          <Button className="mt-4" onPress={() => refetch()}>
            <Text>Retry</Text>
          </Button>
        </View>
      </View>
    );
  }

  const projects = data?.projects ?? [];

  return (
    <ScrollView
      className="flex-1 bg-white"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View className="flex-1 px-6 py-6 gap-4">
        <View className="gap-2 mb-4">
          <Text className="text-3xl font-bold text-foreground">Projects</Text>
          <Text className="text-base text-muted-foreground">
            Manage your construction projects and plans
          </Text>
        </View>

        {projects.length === 0 ? (
          <View className="items-center justify-center py-12">
            <Text className="text-lg text-muted-foreground text-center">
              No projects yet
            </Text>
            <Text className="text-sm text-muted-foreground text-center mt-2">
              Create your first project to get started
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/(main)/projects/${project.id}/plans`}
                asChild
              >
                <Pressable className="border border-input rounded-lg p-4 bg-card active:bg-accent">
                  <View className="gap-2">
                    <Text className="text-lg font-semibold text-foreground">
                      {project.name}
                    </Text>
                    {project.description && (
                      <Text className="text-sm text-muted-foreground" numberOfLines={2}>
                        {project.description}
                      </Text>
                    )}
                    <View className="flex-row items-center gap-2">
                      <Text className="text-xs text-muted-foreground">
                        Created {new Date(project.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              </Link>
            ))}
          </View>
        )}

        <Button
          className="mt-4"
          onPress={() => console.log('Add new project')}
        >
          <Text>Add New Project</Text>
        </Button>
      </View>
    </ScrollView>
  );
}
