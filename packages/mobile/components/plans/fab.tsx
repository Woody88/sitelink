import React from "react";
import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface FloatingActionButtonProps {
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}

export function FloatingActionButton({ onPress, icon = "add" }: FloatingActionButtonProps) {
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      onPress={onPress}
      className="absolute w-14 h-14 rounded-full bg-primary items-center justify-center shadow-lg"
      style={{
        right: 16,
        bottom: 80 + insets.bottom,
        shadowColor: "#c9623d",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
      }}
    >
      <Ionicons name={icon} size={28} color="#ffffff" />
    </Pressable>
  );
}
