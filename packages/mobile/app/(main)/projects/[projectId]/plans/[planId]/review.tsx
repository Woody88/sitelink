import React, { useCallback, useState, useMemo } from "react";
import {
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";
import { usePendingReviewMarkers, useReviewMarker, useBulkReviewMarkers } from "@/lib/api/hooks";
import type { PendingReviewMarker } from "@sitelink/shared-types";

/**
 * Confidence Badge Component - Color coded by confidence level
 */
function ConfidenceBadge({ confidence }: { confidence: number }) {
  const percentage = Math.round(confidence * 100);

  // Color coding: red < 50%, yellow 50-70%, green > 70%
  let colors = { bg: 'rgba(34, 197, 94, 0.2)', text: '#22c55e' };

  if (percentage < 50) {
    colors = { bg: 'rgba(239, 68, 68, 0.2)', text: '#ef4444' };
  } else if (percentage < 70) {
    colors = { bg: 'rgba(234, 179, 8, 0.2)', text: '#eab308' };
  }

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.badgeText, { color: colors.text }]}>
        {percentage}%
      </Text>
    </View>
  );
}

/**
 * Marker Review Card Component
 */
interface MarkerReviewCardProps {
  marker: PendingReviewMarker;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
  onViewInContext: (marker: PendingReviewMarker) => void;
  isLoading: boolean;
}

function MarkerReviewCard({
  marker,
  isSelected,
  onSelect,
  onConfirm,
  onReject,
  onViewInContext,
  isLoading,
}: MarkerReviewCardProps) {
  return (
    <Pressable
      onPress={() => onSelect(marker.id)}
      style={[
        styles.card,
        isSelected && styles.cardSelected
      ]}
    >
      {/* Header Row */}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          {/* Selection Checkbox */}
          <View style={[
            styles.checkbox,
            isSelected && styles.checkboxSelected
          ]}>
            {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
          </View>

          {/* Marker Type Icon */}
          <View style={styles.markerTypeIcon}>
            <Ionicons
              name={marker.markerType === "circle" ? "ellipse-outline" : "triangle-outline"}
              size={20}
              color="#c9623d"
            />
          </View>

          {/* Sheet Reference */}
          <View>
            <Text style={styles.sheetName}>
              Sheet {marker.sheetNumber}
            </Text>
            <Text style={styles.markerType}>
              {marker.markerType.charAt(0).toUpperCase() + marker.markerType.slice(1)} Marker
            </Text>
          </View>
        </View>

        <ConfidenceBadge confidence={marker.confidence} />
      </View>

      {/* Callout Reference */}
      <View style={styles.calloutContainer}>
        <View style={styles.calloutRef}>
          <Text style={styles.calloutLabel}>Callout Reference</Text>
          <Text style={styles.calloutValue}>{marker.calloutRef}</Text>
        </View>
        <Ionicons name="arrow-forward" size={20} color="#4a4a4a" />
        <View style={styles.calloutRef}>
          <Text style={styles.calloutLabel}>Target Sheet</Text>
          <Text style={styles.calloutValue}>{marker.targetSheetRef}</Text>
        </View>
      </View>

      {/* Action Buttons Row */}
      <View style={styles.actionRow}>
        {/* View in Context Button */}
        <Pressable
          onPress={() => onViewInContext(marker)}
          style={styles.viewButton}
        >
          <Ionicons name="eye-outline" size={18} color="#9ca3af" />
          <Text style={styles.viewButtonText}>View</Text>
        </Pressable>

        {/* Reject Button */}
        <Pressable
          onPress={() => onReject(marker.id)}
          disabled={isLoading}
          style={styles.rejectButton}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#ef4444" />
          ) : (
            <>
              <Ionicons name="close" size={18} color="#ef4444" />
              <Text style={styles.rejectButtonText}>Reject</Text>
            </>
          )}
        </Pressable>

        {/* Confirm Button */}
        <Pressable
          onPress={() => onConfirm(marker.id)}
          disabled={isLoading}
          style={styles.confirmButton}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#22c55e" />
          ) : (
            <>
              <Ionicons name="checkmark" size={18} color="#22c55e" />
              <Text style={styles.confirmButtonText}>Confirm</Text>
            </>
          )}
        </Pressable>
      </View>
    </Pressable>
  );
}

