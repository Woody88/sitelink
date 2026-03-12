import type { Meta, StoryObj } from "@storybook/react";
import {
	AlertTriangle,
	Camera,
	Check,
	CheckCircle,
	ChevronLeft,
	ChevronRight,
	Copy,
	Edit2,
	ExternalLink,
	FileText,
	Flag,
	Layers,
	MapPin,
	Maximize,
	Mic,
	Play,
	RotateCw,
	ScanLine,
	Send,
	Share2,
	Sparkles,
	TableProperties,
	TriangleAlert,
	X,
	Zap,
	ZapOff,
	ZoomIn,
	ZoomOut,
} from "lucide-react-native";
import * as React from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import { StoryHeader, StoryToast } from "@/app/_story-components";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";

const MARKER_COLORS = {
	detail: "#22c55e",
	section: "#3b82f6",
	note: "#a855f7",
	elevation: "#f59e0b",
	selected: "#facc15",
} as const;

interface Marker {
	id: string;
	label: string;
	type: "detail" | "section" | "note" | "elevation";
	description: string;
	top: string;
	left: string;
	width: string;
	height: string;
}

const MOCK_MARKERS: Marker[] = [
	{ id: "m1", label: "5/A7", type: "detail", description: "Electrical Junction Detail — Referenced from Sheet S1.0", top: "52%", left: "7%", width: "6%", height: "4%" },
	{ id: "m2", label: "3/A2", type: "section", description: "Stage Framing Section — See Sheet S2.0", top: "60%", left: "18%", width: "8%", height: "5%" },
	{ id: "m3", label: "N1", type: "note", description: "Foundation Notes — General structural notes", top: "4%", left: "78%", width: "16%", height: "12%" },
	{ id: "m4", label: "2/A1", type: "detail", description: "Footing Detail — Strip footing at grid line W", top: "42%", left: "28%", width: "5%", height: "4%" },
];

const RFI_CONTENT = {
	number: "RFI-2026-0047",
	date: "March 9, 2026",
	project: "Holabird Ave Warehouse",
	to: "Thompson Structural Engineers",
	from: "John Smith, Smith Electrical LLC",
	subject: "Exposed Rebar at Junction Box — Inspection Required Before Pour",
	description: [
		"During a field inspection, exposed rebar was observed at the electrical junction box location referenced by callout 5/A7 on Sheet S1.0. The rebar appears to lack adequate cover and may not meet ACI 318 minimum requirements.",
		"A voice note recorded on-site describes the condition in detail. Please advise whether the rebar placement can proceed as-is or if corrective action is required prior to the concrete pour scheduled for next week.",
	],
	references: [
		"Sheet S1.0, Callout 5/A7 — Electrical Junction Detail",
		"Field photo with issue flag — March 9, 2026",
		"Voice note transcript: \"Exposed rebar at junction box, needs inspection before pour...\"",
	],
};

function GlassCircle({ children, size = 48, bg = "rgba(0,0,0,0.4)", onPress }: { children: React.ReactNode; size?: number; bg?: string; onPress?: () => void }) {
	return (
		<Pressable onPress={onPress} className="items-center justify-center rounded-full" style={{ width: size, height: size, backgroundColor: bg }}>
			{children}
		</Pressable>
	);
}

function GlassButton({ children, size = 44, onPress }: { children: React.ReactNode; size?: number; onPress?: () => void }) {
	return (
		<Pressable onPress={onPress} className="items-center justify-center rounded-full" style={{ width: size, height: size, backgroundColor: "rgba(0,0,0,0.6)" }}>
			{children}
		</Pressable>
	);
}

function ShutterButton({ isIssueMode, onPress }: { isIssueMode?: boolean; onPress?: () => void }) {
	const color = isIssueMode ? "#ef4444" : "#ffffff";
	return (
		<Pressable onPress={onPress}>
			<View className="items-center justify-center rounded-full" style={{ width: 88, height: 88, borderWidth: 3, borderColor: color }}>
				<View className="rounded-full" style={{ width: 74, height: 74, backgroundColor: color }} />
			</View>
		</Pressable>
	);
}

