import React from "react";
import { View, Pressable } from "react-native";
import { Text } from "@/components/ui/text";
import { Ionicons } from "@expo/vector-icons";
import { cn } from "@/lib/utils";

/**
 * Work State - the ONLY required context for photo capture
 *
 * This single choice answers:
 * - Before or after?
 * - Done or in progress?
 * - Normal or problem?
 */
export type WorkState = "START" | "IN_PROGRESS" | "ISSUE" | "COMPLETE";

const WORK_STATE_CONFIG: Record<
  WorkState,
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
  START: {
    label: "Start",
    shortLabel: "Start",
    bg: "bg-blue-100",
    activeBg: "bg-blue-500",
    text: "text-blue-700",
    icon: "flag",
    iconColor: "#3b82f6",
    description: "Before work begins",
  },
  IN_PROGRESS: {
    label: "In Progress",
    shortLabel: "Working",
    bg: "bg-amber-100",
    activeBg: "bg-amber-500",
    text: "text-amber-700",
    icon: "construct",
    iconColor: "#f59e0b",
    description: "Work happening now",
  },
  ISSUE: {
    label: "Issue",
    shortLabel: "Issue",
    bg: "bg-red-100",
    activeBg: "bg-red-500",
    text: "text-red-700",
    icon: "warning",
    iconColor: "#ef4444",
    description: "Problem found",
  },
  COMPLETE: {
    label: "Complete",
    shortLabel: "Done",
    bg: "bg-green-100",
    activeBg: "bg-green-500",
    text: "text-green-700",
    icon: "checkmark-circle",
    iconColor: "#22c55e",
    description: "Work finished",
  },
};

interface WorkStateBadgeProps {
  state: WorkState;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  variant?: "default" | "solid";
}

/**
 * Displays work state as a badge
 * - Used in bundle cards and photo details
 * - High contrast for outdoor visibility
 */
export function WorkStateBadge({
  state,
  size = "sm",
  showIcon = true,
  variant = "default",
}: WorkStateBadgeProps) {
  const config = WORK_STATE_CONFIG[state];

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

interface WorkStateSelectorProps {
  selectedState: WorkState;
  onStateChange: (state: WorkState) => void;
  size?: "compact" | "large";
}

/**
 * Large touch target selector for camera capture screen
 *
 * Design principles:
 * - Minimum 48px touch targets (construction gloves)
 * - High contrast colors
 * - Clear visual feedback for selection
 * - One tap to change state
 */
export function WorkStateSelector({
  selectedState,
  onStateChange,
  size = "large",
}: WorkStateSelectorProps) {
  const states: WorkState[] = ["START", "IN_PROGRESS", "ISSUE", "COMPLETE"];

  const isCompact = size === "compact";

  return (
    <View className={cn("flex-row", isCompact ? "gap-2" : "gap-3")}>
      {states.map((state) => {
        const config = WORK_STATE_CONFIG[state];
        const isSelected = selectedState === state;

        return (
          <Pressable
            key={state}
            onPress={() => onStateChange(state)}
            className={cn(
              "flex-1 items-center justify-center rounded-xl border-2",
              isCompact ? "py-2" : "py-3",
              isSelected
                ? "border-transparent"
                : "border-border bg-card"
            )}
            style={isSelected ? { backgroundColor: config.iconColor } : undefined}
          >
            <Ionicons
              name={config.icon}
              size={isCompact ? 20 : 28}
              color={isSelected ? "#ffffff" : config.iconColor}
            />
            <Text
              className={cn(
                "font-semibold mt-1",
                isCompact ? "text-xs" : "text-sm",
                isSelected ? "text-white" : "text-foreground"
              )}
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
 * Utility to get work state config for external use
 */
export function getWorkStateConfig(state: WorkState) {
  return WORK_STATE_CONFIG[state];
}
