import React from "react";
import { Pressable } from "react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

export type TeamSize = "1-10" | "11-50" | "50+" | "enterprise";

interface TeamSizeButtonProps {
  label: string;
  value: TeamSize;
  selected: boolean;
  onSelect: (value: TeamSize) => void;
  disabled?: boolean;
}

export function TeamSizeButton({
  label,
  value,
  selected,
  onSelect,
  disabled,
}: TeamSizeButtonProps) {
  return (
    <Pressable
      onPress={() => onSelect(value)}
      disabled={disabled}
      className={cn(
        "flex-1 h-12 items-center justify-center rounded-xl border-2",
        "active:opacity-90",
        selected
          ? "border-primary bg-primary/10"
          : "border-border bg-white",
        disabled && "opacity-50"
      )}
    >
      <Text
        className={cn(
          "text-sm font-semibold",
          selected ? "text-primary" : "text-foreground"
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}
