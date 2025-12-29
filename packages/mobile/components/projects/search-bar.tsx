import React from "react";
import { View, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = "Search by name or job number...",
}: SearchBarProps) {
  return (
    <View className="relative flex-row items-center">
      <View className="absolute left-4 z-10">
        <Ionicons name="search" size={20} color="#828180" />
      </View>
      <TextInput
        className="w-full h-14 pl-12 pr-4 bg-white rounded-xl text-base text-foreground border border-slate-200"
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
