import type { Meta, StoryObj } from "@storybook/react";
import {
	AlertCircle,
	AlertTriangle,
	Calendar,
	Camera,
	Check,
	Cloud,
	Copy,
	Download,
	Edit2,
	FileText,
	Link,
	Mail,
	MapPin,
	MessageCircle,
	Mic,
	RefreshCcw,
	Share2,
	Sparkles,
	X,
} from "lucide-react-native";
import * as React from "react";
import { Image, Pressable, ScrollView, TextInput, View } from "react-native";
import { StoryHeader, StoryToast } from "@/app/_story-components";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";

const REPORT_TEXT = {
	workPerformed: [
		"Electrical rough-in at Detail 5/A7 \u2014 junction box installation and conduit routing from Panel E-4",
		"Fire alarm conduit completed at 7/E-102, pulled wire to junction",
		"Panel rough-in at 3/A2 \u2014 mounted panel box, began circuit routing",
		'Foundation inspection prep at grid F/5 \u2014 verified footing dimensions match F1 schedule (24" x 12", 4-#5 E.W.)',
	],
	issues: [
		{
			text: "Junction box at 5/A7 requires relocation approximately 6 inches to the left to clear conduit routing path",
			voiceNote: '"Junction box needs to move about six inches to the left to clear the conduit run"',
			location: "5/A7 - Electrical Junction",
		},
	],
	photos: [
		{ seed: "abc1", time: "2:30 PM", location: "5/A7", isIssue: false },
		{ seed: "abc2", time: "1:30 PM", location: "5/A7", isIssue: true },
		{ seed: "abc3", time: "12:00 PM", location: "5/A7", isIssue: false },
		{ seed: "abc4", time: "11:00 AM", location: "3/A2", isIssue: false },
		{ seed: "abc5", time: "10:30 AM", location: "3/A2", isIssue: false },
	],
};

function GeneratingView() {
	return (
		<View className="bg-background flex-1 items-center justify-center" style={{ minHeight: "100vh" } as any}>
			<View className="items-center gap-6 px-8">
				<View className="items-center justify-center rounded-full" style={{ width: 80, height: 80, backgroundColor: "rgba(168,85,247,0.12)" }}>
					<Icon as={Sparkles} style={{ color: "#a855f7" }} className="size-10" />
				</View>
				<View className="items-center gap-2">
					<Text className="text-foreground text-xl font-bold">Generating Report</Text>
					<Text className="text-muted-foreground text-center text-sm leading-relaxed">
						Analyzing 5 photos, 1 voice note, and plan activity from today...
					</Text>
				</View>
				<View className="w-full gap-3 pt-4">
					<Skeleton className="h-4 w-full rounded" />
					<Skeleton className="h-4 w-4/5 rounded" />
					<Skeleton className="h-4 w-3/5 rounded" />
					<Skeleton className="mt-2 h-4 w-full rounded" />
					<Skeleton className="h-4 w-2/3 rounded" />
				</View>
			</View>
		</View>
	);
}

