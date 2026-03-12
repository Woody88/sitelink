import type { Meta, StoryObj } from "@storybook/react";
import {
	AlertCircle,
	AlertTriangle,
	Camera,
	Copy,
	Edit2,
	FileText,
	MapPin,
	Mic,
	RefreshCcw,
	Send,
	Share2,
	Sparkles,
} from "lucide-react-native";
import * as React from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import { StoryHeader, StoryToast } from "@/app/_story-components";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";

const RFI_CONTENT = {
	number: "RFI-2026-0047",
	date: "March 9, 2026",
	project: "Holabird Ave Warehouse",
	to: "Thompson Structural Engineers",
	from: "John Smith, Smith Electrical LLC",
	subject: "Concrete Strength Discrepancy \u2014 SL1 vs General Note N3",
	description: [
		"During review of the Slab on Grade Schedule on Sheet S1.0, entry SL1 specifies a concrete strength of 4000 PSI. However, General Structural Note N3 on the same sheet states that \u201call exposed slab-on-grade shall achieve minimum 4500 PSI 28-day compressive strength.\u201d",
		"Please clarify which specification governs for the SL1 slab areas, and whether the schedule should be updated to reflect the 4500 PSI requirement from the general notes.",
	],
	references: [
		"Sheet S1.0, Slab on Grade Schedule, Entry SL1",
		"Sheet S1.0, General Structural Notes, Note N3",
	],
};

function RfiLetterField({ label, value }: { label: string; value: string }) {
	return (
		<View className="flex-row">
			<Text className="text-muted-foreground w-16 text-xs font-semibold">{label}</Text>
			<Text className="text-foreground flex-1 text-xs">{value}</Text>
		</View>
	);
}

