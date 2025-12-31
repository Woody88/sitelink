import React, { useCallback, useMemo, useRef } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Text } from "@/components/ui/text";
import { Ionicons } from "@expo/vector-icons";
import BottomSheet, { BottomSheetBackdrop } from "@gorhom/bottom-sheet";
import type { PhotoBundle } from "./photo-bundle-card";

export interface BundleActionsSheetProps {
  visible: boolean;
  bundle: PhotoBundle | null;
  onShare: (bundle: PhotoBundle) => void;
  onEditLabel: (bundle: PhotoBundle) => void;
  onChangeStatus: (bundle: PhotoBundle) => void;
  onDelete: (bundle: PhotoBundle) => void;
  onClose: () => void;
}

/**
 * Action Item Component
 * Large tap targets for construction-friendly UX
 */
interface ActionItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

function ActionItem({ icon, label, onPress, destructive }: ActionItemProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionItem,
        pressed && styles.actionItemPressed,
      ]}
    >
      <Ionicons
        name={icon}
        size={24}
        color={destructive ? "#ef4444" : "#3d3929"}
      />
      <Text
        style={[
          styles.actionLabel,
          destructive && styles.actionLabelDestructive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Bundle Actions Bottom Sheet
 *
 * Construction-friendly design:
 * - Large tap targets (56px minimum height)
 * - High contrast icons and text
 * - Clear visual separation between actions
 * - Destructive action clearly marked in red
 * - Swipe down or tap outside to dismiss
 */
export function BundleActionsSheet({
  visible,
  bundle,
  onShare,
  onEditLabel,
  onChangeStatus,
  onDelete,
  onClose,
}: BundleActionsSheetProps) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["40%"], []);

  // Sync sheet visibility with visible prop
  React.useEffect(() => {
    if (visible) {
      bottomSheetRef.current?.expand();
    } else {
      bottomSheetRef.current?.close();
    }
  }, [visible]);

  const handleSharePress = useCallback(() => {
    if (bundle) {
      onShare(bundle);
    }
  }, [bundle, onShare]);

  const handleEditLabelPress = useCallback(() => {
    if (bundle) {
      onEditLabel(bundle);
    }
  }, [bundle, onEditLabel]);

  const handleChangeStatusPress = useCallback(() => {
    if (bundle) {
      onChangeStatus(bundle);
    }
  }, [bundle, onChangeStatus]);

  const handleDeletePress = useCallback(() => {
    if (bundle) {
      onDelete(bundle);
    }
  }, [bundle, onDelete]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    []
  );

  if (!visible && !bundle) {
    return null;
  }

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Bundle Actions</Text>
          {bundle && (
            <Text style={styles.subtitle}>
              {bundle.photos.length} {bundle.photos.length === 1 ? "photo" : "photos"}
            </Text>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <ActionItem
            icon="share-outline"
            label="Share Bundle"
            onPress={handleSharePress}
          />

          <ActionItem
            icon="create-outline"
            label="Edit Label"
            onPress={handleEditLabelPress}
          />

          <ActionItem
            icon="flag-outline"
            label="Change Status"
            onPress={handleChangeStatusPress}
          />

          {/* Separator before destructive action */}
          <View style={styles.separator} />

          <ActionItem
            icon="trash-outline"
            label="Delete Bundle"
            onPress={handleDeletePress}
            destructive
          />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handleIndicator: {
    backgroundColor: "#d4d4d4",
    width: 40,
    height: 4,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#3d3929",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#828180",
  },
  actionsContainer: {
    paddingVertical: 8,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    minHeight: 56,
    gap: 16,
  },
  actionItemPressed: {
    backgroundColor: "#f4f4f4",
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#3d3929",
  },
  actionLabelDestructive: {
    color: "#ef4444",
  },
  separator: {
    height: 1,
    backgroundColor: "#f0f0f0",
    marginVertical: 8,
  },
});
