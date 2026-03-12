import type { Meta, StoryObj } from "@storybook/react";
import {
	Bell,
	Camera,
	ChevronRight,
	CreditCard,
	Download,
	HardDrive,
	Shield,
} from "lucide-react-native";
import * as React from "react";
import { Pressable, ScrollView, View } from "react-native";
import { StoryHeader, StoryToast } from "@/app/_story-components";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";

type FlowScreen = "profile" | "notifications" | "offline" | "subscription";

function SettingsFlow({ initialScreen = "profile" as FlowScreen }: { initialScreen?: FlowScreen }) {
	const [screen, setScreen] = React.useState<FlowScreen>(initialScreen);
	const [saved, setSaved] = React.useState(false);
	const [toastMsg, setToastMsg] = React.useState("");

	const [notifyPlans, setNotifyPlans] = React.useState(true);
	const [notifyMedia, setNotifyMedia] = React.useState(true);
	const [notifyIssues, setNotifyIssues] = React.useState(true);
	const [notifyComments, setNotifyComments] = React.useState(false);

	const [offlineEnabled, setOfflineEnabled] = React.useState(true);
	const [offlinePhotos, setOfflinePhotos] = React.useState(true);

	if (screen === "notifications") {
		return (
			<View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
				<StoryHeader title="Notification Preferences" onBack={() => setScreen("profile")} />
				<ScrollView className="flex-1" contentContainerClassName="px-4 pb-12">
					<View className="pt-6">
						<Text className="text-muted-foreground mb-3 text-sm font-semibold tracking-wider uppercase">Push Notifications</Text>
						<View className="bg-card border-border/50 overflow-hidden rounded-2xl border">
							{[
								{ label: "New Plans", desc: "When plans are uploaded or processed", value: notifyPlans, onChange: setNotifyPlans },
								{ label: "New Media", desc: "When photos or recordings are added", value: notifyMedia, onChange: setNotifyMedia },
								{ label: "Issues Flagged", desc: "When team members flag issues", value: notifyIssues, onChange: setNotifyIssues },
								{ label: "Comments", desc: "When someone comments on your items", value: notifyComments, onChange: setNotifyComments },
							].map((item, i) => (
								<React.Fragment key={item.label}>
									{i > 0 && <Separator />}
									<View className="flex-row items-center justify-between px-4 py-4">
										<View className="flex-1 pr-4">
											<Text className="text-foreground text-base font-medium">{item.label}</Text>
											<Text className="text-muted-foreground text-sm">{item.desc}</Text>
										</View>
										<Switch checked={item.value} onCheckedChange={item.onChange} />
									</View>
								</React.Fragment>
							))}
						</View>
					</View>
				</ScrollView>
			</View>
		);
	}

	if (screen === "offline") {
		return (
			<View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
				<StoryHeader title="Offline Downloads" onBack={() => setScreen("profile")} />
				<ScrollView className="flex-1" contentContainerClassName="px-4 pb-12">
					<View className="pt-6">
						<View className="bg-card border-border/50 overflow-hidden rounded-2xl border">
							<View className="flex-row items-center justify-between px-4 py-4">
								<View className="flex-row items-center gap-3">
									<View className="bg-muted size-8 items-center justify-center rounded-full">
										<Icon as={Download} className="text-foreground size-4" />
									</View>
									<View>
										<Text className="text-foreground text-base font-medium">Auto-Download Plans</Text>
										<Text className="text-muted-foreground text-sm">Download new plans over WiFi</Text>
									</View>
								</View>
								<Switch checked={offlineEnabled} onCheckedChange={setOfflineEnabled} />
							</View>
							<Separator />
							<View className="flex-row items-center justify-between px-4 py-4">
								<View className="flex-row items-center gap-3">
									<View className="bg-muted size-8 items-center justify-center rounded-full">
										<Icon as={Camera} className="text-foreground size-4" />
									</View>
									<View>
										<Text className="text-foreground text-base font-medium">Offline Photos</Text>
										<Text className="text-muted-foreground text-sm">Cache recent photos locally</Text>
									</View>
								</View>
								<Switch checked={offlinePhotos} onCheckedChange={setOfflinePhotos} />
							</View>
						</View>
					</View>
					<View className="pt-6">
						<Text className="text-muted-foreground mb-3 text-sm font-semibold tracking-wider uppercase">Storage</Text>
						<View className="bg-card border-border/50 overflow-hidden rounded-2xl border">
							<View className="flex-row items-center justify-between px-4 py-4">
								<View className="flex-row items-center gap-3">
									<View className="bg-muted size-8 items-center justify-center rounded-full">
										<Icon as={HardDrive} className="text-foreground size-4" />
									</View>
									<Text className="text-foreground text-base font-medium">Cached Data</Text>
								</View>
								<Text className="text-muted-foreground text-sm">245.3 MB</Text>
							</View>
						</View>
						<Button variant="secondary" className="mt-4 h-12 rounded-xl" onPress={() => setToastMsg("Cache cleared")}>
							<Text className="text-secondary-foreground text-base font-semibold">Clear Cache</Text>
						</Button>
					</View>
				</ScrollView>
				<StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
			</View>
		);
	}

	return (
		<View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
			<StoryHeader title="Profile" />
			<ScrollView className="flex-1" contentContainerClassName="px-6 pb-12" showsVerticalScrollIndicator={false}>
				<View className="items-center pt-4 pb-8">
					<View className="relative">
						<View className="bg-primary/10 border-background size-24 items-center justify-center rounded-full border-4">
							<Text className="text-primary text-3xl font-bold">JS</Text>
						</View>
						<View className="bg-secondary border-background absolute right-0 bottom-0 rounded-full border-4 p-2">
							<Icon as={Camera} className="text-secondary-foreground size-4" />
						</View>
					</View>
				</View>
				<View className="gap-6">
					<View className="gap-2">
						<Label nativeID="settingsName">Full Name</Label>
						<Input nativeID="settingsName" className="h-12 rounded-xl" defaultValue="John Smith" />
					</View>
					<View className="gap-2">
						<Label nativeID="settingsEmail">Email</Label>
						<Input nativeID="settingsEmail" className="h-12 rounded-xl opacity-50" defaultValue="john@sitelink.com" editable={false} />
						<Text className="text-muted-foreground px-1 text-xs">Email cannot be changed.</Text>
					</View>
					<View className="gap-2">
						<Label nativeID="settingsCompany">Company</Label>
						<Input nativeID="settingsCompany" className="h-12 rounded-xl" defaultValue="Smith Electrical LLC" />
					</View>

					<Separator />

					<Pressable onPress={() => setScreen("subscription")} className="active:bg-muted/30 flex-row items-center justify-between py-2">
						<View className="flex-row items-center gap-3">
							<View className="bg-muted size-10 items-center justify-center rounded-full"><Icon as={CreditCard} className="text-foreground size-5" /></View>
							<View>
								<Text className="text-foreground text-base font-medium">Subscription</Text>
								<Text className="text-muted-foreground text-sm">Pro Trial · 12 days left</Text>
							</View>
						</View>
						<Icon as={ChevronRight} className="text-muted-foreground size-5" />
					</Pressable>

					<Pressable onPress={() => setScreen("notifications")} className="active:bg-muted/30 flex-row items-center justify-between py-2">
						<View className="flex-row items-center gap-3">
							<View className="bg-muted size-10 items-center justify-center rounded-full"><Icon as={Bell} className="text-foreground size-5" /></View>
							<View>
								<Text className="text-foreground text-base font-medium">Notifications</Text>
								<Text className="text-muted-foreground text-sm">Push notification preferences</Text>
							</View>
						</View>
						<Icon as={ChevronRight} className="text-muted-foreground size-5" />
					</Pressable>

					<Pressable onPress={() => setScreen("offline")} className="active:bg-muted/30 flex-row items-center justify-between py-2">
						<View className="flex-row items-center gap-3">
							<View className="bg-muted size-10 items-center justify-center rounded-full"><Icon as={Download} className="text-foreground size-5" /></View>
							<View>
								<Text className="text-foreground text-base font-medium">Offline Downloads</Text>
								<Text className="text-muted-foreground text-sm">Manage cached data</Text>
							</View>
						</View>
						<Icon as={ChevronRight} className="text-muted-foreground size-5" />
					</Pressable>

					<View className="mt-2">
						<Button className="h-12 rounded-xl" onPress={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}>
							<Text className="text-primary-foreground text-base font-semibold">{saved ? "Saved!" : "Save Changes"}</Text>
						</Button>
					</View>
				</View>
			</ScrollView>
		</View>
	);
}

const meta: Meta<typeof SettingsFlow> = {
	title: "Flows/11. Settings",
	component: SettingsFlow,
	parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof SettingsFlow>;

export const Profile: Story = { name: "1. Profile", args: { initialScreen: "profile" } };
export const NotificationPrefs: Story = { name: "2. Notification Preferences", args: { initialScreen: "notifications" } };
export const OfflineDownloads: Story = { name: "3. Offline Downloads", args: { initialScreen: "offline" } };
export const FullFlow: Story = { name: "Full Flow", args: { initialScreen: "profile" } };
