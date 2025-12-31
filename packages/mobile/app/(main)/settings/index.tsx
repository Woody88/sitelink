import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  Modal,
  Linking,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import {
  loadSettings,
  saveSettings,
  clearSettings,
  DEFAULT_SETTINGS,
  type AppSettings,
} from "@/lib/storage/settings";
import Toast from "react-native-toast-message";
import Constants from "expo-constants";

// Reusable Settings Row Components
interface SettingsRowProps {
  label: string;
  value: string;
  isLast?: boolean;
}

function SettingsRow({ label, value, isLast }: SettingsRowProps) {
  return (
    <View
      className={`px-4 py-4 flex-row justify-between items-center ${
        isLast ? "" : "border-b border-gray-700"
      }`}
    >
      <Text className="text-gray-300 text-base">{label}</Text>
      <Text className="text-gray-400 text-base">{value}</Text>
    </View>
  );
}

interface SettingsPickerRowProps {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  isLast?: boolean;
}

function SettingsPickerRow({
  label,
  value,
  options,
  onChange,
  isLast,
}: SettingsPickerRowProps) {
  const [pickerVisible, setPickerVisible] = useState(false);

  const handleSelect = (option: string) => {
    onChange(option);
    setPickerVisible(false);
  };

  // Capitalize first letter for display
  const formatValue = (val: string) => {
    return val.charAt(0).toUpperCase() + val.slice(1);
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => setPickerVisible(true)}
        className={`px-4 py-4 flex-row justify-between items-center active:bg-gray-700 ${
          isLast ? "" : "border-b border-gray-700"
        }`}
      >
        <Text className="text-gray-300 text-base">{label}</Text>
        <View className="flex-row items-center gap-2">
          <Text className="text-blue-400 text-base">{formatValue(value)}</Text>
          <Ionicons name="chevron-forward" size={20} color="#60a5fa" />
        </View>
      </TouchableOpacity>

      {/* Picker Modal */}
      <Modal
        visible={pickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setPickerVisible(false)}
          className="flex-1 bg-black/50 justify-center items-center"
        >
          <TouchableOpacity activeOpacity={1} className="bg-gray-800 rounded-2xl mx-8 w-80 overflow-hidden">
            <View className="border-b border-gray-700 px-4 py-4">
              <Text className="text-white text-lg font-semibold text-center">
                {label}
              </Text>
            </View>

            {options.map((option, index) => (
              <TouchableOpacity
                key={option}
                onPress={() => handleSelect(option)}
                className={`px-4 py-4 active:bg-gray-700 ${
                  index < options.length - 1 ? "border-b border-gray-700" : ""
                }`}
              >
                <View className="flex-row items-center justify-between">
                  <Text
                    className={`text-base ${
                      option === value ? "text-blue-400 font-semibold" : "text-gray-300"
                    }`}
                  >
                    {formatValue(option)}
                  </Text>
                  {option === value && (
                    <Ionicons name="checkmark" size={24} color="#60a5fa" />
                  )}
                </View>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              onPress={() => setPickerVisible(false)}
              className="px-4 py-4 border-t-2 border-gray-700 active:bg-gray-700"
            >
              <Text className="text-gray-400 text-center font-semibold text-base">
                Cancel
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

interface SettingsLinkRowProps {
  label: string;
  onPress: () => void;
  isLast?: boolean;
}

function SettingsLinkRow({ label, onPress, isLast }: SettingsLinkRowProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`px-4 py-4 flex-row justify-between items-center active:bg-gray-700 ${
        isLast ? "" : "border-b border-gray-700"
      }`}
    >
      <Text className="text-blue-400 text-base">{label}</Text>
      <Ionicons name="chevron-forward" size={20} color="#60a5fa" />
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const { user, session, organization, signOut, isLoading } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [logoutDialogVisible, setLogoutDialogVisible] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  // Handle setting changes
  const handleSettingChange = async (key: keyof AppSettings, value: any) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);

    try {
      await saveSettings({ [key]: value });
      Toast.show({
        type: "success",
        text1: "Setting Updated",
        visibilityTime: 1500,
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Failed to Save",
        text2: "Please try again",
      });
    }
  };

  // Handle logout
  const handleLogout = () => {
    setLogoutDialogVisible(true);
  };

  const confirmLogout = async () => {
    setLogoutDialogVisible(false);
    try {
      await clearSettings();
      await signOut();
      // Navigation is handled by auth context
    } catch (error) {
      console.error("[Settings] Logout error:", error);
      Toast.show({
        type: "error",
        text1: "Logout Failed",
        text2: "Please try again",
      });
    }
  };

  // Handle external links
  const openPrivacyPolicy = () => {
    Linking.openURL("https://sitelink.example.com/privacy");
  };

  const openTermsOfService = () => {
    Linking.openURL("https://sitelink.example.com/terms");
  };

  // Get app version info
  const appVersion = Constants.expoConfig?.version || "1.0.0";
  const buildNumber =
    Platform.OS === "ios"
      ? Constants.expoConfig?.ios?.buildNumber || "1"
      : Constants.expoConfig?.android?.versionCode?.toString() || "1";

  return (
    <SafeAreaView className="flex-1 bg-gray-900" edges={['bottom']}>
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="pt-12 pb-6 px-4 border-b border-gray-800">
          <View className="flex-row items-center mb-2">
            <TouchableOpacity
              onPress={() => router.back()}
              className="mr-3 p-2 -ml-2"
            >
              <Ionicons name="arrow-back" size={24} color="#9ca3af" />
            </TouchableOpacity>
            <Text className="text-3xl font-bold text-white">Settings</Text>
          </View>
          <Text className="text-gray-400 text-base ml-10">
            Manage your account and preferences
          </Text>
        </View>

        {/* PROFILE Section */}
        <View className="mt-6 bg-gray-800 mx-4 rounded-lg overflow-hidden">
          <View className="border-b border-gray-700 px-4 py-3">
            <Text className="text-gray-400 text-xs uppercase tracking-wider font-semibold">
              Profile
            </Text>
          </View>

          <SettingsRow
            label="Name"
            value={user?.name || "N/A"}
          />
          <SettingsRow
            label="Email"
            value={user?.email || "N/A"}
          />
          <SettingsRow
            label="Organization"
            value={organization?.name || "N/A"}
            isLast
          />
        </View>

        {/* PREFERENCES Section */}
        <View className="mt-6 bg-gray-800 mx-4 rounded-lg overflow-hidden">
          <View className="border-b border-gray-700 px-4 py-3">
            <Text className="text-gray-400 text-xs uppercase tracking-wider font-semibold">
              Preferences
            </Text>
          </View>

          <SettingsPickerRow
            label="Default Photo Status"
            value={settings.defaultPhotoStatus}
            options={["before", "progress", "complete", "issue"] as const}
            onChange={(value) =>
              handleSettingChange(
                "defaultPhotoStatus",
                value as AppSettings["defaultPhotoStatus"]
              )
            }
          />
          <SettingsPickerRow
            label="Camera Flash"
            value={settings.cameraFlashDefault}
            options={["on", "off", "auto"] as const}
            onChange={(value) =>
              handleSettingChange(
                "cameraFlashDefault",
                value as AppSettings["cameraFlashDefault"]
              )
            }
          />
          <SettingsPickerRow
            label="Photo Quality"
            value={settings.photoQuality}
            options={["high", "medium", "low"] as const}
            onChange={(value) =>
              handleSettingChange(
                "photoQuality",
                value as AppSettings["photoQuality"]
              )
            }
            isLast
          />
        </View>

        {/* ABOUT Section */}
        <View className="mt-6 bg-gray-800 mx-4 rounded-lg overflow-hidden">
          <View className="border-b border-gray-700 px-4 py-3">
            <Text className="text-gray-400 text-xs uppercase tracking-wider font-semibold">
              About
            </Text>
          </View>

          <SettingsRow label="App Version" value={appVersion} />
          <SettingsRow label="Build Number" value={buildNumber} />
          <SettingsLinkRow
            label="Privacy Policy"
            onPress={openPrivacyPolicy}
          />
          <SettingsLinkRow
            label="Terms of Service"
            onPress={openTermsOfService}
            isLast
          />
        </View>

        {/* ACCOUNT Section */}
        <View className="mt-6 bg-gray-800 mx-4 rounded-lg overflow-hidden mb-8">
          <TouchableOpacity
            onPress={handleLogout}
            disabled={isLoading}
            className="px-4 py-4 active:bg-gray-700"
          >
            <Text className="text-red-500 text-center font-semibold text-base">
              {isLoading ? "Logging Out..." : "Logout"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Logout Confirmation Dialog */}
      <Modal
        visible={logoutDialogVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLogoutDialogVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center">
          <View className="bg-gray-800 rounded-2xl p-6 mx-8 w-80">
            <Text className="text-white text-xl font-semibold mb-3">
              Logout
            </Text>
            <Text className="text-gray-300 text-base mb-6">
              Are you sure you want to logout?
            </Text>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setLogoutDialogVisible(false)}
                className="flex-1 bg-gray-600 py-3 rounded-lg active:bg-gray-500"
              >
                <Text className="text-white text-center font-semibold text-base">
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={confirmLogout}
                className="flex-1 bg-red-500 py-3 rounded-lg active:bg-red-600"
              >
                <Text className="text-white text-center font-semibold text-base">
                  Logout
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
