import type { Meta, StoryObj } from "@storybook/react";
import {
	Bug,
	ChevronRight,
	FileText,
	HelpCircle,
	Mail,
	MessageCircle,
	Search,
	Shield,
	Upload,
	Wifi,
} from "lucide-react-native";
import * as React from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { StoryHeader, StoryToast } from "@/app/_story-components";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

const TOPICS = [
	{ id: "1", icon: Upload, label: "Uploading plans", desc: "PDF formats, file size limits, processing times" },
	{ id: "2", icon: Wifi, label: "Offline mode", desc: "Working without internet, sync queue" },
	{ id: "3", icon: FileText, label: "Plan navigation", desc: "Zooming, markers, sheet switching" },
	{ id: "4", icon: Shield, label: "Permissions & roles", desc: "Owner, Admin, Member, Viewer access" },
	{ id: "5", icon: HelpCircle, label: "Account & billing", desc: "Subscription, trials, invoices" },
];

const CONTACT_OPTIONS = [
	{ id: "chat", icon: MessageCircle, label: "Live Chat", desc: "Typically replies in under 5 minutes", color: "#22c55e" },
	{ id: "email", icon: Mail, label: "Email Support", desc: "Response within 24 hours", color: "#3b82f6" },
	{ id: "bug", icon: Bug, label: "Report a Bug", desc: "Include screenshots and steps to reproduce", color: "#f59e0b" },
];

type FlowScreen = "home" | "contact";

function HelpSupportFlow({ initialScreen = "home" as FlowScreen }) {
	const [screen, setScreen] = React.useState<FlowScreen>(initialScreen);
	const [searchQuery, setSearchQuery] = React.useState("");
	const [toastMsg, setToastMsg] = React.useState("");

	const filteredTopics = React.useMemo(() => {
		if (!searchQuery) return TOPICS;
		return TOPICS.filter(
			(t) =>
				t.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
				t.desc.toLowerCase().includes(searchQuery.toLowerCase()),
		);
	}, [searchQuery]);

	if (screen === "contact") {
		return (
			<View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
				<StoryHeader title="Contact Support" onBack={() => setScreen("home")} />
				<ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
					<View className="px-4 pt-6 pb-2">
						<Text className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
							Get in touch
						</Text>
					</View>
					{CONTACT_OPTIONS.map((option) => (
						<Pressable
							key={option.id}
							onPress={() => setToastMsg(`Opening ${option.label}...`)}
							className="active:bg-muted/30 flex-row items-center gap-4 px-4 py-4"
						>
							<View
								className="items-center justify-center rounded-full"
								style={{ width: 44, height: 44, backgroundColor: option.color + "18" }}
							>
								<Icon as={option.icon} style={{ color: option.color }} className="size-5" />
							</View>
							<View className="flex-1">
								<Text className="text-foreground text-base font-semibold">{option.label}</Text>
								<Text className="text-muted-foreground text-sm">{option.desc}</Text>
							</View>
							<Icon as={ChevronRight} className="text-muted-foreground size-5" />
						</Pressable>
					))}

					<View className="px-4 pt-8">
						<Text className="text-muted-foreground text-center text-xs leading-relaxed">
							Support hours: Mon{"\u2013"}Fri, 8 AM{"\u2013"}6 PM EST
						</Text>
					</View>
				</ScrollView>
				<StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
			</View>
		);
	}

	return (
		<View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
			<StoryHeader title="Help & Support" />
			<ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
				<View className="px-4 pt-4 pb-2">
					<View
						className="flex-row items-center rounded-xl px-3"
						style={{ height: 44, backgroundColor: "rgba(255,255,255,0.06)" }}
					>
						<Icon as={Search} className="text-muted-foreground mr-2.5 size-4" />
						<TextInput
							placeholder="Search help topics..."
							placeholderTextColor="rgba(255,255,255,0.35)"
							value={searchQuery}
							onChangeText={setSearchQuery}
							style={{ flex: 1, color: "#fff", fontSize: 15 }}
						/>
					</View>
				</View>

				<View className="px-4 pt-5 pb-2">
					<Text className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
						Popular topics
					</Text>
				</View>

				{filteredTopics.map((topic) => (
					<Pressable
						key={topic.id}
						onPress={() => setToastMsg(`Opening: ${topic.label}`)}
						className="active:bg-muted/30 flex-row items-center gap-4 px-4 py-4"
					>
						<View
							className="items-center justify-center rounded-full"
							style={{ width: 40, height: 40, backgroundColor: "rgba(255,255,255,0.06)" }}
						>
							<Icon as={topic.icon} className="text-muted-foreground size-5" />
						</View>
						<View className="flex-1">
							<Text className="text-foreground text-base font-medium">{topic.label}</Text>
							<Text className="text-muted-foreground text-sm">{topic.desc}</Text>
						</View>
						<Icon as={ChevronRight} className="text-muted-foreground size-5" />
					</Pressable>
				))}

				{filteredTopics.length === 0 && (
					<View className="items-center px-4 pt-12">
						<Text className="text-muted-foreground text-sm">No matching topics found.</Text>
					</View>
				)}

				<View className="px-4 pt-8 pb-2">
					<Text className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
						Need more help?
					</Text>
				</View>
				<Pressable
					onPress={() => setScreen("contact")}
					className="active:bg-muted/30 flex-row items-center gap-4 px-4 py-4"
				>
					<View
						className="items-center justify-center rounded-full"
						style={{ width: 40, height: 40, backgroundColor: "rgba(59,130,246,0.15)" }}
					>
						<Icon as={MessageCircle} style={{ color: "#3b82f6" }} className="size-5" />
					</View>
					<View className="flex-1">
						<Text className="text-foreground text-base font-semibold">Contact Support</Text>
						<Text className="text-muted-foreground text-sm">Chat, email, or report a bug</Text>
					</View>
					<Icon as={ChevronRight} className="text-muted-foreground size-5" />
				</Pressable>
			</ScrollView>
			<StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
		</View>
	);
}

const meta: Meta<typeof HelpSupportFlow> = {
	title: "Flows/Help & Support",
	component: HelpSupportFlow,
	parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof HelpSupportFlow>;

export const HelpHome: Story = {
	name: "1. Help Home",
	args: { initialScreen: "home" },
};

export const ContactSupport: Story = {
	name: "2. Contact Support",
	args: { initialScreen: "contact" },
};

export const FullFlow: Story = {
	name: "Full Flow",
	args: { initialScreen: "home" },
};
