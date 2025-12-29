import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Text } from "@/components/ui/text";
import { Ionicons } from "@expo/vector-icons";

interface MediaEmptyStateProps {
  hasFilters: boolean;
  onClearFilters?: () => void;
  onCapture?: () => void;
}

/**
 * Empty State for Media Timeline
 *
 * Two states:
 * 1. No photos match filters - offer to clear filters
 * 2. No photos at all - encourage first capture
 *
 * Design: Friendly, not intimidating
 */
export function MediaEmptyState({
  hasFilters,
  onClearFilters,
  onCapture,
}: MediaEmptyStateProps) {
  if (hasFilters) {
    return (
      <View style={styles.container}>
        <View style={styles.iconContainer}>
          <Ionicons name="filter-outline" size={48} color="#828180" />
        </View>
        <Text style={styles.title}>No Photos Match</Text>
        <Text style={styles.description}>
          Try adjusting your filters to see more photos.
        </Text>
        {onClearFilters && (
          <Pressable onPress={onClearFilters} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Clear Filters</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.iconContainer, styles.iconContainerPrimary]}>
        <Ionicons name="camera-outline" size={56} color="#c9623d" />
      </View>
      <Text style={styles.title}>No Photos Yet</Text>
      <Text style={styles.description}>
        Start documenting your work.{"\n"}
        Photos are automatically organized by time and work state.
      </Text>
      {onCapture && (
        <Pressable onPress={onCapture} style={styles.primaryButton}>
          <Ionicons name="camera" size={20} color="#ffffff" />
          <Text style={styles.primaryButtonText}>Take First Photo</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#f4f4f4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  iconContainerPrimary: {
    backgroundColor: "#fef3ed",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#3d3929",
    marginBottom: 8,
    textAlign: "center",
  },
  description: {
    fontSize: 14,
    color: "#828180",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: "#c9623d",
    borderRadius: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  secondaryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#f4f4f4",
    borderRadius: 12,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#3d3929",
  },
});
