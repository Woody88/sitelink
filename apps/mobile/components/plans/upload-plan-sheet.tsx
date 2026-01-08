import * as React from 'react';
import { View, Pressable, Modal } from 'react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Badge } from '@/components/ui/badge';
import { Smartphone, Cloud, Box, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cn } from '@/lib/utils';

interface UploadPlanSheetProps {
  isVisible: boolean;
  onClose: () => void;
  onUploadFromDevice: () => void;
}

export function UploadPlanSheet({ isVisible, onClose, onUploadFromDevice }: UploadPlanSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      animationType="slide"
      presentationStyle="pageSheet"
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 py-4 border-b border-border/10">
          <Text className="text-lg font-bold">Upload Plan</Text>
          <Pressable 
            onPress={onClose}
            className="size-8 items-center justify-center rounded-full bg-muted/20 active:bg-muted/40"
          >
            <Icon as={X} className="size-5 text-foreground" />
          </Pressable>
        </View>

        {/* Options */}
        <View className="p-6 gap-4">
          <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Select Source
          </Text>

          {/* Device Option */}
          <Pressable
            onPress={() => {
              onUploadFromDevice();
              onClose();
            }}
            className="flex-row items-center gap-4 p-4 rounded-2xl bg-muted/10 active:bg-muted/20"
          >
            <View className="size-12 rounded-full bg-primary/10 items-center justify-center">
              <Icon as={Smartphone} className="size-6 text-primary" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold">Device Storage</Text>
              <Text className="text-sm text-muted-foreground">Upload PDF or images from your phone</Text>
            </View>
          </Pressable>

          {/* Google Drive Option (Disabled) */}
          <View
            className="flex-row items-center gap-4 p-4 rounded-2xl bg-muted/5 opacity-60"
          >
            <View className="size-12 rounded-full bg-muted/20 items-center justify-center">
              <Icon as={Cloud} className="size-6 text-muted-foreground" />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-base font-bold text-muted-foreground">Google Drive</Text>
                <Badge variant="secondary" className="bg-primary/10 border-transparent">
                  <Text className="text-[10px] text-primary font-bold">COMING SOON</Text>
                </Badge>
              </View>
              <Text className="text-sm text-muted-foreground/60">Import directly from your drive</Text>
            </View>
          </View>

          {/* Dropbox Option (Disabled) */}
          <View
            className="flex-row items-center gap-4 p-4 rounded-2xl bg-muted/5 opacity-60"
          >
            <View className="size-12 rounded-full bg-muted/20 items-center justify-center">
              <Icon as={Box} className="size-6 text-muted-foreground" />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-base font-bold text-muted-foreground">Dropbox</Text>
                <Badge variant="secondary" className="bg-primary/10 border-transparent">
                  <Text className="text-[10px] text-primary font-bold">COMING SOON</Text>
                </Badge>
              </View>
              <Text className="text-sm text-muted-foreground/60">Import from your Dropbox folders</Text>
            </View>
          </View>
        </View>

        {/* Footer info */}
        <View 
          className="mt-auto p-6 items-center"
          style={{ paddingBottom: Math.max(insets.bottom, 24) }}
        >
          <Text className="text-xs text-muted-foreground text-center leading-relaxed">
            Supported formats: PDF, JPEG, PNG.{"\n"}Recommended resolution: 300 DPI.
          </Text>
        </View>
      </View>
    </Modal>
  );
}