function MarkerOverlay({ marker, isSelected, onPress }: { marker: Marker; isSelected?: boolean; onPress: () => void }) {
	const color = isSelected ? MARKER_COLORS.selected : MARKER_COLORS[marker.type];
	return (
		<Pressable
			onPress={onPress}
			style={{
				position: "absolute",
				top: marker.top as any,
				left: marker.left as any,
				width: marker.width as any,
				height: marker.height as any,
				borderWidth: isSelected ? 3 : 2,
				borderColor: color,
				borderRadius: 4,
				backgroundColor: isSelected ? "rgba(250,204,21,0.12)" : "transparent",
				zIndex: 5,
			}}
		>
			<View
				style={{
					position: "absolute",
					top: -22,
					left: 0,
					backgroundColor: color,
					borderRadius: 4,
					paddingHorizontal: 6,
					paddingVertical: 2,
				}}
			>
				<Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{marker.label}</Text>
			</View>
		</Pressable>
	);
}

function RfiLetterField({ label, value }: { label: string; value: string }) {
	return (
		<View className="flex-row">
			<Text className="text-muted-foreground w-16 text-xs font-semibold">{label}</Text>
			<Text className="text-foreground flex-1 text-xs">{value}</Text>
		</View>
	);
}

type PlanToCapturePhase = "plan-view" | "callout-selected" | "camera-linked" | "capture-preview" | "done";

