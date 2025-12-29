import React, { useState, useCallback } from "react";
import { View, Pressable, Image, LayoutAnimation, Platform, UIManager, ActivityIndicator } from "react-native";
import { Text } from "@/components/ui/text";
import { Ionicons } from "@expo/vector-icons";
import { DisciplineBadge, StatusBadge, VersionBadge } from "./badge";
import { SheetItem, type SheetItemData } from "./sheet-item";
import type { DisciplineType, StatusType } from "./badge";
import { cn } from "@/lib/utils";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface PlanCardData {
  id: string;
  name: string;
  discipline: DisciplineType;
  status: StatusType;
  version: number;
  sheetCount: number;
  markerCount: number;
  thumbnailUrl?: string;
  sheets?: SheetItemData[];
  reviewNeededCount?: number;
}

interface PlanCardProps {
  plan: PlanCardData;
  isExpanded?: boolean;
  isLoadingSheets?: boolean;
  onToggleExpand?: (id: string) => void;
  onSheetPress?: (sheet: SheetItemData, planId: string) => void;
  onMenuPress?: (plan: PlanCardData) => void;
  showSheetThumbnails?: boolean;
}

export function PlanCard({
  plan,
  isExpanded = false,
  isLoadingSheets = false,
  onToggleExpand,
  onSheetPress,
  onMenuPress,
  showSheetThumbnails = true,
}: PlanCardProps) {
  const [selectedSheets, setSelectedSheets] = useState<Set<string>>(new Set());

  const handleToggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onToggleExpand?.(plan.id);
  }, [onToggleExpand, plan.id]);

  const handleSheetSelect = useCallback((sheetId: string) => {
    setSelectedSheets((prev) => {
      const next = new Set(prev);
      if (next.has(sheetId)) {
        next.delete(sheetId);
      } else {
        next.add(sheetId);
      }
      return next;
    });
  }, []);

  const handleMenuPress = useCallback(() => {
    onMenuPress?.(plan);
  }, [onMenuPress, plan]);

  return (
    <View className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-3">
      {/* Main card content */}
      <Pressable
        onPress={handleToggle}
        className="flex-row p-3"
      >
        {/* Thumbnail with version badge */}
        <View className="relative mr-3">
          {plan.thumbnailUrl ? (
            <Image
              source={{ uri: plan.thumbnailUrl }}
              className="w-20 h-20 rounded-lg bg-slate-100"
              resizeMode="cover"
            />
          ) : (
            <View className="w-20 h-20 rounded-lg bg-slate-100 items-center justify-center border border-slate-200">
              <Ionicons name="document-text-outline" size={32} color="#94a3b8" />
            </View>
          )}
          <VersionBadge version={plan.version} />
        </View>

        {/* Info */}
        <View className="flex-1">
          <View className="flex-row items-start justify-between">
            <Text className="text-base font-bold text-foreground flex-1 pr-2" numberOfLines={2}>
              {plan.name}
            </Text>
            <Pressable
              onPress={handleMenuPress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              className="p-1"
            >
              <Ionicons name="ellipsis-vertical" size={18} color="#64748b" />
            </Pressable>
          </View>

          {/* Badges */}
          <View className="flex-row items-center gap-2 mt-2">
            <DisciplineBadge discipline={plan.discipline} />
            <StatusBadge status={plan.status} />
          </View>

          {/* Stats */}
          <View className="flex-row items-center gap-4 mt-2">
            <View className="flex-row items-center gap-1">
              <Ionicons name="grid-outline" size={14} color="#64748b" />
              <Text className="text-xs text-muted-foreground">
                {plan.sheetCount} Sheets
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Ionicons name="location-outline" size={14} color="#64748b" />
              <Text className="text-xs text-muted-foreground">
                {plan.markerCount} Markers
              </Text>
            </View>
          </View>
        </View>
      </Pressable>

      {/* Accordion toggle bar */}
      <Pressable
        onPress={handleToggle}
        className={cn(
          "flex-row items-center justify-between px-4 py-2 border-t border-slate-100",
          isExpanded ? "bg-slate-50" : "bg-white"
        )}
      >
        <View className="flex-row items-center gap-2">
          {plan.reviewNeededCount && plan.reviewNeededCount > 0 ? (
            <View className="flex-row items-center gap-1">
              <View className="w-2 h-2 rounded-full bg-orange-500" />
              <Text className="text-xs font-medium text-orange-600">
                {plan.reviewNeededCount} Review Needed
              </Text>
            </View>
          ) : (
            <Text className="text-xs text-muted-foreground">
              {isExpanded ? "Hide Sheets" : "Show Sheets"}
            </Text>
          )}
        </View>
        <Ionicons
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={18}
          color="#64748b"
        />
      </Pressable>

      {/* Expanded sheets list */}
      {isExpanded && (
        <View className="px-3 pb-3 bg-white">
          {isLoadingSheets ? (
            <View className="py-4 items-center">
              <ActivityIndicator size="small" color="#3b82f6" />
              <Text className="text-xs text-muted-foreground mt-2">Loading sheets...</Text>
            </View>
          ) : plan.sheets && plan.sheets.length > 0 ? (
            plan.sheets.map((sheet) => (
              <SheetItem
                key={sheet.id}
                sheet={sheet}
                isSelected={selectedSheets.has(sheet.id)}
                onSelect={handleSheetSelect}
                onPress={(s) => onSheetPress?.(s, plan.id)}
                showThumbnail={showSheetThumbnails}
              />
            ))
          ) : (
            <View className="py-4 items-center">
              <Text className="text-xs text-muted-foreground">No sheets found</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
