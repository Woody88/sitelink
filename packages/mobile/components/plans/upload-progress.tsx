import React from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { Ionicons } from "@expo/vector-icons";

interface UploadProgressProps {
  fileName: string;
  progress: number; // 0-100
  isVisible?: boolean;
}

export function UploadProgress({
  fileName,
  progress,
  isVisible = true,
}: UploadProgressProps) {
  if (!isVisible) return null;

  return (
    <View className="mx-4 mb-2 bg-accent rounded-xl p-3 border border-border">
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center gap-2">
          <Ionicons name="cloud-upload-outline" size={18} color="#c9623d" />
          <Text className="text-sm text-foreground">
            Uploading: {fileName}
          </Text>
        </View>
        <Text className="text-sm font-semibold text-primary">{progress}%</Text>
      </View>
      <View className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <View
          className="h-full bg-primary rounded-full"
          style={{ width: `${progress}%` }}
        />
      </View>
    </View>
  );
}
