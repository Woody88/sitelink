import { Box, Cloud, Smartphone, X } from "lucide-react-native";
import * as React from "react";
import { Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

interface UploadPlanSheetProps {
	isVisible: boolean;
	onClose: () => void;
	onUploadFromDevice: () => void;
}

export function UploadPlanSheet({
	isVisible,
	onClose,
	onUploadFromDevice,
}: UploadPlanSheetProps) {
	const insets = useSafeAreaInsets();

	return (
		<Modal
			animationType="slide"
			presentationStyle="pageSheet"
			visible={isVisible}
			onRequestClose={onClose}
		>
			<View className="bg-background flex-1">
				{/* Header */}
				<View className="border-border/10 flex-row items-center justify-between border-b px-6 py-4">
					<Text className="text-lg font-bold">Upload Plan</Text>
					<Pressable
						onPress={onClose}
						className="bg-muted/20 active:bg-muted/40 size-8 items-center justify-center rounded-full"
					>
						<Icon as={X} className="text-foreground size-5" />
					</Pressable>
				</View>

				{/* Options */}
				<View className="gap-4 p-6">
					<Text className="text-muted-foreground mb-2 text-sm font-semibold tracking-wider uppercase">
						Select Source
					</Text>

					{/* Device Option */}
					<Pressable
						onPress={() => {
							onUploadFromDevice();
							onClose();
						}}
						className="bg-muted/10 active:bg-muted/20 flex-row items-center gap-4 rounded-2xl p-4"
					>
						<View className="bg-primary/10 size-12 items-center justify-center rounded-full">
							<Icon as={Smartphone} className="text-primary size-6" />
						</View>
						<View className="flex-1">
							<Text className="text-base font-bold">Device Storage</Text>
							<Text className="text-muted-foreground text-sm">
								Upload PDF or images from your phone
							</Text>
						</View>
					</Pressable>

					{/* Google Drive Option (Disabled) */}
					<View className="bg-muted/5 flex-row items-center gap-4 rounded-2xl p-4 opacity-60">
						<View className="bg-muted/20 size-12 items-center justify-center rounded-full">
							<Icon as={Cloud} className="text-muted-foreground size-6" />
						</View>
						<View className="flex-1">
							<View className="flex-row items-center gap-2">
								<Text className="text-muted-foreground text-base font-bold">
									Google Drive
								</Text>
								<Badge
									variant="secondary"
									className="bg-primary/10 border-transparent"
								>
									<Text className="text-primary text-[10px] font-bold">
										COMING SOON
									</Text>
								</Badge>
							</View>
							<Text className="text-muted-foreground/60 text-sm">
								Import directly from your drive
							</Text>
						</View>
					</View>

					{/* Dropbox Option (Disabled) */}
					<View className="bg-muted/5 flex-row items-center gap-4 rounded-2xl p-4 opacity-60">
						<View className="bg-muted/20 size-12 items-center justify-center rounded-full">
							<Icon as={Box} className="text-muted-foreground size-6" />
						</View>
						<View className="flex-1">
							<View className="flex-row items-center gap-2">
								<Text className="text-muted-foreground text-base font-bold">
									Dropbox
								</Text>
								<Badge
									variant="secondary"
									className="bg-primary/10 border-transparent"
								>
									<Text className="text-primary text-[10px] font-bold">
										COMING SOON
									</Text>
								</Badge>
							</View>
							<Text className="text-muted-foreground/60 text-sm">
								Import from your Dropbox folders
							</Text>
						</View>
					</View>
				</View>

				{/* Footer info */}
				<View
					className="mt-auto items-center p-6"
					style={{ paddingBottom: Math.max(insets.bottom, 24) }}
				>
					<Text className="text-muted-foreground text-center text-xs leading-relaxed">
						Supported formats: PDF, JPEG, PNG.{"\n"}Recommended resolution: 300
						DPI.
					</Text>
				</View>
			</View>
		</Modal>
	);
}
