import type { Meta, StoryObj } from "@storybook/react";
import {
	AlertTriangle,
	Check,
	Crown,
	X,
} from "lucide-react-native";
import * as React from "react";
import { Pressable, ScrollView, View } from "react-native";
import { StoryHeader, StoryToast } from "@/app/_story-components";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

const TIERS = [
	{
		name: "Starter", price: 29, desc: "For individuals getting started",
		features: ["1 project", "3 team members", "500 sheets", "Plan viewing + callout linking", "Photo capture + timeline", "Voice notes (audio only)", "Share view-only links", "Offline downloads"],
		excluded: ["Voice transcription", "Plan text search", "Photo OCR extraction", "AI daily summaries", "RFI draft generation", "API access"],
		color: "#6b7280",
	},
	{
		name: "Pro", price: 79, desc: "For small teams — best value", popular: true,
		features: ["5 projects", "15 team members", "Unlimited sheets", "Everything in Starter, plus:", "Voice transcription", "Plan text search", "Photo OCR extraction", "AI daily summaries"],
		excluded: ["RFI draft generation", "API access"],
		color: "#3b82f6",
	},
	{
		name: "Business", price: 149, desc: "For growing companies",
		features: ["Unlimited projects", "Unlimited team members", "Unlimited sheets", "Everything in Pro, plus:", "RFI draft generation", "API access", "Priority support"],
		excluded: [],
		color: "#a855f7",
	},
];

type FlowPhase = "trial-banner" | "plans" | "checkout" | "success" | "expired";

function TrialBanner({ onUpgrade }: { onUpgrade: () => void }) {
	return (
		<View className="bg-background flex-1 items-center justify-center" style={{ minHeight: "100vh" } as any}>
			<View className="items-center gap-4 px-8">
				<View className="items-center rounded-2xl px-6 py-5" style={{ backgroundColor: "rgba(59,130,246,0.08)", borderWidth: 1, borderColor: "rgba(59,130,246,0.2)" }}>
					<View className="flex-row items-center gap-2">
						<Icon as={Crown} className="size-4" style={{ color: "#3b82f6" }} />
						<Text className="text-sm font-bold" style={{ color: "#3b82f6" }}>Pro Trial</Text>
					</View>
					<Text className="text-foreground mt-1 text-lg font-bold">3 days remaining</Text>
					<Text className="text-muted-foreground mt-0.5 text-xs">Full Pro features, no credit card on file</Text>
				</View>
				<Button className="h-12 w-full rounded-xl" onPress={onUpgrade}>
					<Text className="text-primary-foreground text-base font-semibold">View Plans</Text>
				</Button>
			</View>
		</View>
	);
}

