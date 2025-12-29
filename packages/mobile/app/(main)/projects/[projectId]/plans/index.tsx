import React, { useCallback, useState, useMemo, useEffect } from "react";
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
import { usePlans, useProject, useSheets } from "@/lib/api";
import {
  PlansHeader,
  PlansSearchBar,
  FilterModal,
  UploadProgress,
  PlanCard,
  BottomTabs,
  FloatingActionButton,
  type PlanCardData,
  type SheetItemData,
  type SortOption,
  type StatusFilter,
  type DisciplineFilter,
  type TabName,
  type DisciplineType,
  type StatusType,
} from "@/components/plans";

// Helper to map API plan to PlanCardData
function mapPlanToCardData(plan: {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly processingStatus: string | null;
  readonly createdAt: Date;
}): PlanCardData {
  // Extract discipline from plan name (e.g., "A-100" -> ARCH, "E-200" -> ELEC)
  const disciplineMap: Record<string, DisciplineType> = {
    A: "ARCH",
    E: "ELEC",
    S: "STRUCT",
    M: "MECH",
    P: "PLUMB",
    C: "CIVIL",
  };
  const prefix = plan.name.charAt(0).toUpperCase();
  const discipline = disciplineMap[prefix] ?? "ARCH";

  // Map processing status to display status
  const statusMap: Record<string, StatusType> = {
    completed: "APPROVED",
    processing: "REVIEW",
    failed: "DRAFT",
  };
  const status = statusMap[plan.processingStatus ?? ""] ?? "PENDING";

  return {
    id: plan.id,
    name: plan.name,
    discipline,
    status,
    version: 1,
    sheetCount: 0,
    markerCount: 0,
    reviewNeededCount: 0,
    sheets: [],
  };
}

