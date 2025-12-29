import React from "react";
import { View, TouchableOpacity } from "react-native";
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
    <TouchableOpacity
      onPress={onPress}
      style={{
        width: "100%",
        opacity: isArchived ? 0.7 : 1,
        marginBottom: 16,
      }}
      activeOpacity={0.7}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: 16,
          backgroundColor: "#ffffff",
          borderRadius: 12,
          borderWidth: isSelected ? 2 : 1,
          borderColor: isSelected ? "#c9623d" : "#e2e8f0",
          // Basic shadow for selected state
          ...(isSelected
            ? {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 6,
                elevation: 4,
              }
            : {}),
        }}
      >
        <View style={{ flex: 1, gap: 6, paddingRight: 16 }}>
          <Text
            className={cn(
              "text-lg font-bold text-foreground leading-tight",
              isArchived && "line-through decoration-slate-300"
            )}
            numberOfLines={2}
          >
            {name}
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            {jobNumber && (
              <>
                <View style={{ backgroundColor: "#f1f5f9", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ fontFamily: "monospace", fontSize: 12, color: "#64748b" }}>
                    #{jobNumber}
                  </Text>
                </View>
                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: "#cbd5e1" }} />
              </>
            )}
            <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: statusInfo.bgClass === "bg-green-100" ? "#dcfce7" : statusInfo.bgClass === "bg-blue-50" ? "#eff6ff" : "#e2e8f0" }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: statusInfo.textClass === "text-green-700" ? "#15803d" : statusInfo.textClass === "text-blue-700" ? "#1d4ed8" : "#475569" }}>
                {statusInfo.label}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
            {isOfflineAvailable ? (
              <>
                <Ionicons name="cloud-done" size={18} color="#c9623d" />
                <Text style={{ fontSize: 12, fontWeight: "500", color: "#c9623d" }}>
                  Available Offline
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="cloud-offline-outline" size={18} color="#828180" />
                <Text style={{ fontSize: 12, color: "#828180" }}>Not downloaded</Text>
              </>
            )}
          </View>
        </View>

        {/* Selection indicator */}
        <View style={{ flexShrink: 0 }}>
          {isSelected ? (
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#c9623d", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="checkmark" size={18} color="#ffffff" />
            </View>
          ) : (
            <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: "#cbd5e1" }} />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}