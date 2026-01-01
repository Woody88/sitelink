import React, { useCallback, useState, useMemo, useEffect } from "react";
import {
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { Text } from "@/components/ui/text";
import { useProject, useSheets } from "@/lib/api";
import { usePlansWithPolling } from "@/hooks/use-plans-with-polling";
import { usePlanSheetsMap } from "@/hooks/use-plan-sheets-map";
import {
  PlansHeader,
  PlansSearchBar,
  FilterModal,
  UploadProgress,
  ProcessingProgress,
  PlanCard,
  BottomTabs,
  FloatingActionButton,
  UploadBottomSheet,
  InvalidFileModal,
  type PlanCardData,
  type SheetItemData,
  type SortOption,
  type StatusFilter,
  type DisciplineFilter,
  type TabName,
  type DisciplineType,
  type StatusType,
} from "@/components/plans";
import { usePlanUpload } from "@/hooks/use-plan-upload";

// Helper to map API plan to PlanCardData
function mapPlanToCardData(
  plan: {
    readonly id: string;
    readonly name: string;
    readonly description: string | null;
    readonly processingStatus: string | null;
    readonly createdAt: Date;
  },
  sheets?: Array<{ readonly id: string; readonly status: string }>
): PlanCardData {
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

  // Calculate processed sheets
  const processedSheets = sheets?.filter((s) => s.status === "ready" || s.status === "completed").length ?? 0;
  const totalSheets = sheets?.length ?? 0;

  return {
    id: plan.id,
    name: plan.name,
    discipline,
    status,
    version: 1,
    sheetCount: totalSheets,
    markerCount: 0,
    reviewNeededCount: 0,
    sheets: [],
    processingStatus: plan.processingStatus as "pending" | "processing" | "completed" | "failed" | null,
    processedSheets,
    totalSheets: totalSheets > 0 ? totalSheets : undefined,
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
  } = usePlansWithPolling(projectId ?? null);

  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("date");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [disciplineFilter, setDisciplineFilter] = useState<DisciplineFilter>("all");
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabName>("plans");
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [planSheets, setPlanSheets] = useState<Record<string, SheetItemData[]>>({});
  const [invalidFileModalVisible, setInvalidFileModalVisible] = useState(false);
  const [uploadSheetVisible, setUploadSheetVisible] = useState(false);

  // Upload hook
  const {
    isUploading,
    uploadProgress: uploadProgressValue,
    estimatedTimeRemaining,
    currentFileName,
    error: uploadError,
    isProcessing,
    processingProgress,
    startUpload,
    cancelUpload,
    clearError,
  } = usePlanUpload();

  // Fetch sheets for expanded plan
  const { data: sheetsData, isLoading: sheetsLoading } = useSheets(expandedPlanId);

  // Update planSheets when sheets data loads
  useEffect(() => {
    if (expandedPlanId && sheetsData?.sheets && sheetsData.sheets.length > 0) {
      const mappedSheets: SheetItemData[] = sheetsData.sheets.map((sheet) => {
        // Map processing status to display text
        const statusMap: Record<string, string> = {
          pending: "Pending",
          processing: "Processing tiles...",
          ready: "Ready to view",
          completed: "Ready to view",
          failed: "Processing failed",
        };
        const displayStatus = statusMap[sheet.processingStatus] ?? "Unknown";

        return {
          id: sheet.id,
          sheetId: sheet.sheetName ?? `Sheet ${sheet.pageNumber}`,
          name: sheet.sheetName ?? `Page ${sheet.pageNumber}`,
          status: displayStatus,
          confidence: sheet.markerCount > 0 ? 85 : undefined, // Only show confidence if markers detected
          thumbnailUrl: undefined,
        };
      });
      setPlanSheets((prev) => ({
        ...prev,
        [expandedPlanId]: mappedSheets,
      }));
    }
  }, [expandedPlanId, sheetsData]);

  const project = projectData;

  // Use API data if available, otherwise use mock data for demo
  const apiPlans = plansData?.plans ?? [];

  // Fetch sheets for all plans to get processing progress
  const planIds = apiPlans.map((p) => p.id);
  const { sheetsMap } = usePlanSheetsMap(planIds);

  const basePlans = apiPlans.length > 0
    ? apiPlans.map((plan) => mapPlanToCardData(plan, sheetsMap[plan.id]))
    : MOCK_PLANS;

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
    setUploadSheetVisible(true);
  }, []);

  const handleUploadSheetClose = useCallback(() => {
    setUploadSheetVisible(false);
  }, []);

  const handleSelectUploadSource = useCallback(
    async (source: "device" | "dropbox" | "google-drive") => {
      if (source !== "device") return;

      // Close the bottom sheet
      setUploadSheetVisible(false);

      // Open document picker for PDF files
      try {
        const result = await DocumentPicker.getDocumentAsync({
          type: "application/pdf",
          copyToCacheDirectory: true,
        });

        if (result.canceled || !result.assets?.[0]) return;

        const file = result.assets[0];

        // Validate file
        if (!file.mimeType?.includes("pdf") && !file.name?.endsWith(".pdf")) {
          setInvalidFileModalVisible(true);
          return;
        }

        // Start upload
        if (projectId) {
          const success = await startUpload(projectId, file);
          if (success) {
            // Refetch plans to show the new one
            refetch();
          }
        }
      } catch (error) {
        console.error("Document picker error:", error);
        // Show user-friendly error if native module missing
        if (String(error).includes("Cannot find native module")) {
          Alert.alert(
            "Rebuild Required",
            "Please rebuild the app with EAS to enable file uploads:\n\neas build --profile development --platform android",
            [{ text: "OK" }]
          );
        } else {
          Alert.alert(
            "Error",
            "Failed to open document picker. Please try again.",
            [{ text: "OK" }]
          );
        }
      }
    },
    [projectId, startUpload, refetch]
  );

  const handleInvalidFileClose = useCallback(() => {
    setInvalidFileModalVisible(false);
    clearError();
  }, [clearError]);

  const handleTryDifferentFile = useCallback(() => {
    setInvalidFileModalVisible(false);
    clearError();
    // Re-open the upload sheet
    setUploadSheetVisible(true);
  }, [clearError]);

  // Show invalid file modal when upload error is invalid_file
  useEffect(() => {
    if (uploadError === "invalid_file") {
      setInvalidFileModalVisible(true);
    }
  }, [uploadError]);

  const handleTabChange = useCallback((tab: TabName) => {
    setActiveTab(tab);
    switch (tab) {
      case "projects":
        router.push("/(main)/projects");
        break;
      case "camera":
        router.push(`/(main)/projects/${projectId}/media` as any);
        break;
      case "more":
        console.log("Open more menu");
        break;
      default:
        break;
    }
  }, [projectId]);

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
      {isUploading && currentFileName && (
        <UploadProgress
          fileName={currentFileName}
          progress={uploadProgressValue}
          estimatedTimeRemaining={estimatedTimeRemaining}
          onCancel={cancelUpload}
        />
      )}

      {/* Processing Progress - shown after upload completes */}
      {isProcessing && currentFileName && (
        <ProcessingProgress
          fileName={currentFileName}
          progress={processingProgress}
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

      {/* Upload Bottom Sheet */}
      <UploadBottomSheet
        visible={uploadSheetVisible}
        onSelectSource={handleSelectUploadSource}
        onClose={handleUploadSheetClose}
      />

      {/* Invalid File Modal */}
      <InvalidFileModal
        visible={invalidFileModalVisible}
        onClose={handleInvalidFileClose}
        onTryDifferentFile={handleTryDifferentFile}
      />
    </View>
  );
}
