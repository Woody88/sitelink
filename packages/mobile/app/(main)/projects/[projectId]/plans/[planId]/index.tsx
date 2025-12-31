import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Effect } from 'effect';
import OpenSeadragonViewer, { type Marker } from '@/components/plan-viewer/OpenSeadragonViewer';
import MarkerDetailsModal from '@/components/plan-viewer/MarkerDetailsModal';
import { MarkerTimelineModal } from '@/components/media';
import { useSheets, useSheetMarkers, usePendingReviewMarkers } from '@/lib/api/hooks';
import { SheetsApi, MarkersApi, type DziMetadata } from '@/lib/api/client';

export default function PlanViewerScreen() {
  const insets = useSafeAreaInsets();
  const { projectId, planId, sheetId } = useLocalSearchParams<{
    projectId: string;
    planId: string;
    sheetId?: string;
  }>();

  const [selectedSheetIndex, setSelectedSheetIndex] = useState(0);
  const [initialSheetSet, setInitialSheetSet] = useState(false);
  const [dziMetadata, setDziMetadata] = useState<DziMetadata | null>(null);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);

  // Modal state
  const [selectedMarker, setSelectedMarker] = useState<Marker | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isTimelineVisible, setIsTimelineVisible] = useState(false);

  // Marker highlight state for navigation
  const [highlightMarkerRef, setHighlightMarkerRef] = useState<string | null>(null);
  // Track if the sheet change was due to navigation (vs manual selection)
  const isNavigatingRef = useRef(false);

  const { data, error, isLoading, refetch } = useSheets(planId ?? null);

  const sheets = data?.sheets ?? [];
  const selectedSheet = sheets[selectedSheetIndex];

  // Fetch markers for the current sheet
  const { data: markersData } = useSheetMarkers(planId ?? null, selectedSheet?.id ?? null);

  // Fetch pending review count for badge
  const { data: pendingReviewData } = usePendingReviewMarkers(planId ?? null);
  const pendingReviewCount = pendingReviewData?.total ?? 0;

  // Transform hyperlinks to markers
  const markers: Marker[] = (markersData?.hyperlinks ?? []).map((h) => ({
    id: h.id,
    calloutRef: h.calloutRef,
    targetSheetRef: h.targetSheetRef,
    x: h.x,
    y: h.y,
    confidence: h.confidence,
  }));

  // Set initial sheet from sheetId param when sheets load
  useEffect(() => {
    if (!initialSheetSet && sheets.length > 0 && sheetId) {
      const sheetIndex = sheets.findIndex((s) => s.id === sheetId);
      if (sheetIndex >= 0) {
        setSelectedSheetIndex(sheetIndex);
      }
      setInitialSheetSet(true);
    }
  }, [sheets, sheetId, initialSheetSet]);

  // Clear highlightMarkerRef when sheet changes manually (not via navigation)
  useEffect(() => {
    if (!isNavigatingRef.current && highlightMarkerRef) {
      // Sheet changed manually, clear the highlight
      setHighlightMarkerRef(null);
    }
    // Reset the navigation flag
    isNavigatingRef.current = false;
  }, [selectedSheetIndex]);

  // Fetch DZI metadata when sheet changes (from React Native, not webview)
  useEffect(() => {
    if (!planId || !selectedSheet?.id) {
      setDziMetadata(null);
      return;
    }

    setIsLoadingMetadata(true);
    setMetadataError(null);

    console.log('[PlanViewer] Fetching DZI metadata from RN...');

    Effect.runPromise(SheetsApi.getDziMetadata(planId, selectedSheet.id))
      .then((metadata) => {
        console.log('[PlanViewer] DZI metadata loaded:', metadata);
        setDziMetadata(metadata);
        setIsLoadingMetadata(false);
      })
      .catch((err) => {
        console.error('[PlanViewer] Failed to load DZI metadata:', err);
        setMetadataError(err.message || 'Failed to load plan metadata');
        setIsLoadingMetadata(false);
      });
  }, [planId, selectedSheet?.id]);

  // Native action for fetching tiles (called from webview via Expo DOM bridge)
  const fetchTile = useCallback(async (level: number, x: number, y: number): Promise<string> => {
    if (!planId || !selectedSheet?.id || !dziMetadata) {
      throw new Error('Missing plan/sheet data');
    }

    console.log(`[PlanViewer] Fetching tile ${level}/${x}_${y} from RN...`);

    return Effect.runPromise(
      SheetsApi.getTileBase64(planId, selectedSheet.id, level, x, y, dziMetadata.format)
    );
  }, [planId, selectedSheet?.id, dziMetadata]);

  // Handle marker press - show modal
  const handleMarkerPress = useCallback((marker: Marker) => {
    console.log('[PlanViewer] Marker pressed:', marker);
    setSelectedMarker(marker);
    setIsModalVisible(true);
  }, []);

  // Handle "Go to Sheet" button press
  const handleGoToSheet = useCallback((targetSheetRef: string) => {
    console.log('[PlanViewer] Navigating to sheet:', targetSheetRef);

    // Find the sheet by its name/reference
    const targetSheetIndex = sheets.findIndex((s) => {
      // Match by sheet name (e.g., "A7", "S1", etc.)
      const sheetName = s.sheetName?.toUpperCase() || '';
      const targetRef = targetSheetRef.toUpperCase();
      return sheetName === targetRef || sheetName.includes(targetRef);
    });

    if (targetSheetIndex >= 0) {
      // Get the callout ref from the current marker to highlight it on the target sheet
      // The calloutRef is the detail number (e.g., "5" from marker "5/A7")
      const markerToHighlight = selectedMarker?.calloutRef || null;

      // Set flag to indicate this is a navigation (not manual sheet change)
      isNavigatingRef.current = true;

      // Set the marker to highlight on the target sheet
      setHighlightMarkerRef(markerToHighlight);

      // Change to the target sheet
      setSelectedSheetIndex(targetSheetIndex);

      // Close the modal
      setIsModalVisible(false);
      setSelectedMarker(null);

      console.log(`[PlanViewer] Navigated to sheet ${targetSheetRef}, highlighting marker ${markerToHighlight}`);
    } else {
      // Sheet not found - could show an alert here
      console.warn(`[PlanViewer] Sheet ${targetSheetRef} not found in plan`);
      setIsModalVisible(false);
    }
  }, [sheets, selectedMarker]);

  // Close modal
  const handleCloseModal = useCallback(() => {
    setIsModalVisible(false);
    setSelectedMarker(null);
  }, []);

  // Handle "View Timeline" button press
  const handleViewTimeline = useCallback((marker: Marker) => {
    console.log('[PlanViewer] Viewing timeline for marker:', marker.id);
    setIsModalVisible(false);
    setIsTimelineVisible(true);
  }, []);

  // Handle "Add Photo" button press
  const handleAddPhoto = useCallback(() => {
    console.log('[PlanViewer] Adding photo for marker:', selectedMarker?.id);
    // Navigate to camera screen with markerId context
    router.push({
      pathname: `/(main)/projects/${projectId}/media/camera`,
      params: { 
        markerId: selectedMarker?.id,
        planId,
        sheetId: selectedSheet?.id
      }
    } as any);
  }, [projectId, planId, selectedSheet?.id, selectedMarker]);

  // Handle marker position update (long-press + drag)
  const handleMarkerPositionUpdate = useCallback((marker: Marker, newX: number, newY: number) => {
    console.log(`[PlanViewer] Updating marker ${marker.id} position to (${newX.toFixed(4)}, ${newY.toFixed(4)})`);

    // Call the API to save the new position
    Effect.runPromise(MarkersApi.updatePosition(marker.id, newX, newY))
      .then(() => {
        console.log(`[PlanViewer] Marker ${marker.id} position saved successfully`);
      })
      .catch((err) => {
        console.error(`[PlanViewer] Failed to save marker position:`, err);
        // TODO: Show error toast to user
      });
  }, []);

  // Header component
  const Header = () => (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="chevron-back" size={28} color="#fff" />
      </Pressable>
      <View style={styles.headerTitleContainer}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {selectedSheet?.sheetName ?? 'Plan Viewer'}
        </Text>
        {sheets.length > 1 && (
          <Text style={styles.headerSubtitle}>
            Sheet {selectedSheetIndex + 1} of {sheets.length}
          </Text>
        )}
      </View>
      {/* Review Markers Button with Badge */}
      <Pressable
        onPress={() => router.push(`/(main)/projects/${projectId}/plans/${planId}/review` as never)}
        style={styles.reviewButton}
      >
        <Ionicons name="flag-outline" size={24} color="#fff" />
        {pendingReviewCount > 0 && (
          <View style={styles.reviewBadge}>
            <Text style={styles.reviewBadgeText}>
              {pendingReviewCount > 99 ? '99+' : pendingReviewCount}
            </Text>
          </View>
        )}
      </Pressable>
    </View>
  );

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <Header />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#c9623d" />
          <Text style={styles.loadingText}>Loading sheets...</Text>
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
          <Text style={styles.errorTitle}>Failed to load sheets</Text>
          <Text style={styles.errorMessage}>
            {error._tag === 'NetworkError' ? 'Network error. Please check your connection.' :
             error._tag === 'UnauthorizedError' ? 'Please log in to view this plan.' :
             error.message}
          </Text>
          <Text style={styles.retryButton} onPress={refetch}>
            Tap to retry
          </Text>
        </View>
      </View>
    );
  }

  // No sheets available
  if (sheets.length === 0) {
    return (
      <View style={styles.container}>
        <Header />
        <View style={styles.centerContent}>
          <Text style={styles.errorTitle}>No sheets available</Text>
          <Text style={styles.errorMessage}>
            This plan has no processed sheets yet. The plan may still be processing.
          </Text>
          <Text style={styles.retryButton} onPress={refetch}>
            Tap to refresh
          </Text>
        </View>
      </View>
    );
  }

  // Loading metadata
  if (isLoadingMetadata) {
    return (
      <View style={styles.container}>
        <Header />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#c9623d" />
          <Text style={styles.loadingText}>Loading plan metadata...</Text>
        </View>
      </View>
    );
  }

  // Metadata error
  if (metadataError) {
    return (
      <View style={styles.container}>
        <Header />
        <View style={styles.centerContent}>
          <Text style={styles.errorTitle}>Failed to load plan</Text>
          <Text style={styles.errorMessage}>{metadataError}</Text>
          <Text style={styles.retryButton} onPress={() => {
            setMetadataError(null);
            setIsLoadingMetadata(true);
            // Re-trigger the useEffect
            setDziMetadata(null);
          }}>
            Tap to retry
          </Text>
        </View>
      </View>
    );
  }

  // No metadata yet
  if (!dziMetadata) {
    return (
      <View style={styles.container}>
        <Header />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#c9623d" />
          <Text style={styles.loadingText}>Preparing viewer...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header />
      <OpenSeadragonViewer
        metadata={dziMetadata}
        fetchTile={fetchTile}
        markers={markers}
        onMarkerPress={handleMarkerPress}
        onMarkerPositionUpdate={handleMarkerPositionUpdate}
        highlightMarkerRef={highlightMarkerRef || undefined}
        dom={{ style: { flex: 1, width: '100%', height: '100%' } }}
      />
      <MarkerDetailsModal
        visible={isModalVisible}
        marker={selectedMarker}
        onClose={handleCloseModal}
        onGoToSheet={handleGoToSheet}
        onViewTimeline={handleViewTimeline}
      />
      <MarkerTimelineModal
        visible={isTimelineVisible}
        markerId={selectedMarker?.id || null}
        markerRef={selectedMarker?.calloutRef || null}
        onClose={() => setIsTimelineVisible(false)}
        onAddPhoto={handleAddPhoto}
      />
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3a3a',
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
  reviewButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  reviewBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#c9623d',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  reviewBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#9ca3af',
    marginTop: 16,
    fontSize: 16,
  },
  errorTitle: {
    color: '#ef4444',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorMessage: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    color: '#c9623d',
    fontSize: 16,
    fontWeight: '500',
    padding: 12,
  },
});
