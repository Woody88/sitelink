import React from "react";
import { View, Pressable, StyleSheet, Modal } from "react-native";
import { Text } from "@/components/ui/text";
import { Ionicons } from "@expo/vector-icons";

interface UploadSource {
  id: "device" | "dropbox" | "google-drive";
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  enabled: boolean;
}

const UPLOAD_SOURCES: UploadSource[] = [
  { id: "device", label: "Upload from Device", icon: "phone-portrait-outline", enabled: true },
  { id: "dropbox", label: "Dropbox", icon: "cloud-outline", enabled: false },
  { id: "google-drive", label: "Google Drive", icon: "logo-google", enabled: false },
];

interface UploadBottomSheetProps {
  visible: boolean;
  onSelectSource: (source: "device" | "dropbox" | "google-drive") => void;
  onClose: () => void;
}

export function UploadBottomSheet({ visible, onSelectSource, onClose }: UploadBottomSheetProps) {
  const handleSourcePress = (source: UploadSource) => {
    if (source.enabled) {
      onSelectSource(source.id);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Handle indicator */}
          <View style={styles.handleContainer}>
            <View style={styles.handleIndicator} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text className="text-lg font-bold text-foreground">Upload Plan</Text>
            <Pressable onPress={onClose} style={styles.closeButton} hitSlop={12}>
              <Ionicons name="close" size={24} color="#3d3929" />
            </Pressable>
          </View>

          {/* Source Options */}
          <View style={styles.optionsContainer}>
            {UPLOAD_SOURCES.map((source) => (
              <Pressable
                key={source.id}
                onPress={() => handleSourcePress(source)}
                disabled={!source.enabled}
                style={[
                  styles.sourceOption,
                  !source.enabled && styles.sourceOptionDisabled,
                ]}
              >
                <View style={styles.sourceIconContainer}>
                  <Ionicons
                    name={source.icon}
                    size={24}
                    color={source.enabled ? "#c9623d" : "#9ca3af"}
                  />
                </View>
                <View style={styles.sourceLabelContainer}>
                  <Text
                    className={`text-base font-medium ${
                      source.enabled ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {source.label}
                  </Text>
                  {!source.enabled && (
                    <View style={styles.comingSoonBadge}>
                      <Text className="text-xs text-muted-foreground">Coming Soon</Text>
                    </View>
                  )}
                </View>
                {source.enabled && (
                  <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#faf8f5",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  handleContainer: {
    alignItems: "center",
    paddingVertical: 12,
  },
  handleIndicator: {
    backgroundColor: "#d1d5db",
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    marginBottom: 16,
  },
  closeButton: {
    padding: 4,
  },
  optionsContainer: {
    gap: 8,
  },
  sourceOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f3ef",
    borderRadius: 12,
    padding: 16,
    minHeight: 56,
  },
  sourceOptionDisabled: {
    opacity: 0.5,
  },
  sourceIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  sourceLabelContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  comingSoonBadge: {
    backgroundColor: "#e5e7eb",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
});
