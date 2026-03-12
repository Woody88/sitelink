import type { Meta, StoryObj } from "@storybook/react";
import {
	ArrowRight,
	Check,
	CheckCircle,
	ChevronRight,
	FileText,
	Layers,
	Link2,
	Loader,
	MapPin,
	ScanLine,
	Sparkles,
	Upload,
	X,
	Zap,
} from "lucide-react-native";
import * as React from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

interface ProcessingStep {
	key: string;
	label: string;
	icon: typeof FileText;
	color: string;
	detail?: string;
}

const PROCESSING_STEPS: ProcessingStep[] = [
	{ key: "upload", label: "Uploading plan", icon: Upload, color: "#3b82f6", detail: "structural-plans-v3.pdf" },
	{ key: "pages", label: "Splitting pages", icon: FileText, color: "#3b82f6", detail: "12 sheets detected" },
	{ key: "metadata", label: "Reading sheet titles", icon: Layers, color: "#a855f7", detail: "S1.0, S2.0, S3.0..." },
	{ key: "callouts", label: "Detecting callouts", icon: ScanLine, color: "#f59e0b", detail: "Scanning for detail markers, sections, elevations..." },
	{ key: "linking", label: "Linking references", icon: Link2, color: "#22c55e", detail: "Matching callouts to destination sheets" },
	{ key: "tiles", label: "Generating tiles", icon: Zap, color: "#22c55e", detail: "Creating zoomable view layers" },
];

interface RevealStat {
	icon: typeof FileText;
	color: string;
	label: string;
	value: string;
}

const REVEAL_STATS: RevealStat[] = [
	{ icon: FileText, color: "#3b82f6", label: "Sheets", value: "12" },
	{ icon: MapPin, color: "#22c55e", label: "Callouts", value: "47" },
	{ icon: Link2, color: "#a855f7", label: "Links", value: "38" },
];

interface SheetPreview {
	id: string;
	number: string;
	title: string;
	calloutCount: number;
	linkCount: number;
}

const MOCK_SHEETS: SheetPreview[] = [
	{ id: "s1", number: "S1.0", title: "Foundation Plan", calloutCount: 8, linkCount: 6 },
	{ id: "s2", number: "S1.1", title: "Foundation Details", calloutCount: 4, linkCount: 4 },
	{ id: "s3", number: "S2.0", title: "Second Floor Framing", calloutCount: 6, linkCount: 5 },
	{ id: "s4", number: "S2.1", title: "Framing Details", calloutCount: 5, linkCount: 5 },
	{ id: "s5", number: "S3.0", title: "Roof Framing Plan", calloutCount: 7, linkCount: 6 },
	{ id: "s6", number: "S3.1", title: "Roof Details", calloutCount: 3, linkCount: 3 },
	{ id: "s7", number: "S4.0", title: "Sections", calloutCount: 4, linkCount: 3 },
	{ id: "s8", number: "S4.1", title: "Wall Sections", calloutCount: 3, linkCount: 2 },
	{ id: "s9", number: "S5.0", title: "Elevations", calloutCount: 2, linkCount: 1 },
	{ id: "s10", number: "S6.0", title: "Schedules", calloutCount: 3, linkCount: 2 },
	{ id: "s11", number: "S7.0", title: "General Notes", calloutCount: 1, linkCount: 0 },
	{ id: "s12", number: "S7.1", title: "Typical Details", calloutCount: 1, linkCount: 1 },
];