function PlansView({ onSelect }: { onSelect: (tier: string) => void }) {
	const [selectedTier, setSelectedTier] = React.useState("Pro");

	return (
		<View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
			<StoryHeader title="Subscription" />
			<ScrollView contentContainerClassName="px-4 pb-8">
				<View className="mb-6 items-center rounded-2xl px-5 py-4" style={{ backgroundColor: "rgba(59,130,246,0.08)", borderWidth: 1, borderColor: "rgba(59,130,246,0.2)" }}>
					<View className="flex-row items-center gap-2">
						<Icon as={Crown} className="size-4" style={{ color: "#3b82f6" }} />
						<Text className="text-sm font-bold" style={{ color: "#3b82f6" }}>Pro Trial</Text>
					</View>
					<Text className="text-foreground mt-1 text-lg font-bold">3 days remaining</Text>
					<Text className="text-muted-foreground mt-0.5 text-xs">Full Pro features, no credit card on file</Text>
				</View>
				<View className="gap-4">
					{TIERS.map((tier) => {
						const isSelected = selectedTier === tier.name;
						return (
							<Pressable key={tier.name} onPress={() => setSelectedTier(tier.name)} className="overflow-hidden rounded-2xl" style={{ backgroundColor: isSelected ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)", borderWidth: isSelected ? 2 : 1, borderColor: isSelected ? tier.color : "rgba(255,255,255,0.08)" }}>
								{tier.popular && <View className="items-center py-1.5" style={{ backgroundColor: tier.color }}><Text className="text-xs font-bold text-white">MOST POPULAR</Text></View>}
								<View className="p-5">
									<View className="flex-row items-baseline justify-between">
										<View>
											<Text className="text-lg font-bold" style={{ color: tier.color }}>{tier.name}</Text>
											<Text className="text-muted-foreground text-xs">{tier.desc}</Text>
										</View>
										<View className="items-end">
											<View className="flex-row items-baseline">
												<Text className="text-foreground text-3xl font-black">${tier.price}</Text>
												<Text className="text-muted-foreground text-sm">/mo</Text>
											</View>
											<Text className="text-muted-foreground text-xs">flat rate</Text>
										</View>
									</View>
									<View className="mt-4 gap-2.5">
										{tier.features.map((f) => (
											<View key={f} className="flex-row items-center gap-2.5">
												<Icon as={Check} className="size-3.5" style={{ color: tier.color }} />
												<Text className="text-foreground text-sm">{f}</Text>
											</View>
										))}
										{tier.excluded.map((f) => (
											<View key={f} className="flex-row items-center gap-2.5 opacity-40">
												<Icon as={X} className="text-muted-foreground size-3.5" />
												<Text className="text-muted-foreground text-sm line-through">{f}</Text>
											</View>
										))}
									</View>
								</View>
							</Pressable>
						);
					})}
				</View>
				<View className="mt-6 gap-3">
					<Button onPress={() => onSelect(selectedTier)}>
						<Text className="text-primary-foreground font-bold">Subscribe to {selectedTier} — ${TIERS.find((t) => t.name === selectedTier)?.price}/mo</Text>
					</Button>
					<Text className="text-muted-foreground text-center text-xs leading-relaxed">Cancel anytime. Projects become read-only after 30 days without an active subscription.</Text>
				</View>
			</ScrollView>
		</View>
	);
}

function SuccessView() {
	return (
		<View className="bg-background flex-1 items-center justify-center" style={{ minHeight: "100vh" } as any}>
			<View className="items-center gap-4 px-8">
				<View className="items-center justify-center rounded-full" style={{ width: 80, height: 80, backgroundColor: "rgba(34,197,94,0.12)" }}>
					<Icon as={Check} className="size-10" style={{ color: "#22c55e" }} />
				</View>
				<Text className="text-foreground text-xl font-bold">Subscription Active</Text>
				<Text className="text-muted-foreground text-center text-sm leading-relaxed">Welcome to Pro! All features are now unlocked.</Text>
			</View>
		</View>
	);
}

function ExpiredView({ onUpgrade }: { onUpgrade: () => void }) {
	return (
		<View className="bg-background flex-1 items-center justify-center" style={{ minHeight: "100vh" } as any}>
			<View className="items-center gap-4 px-8">
				<View className="items-center justify-center rounded-full" style={{ width: 80, height: 80, backgroundColor: "rgba(239,68,68,0.12)" }}>
					<Icon as={AlertTriangle} className="size-10" style={{ color: "#ef4444" }} />
				</View>
				<Text className="text-foreground text-xl font-bold">Trial Expired</Text>
				<Text className="text-muted-foreground text-center text-sm leading-relaxed">Your Pro trial has ended. Subscribe to keep using all features.</Text>
				<Button className="mt-2 h-12 w-full rounded-xl" onPress={onUpgrade}>
					<Text className="text-primary-foreground text-base font-semibold">View Plans</Text>
				</Button>
			</View>
		</View>
	);
}

function SubscriptionFlow({ initialPhase = "trial-banner" as FlowPhase }: { initialPhase?: FlowPhase }) {
	const [phase, setPhase] = React.useState<FlowPhase>(initialPhase);
	const [toastMsg, setToastMsg] = React.useState("");

	if (phase === "trial-banner") return <TrialBanner onUpgrade={() => setPhase("plans")} />;
	if (phase === "plans") return <PlansView onSelect={(tier) => { setToastMsg(`Subscribing to ${tier}...`); setTimeout(() => setPhase("success"), 1500); }} />;
	if (phase === "success") return <SuccessView />;
	if (phase === "expired") return <ExpiredView onUpgrade={() => setPhase("plans")} />;

	return (
		<View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
			<StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
		</View>
	);
}

const meta: Meta<typeof SubscriptionFlow> = {
	title: "Flows/12. Subscription",
	component: SubscriptionFlow,
	parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof SubscriptionFlow>;

export const TrialBannerStory: Story = { name: "1. Trial Banner", args: { initialPhase: "trial-banner" } };
export const Plans: Story = { name: "2. Plans", args: { initialPhase: "plans" } };
export const Success: Story = { name: "3. Success", args: { initialPhase: "success" } };
export const Expired: Story = { name: "4. Expired", args: { initialPhase: "expired" } };
export const FullFlow: Story = { name: "Full Flow", args: { initialPhase: "trial-banner" } };
