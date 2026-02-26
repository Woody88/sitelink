// apps/mobile/app/project/[id]/settings.tsx

import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
	Bell,
	Download,
	Edit,
	FileText,
	HardDrive,
	Link,
	Share2,
	Trash2,
	Users,
} from "lucide-react-native";
import * as React from "react";
import { Alert, ScrollView, Share, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SettingsItem } from "@/components/settings/settings-item";
import { Icon } from "@/components/ui/icon";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { useSessionContext } from "@/lib/session-context";
import { getMediaPath, getProjectPath } from "@/utils/file-paths";

const BACKEND_URL = process.env.EXPO_PUBLIC_BETTER_AUTH_URL ?? "";

export default function ProjectSettingsScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{ id: string }>();
	const insets = useSafeAreaInsets();
	const { sessionToken } = useSessionContext();

	// TODO: Get project data from LiveStore
	const [projectName] = React.useState("Riverside Apartments");
	const [projectAddress] = React.useState("123 Main St, Denver, CO");
	const [isEditingDetails, setIsEditingDetails] = React.useState(false);

	// Share link state
	const [shareUrl, setShareUrl] = React.useState<string | null>(null);
	const [shareLinkState, setShareLinkState] = React.useState<"idle" | "loading" | "copied" | "error">("idle");
	const [shareExpiry, setShareExpiry] = React.useState<"never" | "7d" | "30d">("never");

	// Notification settings
	const [notifyOnNewPlans, setNotifyOnNewPlans] = React.useState(true);
	const [notifyOnNewMedia, setNotifyOnNewMedia] = React.useState(true);
	const [notifyOnComments, setNotifyOnComments] = React.useState(true);

	// Storage info (mock for now)
	const [storageInfo, setStorageInfo] = React.useState({
		totalSize: 0,
		plansSize: 0,
		mediaSize: 0,
		plansCount: 0,
		mediaCount: 0,
	});

	// Calculate storage info
	React.useEffect(() => {
		const calculateStorage = async () => {
			try {
				// TODO: Get organizationId from user context or project data
				const organizationId = "temp-org-id";
				const projectId = params.id;

				const projectPath = getProjectPath(organizationId, projectId);
				const mediaPath = getMediaPath(organizationId, projectId);

				// Calculate plans directory size (all plan upload directories)
				let plansSize = 0;
				let plansCount = 0;
				try {
					const projectInfo = await FileSystem.getInfoAsync(projectPath);
					if (projectInfo.exists && projectInfo.isDirectory) {
						const planDir = `${projectPath}/plan`;
						const planDirInfo = await FileSystem.getInfoAsync(planDir);
						if (planDirInfo.exists && planDirInfo.isDirectory) {
							// TODO: Iterate through upload directories and calculate size
							// For now, using placeholder
							plansSize = 0;
							plansCount = 0;
						}
					}
				} catch (error) {
					console.error("Error calculating plans storage:", error);
				}

				// Calculate media directory size
				let mediaSize = 0;
				let mediaCount = 0;
				try {
					const mediaInfo = await FileSystem.getInfoAsync(mediaPath);
					if (mediaInfo.exists && mediaInfo.isDirectory) {
						// TODO: Iterate through files and calculate size
						// For now, using placeholder
						mediaSize = 0;
						mediaCount = 0;
					}
				} catch (error) {
					console.error("Error calculating media storage:", error);
				}

				setStorageInfo({
					totalSize: plansSize + mediaSize,
					plansSize,
					mediaSize,
					plansCount,
					mediaCount,
				});
			} catch (error) {
				console.error("Error calculating storage:", error);
			}
		};

		calculateStorage();
	}, [params.id]);

	const formatBytes = (bytes: number): string => {
		if (bytes === 0) return "0 B";
		const k = 1024;
		const sizes = ["B", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`;
	};

	const handleSaveDetails = () => {
		// TODO: Save project details to LiveStore
		setIsEditingDetails(false);
		Alert.alert("Success", "Project details updated");
	};

	const handleDownloadAllData = () => {
		Alert.alert(
			"Download All Data",
			"This will prepare a download of all project data including plans and media. This feature will be available soon.",
			[{ text: "OK" }],
		);
	};

	const generateShareLink = React.useCallback(async (expiresIn: "never" | "7d" | "30d") => {
		if (!sessionToken) return;
		setShareExpiry(expiresIn);
		setShareLinkState("loading");
		try {
			const response = await fetch(`${BACKEND_URL}/api/projects/${params.id}/share`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${sessionToken}`,
				},
				body: JSON.stringify({ expiresIn }),
			});
			if (!response.ok) throw new Error("Failed to generate share link");
			const data = (await response.json()) as { shareUrl: string };
			setShareUrl(data.shareUrl);
			await Clipboard.setStringAsync(data.shareUrl);
			setShareLinkState("copied");
			setTimeout(() => setShareLinkState("idle"), 2000);
		} catch {
			setShareLinkState("error");
			setTimeout(() => setShareLinkState("idle"), 2000);
		}
	}, [sessionToken, params.id]);

	const handleGenerateShareLink = React.useCallback(() => {
		Alert.alert(
			"Link Expiration",
			"How long should the share link remain active?",
			[
				{ text: "Never expire", onPress: () => generateShareLink("never") },
				{ text: "7 days", onPress: () => generateShareLink("7d") },
				{ text: "30 days", onPress: () => generateShareLink("30d") },
				{ text: "Cancel", style: "cancel" },
			],
		);
	}, [generateShareLink]);

	const handleCopyShareLink = React.useCallback(async () => {
		if (!shareUrl) return;
		await Clipboard.setStringAsync(shareUrl);
		setShareLinkState("copied");
		setTimeout(() => setShareLinkState("idle"), 2000);
	}, [shareUrl]);

	const handleRevokeShareLink = React.useCallback(() => {
		if (!shareUrl || !sessionToken) return;
		const code = shareUrl.split("/share/")[1];
		if (!code) return;
		Alert.alert(
			"Revoke Share Link",
			"This link will stop working. Anyone with it won't be able to view the project.",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Revoke",
					style: "destructive",
					onPress: async () => {
						await fetch(`${BACKEND_URL}/api/share/${code}`, {
							method: "DELETE",
							headers: { Authorization: `Bearer ${sessionToken}` },
						});
						setShareUrl(null);
					},
				},
			],
		);
	}, [shareUrl, sessionToken]);

	const handleNativeShare = React.useCallback(async () => {
		if (!shareUrl) return;
		await Share.share({
			message: `View this construction project on SiteLink: ${shareUrl}`,
			url: shareUrl,
		});
	}, [shareUrl]);

	return (
		<View className="bg-background flex-1">
			<Stack.Screen
				options={{
					title: "Project Settings",
					headerShown: true,
					headerTitleAlign: "center",
				}}
			/>

			<ScrollView
				className="flex-1"
				contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}
				showsVerticalScrollIndicator={false}
			>
				{/* Details Section */}
				<View className="px-4 pt-6">
					<Text className="text-muted-foreground mb-3 text-sm font-semibold tracking-wider uppercase">
						Details
					</Text>
					<View className="bg-card border-border/50 overflow-hidden rounded-2xl border">
						{isEditingDetails ? (
							<View className="gap-4 p-4">
								<View className="gap-2">
									<Text className="text-foreground text-sm font-medium">
										Project Name
									</Text>
									<View className="flex-row items-center gap-2">
										<View className="flex-1">
											<Text className="text-base">{projectName}</Text>
										</View>
										<SettingsItem
											icon={Edit}
											label="Edit"
											onPress={() => {
												// TODO: Open edit modal or navigate to edit screen
												Alert.alert("Edit", "Edit functionality coming soon");
											}}
											className="p-0"
										/>
									</View>
								</View>
								<Separator />
								<View className="gap-2">
									<Text className="text-foreground text-sm font-medium">
										Address
									</Text>
									<View className="flex-row items-center gap-2">
										<View className="flex-1">
											<Text className="text-base">{projectAddress}</Text>
										</View>
										<SettingsItem
											icon={Edit}
											label="Edit"
											onPress={() => {
												// TODO: Open edit modal or navigate to edit screen
												Alert.alert("Edit", "Edit functionality coming soon");
											}}
											className="p-0"
										/>
									</View>
								</View>
								<View className="mt-2 flex-row gap-2">
									<View className="flex-1">
										<SettingsItem
											label="Cancel"
											onPress={() => setIsEditingDetails(false)}
											className="p-0"
										/>
									</View>
									<View className="flex-1">
										<SettingsItem
											label="Save"
											onPress={handleSaveDetails}
											className="p-0"
										/>
									</View>
								</View>
							</View>
						) : (
							<>
								<SettingsItem
									icon={FileText}
									label="Project Name"
									value={projectName}
									onPress={() => setIsEditingDetails(true)}
								/>
								<Separator />
								<SettingsItem
									icon={FileText}
									label="Address"
									value={projectAddress}
									onPress={() => setIsEditingDetails(true)}
								/>
							</>
						)}
					</View>
				</View>

				{/* Storage Section */}
				<View className="px-4 pt-6">
					<Text className="text-muted-foreground mb-3 text-sm font-semibold tracking-wider uppercase">
						Storage
					</Text>
					<View className="bg-card border-border/50 overflow-hidden rounded-2xl border">
						<SettingsItem
							icon={HardDrive}
							label="Total Storage"
							value={formatBytes(storageInfo.totalSize)}
						/>
						<Separator />
						<SettingsItem
							icon={FileText}
							label="Plans"
							value={`${formatBytes(storageInfo.plansSize)} • ${storageInfo.plansCount} files`}
						/>
						<Separator />
						<SettingsItem
							icon={FileText}
							label="Media"
							value={`${formatBytes(storageInfo.mediaSize)} • ${storageInfo.mediaCount} files`}
						/>
						<Separator />
						<SettingsItem
							icon={Download}
							label="Download All Data"
							onPress={handleDownloadAllData}
						/>
					</View>
				</View>

				{/* Notifications Section */}
				<View className="px-4 pt-6">
					<Text className="text-muted-foreground mb-3 text-sm font-semibold tracking-wider uppercase">
						Notifications
					</Text>
					<View className="bg-card border-border/50 overflow-hidden rounded-2xl border">
						<View className="flex-row items-center justify-between px-4 py-4">
							<View className="flex-row items-center gap-3">
								<View className="bg-muted size-8 items-center justify-center rounded-full">
									<Icon as={FileText} className="text-foreground size-4" />
								</View>
								<Text className="text-base font-medium">New Plans</Text>
							</View>
							<Switch
								checked={notifyOnNewPlans}
								onCheckedChange={setNotifyOnNewPlans}
							/>
						</View>
						<Separator />
						<View className="flex-row items-center justify-between px-4 py-4">
							<View className="flex-row items-center gap-3">
								<View className="bg-muted size-8 items-center justify-center rounded-full">
									<Icon as={FileText} className="text-foreground size-4" />
								</View>
								<Text className="text-base font-medium">New Media</Text>
							</View>
							<Switch
								checked={notifyOnNewMedia}
								onCheckedChange={setNotifyOnNewMedia}
							/>
						</View>
						<Separator />
						<View className="flex-row items-center justify-between px-4 py-4">
							<View className="flex-row items-center gap-3">
								<View className="bg-muted size-8 items-center justify-center rounded-full">
									<Icon as={Bell} className="text-foreground size-4" />
								</View>
								<Text className="text-base font-medium">Comments</Text>
							</View>
							<Switch
								checked={notifyOnComments}
								onCheckedChange={setNotifyOnComments}
							/>
						</View>
					</View>
				</View>

				{/* Sharing Section */}
				<View className="px-4 pt-6">
					<Text className="text-muted-foreground mb-3 text-sm font-semibold tracking-wider uppercase">
						Sharing
					</Text>
					<View className="bg-card border-border/50 overflow-hidden rounded-2xl border">
						{shareUrl ? (
							<>
								<View className="gap-1 px-4 py-3">
									<Text className="text-muted-foreground text-xs">
									{"Share link active"}
									{shareExpiry !== "never"
										? ` · expires in ${shareExpiry === "7d" ? "7 days" : "30 days"}`
										: " · never expires"}
								</Text>
									<Text className="text-foreground text-sm" numberOfLines={1} ellipsizeMode="middle">
										{shareUrl}
									</Text>
								</View>
								<Separator />
								<SettingsItem
									icon={Share2}
									label="Share via…"
									onPress={handleNativeShare}
								/>
								<Separator />
								<SettingsItem
									icon={Link}
									label={shareLinkState === "copied" ? "Copied!" : "Copy Link"}
									onPress={handleCopyShareLink}
								/>
								<Separator />
								<SettingsItem
									icon={Trash2}
									label="Revoke Link"
									onPress={handleRevokeShareLink}
								/>
							</>
						) : (
							<SettingsItem
								icon={Share2}
								label={
									shareLinkState === "loading"
										? "Generating…"
										: shareLinkState === "error"
											? "Failed — Tap to retry"
											: "Share Project"
								}
								onPress={handleGenerateShareLink}
							/>
						)}
					</View>
				</View>

				{/* Members Section */}
				<View className="px-4 pt-6">
					<Text className="text-muted-foreground mb-3 text-sm font-semibold tracking-wider uppercase">
						Team
					</Text>
					<View className="bg-card border-border/50 overflow-hidden rounded-2xl border">
						<SettingsItem
							icon={Users}
							label="Team Members"
							onPress={() =>
								router.push(`/project/${params.id}/members` as any)
							}
						/>
					</View>
				</View>
			</ScrollView>
		</View>
	);
}