function UploadScreen({
	onUpload,
}: {
	onUpload: () => void;
}) {
	return (
		<View className="bg-background" style={{ minHeight: "100vh" } as any}>
			{/* Header */}
			<View className="px-6 pt-8 pb-4">
				<Text className="text-foreground text-2xl font-bold">
					Add Your Plans
				</Text>
				<Text className="text-muted-foreground mt-1 text-base">
					Upload a PDF and watch the magic happen
				</Text>
			</View>

			{/* Upload zone */}
			<View className="flex-1 px-6">
				<Pressable
					onPress={onUpload}
					className="items-center justify-center rounded-3xl border-2 border-dashed py-16 active:opacity-80"
					style={{ borderColor: "rgba(255,255,255,0.15)", backgroundColor: "rgba(255,255,255,0.03)" }}
				>
					<View
						className="mb-5 items-center justify-center rounded-full"
						style={{ width: 72, height: 72, backgroundColor: "rgba(245,245,245,0.08)" }}
					>
						<Icon as={Upload} className="text-primary size-8" />
					</View>
					<Text className="text-foreground text-lg font-bold">
						Tap to upload PDF
					</Text>
					<Text className="text-muted-foreground mt-2 text-center text-sm leading-relaxed">
						Your structural plans, details, and schedules{"\n"}all in one file
					</Text>
					<View className="bg-primary mt-6 flex-row items-center gap-2 rounded-full px-6 py-3">
						<Icon as={FileText} className="text-primary-foreground size-4" />
						<Text className="text-primary-foreground text-sm font-bold">Choose File</Text>
					</View>
				</Pressable>

				{/* What happens next */}
				<View className="mt-8">
					<Text className="text-muted-foreground mb-4 text-xs font-bold uppercase tracking-wider">
						What happens next
					</Text>
					<View className="gap-4">
						{[
							{ icon: ScanLine, color: "#f59e0b", text: "AI scans every sheet for callout symbols" },
							{ icon: Link2, color: "#22c55e", text: "Callouts are automatically linked to their target details" },
							{ icon: Sparkles, color: "#a855f7", text: "Schedules and tables are extracted for quick reference" },
						].map((item, i) => (
							<View key={i} className="flex-row items-center gap-3">
								<View
									className="items-center justify-center rounded-full"
									style={{ width: 36, height: 36, backgroundColor: item.color + "15" }}
								>
									<Icon as={item.icon} style={{ color: item.color }} className="size-4" />
								</View>
								<Text className="text-foreground flex-1 text-sm">{item.text}</Text>
							</View>
						))}
					</View>
				</View>

				{/* Format note */}
				<View className="mt-6 items-center pb-8">
					<Text className="text-muted-foreground text-xs">
						Supported: PDF, JPEG, PNG — Recommended: 300 DPI
					</Text>
				</View>
			</View>
		</View>
	);
}

function ProcessingScreen({
	initialStep = 0,
	autoAdvance = true,
	onComplete,
}: {
	initialStep?: number;
	autoAdvance?: boolean;
	onComplete?: () => void;
}) {
	const [stepIndex, setStepIndex] = React.useState(initialStep);
	const [subProgress, setSubProgress] = React.useState(0);
	const isComplete = stepIndex >= PROCESSING_STEPS.length;

	React.useEffect(() => {
		if (!autoAdvance || isComplete) return;
		const timer = setInterval(() => {
			setSubProgress((prev) => {
				if (prev >= 100) {
					setStepIndex((s) => s + 1);
					return 0;
				}
				return prev + Math.random() * 20 + 5;
			});
		}, 400);
		return () => clearInterval(timer);
	}, [autoAdvance, isComplete]);

	React.useEffect(() => {
		if (isComplete && onComplete) {
			const timer = setTimeout(onComplete, 500);
			return () => clearTimeout(timer);
		}
	}, [isComplete, onComplete]);

	const currentStep = PROCESSING_STEPS[stepIndex];
	const progress = isComplete ? 100 : ((stepIndex + Math.min(subProgress, 100) / 100) / PROCESSING_STEPS.length) * 100;

	return (
		<View className="bg-background" style={{ minHeight: "100vh" } as any}>
			{/* Header */}
			<View className="flex-row items-center justify-between px-6 py-4">
				<Text className="text-foreground text-lg font-bold">Processing Plan</Text>
				{!isComplete && (
					<View className="rounded-full px-2.5 py-1" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
						<Text className="text-muted-foreground text-xs font-semibold" style={{ fontVariant: ["tabular-nums"] }}>
							{stepIndex + 1}/{PROCESSING_STEPS.length}
						</Text>
					</View>
				)}
			</View>

			{/* Progress bar */}
			<View className="px-6 pb-2">
				<View className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
					<View
						className="h-full rounded-full"
						style={{
							width: `${Math.min(progress, 100)}%` as any,
							backgroundColor: isComplete ? "#22c55e" : "#3b82f6",
						}}
					/>
				</View>
			</View>

			{/* Current step highlight */}
			<View className="items-center px-6 py-8">
				{isComplete ? (
					<>
						<View
							className="mb-4 items-center justify-center rounded-full"
							style={{ width: 80, height: 80, backgroundColor: "rgba(34,197,94,0.15)" }}
						>
							<Icon as={CheckCircle} style={{ color: "#22c55e" }} className="size-10" />
						</View>
						<Text className="text-foreground text-2xl font-bold">All Done!</Text>
						<Text className="text-muted-foreground mt-1 text-sm">Your plan is ready to explore</Text>
					</>
				) : (
					<>
						<View
							className="mb-4 items-center justify-center rounded-full"
							style={{ width: 80, height: 80, backgroundColor: (currentStep?.color ?? "#3b82f6") + "15" }}
						>
							<Icon
								as={currentStep?.icon ?? Loader}
								style={{ color: currentStep?.color ?? "#3b82f6" }}
								className="size-10"
							/>
						</View>
						<Text className="text-foreground text-xl font-bold">
							{currentStep?.label}
						</Text>
						{currentStep?.detail && (
							<Text className="text-muted-foreground mt-1 text-center text-sm">
								{currentStep.detail}
							</Text>
						)}
					</>
				)}
			</View>

			{/* Step list */}
			<View className="flex-1 px-6">
				<View className="gap-1">
					{PROCESSING_STEPS.map((step, idx) => {
						const status = isComplete
							? "completed"
							: idx < stepIndex
								? "completed"
								: idx === stepIndex
									? "active"
									: "pending";
						return (
							<View
								key={step.key}
								className={cn(
									"flex-row items-center gap-3 rounded-xl px-4 py-3",
									status === "active" && "bg-muted/15",
								)}
							>
								{status === "completed" ? (
									<View
										className="items-center justify-center rounded-full"
										style={{ width: 28, height: 28, backgroundColor: "rgba(34,197,94,0.15)" }}
									>
										<Icon as={Check} style={{ color: "#22c55e" }} className="size-4" />
									</View>
								) : (
									<View
										className="items-center justify-center rounded-full"
										style={{
											width: 28,
											height: 28,
											backgroundColor:
												status === "active" ? step.color + "15" : "rgba(255,255,255,0.05)",
										}}
									>
										<Icon
											as={step.icon}
											style={{
												color: status === "active" ? step.color : undefined,
											}}
											className={cn("size-4", status === "pending" && "text-muted-foreground/40")}
										/>
									</View>
								)}
								<Text
									className={cn(
										"flex-1 text-sm font-medium",
										status === "completed" && "text-muted-foreground line-through",
										status === "active" && "text-foreground",
										status === "pending" && "text-muted-foreground/40",
									)}
								>
									{step.label}
								</Text>
								{status === "completed" && step.detail && (
									<Text className="text-muted-foreground text-xs">
										{step.key === "pages" ? "12 sheets" : step.key === "callouts" ? "47 found" : ""}
									</Text>
								)}
							</View>
						);
					})}
				</View>
			</View>

			{/* Bottom note */}
			<View className="items-center px-6 pb-8">
				<Text className="text-muted-foreground text-center text-xs leading-relaxed">
					{isComplete
						? "Tap below to start exploring your plans"
						: "This usually takes 1-2 minutes. You can close this screen — we'll notify you when it's done."}
				</Text>
				{isComplete && (
					<Pressable className="bg-primary mt-4 flex-row items-center gap-2 rounded-xl px-8 py-4">
						<Text className="text-primary-foreground text-base font-bold">View Plans</Text>
						<Icon as={ArrowRight} className="text-primary-foreground size-5" />
					</Pressable>
				)}
			</View>
		</View>
	);
}

