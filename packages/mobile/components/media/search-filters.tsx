import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";
import { PhotoStatusBadge, getPhotoStatusConfig, type PhotoStatus } from "./photo-status-badge";
import DateTimePicker from '@react-native-community/datetimepicker';

export interface SearchFiltersProps {
  filters: {
    status?: PhotoStatus;
    dateFrom?: string;
    dateTo?: string;
  };
  onFilterChange: (filters: {
    status?: PhotoStatus;
    dateFrom?: string;
    dateTo?: string;
  }) => void;
  onClearFilters: () => void;
}

/**
 * Search Filters Component
 *
 * Expandable section with:
 * - Status filter chips (before/progress/complete/issue)
 * - Date range picker (from/to)
 * - Clear all filters button
 * - Active filter count badge
 *
 * Design:
 * - Large touch targets (min 40px)
 * - High contrast colors
 * - Clear visual feedback
 */
export function SearchFilters({
  filters,
  onFilterChange,
  onClearFilters,
}: SearchFiltersProps) {
  const [expanded, setExpanded] = useState(false);
  const [showDateFromPicker, setShowDateFromPicker] = useState(false);
  const [showDateToPicker, setShowDateToPicker] = useState(false);

  // Status options
  const statusOptions: PhotoStatus[] = ["before", "progress", "complete", "issue"];

  // Toggle status filter
  const handleStatusToggle = useCallback((status: PhotoStatus) => {
    onFilterChange({
      ...filters,
      status: filters.status === status ? undefined : status,
    });
  }, [filters, onFilterChange]);

  // Handle date from change
  const handleDateFromChange = useCallback((event: any, selectedDate?: Date) => {
    setShowDateFromPicker(Platform.OS === 'ios');
    if (selectedDate) {
      onFilterChange({
        ...filters,
        dateFrom: selectedDate.toISOString().split('T')[0],
      });
    }
  }, [filters, onFilterChange]);

  // Handle date to change
  const handleDateToChange = useCallback((event: any, selectedDate?: Date) => {
    setShowDateToPicker(Platform.OS === 'ios');
    if (selectedDate) {
      onFilterChange({
        ...filters,
        dateTo: selectedDate.toISOString().split('T')[0],
      });
    }
  }, [filters, onFilterChange]);

  // Clear date from
  const handleClearDateFrom = useCallback(() => {
    onFilterChange({
      ...filters,
      dateFrom: undefined,
    });
  }, [filters, onFilterChange]);

  // Clear date to
  const handleClearDateTo = useCallback(() => {
    onFilterChange({
      ...filters,
      dateTo: undefined,
    });
  }, [filters, onFilterChange]);

  // Count active filters
  const activeFilterCount = React.useMemo(() => {
    let count = 0;
    if (filters.status) count++;
    if (filters.dateFrom || filters.dateTo) count++;
    return count;
  }, [filters]);

  const hasActiveFilters = activeFilterCount > 0;

  return (
    <View style={styles.container}>
      {/* Filter Toggle */}
      <TouchableOpacity
        style={styles.toggleButton}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={styles.toggleLeft}>
          <Ionicons
            name="filter"
            size={20}
            color={hasActiveFilters ? "#c9623d" : "#828180"}
          />
          <Text style={[
            styles.toggleText,
            hasActiveFilters && styles.toggleTextActive
          ]}>
            Filters
          </Text>
          {hasActiveFilters && (
            <View style={styles.filterCountBadge}>
              <Text style={styles.filterCountText}>{activeFilterCount}</Text>
            </View>
          )}
        </View>
        <View style={styles.toggleRight}>
          {hasActiveFilters && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={onClearFilters}
            >
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          )}
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={20}
            color="#828180"
          />
        </View>
      </TouchableOpacity>

      {/* Expandable Filters */}
      {expanded && (
        <View style={styles.filtersContent}>
          {/* Status Filter */}
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Status</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.statusChips}
            >
              {statusOptions.map((status) => {
                const config = getPhotoStatusConfig(status);
                const isActive = filters.status === status;

                return (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.statusChip,
                      isActive && styles.statusChipActive,
                      isActive && { backgroundColor: config.iconColor },
                    ]}
                    onPress={() => handleStatusToggle(status)}
                  >
                    <Ionicons
                      name={config.icon}
                      size={16}
                      color={isActive ? "#ffffff" : config.iconColor}
                    />
                    <Text style={[
                      styles.statusChipText,
                      isActive && styles.statusChipTextActive
                    ]}>
                      {config.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Date Range Filter */}
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Date Range</Text>
            <View style={styles.dateRow}>
              {/* Date From */}
              <View style={styles.dateField}>
                <Text style={styles.dateFieldLabel}>From</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowDateFromPicker(true)}
                >
                  <Ionicons name="calendar-outline" size={16} color="#828180" />
                  <Text style={styles.dateButtonText}>
                    {filters.dateFrom
                      ? new Date(filters.dateFrom).toLocaleDateString()
                      : "Select date"}
                  </Text>
                  {filters.dateFrom && (
                    <TouchableOpacity
                      style={styles.dateClearButton}
                      onPress={handleClearDateFrom}
                    >
                      <Ionicons name="close-circle" size={16} color="#828180" />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              </View>

              {/* Date To */}
              <View style={styles.dateField}>
                <Text style={styles.dateFieldLabel}>To</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowDateToPicker(true)}
                >
                  <Ionicons name="calendar-outline" size={16} color="#828180" />
                  <Text style={styles.dateButtonText}>
                    {filters.dateTo
                      ? new Date(filters.dateTo).toLocaleDateString()
                      : "Select date"}
                  </Text>
                  {filters.dateTo && (
                    <TouchableOpacity
                      style={styles.dateClearButton}
                      onPress={handleClearDateTo}
                    >
                      <Ionicons name="close-circle" size={16} color="#828180" />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Date Pickers */}
      {showDateFromPicker && (
        <DateTimePicker
          value={filters.dateFrom ? new Date(filters.dateFrom) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateFromChange}
        />
      )}

      {showDateToPicker && (
        <DateTimePicker
          value={filters.dateTo ? new Date(filters.dateTo) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateToChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  toggleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
  },
  toggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toggleText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#828180",
  },
  toggleTextActive: {
    color: "#c9623d",
  },
  filterCountBadge: {
    backgroundColor: "#c9623d",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  filterCountText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ffffff",
  },
  toggleRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#c9623d",
  },
  filtersContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  filterSection: {
    marginTop: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 8,
  },
  statusChips: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 16,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f4f4f4",
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    minHeight: 40,
  },
  statusChipActive: {
    borderColor: "transparent",
  },
  statusChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },
  statusChipTextActive: {
    color: "#ffffff",
  },
  dateRow: {
    flexDirection: "row",
    gap: 12,
  },
  dateField: {
    flex: 1,
  },
  dateFieldLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#828180",
    marginBottom: 6,
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#f4f4f4",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    minHeight: 48,
  },
  dateButtonText: {
    flex: 1,
    fontSize: 14,
    color: "#1f2937",
  },
  dateClearButton: {
    padding: 4,
  },
});
