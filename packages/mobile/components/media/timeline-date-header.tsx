import React from "react";
import { View, StyleSheet } from "react-native";
import { Text } from "@/components/ui/text";
import { Ionicons } from "@expo/vector-icons";

interface TimelineDateHeaderProps {
  date: Date;
  bundleCount: number;
  photoCount: number;
}

/**
 * Format date for display
 * - "Today" / "Yesterday" for recent
 * - "Monday, Dec 23" for this week
 * - "Dec 23, 2024" for older
 */
function formatDate(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) return "Today";
  if (isYesterday) return "Yesterday";

  // Check if within this week
  const daysDiff = Math.floor(
    (today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysDiff < 7) {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  }

  // Older dates
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Timeline Date Header
 *
 * Groups bundles by day in the timeline
 * Shows date + summary stats
 */
export function TimelineDateHeader({
  date,
  bundleCount,
  photoCount,
}: TimelineDateHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <Ionicons name="calendar-outline" size={18} color="#c9623d" />
        <Text style={styles.dateText}>{formatDate(date)}</Text>
      </View>
      <Text style={styles.statsText}>
        {bundleCount} {bundleCount === 1 ? "sequence" : "sequences"} · {photoCount}{" "}
        {photoCount === 1 ? "photo" : "photos"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#3d3929",
  },
  statsText: {
    fontSize: 12,
    color: "#828180",
  },
});
