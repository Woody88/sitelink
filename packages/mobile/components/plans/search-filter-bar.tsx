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
    <View className="flex-row items-center bg-card rounded-xl border border-border">
      <View className="pl-4">
        <Ionicons name="search" size={20} color="#828180" />
      </View>
      <TextInput
        className="flex-1 h-12 px-3 text-base text-foreground"
        placeholder={placeholder}
        placeholderTextColor="#828180"
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}
