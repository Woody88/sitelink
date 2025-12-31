import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Text } from "@/components/ui/text";
import { Ionicons } from "@expo/vector-icons";
import { cn } from "@/lib/utils";

/**
 * Photo Status - indicates the state of work when photo was taken
 *
 * This is applied at the individual photo level to indicate:
 * - before: Documenting conditions before work starts
 * - progress: Work is actively in progress
 * - complete: Work is finished
 * - issue: Documenting a problem or issue
 */
export type PhotoStatus = "before" | "progress" | "complete" | "issue";

const PHOTO_STATUS_CONFIG: Record<
  PhotoStatus,
  {
    label: string;
    shortLabel: string;
    bg: string;
    activeBg: string;
    text: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    description: string;
  }
> = {
  before: {
    label: "Before",
    shortLabel: "Before",
    bg: "bg-blue-100",
    activeBg: "bg-blue-500",
    text: "text-blue-700",
    icon: "flag-outline",
    iconColor: "#3b82f6",
    description: "Before work started",
  },
  progress: {
    label: "In Progress",
    shortLabel: "Progress",
    bg: "bg-amber-100",
    activeBg: "bg-amber-500",
    text: "text-amber-700",
    icon: "construct-outline",
    iconColor: "#f59e0b",
    description: "Work in progress",
  },
  complete: {
    label: "Complete",
    shortLabel: "Complete",
    bg: "bg-green-100",
    activeBg: "bg-green-500",
    text: "text-green-700",
    icon: "checkmark-circle-outline",
    iconColor: "#22c55e",
    description: "Work completed",
  },
  issue: {
    label: "Issue",
    shortLabel: "Issue",
    bg: "bg-red-100",
    activeBg: "bg-red-500",
    text: "text-red-700",
    icon: "warning-outline",
    iconColor: "#ef4444",
    description: "Problem/issue documented",
  },
};

interface PhotoStatusBadgeProps {
  status: PhotoStatus;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  variant?: "default" | "solid";
}

/**
 * Displays photo status as a badge
 * - Used on thumbnails and in photo viewer
 * - High contrast for outdoor visibility
 */
export function PhotoStatusBadge({
  status,
  size = "sm",
  showIcon = true,
  variant = "default",
}: PhotoStatusBadgeProps) {
  const config = PHOTO_STATUS_CONFIG[status];

  const sizeClasses = {
    sm: "px-2 py-0.5 gap-1",
    md: "px-3 py-1 gap-1.5",
    lg: "px-4 py-1.5 gap-2",
  };

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16,
  };

  const isSolid = variant === "solid";

  return (
    <View
      className={cn(
        "flex-row items-center rounded-full",
        sizeClasses[size],
        isSolid ? config.activeBg : config.bg
      )}
    >
      {showIcon && (
        <Ionicons
          name={config.icon}
          size={iconSizes[size]}
          color={isSolid ? "#ffffff" : config.iconColor}
        />
      )}
      <Text
        className={cn(
          "font-semibold",
          textSizeClasses[size],
          isSolid ? "text-white" : config.text
        )}
      >
        {config.label}
      </Text>
    </View>
  );
}

interface PhotoStatusSelectorProps {
  selectedStatus: PhotoStatus;
  onStatusChange: (status: PhotoStatus) => void;
  size?: "compact" | "large";
}

/**
 * Large touch target selector for setting photo status
 *
 * Design principles:
 * - Minimum 48px touch targets (construction gloves)
 * - Outlined style for professional appearance
 * - Clear visual feedback for selection
 * - One tap to change status
 */
export function PhotoStatusSelector({
  selectedStatus,
  onStatusChange,
  size = "large",
}: PhotoStatusSelectorProps) {
  const statuses: PhotoStatus[] = ["before", "progress", "complete", "issue"];

  const isCompact = size === "compact";

  return (
    <View className={cn("flex-row", isCompact ? "gap-2" : "gap-3")}>
      {statuses.map((status) => {
        const config = PHOTO_STATUS_CONFIG[status];
        const isSelected = selectedStatus === status;

        return (
          <Pressable
            key={status}
            onPress={() => onStatusChange(status)}
            className={cn(
              "flex-1 items-center justify-center rounded-xl",
              isCompact ? "py-2" : "py-3",
              isSelected ? "border-2 bg-opacity-10" : "border border-white/30"
            )}
            style={{
              borderColor: isSelected ? config.iconColor : "rgba(255, 255, 255, 0.3)",
              backgroundColor: isSelected
                ? `${config.iconColor}15`
                : "rgba(0, 0, 0, 0.2)",
            }}
          >
            <Ionicons
              name={config.icon}
              size={isCompact ? 20 : 28}
              color={isSelected ? config.iconColor : "rgba(255, 255, 255, 0.8)"}
            />
            <Text
              className={cn(
                "font-semibold mt-1",
                isCompact ? "text-xs" : "text-sm"
              )}
              style={{
                color: isSelected ? config.iconColor : "rgba(255, 255, 255, 0.9)",
              }}
            >
              {config.shortLabel}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Inline photo status selector for the photo viewer
 * Horizontal pill-style buttons for quick status changes
 */
interface PhotoStatusInlineSelectorProps {
  selectedStatus: PhotoStatus;
  onStatusChange: (status: PhotoStatus) => void;
}

export function PhotoStatusInlineSelector({
  selectedStatus,
  onStatusChange,
}: PhotoStatusInlineSelectorProps) {
  const statuses: PhotoStatus[] = ["before", "progress", "complete", "issue"];

  return (
    <View style={styles.inlineContainer}>
      {statuses.map((status) => {
        const config = PHOTO_STATUS_CONFIG[status];
        const isSelected = selectedStatus === status;

        return (
          <Pressable
            key={status}
            onPress={() => onStatusChange(status)}
            style={[
              styles.inlineButton,
              isSelected && { backgroundColor: config.iconColor },
            ]}
          >
            <Ionicons
              name={config.icon}
              size={16}
              color={isSelected ? "#ffffff" : config.iconColor}
            />
            <Text
              style={[
                styles.inlineText,
                { color: isSelected ? "#ffffff" : config.iconColor },
              ]}
            >
              {config.shortLabel}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Utility to get photo status config for external use
 */
export function getPhotoStatusConfig(status: PhotoStatus) {
  return PHOTO_STATUS_CONFIG[status];
}

const styles = StyleSheet.create({
  inlineContainer: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  inlineButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  inlineText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