function PlanToCapture({ initialPhase = "plan-view" }: { initialPhase?: PlanToCapturePhase }) {
	const [phase, setPhase] = React.useState<PlanToCapturePhase>(initialPhase);
	const [toastMsg, setToastMsg] = React.useState("");
	const selectedMarker = MOCK_MARKERS[0];

	if (phase === "done") {
		return (
			<View className="bg-background flex-1 items-center justify-center" style={{ minHeight: "100vh" } as any}>
				<View className="items-center gap-5 px-8">
					<View className="items-center justify-center rounded-full" style={{ width: 72, height: 72, backgroundColor: "rgba(34,197,94,0.12)" }}>
						<Icon as={CheckCircle} className="size-9" style={{ color: "#22c55e" }} />
					</View>
					<Text className="text-foreground text-xl font-bold">Photo Saved</Text>
					<Text className="text-muted-foreground text-center text-sm leading-relaxed">
						Linked to {selectedMarker.label} on S1.0{"\n"}Foundation Plan
					</Text>
					<View style={{ height: 24 }} />
					<Pressable onPress={() => setPhase("plan-view")} className="bg-primary items-center rounded-xl px-8 py-3.5">
						<Text className="text-primary-foreground text-sm font-bold">Back to Plan</Text>
					</Pressable>
				</View>
				<StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
			</View>
		);
	}

	if (phase === "capture-preview") {
		return (
			<View style={{ minHeight: "100vh", position: "relative", backgroundColor: "#000" } as any}>
				<Image source={{ uri: "https://picsum.photos/seed/rebar42/1080/1920" }} style={{ width: "100%", height: "100%", position: "absolute" }} resizeMode="cover" />

				<View style={{ position: "absolute", top: 16, left: 12, zIndex: 20, flexDirection: "row", alignItems: "center", gap: 10 }}>
					<Pressable onPress={() => setPhase("camera-linked")} className="items-center justify-center rounded-full" style={{ width: 40, height: 40, backgroundColor: "rgba(0,0,0,0.5)" }}>
						<Icon as={ChevronLeft} className="size-5 text-white" />
					</Pressable>
				</View>

				<View style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 20, backgroundColor: "rgba(0,0,0,0.78)", borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
					<View className="items-center py-3">
						<View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.25)" }} />
					</View>

					<View style={{ paddingHorizontal: 20, paddingBottom: 40 }}>
						<View className="mb-4 flex-row items-center gap-3">
							<View className="items-center justify-center rounded-full" style={{ width: 32, height: 32, backgroundColor: "rgba(34,197,94,0.15)" }}>
								<Icon as={CheckCircle} style={{ color: "#22c55e" }} className="size-5" />
							</View>
							<View className="flex-1">
								<Text style={{ color: "#ebebeb", fontSize: 14, fontWeight: "600" }}>
									Saved to {selectedMarker.label} · Foundation Plan
								</Text>
							</View>
						</View>

						<Pressable
							className="mb-4 flex-row items-center gap-3"
							style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, padding: 14 }}
						>
							<View className="items-center justify-center rounded-full" style={{ width: 36, height: 36, backgroundColor: "rgba(255,255,255,0.1)" }}>
								<Icon as={Mic} className="size-4" style={{ color: "rgba(255,255,255,0.7)" }} />
							</View>
							<Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: "500" }}>Add voice note</Text>
						</Pressable>

						<View className="flex-row items-center gap-3">
							<Pressable onPress={() => setPhase("camera-linked")} className="flex-row items-center justify-center gap-2 rounded-xl py-3.5" style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.1)" }}>
								<Icon as={RotateCw} className="size-4 text-white" />
								<Text className="text-sm font-semibold text-white">Retake</Text>
							</Pressable>
							<Pressable onPress={() => setPhase("done")} className="bg-primary items-center justify-center rounded-xl py-3.5" style={{ flex: 1 }}>
								<Text className="text-primary-foreground text-sm font-bold">Done</Text>
							</Pressable>
						</View>
					</View>
				</View>

				<StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
			</View>
		);
	}

	if (phase === "camera-linked") {
		return (
			<View style={{ minHeight: "100vh", position: "relative", backgroundColor: "#000" } as any}>
				<Image source={{ uri: "https://picsum.photos/seed/constructsite7/1080/1920" }} style={{ width: "100%", height: "100%", position: "absolute" }} resizeMode="cover" />

				<View style={{ position: "absolute", top: 44, left: 0, right: 0, zIndex: 20, flexDirection: "row", alignItems: "center", height: 64, paddingVertical: 10, paddingHorizontal: 16, gap: 8 }}>
					<GlassCircle onPress={() => setPhase("callout-selected")}>
						<Icon as={X} className="size-5 text-white" />
					</GlassCircle>
					<View style={{ flex: 1 }} />
					<GlassCircle>
						<Icon as={ZapOff} className="size-5 text-white" />
					</GlassCircle>
					<GlassCircle>
						<Icon as={RotateCw} className="size-5 text-white" />
					</GlassCircle>
				</View>

				<View style={{ position: "absolute", top: 580, left: 0, right: 0, zIndex: 15, alignItems: "center" }}>
					<View className="flex-row items-center" style={{ backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 20, height: 36, paddingHorizontal: 14, gap: 6 }}>
						<Icon as={MapPin} style={{ color: "#ffffff" }} className="size-3.5" />
						<Text style={{ color: "#eab308", fontSize: 13, fontWeight: "700" }}>{selectedMarker.label}</Text>
						<Text style={{ color: "#ebebeb", fontSize: 13 }}>· Foundation Plan</Text>
					</View>
				</View>

				<View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 212, backgroundColor: "rgba(0,0,0,0.52)", zIndex: 10 }} />

				<View style={{ position: "absolute", bottom: 104, left: 0, right: 0, zIndex: 15, alignItems: "center" }}>
					<ShutterButton onPress={() => setPhase("capture-preview")} />
				</View>

				<View style={{ position: "absolute", bottom: 44, left: 0, right: 0, zIndex: 15, alignItems: "center" }}>
					<Text style={{ color: "#ebebeb", fontSize: 13, fontWeight: "700" }}>PHOTO</Text>
				</View>

				<StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
			</View>
		);
	}

	return (
		<View style={{ minHeight: "100vh", position: "relative", backgroundColor: "#0a0a0a" } as any}>
			<Image source={{ uri: "/plan-sample.png" }} style={{ width: "100%", height: "100%", position: "absolute" }} resizeMode="contain" />

			{MOCK_MARKERS.map((marker) => (
				<MarkerOverlay
					key={marker.id}
					marker={marker}
					isSelected={phase === "callout-selected" && marker.id === "m1"}
					onPress={() => setPhase("callout-selected")}
				/>
			))}

			<View style={{ position: "absolute", top: 16, left: 16, zIndex: 20 }}>
				<GlassButton onPress={() => setToastMsg("Back to project")}>
					<Icon as={X} className="size-5 text-white" strokeWidth={2.5} />
				</GlassButton>
			</View>

			<View style={{ position: "absolute", top: 16, right: 16, zIndex: 20, gap: 12, alignItems: "center" }}>
				<View className="items-center justify-center rounded-xl" style={{ backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 10, paddingVertical: 6 }}>
					<Text style={{ color: "#fff", fontSize: 13, fontWeight: "600", fontVariant: ["tabular-nums"] }}>42%</Text>
				</View>
				<View className="items-center overflow-hidden rounded-2xl" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
					<Pressable className="items-center justify-center" style={{ width: 44, height: 44 }}>
						<Icon as={ZoomIn} className="size-5 text-white" />
					</Pressable>
					<View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.1)", alignSelf: "stretch" }} />
					<Pressable className="items-center justify-center" style={{ width: 44, height: 44 }}>
						<Icon as={ZoomOut} className="size-5 text-white" />
					</Pressable>
					<View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.1)", alignSelf: "stretch" }} />
					<Pressable className="items-center justify-center" style={{ width: 44, height: 44 }}>
						<Icon as={Maximize} className="size-5 text-white" />
					</Pressable>
				</View>
				<GlassButton>
					<Icon as={ScanLine} className="size-5 text-white" />
				</GlassButton>
				<GlassButton>
					<Icon as={TableProperties} className="size-5 text-white" />
				</GlassButton>
			</View>

			{phase === "plan-view" && (
				<View style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 10, paddingHorizontal: 16, paddingBottom: 24 }}>
					<View className="flex-row items-center justify-between">
						<Pressable className="flex-row items-center gap-2 rounded-xl px-4 py-2.5" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
							<Icon as={Layers} className="size-4 text-white/70" />
							<Text className="text-sm font-bold text-white">S1.0</Text>
							<Text className="text-sm text-white/60">Foundation Plan</Text>
						</Pressable>
						<View className="flex-row items-center gap-1.5 rounded-xl px-3 py-2" style={{ backgroundColor: "rgba(245,245,245,0.15)" }}>
							<Icon as={MapPin} className="text-primary size-3.5" />
							<Text className="text-primary text-sm font-semibold">{MOCK_MARKERS.length}</Text>
						</View>
					</View>
				</View>
			)}

			{phase === "callout-selected" && (
				<View
					style={{
						position: "absolute",
						bottom: 0,
						left: 0,
						right: 0,
						zIndex: 30,
						backgroundColor: "#1c1c1c",
						borderTopLeftRadius: 20,
						borderTopRightRadius: 20,
						paddingTop: 12,
						paddingBottom: 32,
						paddingHorizontal: 20,
					}}
				>
					<Pressable onPress={() => setPhase("plan-view")} className="mb-4 items-center">
						<View className="bg-muted h-1 w-10 rounded-full" />
					</Pressable>

					<View className="mb-1 flex-row items-center gap-2">
						<View
							className="items-center justify-center rounded-full"
							style={{ width: 28, height: 28, backgroundColor: MARKER_COLORS[selectedMarker.type] + "20" }}
						>
							<Icon as={MapPin} style={{ color: MARKER_COLORS[selectedMarker.type] }} className="size-4" />
						</View>
						<Text className="text-foreground text-lg font-bold">{selectedMarker.label}</Text>
						<View className="rounded-full px-2 py-0.5" style={{ backgroundColor: MARKER_COLORS[selectedMarker.type] + "20" }}>
							<Text style={{ color: MARKER_COLORS[selectedMarker.type], fontSize: 11, fontWeight: "600" }}>
								{selectedMarker.type.charAt(0).toUpperCase() + selectedMarker.type.slice(1)}
							</Text>
						</View>
					</View>

					<Text className="text-muted-foreground mb-5 text-sm">
						{selectedMarker.description}
					</Text>

					<View className="flex-row gap-3">
						<Pressable className="flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
							<Icon as={ExternalLink} className="text-foreground size-4" />
							<Text className="text-foreground text-sm font-semibold">Go to Sheet</Text>
						</Pressable>
						<Pressable onPress={() => setPhase("camera-linked")} className="bg-primary flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3">
							<Icon as={Camera} className="text-primary-foreground size-4" />
							<Text className="text-primary-foreground text-sm font-semibold">Take Photo</Text>
						</Pressable>
					</View>
				</View>
			)}

			<StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
		</View>
	);
}

