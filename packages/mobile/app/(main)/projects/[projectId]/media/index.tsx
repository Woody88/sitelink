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
import { useProject, useMedia, MediaApi } from "@/lib/api";
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
 * Convert API media items to PhotoBundle format
 *
 * In production with full backend support, bundles would be:
 * 1. Created based on work state + time proximity
 * 2. Stored in the database
 * 3. Synced to mobile
 *
 * For now, we create simple bundles from individual media items
 */
function convertMediaToBundles(
  mediaItems: readonly {
    readonly id: string;
    readonly filePath: string | null;
    readonly mediaType: string | null;
    readonly createdAt: string;
  }[]
): PhotoBundle[] {
  if (!mediaItems.length) return [];

  // Group by date (simple bundling for now)
  const bundlesByDate = new Map<string, PhotoBundle>();

  mediaItems.forEach((item) => {
    const createdAt = new Date(item.createdAt);
    const dateKey = createdAt.toDateString();
    const downloadUrl = MediaApi.getDownloadUrl(item.id);

    const photo: PhotoData = {
      id: item.id,
      uri: downloadUrl,
      capturedAt: createdAt,
      syncStatus: "SYNCED" as SyncStatus,
      status: undefined,
    };

    if (bundlesByDate.has(dateKey)) {
      const bundle = bundlesByDate.get(dateKey)!;
      bundle.photos.push(photo);
      // Update end time if this photo is newer
      if (createdAt > bundle.endTime) {
        bundle.endTime = createdAt;
      }
    } else {
      // Create new bundle for this date
      const bundle: PhotoBundle = {
        id: `bundle-${dateKey}`,
        workState: "IN_PROGRESS" as WorkState,
        startTime: createdAt,
        endTime: createdAt,
        capturedBy: "You",
        location: { latitude: 0, longitude: 0, name: "Project Site" },
        photos: [photo],
      };
      bundlesByDate.set(dateKey, bundle);
    }
  });

  // Convert to array and sort by date (newest first)
  return Array.from(bundlesByDate.values()).sort(
    (a, b) => b.startTime.getTime() - a.startTime.getTime()
  );
}

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

  // Fetch real media data from API
  const {
    data: mediaData,
    isLoading: mediaLoading,
    refetch: refetchMedia,
  } = useMedia(projectId ?? null);

  const [refreshing, setRefreshing] = useState(false);
  const [workStateFilter, setWorkStateFilter] = useState<WorkState | "all">("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [activeTab, setActiveTab] = useState<TabName>("camera");

  // Convert API media to bundles
  const bundles = useMemo(() => {
    if (!mediaData?.media) return [];
    return convertMediaToBundles(mediaData.media);
  }, [mediaData]);

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
    await refetchMedia();
    setRefreshing(false);
  }, [refetchMedia]);

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
    // Also update the viewer photos if the viewer is open
    setViewerPhotos((prevPhotos) =>
      prevPhotos.map((photo) =>
        photo.id === photoId ? { ...photo, status } : photo
      )
    );

    // TODO: Update status via API when backend supports it
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
    // Navigate to camera screen
    router.push(`/(main)/projects/${projectId}/media/camera` as any);
  }, [projectId]);

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

  if (projectLoading || mediaLoading) {
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
