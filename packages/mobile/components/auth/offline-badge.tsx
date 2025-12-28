import React from "react";
import { View } from "react-native";
import { WifiOff } from "lucide-react-native";
import { Text } from "@/components/ui/text";

export function OfflineBadge() {
  return (
    <View className="absolute top-4 right-4 bg-white/20 px-3 py-1.5 rounded-full border border-white/30 flex-row items-center gap-1.5 z-10">
      <WifiOff size={14} color="#ffffff" strokeWidth={2} />
      <Text className="text-xs font-medium text-white">Offline Ready</Text>
    </View>
  );
}
