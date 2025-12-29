import React from "react";
import { View, Pressable } from "react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { Ionicons } from "@expo/vector-icons";

export interface ProjectCardProps {
  id: string;
  name: string;
  jobNumber?: string | null;
  status: "active" | "planning" | "archived";
  isSelected?: boolean;
  isOfflineAvailable?: boolean;
  onPress?: () => void;
}

const statusConfig = {
  active: {
    label: "Active",
    bgClass: "bg-green-100",
    textClass: "text-green-700",
  },
  planning: {
    label: "Planning",
    bgClass: "bg-blue-50",
    textClass: "text-blue-700",
  },
  archived: {
    label: "Archived",
    bgClass: "bg-slate-200",
    textClass: "text-slate-600",
  },
};

export function ProjectCard({
  id,
  name,
  jobNumber,
  status,
  isSelected = false,
  isOfflineAvailable = false,
  onPress,
}: ProjectCardProps) {
  const statusInfo = statusConfig[status];
  const isArchived = status === "archived";

  return (
    <Pressable
      onPress={onPress}
      className={cn("w-full", isArchived && "opacity-70")}
    >
      <View
        className={cn(
          "flex-row items-center justify-between w-full p-4 bg-white rounded-xl",
          isSelected
            ? "border-2 border-primary shadow-md"
            : "border border-slate-200"
        )}
      >
        <View className="flex-1 gap-1.5 pr-4">
          <Text
            className={cn(
              "text-lg font-bold text-foreground leading-tight",
              isArchived && "line-through decoration-slate-300"
            )}
            numberOfLines={2}
          >
            {name}
          </Text>

          <View className="flex-row flex-wrap items-center gap-2">
            {jobNumber && (
              <>
                <Text className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-xs tracking-wide text-muted-foreground">
                  #{jobNumber}
                </Text>
                <View className="w-1 h-1 rounded-full bg-slate-300" />
              </>
            )}
            <View className={cn("px-2 py-0.5 rounded-full", statusInfo.bgClass)}>
              <Text className={cn("text-xs font-semibold", statusInfo.textClass)}>
                {statusInfo.label}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center gap-1.5 mt-1">
            {isOfflineAvailable ? (
              <>
                <Ionicons name="cloud-done" size={18} color="#c9623d" />
                <Text className="text-xs font-medium text-primary">
                  Available Offline
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="cloud-offline-outline" size={18} color="#828180" />
                <Text className="text-xs text-muted-foreground">Not downloaded</Text>
              </>
            )}
          </View>
        </View>

        {/* Selection indicator */}
        <View className="shrink-0">
          {isSelected ? (
            <View className="w-7 h-7 rounded-full bg-primary items-center justify-center shadow-sm">
              <Ionicons name="checkmark" size={18} color="#ffffff" />
            </View>
          ) : (
            <View className="w-7 h-7 rounded-full border-2 border-slate-300" />
          )}
        </View>
      </View>
    </Pressable>
  );
}
