import React from "react";
import { View, Pressable, Image } from "react-native";
import { Text } from "@/components/ui/text";
import { Ionicons } from "@expo/vector-icons";
import { ConfidenceBadge } from "./badge";
import { cn } from "@/lib/utils";

export interface SheetItemData {
  id: string;
  sheetId: string;
  name: string;
  description?: string;
  status?: string;
  confidence?: number;
  thumbnailUrl?: string;
}

interface SheetItemProps {
  sheet: SheetItemData;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  onPress?: (sheet: SheetItemData) => void;
  showCheckbox?: boolean;
  showThumbnail?: boolean;
}

export function SheetItem({
  sheet,
  isSelected = false,
  onSelect,
  onPress,
  showCheckbox = true,
  showThumbnail = true,
}: SheetItemProps) {
  const handlePress = () => {
    if (onPress) {
      onPress(sheet);
    }
  };

  const handleCheckboxPress = () => {
    if (onSelect) {
      onSelect(sheet.id);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      className="flex-row items-center bg-slate-50 rounded-xl p-3 ml-4 mb-2"
    >
      {showCheckbox && (
        <Pressable
          onPress={handleCheckboxPress}
          className="mr-3"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View
            className={cn(
              "w-5 h-5 rounded border-2 items-center justify-center",
              isSelected
                ? "bg-blue-500 border-blue-500"
                : "border-slate-300 bg-white"
            )}
          >
            {isSelected && (
              <Ionicons name="checkmark" size={14} color="#ffffff" />
            )}
          </View>
        </Pressable>
      )}

      {/* Thumbnail */}
      {showThumbnail && (
        sheet.thumbnailUrl ? (
          <Image
            source={{ uri: sheet.thumbnailUrl }}
            className="w-14 h-14 rounded-lg bg-slate-200 mr-3"
            resizeMode="cover"
          />
        ) : (
          <View className="w-14 h-14 rounded-lg bg-blue-100 items-center justify-center mr-3">
            <Ionicons name="document-text" size={24} color="#3b82f6" />
          </View>
        )
      )}

      {/* Content */}
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-base font-semibold text-foreground">
            {sheet.sheetId}
          </Text>
          {sheet.confidence !== undefined && (
            <ConfidenceBadge confidence={sheet.confidence} />
          )}
        </View>
        <Text className="text-sm text-foreground mt-0.5" numberOfLines={1}>
          {sheet.name}
        </Text>
        {sheet.status && (
          <Text className="text-xs text-muted-foreground mt-0.5">
            {sheet.status}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
