import React from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

// Discipline badge types
export type DisciplineType = "ARCH" | "ELEC" | "STRUCT" | "MECH" | "PLUMB" | "CIVIL";

const disciplineConfig: Record<DisciplineType, { bg: string; text: string }> = {
  ARCH: { bg: "bg-orange-100", text: "text-orange-700" },
  ELEC: { bg: "bg-amber-100", text: "text-amber-700" },
  STRUCT: { bg: "bg-stone-200", text: "text-stone-700" },
  MECH: { bg: "bg-emerald-100", text: "text-emerald-700" },
  PLUMB: { bg: "bg-teal-100", text: "text-teal-700" },
  CIVIL: { bg: "bg-yellow-100", text: "text-yellow-700" },
};

interface DisciplineBadgeProps {
  discipline: DisciplineType;
  size?: "sm" | "md";
}

export function DisciplineBadge({ discipline, size = "sm" }: DisciplineBadgeProps) {
  const config = disciplineConfig[discipline] ?? disciplineConfig.ARCH;

  return (
    <View className={cn(
      "rounded-full",
      size === "sm" ? "px-2 py-0.5" : "px-3 py-1",
      config.bg
    )}>
      <Text className={cn(
        "font-semibold",
        size === "sm" ? "text-xs" : "text-sm",
        config.text
      )}>
        {discipline}
      </Text>
    </View>
  );
}

// Status badge types
export type StatusType = "APPROVED" | "DRAFT" | "REVIEW" | "PENDING";

const statusConfig: Record<StatusType, { bg: string; text: string; border?: string }> = {
  APPROVED: { bg: "bg-green-100", text: "text-green-700" },
  DRAFT: { bg: "bg-secondary", text: "text-secondary-foreground", border: "border border-border" },
  REVIEW: { bg: "bg-red-100", text: "text-red-600" },
  PENDING: { bg: "bg-amber-100", text: "text-amber-700" },
};

interface StatusBadgeProps {
  status: StatusType;
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.PENDING;

  return (
    <View className={cn(
      "rounded-full",
      size === "sm" ? "px-2 py-0.5" : "px-3 py-1",
      config.bg,
      config.border
    )}>
      <Text className={cn(
        "font-semibold",
        size === "sm" ? "text-xs" : "text-sm",
        config.text
      )}>
        {status}
      </Text>
    </View>
  );
}

// Confidence badge for sheets
interface ConfidenceBadgeProps {
  confidence: number;
}

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  const isHigh = confidence >= 70;

  return (
    <View className={cn(
      "rounded-full px-2 py-0.5",
      isHigh ? "bg-green-100" : "bg-orange-100"
    )}>
      <Text className={cn(
        "text-xs font-semibold",
        isHigh ? "text-green-700" : "text-orange-700"
      )}>
        {confidence}%
      </Text>
    </View>
  );
}

// Version badge
interface VersionBadgeProps {
  version: number;
}

export function VersionBadge({ version }: VersionBadgeProps) {
  return (
    <View className="absolute bottom-1 left-1 bg-foreground/90 rounded px-1.5 py-0.5">
      <Text className="text-background text-[10px] font-bold">v{version}</Text>
    </View>
  );
}
