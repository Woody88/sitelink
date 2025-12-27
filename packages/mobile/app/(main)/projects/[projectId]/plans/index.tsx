import { View, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { Link, useLocalSearchParams, router } from 'expo-router';
import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { usePlans, useProject } from '@/lib/api';
import { ChevronLeft } from 'lucide-react-native';

export default function PlansScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();

  const { data: projectData, isLoading: projectLoading } = useProject(projectId ?? null);
  const { data, error, isLoading, refetch } = usePlans(projectId ?? null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    refetch();
    setRefreshing(false);
  }, [refetch]);

  // Loading state
  if ((isLoading || projectLoading) && !refreshing) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#0066CC" />
        <Text className="mt-4 text-muted-foreground">Loading plans...</Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View className="flex-1 bg-white px-6 py-6">
        <View className="gap-2 mb-4">
          <Text className="text-3xl font-bold text-foreground">Plans</Text>
        </View>
        <View className="flex-1 items-center justify-center">
          <Text className="text-lg text-destructive text-center">
            Failed to load plans
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

  const plans = data?.plans ?? [];
  const projectName = projectData?.name ?? 'Project';

  // Helper to get processing status display
  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'completed':
        return { text: 'Ready', className: 'bg-green-100' };
      case 'processing':
        return { text: 'Processing', className: 'bg-yellow-100' };
      case 'failed':
        return { text: 'Failed', className: 'bg-red-100' };
      default:
        return { text: 'Pending', className: 'bg-muted' };
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-white"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View className="flex-1 px-6 py-6 gap-4">
        {/* Header with back button */}
        <Pressable
          className="flex-row items-center gap-2 mb-2"
          onPress={() => router.back()}
        >
          <ChevronLeft size={20} color="#666" />
          <Text className="text-muted-foreground">Back to Projects</Text>
        </Pressable>

        <View className="gap-2 mb-4">
          <Text className="text-3xl font-bold text-foreground">Plans</Text>
          <Text className="text-base text-muted-foreground">
            {projectName}
          </Text>
        </View>

        {plans.length === 0 ? (
          <View className="items-center justify-center py-12">
            <Text className="text-lg text-muted-foreground text-center">
              No plans yet
            </Text>
            <Text className="text-sm text-muted-foreground text-center mt-2">
              Upload your first plan to get started
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {plans.map((plan) => {
              const status = getStatusBadge(plan.processingStatus);

              return (
                <Link
                  key={plan.id}
                  href={`/(main)/projects/${projectId}/plans/${plan.id}`}
                  asChild
                >
                  <Pressable className="border border-input rounded-lg p-4 bg-card active:bg-accent">
                    <View className="gap-2">
                      <Text className="text-lg font-semibold text-foreground">
                        {plan.name}
                      </Text>
                      {plan.description && (
                        <Text className="text-sm text-muted-foreground" numberOfLines={2}>
                          {plan.description}
                        </Text>
                      )}
                      <View className="flex-row items-center gap-3">
                        <View className={`px-2 py-1 rounded ${status.className}`}>
                          <Text className="text-xs font-medium text-muted-foreground">
                            {status.text}
                          </Text>
                        </View>
                        <Text className="text-xs text-muted-foreground">
                          {new Date(plan.createdAt).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                </Link>
              );
            })}
          </View>
        )}

        <Button
          className="mt-4"
          onPress={() => console.log('Add new plan')}
        >
          <Text>Upload New Plan</Text>
        </Button>
      </View>
    </ScrollView>
  );
}
