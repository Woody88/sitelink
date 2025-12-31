import React from "react";
import { View, Image, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SyncStatusBadge, type SyncStatus } from "./sync-status-badge";
import { PhotoStatusBadge, type PhotoStatus } from "./photo-status-badge";
import { cn } from "@/lib/utils";

/**
 * Photo data structure
 *
 * Core data captured with each photo:
 * - uri: Local file path (offline-first)
 * - thumbnailUri: Compressed version for lists
 * - capturedAt: Timestamp for auto-bundling
 * - syncStatus: Upload status
 * - status: Work status (before/progress/complete/issue)
 * - description: Bundle label/description (can add later)
 * - note: Optional photo-specific note
 */
export interface PhotoData {
  id: string;
  uri: string;
  thumbnailUri?: string;
  capturedAt: Date;
  syncStatus: SyncStatus;
  status?: PhotoStatus;
  description?: string;
  note?: string;
}

interface PhotoThumbnailProps {
  photo: PhotoData;
  size?: "sm" | "md" | "lg";
  showSyncStatus?: boolean;
  showPhotoStatus?: boolean;
  onPress?: (photo: PhotoData) => void;
  isSelected?: boolean;
  selectionIndex?: number;
}

const SIZE_MAP = {
  sm: { width: 60, height: 60, radius: 8 },
  md: { width: 80, height: 80, radius: 10 },
  lg: { width: 120, height: 120, radius: 12 },
};

/**
 * Photo thumbnail for use in:
 * - Bundle carousel preview
 * - Full bundle grid view
 * - Photo picker/selector
 *
 * Design principles:
 * - Shows sync status only for non-synced photos
 * - Shows photo status badge (before/progress/complete/issue)
 * - Large enough touch target (minimum 60px)
 * - Selection state for multi-select operations
 */
export function PhotoThumbnail({
  photo,
  size = "md",
  showSyncStatus = true,
  showPhotoStatus = true,
  onPress,
  isSelected = false,
  selectionIndex,
}: PhotoThumbnailProps) {
  const dimensions = SIZE_MAP[size];
  const imageUri = photo.thumbnailUri ?? photo.uri;

  return (
    <Pressable
      onPress={() => onPress?.(photo)}
      style={[
        styles.container,
        {
          width: dimensions.width,
          height: dimensions.height,
          borderRadius: dimensions.radius,
        },
        isSelected && styles.selected,
      ]}
    >
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={[styles.image, { borderRadius: dimensions.radius }]}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.placeholder, { borderRadius: dimensions.radius }]}>
          <Ionicons name="image-outline" size={24} color="#828180" />
        </View>
      )}

      {/* Photo status badge - top left */}
      {showPhotoStatus && photo.status && (
        <View style={styles.statusOverlay}>
          <PhotoStatusBadge status={photo.status} size="sm" showIcon={false} variant="solid" />
        </View>
      )}

      {/* Sync status overlay - bottom right */}
      {showSyncStatus && photo.syncStatus !== "SYNCED" && (
        <View style={styles.syncOverlay}>
          <SyncStatusBadge status={photo.syncStatus} size="sm" />
        </View>
      )}

      {/* Selection indicator - top right */}
      {isSelected && (
        <View style={styles.selectionBadge}>
          {selectionIndex !== undefined ? (
            <View style={styles.selectionNumber}>
              <Ionicons name="checkmark" size={12} color="#ffffff" />
            </View>
          ) : (
            <Ionicons name="checkmark-circle" size={20} color="#c9623d" />
          )}
        </View>
      )}

      {/* Unselected state indicator for multi-select mode */}
      {!isSelected && selectionIndex === undefined && onPress && (
        <View style={styles.selectableRing} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    backgroundColor: "#f4f4f4",
  },
  selected: {
    borderWidth: 3,
    borderColor: "#c9623d",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e5e5e5",
  },
  statusOverlay: {
    position: "absolute",
    top: 4,
    left: 4,
  },
  syncOverlay: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 10,
    padding: 2,
  },
  selectionBadge: {
    position: "absolute",
    top: 4,
    right: 4,
  },
  selectionNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#c9623d",
    alignItems: "center",
    justifyContent: "center",
  },
  selectableRing: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.8)",
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },
});
