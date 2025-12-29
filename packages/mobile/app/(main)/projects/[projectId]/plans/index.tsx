import React, { useCallback, useState } from "react";
import {
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";
import { usePlans, useProject } from "@/lib/api";

export default function PlansScreen() {
  const insets = useSafeAreaInsets();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();

  const { data: projectData, isLoading: projectLoading } = useProject(
    projectId ?? null
  );
  const {
    data: plansData,
    error,
    isLoading: plansLoading,
    refetch,
  } = usePlans(projectId ?? null);

  const [refreshing, setRefreshing] = useState(false);

  const project = projectData;
  const plans = plansData?.plans ?? [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleBack = useCallback(() => {
    router.back();
  }, []);

  const handleOpenDrawer = useCallback(() => {
    // TODO: Open drawer menu
  }, []);

  // Helper to get processing status display
  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "completed":
        return { text: "Ready", bgClass: "bg-green-100", textClass: "text-green-700" };
      case "processing":
        return { text: "Processing", bgClass: "bg-yellow-100", textClass: "text-yellow-700" };
      case "failed":
        return { text: "Failed", bgClass: "bg-red-100", textClass: "text-red-700" };
      default:
        return { text: "Pending", bgClass: "bg-slate-100", textClass: "text-slate-600" };
    }
  };

  const isLoading = (projectLoading || plansLoading) && !refreshing;

  if (isLoading) {
    return (
      <View
        className="flex-1 bg-background items-center justify-center"
        style={{ paddingTop: insets.top }}
      >
        <ActivityIndicator size="large" color="#c9623d" />
        <Text className="mt-4 text-muted-foreground">Loading plans...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View
        className="bg-background border-b border-slate-200 z-20"
        style={{ paddingTop: insets.top }}
      >
        <View className="flex-row items-center px-4 py-3 justify-between">
          <Pressable
            onPress={handleBack}
            className="w-12 h-12 items-center justify-center rounded-full"
          >
            <Ionicons name="chevron-back" size={28} color="#3d3929" />
          </Pressable>
          <View className="flex-1 mx-4">
            <Text
              className="text-lg font-bold tracking-tight text-center"
              numberOfLines={1}
            >
              {project?.name ?? "Project"}
            </Text>
            <Text className="text-xs text-muted-foreground text-center">
              Plans
            </Text>
          </View>
          <Pressable
            onPress={handleOpenDrawer}
            className="w-12 h-12 items-center justify-center rounded-full"
          >
            <Ionicons name="menu" size={28} color="#3d3929" />
          </Pressable>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#c9623d"
          />
        }
      >
        {error ? (
          <View className="flex-1 items-center justify-center py-12">
            <Ionicons name="alert-circle" size={48} color="#ef4444" />
            <Text className="text-lg text-destructive text-center mt-4">
              Failed to load plans
            </Text>
            <Pressable
              onPress={() => refetch()}
              className="mt-4 px-6 py-3 bg-primary rounded-xl"
            >
              <Text className="text-white font-semibold">Retry</Text>
            </Pressable>
          </View>
        ) : plans.length === 0 ? (
          <View className="flex-1 items-center justify-center py-12">
            <View className="w-24 h-24 rounded-full bg-accent items-center justify-center mb-4">
              <Ionicons name="document-outline" size={48} color="#c9623d" />
            </View>
            <Text className="text-xl font-bold text-foreground mb-2">
              No Plans Yet
            </Text>
            <Text className="text-sm text-muted-foreground text-center max-w-[280px]">
              Upload your first construction plan to get started.
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1 mb-2">
              All Plans ({plans.length})
            </Text>

            {plans.map(
              (plan: {
                id: string;
                name: string;
                description?: string | null;
                processingStatus?: string | null;
                createdAt: string;
              }) => {
                const status = getStatusBadge(plan.processingStatus ?? null);

                return (
                  <Pressable
                    key={plan.id}
                    onPress={() =>
                      router.push(
                        `/(main)/projects/${projectId}/plans/${plan.id}`
                      )
                    }
                    className="w-full"
                  >
                    <View className="flex-row items-center p-4 bg-white rounded-xl border border-slate-200">
                      <View className="w-12 h-12 rounded-lg bg-accent items-center justify-center mr-4">
                        <Ionicons
                          name="document-text"
                          size={24}
                          color="#c9623d"
                        />
                      </View>
                      <View className="flex-1">
                        <Text
                          className="text-base font-semibold text-foreground"
                          numberOfLines={1}
                        >
                          {plan.name}
                        </Text>
                        <View className="flex-row items-center gap-2 mt-1">
                          <View className={`px-2 py-0.5 rounded-full ${status.bgClass}`}>
                            <Text className={`text-xs font-medium ${status.textClass}`}>
                              {status.text}
                            </Text>
                          </View>
                          <Text className="text-xs text-muted-foreground">
                            {new Date(plan.createdAt).toLocaleDateString()}
                          </Text>
                        </View>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color="#828180"
                      />
                    </View>
                  </Pressable>
                );
              }
            )}
          </View>
        )}
      </ScrollView>

      {/* Footer CTA */}
      <View
        className="absolute bottom-0 left-0 right-0 p-4 bg-background/95 border-t border-slate-200 z-30"
        style={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}
      >
        <Pressable
          onPress={() => console.log("Upload new plan")}
          className="w-full flex-row items-center justify-center gap-2 bg-primary h-14 rounded-xl shadow-lg active:opacity-90"
          style={{
            shadowColor: "#c9623d",
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.25,
            shadowRadius: 15,
            elevation: 8,
          }}
        >
          <Ionicons name="cloud-upload" size={24} color="#ffffff" />
          <Text className="text-lg font-bold tracking-tight text-white">
            Upload New Plan
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