// Mock data for demo purposes - remove when API provides full data
const MOCK_PLANS: PlanCardData[] = [
  {
    id: "1",
    name: "A-100: Ground Floor Plan",
    discipline: "ARCH",
    status: "APPROVED",
    version: 3,
    sheetCount: 4,
    markerCount: 12,
    reviewNeededCount: 0,
    sheets: [
      {
        id: "s1",
        sheetId: "MK-492",
        name: "Electrical Issue",
        status: "Confirmed by AI",
        confidence: 98,
      },
      {
        id: "s2",
        sheetId: "MK-493",
        name: "Foundation Detail",
        status: "Pending review",
        confidence: 85,
      },
      {
        id: "s3",
        sheetId: "MK-494",
        name: "Wall Section A",
        status: "Confirmed by AI",
        confidence: 92,
      },
      {
        id: "s4",
        sheetId: "MK-495",
        name: "Door Schedule",
        status: "Confirmed by AI",
        confidence: 99,
      },
    ],
  },
  {
    id: "2",
    name: "E-200: Electrical Layout",
    discipline: "ELEC",
    status: "DRAFT",
    version: 1,
    sheetCount: 2,
    markerCount: 0,
    reviewNeededCount: 1,
    sheets: [
      {
        id: "s5",
        sheetId: "MK-500",
        name: "Panel Schedule",
        status: "Pending review",
        confidence: 45,
      },
      {
        id: "s6",
        sheetId: "MK-501",
        name: "Lighting Plan",
        status: "Confirmed by AI",
        confidence: 88,
      },
    ],
  },
  {
    id: "3",
    name: "S-105: Foundation Details",
    discipline: "STRUCT",
    status: "REVIEW",
    version: 5,
    sheetCount: 8,
    markerCount: 5,
    reviewNeededCount: 2,
    sheets: [
      {
        id: "s7",
        sheetId: "MK-510",
        name: "Footing Detail",
        status: "Pending review",
        confidence: 32,
      },
      {
        id: "s8",
        sheetId: "MK-511",
        name: "Rebar Schedule",
        status: "Potential anomaly",
        confidence: 22,
      },
    ],
  },
];

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
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("date");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [disciplineFilter, setDisciplineFilter] = useState<DisciplineFilter>("all");
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabName>("plans");
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [planSheets, setPlanSheets] = useState<Record<string, SheetItemData[]>>({});

  // Upload progress state - null when not uploading
  const [uploadProgress, setUploadProgress] = useState<{
    fileName: string;
    progress: number;
  } | null>(null);

  // Fetch sheets for expanded plan
  const { data: sheetsData, isLoading: sheetsLoading } = useSheets(expandedPlanId);

  // Update planSheets when sheets data loads
  useEffect(() => {
    if (expandedPlanId && sheetsData?.sheets && sheetsData.sheets.length > 0) {
      const mappedSheets: SheetItemData[] = sheetsData.sheets.map((sheet) => ({
        id: sheet.id,
        sheetId: sheet.sheetName ?? `Sheet ${sheet.pageNumber}`,
        name: sheet.sheetName ?? `Page ${sheet.pageNumber}`,
        status: sheet.processingStatus === "completed" ? "Ready" : "Processing",
        confidence: 85, // Default - would come from markers API
        thumbnailUrl: undefined,
      }));
      setPlanSheets((prev) => ({
        ...prev,
        [expandedPlanId]: mappedSheets,
      }));
    }
  }, [expandedPlanId, sheetsData]);

  const project = projectData;

  // Use API data if available, otherwise use mock data for demo
  const apiPlans = plansData?.plans ?? [];
  const basePlans = apiPlans.length > 0 ? apiPlans.map(mapPlanToCardData) : MOCK_PLANS;

  // Merge sheets into plans
  const plans = basePlans.map((plan) => ({
    ...plan,
    sheets: planSheets[plan.id] ?? plan.sheets ?? [],
  }));

  const hasActiveFilters = statusFilter !== "all" || disciplineFilter !== "all";

  // Filter and sort plans
  const filteredPlans = useMemo(() => {
    let result = [...plans];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (plan) =>
          plan.name.toLowerCase().includes(query) ||
          plan.discipline.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      const statusMapping: Record<Exclude<StatusFilter, "all">, StatusType[]> = {
        active: ["APPROVED"],
        draft: ["DRAFT", "PENDING"],
        review: ["REVIEW"],
      };
      const allowedStatuses = statusMapping[statusFilter];
      result = result.filter((plan) => allowedStatuses.includes(plan.status));
    }

    // Discipline filter
    if (disciplineFilter !== "all") {
      const disciplineMapping: Record<Exclude<DisciplineFilter, "all">, DisciplineType> = {
        arch: "ARCH",
        elec: "ELEC",
        struct: "STRUCT",
        mech: "MECH",
      };
      const targetDiscipline = disciplineMapping[disciplineFilter];
      result = result.filter((plan) => plan.discipline === targetDiscipline);
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "discipline":
          return a.discipline.localeCompare(b.discipline);
        case "date":
        default:
          return 0;
      }
    });

    return result;
  }, [plans, searchQuery, sortBy, statusFilter, disciplineFilter]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleToggleExpand = useCallback((planId: string) => {
    setExpandedPlanId((prev) => (prev === planId ? null : planId));
  }, []);

  const handleSheetPress = useCallback((sheet: SheetItemData, planId: string) => {
    // Navigate to viewer with the specific sheet
    router.push(`/(main)/projects/${projectId}/plans/${planId}?sheetId=${sheet.id}` as any);
  }, [projectId]);

  const handlePlanMenuPress = useCallback((plan: PlanCardData) => {
    console.log("Menu pressed for plan:", plan.id);
    // Show action sheet
  }, []);

  const handleFabPress = useCallback(() => {
    console.log("FAB pressed - upload new plan");
    // Show upload modal or navigate to upload screen
  }, []);

  const handleTabChange = useCallback((tab: TabName) => {
    setActiveTab(tab);
    switch (tab) {
      case "projects":
        router.push("/(main)/projects");
        break;
      case "camera":
        console.log("Open camera");
        break;
      case "more":
        console.log("Open more menu");
        break;
      default:
        break;
    }
  }, []);

  const handleResetFilters = useCallback(() => {
    setSortBy("date");
    setStatusFilter("all");
    setDisciplineFilter("all");
  }, []);

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
      <PlansHeader
        projectName={project?.name ?? "Westside Hospital"}
        syncStatus="SYNCED: JUST NOW"
        onFilterPress={() => setFilterModalVisible(true)}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Upload Progress - only shown when uploading */}
      {uploadProgress && (
        <UploadProgress
          fileName={uploadProgress.fileName}
          progress={uploadProgress.progress}
        />
      )}

      {/* Search Bar */}
      <View className="px-4 py-3">
        <PlansSearchBar value={searchQuery} onChangeText={setSearchQuery} />
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 140 }}
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
              <Text className="text-primary-foreground font-semibold">Retry</Text>
            </Pressable>
          </View>
        ) : filteredPlans.length === 0 ? (
          <View className="flex-1 items-center justify-center py-12">
            <View className="w-24 h-24 rounded-full bg-accent items-center justify-center mb-4">
              <Ionicons name="document-outline" size={48} color="#c9623d" />
            </View>
            <Text className="text-xl font-bold text-foreground mb-2">
              No Plans Found
            </Text>
            <Text className="text-sm text-muted-foreground text-center max-w-[280px]">
              {searchQuery || hasActiveFilters
                ? "Try adjusting your search or filters."
                : "Upload your first construction plan to get started."}
            </Text>
          </View>
        ) : (
          <View>
            {filteredPlans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isExpanded={expandedPlanId === plan.id}
                isLoadingSheets={expandedPlanId === plan.id && sheetsLoading}
                onToggleExpand={handleToggleExpand}
                onSheetPress={handleSheetPress}
                onMenuPress={handlePlanMenuPress}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Filter Modal */}
      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        sortBy={sortBy}
        statusFilter={statusFilter}
        disciplineFilter={disciplineFilter}
        onSortChange={setSortBy}
        onStatusChange={setStatusFilter}
        onDisciplineChange={setDisciplineFilter}
        onReset={handleResetFilters}
      />

      {/* Floating Action Button */}
      <FloatingActionButton onPress={handleFabPress} />

      {/* Bottom Tabs */}
      <BottomTabs activeTab={activeTab} onTabChange={handleTabChange} />
    </View>
  );
}
