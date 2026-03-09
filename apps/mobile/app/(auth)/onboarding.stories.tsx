import type { Meta, StoryObj } from "@storybook/react";
import {
	ArrowRight,
	Camera,
	Check,
	FileText,
	MapPin,
	Mic,
	Search,
	Shield,
	Sparkles,
	Zap,
} from "lucide-react-native";
import * as React from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

function WelcomeScreen({ onGetStarted }: { onGetStarted: () => void }) {
	return (
		<View className="bg-background flex-1 justify-between px-6 py-12">
			<View className="flex-1 items-center justify-center gap-8">
				<View className="items-center gap-4">
					<View className="bg-primary/10 size-24 items-center justify-center rounded-3xl">
						<Icon as={MapPin} className="text-primary size-12" />
					</View>
					<View className="flex-row items-baseline gap-1.5">
						<Text className="text-foreground text-4xl font-black tracking-tight">
							Site
						</Text>
						<Text className="text-primary text-4xl font-black tracking-tight">
							Link
						</Text>
					</View>
					<Text className="text-muted-foreground text-sm tracking-widest uppercase">
						Construction Plan Intelligence
					</Text>
				</View>

				<View className="w-full gap-4 pt-4">
					{[
						{
							icon: Zap,
							title: "Auto-Linked Callouts",
							desc: "Tap any callout marker to jump directly to referenced details",
							color: "#3b82f6",
						},
						{
							icon: Camera,
							title: "Photo Documentation",
							desc: "Photos auto-linked to plan locations with voice notes",
							color: "#22c55e",
						},
						{
							icon: Sparkles,
							title: "AI-Extracted Schedules",
							desc: "Schedules, notes, and legends extracted automatically",
							color: "#a855f7",
						},
						{
							icon: Shield,
							title: "Works Offline",
							desc: "Full plan access on site, even without cell service",
							color: "#f59e0b",
						},
					].map((item) => (
						<View
							key={item.title}
							className="flex-row items-center gap-4 rounded-xl px-4 py-3"
							style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
						>
							<View
								className="size-10 items-center justify-center rounded-xl"
								style={{ backgroundColor: item.color + "18" }}
							>
								<Icon
									as={item.icon}
									style={{ color: item.color }}
									className="size-5"
								/>
							</View>
							<View className="flex-1">
								<Text className="text-foreground text-sm font-bold">
									{item.title}
								</Text>
								<Text className="text-muted-foreground text-xs leading-relaxed">
									{item.desc}
								</Text>
							</View>
						</View>
					))}
				</View>
			</View>

			<View className="gap-4 pt-8">
				<Button onPress={onGetStarted}>
					<View className="flex-row items-center gap-2">
						<Text className="text-primary-foreground font-bold">
							Get Started
						</Text>
						<Icon
							as={ArrowRight}
							className="text-primary-foreground size-4"
						/>
					</View>
				</Button>
				<Text className="text-muted-foreground text-center text-xs">
					No credit card required
				</Text>
			</View>
		</View>
	);
}

function TrialStartScreen({
	onCreateProject,
}: {
	onCreateProject: () => void;
}) {
	return (
		<ScrollView
			className="bg-background flex-1"
			contentContainerClassName="px-6 py-12"
		>
			<View className="items-center gap-2">
				<View className="bg-primary/10 size-16 items-center justify-center rounded-2xl">
					<Icon as={MapPin} className="text-primary size-8" />
				</View>
				<View className="flex-row items-baseline gap-1">
					<Text className="text-foreground text-2xl font-black tracking-tight">
						Site
					</Text>
					<Text className="text-primary text-2xl font-black tracking-tight">
						Link
					</Text>
				</View>
			</View>

			<View className="mt-8 items-center gap-2">
				<View className="bg-primary/15 rounded-full px-4 py-1.5">
					<Text className="text-primary text-xs font-bold uppercase tracking-wider">
						Pro Trial Active
					</Text>
				</View>
				<Text className="text-foreground text-2xl font-bold">
					14 Days Free
				</Text>
				<Text className="text-muted-foreground text-center text-sm leading-relaxed">
					Full Pro features, no credit card required.{"\n"}Downgrade
					to Starter anytime.
				</Text>
			</View>

			<View
				className="mt-8 gap-0 overflow-hidden rounded-2xl"
				style={{
					backgroundColor: "rgba(255,255,255,0.04)",
					borderWidth: 1,
					borderColor: "rgba(255,255,255,0.08)",
				}}
			>
				<View className="border-b px-5 py-4" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
					<Text className="text-foreground text-sm font-bold">
						What&apos;s included:
					</Text>
				</View>
				{[
					{ label: "5 projects", icon: FileText },
					{ label: "15 team members", icon: MapPin },
					{ label: "Unlimited sheets", icon: FileText },
					{ label: "Auto callout detection (96% accuracy)", icon: Zap },
					{ label: "Voice notes + transcription", icon: Mic },
					{ label: "Plan text search", icon: Search },
					{ label: "AI daily summaries", icon: Sparkles },
					{ label: "Offline access", icon: Shield },
				].map((item) => (
					<View
						key={item.label}
						className="flex-row items-center gap-3 border-b px-5 py-3"
						style={{ borderColor: "rgba(255,255,255,0.04)" }}
					>
						<Icon as={Check} className="text-primary size-4" />
						<Text className="text-foreground text-sm">
							{item.label}
						</Text>
					</View>
				))}
			</View>

			<View className="mt-8 gap-4">
				<Button onPress={onCreateProject}>
					<View className="flex-row items-center gap-2">
						<Text className="text-primary-foreground font-bold">
							Create First Project
						</Text>
						<Icon
							as={ArrowRight}
							className="text-primary-foreground size-4"
						/>
					</View>
				</Button>
				<Pressable>
					<Text className="text-muted-foreground text-center text-sm underline">
						Skip for now
					</Text>
				</Pressable>
			</View>

			<View className="mt-8 items-center gap-1 pb-4">
				<Text className="text-muted-foreground text-center text-xs">
					After trial: Starter ($29/mo) or Pro ($79/mo)
				</Text>
				<Text className="text-muted-foreground text-center text-xs">
					Projects become read-only if you don&apos;t subscribe
				</Text>
			</View>
		</ScrollView>
	);
}

function OnboardingFlow() {
	const [step, setStep] = React.useState<"welcome" | "trial">("welcome");

	if (step === "trial") {
		return <TrialStartScreen onCreateProject={() => setStep("welcome")} />;
	}

	return <WelcomeScreen onGetStarted={() => setStep("trial")} />;
}

const meta: Meta<typeof OnboardingFlow> = {
	title: "Screens/Onboarding",
	component: OnboardingFlow,
	parameters: {
		layout: "fullscreen",
	},
};

export default meta;
type Story = StoryObj<typeof OnboardingFlow>;

export const Welcome: Story = {
	render: () => <WelcomeScreen onGetStarted={() => {}} />,
};

export const TrialStart: Story = {
	render: () => <TrialStartScreen onCreateProject={() => {}} />,
};

export const Flow: Story = {};
