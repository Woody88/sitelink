import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Text } from "@/components/ui/text";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SyncStatusBadge, type SyncStatus } from "./sync-status-badge";

interface MediaHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onSearch?: () => void;
  syncSummary?: {
    total: number;
    pending: number;
    failed: number;
    status: SyncStatus;
  };
}

/**
 * Media Screen Header
 *
 * Shows:
 * - Project name (subtitle)
 * - Sync status summary
 * - Search button
 */
export function MediaHeader({
  title,
  subtitle,
  onBack,
  onSearch,
  syncSummary,
}: MediaHeaderProps) {
  const insets = useSafeAreaInsets();

  // Format sync status message
  const getSyncMessage = (): string => {
    if (!syncSummary) return "";

    if (syncSummary.failed > 0) {
      return `${syncSummary.failed} failed`;
    }
    if (syncSummary.pending > 0) {
      return `${syncSummary.pending} pending`;
    }
    return `${syncSummary.total} synced`;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Main Row */}
      <View style={styles.mainRow}>
        {/* Left: Back button or spacer */}
        <View style={styles.leftSection}>
          {onBack ? (
            <Pressable
              onPress={onBack}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.iconButton}
            >
              <Ionicons name="arrow-back" size={24} color="#3d3929" />
            </Pressable>
          ) : (
            <View style={styles.spacer} />
          )}
        </View>

        {/* Center: Title */}
        <View style={styles.centerSection}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>

        {/* Right: Search button */}
        <View style={styles.rightSection}>
          {onSearch && (
            <Pressable
              onPress={onSearch}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.iconButton}
            >
              <Ionicons name="search" size={24} color="#3d3929" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Sync Status Bar */}
      {syncSummary && (
        <View style={styles.syncBar}>
          <SyncStatusBadge
            status={syncSummary.status}
            showLabel
            size="sm"
          />
          <Text style={styles.syncText}>{getSyncMessage()}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  leftSection: {
    width: 40,
  },
  centerSection: {
    flex: 1,
    alignItems: "center",
  },
  rightSection: {
    width: 40,
    alignItems: "flex-end",
  },
  spacer: {
    width: 24,
  },
  iconButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#3d3929",
  },
  subtitle: {
    fontSize: 12,
    color: "#828180",
    marginTop: 2,
  },
  syncBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingBottom: 10,
  },
  syncText: {
    fontSize: 12,
    color: "#828180",
  },
});
