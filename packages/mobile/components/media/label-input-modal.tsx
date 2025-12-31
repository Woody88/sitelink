import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Modal,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Keyboard,
} from "react-native";
import { Text } from "@/components/ui/text";
import { Ionicons } from "@expo/vector-icons";

export interface LabelInputModalProps {
  visible: boolean;
  initialDescription?: string;
  onSave: (description: string) => void;
  onCancel: () => void;
}

const MAX_CHARS = 200;

/**
 * Label Input Modal
 *
 * Construction-friendly modal for adding descriptions to photo bundles.
 *
 * Key features:
 * - Slides up from bottom
 * - Dark overlay (dismissible on tap)
 * - Large multiline input (120px min height)
 * - Character counter
 * - Large touch targets (48px buttons)
 * - Auto-focus on open
 * - High contrast colors
 */
export function LabelInputModal({
  visible,
  initialDescription = "",
  onSave,
  onCancel,
}: LabelInputModalProps) {
  const [description, setDescription] = useState(initialDescription);
  const inputRef = useRef<TextInput>(null);
  const slideAnim = useRef(new Animated.Value(400)).current;

  // Update local state when initial value changes
  useEffect(() => {
    setDescription(initialDescription);
  }, [initialDescription]);

  // Animate modal on open/close
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();

      // Auto-focus input after animation starts
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      Animated.timing(slideAnim, {
        toValue: 400,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  const handleSave = () => {
    Keyboard.dismiss();
    onSave(description.trim());
  };

  const handleCancel = () => {
    Keyboard.dismiss();
    setDescription(initialDescription);
    onCancel();
  };

  const hasChanges = description.trim() !== initialDescription.trim();
  const charCount = description.length;
  const isOverLimit = charCount > MAX_CHARS;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      {/* Overlay */}
      <Pressable style={styles.overlay} onPress={handleCancel}>
        {/* Modal Content */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Animated.View
              style={[
                styles.modalContainer,
                {
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>Add Label</Text>
                <Pressable
                  onPress={handleCancel}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color="#828180" />
                </Pressable>
              </View>

              {/* Input Section */}
              <View style={styles.inputSection}>
                <TextInput
                  ref={inputRef}
                  style={[
                    styles.input,
                    isOverLimit && styles.inputError,
                  ]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Describe this bundle (e.g., 'Foundation forms north wall')"
                  placeholderTextColor="#94a3b8"
                  multiline
                  maxLength={MAX_CHARS + 50} // Allow typing past limit for visual feedback
                  textAlignVertical="top"
                  autoCorrect
                  autoCapitalize="sentences"
                />

                {/* Character Counter */}
                <View style={styles.counterRow}>
                  <Text
                    style={[
                      styles.charCounter,
                      isOverLimit && styles.charCounterError,
                    ]}
                  >
                    {charCount}/{MAX_CHARS}
                  </Text>
                  {isOverLimit && (
                    <Text style={styles.errorText}>
                      Description too long
                    </Text>
                  )}
                </View>
              </View>

              {/* Buttons */}
              <View style={styles.buttonRow}>
                <Pressable
                  onPress={handleCancel}
                  style={[styles.button, styles.cancelButton]}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>

                <Pressable
                  onPress={handleSave}
                  disabled={!hasChanges || isOverLimit}
                  style={[
                    styles.button,
                    styles.saveButton,
                    (!hasChanges || isOverLimit) && styles.saveButtonDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.saveButtonText,
                      (!hasChanges || isOverLimit) &&
                        styles.saveButtonTextDisabled,
                    ]}
                  >
                    Save
                  </Text>
                </Pressable>
              </View>
            </Animated.View>
          </Pressable>
        </KeyboardAvoidingView>
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
  keyboardView: {
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 20, // Safe area for iOS
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#3d3929",
  },
  closeButton: {
    padding: 4,
  },
  inputSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  input: {
    minHeight: 120,
    maxHeight: 200,
    backgroundColor: "#f9f9f9",
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#3d3929",
    lineHeight: 22,
  },
  inputError: {
    borderColor: "#ef4444",
    backgroundColor: "#fef2f2",
  },
  counterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  charCounter: {
    fontSize: 13,
    color: "#94a3b8",
    fontWeight: "500",
  },
  charCounterError: {
    color: "#ef4444",
  },
  errorText: {
    fontSize: 13,
    color: "#ef4444",
    fontWeight: "500",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "#f4f4f4",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#3d3929",
  },
  saveButton: {
    backgroundColor: "#c9623d",
  },
  saveButtonDisabled: {
    backgroundColor: "#e5e5e5",
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  saveButtonTextDisabled: {
    color: "#94a3b8",
  },
});
