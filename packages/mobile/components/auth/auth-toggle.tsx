import React from "react";
import { View, Pressable } from "react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

interface AuthToggleProps {
  activeTab: "login" | "signup";
  onTabChange: (tab: "login" | "signup") => void;
}

export function AuthToggle({ activeTab, onTabChange }: AuthToggleProps) {
  return (
    <View className="flex-row h-14 w-full items-center justify-center rounded-xl bg-secondary p-1.5 border border-border">
      <Pressable
        onPress={() => onTabChange("login")}
        className={cn(
          "flex-1 h-full items-center justify-center rounded-lg",
          activeTab === "login" ? "bg-white shadow-sm" : "bg-transparent"
        )}
      >
        <Text
          className={cn(
            "text-base font-semibold",
            activeTab === "login" ? "text-primary" : "text-muted-foreground"
          )}
        >
          Log In
        </Text>
      </Pressable>
      <Pressable
        onPress={() => onTabChange("signup")}
        className={cn(
          "flex-1 h-full items-center justify-center rounded-lg",
          activeTab === "signup" ? "bg-white shadow-sm" : "bg-transparent"
        )}
      >
        <Text
          className={cn(
            "text-base font-semibold",
            activeTab === "signup" ? "text-primary" : "text-muted-foreground"
          )}
        >
          Sign Up
        </Text>
      </Pressable>
    </View>
  );
}
