import type { Meta, StoryObj } from "@storybook/react";
import {
	ChevronUp,
	Lightbulb,
	Send,
} from "lucide-react-native";
import * as React from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { StoryHeader, StoryToast } from "@/app/_story-components";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

const CATEGORIES = ["Plans", "Photos", "Schedules", "Offline", "Team", "Other"];

const POPULAR_REQUESTS = [
	{ id: "1", title: "Markup annotations on plans", category: "Plans", votes: 142, voted: false },
	{ id: "2", title: "Export photos with GPS metadata", category: "Photos", votes: 98, voted: true },
	{ id: "3", title: "Compare plan revisions side-by-side", category: "Plans", votes: 87, voted: false },
	{ id: "4", title: "Dark mode for plan viewer", category: "Plans", votes: 73, voted: false },
	{ id: "5", title: "Offline schedule editing", category: "Offline", votes: 65, voted: false },
	{ id: "6", title: "Time-lapse from daily photos", category: "Photos", votes: 51, voted: false },
	{ id: "7", title: "Custom notification filters", category: "Team", votes: 44, voted: false },
];

type FlowScreen = "submit" | "popular";

function FeatureRequestFlow({ initialScreen = "submit" as FlowScreen }) {
	const [screen, setScreen] = React.useState<FlowScreen>(initialScreen);
	const [description, setDescription] = React.useState("");
	const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);
	const [toastMsg, setToastMsg] = React.useState("");
	const [requests, setRequests] = React.useState(POPULAR_REQUESTS.map((r) => ({ ...r })));

	const handleSubmit = () => {
		if (!description.trim()) return;
		setToastMsg("Request submitted — thank you!");
		setDescription("");
		setSelectedCategory(null);
	};

	const handleVote = (id: string) => {
		setRequests((prev) =>
			prev.map((r) => {
				if (r.id !== id) return r;
				return {
					...r,
					voted: !r.voted,
					votes: r.voted ? r.votes - 1 : r.votes + 1,
				};
			}).sort((a, b) => b.votes - a.votes),
		);
	};

	if (screen === "popular") {
		return (
			<View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
				<StoryHeader title="Popular Requests" onBack={() => setScreen("submit")} />
				<ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
					<View className="px-4 pt-4 pb-2">
						<Text className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
							Sorted by votes
						</Text>
					</View>
					{requests.map((req, idx) => (
						<View
							key={req.id}
							className="flex-row items-center gap-4 px-4 py-4"
						>
							<Text className="text-muted-foreground w-6 text-center text-sm font-bold">
								{idx + 1}
							</Text>
							<View className="flex-1">
								<Text className="text-foreground text-base font-medium">{req.title}</Text>
								<Text className="text-muted-foreground text-sm">{req.category}</Text>
							</View>
							<Pressable
								onPress={() => handleVote(req.id)}
								className="items-center"
								style={{ width: 48 }}
							>
								<Icon
									as={ChevronUp}
									style={{ color: req.voted ? "#3b82f6" : "rgba(255,255,255,0.4)" }}
									className="size-5"
								/>
								<Text
									style={{
										color: req.voted ? "#3b82f6" : "rgba(255,255,255,0.6)",
										fontSize: 13,
										fontWeight: "700",
									}}
								>
									{req.votes}
								</Text>
							</Pressable>
						</View>
					))}
				</ScrollView>
				<StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
			</View>
		);
	}

	return (
		<View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
			<StoryHeader title="Feature Request" />
			<ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
				<View className="px-4 pt-6">
					<View className="mb-6 flex-row items-center gap-3">
						<View
							className="items-center justify-center rounded-full"
							style={{ width: 44, height: 44, backgroundColor: "rgba(168,85,247,0.15)" }}
						>
							<Icon as={Lightbulb} style={{ color: "#a855f7" }} className="size-5" />
						</View>
						<View className="flex-1">
							<Text className="text-foreground text-lg font-bold">Share your idea</Text>
							<Text className="text-muted-foreground text-sm">Help us build what matters to you</Text>
						</View>
					</View>

					<View className="mb-2">
						<Text className="text-muted-foreground mb-3 text-xs font-bold tracking-wider uppercase">
							Category
						</Text>
						<View className="flex-row flex-wrap gap-2">
							{CATEGORIES.map((cat) => (
								<Pressable
									key={cat}
									onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
									className="rounded-full px-4 py-2"
									style={{
										backgroundColor:
											selectedCategory === cat
												? "rgba(168,85,247,0.2)"
												: "rgba(255,255,255,0.06)",
										borderWidth: 1,
										borderColor:
											selectedCategory === cat
												? "rgba(168,85,247,0.4)"
												: "transparent",
									}}
								>
									<Text
										style={{
											color: selectedCategory === cat ? "#a855f7" : "rgba(255,255,255,0.6)",
											fontSize: 14,
											fontWeight: "600",
										}}
									>
										{cat}
									</Text>
								</Pressable>
							))}
						</View>
					</View>

					<View className="mt-5">
						<Text className="text-muted-foreground mb-3 text-xs font-bold tracking-wider uppercase">
							Description
						</Text>
						<View
							className="rounded-xl"
							style={{
								backgroundColor: "rgba(255,255,255,0.06)",
								minHeight: 140,
								padding: 14,
							}}
						>
							<TextInput
								placeholder="Describe the feature you'd like to see..."
								placeholderTextColor="rgba(255,255,255,0.3)"
								value={description}
								onChangeText={setDescription}
								multiline
								textAlignVertical="top"
								style={{ color: "#fff", fontSize: 15, minHeight: 110 }}
							/>
						</View>
					</View>

					<View className="mt-6">
						<Button
							onPress={handleSubmit}
							disabled={!description.trim()}
							className="h-12 rounded-xl"
						>
							<Icon as={Send} className="text-primary-foreground mr-2 size-4" />
							<Text className="text-primary-foreground text-base font-semibold">
								Submit Request
							</Text>
						</Button>
					</View>

					<Pressable
						onPress={() => setScreen("popular")}
						className="mt-6 items-center py-3"
					>
						<Text className="text-primary text-sm font-semibold">
							View Popular Requests
						</Text>
					</Pressable>
				</View>
			</ScrollView>
			<StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
		</View>
	);
}

const meta: Meta<typeof FeatureRequestFlow> = {
	title: "Flows/Feature Requests",
	component: FeatureRequestFlow,
	parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof FeatureRequestFlow>;

export const SubmitRequest: Story = {
	name: "1. Submit Request",
	args: { initialScreen: "submit" },
};

export const PopularRequests: Story = {
	name: "2. Popular Requests",
	args: { initialScreen: "popular" },
};

export const FullFlow: Story = {
	name: "Full Flow",
	args: { initialScreen: "submit" },
};
