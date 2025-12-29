import React from "react";
import { View, Pressable } from "react-native";
import { Text } from "@/components/ui/text";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface PlansHeaderProps {
  projectName: string;
  syncStatus?: string;
  onFilterPress?: () => void;
  hasActiveFilters?: boolean;
}

export function PlansHeader({
  projectName,
  syncStatus = "SYNCED: JUST NOW",
  onFilterPress,
  hasActiveFilters = false,
}: PlansHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="bg-white border-b border-slate-200"
      style={{ paddingTop: insets.top }}
    >
      <View className="flex-row items-center justify-between px-4 py-3">
        <View className="flex-1">
          <Text className="text-xl font-bold text-foreground">
            {projectName}
          </Text>
          <View className="flex-row items-center gap-1.5 mt-0.5">
            <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
            <Text className="text-xs text-green-600 font-medium">
              {syncStatus}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={onFilterPress}
          className="w-10 h-10 items-center justify-center relative"
        >
          <Ionicons name="options-outline" size={24} color="#1e293b" />
          {hasActiveFilters && (
            <View className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-blue-500" />
          )}
        </Pressable>
      </View>
    </View>
  );
}
