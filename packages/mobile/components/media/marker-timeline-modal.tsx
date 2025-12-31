import React, { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMarkerMedia } from "@/lib/api/hooks";
import { MediaApi } from "@/lib/api/client";
import {
  PhotoThumbnail,
  type PhotoData,
  PhotoStatusBadge,
  type PhotoStatus,
  PhotoViewer
} from ".";

interface MarkerTimelineModalProps {
  visible: boolean;
  markerId: string | null;
  markerRef: string | null;
  onClose: () => void;
  onAddPhoto: () => void;
}

/**
 * Marker Media Timeline Modal
 *
 * Displays all media for a specific marker grouped by work state.
 * States are shown in chronological order: Start → In Progress → Issue → Complete
 */
export function MarkerTimelineModal({
  visible,
  markerId,
  markerRef,
  onClose,
  onAddPhoto,
}: MarkerTimelineModalProps) {
  const insets = useSafeAreaInsets();
  const { data, isLoading, error } = useMarkerMedia(markerId);

  // PhotoViewer state
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerPhotos, setViewerPhotos] = useState<PhotoData[]>([]);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);

  // Group media by status
  const groupedMedia = useMemo(() => {
    if (!data?.media) return new Map<PhotoStatus, PhotoData[]>();

    const groups = new Map<PhotoStatus, PhotoData[]>();
    
    // Define the canonical order for states
    const statusOrder: PhotoStatus[] = ["before", "progress", "issue", "complete"];
    
    // Initialize groups in order
    statusOrder.forEach(status => groups.set(status, []));

    data.media.forEach((item) => {
      const status = (item.status || "progress") as PhotoStatus;
      const photo: PhotoData = {
        id: item.id,
        uri: MediaApi.getDownloadUrl(item.id),
        capturedAt: new Date(item.createdAt),
        syncStatus: "SYNCED",
        status: status,
      };

      const group = groups.get(status) || [];
      group.push(photo);
      groups.set(status, group);
    });

    return groups;
  }, [data]);

  const hasMedia = data?.media && data.media.length > 0;

  // Handle photo press - open viewer with all photos from the same status group
  const handlePhotoPress = useCallback((photo: PhotoData, statusPhotos: PhotoData[]) => {
    const photoIndex = statusPhotos.findIndex((p) => p.id === photo.id);
    setViewerPhotos(statusPhotos);
    setViewerInitialIndex(photoIndex >= 0 ? photoIndex : 0);
    setViewerVisible(true);
  }, []);

  const handleCloseViewer = useCallback(() => {
    setViewerVisible(false);
  }, []);

  /**
   * Handle photo status change from the viewer
   *
   * In production, this would:
   * 1. Update local SQLite database
   * 2. Queue sync to backend
   * 3. Update UI optimistically
   */
  const handlePhotoStatusChange = useCallback((photoId: string, status: PhotoStatus) => {
    // Update the viewer photos if the viewer is open
    setViewerPhotos((prevPhotos) =>
      prevPhotos.map((photo) =>
        photo.id === photoId ? { ...photo, status } : photo
      )
    );

    // TODO: Update status via API when backend supports it
    console.log(`Photo ${photoId} status changed to: ${status}`);
  }, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { paddingTop: insets.top }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>Media Timeline</Text>
              <Text style={styles.headerSubtitle}>Marker {markerRef}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#fff" />
            </Pressable>
          </View>

          {isLoading ? (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color="#c9623d" />
            </View>
          ) : error ? (
            <View style={styles.centerContent}>
              <Text style={styles.errorText}>Failed to load media timeline</Text>
            </View>
          ) : !hasMedia ? (
            <View style={styles.centerContent}>
              <Ionicons name="images-outline" size={64} color="#4b5563" />
              <Text style={styles.emptyTitle}>No Media Yet</Text>
              <Text style={styles.emptyText}>
                Take photos to document progress for this marker.
              </Text>
              <Pressable style={styles.addPhotoButton} onPress={onAddPhoto}>
                <Ionicons name="camera" size={20} color="#fff" />
                <Text style={styles.addPhotoText}>Add First Photo</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
              {Array.from(groupedMedia.entries()).map(([status, photos]) => {
                if (photos.length === 0) return null;
                
                return (
                  <View key={status} style={styles.statusGroup}>
                    <View style={styles.statusHeader}>
                      <PhotoStatusBadge status={status} variant="solid" size="md" />
                      <View style={styles.line} />
                    </View>
                    
                    <View style={styles.photoGrid}>
                      {photos.map((photo) => (
                        <View key={photo.id} style={styles.photoWrapper}>
                          <PhotoThumbnail
                            photo={photo}
                            size="lg"
                            onPress={() => handlePhotoPress(photo, photos)}
                          />
                          <Text style={styles.timestamp}>
                            {photo.capturedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                          <Text style={styles.date}>
                            {photo.capturedAt.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* Action Bar */}
          {hasMedia && (
            <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 20) }]}>
              <Pressable style={styles.primaryActionButton} onPress={onAddPhoto}>
                <Ionicons name="camera" size={24} color="#fff" />
                <Text style={styles.primaryActionText}>Add Progress Photo</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>

      {/* Photo Viewer Modal */}
      <PhotoViewer
        visible={viewerVisible}
        photos={viewerPhotos}
        initialIndex={viewerInitialIndex}
        onClose={handleCloseViewer}
        onStatusChange={handlePhotoStatusChange}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 16,
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
    marginTop: 20,
  },
  emptyText: {
    color: "#9ca3af",
    fontSize: 16,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  addPhotoButton: {
    backgroundColor: "#c9623d",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  addPhotoText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  statusGroup: {
    marginBottom: 32,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: "#374151",
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  photoWrapper: {
    width: "47%",
    marginBottom: 16,
  },
  timestamp: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 8,
  },
  date: {
    color: "#9ca3af",
    fontSize: 11,
    marginTop: 2,
  },
  actionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    borderTopWidth: 1,
    borderTopColor: "#374151",
  },
  primaryActionButton: {
    backgroundColor: "#c9623d",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 12,
  },
  primaryActionText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});
