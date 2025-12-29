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
    <View className="mx-4 mb-2 bg-blue-50 rounded-xl p-3 border border-blue-100">
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center gap-2">
          <Ionicons name="cloud-upload-outline" size={18} color="#3b82f6" />
          <Text className="text-sm text-blue-700">
            Uploading: {fileName}
          </Text>
        </View>
        <Text className="text-sm font-semibold text-blue-700">{progress}%</Text>
      </View>
      <View className="h-1.5 bg-blue-200 rounded-full overflow-hidden">
        <View
          className="h-full bg-blue-500 rounded-full"
          style={{ width: `${progress}%` }}
        />
      </View>
    </View>
  );
}
