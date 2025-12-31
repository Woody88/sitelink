import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { useProjects } from "@/lib/api";
import { ProjectCard, EmptyState, SearchBar } from "@/components/projects";
import { cn } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
  description?: string | null;
  jobNumber?: string | null;
  status?: "active" | "planning" | "archived";
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  isOfflineAvailable?: boolean;
}

export default function ProjectsScreen() {
  const insets = useSafeAreaInsets();
  const { session, organization, signOut } = useAuth();
  const organizationId = session?.activeOrganizationId ?? null;

  const { data, error, isLoading, refetch } = useProjects(organizationId);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const projects = (data?.projects ?? []) as unknown as Project[];

  // Filter and group projects
  const { activeProjects, archivedProjects } = useMemo(() => {
    const filtered = projects.filter((p) => {
      const query = searchQuery.toLowerCase();
      const matchesName = p.name.toLowerCase().includes(query);
      const matchesJobNumber = p.jobNumber?.toLowerCase().includes(query);
      return matchesName || matchesJobNumber;
    });

    return {
      activeProjects: filtered.filter((p) => p.status !== "archived"),
      archivedProjects: filtered.filter((p) => p.status === "archived"),
    };
  }, [projects, searchQuery]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleProjectPress = useCallback((project: Project) => {
    setSelectedProjectId(project.id);
  }, []);

  const handleGoToProject = useCallback(() => {
    if (selectedProjectId) {
      router.push(`/(main)/projects/${selectedProjectId}/plans`);
    }
  }, [selectedProjectId]);

  const handleCreateProject = useCallback(() => {
    router.push("/(main)/projects/new");
  }, []);

  const handleSettings = useCallback(() => {
    router.push("/(main)/settings");
  }, []);

  // Loading state
  if (isLoading && !refreshing) {
    return (
      <View
        className="flex-1 bg-background items-center justify-center"
        style={{ paddingTop: insets.top }}
      >
        <ActivityIndicator size="large" color="#c9623d" />
        <Text className="mt-4 text-muted-foreground">Loading projects...</Text>
      </View>
    );
  }

  // No organization selected
  if (!organizationId) {
    return (
      <View
        className="flex-1 bg-background px-4"
        style={{ paddingTop: insets.top }}
      >
        <View className="flex-1 items-center justify-center">
          <Ionicons name="business-outline" size={64} color="#d1d5db" />
          <Text className="text-lg text-muted-foreground text-center mt-4">
            No organization selected.
          </Text>
          <Text className="text-sm text-muted-foreground text-center mt-2">
            Please select an organization to view projects.
          </Text>
          <Pressable
            onPress={() => router.push("/(main)/orgs")}
            className="mt-6 px-6 py-3 bg-primary rounded-xl"
          >
            <Text className="text-white font-semibold">Select Organization</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View
        className="flex-1 bg-background px-4"
        style={{ paddingTop: insets.top }}
      >
        <View className="flex-1 items-center justify-center">
          <Ionicons name="alert-circle" size={64} color="#ef4444" />
          <Text className="text-lg text-destructive text-center mt-4">
            Failed to load projects
          </Text>
          <Text className="text-sm text-muted-foreground text-center mt-2">
            {error._tag === "NetworkError"
              ? "Network error. Please check your connection."
              : error.message}
          </Text>
          <Pressable
            onPress={() => refetch()}
            className="mt-6 px-6 py-3 bg-primary rounded-xl"
          >
            <Text className="text-white font-semibold">Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const hasProjects = projects.length > 0;

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View
        className="bg-background border-b border-slate-200 z-20"
        style={{ paddingTop: insets.top }}
      >
        {/* Navigation bar */}
        <View className="flex-row items-center px-4 py-3 justify-between">
          <Pressable
            onPress={handleSettings}
            className="w-12 h-12 items-center justify-center rounded-full"
          >
            <Ionicons name="menu" size={28} color="#3d3929" />
          </Pressable>
          <Text className="text-xl font-bold tracking-tight text-center flex-1">
            Select Project
          </Text>
          <Pressable
            onPress={signOut}
            className="w-12 h-12 items-center justify-center rounded-full"
          >
            <Ionicons name="log-out-outline" size={24} color="#3d3929" />
          </Pressable>
        </View>

        {/* Context sub-header */}
        <View className="px-4 pb-2">
          <Text className="text-sm text-muted-foreground text-center">
            Current Org:{" "}
            <Text className="font-semibold text-primary">
              {organization?.name ?? "Unknown"}
            </Text>
          </Text>
          {hasProjects && (
            <Text className="text-xs text-muted-foreground text-center mt-1 opacity-80">
              Select a project to view plans
            </Text>
          )}
        </View>

        {/* Search bar */}
        {hasProjects && (
          <View className="px-4 py-3 pb-4">
            <SearchBar value={searchQuery} onChangeText={setSearchQuery} />
          </View>
        )}
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: 140 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#c9623d"
          />
        }
      >
        {!hasProjects ? (
          <EmptyState organizationName={organization?.name} />
        ) : (
          <View className="gap-4">
            {/* Active projects section */}
            {activeProjects.length > 0 && (
              <>
                <View className="flex-row justify-between items-end px-1">
                  <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Active Projects ({activeProjects.length})
                  </Text>
                  <Pressable>
                    <Text className="text-xs text-primary font-medium">
                      Sort by: recent
                    </Text>
                  </Pressable>
                </View>

                {activeProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    id={project.id}
                    name={project.name}
                    jobNumber={project.jobNumber}
                    status={project.status ?? "active"}
                    isSelected={selectedProjectId === project.id}
                    isOfflineAvailable={project.isOfflineAvailable}
                    onPress={() => handleProjectPress(project)}
                  />
                ))}
              </>
            )}

            {/* Archived projects section */}
            {archivedProjects.length > 0 && (
              <>
                <View className="flex-row justify-between items-end px-1 mt-4">
                  <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground opacity-70">
                    Archived ({archivedProjects.length})
                  </Text>
                </View>

                {archivedProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    id={project.id}
                    name={project.name}
                    jobNumber={project.jobNumber}
                    status="archived"
                    isSelected={selectedProjectId === project.id}
                    isOfflineAvailable={false}
                    onPress={() => handleProjectPress(project)}
                  />
                ))}
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* Footer CTA */}
      <View
        className="absolute bottom-0 left-0 right-0 p-4 bg-background/95 border-t border-slate-200 z-30"
        style={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}
      >
        {hasProjects && selectedProjectId ? (
          <Pressable
            onPress={handleGoToProject}
            className="w-full flex-row items-center justify-center gap-3 bg-primary h-14 rounded-xl shadow-lg active:opacity-90"
            style={{
              shadowColor: "#c9623d",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.25,
              shadowRadius: 15,
              elevation: 8,
            }}
          >
            <Text className="text-lg font-bold tracking-tight text-white">
              Go to Project
            </Text>
            <Ionicons name="arrow-forward" size={20} color="#ffffff" />
          </Pressable>
        ) : (
          <Pressable
            onPress={handleCreateProject}
            className="w-full flex-row items-center justify-center gap-2 bg-primary h-14 rounded-xl shadow-lg active:opacity-90"
            style={{
              shadowColor: "#c9623d",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.25,
              shadowRadius: 15,
              elevation: 8,
            }}
          >
            <Ionicons name="add-circle" size={24} color="#ffffff" />
            <Text className="text-lg font-bold tracking-tight text-white">
              {hasProjects ? "Create New Project" : "Create First Project"}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