function IssueContextView({ onGenerate }: { onGenerate: () => void }) {
	return (
		<View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
			<StoryHeader title="Generate RFI" />
			<View className="px-4 pt-2">
				<Badge variant="secondary" className="self-start border-transparent" style={{ backgroundColor: "rgba(168,85,247,0.12)" }}>
					<Text className="text-[10px] font-bold" style={{ color: "#a855f7" }}>BUSINESS FEATURE</Text>
				</Badge>
			</View>
			<ScrollView className="flex-1" contentContainerClassName="px-4 pb-8" showsVerticalScrollIndicator={false}>
				<View className="pt-4">
					<View className="overflow-hidden rounded-2xl" style={{ backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
						<View className="gap-3 px-5 py-4">
							<View className="flex-row items-center gap-3">
								<View className="items-center justify-center rounded-full" style={{ width: 36, height: 36, backgroundColor: "rgba(245,158,11,0.12)" }}>
									<Icon as={AlertTriangle} className="size-4" style={{ color: "#f59e0b" }} />
								</View>
								<Text className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Source</Text>
							</View>
							<Text className="text-foreground text-base font-bold">Concrete Strength Discrepancy</Text>
							<Text className="text-muted-foreground text-sm leading-relaxed">
								Slab on Grade Schedule entry SL1 specifies 4000 PSI, but General Structural Note N3 requires 4500 PSI minimum for exposed slabs
							</Text>
							<View className="flex-row items-center gap-2">
								<Icon as={FileText} className="text-muted-foreground size-3.5" />
								<Text className="text-muted-foreground text-xs">S1.0 - Foundation Plan</Text>
							</View>
						</View>
					</View>
				</View>

				<View className="mt-4 overflow-hidden rounded-2xl" style={{ backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
					<View className="gap-3 px-5 py-4">
						<Text className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Attached Evidence</Text>
						<View className="flex-row gap-3">
							<View className="overflow-hidden rounded-lg" style={{ width: 80, height: 80 }}>
								<Image source={{ uri: "https://picsum.photos/seed/rfi1/200/200" }} style={{ width: "100%", height: "100%" }} />
								<View className="absolute top-1 right-1 rounded-full px-1.5 py-0.5" style={{ backgroundColor: "#ef4444" }}>
									<Text className="text-[8px] font-bold text-white">ISSUE</Text>
								</View>
							</View>
						</View>
						<View className="flex-row items-center gap-2">
							<Icon as={Camera} className="text-muted-foreground size-3.5" />
							<Text className="text-muted-foreground text-xs">1 issue photo</Text>
						</View>
						<View className="flex-row items-center gap-2">
							<Icon as={Mic} className="text-muted-foreground size-3.5" />
							<Text className="text-muted-foreground text-xs">1 voice note attached</Text>
						</View>
						<View className="flex-row items-center gap-2">
							<Icon as={MapPin} className="text-muted-foreground size-3.5" />
							<Text className="text-muted-foreground text-xs">5/A7 - Electrical Junction</Text>
						</View>
					</View>
				</View>

				<View className="pt-6">
					<Button className="h-14 rounded-xl" onPress={onGenerate}>
						<Icon as={Sparkles} className="text-primary-foreground mr-2 size-5" />
						<Text className="text-primary-foreground text-base font-semibold">Generate RFI Draft</Text>
					</Button>
				</View>
			</ScrollView>
		</View>
	);
}

function GeneratingView() {
	return (
		<View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
			<StoryHeader title="Generate RFI" />
			<ScrollView className="flex-1" contentContainerClassName="px-4 pb-8">
				<View className="gap-4 py-6">
					<View className="items-center gap-3 pb-2">
						<Icon as={Sparkles} className="size-6" style={{ color: "#a855f7" }} />
						<Text className="text-sm font-medium" style={{ color: "#a855f7" }}>AI is drafting your RFI...</Text>
					</View>
					<View className="overflow-hidden rounded-2xl px-5 py-5" style={{ backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
						<View className="gap-4">
							<Skeleton className="h-6 w-3/4 rounded" />
							<View className="gap-2">
								<Skeleton className="h-4 w-1/2 rounded" />
								<Skeleton className="h-4 w-2/5 rounded" />
								<Skeleton className="h-4 w-3/5 rounded" />
							</View>
							<View className="pt-2"><Skeleton className="h-4 w-1/3 rounded" /></View>
							<View className="gap-2 pt-2">
								<Skeleton className="h-4 w-full rounded" />
								<Skeleton className="h-4 w-full rounded" />
								<Skeleton className="h-4 w-4/5 rounded" />
							</View>
							<View className="gap-2 pt-2">
								<Skeleton className="h-4 w-full rounded" />
								<Skeleton className="h-4 w-3/5 rounded" />
							</View>
							<View className="gap-2 pt-2">
								<Skeleton className="h-4 w-1/4 rounded" />
								<Skeleton className="h-4 w-3/4 rounded" />
								<Skeleton className="h-4 w-2/3 rounded" />
							</View>
						</View>
					</View>
				</View>
			</ScrollView>
		</View>
	);
}

function DraftView({ onEdit, onSend }: { onEdit: () => void; onSend: () => void }) {
	const [toastMsg, setToastMsg] = React.useState("");

	return (
		<View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
			<StoryHeader title="RFI Draft" />
			<ScrollView className="flex-1" contentContainerClassName="px-4 pb-8" showsVerticalScrollIndicator={false}>
				<View className="gap-4 py-4">
					<View className="overflow-hidden rounded-2xl" style={{ backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
						<View className="flex-row items-center gap-2 px-5 py-3" style={{ backgroundColor: "rgba(168,85,247,0.08)" }}>
							<Icon as={Sparkles} className="size-4" style={{ color: "#a855f7" }} />
							<Text className="text-xs font-bold uppercase tracking-wider" style={{ color: "#a855f7" }}>AI-Generated Draft</Text>
						</View>
						<View className="gap-5 px-5 py-5">
							<Text className="text-foreground text-center text-lg font-black tracking-wide">REQUEST FOR INFORMATION</Text>
							<View className="gap-1.5">
								<RfiLetterField label="RFI No:" value={RFI_CONTENT.number} />
								<RfiLetterField label="Date:" value={RFI_CONTENT.date} />
								<RfiLetterField label="Project:" value={RFI_CONTENT.project} />
							</View>
							<View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.08)" }} />
							<View className="gap-1.5">
								<RfiLetterField label="To:" value={RFI_CONTENT.to} />
								<RfiLetterField label="From:" value={RFI_CONTENT.from} />
								<RfiLetterField label="Subject:" value={RFI_CONTENT.subject} />
							</View>
							<View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.08)" }} />
							<View className="gap-2">
								<Text className="text-foreground text-xs font-bold uppercase tracking-wider">Description</Text>
								{RFI_CONTENT.description.map((paragraph) => (
									<Text key={paragraph.slice(0, 40)} className="text-foreground text-sm leading-relaxed">{paragraph}</Text>
								))}
							</View>
							<View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.08)" }} />
							<View className="gap-2">
								<Text className="text-foreground text-xs font-bold uppercase tracking-wider">Reference</Text>
								{RFI_CONTENT.references.map((ref) => (
									<View key={ref} className="flex-row gap-2">
										<Text className="text-muted-foreground text-sm">{"\u2022"}</Text>
										<Text className="text-foreground flex-1 text-sm leading-relaxed">{ref}</Text>
									</View>
								))}
							</View>
						</View>
					</View>
				</View>

				<View className="gap-3 pt-2 pb-4">
					<Button className="h-12 rounded-xl" onPress={onEdit}>
						<Icon as={Edit2} className="text-primary-foreground mr-2 size-5" />
						<Text className="text-primary-foreground text-base font-semibold">Edit Draft</Text>
					</Button>
					<View className="flex-row gap-3">
						<Button variant="secondary" className="h-12 flex-1 rounded-xl" onPress={() => setToastMsg("RFI copied to clipboard")}>
							<Icon as={Copy} className="text-secondary-foreground mr-2 size-4" />
							<Text className="text-secondary-foreground text-sm font-semibold">Copy</Text>
						</Button>
						<Button variant="secondary" className="h-12 flex-1 rounded-xl" onPress={() => setToastMsg("Share link created")}>
							<Icon as={Share2} className="text-secondary-foreground mr-2 size-4" />
							<Text className="text-secondary-foreground text-sm font-semibold">Share</Text>
						</Button>
					</View>
				</View>
			</ScrollView>

			<View className="border-t px-4 py-3" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
				<Button className="h-12 rounded-xl" onPress={onSend}>
					<Icon as={Send} className="text-primary-foreground mr-2 size-5" />
					<Text className="text-primary-foreground text-base font-semibold">Send RFI</Text>
				</Button>
			</View>
			<StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
		</View>
	);
}

function SentConfirmation() {
	return (
		<View className="bg-background flex-1 items-center justify-center" style={{ minHeight: "100vh" } as any}>
			<View className="items-center gap-4 px-8">
				<View className="items-center justify-center rounded-full" style={{ width: 80, height: 80, backgroundColor: "rgba(34,197,94,0.12)" }}>
					<Icon as={Send} className="size-10" style={{ color: "#22c55e" }} />
				</View>
				<Text className="text-foreground text-xl font-bold">RFI Sent</Text>
				<Text className="text-muted-foreground text-center text-sm leading-relaxed">
					{RFI_CONTENT.number} has been sent to{"\n"}{RFI_CONTENT.to}
				</Text>
				<View className="mt-2 rounded-xl px-4 py-3" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
					<Text className="text-muted-foreground text-center text-xs">You will be notified when a response is received</Text>
				</View>
			</View>
		</View>
	);
}

function RfiGenerationError({ onRetry }: { onRetry: () => void }) {
	return (
		<View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
			<StoryHeader title="Generate RFI" />
			<View className="flex-1 items-center justify-center px-8">
				<View className="items-center gap-6">
					<View className="items-center justify-center rounded-full" style={{ width: 80, height: 80, backgroundColor: "rgba(239,68,68,0.12)" }}>
						<Icon as={AlertCircle} style={{ color: "#ef4444" }} className="size-10" />
					</View>
					<View className="items-center gap-2">
						<Text className="text-foreground text-xl font-bold">RFI Generation Failed</Text>
						<Text className="text-muted-foreground text-center text-sm leading-relaxed">
							Could not generate the RFI draft. This may be due to a network issue or insufficient context.
						</Text>
					</View>
					<Button className="mt-2 h-14 w-full rounded-xl" onPress={onRetry}>
						<Icon as={RefreshCcw} className="text-primary-foreground mr-2 size-5" />
						<Text className="text-primary-foreground text-base font-semibold">Try Again</Text>
					</Button>
				</View>
			</View>
		</View>
	);
}

type RfiPhase = "context" | "generating" | "draft" | "editing" | "sent" | "error";

function RfiFlow({ initialPhase = "context" as RfiPhase }: { initialPhase?: RfiPhase }) {
	const [phase, setPhase] = React.useState<RfiPhase>(initialPhase);

	React.useEffect(() => {
		if (phase !== "generating") return;
		const timer = setTimeout(() => setPhase("draft"), 3000);
		return () => clearTimeout(timer);
	}, [phase]);

	if (phase === "context") return <IssueContextView onGenerate={() => setPhase("generating")} />;
	if (phase === "generating") return <GeneratingView />;
	if (phase === "error") return <RfiGenerationError onRetry={() => setPhase("generating")} />;
	if (phase === "draft" || phase === "editing") return <DraftView onEdit={() => setPhase("editing")} onSend={() => setPhase("sent")} />;
	return <SentConfirmation />;
}

const meta: Meta<typeof RfiFlow> = {
	title: "Flows/7. RFI Generation",
	component: RfiFlow,
	parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof RfiFlow>;

export const IssueContext: Story = { name: "1. Issue Context", args: { initialPhase: "context" } };
export const AIGenerating: Story = { name: "2. AI Generating", args: { initialPhase: "generating" } };
export const DraftReady: Story = { name: "3. Draft Ready", args: { initialPhase: "draft" } };
export const Sent: Story = { name: "4. Sent Confirmation", args: { initialPhase: "sent" } };
export const GenerationError: Story = { name: "5. AI Error — Retry", args: { initialPhase: "error" } };
export const FullFlow: Story = { name: "Full Flow", args: { initialPhase: "context" } };