function RevealScreen({
	onViewSheet,
	onViewAll,
}: {
	onViewSheet?: (sheet: SheetPreview) => void;
	onViewAll?: () => void;
}) {
	return (
		<View className="bg-background" style={{ minHeight: "100vh" } as any}>
			{/* Hero section */}
			<View
				className="items-center px-6 pt-8 pb-6"
				style={{ backgroundColor: "rgba(34,197,94,0.03)" }}
			>
				<View
					className="mb-4 items-center justify-center rounded-full"
					style={{ width: 72, height: 72, backgroundColor: "rgba(34,197,94,0.12)" }}
				>
					<Icon as={Sparkles} style={{ color: "#22c55e" }} className="size-8" />
				</View>
				<Text className="text-foreground text-2xl font-bold">Your Plans Are Ready</Text>
				<Text className="text-muted-foreground mt-1 text-center text-sm">
					structural-plans-v3.pdf
				</Text>

				{/* Stats row */}
				<View className="mt-6 flex-row gap-4">
					{REVEAL_STATS.map((stat) => (
						<View
							key={stat.label}
							className="flex-1 items-center rounded-2xl py-4"
							style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
						>
							<View
								className="mb-2 items-center justify-center rounded-full"
								style={{ width: 36, height: 36, backgroundColor: stat.color + "15" }}
							>
								<Icon as={stat.icon} style={{ color: stat.color }} className="size-4" />
							</View>
							<Text className="text-foreground text-2xl font-bold">{stat.value}</Text>
							<Text className="text-muted-foreground text-xs font-medium">{stat.label}</Text>
						</View>
					))}
				</View>

				{/* Confidence summary */}
				<View
					className="mt-4 w-full flex-row items-center gap-2 rounded-xl px-4 py-3"
					style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
				>
					<Icon as={CheckCircle} style={{ color: "#22c55e" }} className="size-4" />
					<Text className="text-foreground flex-1 text-sm">
						<Text className="font-bold">38 of 47</Text> callouts auto-linked
					</Text>
					<Text className="text-muted-foreground text-xs">81% linked</Text>
				</View>

				{/* Low confidence note */}
				<View
					className="mt-2 w-full flex-row items-center gap-2 rounded-xl px-4 py-3"
					style={{ backgroundColor: "rgba(234,88,12,0.06)" }}
				>
					<Icon as={ScanLine} style={{ color: "#ea580c" }} className="size-4" />
					<Text className="text-muted-foreground flex-1 text-sm">
						<Text className="text-foreground font-semibold">9 callouts</Text> need manual review
					</Text>
					<Text style={{ color: "#ea580c" }} className="text-xs font-semibold">Review</Text>
				</View>
			</View>

			{/* Sheets list */}
			<View className="flex-1">
				<View className="flex-row items-center justify-between px-6 py-4">
					<Text className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
						Detected Sheets
					</Text>
					<Text className="text-muted-foreground text-xs">
						{MOCK_SHEETS.length} sheets
					</Text>
				</View>

				<ScrollView className="flex-1" showsVerticalScrollIndicator>
					{MOCK_SHEETS.map((sheet) => (
						<Pressable
							key={sheet.id}
							onPress={() => onViewSheet?.(sheet)}
							className="active:bg-muted/20 flex-row items-center gap-3 px-6 py-3"
						>
							{/* Sheet thumbnail placeholder */}
							<View
								className="items-center justify-center overflow-hidden rounded-lg"
								style={{ width: 48, height: 48, backgroundColor: "rgba(255,255,255,0.05)" }}
							>
								<Image
									source={{ uri: "/plan-sample.png" }}
									style={{ width: 48, height: 48 }}
									resizeMode="cover"
								/>
							</View>
							<View className="flex-1">
								<View className="flex-row items-center gap-2">
									<Text className="text-foreground text-sm font-bold">{sheet.number}</Text>
									<Text className="text-foreground text-sm">{sheet.title}</Text>
								</View>
								<View className="mt-0.5 flex-row items-center gap-3">
									<View className="flex-row items-center gap-1">
										<Icon as={MapPin} className="text-muted-foreground size-3" />
										<Text className="text-muted-foreground text-xs">
											{sheet.calloutCount} callouts
										</Text>
									</View>
									<View className="flex-row items-center gap-1">
										<Icon as={Link2} className="text-muted-foreground size-3" />
										<Text className="text-muted-foreground text-xs">
											{sheet.linkCount} linked
										</Text>
									</View>
								</View>
							</View>
							<Icon as={ChevronRight} className="text-muted-foreground size-4" />
						</Pressable>
					))}
					<View style={{ height: 100 }} />
				</ScrollView>
			</View>

			{/* Bottom CTA */}
			<View
				style={{
					position: "absolute",
					bottom: 0,
					left: 0,
					right: 0,
					paddingHorizontal: 20,
					paddingBottom: 32,
					paddingTop: 16,
					backgroundColor: "#121212",
				}}
			>
				<Pressable
					onPress={onViewAll}
					className="bg-primary flex-row items-center justify-center gap-2 rounded-xl py-4"
				>
					<Text className="text-primary-foreground text-base font-bold">
						Start Exploring
					</Text>
					<Icon as={ArrowRight} className="text-primary-foreground size-5" />
				</Pressable>
			</View>
		</View>
	);
}

