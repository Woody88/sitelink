import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";
import { useProject } from "@/lib/api";
import {
  MediaHeader,
  MediaFilterBar,
  PhotoBundleCard,
  TimelineDateHeader,
  MediaEmptyState,
  PhotoViewer,
  getSummaryStatus,
  countPendingItems,
  type WorkState,
  type DateFilter,
  type PhotoBundle,
  type PhotoData,
  type SyncStatus,
  type PhotoStatus,
} from "@/components/media";
import { BottomTabs, FloatingActionButton, type TabName } from "@/components/plans";

/**
 * Mock data for demonstration
 *
 * In production, this would come from:
 * 1. Local SQLite database (offline-first)
 * 2. Synced from backend API
 *
 * Bundles are auto-created based on:
 * - Same work state
 * - Photos taken within 30 minutes
 */
const MOCK_BUNDLES: PhotoBundle[] = [
  {
    id: "bundle-1",
    workState: "ISSUE",
    startTime: new Date(Date.now() - 0.5 * 60 * 60 * 1000),
    endTime: new Date(Date.now() - 0.3 * 60 * 60 * 1000),
    label: "Rebar spacing concern",
    capturedBy: "John D.",
    location: { latitude: 0, longitude: 0, name: "Zone B - Column C3" },
    note: "Rebar spacing appears to be 8\" instead of specified 6\". Flagged for engineer review.",
    photos: [
      {
        id: "p1",
        uri: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400",
        capturedAt: new Date(Date.now() - 0.5 * 60 * 60 * 1000),
        syncStatus: "SYNCED",
        status: "issue" as PhotoStatus,
      },
      {
        id: "p2",
        uri: "https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=400",
        capturedAt: new Date(Date.now() - 0.4 * 60 * 60 * 1000),
        syncStatus: "SYNCED",
        status: "issue" as PhotoStatus,
      },
    ],
  },
  {
    id: "bundle-2",
    workState: "IN_PROGRESS",
    startTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
    endTime: new Date(Date.now() - 1.5 * 60 * 60 * 1000),
    label: "Concrete pour - East Wing",
    capturedBy: "Maria S.",
    location: { latitude: 0, longitude: 0, name: "Zone A - East Wing" },
    planLink: { sheetId: "s1", sheetName: "A-100" },
    photos: [
      {
        id: "p3",
        uri: "https://images.unsplash.com/photo-1590687749827-66d97a2b43f5?w=400",
        capturedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        syncStatus: "SYNCED",
        status: "before" as PhotoStatus,
      },
      {
        id: "p4",
        uri: "https://images.unsplash.com/photo-1517089596392-fb9a9033e05b?w=400",
        capturedAt: new Date(Date.now() - 1.9 * 60 * 60 * 1000),
        syncStatus: "SYNCING",
        status: "progress" as PhotoStatus,
      },
      {
        id: "p5",
        uri: "https://images.unsplash.com/photo-1541976590-713941681591?w=400",
        capturedAt: new Date(Date.now() - 1.8 * 60 * 60 * 1000),
        syncStatus: "PENDING",
        status: "progress" as PhotoStatus,
      },
      {
        id: "p6",
        uri: "https://images.unsplash.com/photo-1587582423116-ec07293f0395?w=400",
        capturedAt: new Date(Date.now() - 1.7 * 60 * 60 * 1000),
        syncStatus: "SYNCED",
        status: "progress" as PhotoStatus,
      },
      {
        id: "p7",
        uri: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400",
        capturedAt: new Date(Date.now() - 1.6 * 60 * 60 * 1000),
        syncStatus: "SYNCED",
        status: "complete" as PhotoStatus,
      },
    ],
  },
  {
    id: "bundle-3",
    workState: "START",
    startTime: new Date(Date.now() - 4 * 60 * 60 * 1000),
    endTime: new Date(Date.now() - 3.5 * 60 * 60 * 1000),
    capturedBy: "John D.",
    location: { latitude: 0, longitude: 0, name: "Zone A - Foundation" },
    photos: [
      {
        id: "p8",
        uri: "https://images.unsplash.com/photo-1599708153386-62bf3f035c78?w=400",
        capturedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
        syncStatus: "SYNCED",
        status: "before" as PhotoStatus,
      },
      {
        id: "p9",
        uri: "https://images.unsplash.com/photo-1590687749827-66d97a2b43f5?w=400",
        capturedAt: new Date(Date.now() - 3.8 * 60 * 60 * 1000),
        syncStatus: "SYNCED",
        status: "before" as PhotoStatus,
      },
      {
        id: "p10",
        uri: "https://images.unsplash.com/photo-1541976590-713941681591?w=400",
        capturedAt: new Date(Date.now() - 3.6 * 60 * 60 * 1000),
        syncStatus: "SYNCED",
        status: "progress" as PhotoStatus,
      },
    ],
  },
  // Yesterday's bundles
  {
    id: "bundle-4",
    workState: "COMPLETE",
    startTime: new Date(Date.now() - 26 * 60 * 60 * 1000),
    endTime: new Date(Date.now() - 25 * 60 * 60 * 1000),
    label: "Formwork removal complete",
    capturedBy: "Carlos R.",
    location: { latitude: 0, longitude: 0, name: "Zone A - East Wing" },
    photos: [
      {
        id: "p11",
        uri: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400",
        capturedAt: new Date(Date.now() - 26 * 60 * 60 * 1000),
        syncStatus: "SYNCED",
        status: "complete" as PhotoStatus,
      },
      {
        id: "p12",
        uri: "https://images.unsplash.com/photo-1517089596392-fb9a9033e05b?w=400",
        capturedAt: new Date(Date.now() - 25.5 * 60 * 60 * 1000),
        syncStatus: "SYNCED",
        status: "complete" as PhotoStatus,
      },
    ],
  },
];

