import React from "react";
import { View, Pressable, Modal } from "react-native";
import { Text } from "@/components/ui/text";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cn } from "@/lib/utils";

export type SortOption = "date" | "name" | "discipline";
export type StatusFilter = "all" | "active" | "draft" | "review";
export type DisciplineFilter = "all" | "arch" | "elec" | "struct" | "mech";

interface FilterOptionProps {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}

function FilterOption({ label, isSelected, onPress }: FilterOptionProps) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        "px-4 py-2 rounded-full mr-2 mb-2",
        isSelected ? "bg-primary" : "bg-accent"
      )}
    >
      <Text
        className={cn(
          "text-sm font-medium",
          isSelected ? "text-primary-foreground" : "text-foreground"
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  sortBy: SortOption;
  statusFilter: StatusFilter;
  disciplineFilter: DisciplineFilter;
  onSortChange: (sort: SortOption) => void;
  onStatusChange: (status: StatusFilter) => void;
  onDisciplineChange: (discipline: DisciplineFilter) => void;
  onReset: () => void;
}

export function FilterModal({
  visible,
  onClose,
  sortBy,
  statusFilter,
  disciplineFilter,
  onSortChange,
  onStatusChange,
  onDisciplineChange,
  onReset,
}: FilterModalProps) {
  const insets = useSafeAreaInsets();

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: "date", label: "Date" },
    { value: "name", label: "Name" },
    { value: "discipline", label: "Discipline" },
  ];

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "draft", label: "Draft" },
    { value: "review", label: "Review" },
  ];

  const disciplineOptions: { value: DisciplineFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "arch", label: "Architecture" },
    { value: "elec", label: "Electrical" },
    { value: "struct", label: "Structural" },
    { value: "mech", label: "Mechanical" },
  ];

  const hasActiveFilters = statusFilter !== "all" || disciplineFilter !== "all";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <Text className="text-lg font-bold text-foreground">Filters</Text>
          <Pressable onPress={onClose} className="p-2">
            <Ionicons name="close" size={24} color="#3d3929" />
          </Pressable>
        </View>

        <View className="flex-1 px-4 py-4">
          {/* Sort By */}
          <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Sort By
          </Text>
          <View className="flex-row flex-wrap mb-6">
            {sortOptions.map((option) => (
              <FilterOption
                key={option.value}
                label={option.label}
                isSelected={sortBy === option.value}
                onPress={() => onSortChange(option.value)}
              />
            ))}
          </View>

          {/* Status */}
          <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Status
          </Text>
          <View className="flex-row flex-wrap mb-6">
            {statusOptions.map((option) => (
              <FilterOption
                key={option.value}
                label={option.label}
                isSelected={statusFilter === option.value}
                onPress={() => onStatusChange(option.value)}
              />
            ))}
          </View>

          {/* Discipline */}
          <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Discipline
          </Text>
          <View className="flex-row flex-wrap mb-6">
            {disciplineOptions.map((option) => (
              <FilterOption
                key={option.value}
                label={option.label}
                isSelected={disciplineFilter === option.value}
                onPress={() => onDisciplineChange(option.value)}
              />
            ))}
          </View>
        </View>

        {/* Footer */}
        <View
          className="flex-row gap-3 px-4 py-4 border-t border-border"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        >
          {hasActiveFilters && (
            <Pressable
              onPress={onReset}
              className="flex-1 h-12 items-center justify-center rounded-xl border border-border"
            >
              <Text className="text-base font-semibold text-foreground">
                Reset
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={onClose}
            className={cn(
              "h-12 items-center justify-center rounded-xl bg-primary",
              hasActiveFilters ? "flex-1" : "flex-1"
            )}
          >
            <Text className="text-base font-semibold text-primary-foreground">
              Apply Filters
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
