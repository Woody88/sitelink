import React from "react";
import { Pressable } from "react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

interface SocialButtonProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

export function SocialButton({ icon, label, onPress, disabled }: SocialButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={cn(
        "flex-row h-14 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-white",
        "active:bg-secondary",
        disabled && "opacity-50"
      )}
    >
      {icon}
      <Text className="text-foreground font-medium">{label}</Text>
    </Pressable>
  );
}