function ReportView({ onRegenerate, onEdit, onShare }: { onRegenerate: () => void; onEdit?: () => void; onShare?: () => void }) {
	const [toastMsg, setToastMsg] = React.useState("");

	return (
		<View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
			<StoryHeader title="Daily Summary" />
			<ScrollView className="flex-1" contentContainerClassName="px-4 pb-8">
				<View className="mb-6 overflow-hidden rounded-2xl" style={{ backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
					<View className="flex-row items-center gap-2 px-5 py-3" style={{ backgroundColor: "rgba(168,85,247,0.08)" }}>
						<Icon as={Sparkles} className="size-4" style={{ color: "#a855f7" }} />
						<Text className="text-xs font-bold uppercase tracking-wider" style={{ color: "#a855f7" }}>AI-Generated Report</Text>
					</View>
					<View className="gap-3 px-5 py-4">
						<Text className="text-foreground text-xl font-black">Daily Construction Report</Text>
						<View className="gap-2">
							<View className="flex-row items-center gap-2"><Icon as={MapPin} className="text-muted-foreground size-3.5" /><Text className="text-foreground text-sm">Holabird Ave Warehouse</Text></View>
							<View className="flex-row items-center gap-2"><Icon as={Calendar} className="text-muted-foreground size-3.5" /><Text className="text-foreground text-sm">March 9, 2026</Text></View>
							<View className="flex-row items-center gap-2"><Icon as={Cloud} className="text-muted-foreground size-3.5" /><Text className="text-foreground text-sm">Clear, 45°F</Text></View>
						</View>
						<View className="mt-1 flex-row gap-4">
							<View className="flex-row items-center gap-1.5"><Icon as={Camera} className="text-muted-foreground size-3.5" /><Text className="text-muted-foreground text-xs">5 photos</Text></View>
							<View className="flex-row items-center gap-1.5"><Icon as={Mic} className="text-muted-foreground size-3.5" /><Text className="text-muted-foreground text-xs">1 voice note</Text></View>
							<View className="flex-row items-center gap-1.5"><Icon as={AlertTriangle} className="size-3.5" style={{ color: "#ef4444" }} /><Text className="text-xs font-semibold" style={{ color: "#ef4444" }}>1 issue</Text></View>
						</View>
					</View>
				</View>

				<View className="mb-6">
					<Text className="text-foreground mb-3 text-sm font-bold uppercase tracking-wider">Work Performed</Text>
					<View className="gap-3">
						{REPORT_TEXT.workPerformed.map((item, i) => (
							<View key={i} className="flex-row gap-3">
								<Text className="text-muted-foreground text-sm">{"\u2022"}</Text>
								<Text className="text-foreground flex-1 text-sm leading-relaxed">{item}</Text>
							</View>
						))}
					</View>
				</View>

				<Separator className="mb-6" />

				<View className="mb-6">
					<Text className="mb-3 text-sm font-bold uppercase tracking-wider" style={{ color: "#ef4444" }}>Issues / Delays</Text>
					{REPORT_TEXT.issues.map((issue, i) => (
						<View key={i} className="rounded-xl px-4 py-3" style={{ backgroundColor: "rgba(239,68,68,0.06)", borderWidth: 1, borderColor: "rgba(239,68,68,0.15)" }}>
							<View className="mb-2 flex-row items-center gap-2">
								<Icon as={AlertTriangle} className="size-4" style={{ color: "#ef4444" }} />
								<Text className="text-xs font-bold" style={{ color: "#ef4444" }}>{issue.location}</Text>
							</View>
							<Text className="text-foreground text-sm leading-relaxed">{issue.text}</Text>
							{issue.voiceNote && (
								<View className="mt-2 rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
									<View className="flex-row items-center gap-1.5">
										<Icon as={Mic} className="text-muted-foreground size-3" />
										<Text className="text-muted-foreground text-xs italic">{issue.voiceNote}</Text>
									</View>
								</View>
							)}
						</View>
					))}
				</View>

				<Separator className="mb-6" />

				<View className="mb-6">
					<Text className="text-foreground mb-3 text-sm font-bold uppercase tracking-wider">Photos ({REPORT_TEXT.photos.length})</Text>
					<View className="flex-row flex-wrap gap-2">
						{REPORT_TEXT.photos.map((photo) => (
							<View key={photo.seed} className="relative overflow-hidden rounded-lg" style={{ width: "31%", aspectRatio: 1 }}>
								<Image source={{ uri: `https://picsum.photos/seed/${photo.seed}/200/200` }} style={{ width: "100%", height: "100%" }} />
								{photo.isIssue && (
									<View className="absolute top-1 right-1 rounded-full px-1.5 py-0.5" style={{ backgroundColor: "#ef4444" }}>
										<Text className="text-[9px] font-bold text-white">ISSUE</Text>
									</View>
								)}
								<View className="absolute bottom-0 left-0 right-0 px-2 py-1" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
									<Text className="text-[10px] text-white">{photo.time}</Text>
								</View>
							</View>
						))}
					</View>
				</View>

				<Separator className="mb-6" />
				<View className="items-center gap-1">
					<Text className="text-muted-foreground text-xs">Generated by SiteLink · sitelink.app</Text>
					<Text className="text-muted-foreground text-xs">Generated just now</Text>
				</View>
			</ScrollView>

			<View className="flex-row items-center justify-around border-t px-4 py-3" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
				<Pressable className="items-center gap-1" onPress={onRegenerate}><Icon as={RefreshCcw} className="text-foreground size-5" /><Text className="text-foreground text-[10px]">Regenerate</Text></Pressable>
				<Pressable className="items-center gap-1" onPress={onEdit}><Icon as={Edit2} className="text-foreground size-5" /><Text className="text-foreground text-[10px]">Edit</Text></Pressable>
				<Pressable className="items-center gap-1" onPress={onShare}><Icon as={Share2} className="text-foreground size-5" /><Text className="text-foreground text-[10px]">Share</Text></Pressable>
				<Pressable className="items-center gap-1" onPress={() => setToastMsg("PDF downloaded")}><Icon as={Download} className="text-foreground size-5" /><Text className="text-foreground text-[10px]">PDF</Text></Pressable>
			</View>
			<StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
		</View>
	);
}

const GENERATED_REPORT_FULL = `Daily Construction Report
Holabird Ave Warehouse — March 9, 2026

WORK PERFORMED
• Electrical rough-in at Detail 5/A7 — junction box installation and conduit routing from Panel E-4
• Fire alarm conduit completed at 7/E-102, pulled wire to junction
• Panel rough-in at 3/A2 — mounted panel box, began circuit routing
• Foundation inspection prep at grid F/5 — verified footing dimensions match F1 schedule (24" x 12", 4-#5 E.W.)

ISSUES / DELAYS
• 5/A7 - Electrical Junction: Junction box at 5/A7 requires relocation approximately 6 inches to the left to clear conduit routing path
  Voice note: "Junction box needs to move about six inches to the left to clear the conduit run"

PHOTOS: 5 captured (1 issue flagged)

Weather: Clear, 45°F
Generated by SiteLink · sitelink.app`;

const SHARE_OPTIONS = [
	{ id: "copy", label: "Copy Text", icon: Copy, color: "#3b82f6" },
	{ id: "link", label: "Share Link", icon: Link, color: "#22c55e" },
	{ id: "pdf", label: "Download PDF", icon: FileText, color: "#a855f7" },
	{ id: "email", label: "Email", icon: Mail, color: "#f59e0b" },
	{ id: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "#25d366" },
];

function ReportEditView({ onBack, onShare }: { onBack: () => void; onShare: () => void }) {
	const [text, setText] = React.useState(GENERATED_REPORT_FULL);

	return (
		<View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
			<StoryHeader title="Edit Report" onBack={onBack} />
			<View className="flex-1 px-4 pt-2 pb-4">
				<View className="mb-3 flex-row items-center gap-2">
					<Icon as={Sparkles} className="size-3.5" style={{ color: "#a855f7" }} />
					<Text className="text-muted-foreground text-xs">Edit the AI-generated text before sharing</Text>
				</View>
				<View className="flex-1 rounded-2xl" style={{ backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
					<TextInput
						value={text}
						onChangeText={setText}
						multiline
						textAlignVertical="top"
						style={{
							flex: 1,
							color: "#e5e5e5",
							fontSize: 14,
							lineHeight: 22,
							padding: 16,
							fontFamily: "System",
						}}
					/>
				</View>
			</View>
			<View className="border-t px-4 py-3" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
				<Button className="h-14 rounded-xl" onPress={onShare}>
					<Icon as={Share2} className="text-primary-foreground mr-2 size-5" />
					<Text className="text-primary-foreground text-base font-semibold">Share Report</Text>
				</Button>
			</View>
		</View>
	);
}

function ReportShareSheet({ onClose, onAction }: { onClose: () => void; onAction: (action: string) => void }) {
	return (
		<View style={{ minHeight: "100vh", position: "relative" } as any}>
			<Pressable onPress={onClose} style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.5)" }} />
			<View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#1c1c1c", borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
				<View className="items-center py-3"><View className="bg-muted-foreground/30 h-1 w-10 rounded-full" /></View>

				<View className="flex-row items-center justify-between px-6 pb-2">
					<View>
						<Text className="text-foreground text-lg font-bold">Share Report</Text>
						<Text className="text-muted-foreground text-sm">Daily Construction Report — March 9</Text>
					</View>
					<Pressable onPress={onClose} className="bg-muted/20 active:bg-muted/40 size-8 items-center justify-center rounded-full">
						<Icon as={X} className="text-foreground size-5" />
					</Pressable>
				</View>

				<View className="px-6 pt-4">
					<Text className="text-muted-foreground mb-3 text-xs font-bold uppercase tracking-wider">Share via</Text>
					<View className="overflow-hidden rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
						{SHARE_OPTIONS.map((option, idx) => (
							<Pressable
								key={option.id}
								onPress={() => onAction(option.label)}
								className="flex-row items-center gap-3 px-4 py-3.5 active:opacity-70"
								style={idx > 0 ? { borderTopWidth: 1, borderColor: "rgba(255,255,255,0.06)" } : undefined}
							>
								<Icon as={option.icon} className="size-5" style={{ color: option.color }} />
								<Text className="text-foreground flex-1 text-sm font-medium">{option.label}</Text>
							</Pressable>
						))}
					</View>
				</View>

				<View style={{ height: 40 }} />
			</View>
		</View>
	);
}

function ShareConfirmationView({ action, onDone }: { action: string; onDone: () => void }) {
	return (
		<View className="bg-background flex-1 items-center justify-center" style={{ minHeight: "100vh" } as any}>
			<View className="items-center gap-5 px-8">
				<View className="items-center justify-center rounded-full" style={{ width: 80, height: 80, backgroundColor: "rgba(34,197,94,0.12)" }}>
					<Icon as={Check} className="size-10" style={{ color: "#22c55e" }} />
				</View>
				<View className="items-center gap-1.5">
					<Text className="text-foreground text-xl font-bold">{action}</Text>
					<Text className="text-muted-foreground text-center text-sm leading-relaxed">
						Your daily report has been shared{"\n"}successfully.
					</Text>
				</View>
				<View className="mt-2 w-full rounded-xl px-4 py-3" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
					<Text className="text-muted-foreground text-center text-xs">Daily Construction Report — March 9, 2026</Text>
				</View>
				<Button className="mt-4 h-12 w-full rounded-xl" onPress={onDone}>
					<Text className="text-primary-foreground text-base font-semibold">Done</Text>
				</Button>
			</View>
		</View>
	);
}

function GenerationErrorView({ onRetry }: { onRetry: () => void }) {
	return (
		<View className="bg-background flex-1 items-center justify-center" style={{ minHeight: "100vh" } as any}>
			<View className="items-center gap-6 px-8">
				<View className="items-center justify-center rounded-full" style={{ width: 80, height: 80, backgroundColor: "rgba(239,68,68,0.12)" }}>
					<Icon as={AlertCircle} style={{ color: "#ef4444" }} className="size-10" />
				</View>
				<View className="items-center gap-2">
					<Text className="text-foreground text-xl font-bold">Generation Failed</Text>
					<Text className="text-muted-foreground text-center text-sm leading-relaxed">
						Something went wrong while generating your report. Check your connection and try again.
					</Text>
				</View>
				<Button className="mt-2 h-14 w-full rounded-xl" onPress={onRetry}>
					<Icon as={RefreshCcw} className="text-primary-foreground mr-2 size-5" />
					<Text className="text-primary-foreground text-base font-semibold">Try Again</Text>
				</Button>
			</View>
		</View>
	);
}

type FlowPhase = "prompt" | "generating" | "report" | "edit" | "share" | "share-confirm" | "error";

function DailyReportingFlow({ initialPhase = "prompt" as FlowPhase }: { initialPhase?: FlowPhase }) {
	const [phase, setPhase] = React.useState<FlowPhase>(initialPhase);
	const [shareAction, setShareAction] = React.useState("Report Shared");

	React.useEffect(() => {
		if (phase !== "generating") return;
		const timer = setTimeout(() => setPhase("report"), 3000);
		return () => clearTimeout(timer);
	}, [phase]);

	if (phase === "generating") return <GeneratingView />;
	if (phase === "error") return <GenerationErrorView onRetry={() => setPhase("generating")} />;
	if (phase === "edit") return <ReportEditView onBack={() => setPhase("report")} onShare={() => setPhase("share")} />;
	if (phase === "share") return (
		<ReportShareSheet
			onClose={() => setPhase("report")}
			onAction={(action) => {
				setShareAction(action === "Copy Text" ? "Text Copied" : action === "Download PDF" ? "PDF Downloaded" : `Sent via ${action}`);
				setPhase("share-confirm");
			}}
		/>
	);
	if (phase === "share-confirm") return <ShareConfirmationView action={shareAction} onDone={() => setPhase("report")} />;
	if (phase === "report") return <ReportView onRegenerate={() => { setPhase("generating"); }} onEdit={() => setPhase("edit")} onShare={() => setPhase("share")} />;

	return (
		<View className="bg-background flex-1 items-center justify-center px-6" style={{ minHeight: "100vh" } as any}>
			<View className="items-center gap-4">
				<View className="items-center justify-center rounded-full" style={{ width: 72, height: 72, backgroundColor: "rgba(168,85,247,0.12)" }}>
					<Icon as={Sparkles} style={{ color: "#a855f7" }} className="size-8" />
				</View>
				<Text className="text-foreground text-xl font-bold">Daily Summary</Text>
				<Text className="text-muted-foreground text-center text-sm leading-relaxed">
					Generate an AI report from today&apos;s photos, voice notes, and plan activity.
				</Text>
				<View className="mt-2 flex-row items-center gap-4">
					<View className="flex-row items-center gap-1.5"><Icon as={Camera} className="text-muted-foreground size-4" /><Text className="text-muted-foreground text-sm">5 photos</Text></View>
					<View className="flex-row items-center gap-1.5"><Icon as={Mic} className="text-muted-foreground size-4" /><Text className="text-muted-foreground text-sm">1 voice note</Text></View>
				</View>
				<Button className="mt-4 h-14 w-full rounded-xl" onPress={() => setPhase("generating")}>
					<Icon as={Sparkles} className="text-primary-foreground mr-2 size-5" />
					<Text className="text-primary-foreground text-base font-semibold">Generate Report</Text>
				</Button>
			</View>
		</View>
	);
}

const meta: Meta<typeof DailyReportingFlow> = {
	title: "Flows/6. Daily Reporting",
	component: DailyReportingFlow,
	parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof DailyReportingFlow>;

export const Prompt: Story = { name: "1. Generate Prompt", args: { initialPhase: "prompt" } };
export const Generating: Story = { name: "2. AI Processing", args: { initialPhase: "generating" } };
export const Report: Story = { name: "3. Report Ready", args: { initialPhase: "report" } };
export const ReportEdit: Story = { name: "4. Edit Report", args: { initialPhase: "edit" } };
export const ReportShare: Story = { name: "5. Share Options", args: { initialPhase: "share" } };
export const ShareConfirmation: Story = { name: "6. Share Confirmation", args: { initialPhase: "share-confirm" } };
export const GenerationError: Story = { name: "7. AI Error — Retry", args: { initialPhase: "error" } };
export const FullFlow: Story = { name: "Full Flow", args: { initialPhase: "prompt" } };
