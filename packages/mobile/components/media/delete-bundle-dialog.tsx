import React from "react";
import { View, Pressable, StyleSheet, Modal } from "react-native";
import { Text } from "@/components/ui/text";
import { Ionicons } from "@expo/vector-icons";

export interface DeleteBundleDialogProps {
  visible: boolean;
  photoCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Delete Bundle Confirmation Dialog
 *
 * Construction-friendly design:
 * - Clear warning message
 * - Large, distinct buttons
 * - Destructive action in red
 * - Easy to tap with gloves
 */
export function DeleteBundleDialog({
  visible,
  photoCount,
  onConfirm,
  onCancel,
}: DeleteBundleDialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          {/* Warning Icon */}
          <View style={styles.iconContainer}>
            <Ionicons name="warning" size={48} color="#ef4444" />
          </View>

          {/* Title */}
          <Text style={styles.title}>Delete Bundle?</Text>

          {/* Message */}
          <Text style={styles.message}>
            This will permanently delete all {photoCount}{" "}
            {photoCount === 1 ? "photo" : "photos"} in this bundle.
          </Text>
          <Text style={styles.submessage}>This action cannot be undone.</Text>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            {/* Cancel Button */}
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => [
                styles.button,
                styles.cancelButton,
                pressed && styles.cancelButtonPressed,
              ]}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>

            {/* Delete Button */}
            <Pressable
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.button,
                styles.deleteButton,
                pressed && styles.deleteButtonPressed,
              ]}
            >
              <Text style={styles.deleteButtonText}>Delete</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  dialog: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#3d3929",
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    color: "#3d3929",
    marginBottom: 8,
    textAlign: "center",
    lineHeight: 24,
  },
  submessage: {
    fontSize: 14,
    color: "#828180",
    marginBottom: 24,
    textAlign: "center",
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  button: {
    flex: 1,
    minHeight: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  cancelButton: {
    backgroundColor: "#f4f4f4",
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  cancelButtonPressed: {
    backgroundColor: "#e5e5e5",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#3d3929",
  },
  deleteButton: {
    backgroundColor: "#ef4444",
  },
  deleteButtonPressed: {
    backgroundColor: "#dc2626",
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
});
