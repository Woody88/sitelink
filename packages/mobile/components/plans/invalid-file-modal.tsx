import React from "react";
import { View, Pressable, Modal, StyleSheet } from "react-native";
import { Text } from "@/components/ui/text";
import { Ionicons } from "@expo/vector-icons";

interface InvalidFileModalProps {
  visible: boolean;
  onClose: () => void;
  onTryDifferentFile: () => void;
}

export function InvalidFileModal({
  visible,
  onClose,
  onTryDifferentFile,
}: InvalidFileModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Close Button */}
          <Pressable onPress={onClose} style={styles.closeButton} hitSlop={12}>
            <Ionicons name="close" size={24} color="#6b7280" />
          </Pressable>

          {/* Icon with Error Badge */}
          <View style={styles.iconContainer}>
            <View style={styles.documentIcon}>
              <Ionicons name="document-text" size={48} color="#94a3b8" />
            </View>
            <View style={styles.errorBadge}>
              <Ionicons name="alert-circle" size={24} color="#ffffff" />
            </View>
          </View>

          {/* Title */}
          <Text className="text-xl font-bold text-foreground text-center mb-2">
            Invalid PDF File
          </Text>

          {/* Message */}
          <Text className="text-sm text-muted-foreground text-center mb-6 px-4">
            The file appears to be corrupted or password protected. SiteLink cannot process this document.
          </Text>

          {/* Actions */}
          <View style={styles.actionsContainer}>
            <Pressable
              onPress={onTryDifferentFile}
              style={styles.primaryButton}
            >
              <Text className="text-base font-semibold text-white">
                Try Different File
              </Text>
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
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 1,
  },
  iconContainer: {
    marginTop: 16,
    marginBottom: 20,
    position: "relative",
  },
  documentIcon: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  errorBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  actionsContainer: {
    width: "100%",
    gap: 12,
  },
  primaryButton: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
});
