import React from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";
import { Check } from "lucide-react-native";
import { cn } from "@/lib/utils";

export type IndustryType =
  | "general_contractor"
  | "subcontractor"
  | "architect_engineer"
  | "owner_developer";

interface IndustryCardProps {
  icon: React.ReactNode;
  label: string;
  value: IndustryType;
  selected: boolean;
  onSelect: (value: IndustryType) => void;
  disabled?: boolean;
}

export function IndustryCard({
  icon,
  label,
  value,
  selected,
  onSelect,
  disabled,
}: IndustryCardProps) {
  return (
    <Pressable
      onPress={() => onSelect(value)}
      disabled={disabled}
      className={cn(
        "flex-1 min-h-[100px] p-4 rounded-xl border-2 items-center justify-center gap-2",
        "active:opacity-90",
        selected
          ? "border-primary bg-primary/10"
          : "border-border bg-white",
        disabled && "opacity-50"
      )}
    >
      {/* Check mark indicator */}
      {selected && (
        <View className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary items-center justify-center">
          <Check size={12} color="#ffffff" strokeWidth={3} />
        </View>
      )}
      {/* Icon */}
      <View className="w-10 h-10 items-center justify-center">
        {icon}
      </View>
      {/* Label */}
      <Text
        className={cn(
          "text-sm font-medium text-center",
          selected ? "text-primary" : "text-foreground"
        )}
        numberOfLines={2}
      >
        {label}
      </Text>
    </Pressable>
  );
}
