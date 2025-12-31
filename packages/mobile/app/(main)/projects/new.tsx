import React, { useState, useCallback } from "react";
import {
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Keyboard,
  TouchableWithoutFeedback,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { useCreateProject } from "@/lib/api/hooks";
import Toast from "react-native-toast-message";

interface FormErrors {
  name?: string;
  description?: string;
}

export default function NewProjectScreen() {
  const insets = useSafeAreaInsets();
  const { session, organization } = useAuth();
  const { mutate: createProject, isLoading } = useCreateProject();

  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  const validateForm = useCallback((): FormErrors => {
    const newErrors: FormErrors = {};

    if (!projectName.trim()) {
      newErrors.name = "Project name is required";
    } else if (projectName.length < 3) {
      newErrors.name = "Project name must be at least 3 characters";
    } else if (projectName.length > 100) {
      newErrors.name = "Project name must be less than 100 characters";
    }

    if (description && description.length > 500) {
      newErrors.description = "Description must be less than 500 characters";
    }

    return newErrors;
  }, [projectName, description]);

  const handleSubmit = useCallback(() => {
    // Dismiss keyboard
    Keyboard.dismiss();

    const validationErrors = validateForm();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    createProject(
      {
        name: projectName.trim(),
        description: description.trim() || undefined,
      },
      {
        onSuccess: (result) => {
          Toast.show({
            type: "success",
            text1: "Project Created",
            text2: projectName,
          });
          // Navigate to the new project's plans screen
          router.replace(`/(main)/projects/${result.projectId}/plans`);
        },
        onError: (error) => {
          Toast.show({
            type: "error",
            text1: "Creation Failed",
            text2: "Could not create project. Please try again.",
          });
        },
      }
    );
  }, [projectName, description, createProject, validateForm]);

  const handleCancel = useCallback(() => {
    router.back();
  }, []);

  const handleNameChange = useCallback((text: string) => {
    setProjectName(text);
    // Clear error when user starts typing
    setErrors((prev) => ({ ...prev, name: undefined }));
  }, []);

  const handleDescriptionChange = useCallback((text: string) => {
    setDescription(text);
    // Clear error when user starts typing
    setErrors((prev) => ({ ...prev, description: undefined }));
  }, []);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View className="flex-1 bg-background">
        {/* Header */}
        <View
          className="bg-background border-b border-slate-200"
          style={{ paddingTop: insets.top }}
        >
          <View className="flex-row items-center px-4 py-3">
            <TouchableOpacity
              onPress={handleCancel}
              className="w-12 h-12 items-center justify-center"
              disabled={isLoading}
            >
              <Ionicons name="arrow-back" size={24} color="#3d3929" />
            </TouchableOpacity>
            <Text className="text-xl font-bold tracking-tight flex-1 text-center mr-12">
              New Project
            </Text>
          </View>

          {/* Organization context */}
          <View className="px-4 pb-3">
            <Text className="text-sm text-muted-foreground text-center">
              Organization:{" "}
              <Text className="font-semibold text-primary">
                {organization?.name ?? "Unknown"}
              </Text>
            </Text>
          </View>
        </View>

        {/* Form Content */}
        <ScrollView
          className="flex-1 px-4 pt-6"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {/* Project Name Field */}
          <View className="mb-6">
            <Text className="text-white font-semibold mb-2 text-base">
              Project Name *
            </Text>
            <TextInput
              className="bg-gray-700 text-white px-4 py-3 rounded-lg text-base"
              placeholder="Enter project name"
              placeholderTextColor="#9ca3af"
              value={projectName}
              onChangeText={handleNameChange}
              maxLength={100}
              editable={!isLoading}
              autoFocus
            />
            {errors.name && (
              <Text className="text-red-500 text-sm mt-1">{errors.name}</Text>
            )}
            <Text className="text-gray-400 text-xs mt-1">
              {projectName.length}/100
            </Text>
          </View>

          {/* Description Field */}
          <View className="mb-6">
            <Text className="text-white font-semibold mb-2 text-base">
              Description
            </Text>
            <TextInput
              className="bg-gray-700 text-white px-4 py-3 rounded-lg text-base"
              placeholder="Enter project description (optional)"
              placeholderTextColor="#9ca3af"
              value={description}
              onChangeText={handleDescriptionChange}
              multiline
              numberOfLines={4}
              maxLength={500}
              style={{ minHeight: 100, textAlignVertical: "top" }}
              editable={!isLoading}
            />
            <Text className="text-gray-400 text-xs mt-1">
              {description.length}/500
            </Text>
            {errors.description && (
              <Text className="text-red-500 text-sm mt-1">
                {errors.description}
              </Text>
            )}
          </View>

          {/* Info Text */}
          <View className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
            <View className="flex-row items-start gap-2">
              <Ionicons name="information-circle" size={20} color="#c9623d" />
              <Text className="text-gray-300 text-sm flex-1">
                Projects help organize construction plans and media for specific
                jobs or sites.
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Loading Overlay */}
        {isLoading && (
          <View className="absolute inset-0 bg-black/50 items-center justify-center">
            <View className="bg-background p-6 rounded-xl items-center">
              <ActivityIndicator size="large" color="#c9623d" />
              <Text className="mt-3 text-white font-medium">
                Creating project...
              </Text>
            </View>
          </View>
        )}

        {/* Footer Buttons */}
        <View
          className="absolute bottom-0 left-0 right-0 p-4 bg-background/95 border-t border-slate-200"
          style={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}
        >
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={handleCancel}
              className="flex-1 bg-gray-600 py-4 rounded-lg"
              disabled={isLoading}
            >
              <Text className="text-white text-center font-semibold text-base">
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmit}
              className="flex-1 bg-[#c9623d] py-4 rounded-lg"
              disabled={isLoading}
            >
              <Text className="text-white text-center font-semibold text-base">
                {isLoading ? "Creating..." : "Create Project"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}
