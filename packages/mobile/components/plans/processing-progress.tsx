import React from "react";
import { View, ActivityIndicator } from "react-native";
import { Text } from "@/components/ui/text";
import { Ionicons } from "@expo/vector-icons";

interface ProcessingProgressProps {
  fileName: string;
  progress: number; // 0-100
  isVisible?: boolean;
}

export function ProcessingProgress({
  fileName,
  progress,
  isVisible = true,
}: ProcessingProgressProps) {
  if (!isVisible) return null;

  return (
    <View className="mx-4 mb-2 bg-amber-50 rounded-xl p-4 border border-amber-200">
      {/* Header with icon and filename */}
      <View className="flex-row items-center gap-3 mb-3">
        <View className="w-10 h-10 rounded-lg bg-amber-100 items-center justify-center">
          <Ionicons name="sync-outline" size={22} color="#f59e0b" />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
            Processing {fileName}
          </Text>
          <Text className="text-xs text-muted-foreground mt-0.5">
            Generating tiles and extracting data...
          </Text>
        </View>
      </View>

      {/* Progress row */}
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-lg font-bold text-amber-700">{Math.round(progress)}%</Text>
        <ActivityIndicator size="small" color="#f59e0b" />
      </View>

      {/* Progress bar */}
      <View className="h-2 bg-amber-100 rounded-full overflow-hidden">
        <View
          className="h-full bg-amber-500 rounded-full"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </View>
    </View>
  );
}
