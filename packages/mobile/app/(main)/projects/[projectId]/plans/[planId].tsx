import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { Effect } from 'effect';
import OpenSeadragonViewer from '@/components/plan-viewer/OpenSeadragonViewer';
import { useSheets } from '@/lib/api/hooks';
import { SheetsApi, type DziMetadata } from '@/lib/api/client';

export default function PlanViewerScreen() {
  const { projectId, planId } = useLocalSearchParams<{
    projectId: string;
    planId: string;
  }>();

  const [selectedSheetIndex, setSelectedSheetIndex] = useState(0);
  const [dziMetadata, setDziMetadata] = useState<DziMetadata | null>(null);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);

  const { data, error, isLoading, refetch } = useSheets(planId ?? null);

  const sheets = data?.sheets ?? [];
  const selectedSheet = sheets[selectedSheetIndex];

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

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading sheets...</Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.centerContainer}>
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
    );
  }

  // No sheets available
  if (sheets.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorTitle}>No sheets available</Text>
        <Text style={styles.errorMessage}>
          This plan has no processed sheets yet. The plan may still be processing.
        </Text>
        <Text style={styles.retryButton} onPress={refetch}>
          Tap to refresh
        </Text>
      </View>
    );
  }

  // Loading metadata
  if (isLoadingMetadata) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading plan metadata...</Text>
      </View>
    );
  }

  // Metadata error
  if (metadataError) {
    return (
      <View style={styles.centerContainer}>
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
    );
  }

  // No metadata yet
  if (!dziMetadata) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Preparing viewer...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Sheet selector for plans with multiple sheets */}
      {sheets.length > 1 && (
        <View style={styles.sheetSelector}>
          <Text style={styles.sheetLabel}>
            Sheet {selectedSheetIndex + 1} of {sheets.length}
            {selectedSheet?.sheetName ? ` - ${selectedSheet.sheetName}` : ''}
          </Text>
        </View>
      )}

      <OpenSeadragonViewer
        metadata={dziMetadata}
        fetchTile={fetchTile}
        dom={{ style: { flex: 1, width: '100%', height: '100%' } }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
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
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '500',
    padding: 12,
  },
  sheetSelector: {
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3a3a',
  },
  sheetLabel: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
});
