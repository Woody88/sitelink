import React from "react";
import { View, ActivityIndicator } from "react-native";
import { Text } from "@/components/ui/text";
import { Ionicons } from "@expo/vector-icons";
import { cn } from "@/lib/utils";

/**
 * Sync Status - critical for construction sites with poor connectivity
 *
 * Workers need to know:
 * - Did my photos upload?
 * - What's still pending?
 * - Did anything fail?
 */
export type SyncStatus = "SYNCED" | "SYNCING" | "PENDING" | "FAILED";

const SYNC_STATUS_CONFIG: Record<
  SyncStatus,
  {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    bgColor: string;
  }
> = {
  SYNCED: {
    label: "Synced",
    icon: "cloud-done",
    color: "#22c55e",
    bgColor: "bg-green-100",
  },
  SYNCING: {
    label: "Uploading",
    icon: "cloud-upload",
    color: "#3b82f6",
    bgColor: "bg-blue-100",
  },
  PENDING: {
    label: "Waiting",
    icon: "cloud-offline",
    color: "#f59e0b",
    bgColor: "bg-amber-100",
  },
  FAILED: {
    label: "Failed",
    icon: "cloud-offline",
    color: "#ef4444",
    bgColor: "bg-red-100",
  },
};

interface SyncStatusBadgeProps {
  status: SyncStatus;
  showLabel?: boolean;
  size?: "sm" | "md";
  count?: number;
}

/**
 * Shows sync status with optional label and count
 *
 * Usage:
 * - Icon only: Quick status indicator on thumbnails
 * - With label: Status in bundle cards or headers
 * - With count: "3 pending" in header status bar
 */
export function SyncStatusBadge({
  status,
  showLabel = false,
  size = "sm",
  count,
}: SyncStatusBadgeProps) {
  const config = SYNC_STATUS_CONFIG[status];
  const iconSize = size === "sm" ? 14 : 18;

  // Don't show anything for synced status unless explicitly requested
  if (status === "SYNCED" && !showLabel) {
    return null;
  }

  const label = count !== undefined && count > 1
    ? `${count} ${config.label.toLowerCase()}`
    : config.label;

  return (
    <View className="flex-row items-center gap-1">
      {status === "SYNCING" ? (
        <ActivityIndicator size="small" color={config.color} />
      ) : (
        <Ionicons name={config.icon} size={iconSize} color={config.color} />
      )}
      {showLabel && (
        <Text
          className={cn(
            "font-medium",
            size === "sm" ? "text-xs" : "text-sm"
          )}
          style={{ color: config.color }}
        >
          {label}
        </Text>
      )}
    </View>
  );
}

/**
 * Summary status for bundle or screen header
 * Shows the "worst" status among a set of items
 */
export function getSummaryStatus(statuses: SyncStatus[]): SyncStatus {
  if (statuses.some((s) => s === "FAILED")) return "FAILED";
  if (statuses.some((s) => s === "SYNCING")) return "SYNCING";
  if (statuses.some((s) => s === "PENDING")) return "PENDING";
  return "SYNCED";
}

/**
 * Count pending/failed items for status bar display
 */
export function countPendingItems(statuses: SyncStatus[]): {
  pending: number;
  syncing: number;
  failed: number;
} {
  return {
    pending: statuses.filter((s) => s === "PENDING").length,
    syncing: statuses.filter((s) => s === "SYNCING").length,
    failed: statuses.filter((s) => s === "FAILED").length,
  };
}
