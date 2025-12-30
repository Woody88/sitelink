import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Effect } from 'effect';
import OpenSeadragonViewer, { type Marker } from '@/components/plan-viewer/OpenSeadragonViewer';
import MarkerDetailsModal from '@/components/plan-viewer/MarkerDetailsModal';
import { useSheets, useSheetMarkers } from '@/lib/api/hooks';
import { SheetsApi, type DziMetadata } from '@/lib/api/client';

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

  const { data, error, isLoading, refetch } = useSheets(planId ?? null);

  const sheets = data?.sheets ?? [];
  const selectedSheet = sheets[selectedSheetIndex];

  // Fetch markers for the current sheet
  const { data: markersData } = useSheetMarkers(planId ?? null, selectedSheet?.id ?? null);

  // Transform hyperlinks to markers
  const markers: Marker[] = (markersData?.hyperlinks ?? []).map((h) => ({
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
      setSelectedSheetIndex(targetSheetIndex);
      setIsModalVisible(false);
      setSelectedMarker(null);
    } else {
      // Sheet not found - could show an alert here
      console.warn(`[PlanViewer] Sheet ${targetSheetRef} not found in plan`);
      setIsModalVisible(false);
    }
  }, [sheets]);

  // Close modal
  const handleCloseModal = useCallback(() => {
    setIsModalVisible(false);
    setSelectedMarker(null);
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
      <View style={styles.headerSpacer} />
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
        dom={{ style: { flex: 1, width: '100%', height: '100%' } }}
      />
      <MarkerDetailsModal
        visible={isModalVisible}
        marker={selectedMarker}
        onClose={handleCloseModal}
        onGoToSheet={handleGoToSheet}
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
  headerSpacer: {
    width: 44,
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
