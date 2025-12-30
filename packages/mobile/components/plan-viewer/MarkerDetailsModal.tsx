import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Marker } from './OpenSeadragonViewer';

interface MarkerDetailsModalProps {
  visible: boolean;
  marker: Marker | null;
  onClose: () => void;
  onGoToSheet: (targetSheetRef: string) => void;
}

/**
 * Get confidence level label and color
 */
function getConfidenceInfo(confidence: number): { label: string; color: string; bgColor: string } {
  if (confidence >= 0.8) {
    return { label: 'High Confidence', color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.15)' };
  } else if (confidence >= 0.6) {
    return { label: 'Medium Confidence', color: '#eab308', bgColor: 'rgba(234, 179, 8, 0.15)' };
  } else {
    return { label: 'Low Confidence', color: '#f97316', bgColor: 'rgba(249, 115, 22, 0.15)' };
  }
}

/**
 * Bottom sheet modal for marker details
 * Shows callout reference, target sheet, confidence, and navigation button
 */
export default function MarkerDetailsModal({
  visible,
  marker,
  onClose,
  onGoToSheet
}: MarkerDetailsModalProps) {
  if (!marker) {
    return null;
  }

  const confidenceInfo = getConfidenceInfo(marker.confidence);
  const confidencePercent = Math.round(marker.confidence * 100);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Handle bar */}
          <View style={styles.handleBar} />

          {/* Header with close button */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Callout Details</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#9ca3af" />
            </Pressable>
          </View>

          {/* Callout reference display */}
          <View style={styles.calloutContainer}>
            <View style={styles.calloutBadge}>
              <Text style={styles.calloutRef}>{marker.calloutRef}</Text>
            </View>
            <Ionicons name="arrow-forward" size={24} color="#9ca3af" style={styles.arrow} />
            <View style={styles.targetBadge}>
              <Text style={styles.targetRef}>Sheet {marker.targetSheetRef}</Text>
            </View>
          </View>

          {/* Confidence indicator */}
          <View style={[styles.confidenceContainer, { backgroundColor: confidenceInfo.bgColor }]}>
            <View style={[styles.confidenceDot, { backgroundColor: confidenceInfo.color }]} />
            <Text style={[styles.confidenceLabel, { color: confidenceInfo.color }]}>
              {confidenceInfo.label}
            </Text>
            <Text style={styles.confidencePercent}>{confidencePercent}%</Text>
          </View>

          {/* Navigation button */}
          <Pressable
            style={styles.goToSheetButton}
            onPress={() => onGoToSheet(marker.targetSheetRef)}
          >
            <Ionicons name="document-outline" size={22} color="#fff" />
            <Text style={styles.goToSheetText}>Go to Sheet {marker.targetSheetRef}</Text>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </Pressable>

          {/* Position info (smaller, secondary) */}
          <Text style={styles.positionInfo}>
            Position: ({Math.round(marker.x)}, {Math.round(marker.y)})
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 8,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#4b5563',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -10,
  },
  calloutContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 12,
  },
  calloutBadge: {
    backgroundColor: '#c9623d',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  calloutRef: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  arrow: {
    marginHorizontal: 4,
  },
  targetBadge: {
    backgroundColor: '#374151',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  targetRef: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 20,
    gap: 8,
  },
  confidenceDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  confidenceLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  confidencePercent: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9ca3af',
  },
  goToSheetButton: {
    backgroundColor: '#c9623d',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 10,
    marginBottom: 16,
    // Large touch target for construction workers
    minHeight: 56,
  },
  goToSheetText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  positionInfo: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
});
