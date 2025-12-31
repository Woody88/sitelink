import React, { useState, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { CameraView, CameraType, useCameraPermissions, FlashMode } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";
import { useUploadMedia } from "@/lib/api";
import { PhotoStatusSelector, type PhotoStatus } from "@/components/media";

/**
 * Camera Screen for capturing site photos
 *
 * Design principles:
 * - Large capture button (construction-friendly)
 * - Simple controls (flash, flip, gallery)
 * - Immediate upload after capture
 * - Dark theme for outdoor visibility
 */
export default function CameraScreen() {
  const insets = useSafeAreaInsets();
  const { projectId, markerId, planId } = useLocalSearchParams<{ 
    projectId: string;
    markerId?: string;
    planId?: string;
  }>();

  const [facing, setFacing] = useState<CameraType>("back");
  const [flash, setFlash] = useState<FlashMode>("off");
  const [isCapturing, setIsCapturing] = useState(false);
  const [status, setStatus] = useState<PhotoStatus>("progress");
  const cameraRef = useRef<CameraView>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const { mutate: uploadMedia, isLoading: isUploading } = useUploadMedia();

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || isCapturing || isUploading) return;

    try {
      setIsCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: false,
      });

      if (!photo?.uri) {
        Alert.alert("Error", "Failed to capture photo");
        return;
      }

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `site-photo-${timestamp}.jpg`;

      // Upload immediately
      console.log("Uploading photo:", {
        projectId: projectId!,
        fileName,
        uri: photo.uri,
        markerId,
        planId,
        status,
      });

      const result = await uploadMedia({
        projectId: projectId!,
        file: {
          uri: photo.uri,
          name: fileName,
          type: "image/jpeg",
        },
        mediaType: "photo",
        markerId,
        planId,
        status,
      });

      console.log("Upload result:", result);

      if (result) {
        // Success - navigate back
        console.log("Upload successful, navigating back");
        router.back();
      } else {
        console.error("Upload failed - no result returned");
        Alert.alert("Error", "Failed to upload photo. Please try again.");
      }
    } catch (error) {
      console.error("Capture error:", error);
      Alert.alert("Error", "Failed to capture or upload photo");
    } finally {
      setIsCapturing(false);
    }
  }, [projectId, uploadMedia, isCapturing, isUploading, markerId, planId, status]);

  const handleFlipCamera = useCallback(() => {
    setFacing((current) => (current === "back" ? "front" : "back"));
  }, []);

  const handleToggleFlash = useCallback(() => {
    setFlash((current) => {
      switch (current) {
        case "off":
          return "on";
        case "on":
          return "auto";
        case "auto":
          return "off";
        default:
          return "off";
      }
    });
  }, []);

  const handlePickFromGallery = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: false,
        allowsMultipleSelection: false,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const fileName = asset.fileName || `gallery-photo-${Date.now()}.jpg`;

      // Upload the selected image
      const uploadResult = await uploadMedia({
        projectId: projectId!,
        file: {
          uri: asset.uri,
          name: fileName,
          type: asset.mimeType || "image/jpeg",
        },
        mediaType: "photo",
        markerId,
        planId,
        status,
      });

      if (uploadResult) {
        router.back();
      }
    } catch (error) {
      console.error("Gallery picker error:", error);
      Alert.alert("Error", "Failed to select or upload photo");
    }
  }, [projectId, uploadMedia, markerId, planId, status]);

  const handleClose = useCallback(() => {
    router.back();
  }, []);

  const getFlashIcon = (): keyof typeof Ionicons.glyphMap => {
    switch (flash) {
      case "on":
        return "flash";
      case "auto":
        return "flash-outline";
      case "off":
      default:
        return "flash-off";
    }
  };

  // Permission handling
  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator size="large" color="#c9623d" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.permissionContainer, { paddingTop: insets.top }]}>
        <Ionicons name="camera-outline" size={64} color="#828180" />
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionText}>
          SiteLink needs camera access to capture site photos for documentation.
        </Text>
        <Pressable style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </Pressable>
        <Pressable style={styles.cancelButton} onPress={handleClose}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        flash={flash}
      >
        {/* Top Controls */}
        <View style={[styles.topControls, { paddingTop: insets.top + 16 }]}>
          <Pressable
            style={styles.controlButton}
            onPress={handleClose}
            hitSlop={16}
          >
            <Ionicons name="close" size={28} color="#ffffff" />
          </Pressable>

          <Pressable
            style={styles.controlButton}
            onPress={handleToggleFlash}
            hitSlop={16}
          >
            <Ionicons name={getFlashIcon()} size={28} color="#ffffff" />
            {flash === "auto" && (
              <View style={styles.autoIndicator}>
                <Text style={styles.autoText}>A</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Status Selector Overlay */}
        <View style={styles.statusOverlay}>
          <PhotoStatusSelector
            selectedStatus={status}
            onStatusChange={setStatus}
            size="compact"
          />
        </View>

        {/* Bottom Controls */}
        <View style={[styles.bottomControls, { paddingBottom: insets.bottom + 24 }]}>
          {/* Gallery Button */}
          <Pressable
            style={styles.sideButton}
            onPress={handlePickFromGallery}
            disabled={isUploading}
            hitSlop={16}
          >
            <Ionicons name="images-outline" size={32} color="#ffffff" />
          </Pressable>

          {/* Capture Button */}
          <Pressable
            style={[
              styles.captureButton,
              (isCapturing || isUploading) && styles.captureButtonDisabled,
            ]}
            onPress={handleCapture}
            disabled={isCapturing || isUploading}
          >
            {isCapturing || isUploading ? (
              <ActivityIndicator size="large" color="#1a1a1a" />
            ) : (
              <View style={styles.captureInner} />
            )}
          </Pressable>

          {/* Flip Camera Button */}
          <Pressable
            style={styles.sideButton}
            onPress={handleFlipCamera}
            disabled={isCapturing || isUploading}
            hitSlop={16}
          >
            <Ionicons name="camera-reverse-outline" size={32} color="#ffffff" />
          </Pressable>
        </View>

        {/* Upload Progress Overlay */}
        {isUploading && (
          <View style={styles.uploadOverlay}>
            <ActivityIndicator size="large" color="#c9623d" />
            <Text style={styles.uploadText}>Uploading...</Text>
          </View>
        )}
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  camera: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: "#ffffff",
    marginTop: 24,
    marginBottom: 12,
    textAlign: "center",
  },
  permissionText: {
    fontSize: 16,
    color: "#828180",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: "#c9623d",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
    minWidth: 200,
    alignItems: "center",
  },
  permissionButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  cancelButtonText: {
    color: "#828180",
    fontSize: 16,
  },
  topControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 24,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  autoIndicator: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "#c9623d",
    borderRadius: 6,
    width: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  autoText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "700",
  },
  bottomControls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 32,
  },
  sideButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  statusOverlay: {
    position: "absolute",
    bottom: 120,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    padding: 12,
    borderRadius: 16,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  captureButtonDisabled: {
    opacity: 0.7,
  },
  captureInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#ffffff",
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  uploadText: {
    color: "#ffffff",
    fontSize: 16,
    marginTop: 16,
  },
});
