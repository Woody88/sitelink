import AsyncStorage from "@react-native-async-storage/async-storage";

export interface AppSettings {
  defaultPhotoStatus: "before" | "progress" | "complete" | "issue";
  cameraFlashDefault: "on" | "off" | "auto";
  photoQuality: "high" | "medium" | "low";
}

const SETTINGS_KEY = "@sitelink/settings";

const DEFAULT_SETTINGS: AppSettings = {
  defaultPhotoStatus: "before",
  cameraFlashDefault: "auto",
  photoQuality: "high",
};

export const loadSettings = async (): Promise<AppSettings> => {
  try {
    const json = await AsyncStorage.getItem(SETTINGS_KEY);
    if (json) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(json) };
    }
  } catch (error) {
    console.error("[Settings] Failed to load settings:", error);
  }
  return DEFAULT_SETTINGS;
};

export const saveSettings = async (
  settings: Partial<AppSettings>
): Promise<void> => {
  try {
    const current = await loadSettings();
    const updated = { ...current, ...settings };
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("[Settings] Failed to save settings:", error);
    throw error;
  }
};

export const clearSettings = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(SETTINGS_KEY);
  } catch (error) {
    console.error("[Settings] Failed to clear settings:", error);
  }
};

export { DEFAULT_SETTINGS };
