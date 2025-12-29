import React, { useState } from "react";
import { View, Pressable, StyleSheet, Modal } from "react-native";
import { Text } from "@/components/ui/text";
import { Ionicons } from "@expo/vector-icons";
import { type WorkState, getWorkStateConfig } from "./work-state-badge";

export type DateFilter = "all" | "today" | "week" | "month";

interface MediaFilterBarProps {
  workStateFilter: WorkState | "all";
  dateFilter: DateFilter;
  onWorkStateChange: (state: WorkState | "all") => void;
  onDateChange: (date: DateFilter) => void;
  onMoreFilters?: () => void;
  hasActiveFilters: boolean;
}

const DATE_LABELS: Record<DateFilter, string> = {
  all: "All Time",
  today: "Today",
  week: "This Week",
  month: "This Month",
};

const WORK_STATE_LABELS: Record<WorkState | "all", string> = {
  all: "All States",
  START: "Start",
  IN_PROGRESS: "In Progress",
  ISSUE: "Issues",
  COMPLETE: "Complete",
};

/**
 * Media Filter Bar - MINIMAL
 *
 * Single "Filter" button that opens a modal with all options.
 * Shows active filter count badge when filters are applied.
 * Clean, minimal, construction-friendly.
 */
export function MediaFilterBar({
  workStateFilter,
  dateFilter,
  onWorkStateChange,
  onDateChange,
  hasActiveFilters,
}: MediaFilterBarProps) {
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Count active filters for badge
  const activeFilterCount =
    (workStateFilter !== "all" ? 1 : 0) + (dateFilter !== "all" ? 1 : 0);

  // Work state options
  const workStateOptions: Array<{
    value: WorkState | "all";
    label: string;
    icon?: keyof typeof Ionicons.glyphMap;
    iconColor?: string;
  }> = [
    { value: "all", label: "All States" },
    {
      value: "ISSUE",
      label: "Issues",
      icon: getWorkStateConfig("ISSUE").icon,
      iconColor: getWorkStateConfig("ISSUE").iconColor,
    },
    {
      value: "IN_PROGRESS",
      label: "In Progress",
      icon: getWorkStateConfig("IN_PROGRESS").icon,
      iconColor: getWorkStateConfig("IN_PROGRESS").iconColor,
    },
    {
      value: "COMPLETE",
      label: "Complete",
      icon: getWorkStateConfig("COMPLETE").icon,
      iconColor: getWorkStateConfig("COMPLETE").iconColor,
    },
    {
      value: "START",
      label: "Start",
      icon: getWorkStateConfig("START").icon,
      iconColor: getWorkStateConfig("START").iconColor,
    },
  ];

  const dateOptions: DateFilter[] = ["all", "today", "week", "month"];

  return (
    <View style={styles.container}>
      {/* Single Filter Button */}
      <Pressable
        onPress={() => setShowFilterModal(true)}
        style={[styles.filterButton, hasActiveFilters && styles.filterButtonActive]}
      >
        <Ionicons
          name="options-outline"
          size={18}
          color={hasActiveFilters ? "#ffffff" : "#3d3929"}
        />
        <Text
          style={[
            styles.filterButtonText,
            hasActiveFilters && styles.filterButtonTextActive,
          ]}
        >
          Filter
        </Text>
        {activeFilterCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{activeFilterCount}</Text>
          </View>
        )}
      </Pressable>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowFilterModal(false)}
        >
          <View style={styles.filterModalContainer}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filters</Text>
              {hasActiveFilters && (
                <Pressable
                  onPress={() => {
                    onWorkStateChange("all");
                    onDateChange("all");
                  }}
                >
                  <Text style={styles.clearButton}>Clear All</Text>
                </Pressable>
              )}
            </View>

            {/* Work State Section */}
            <Text style={styles.sectionTitle}>Work State</Text>
            {workStateOptions.map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.optionRow,
                  workStateFilter === option.value && styles.optionRowActive,
                ]}
                onPress={() => onWorkStateChange(option.value)}
              >
                <View style={styles.optionLeft}>
                  {option.icon && (
                    <Ionicons
                      name={option.icon}
                      size={18}
                      color={option.iconColor ?? "#828180"}
                    />
                  )}
                  <Text
                    style={[
                      styles.optionText,
                      workStateFilter === option.value && styles.optionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </View>
                {workStateFilter === option.value && (
                  <Ionicons name="checkmark" size={20} color="#c9623d" />
                )}
              </Pressable>
            ))}

            {/* Date Section */}
            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Date</Text>
            {dateOptions.map((option) => (
              <Pressable
                key={option}
                style={[
                  styles.optionRow,
                  dateFilter === option && styles.optionRowActive,
                ]}
                onPress={() => onDateChange(option)}
              >
                <View style={styles.optionLeft}>
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color="#828180"
                  />
                  <Text
                    style={[
                      styles.optionText,
                      dateFilter === option && styles.optionTextActive,
                    ]}
                  >
                    {DATE_LABELS[option]}
                  </Text>
                </View>
                {dateFilter === option && (
                  <Ionicons name="checkmark" size={20} color="#c9623d" />
                )}
              </Pressable>
            ))}

            {/* Done Button */}
            <Pressable
              style={styles.doneButton}
              onPress={() => setShowFilterModal(false)}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#f4f4f4",
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  filterButtonActive: {
    backgroundColor: "#c9623d",
    borderColor: "#c9623d",
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3d3929",
  },
  filterButtonTextActive: {
    color: "#ffffff",
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#c9623d",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  filterModalContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    width: 320,
    maxHeight: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#3d3929",
  },
  clearButton: {
    fontSize: 14,
    fontWeight: "600",
    color: "#c9623d",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#828180",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  optionRowActive: {
    backgroundColor: "#fef3ed",
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  optionText: {
    fontSize: 15,
    color: "#3d3929",
  },
  optionTextActive: {
    color: "#c9623d",
    fontWeight: "600",
  },
  doneButton: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#c9623d",
    alignItems: "center",
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
});
