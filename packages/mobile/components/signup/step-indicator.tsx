import React from "react";
import { View } from "react-native";
import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  currentStep: 1 | 2;
  totalSteps?: number;
}

export function StepIndicator({ currentStep, totalSteps = 2 }: StepIndicatorProps) {
  return (
    <View className="flex-row items-center justify-center gap-2">
      {/* Step 1 dot */}
      <View
        className={cn(
          "h-2 rounded-full",
          currentStep === 1 ? "w-6 bg-primary" : "w-2 bg-border"
        )}
      />
      {/* Connector line */}
      <View className="w-8 h-0.5 bg-border" />
      {/* Step 2 dot */}
      <View
        className={cn(
          "h-2 rounded-full",
          currentStep === 2 ? "w-6 bg-primary" : "w-2 bg-border"
        )}
      />
    </View>
  );
}
