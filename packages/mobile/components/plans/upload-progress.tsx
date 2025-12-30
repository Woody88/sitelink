import React from "react";
import { View, Pressable } from "react-native";
import { Text } from "@/components/ui/text";
import { Ionicons } from "@expo/vector-icons";

interface UploadProgressProps {
  fileName: string;
  progress: number; // 0-100
  estimatedTimeRemaining?: number | null; // seconds
  isVisible?: boolean;
  onCancel?: () => void;
}

/**
 * Format seconds into human-readable time remaining
 */
function formatTimeRemaining(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return "";

  if (seconds < 60) {
    return `${seconds}s remaining`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return remainingSeconds > 0
      ? `${minutes}m ${remainingSeconds}s remaining`
      : `${minutes} min remaining`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m remaining`;
}

export function UploadProgress({
  fileName,
  progress,
  estimatedTimeRemaining,
  isVisible = true,
  onCancel,
}: UploadProgressProps) {
  if (!isVisible) return null;

  const timeText = formatTimeRemaining(estimatedTimeRemaining);

  return (
    <View className="mx-4 mb-2 bg-accent rounded-xl p-4 border border-border">
      {/* Header with icon and filename */}
      <View className="flex-row items-center gap-3 mb-3">
        <View className="w-10 h-10 rounded-lg bg-primary/10 items-center justify-center">
          <Ionicons name="cloud-upload-outline" size={22} color="#c9623d" />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
            {fileName}
          </Text>
        </View>
      </View>

      {/* Progress row */}
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-lg font-bold text-primary">{progress}%</Text>
        {timeText ? (
          <Text className="text-sm text-muted-foreground">{timeText}</Text>
        ) : null}
      </View>

      {/* Progress bar */}
      <View className="h-2 bg-secondary rounded-full overflow-hidden mb-3">
        <View
          className="h-full bg-primary rounded-full"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </View>

      {/* Cancel button */}
      {onCancel && (
        <Pressable onPress={onCancel} className="items-center py-1">
          <Text className="text-sm text-destructive font-medium">Cancel Upload</Text>
        </Pressable>
      )}
    </View>
  );
}