/**
 * Group bundles by date for timeline display
 */
function groupBundlesByDate(bundles: PhotoBundle[]): Map<string, PhotoBundle[]> {
  const groups = new Map<string, PhotoBundle[]>();

  bundles.forEach((bundle) => {
    const dateKey = bundle.startTime.toDateString();
    const existing = groups.get(dateKey) ?? [];
    groups.set(dateKey, [...existing, bundle]);
  });

  return groups;
}

/**
 * Count total photos in bundles
 */
function countPhotos(bundles: PhotoBundle[]): number {
  return bundles.reduce((sum, b) => sum + b.photos.length, 0);
}

/**
 * Get all photo sync statuses from bundles
 */
function getAllSyncStatuses(bundles: PhotoBundle[]): SyncStatus[] {
  return bundles.flatMap((b) => b.photos.map((p) => p.syncStatus));
}

/**
 * Media Timeline Screen
 *
 * The main view for site photos, organized by:
 * 1. Date (Today, Yesterday, etc.)
 * 2. Time-based bundles within each day
 *
 * Key features:
 * - Quick filters by work state (most important!)
 * - Auto-bundled by time + state
 * - Horizontal carousel preview in each bundle
 * - Tap bundle to see all photos
 */
export default function MediaScreen() {
  const insets = useSafeAreaInsets();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();

  const { data: projectData, isLoading: projectLoading } = useProject(
    projectId ?? null
  );

  const [refreshing, setRefreshing] = useState(false);
  const [workStateFilter, setWorkStateFilter] = useState<WorkState | "all">("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [activeTab, setActiveTab] = useState<TabName>("camera");

  // Bundles state - allows for local updates
  const [bundles, setBundles] = useState<PhotoBundle[]>(MOCK_BUNDLES);

  // Photo Viewer state
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerPhotos, setViewerPhotos] = useState<PhotoData[]>([]);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  const [viewerBundle, setViewerBundle] = useState<PhotoBundle | undefined>(undefined);

  // Filter bundles based on current filters
  const filteredBundles = useMemo(() => {
    let result = [...bundles];

    // Filter by work state
    if (workStateFilter !== "all") {
      result = result.filter((b) => b.workState === workStateFilter);
    }

    // Filter by date
    if (dateFilter !== "all") {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      result = result.filter((b) => {
        switch (dateFilter) {
          case "today":
            return b.startTime >= startOfToday;
          case "week": {
            const weekAgo = new Date(startOfToday);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return b.startTime >= weekAgo;
          }
          case "month": {
            const monthAgo = new Date(startOfToday);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return b.startTime >= monthAgo;
          }
          default:
            return true;
        }
      });
    }

    // Sort by time (newest first)
    result.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

    return result;
  }, [bundles, workStateFilter, dateFilter]);

  // Group filtered bundles by date
  const bundlesByDate = useMemo(
    () => groupBundlesByDate(filteredBundles),
    [filteredBundles]
  );

  // Calculate sync summary
  const syncSummary = useMemo(() => {
    const allStatuses = getAllSyncStatuses(bundles);
    const counts = countPendingItems(allStatuses);
    return {
      total: allStatuses.length,
      pending: counts.pending + counts.syncing,
      failed: counts.failed,
      status: getSummaryStatus(allStatuses),
    };
  }, [bundles]);

  const hasActiveFilters = workStateFilter !== "all" || dateFilter !== "all";

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // TODO: Sync with backend
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  const handleBundlePress = useCallback(
    (bundle: PhotoBundle) => {
      // Open viewer showing first photo in bundle
      setViewerPhotos(bundle.photos);
      setViewerInitialIndex(0);
      setViewerBundle(bundle);
      setViewerVisible(true);
    },
    []
  );

  const handlePhotoPress = useCallback(
    (photo: PhotoData, bundle: PhotoBundle) => {
      // Open viewer at the specific photo
      const photoIndex = bundle.photos.findIndex((p) => p.id === photo.id);
      setViewerPhotos(bundle.photos);
      setViewerInitialIndex(photoIndex >= 0 ? photoIndex : 0);
      setViewerBundle(bundle);
      setViewerVisible(true);
    },
    []
  );

  const handleCloseViewer = useCallback(() => {
    setViewerVisible(false);
  }, []);

  /**
   * Handle photo status change from the viewer
   * Updates the photo status in the local state
   *
   * In production, this would:
   * 1. Update local SQLite database
   * 2. Queue sync to backend
   * 3. Update UI optimistically
   */
  const handlePhotoStatusChange = useCallback((photoId: string, status: PhotoStatus) => {
    setBundles((prevBundles) =>
      prevBundles.map((bundle) => ({
        ...bundle,
        photos: bundle.photos.map((photo) =>
          photo.id === photoId ? { ...photo, status } : photo
        ),
      }))
    );

    // Also update the viewer photos if the viewer is open
    setViewerPhotos((prevPhotos) =>
      prevPhotos.map((photo) =>
        photo.id === photoId ? { ...photo, status } : photo
      )
    );

    console.log(`Photo ${photoId} status changed to: ${status}`);
  }, []);

  const handleAddLabel = useCallback((bundle: PhotoBundle) => {
    // TODO: Show label input modal
    console.log("Add label to bundle:", bundle.id);
  }, []);

  const handleBundleMenuPress = useCallback((bundle: PhotoBundle) => {
    // TODO: Show action sheet (Share, Edit, Delete)
    console.log("Menu for bundle:", bundle.id);
  }, []);

  const handleClearFilters = useCallback(() => {
    setWorkStateFilter("all");
    setDateFilter("all");
  }, []);

  const handleCapture = useCallback(() => {
    // TODO: Navigate to camera
    console.log("Open camera");
  }, []);

  const handleSearch = useCallback(() => {
    // TODO: Navigate to search
    console.log("Open search");
  }, []);

  const handleTabChange = useCallback((tab: TabName) => {
    setActiveTab(tab);
    switch (tab) {
      case "plans":
        router.push(`/(main)/projects/${projectId}/plans` as any);
        break;
      case "projects":
        router.push("/(main)/projects");
        break;
      case "camera":
        // Stay on media
        break;
      case "more":
        console.log("Open more menu");
        break;
    }
  }, [projectId]);

  if (projectLoading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#c9623d" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <MediaHeader
        title="Site Photos"
        subtitle={projectData?.name}
        onSearch={handleSearch}
        syncSummary={syncSummary}
      />

      {/* Filter Bar */}
      <MediaFilterBar
        workStateFilter={workStateFilter}
        dateFilter={dateFilter}
        onWorkStateChange={setWorkStateFilter}
        onDateChange={setDateFilter}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Timeline Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#c9623d"
          />
        }
      >
        {filteredBundles.length === 0 ? (
          <MediaEmptyState
            hasFilters={hasActiveFilters}
            onClearFilters={handleClearFilters}
            onCapture={handleCapture}
          />
        ) : (
          Array.from(bundlesByDate.entries()).map(([dateKey, bundles]) => (
            <View key={dateKey}>
              <TimelineDateHeader
                date={new Date(dateKey)}
                bundleCount={bundles.length}
                photoCount={countPhotos(bundles)}
              />
              {bundles.map((bundle) => (
                <PhotoBundleCard
                  key={bundle.id}
                  bundle={bundle}
                  onPress={handleBundlePress}
                  onPhotoPress={handlePhotoPress}
                  onAddLabel={handleAddLabel}
                  onMenuPress={handleBundleMenuPress}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>

      {/* FAB for quick capture */}
      <FloatingActionButton
        onPress={handleCapture}
        icon="camera"
      />

      {/* Bottom Tabs */}
      <BottomTabs activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Photo Viewer Modal */}
      <PhotoViewer
        visible={viewerVisible}
        photos={viewerPhotos}
        initialIndex={viewerInitialIndex}
        bundle={viewerBundle}
        onClose={handleCloseViewer}
        onStatusChange={handlePhotoStatusChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9f9f9",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#f9f9f9",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#828180",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 140,
  },
});
