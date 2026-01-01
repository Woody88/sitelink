import React from "react";
import { View, ActivityIndicator } from "react-native";
import { Text } from "@/components/ui/text";
import { Ionicons } from "@expo/vector-icons";
import { cn } from "@/lib/utils";

export interface ProcessingStatusBadgeProps {
  status: "uploading" | "processing" | "complete" | "failed";
  progress?: {
    current: number;
    total: number;
  };
  size?: "sm" | "md";
}

const statusConfig = {
  uploading: {
    bg: "bg-blue-100",
    text: "text-blue-700",
    label: "Uploading",
    icon: "cloud-upload-outline" as const,
    showSpinner: true,
  },
  processing: {
    bg: "bg-amber-100",
    text: "text-amber-700",
    label: "Processing",
    icon: "sync-outline" as const,
    showSpinner: true,
  },
  complete: {
    bg: "bg-green-100",
    text: "text-green-700",
    label: "Complete",
    icon: "checkmark-circle-outline" as const,
    showSpinner: false,
  },
  failed: {
    bg: "bg-red-100",
    text: "text-red-700",
    label: "Failed",
    icon: "close-circle-outline" as const,
    showSpinner: false,
  },
};

export function ProcessingStatusBadge({
  status,
  progress,
  size = "sm",
}: ProcessingStatusBadgeProps) {
  const config = statusConfig[status];
  const progressText =
    progress && progress.total > 0
      ? ` (${progress.current}/${progress.total})`
      : "";

  return (
    <View
      className={cn(
        "flex-row items-center gap-1.5 rounded-full",
        size === "sm" ? "px-2 py-0.5" : "px-3 py-1",
        config.bg
      )}
    >
      {config.showSpinner ? (
        <ActivityIndicator size={size === "sm" ? 10 : 14} color="#c9623d" />
      ) : (
        <Ionicons
          name={config.icon}
          size={size === "sm" ? 12 : 16}
          color={status === "complete" ? "#16a34a" : "#dc2626"}
        />
      )}
      <Text
        className={cn(
          "font-semibold",
          size === "sm" ? "text-xs" : "text-sm",
          config.text
        )}
      >
        {config.label}
        {progressText}
      </Text>
    </View>
  );
}
