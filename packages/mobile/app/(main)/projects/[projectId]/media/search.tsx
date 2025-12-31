import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  ScrollView,
  TextInput,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";
import { MediaApi } from "@/lib/api";
import Toast from 'react-native-toast-message';
import {
  PhotoThumbnail,
  PhotoViewer,
  PhotoStatusBadge,
  SearchFilters,
  type PhotoData,
  type PhotoStatus,
  type SyncStatus,
} from "@/components/media";

/**
 * Media Search Screen
 *
 * Advanced search with:
 * - Text search with debouncing
 * - Status filters (before/progress/complete/issue)
 * - Date range filtering
 * - Infinite scroll
 * - Pull to refresh
 * - Photo grid results (2 columns)
 */
export default function MediaSearchScreen() {
  const insets = useSafeAreaInsets();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filters, setFilters] = useState<{
    status?: PhotoStatus;
    dateFrom?: string;
    dateTo?: string;
  }>({});

  // Pagination state
  const [offset, setOffset] = useState(0);
  const [allResults, setAllResults] = useState<PhotoData[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Photo viewer state
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerPhotos, setViewerPhotos] = useState<PhotoData[]>([]);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      // Reset pagination when search changes
      setOffset(0);
      setAllResults([]);
      setHasMore(true);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Convert API media to PhotoData
  const convertToPhotoData = useCallback((item: any): PhotoData => {
    const downloadUrl = MediaApi.getDownloadUrl(item.id);
    return {
      id: item.id,
      uri: downloadUrl,
      capturedAt: new Date(item.createdAt),
      syncStatus: "SYNCED" as SyncStatus,
      status: item.status as PhotoStatus | undefined,
      description: item.description ?? undefined,
    };
  }, []);

  // Search function
  const performSearch = useCallback(async (
    query: string,
    currentFilters: typeof filters,
    currentOffset: number,
    append: boolean = false
  ) => {
    if (!projectId) return;

    setIsLoading(true);

    try {
      // Build search params
      const params: any = {
        limit: 50,
        offset: currentOffset,
      };

      if (query.trim()) {
        params.q = query.trim();
      }

      if (currentFilters.status) {
        params.status = currentFilters.status;
      }

      if (currentFilters.dateFrom) {
        params.dateFrom = currentFilters.dateFrom;
      }

      if (currentFilters.dateTo) {
        params.dateTo = currentFilters.dateTo;
      }

      // Call search API (we'll implement this in MediaApi)
      const response = await fetch(
        `${MediaApi.getDownloadUrl(projectId).replace(/\/api\/media\/.*/, '')}/api/projects/${projectId}/media/search?${new URLSearchParams(
          Object.entries(params)
            .filter(([_, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)])
        ).toString()}`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      const photos = data.media.map(convertToPhotoData);

      if (append) {
        setAllResults(prev => [...prev, ...photos]);
      } else {
        setAllResults(photos);
      }

      setHasMore(photos.length === params.limit);
    } catch (error) {
      console.error('Search error:', error);
      Toast.show({
        type: 'error',
        text1: 'Search Failed',
        text2: 'Could not load search results',
        visibilityTime: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  }, [projectId, convertToPhotoData]);

  // Initial search and when filters change
  useEffect(() => {
    if (debouncedQuery || filters.status || filters.dateFrom || filters.dateTo) {
      performSearch(debouncedQuery, filters, 0, false);
    }
  }, [debouncedQuery, filters, performSearch]);

  // Load more
  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      const newOffset = offset + 50;
      setOffset(newOffset);
      performSearch(debouncedQuery, filters, newOffset, true);
    }
  }, [isLoading, hasMore, offset, debouncedQuery, filters, performSearch]);

  // Refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setOffset(0);
    await performSearch(debouncedQuery, filters, 0, false);
    setRefreshing(false);
  }, [debouncedQuery, filters, performSearch]);

  // Clear search
  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    setDebouncedQuery("");
    setFilters({});
    setAllResults([]);
    setOffset(0);
    setHasMore(true);
  }, []);

  // Handle photo press
  const handlePhotoPress = useCallback((photo: PhotoData) => {
    const photoIndex = allResults.findIndex(p => p.id === photo.id);
    setViewerPhotos(allResults);
    setViewerInitialIndex(photoIndex >= 0 ? photoIndex : 0);
    setViewerVisible(true);
  }, [allResults]);

  // Filter change
  const handleFilterChange = useCallback((newFilters: typeof filters) => {
    setFilters(newFilters);
    setOffset(0);
    setAllResults([]);
    setHasMore(true);
  }, []);

  // Clear filters
  const handleClearFilters = useCallback(() => {
    setFilters({});
    setOffset(0);
    setAllResults([]);
    setHasMore(true);
  }, []);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.status) count++;
    if (filters.dateFrom || filters.dateTo) count++;
    return count;
  }, [filters]);

  // Render photo item
  const renderPhotoItem = useCallback(({ item, index }: { item: PhotoData; index: number }) => {
    return (
      <View style={styles.photoItem}>
        <PhotoThumbnail
          photo={item}
          size="lg"
          onPress={handlePhotoPress}
          showSyncStatus={false}
          showPhotoStatus={true}
        />
      </View>
    );
  }, [handlePhotoPress]);

  // Empty state
  const renderEmptyState = useCallback(() => {
    if (isLoading) return null;

    const hasActiveSearch = debouncedQuery.trim() || activeFilterCount > 0;

    return (
      <View style={styles.emptyState}>
        <Ionicons
          name={hasActiveSearch ? "search-outline" : "images-outline"}
          size={64}
          color="#d1d5db"
        />
        <Text style={styles.emptyTitle}>
          {hasActiveSearch ? "No Results Found" : "Search Site Photos"}
        </Text>
        <Text style={styles.emptyDescription}>
          {hasActiveSearch
            ? "Try adjusting your search or filters"
            : "Use the search bar and filters to find photos"}
        </Text>
        {hasActiveSearch && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearSearch}
          >
            <Text style={styles.clearButtonText}>Clear Search</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [isLoading, debouncedQuery, activeFilterCount, handleClearSearch]);

  // Footer (loading more)
  const renderFooter = useCallback(() => {
    if (!isLoading || allResults.length === 0) return null;

    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#c9623d" />
        <Text style={styles.footerText}>Loading more...</Text>
      </View>
    );
  }, [isLoading, allResults.length]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Search Photos</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={20} color="#828180" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by description..."
            placeholderTextColor="#828180"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              style={styles.clearIconButton}
              onPress={() => setSearchQuery("")}
            >
              <Ionicons name="close-circle" size={20} color="#828180" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Search Filters */}
      <SearchFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
      />

      {/* Results Count */}
      {allResults.length > 0 && (
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsCount}>
            {allResults.length} photo{allResults.length !== 1 ? 's' : ''} found
          </Text>
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>
                {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Photo Grid */}
      <FlatList
        data={allResults}
        numColumns={2}
        keyExtractor={(item) => item.id}
        renderItem={renderPhotoItem}
        contentContainerStyle={styles.gridContent}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#c9623d"
          />
        }
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderFooter}
      />

      {/* Photo Viewer */}
      <PhotoViewer
        visible={viewerVisible}
        photos={viewerPhotos}
        initialIndex={viewerInitialIndex}
        onClose={() => setViewerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9f9f9",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    textAlign: "center",
    marginRight: -40, // Offset back button width
  },
  headerSpacer: {
    width: 40,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  searchInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f4f4f4",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#1f2937",
  },
  clearIconButton: {
    padding: 4,
  },
  resultsHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  resultsCount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
    flex: 1,
  },
  filterBadge: {
    backgroundColor: "#c9623d",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  filterBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ffffff",
  },
  gridContent: {
    paddingHorizontal: 8,
    paddingVertical: 16,
    paddingBottom: 32,
  },
  photoItem: {
    flex: 1,
    padding: 8,
    maxWidth: "50%",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: "#828180",
    textAlign: "center",
    marginBottom: 24,
  },
  clearButton: {
    backgroundColor: "#c9623d",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  footerText: {
    fontSize: 14,
    color: "#828180",
    marginLeft: 8,
  },
});