type CaptureToRfiPhase = "issue-capture" | "issue-preview" | "rfi-prompt" | "rfi-context" | "rfi-generating" | "rfi-draft";

function CaptureToRfi({ initialPhase = "issue-capture" }: { initialPhase?: CaptureToRfiPhase }) {
	const [phase, setPhase] = React.useState<CaptureToRfiPhase>(initialPhase);
	const [toastMsg, setToastMsg] = React.useState("");
	const [flashOn, setFlashOn] = React.useState(false);

	React.useEffect(() => {
		if (phase !== "rfi-generating") return;
		const timer = setTimeout(() => setPhase("rfi-draft"), 3000);
		return () => clearTimeout(timer);
	}, [phase]);

	if (phase === "rfi-draft") {
		return (
			<View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
				<StoryHeader title="RFI Draft" onBack={() => setPhase("rfi-context")} />
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
						<Button className="h-12 rounded-xl" onPress={() => setToastMsg("Opening editor...")}>
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
					<Button className="h-12 rounded-xl" onPress={() => setToastMsg("RFI sent!")}>
						<Icon as={Send} className="text-primary-foreground mr-2 size-5" />
						<Text className="text-primary-foreground text-base font-semibold">Send RFI</Text>
					</Button>
				</View>
				<StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
			</View>
		);
	}

	if (phase === "rfi-generating") {
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
							</View>
						</View>
					</View>
				</ScrollView>
			</View>
		);
	}

	if (phase === "rfi-context") {
		return (
			<View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
				<StoryHeader title="Generate RFI" onBack={() => setPhase("rfi-prompt")} />
				<ScrollView className="flex-1" contentContainerClassName="px-5 pb-8" showsVerticalScrollIndicator={false}>
					<View style={{ height: 20 }} />

					<View className="flex-row items-center gap-3">
						<View className="items-center justify-center rounded-full" style={{ width: 36, height: 36, backgroundColor: "rgba(239,68,68,0.12)" }}>
							<Icon as={TriangleAlert} className="size-4" style={{ color: "#ef4444" }} />
						</View>
						<View className="flex-1">
							<Text className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Issue Source</Text>
						</View>
					</View>

					<View style={{ height: 16 }} />

					<Text className="text-foreground text-base font-bold">Exposed Rebar at Junction Box</Text>

					<View style={{ height: 8 }} />

					<Text className="text-muted-foreground text-sm leading-relaxed">
						Rebar lacks adequate cover at electrical junction box location. May not meet ACI 318 minimum requirements.
					</Text>

					<View style={{ height: 12 }} />

					<View className="flex-row items-center gap-2">
						<Icon as={FileText} className="text-muted-foreground size-3.5" />
						<Text className="text-muted-foreground text-xs">S1.0 — Foundation Plan</Text>
					</View>

					<View style={{ height: 6 }} />

					<View className="flex-row items-center gap-2">
						<Icon as={MapPin} className="text-muted-foreground size-3.5" />
						<Text className="text-muted-foreground text-xs">5/A7 — Electrical Junction Detail</Text>
					</View>

					<View style={{ height: 28 }} />

					<Text className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Attached Evidence</Text>

					<View style={{ height: 14 }} />

					<View className="flex-row items-center gap-4">
						<View className="overflow-hidden rounded-lg" style={{ width: 72, height: 72 }}>
							<Image source={{ uri: "https://picsum.photos/seed/rebar42/200/200" }} style={{ width: "100%", height: "100%" }} />
							<View className="absolute top-1 right-1 rounded-full px-1.5 py-0.5" style={{ backgroundColor: "#ef4444" }}>
								<Text className="text-[8px] font-bold text-white">ISSUE</Text>
							</View>
						</View>
						<View className="flex-1 gap-1.5">
							<Text className="text-foreground text-sm font-semibold">Field photo</Text>
							<Text className="text-muted-foreground text-xs">Captured March 9, 2026 at 2:34 PM</Text>
						</View>
					</View>

					<View style={{ height: 16 }} />

					<View className="flex-row items-center gap-3">
						<View className="items-center justify-center rounded-full" style={{ width: 36, height: 36, backgroundColor: "rgba(59,130,246,0.12)" }}>
							<Icon as={Mic} style={{ color: "#3b82f6" }} className="size-4" />
						</View>
						<View className="flex-1">
							<Text className="text-foreground text-sm font-semibold">Voice note · 0:08</Text>
							<Text className="text-muted-foreground text-xs">"Exposed rebar at junction box, needs inspection..."</Text>
						</View>
						<Pressable className="items-center justify-center rounded-full" style={{ width: 32, height: 32, backgroundColor: "rgba(59,130,246,0.15)" }}>
							<Icon as={Play} style={{ color: "#3b82f6" }} className="size-4" />
						</Pressable>
					</View>

					<View style={{ height: 32 }} />

					<Button className="h-14 rounded-xl" onPress={() => setPhase("rfi-generating")}>
						<Icon as={Sparkles} className="text-primary-foreground mr-2 size-5" />
						<Text className="text-primary-foreground text-base font-semibold">Generate RFI Draft</Text>
					</Button>
				</ScrollView>
			</View>
		);
	}

	if (phase === "rfi-prompt") {
		return (
			<View style={{ minHeight: "100vh", position: "relative", backgroundColor: "#000" } as any}>
				<Image source={{ uri: "https://picsum.photos/seed/rebar42/1080/1920" }} style={{ width: "100%", height: "100%", position: "absolute", opacity: 0.3 }} resizeMode="cover" />
				<View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 40 }}>
					<Pressable onPress={() => setPhase("issue-preview")} style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.5)" }} />
					<View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#1c1c1c", borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
						<View className="items-center py-3"><View className="bg-muted-foreground/30 h-1 w-10 rounded-full" /></View>
						<View className="px-6 pb-6">
							<View className="mb-4 flex-row items-center gap-3">
								<View className="items-center justify-center rounded-full" style={{ width: 40, height: 40, backgroundColor: "rgba(239,68,68,0.15)" }}>
									<Icon as={Flag} style={{ color: "#ef4444" }} className="size-5" />
								</View>
								<View>
									<Text className="text-foreground text-lg font-bold">Issue Captured</Text>
									<Text className="text-muted-foreground text-sm">Would you like to generate an RFI?</Text>
								</View>
							</View>
							<View className="gap-3">
								<Pressable onPress={() => setPhase("rfi-context")} className="bg-primary flex-row items-center justify-center gap-2 rounded-xl py-3.5">
									<Icon as={Sparkles} className="text-primary-foreground size-4" />
									<Text className="text-primary-foreground text-sm font-bold">Generate RFI Draft</Text>
								</Pressable>
								<Pressable onPress={() => setPhase("issue-preview")} className="flex-row items-center justify-center rounded-xl py-3.5" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
									<Text className="text-foreground text-sm font-semibold">Skip for now</Text>
								</Pressable>
							</View>
						</View>
					</View>
				</View>
				<StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
			</View>
		);
	}

	if (phase === "issue-preview") {
		return (
			<View style={{ minHeight: "100vh", position: "relative", backgroundColor: "#000" } as any}>
				<Image source={{ uri: "https://picsum.photos/seed/rebar42/1080/1920" }} style={{ width: "100%", height: "100%", position: "absolute" }} resizeMode="cover" />

				<View style={{ position: "absolute", top: 16, left: 12, zIndex: 20, flexDirection: "row", alignItems: "center", gap: 10 }}>
					<Pressable onPress={() => setPhase("issue-capture")} className="items-center justify-center rounded-full" style={{ width: 40, height: 40, backgroundColor: "rgba(0,0,0,0.5)" }}>
						<Icon as={ChevronLeft} className="size-5 text-white" />
					</Pressable>
				</View>

				<View style={{ position: "absolute", top: 76, left: 0, right: 0, zIndex: 15, alignItems: "center" }}>
					<View className="flex-row items-center gap-2 rounded-full px-4 py-2" style={{ backgroundColor: "rgba(239,68,68,0.85)" }}>
						<Icon as={TriangleAlert} className="size-4 text-white" />
						<Text className="text-sm font-bold text-white">Issue Mode</Text>
					</View>
				</View>

				<View style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 20, backgroundColor: "rgba(0,0,0,0.78)", borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
					<View className="items-center py-3">
						<View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.25)" }} />
					</View>

					<View style={{ paddingHorizontal: 20, paddingBottom: 40 }}>
						<View className="mb-4 flex-row items-center gap-3">
							<View className="items-center justify-center rounded-full" style={{ width: 32, height: 32, backgroundColor: "rgba(34,197,94,0.15)" }}>
								<Icon as={CheckCircle} style={{ color: "#22c55e" }} className="size-5" />
							</View>
							<View className="flex-1">
								<Text style={{ color: "#ebebeb", fontSize: 14, fontWeight: "600" }}>
									Saved to 5/A7 · Foundation Plan
								</Text>
							</View>
						</View>

						<View style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, padding: 14, marginBottom: 16 }}>
							<View className="flex-row items-center gap-3">
								<View className="items-center justify-center rounded-full" style={{ width: 36, height: 36, backgroundColor: "rgba(59,130,246,0.15)" }}>
									<Icon as={Mic} style={{ color: "#3b82f6" }} className="size-4" />
								</View>
								<View className="flex-1">
									<Text style={{ color: "#ebebeb", fontSize: 14, fontWeight: "600" }}>Voice note · 0:08</Text>
								</View>
								<Pressable className="items-center justify-center rounded-full" style={{ width: 32, height: 32, backgroundColor: "rgba(59,130,246,0.2)" }}>
									<Icon as={Play} style={{ color: "#3b82f6" }} className="size-4" />
								</Pressable>
							</View>
							<Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 10, lineHeight: 18 }}>
								"Exposed rebar at junction box, needs inspection before pour..."
							</Text>
						</View>

						<View className="flex-row items-center gap-3">
							<Pressable onPress={() => setPhase("issue-capture")} className="flex-row items-center justify-center gap-2 rounded-xl py-3.5" style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.1)" }}>
								<Icon as={RotateCw} className="size-4 text-white" />
								<Text className="text-sm font-semibold text-white">Retake</Text>
							</Pressable>
							<Pressable onPress={() => setPhase("rfi-prompt")} className="bg-primary items-center justify-center rounded-xl py-3.5" style={{ flex: 1 }}>
								<Text className="text-primary-foreground text-sm font-bold">Done</Text>
							</Pressable>
						</View>
					</View>
				</View>

				<StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
			</View>
		);
	}

	return (
		<View style={{ minHeight: "100vh", position: "relative", backgroundColor: "#000" } as any}>
			<Image source={{ uri: "https://picsum.photos/seed/constructsite7/1080/1920" }} style={{ width: "100%", height: "100%", position: "absolute" }} resizeMode="cover" />

			<View style={{ position: "absolute", top: 44, left: 0, right: 0, zIndex: 20, flexDirection: "row", alignItems: "center", height: 64, paddingVertical: 10, paddingHorizontal: 16, gap: 8 }}>
				<GlassCircle onPress={() => setToastMsg("Camera closed")}>
					<Icon as={X} className="size-5 text-white" />
				</GlassCircle>
				<View style={{ flex: 1 }} />
				<GlassCircle onPress={() => setFlashOn((f) => !f)}>
					<Icon as={flashOn ? Zap : ZapOff} className="size-5 text-white" />
				</GlassCircle>
				<GlassCircle onPress={() => setToastMsg("Camera switched")}>
					<Icon as={RotateCw} className="size-5 text-white" />
				</GlassCircle>
			</View>

			<View style={{ position: "absolute", top: 76, left: 0, right: 0, zIndex: 15, alignItems: "center" }}>
				<View className="flex-row items-center gap-2 rounded-full px-4 py-2" style={{ backgroundColor: "rgba(239,68,68,0.85)" }}>
					<Icon as={TriangleAlert} className="size-4 text-white" />
					<Text className="text-sm font-bold text-white">Issue Mode</Text>
				</View>
			</View>

			<View style={{ position: "absolute", top: 580, left: 0, right: 0, zIndex: 15, alignItems: "center" }}>
				<View className="flex-row items-center" style={{ backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 20, height: 36, paddingHorizontal: 14, gap: 6 }}>
					<Icon as={MapPin} style={{ color: "#ffffff" }} className="size-3.5" />
					<Text style={{ color: "#eab308", fontSize: 13, fontWeight: "700" }}>5/A7</Text>
					<Text style={{ color: "#ebebeb", fontSize: 13 }}>· Foundation Plan</Text>
				</View>
			</View>

			<View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 212, backgroundColor: "rgba(0,0,0,0.52)", zIndex: 10 }} />

			<View style={{ position: "absolute", bottom: 126, left: 34, zIndex: 15 }}>
				<View style={{ width: 60, height: 60, borderRadius: 30, overflow: "hidden", backgroundColor: "#333" }}>
					<Image source={{ uri: "https://picsum.photos/seed/foundation55/200/200" }} style={{ width: 60, height: 60 }} />
				</View>
				<View style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.75)", alignItems: "center", justifyContent: "center" }}>
					<Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>2</Text>
				</View>
			</View>

			<View style={{ position: "absolute", bottom: 104, left: 0, right: 0, zIndex: 15, alignItems: "center" }}>
				<ShutterButton isIssueMode onPress={() => setPhase("issue-preview")} />
			</View>

			<View style={{ position: "absolute", bottom: 120, right: 34, zIndex: 15 }}>
				<View
					className="items-center justify-center"
					style={{
						width: 56, height: 56, borderRadius: 28,
						backgroundColor: "rgba(239,68,68,0.25)",
						borderWidth: 1.5,
						borderColor: "#ef4444",
					}}
				>
					<Icon as={TriangleAlert} className="size-5" style={{ color: "#ef4444" }} />
					<Text style={{ fontSize: 10, fontWeight: "700", color: "#ef4444", marginTop: 2 }}>Issue</Text>
				</View>
			</View>

			<View style={{ position: "absolute", bottom: 44, left: 0, right: 0, zIndex: 15, alignItems: "center" }}>
				<Text style={{ color: "#ebebeb", fontSize: 13, fontWeight: "700" }}>PHOTO</Text>
			</View>

			<StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
		</View>
	);
}