/**
 * Marker Review Screen
 */
export default function MarkerReviewScreen() {
  const insets = useSafeAreaInsets();
  const { projectId, planId } = useLocalSearchParams<{
    projectId: string;
    planId: string;
  }>();

  const [selectedMarkerIds, setSelectedMarkerIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const { data, error, isLoading, refetch } = usePendingReviewMarkers(planId ?? null);
  const { mutate: reviewMarker } = useReviewMarker();
  const { mutate: bulkReviewMarkers, isLoading: isBulkLoading } = useBulkReviewMarkers();

  const markers = data?.markers ?? [];
  const total = data?.total ?? 0;
  const confidenceThreshold = data?.confidenceThreshold ?? 0.7;

  // Toggle marker selection
  const toggleSelection = useCallback((id: string) => {
    setSelectedMarkerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Select all markers
  const selectAll = useCallback(() => {
    setSelectedMarkerIds(new Set(markers.map((m) => m.id)));
  }, [markers]);

  // Deselect all markers
  const deselectAll = useCallback(() => {
    setSelectedMarkerIds(new Set());
  }, []);

  // Handle single marker confirm
  const handleConfirm = useCallback(async (markerId: string) => {
    setProcessingIds((prev) => new Set(prev).add(markerId));
    const result = await reviewMarker({ markerId, action: "confirm" });
    setProcessingIds((prev) => {
      const next = new Set(prev);
      next.delete(markerId);
      return next;
    });
    if (result) {
      refetch();
    }
  }, [reviewMarker, refetch]);

  // Handle single marker reject
  const handleReject = useCallback(async (markerId: string) => {
    setProcessingIds((prev) => new Set(prev).add(markerId));
    const result = await reviewMarker({ markerId, action: "reject" });
    setProcessingIds((prev) => {
      const next = new Set(prev);
      next.delete(markerId);
      return next;
    });
    if (result) {
      refetch();
    }
  }, [reviewMarker, refetch]);

  // Handle bulk confirm
  const handleBulkConfirm = useCallback(async () => {
    if (selectedMarkerIds.size === 0) {
      Alert.alert("No Selection", "Please select markers to confirm.");
      return;
    }

    Alert.alert(
      "Confirm All Selected",
      `Are you sure you want to confirm ${selectedMarkerIds.size} marker(s)?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm All",
          onPress: async () => {
            const result = await bulkReviewMarkers({
              markerIds: Array.from(selectedMarkerIds),
              action: "confirm",
            });
            if (result) {
              setSelectedMarkerIds(new Set());
              refetch();
            }
          },
        },
      ]
    );
  }, [selectedMarkerIds, bulkReviewMarkers, refetch]);

  // Handle bulk reject
  const handleBulkReject = useCallback(async () => {
    if (selectedMarkerIds.size === 0) {
      Alert.alert("No Selection", "Please select markers to reject.");
      return;
    }

    Alert.alert(
      "Reject All Selected",
      `Are you sure you want to reject ${selectedMarkerIds.size} marker(s)? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject All",
          style: "destructive",
          onPress: async () => {
            const result = await bulkReviewMarkers({
              markerIds: Array.from(selectedMarkerIds),
              action: "reject",
            });
            if (result) {
              setSelectedMarkerIds(new Set());
              refetch();
            }
          },
        },
      ]
    );
  }, [selectedMarkerIds, bulkReviewMarkers, refetch]);

  // Navigate to view marker in context
  const handleViewInContext = useCallback((marker: PendingReviewMarker) => {
    // Navigate to the plan viewer with the specific sheet
    router.push(`/(main)/projects/${projectId}/plans/${planId}?sheetNumber=${marker.sheetNumber}` as never);
  }, [projectId, planId]);

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Stats for header
  const stats = useMemo(() => {
    const lowConfidence = markers.filter((m) => m.confidence < 0.5).length;
    const mediumConfidence = markers.filter((m) => m.confidence >= 0.5 && m.confidence < 0.7).length;
    const highConfidence = markers.filter((m) => m.confidence >= 0.7).length;
    return { lowConfidence, mediumConfidence, highConfidence };
  }, [markers]);

  // Header Component
  const Header = () => (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Review Markers</Text>
          <Text style={styles.headerSubtitle}>
            {total} marker{total !== 1 ? "s" : ""} need{total === 1 ? "s" : ""} review
          </Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {/* Stats Bar */}
      {markers.length > 0 && (
        <View style={styles.statsBar}>
          <View style={[styles.statItem, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
            <Text style={[styles.statValue, { color: '#ef4444' }]}>{stats.lowConfidence}</Text>
            <Text style={[styles.statLabel, { color: '#ef4444' }]}>Low</Text>
          </View>
          <View style={[styles.statItem, { backgroundColor: 'rgba(234, 179, 8, 0.1)' }]}>
            <Text style={[styles.statValue, { color: '#eab308' }]}>{stats.mediumConfidence}</Text>
            <Text style={[styles.statLabel, { color: '#eab308' }]}>Medium</Text>
          </View>
          <View style={[styles.statItem, { backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
            <Text style={[styles.statValue, { color: '#22c55e' }]}>{stats.highConfidence}</Text>
            <Text style={[styles.statLabel, { color: '#22c55e' }]}>High</Text>
          </View>
        </View>
      )}

      {/* Selection Bar */}
      {markers.length > 0 && (
        <View style={styles.selectionBar}>
          <Text style={styles.selectionText}>
            {selectedMarkerIds.size} selected
          </Text>
          <View style={styles.selectionActions}>
            <Pressable onPress={selectAll}>
              <Text style={styles.selectAllText}>Select All</Text>
            </Pressable>
            {selectedMarkerIds.size > 0 && (
              <Pressable onPress={deselectAll}>
                <Text style={styles.clearText}>Clear</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </View>
  );

  // Loading state
  if (isLoading && !refreshing) {
    return (
      <View style={styles.container}>
        <Header />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#c9623d" />
          <Text style={styles.loadingText}>Loading markers...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        <Header />
        <View style={styles.centerContent}>
          <View style={styles.errorIcon}>
            <Ionicons name="alert-circle" size={48} color="#ef4444" />
          </View>
          <Text style={styles.errorTitle}>Failed to Load Markers</Text>
          <Text style={styles.errorMessage}>
            {error._tag === "NetworkError"
              ? "Please check your internet connection and try again."
              : error.message}
          </Text>
          <Pressable onPress={() => refetch()} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Empty state
  if (markers.length === 0) {
    return (
      <View style={styles.container}>
        <Header />
        <View style={styles.centerContent}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={64} color="#22c55e" />
          </View>
          <Text style={styles.successTitle}>All Caught Up!</Text>
          <Text style={styles.successMessage}>
            No markers need review at this time. All markers have confidence above{" "}
            {Math.round(confidenceThreshold * 100)}%.
          </Text>
          <Pressable onPress={() => router.back()} style={styles.backToPlanButton}>
            <Text style={styles.backToPlanText}>Back to Plan</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header />

      {/* Marker List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#c9623d"
          />
        }
      >
        {markers.map((marker) => (
          <MarkerReviewCard
            key={marker.id}
            marker={marker}
            isSelected={selectedMarkerIds.has(marker.id)}
            onSelect={toggleSelection}
            onConfirm={handleConfirm}
            onReject={handleReject}
            onViewInContext={handleViewInContext}
            isLoading={processingIds.has(marker.id)}
          />
        ))}
      </ScrollView>

      {/* Bulk Action Bar */}
      <View style={[styles.bulkActionBar, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          onPress={handleBulkReject}
          disabled={selectedMarkerIds.size === 0 || isBulkLoading}
          style={[
            styles.bulkButton,
            selectedMarkerIds.size === 0 ? styles.bulkButtonDisabled : styles.bulkRejectButton
          ]}
        >
          {isBulkLoading ? (
            <ActivityIndicator size="small" color="#ef4444" />
          ) : (
            <>
              <Ionicons
                name="close-circle"
                size={22}
                color={selectedMarkerIds.size === 0 ? "#6b7280" : "#ef4444"}
              />
              <Text style={[
                styles.bulkButtonText,
                { color: selectedMarkerIds.size === 0 ? "#6b7280" : "#ef4444" }
              ]}>
                Reject All
              </Text>
            </>
          )}
        </Pressable>

        <Pressable
          onPress={handleBulkConfirm}
          disabled={selectedMarkerIds.size === 0 || isBulkLoading}
          style={[
            styles.bulkButton,
            selectedMarkerIds.size === 0 ? styles.bulkButtonDisabled : styles.bulkConfirmButton
          ]}
        >
          {isBulkLoading ? (
            <ActivityIndicator size="small" color="#22c55e" />
          ) : (
            <>
              <Ionicons
                name="checkmark-circle"
                size={22}
                color={selectedMarkerIds.size === 0 ? "#6b7280" : "#22c55e"}
              />
              <Text style={[
                styles.bulkButtonText,
                { color: selectedMarkerIds.size === 0 ? "#6b7280" : "#22c55e" }
              ]}>
                Confirm All
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    backgroundColor: '#2a2a2a',
    borderBottomWidth: 1,
    borderBottomColor: '#3a3a3a',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerSubtitle: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 2,
  },
  statsBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  statItem: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
  },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  selectionText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  selectionActions: {
    flexDirection: 'row',
    gap: 12,
  },
  selectAllText: {
    color: '#c9623d',
    fontWeight: '500',
  },
  clearText: {
    color: '#9ca3af',
    fontWeight: '500',
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  card: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: '#c9623d',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#4a4a4a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#c9623d',
    borderColor: '#c9623d',
  },
  markerTypeIcon: {
    backgroundColor: '#3a3a3a',
    borderRadius: 8,
    padding: 6,
  },
  sheetName: {
    color: '#fff',
    fontWeight: '600',
  },
  markerType: {
    color: '#9ca3af',
    fontSize: 12,
  },
  badge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  calloutContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calloutRef: {
    flex: 1,
  },
  calloutLabel: {
    color: '#9ca3af',
    fontSize: 11,
    marginBottom: 4,
  },
  calloutValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  viewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3a3a3a',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
  },
  viewButtonText: {
    color: '#9ca3af',
    fontWeight: '500',
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
  },
  rejectButtonText: {
    color: '#ef4444',
    fontWeight: '500',
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
  },
  confirmButtonText: {
    color: '#22c55e',
    fontWeight: '500',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    color: '#9ca3af',
    marginTop: 16,
    fontSize: 16,
  },
  errorIcon: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 32,
    padding: 16,
    marginBottom: 16,
  },
  errorTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorMessage: {
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#c9623d',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  successIcon: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 48,
    padding: 24,
    marginBottom: 16,
  },
  successTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  successMessage: {
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 24,
  },
  backToPlanButton: {
    borderWidth: 1,
    borderColor: '#4a4a4a',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backToPlanText: {
    color: '#fff',
    fontWeight: '500',
  },
  bulkActionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#2a2a2a',
    borderTopWidth: 1,
    borderTopColor: '#3a3a3a',
    paddingHorizontal: 16,
    paddingTop: 12,
    flexDirection: 'row',
    gap: 12,
  },
  bulkButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  bulkButtonDisabled: {
    backgroundColor: '#3a3a3a',
  },
  bulkRejectButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  bulkConfirmButton: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  bulkButtonText: {
    fontWeight: '600',
    fontSize: 16,
  },
});
