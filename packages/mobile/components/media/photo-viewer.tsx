import React, { useCallback, useState, useEffect } from "react";
import {
  View,
  Modal,
  Pressable,
  Image,
  Dimensions,
  StyleSheet,
  StatusBar,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { Text } from "@/components/ui/text";
import { SyncStatusBadge } from "./sync-status-badge";
import { PhotoStatusBadge, PhotoStatusInlineSelector, type PhotoStatus } from "./photo-status-badge";
import type { PhotoData } from "./photo-thumbnail";
import type { PhotoBundle } from "./photo-bundle-card";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface PhotoViewerProps {
  visible: boolean;
  photos: PhotoData[];
  initialIndex: number;
  bundle?: PhotoBundle;
  onClose: () => void;
  onStatusChange?: (photoId: string, status: PhotoStatus) => void;
}

/**
 * Full-screen Photo Viewer
 *
 * Features:
 * - Swipe left/right to navigate between photos
 * - Pinch-to-zoom for detail inspection
 * - Double-tap to toggle zoom
 * - Drag to pan when zoomed
 * - Swipe down to dismiss
 * - Photo metadata overlay (timestamp, sync status, photo status)
 * - Inline photo status selector
 *
 * Construction-friendly design:
 * - Large close button (48x48 minimum)
 * - Clear visual feedback
 * - Works with gloves (large touch targets)
 */
export function PhotoViewer({
  visible,
  photos,
  initialIndex,
  bundle,
  onClose,
  onStatusChange,
}: PhotoViewerProps) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showOverlay, setShowOverlay] = useState(true);
  const [showStatusSelector, setShowStatusSelector] = useState(false);
  const flatListRef = React.useRef<FlatList>(null);

  // Reset index when modal opens with new initialIndex
  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      setShowOverlay(true);
      setShowStatusSelector(false);
      // Scroll to initial index after a short delay
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: initialIndex,
          animated: false,
        });
      }, 50);
    }
  }, [visible, initialIndex]);

  const currentPhoto = photos[currentIndex];

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      flatListRef.current?.scrollToIndex({ index: newIndex, animated: true });
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < photos.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      flatListRef.current?.scrollToIndex({ index: newIndex, animated: true });
    }
  }, [currentIndex, photos.length]);

  const toggleOverlay = useCallback(() => {
    setShowOverlay((prev) => !prev);
  }, []);

  const handleScroll = useCallback((event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offsetX / SCREEN_WIDTH);
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < photos.length) {
      setCurrentIndex(newIndex);
      setShowStatusSelector(false);
    }
  }, [currentIndex, photos.length]);

  const toggleStatusSelector = useCallback(() => {
    setShowStatusSelector((prev) => !prev);
  }, []);

  const handleStatusChange = useCallback((status: PhotoStatus) => {
    if (currentPhoto && onStatusChange) {
      onStatusChange(currentPhoto.id, status);
    }
    setShowStatusSelector(false);
  }, [currentPhoto, onStatusChange]);

  const renderPhoto = useCallback(
    ({ item, index }: { item: PhotoData; index: number }) => (
      <ZoomableImage
        uri={item.uri}
        onSwipeDown={onClose}
        onTap={toggleOverlay}
        isActive={index === currentIndex}
      />
    ),
    [currentIndex, onClose, toggleOverlay]
  );

  if (!currentPhoto) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <View style={styles.container}>
        {/* Photo carousel using FlatList for smooth swiping */}
        <FlatList
          ref={flatListRef}
          data={photos}
          renderItem={renderPhoto}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
          initialScrollIndex={initialIndex}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              flatListRef.current?.scrollToIndex({
                index: info.index,
                animated: false,
              });
            }, 100);
          }}
        />

        {/* Header overlay */}
        {showOverlay && (
          <View
            style={[
              styles.headerOverlay,
              { paddingTop: insets.top + 8 },
            ]}
          >
            {/* Close button - extra large for construction workers */}
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Close photo viewer"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={28} color="#ffffff" />
            </Pressable>

            {/* Counter */}
            <View style={styles.counterBadge}>
              <Text style={styles.counterText}>
                {currentIndex + 1} / {photos.length}
              </Text>
            </View>

            {/* Status badges row */}
            <View style={styles.statusRow}>
              {/* Photo status badge - tap to edit */}
              {currentPhoto.status && (
                <Pressable
                  onPress={onStatusChange ? toggleStatusSelector : undefined}
                  style={styles.headerStatusBadge}
                >
                  <PhotoStatusBadge
                    status={currentPhoto.status}
                    size="md"
                    variant="solid"
                  />
                  {onStatusChange && (
                    <Ionicons
                      name="pencil"
                      size={12}
                      color="#ffffff"
                      style={styles.editIcon}
                    />
                  )}
                </Pressable>
              )}

              {/* Sync status */}
              {currentPhoto.syncStatus !== "SYNCED" && (
                <View style={styles.syncBadge}>
                  <SyncStatusBadge
                    status={currentPhoto.syncStatus}
                    showLabel
                    size="md"
                  />
                </View>
              )}
            </View>
          </View>
        )}

        {/* Photo status selector overlay */}
        {showOverlay && showStatusSelector && onStatusChange && (
          <View style={styles.statusSelectorOverlay}>
            <Text style={styles.statusSelectorTitle}>Change Status</Text>
            <PhotoStatusInlineSelector
              selectedStatus={currentPhoto.status || "before"}
              onStatusChange={handleStatusChange}
            />
          </View>
        )}

        {/* Footer overlay with metadata */}
        {showOverlay && (
          <View
            style={[
              styles.footerOverlay,
              { paddingBottom: insets.bottom + 16 },
            ]}
          >
            {/* Timestamp */}
            <View style={styles.metadataRow}>
              <Ionicons name="time-outline" size={16} color="#ffffff" />
              <Text style={styles.metadataText}>
                {formatTimestamp(currentPhoto.capturedAt)}
              </Text>
            </View>

            {/* Bundle info */}
            {bundle && (
              <>
                {bundle.label && (
                  <View style={styles.metadataRow}>
                    <Ionicons name="bookmark-outline" size={16} color="#ffffff" />
                    <Text style={styles.metadataText} numberOfLines={1}>
                      {bundle.label}
                    </Text>
                  </View>
                )}
                {bundle.location?.name && (
                  <View style={styles.metadataRow}>
                    <Ionicons name="location-outline" size={16} color="#ffffff" />
                    <Text style={styles.metadataText} numberOfLines={1}>
                      {bundle.location.name}
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* Photo note */}
            {currentPhoto.note && (
              <View style={styles.noteContainer}>
                <Text style={styles.noteText} numberOfLines={3}>
                  {currentPhoto.note}
                </Text>
              </View>
            )}

            {/* Quick status change button if no status set */}
            {!currentPhoto.status && onStatusChange && (
              <Pressable
                onPress={toggleStatusSelector}
                style={styles.addStatusButton}
              >
                <Ionicons name="pricetag-outline" size={16} color="#ffffff" />
                <Text style={styles.addStatusText}>Add Status</Text>
              </Pressable>
            )}

            {/* Navigation dots - only show for reasonable number of photos */}
            {photos.length > 1 && photos.length <= 10 && (
              <View style={styles.dotsContainer}>
                {photos.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.dot,
                      index === currentIndex && styles.dotActive,
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Navigation arrows - large for construction workers */}
        {showOverlay && photos.length > 1 && (
          <>
            {currentIndex > 0 && (
              <Pressable
                onPress={handlePrevious}
                style={[styles.navButton, styles.navButtonLeft]}
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                accessibilityLabel="Previous photo"
                accessibilityRole="button"
              >
                <Ionicons name="chevron-back" size={32} color="#ffffff" />
              </Pressable>
            )}
            {currentIndex < photos.length - 1 && (
              <Pressable
                onPress={handleNext}
                style={[styles.navButton, styles.navButtonRight]}
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                accessibilityLabel="Next photo"
                accessibilityRole="button"
              >
                <Ionicons name="chevron-forward" size={32} color="#ffffff" />
              </Pressable>
            )}
          </>
        )}
      </View>
    </Modal>
  );
}

/**
 * Zoomable Image with gesture support
 */
interface ZoomableImageProps {
  uri: string;
  onSwipeDown: () => void;
  onTap: () => void;
  isActive: boolean;
}

function ZoomableImage({
  uri,
  onSwipeDown,
  onTap,
  isActive,
}: ZoomableImageProps) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  useEffect(() => {
    if (!isActive) {
      scale.value = withSpring(1);
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      savedScale.value = 1;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    }
  }, [isActive]);

  const resetPosition = useCallback(() => {
    scale.value = withSpring(1);
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    savedScale.value = 1;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, []);

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((event) => {
      const newScale = savedScale.value * event.scale;
      scale.value = Math.min(Math.max(newScale, 0.5), 4);
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
      savedScale.value = scale.value;
    });

  const panGesture = Gesture.Pan()
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      if (scale.value > 1) {
        const maxTranslateX = ((scale.value - 1) * SCREEN_WIDTH) / 2;
        const maxTranslateY = ((scale.value - 1) * SCREEN_HEIGHT) / 2;
        translateX.value = Math.min(
          Math.max(savedTranslateX.value + event.translationX, -maxTranslateX),
          maxTranslateX
        );
        translateY.value = Math.min(
          Math.max(savedTranslateY.value + event.translationY, -maxTranslateY),
          maxTranslateY
        );
      } else {
        translateY.value = Math.max(0, event.translationY);
      }
    })
    .onEnd((event) => {
      if (scale.value <= 1) {
        if (event.translationY > 100 && event.velocityY > 300) {
          runOnJS(onSwipeDown)();
        }
        translateY.value = withSpring(0);
      }
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event) => {
      if (scale.value > 1) {
        runOnJS(resetPosition)();
      } else {
        scale.value = withSpring(2);
        savedScale.value = 2;
        const tapX = event.x - SCREEN_WIDTH / 2;
        const tapY = event.y - SCREEN_HEIGHT / 2;
        translateX.value = withSpring(-tapX);
        translateY.value = withSpring(-tapY);
        savedTranslateX.value = -tapX;
        savedTranslateY.value = -tapY;
      }
    });

  const singleTapGesture = Gesture.Tap()
    .onEnd(() => {
      if (scale.value <= 1.1) {
        runOnJS(onTap)();
      }
    });

  const composedGestures = Gesture.Simultaneous(
    pinchGesture,
    panGesture,
    Gesture.Exclusive(doubleTapGesture, singleTapGesture)
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View style={styles.photoItemContainer}>
      <GestureDetector gesture={composedGestures}>
        <Animated.View style={[styles.imageContainer, animatedStyle]}>
          <Image
            source={{ uri }}
            style={styles.image}
            resizeMode="contain"
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function formatTimestamp(date: Date): string {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (isToday) return `Today at ${timeStr}`;
  if (isYesterday) return `Yesterday at ${timeStr}`;

  const dateStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return `${dateStr} at ${timeStr}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  photoItemContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  headerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  closeButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  counterBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  counterText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  editIcon: {
    marginLeft: 4,
    opacity: 0.8,
  },
  syncBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  statusSelectorOverlay: {
    position: "absolute",
    top: 120,
    left: 16,
    right: 16,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    borderRadius: 16,
    padding: 16,
  },
  statusSelectorTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "center",
  },
  footerOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  metadataRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  metadataText: {
    color: "#ffffff",
    fontSize: 14,
    flex: 1,
  },
  noteContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    marginBottom: 12,
  },
  noteText: {
    color: "#ffffff",
    fontSize: 14,
    lineHeight: 20,
  },
  addStatusButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 20,
    alignSelf: "center",
    marginTop: 8,
    marginBottom: 12,
  },
  addStatusText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
  },
  dotActive: {
    backgroundColor: "#ffffff",
    width: 24,
  },
  navButton: {
    position: "absolute",
    top: "50%",
    marginTop: -28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  navButtonLeft: {
    left: 12,
  },
  navButtonRight: {
    right: 12,
  },
});