const meta: Meta = {
	title: "Flows/Cross-Flow Bridges",
	parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj;

export const PlanView: Story = {
	name: "P0-2: 1. Plan View",
	render: () => <PlanToCapture initialPhase="plan-view" />,
};

export const CalloutSelected: Story = {
	name: "P0-2: 2. Callout Selected",
	render: () => <PlanToCapture initialPhase="callout-selected" />,
};

export const CameraLinked: Story = {
	name: "P0-2: 3. Camera Linked",
	render: () => <PlanToCapture initialPhase="camera-linked" />,
};

export const CapturePreview: Story = {
	name: "P0-2: 4. Capture Preview",
	render: () => <PlanToCapture initialPhase="capture-preview" />,
};

export const PlanToCaptureFullFlow: Story = {
	name: "P0-2: Full Flow",
	render: () => <PlanToCapture initialPhase="plan-view" />,
};

export const IssueCapture: Story = {
	name: "P0-3: 1. Issue Capture",
	render: () => <CaptureToRfi initialPhase="issue-capture" />,
};

export const IssuePreview: Story = {
	name: "P0-3: 2. Issue Preview",
	render: () => <CaptureToRfi initialPhase="issue-preview" />,
};

export const RfiPrompt: Story = {
	name: "P0-3: 3. RFI Prompt",
	render: () => <CaptureToRfi initialPhase="rfi-prompt" />,
};

export const RfiContext: Story = {
	name: "P0-3: 4. RFI Context",
	render: () => <CaptureToRfi initialPhase="rfi-context" />,
};

export const RfiGenerating: Story = {
	name: "P0-3: 5. RFI Generating",
	render: () => <CaptureToRfi initialPhase="rfi-generating" />,
};

export const RfiDraft: Story = {
	name: "P0-3: 6. RFI Draft",
	render: () => <CaptureToRfi initialPhase="rfi-draft" />,
};

export const CaptureToRfiFullFlow: Story = {
	name: "P0-3: Full Flow",
	render: () => <CaptureToRfi initialPhase="issue-capture" />,
};