type FirstRunPhase = "upload" | "processing" | "reveal";

function FirstRunScreen({
	initialPhase = "upload",
}: {
	initialPhase?: FirstRunPhase;
}) {
	const [phase, setPhase] = React.useState<FirstRunPhase>(initialPhase);

	if (phase === "upload") {
		return <UploadScreen onUpload={() => setPhase("processing")} />;
	}

	if (phase === "processing") {
		return (
			<ProcessingScreen
				autoAdvance
				onComplete={() => setPhase("reveal")}
			/>
		);
	}

	return (
		<RevealScreen
			onViewSheet={() => {}}
			onViewAll={() => {}}
		/>
	);
}

const meta: Meta<typeof FirstRunScreen> = {
	title: "Priority 3 — First Run Experience",
	component: FirstRunScreen,
	parameters: {
		layout: "fullscreen",
	},
};

export default meta;
type Story = StoryObj<typeof FirstRunScreen>;

export const UploadPlans: Story = {
	name: "1. Upload Plans",
	args: {
		initialPhase: "upload",
	},
};

export const Processing: Story = {
	name: "2. Processing (Auto-Advance)",
	args: {
		initialPhase: "processing",
	},
};

export const RevealResults: Story = {
	name: "3. Reveal — We Found 47 Callouts",
	args: {
		initialPhase: "reveal",
	},
};

export const FullFlow: Story = {
	name: "4. Full Flow (Upload → Processing → Reveal)",
	args: {
		initialPhase: "upload",
	},
};
