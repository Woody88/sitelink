import React from "react";
import { View, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export function PlansSearchBar({
  value,
  onChangeText,
  placeholder = "Search plans by name or sheet..",
}: SearchBarProps) {
  return (
    <View className="flex-row items-center bg-white rounded-xl border border-slate-200">
      <View className="pl-4">
        <Ionicons name="search" size={20} color="#94a3b8" />
      </View>
      <TextInput
        className="flex-1 h-12 px-3 text-base text-foreground"
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}
