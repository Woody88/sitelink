import React from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { Ionicons } from "@expo/vector-icons";

interface EmptyStateProps {
  organizationName?: string;
}

export function EmptyState({
  organizationName = "your organization",
}: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center py-12">
      {/* Icon container */}
      <View className="relative mb-6">
        <View className="w-32 h-32 rounded-full bg-slate-100 items-center justify-center">
          <Ionicons name="business-outline" size={64} color="#d1d5db" />
        </View>
        <View className="absolute -bottom-2 -right-2 bg-background p-1.5 rounded-full">
          <View className="bg-slate-200 p-1.5 rounded-full">
            <Ionicons name="alert" size={20} color="#828180" />
          </View>
        </View>
      </View>

      <Text className="text-xl font-bold text-foreground mb-2">
        No Projects Found
      </Text>

      <Text className="text-sm text-muted-foreground text-center max-w-[280px] leading-relaxed">
        There are no active projects in{" "}
        <Text className="font-medium text-foreground">{organizationName}</Text>.
      </Text>

      <Text className="text-sm text-muted-foreground text-center max-w-[280px] leading-relaxed mt-2">
        Create your first project to start managing plans and site documentation.
      </Text>
    </View>
  );
}
