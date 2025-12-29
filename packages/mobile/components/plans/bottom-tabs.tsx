import React from "react";
import { View, Pressable } from "react-native";
import { Text } from "@/components/ui/text";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cn } from "@/lib/utils";

export type TabName = "plans" | "camera" | "projects" | "more";

interface TabItemProps {
  name: TabName;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  isActive: boolean;
  onPress: () => void;
}

function TabItem({ label, icon, activeIcon, isActive, onPress }: TabItemProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center justify-center py-2"
    >
      <Ionicons
        name={isActive ? activeIcon : icon}
        size={24}
        color={isActive ? "#c9623d" : "#828180"}
      />
      <Text
        className={cn(
          "text-xs mt-1",
          isActive ? "text-primary font-medium" : "text-muted-foreground"
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface BottomTabsProps {
  activeTab: TabName;
  onTabChange: (tab: TabName) => void;
}

export function BottomTabs({ activeTab, onTabChange }: BottomTabsProps) {
  const insets = useSafeAreaInsets();

  const tabs: Array<{
    name: TabName;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    activeIcon: keyof typeof Ionicons.glyphMap;
  }> = [
    { name: "plans", label: "Plans", icon: "document-outline", activeIcon: "document" },
    { name: "camera", label: "Camera", icon: "camera-outline", activeIcon: "camera" },
    { name: "projects", label: "Projects", icon: "business-outline", activeIcon: "business" },
    { name: "more", label: "More", icon: "menu-outline", activeIcon: "menu" },
  ];

  return (
    <View
      className="absolute bottom-0 left-0 right-0 bg-card border-t border-border"
      style={{ paddingBottom: insets.bottom }}
    >
      <View className="flex-row">
        {tabs.map((tab) => (
          <TabItem
            key={tab.name}
            name={tab.name}
            label={tab.label}
            icon={tab.icon}
            activeIcon={tab.activeIcon}
            isActive={activeTab === tab.name}
            onPress={() => onTabChange(tab.name)}
          />
        ))}
      </View>
    </View>
  );
}
