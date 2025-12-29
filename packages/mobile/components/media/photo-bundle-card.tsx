import React from "react";
import { View, Pressable, ScrollView, StyleSheet } from "react-native";
import { Text } from "@/components/ui/text";
import { Ionicons } from "@expo/vector-icons";
import { WorkStateBadge, type WorkState } from "./work-state-badge";
import { SyncStatusBadge, getSummaryStatus, type SyncStatus } from "./sync-status-badge";
import { PhotoThumbnail, type PhotoData } from "./photo-thumbnail";
import { cn } from "@/lib/utils";

/**
 * Photo Bundle - a sequence of related photos
 *
 * Auto-created by the system when:
 * - Same work state
 * - Taken within 30 minutes of each other
 * - (Optional) Same approximate GPS location
 *
 * Workers can:
 * - Add a label after the fact
 * - Add notes to the bundle
 * - Share the entire bundle
 */
export interface PhotoBundle {
  id: string;
  workState: WorkState;
  photos: PhotoData[];
  startTime: Date;
  endTime: Date;
  label?: string;
  note?: string;
  capturedBy?: string;
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
  };
  planLink?: {
    sheetId: string;
    sheetName: string;
  };
}

interface PhotoBundleCardProps {
  bundle: PhotoBundle;
  onPress?: (bundle: PhotoBundle) => void;
  onPhotoPress?: (photo: PhotoData, bundle: PhotoBundle) => void;
  onAddLabel?: (bundle: PhotoBundle) => void;
  onMenuPress?: (bundle: PhotoBundle) => void;
}

/**
 * Format time range for display
 * "2:30 PM" or "2:30 PM - 2:45 PM"
 */
function formatTimeRange(start: Date, end: Date): string {
  const formatTime = (d: Date) =>
    d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  // If same minute, just show one time
  const startStr = formatTime(start);
  const endStr = formatTime(end);

  if (startStr === endStr) {
    return startStr;
  }

  return `${startStr} - ${endStr}`;
}

/**
 * Photo Bundle Card
 *
 * Design decisions:
 * 1. HORIZONTAL CAROUSEL for photo preview
 *    - Shows sequence flow naturally
 *    - Swipeable with one thumb
 *    - Compact vertical space
 *
 * 2. Shows 4 photos max, then "+N more" indicator
 *    - Enough to get a sense of the sequence
 *    - Not overwhelming
 *
 * 3. Work state badge is prominent
 *    - Color-coded for quick scanning
 *    - This is the key filter/search dimension
 *
 * 4. Optional "Add label" button
 *    - Workers can organize AFTER capture
 *    - Not required upfront
 */
export function PhotoBundleCard({
  bundle,
  onPress,
  onPhotoPress,
  onAddLabel,
  onMenuPress,
}: PhotoBundleCardProps) {
  const summaryStatus = getSummaryStatus(bundle.photos.map((p) => p.syncStatus));
  const photoCount = bundle.photos.length;
  const maxVisiblePhotos = 4;
  const remainingCount = Math.max(0, photoCount - maxVisiblePhotos);

  return (
    <Pressable
      onPress={() => onPress?.(bundle)}
      style={styles.card}
    >
      {/* Header Row: Work State + Time + Menu */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <WorkStateBadge state={bundle.workState} size="md" />
          <Text style={styles.timeText}>
            {formatTimeRange(bundle.startTime, bundle.endTime)}
          </Text>
        </View>

        <View style={styles.headerRight}>
          {summaryStatus !== "SYNCED" && (
            <SyncStatusBadge status={summaryStatus} size="sm" />
          )}
          <Pressable
            onPress={() => onMenuPress?.(bundle)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.menuButton}
          >
            <Ionicons name="ellipsis-vertical" size={18} color="#828180" />
          </Pressable>
        </View>
      </View>

      {/* Label Row (if exists) or Add Label button */}
      {bundle.label ? (
        <View style={styles.labelRow}>
          <Text style={styles.labelText} numberOfLines={1}>
            {bundle.label}
          </Text>
        </View>
      ) : onAddLabel ? (
        <Pressable
          onPress={() => onAddLabel(bundle)}
          style={styles.addLabelButton}
        >
          <Ionicons name="add-circle-outline" size={14} color="#828180" />
          <Text style={styles.addLabelText}>Add label</Text>
        </Pressable>
      ) : null}

      {/* Photo Carousel */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.photoCarousel}
        style={styles.carouselContainer}
      >
        {bundle.photos.slice(0, maxVisiblePhotos).map((photo) => (
          <PhotoThumbnail
            key={photo.id}
            photo={photo}
            size="md"
            showSyncStatus={false}
            onPress={(p) => onPhotoPress?.(p, bundle)}
          />
        ))}

        {/* "More" indicator */}
        {remainingCount > 0 && (
          <Pressable
            onPress={() => onPress?.(bundle)}
            style={styles.moreIndicator}
          >
            <Text style={styles.moreCount}>+{remainingCount}</Text>
            <Text style={styles.moreLabel}>more</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* Footer: Photo count + metadata */}
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <View style={styles.metaItem}>
            <Ionicons name="images-outline" size={14} color="#828180" />
            <Text style={styles.metaText}>
              {photoCount} {photoCount === 1 ? "photo" : "photos"}
            </Text>
          </View>

          {bundle.capturedBy && (
            <View style={styles.metaItem}>
              <Ionicons name="person-outline" size={14} color="#828180" />
              <Text style={styles.metaText}>{bundle.capturedBy}</Text>
            </View>
          )}
        </View>

        {/* Location or Plan Link */}
        {bundle.planLink ? (
          <View style={styles.metaItem}>
            <Ionicons name="document-outline" size={14} color="#c9623d" />
            <Text style={[styles.metaText, styles.linkText]} numberOfLines={1}>
              {bundle.planLink.sheetName}
            </Text>
          </View>
        ) : bundle.location?.name ? (
          <View style={styles.metaItem}>
            <Ionicons name="location-outline" size={14} color="#828180" />
            <Text style={styles.metaText} numberOfLines={1}>
              {bundle.location.name}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Note (if exists) */}
      {bundle.note && (
        <View style={styles.noteSection}>
          <Text style={styles.noteText} numberOfLines={2}>
            {bundle.note}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    marginBottom: 12,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  timeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3d3929",
  },
  menuButton: {
    padding: 4,
  },
  labelRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  labelText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#3d3929",
  },
  addLabelButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  addLabelText: {
    fontSize: 13,
    color: "#828180",
  },
  carouselContainer: {
    marginBottom: 8,
  },
  photoCarousel: {
    paddingHorizontal: 16,
    gap: 8,
  },
  moreIndicator: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: "#f4f4f4",
    alignItems: "center",
    justifyContent: "center",
  },
  moreCount: {
    fontSize: 20,
    fontWeight: "700",
    color: "#c9623d",
  },
  moreLabel: {
    fontSize: 12,
    color: "#828180",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#fafafa",
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  footerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: "#828180",
  },
  linkText: {
    color: "#c9623d",
    fontWeight: "500",
  },
  noteSection: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  noteText: {
    fontSize: 14,
    color: "#3d3929",
    lineHeight: 20,
  },
});
