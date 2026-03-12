import type { Meta, StoryObj } from "@storybook/react";
import {
	AlertTriangle,
	ArrowLeft,
	Camera,
	Check,
	ChevronDown,
	ChevronRight,
	ExternalLink,
	Flag,
	Layers,
	MapPin,
	Maximize,
	Plus,
	ScanLine,
	ShieldAlert,
	TableProperties,
	X,
	ZoomIn,
	ZoomOut,
} from "lucide-react-native";
import * as React from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

const MARKER_COLORS = {
	detail: "#22c55e",
	section: "#3b82f6",
	elevation: "#f59e0b",
	note: "#a855f7",
	selected: "#facc15",
} as const;

interface CalloutMarker {
	id: string;
	label: string;
	type: keyof typeof MARKER_COLORS;
	targetSheet: string;
	targetSheetTitle: string;
	detailNumber: string;
	confidence: number;
	description: string;
	top: string;
	left: string;
	width: string;
	height: string;
}

const MOCK_MARKERS: CalloutMarker[] = [
	{
		id: "m1",
		label: "5/A7",
		type: "detail",
		targetSheet: "S2.0",
		targetSheetTitle: "Structural Details",
		detailNumber: "5",
		confidence: 0.96,
		description: "Footing connection detail at grid line A7",
		top: "52%",
		left: "7%",
		width: "6%",
		height: "4%",
	},
	{
		id: "m2",
		label: "3/A2",
		type: "section",
		targetSheet: "S3.0",
		targetSheetTitle: "Sections & Elevations",
		detailNumber: "3",
		confidence: 0.91,
		description: "Stage framing section cut through grid B",
		top: "60%",
		left: "18%",
		width: "8%",
		height: "5%",
	},
	{
		id: "m3",
		label: "2/A1",
		type: "detail",
		targetSheet: "S2.0",
		targetSheetTitle: "Structural Details",
		detailNumber: "2",
		confidence: 0.73,
		description: "Strip footing detail — low confidence match",
		top: "42%",
		left: "28%",
		width: "5%",
		height: "4%",
	},
	{
		id: "m4",
		label: "E1",
		type: "elevation",
		targetSheet: "S3.0",
		targetSheetTitle: "Sections & Elevations",
		detailNumber: "E1",
		confidence: 0.45,
		description: "North elevation — may be incorrect",
		top: "30%",
		left: "65%",
		width: "7%",
		height: "5%",
	},
];

function GlassButton({
	children,
	size = 44,
	onPress,
}: {
	children: React.ReactNode;
	size?: number;
	onPress?: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			className="items-center justify-center rounded-full"
			style={{ width: size, height: size, backgroundColor: "rgba(0,0,0,0.6)" }}
		>
			{children}
		</Pressable>
	);
}

function MarkerOverlay({
	marker,
	isSelected,
	onPress,
}: {
	marker: CalloutMarker;
	isSelected?: boolean;
	onPress: () => void;
}) {
	const color = isSelected ? MARKER_COLORS.selected : MARKER_COLORS[marker.type];
	const isLowConfidence = marker.confidence < 0.8;
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
				borderStyle: isLowConfidence ? "dashed" : "solid",
				backgroundColor: isSelected ? "rgba(250,204,21,0.12)" : "transparent",
				zIndex: 5,
			}}
		>
			<View
				style={{
					position: "absolute",
					top: -24,
					left: 0,
					flexDirection: "row",
					alignItems: "center",
					gap: 3,
				}}
			>
				<View
					style={{
						backgroundColor: color,
						borderRadius: 4,
						paddingHorizontal: 6,
						paddingVertical: 2,
					}}
				>
					<Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
						{marker.label}
					</Text>
				</View>
				{isLowConfidence && (
					<View
						style={{
							backgroundColor: "rgba(234,88,12,0.9)",
							borderRadius: 4,
							paddingHorizontal: 4,
							paddingVertical: 2,
						}}
					>
						<Text style={{ color: "#fff", fontSize: 9, fontWeight: "700" }}>?</Text>
					</View>
				)}
			</View>
		</Pressable>
	);
}

function ConfidenceIndicator({ confidence }: { confidence: number }) {
	if (confidence >= 0.9)
		return (
			<View className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1" style={{ backgroundColor: "rgba(22,163,74,0.15)" }}>
				<View className="size-1.5 rounded-full bg-green-500" />
				<Text style={{ color: "#16a34a" }} className="text-xs font-semibold">
					{Math.round(confidence * 100)}% match
				</Text>
			</View>
		);
	if (confidence >= 0.8)
		return (
			<View className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1" style={{ backgroundColor: "rgba(202,138,4,0.15)" }}>
				<View className="size-1.5 rounded-full bg-yellow-500" />
				<Text style={{ color: "#ca8a04" }} className="text-xs font-semibold">
					{Math.round(confidence * 100)}% match
				</Text>
			</View>
		);
	if (confidence >= 0.6)
		return (
			<View className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1" style={{ backgroundColor: "rgba(234,88,12,0.15)" }}>
				<Icon as={AlertTriangle} style={{ color: "#ea580c" }} className="size-3" />
				<Text style={{ color: "#ea580c" }} className="text-xs font-semibold">
					{Math.round(confidence * 100)}% — verify on sheet
				</Text>
			</View>
		);
	return (
		<View className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1" style={{ backgroundColor: "rgba(239,68,68,0.15)" }}>
			<Icon as={ShieldAlert} style={{ color: "#ef4444" }} className="size-3" />
			<Text style={{ color: "#ef4444" }} className="text-xs font-semibold">
				{Math.round(confidence * 100)}% — likely incorrect
			</Text>
		</View>
	);
}

function CalloutDetailSheet({
	marker,
	onClose,
	onGoToDetail,
	onTakePhoto,
	onReportWrong,
}: {
	marker: CalloutMarker;
	onClose: () => void;
	onGoToDetail: () => void;
	onTakePhoto?: () => void;
	onReportWrong?: () => void;
}) {
	const color = MARKER_COLORS[marker.type];
	const isLowConfidence = marker.confidence < 0.8;

	return (
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
			<Pressable onPress={onClose} className="mb-4 items-center">
				<View className="bg-muted h-1 w-10 rounded-full" />
			</Pressable>

			{/* Header: label + type + confidence */}
			<View className="mb-3 flex-row items-start justify-between">
				<View className="flex-row items-center gap-2.5">
					<View
						className="items-center justify-center rounded-lg"
						style={{ width: 40, height: 40, backgroundColor: color + "20" }}
					>
						<Text style={{ color, fontSize: 16, fontWeight: "800" }}>
							{marker.detailNumber}
						</Text>
					</View>
					<View>
						<Text className="text-foreground text-lg font-bold">{marker.label}</Text>
						<View className="flex-row items-center gap-1.5">
							<View
								className="rounded-full px-2 py-0.5"
								style={{ backgroundColor: color + "20" }}
							>
								<Text style={{ color, fontSize: 11, fontWeight: "600" }}>
									{marker.type.charAt(0).toUpperCase() + marker.type.slice(1)}
								</Text>
							</View>
						</View>
					</View>
				</View>
				<ConfidenceIndicator confidence={marker.confidence} />
			</View>

			{/* Target sheet info */}
			<View
				className="mb-3 flex-row items-center gap-3 rounded-xl px-4 py-3"
				style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
			>
				<View className="flex-1">
					<Text className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
						Destination
					</Text>
					<Text className="text-foreground mt-0.5 text-base font-semibold">
						Sheet {marker.targetSheet}
					</Text>
					<Text className="text-muted-foreground text-sm">
						{marker.targetSheetTitle}
					</Text>
				</View>
				{/* Thumbnail preview placeholder */}
				<View
					className="items-center justify-center overflow-hidden rounded-lg"
					style={{ width: 64, height: 64, backgroundColor: "rgba(255,255,255,0.08)" }}
				>
					<Image
						source={{ uri: "/plan-sample.png" }}
						style={{ width: 64, height: 64 }}
						resizeMode="cover"
					/>
					{/* Highlight overlay on thumbnail */}
					<View
						style={{
							position: "absolute",
							top: 16,
							left: 16,
							width: 20,
							height: 20,
							borderWidth: 2,
							borderColor: color,
							borderRadius: 3,
							backgroundColor: color + "20",
						}}
					/>
				</View>
			</View>

			<Text className="text-muted-foreground mb-4 text-sm">
				{marker.description}
			</Text>

			{/* Low confidence warning */}
			{isLowConfidence && (
				<View
					className="mb-4 flex-row items-start gap-3 rounded-xl px-4 py-3"
					style={{ backgroundColor: "rgba(234,88,12,0.08)" }}
				>
					<Icon as={AlertTriangle} style={{ color: "#ea580c" }} className="mt-0.5 size-4" />
					<View className="flex-1">
						<Text style={{ color: "#ea580c" }} className="text-sm font-semibold">
							{marker.confidence < 0.6 ? "Link may be incorrect" : "Low confidence match"}
						</Text>
						<Text className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
							{marker.confidence < 0.6
								? "Our AI couldn't confidently match this callout. The destination may be wrong — please verify manually."
								: "This callout was detected with lower confidence. Double-check the detail number matches what you expect."}
						</Text>
					</View>
				</View>
			)}

			{/* Action buttons */}
			<View className="flex-row gap-3">
				<Pressable
					onPress={onGoToDetail}
					className="bg-primary flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3.5"
				>
					<Icon as={ExternalLink} className="text-primary-foreground size-4" />
					<Text className="text-primary-foreground text-sm font-bold">
						Go to Detail
					</Text>
				</Pressable>
				<Pressable
					onPress={onTakePhoto}
					className="flex-row items-center justify-center gap-2 rounded-xl px-4 py-3.5"
					style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
				>
					<Icon as={Camera} className="text-foreground size-4" />
					<Text className="text-foreground text-sm font-semibold">Photo</Text>
				</Pressable>
			</View>

			{/* Report wrong link */}
			{isLowConfidence && (
				<Pressable
					onPress={onReportWrong}
					className="mt-3 flex-row items-center justify-center gap-2 py-2"
				>
					<Icon as={Flag} className="text-muted-foreground size-3.5" />
					<Text className="text-muted-foreground text-xs font-medium">
						Report wrong link
					</Text>
				</Pressable>
			)}
		</View>
	);
}

function NavigationBreadcrumb({
	fromSheet,
	fromLabel,
	onGoBack,
}: {
	fromSheet: string;
	fromLabel: string;
	onGoBack: () => void;
}) {
	return (
		<View
			style={{
				position: "absolute",
				top: 16,
				left: 68,
				right: 68,
				zIndex: 25,
				alignItems: "center",
			}}
		>
			<Pressable
				onPress={onGoBack}
				className="flex-row items-center gap-2 rounded-full px-4 py-2.5 active:opacity-80"
				style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
			>
				<Icon as={ArrowLeft} className="size-4 text-white" />
				<Text className="text-sm font-semibold text-white">
					Back to {fromSheet}
				</Text>
				<View className="ml-1 rounded-full px-1.5 py-0.5" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
					<Text className="text-xs text-white/70">{fromLabel}</Text>
				</View>
			</Pressable>
		</View>
	);
}

function DestinationHighlight({
	detailNumber,
	color,
}: {
	detailNumber: string;
	color: string;
}) {
	return (
		<View
			style={{
				position: "absolute",
				top: "35%",
				left: "20%",
				width: "30%",
				height: "25%",
				borderWidth: 3,
				borderColor: color,
				borderRadius: 8,
				backgroundColor: color + "10",
				zIndex: 5,
			}}
		>
			{/* Pulsing ring effect (static for storybook) */}
			<View
				style={{
					position: "absolute",
					top: -6,
					left: -6,
					right: -6,
					bottom: -6,
					borderWidth: 2,
					borderColor: color + "40",
					borderRadius: 11,
				}}
			/>
			{/* Detail label */}
			<View
				style={{
					position: "absolute",
					top: -28,
					left: 0,
					backgroundColor: color,
					borderRadius: 6,
					paddingHorizontal: 8,
					paddingVertical: 4,
					flexDirection: "row",
					alignItems: "center",
					gap: 4,
				}}
			>
				<Icon as={Check} style={{ color: "#fff" }} className="size-3" />
				<Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
					Detail {detailNumber}
				</Text>
			</View>
		</View>
	);
}

function WrongLinkSheet({
	marker,
	onClose,
	onSubmit,
}: {
	marker: CalloutMarker;
	onClose: () => void;
	onSubmit: () => void;
}) {
	const [selectedReason, setSelectedReason] = React.useState<string | null>(null);

	const reasons = [
		{ id: "wrong-sheet", label: "Points to wrong sheet" },
		{ id: "wrong-detail", label: "Wrong detail number" },
		{ id: "not-a-callout", label: "Not actually a callout" },
		{ id: "other", label: "Other issue" },
	];

	return (
		<View
			style={{
				position: "absolute",
				top: 0,
				bottom: 0,
				left: 0,
				right: 0,
				zIndex: 50,
			}}
		>
			<Pressable
				onPress={onClose}
				style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.5)" }}
			/>
			<View
				style={{
					position: "absolute",
					bottom: 0,
					left: 0,
					right: 0,
					backgroundColor: "#1c1c1c",
					borderTopLeftRadius: 24,
					borderTopRightRadius: 24,
				}}
			>
				<View className="items-center py-3">
					<View className="bg-muted-foreground/30 h-1 w-10 rounded-full" />
				</View>

				<View className="flex-row items-center justify-between px-6 pb-2">
					<View>
						<Text className="text-foreground text-lg font-bold">Report Issue</Text>
						<Text className="text-muted-foreground text-sm">
							Help improve callout detection for {marker.label}
						</Text>
					</View>
					<Pressable
						onPress={onClose}
						className="bg-muted/20 active:bg-muted/40 size-8 items-center justify-center rounded-full"
					>
						<Icon as={X} className="text-foreground size-5" />
					</Pressable>
				</View>

				<View className="gap-2 px-6 pt-2 pb-6">
					{reasons.map((reason) => (
						<Pressable
							key={reason.id}
							onPress={() => setSelectedReason(reason.id)}
							className={cn(
								"flex-row items-center gap-3 rounded-xl border-2 px-4 py-3.5",
								selectedReason === reason.id
									? "border-primary bg-primary/5"
									: "border-border bg-muted/5",
							)}
						>
							<View
								className={cn(
									"size-5 items-center justify-center rounded-full border-2",
									selectedReason === reason.id ? "border-primary bg-primary" : "border-muted-foreground/30",
								)}
							>
								{selectedReason === reason.id && (
									<View className="size-2 rounded-full bg-white" />
								)}
							</View>
							<Text className={cn(
								"text-sm font-medium",
								selectedReason === reason.id ? "text-foreground" : "text-muted-foreground",
							)}>
								{reason.label}
							</Text>
						</Pressable>
					))}

					<Pressable
						onPress={onSubmit}
						disabled={!selectedReason}
						className={cn(
							"mt-2 flex-row items-center justify-center gap-2 rounded-xl py-3.5",
							selectedReason ? "bg-primary" : "bg-muted/20",
						)}
					>
						<Icon
							as={Flag}
							className={cn("size-4", selectedReason ? "text-primary-foreground" : "text-muted-foreground")}
						/>
						<Text
							className={cn(
								"text-sm font-bold",
								selectedReason ? "text-primary-foreground" : "text-muted-foreground",
							)}
						>
							Submit Report
						</Text>
					</Pressable>

					<Text className="text-muted-foreground mt-1 text-center text-xs">
						Reports help our AI learn. The link will be flagged for review.
					</Text>
				</View>
			</View>
		</View>
	);
}

type ViewState = "source" | "navigating" | "destination" | "report-wrong";

function CalloutNavigationScreen({
	initialMarker,
	initialState = "source",
}: {
	initialMarker?: string;
	initialState?: ViewState;
}) {
	const [selectedMarkerId, setSelectedMarkerId] = React.useState<string | undefined>(initialMarker);
	const [viewState, setViewState] = React.useState<ViewState>(initialState);
	const [fromSheet] = React.useState("S1.0");
	const [currentSheet, setCurrentSheet] = React.useState("S1.0");

	const selectedMarker = selectedMarkerId
		? MOCK_MARKERS.find((m) => m.id === selectedMarkerId)
		: undefined;

	const handleMarkerPress = (id: string) => {
		setSelectedMarkerId((prev) => (prev === id ? undefined : id));
		setViewState("source");
	};

	const handleGoToDetail = () => {
		if (!selectedMarker) return;
		setViewState("navigating");
		setTimeout(() => {
			setCurrentSheet(selectedMarker.targetSheet);
			setViewState("destination");
		}, 800);
	};

	const handleGoBack = () => {
		setCurrentSheet(fromSheet);
		setViewState("source");
	};

	const isOnDestination = viewState === "destination" || viewState === "navigating";

	return (
		<View style={{ minHeight: "100vh", position: "relative", backgroundColor: "#0a0a0a" } as any}>
			{/* Plan image background */}
			<Image
				source={{ uri: "/plan-sample.png" }}
				style={{
					width: "100%",
					height: "100%",
					position: "absolute",
					opacity: viewState === "navigating" ? 0.3 : 1,
				}}
				resizeMode="contain"
			/>

			{/* Navigating transition overlay */}
			{viewState === "navigating" && (
				<View
					style={{
						position: "absolute",
						top: 0,
						bottom: 0,
						left: 0,
						right: 0,
						zIndex: 50,
						alignItems: "center",
						justifyContent: "center",
						backgroundColor: "rgba(0,0,0,0.7)",
					}}
				>
					<View className="items-center gap-3">
						<View
							className="items-center justify-center rounded-full"
							style={{ width: 56, height: 56, backgroundColor: "rgba(34,197,94,0.15)" }}
						>
							<Icon as={ExternalLink} style={{ color: "#22c55e" }} className="size-7" />
						</View>
						<Text className="text-lg font-bold text-white">
							Going to {selectedMarker?.targetSheet}
						</Text>
						<Text className="text-muted-foreground text-sm">
							Detail {selectedMarker?.detailNumber}
						</Text>
					</View>
				</View>
			)}

			{/* Marker overlays (source sheet only) */}
			{!isOnDestination &&
				MOCK_MARKERS.map((marker) => (
					<MarkerOverlay
						key={marker.id}
						marker={marker}
						isSelected={marker.id === selectedMarkerId}
						onPress={() => handleMarkerPress(marker.id)}
					/>
				))}

			{/* Destination highlight (on destination sheet) */}
			{viewState === "destination" && selectedMarker && (
				<DestinationHighlight
					detailNumber={selectedMarker.detailNumber}
					color={MARKER_COLORS[selectedMarker.type]}
				/>
			)}

			{/* Back breadcrumb (on destination sheet) */}
			{viewState === "destination" && selectedMarker && (
				<NavigationBreadcrumb
					fromSheet={fromSheet}
					fromLabel={selectedMarker.label}
					onGoBack={handleGoBack}
				/>
			)}

			{/* Close button — top left */}
			<View style={{ position: "absolute", top: 16, left: 16, zIndex: 20 }}>
				<GlassButton onPress={() => setSelectedMarkerId(undefined)}>
					<Icon as={X} className="size-5 text-white" strokeWidth={2.5} />
				</GlassButton>
			</View>

			{/* Right-side controls */}
			<View style={{ position: "absolute", top: 16, right: 16, zIndex: 20, gap: 12, alignItems: "center" }}>
				<View
					className="items-center justify-center rounded-xl"
					style={{ backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 10, paddingVertical: 6 }}
				>
					<Text style={{ color: "#fff", fontSize: 13, fontWeight: "600", fontVariant: ["tabular-nums"] }}>
						{viewState === "destination" ? "100%" : "42%"}
					</Text>
				</View>

				<View
					className="items-center overflow-hidden rounded-2xl"
					style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
				>
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
				<GlassButton>
					<Icon as={Plus} className="size-5 text-white" strokeWidth={2.5} />
				</GlassButton>
			</View>

			{/* Bottom sheet info bar */}
			{!selectedMarker && viewState === "source" && (
				<View
					style={{
						position: "absolute",
						bottom: 0,
						left: 0,
						right: 0,
						zIndex: 10,
						paddingHorizontal: 16,
						paddingBottom: 24,
					}}
				>
					<View className="flex-row items-center justify-between">
						<Pressable
							className="flex-row items-center gap-2 rounded-xl px-4 py-2.5"
							style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
						>
							<Icon as={Layers} className="size-4 text-white/70" />
							<Text className="text-sm font-bold text-white">{currentSheet}</Text>
							<Text className="text-sm text-white/60">Foundation Plan</Text>
							<Icon as={ChevronDown} className="size-3.5 text-white/40" />
						</Pressable>
						<View
							className="flex-row items-center gap-1.5 rounded-xl px-3 py-2"
							style={{ backgroundColor: "rgba(245,245,245,0.15)" }}
						>
							<Icon as={MapPin} className="text-primary size-3.5" />
							<Text className="text-primary text-sm font-semibold">
								{MOCK_MARKERS.length}
							</Text>
						</View>
					</View>
				</View>
			)}

			{/* Destination sheet info bar */}
			{viewState === "destination" && selectedMarker && (
				<View
					style={{
						position: "absolute",
						bottom: 0,
						left: 0,
						right: 0,
						zIndex: 10,
						paddingHorizontal: 16,
						paddingBottom: 24,
					}}
				>
					<View className="flex-row items-center justify-between">
						<Pressable
							className="flex-row items-center gap-2 rounded-xl px-4 py-2.5"
							style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
						>
							<Icon as={Layers} className="size-4 text-white/70" />
							<Text className="text-sm font-bold text-white">{selectedMarker.targetSheet}</Text>
							<Text className="text-sm text-white/60">{selectedMarker.targetSheetTitle}</Text>
							<Icon as={ChevronDown} className="size-3.5 text-white/40" />
						</Pressable>
					</View>
				</View>
			)}

			{/* Callout detail bottom sheet */}
			{viewState === "source" && selectedMarker && (
				<CalloutDetailSheet
					marker={selectedMarker}
					onClose={() => setSelectedMarkerId(undefined)}
					onGoToDetail={handleGoToDetail}
					onTakePhoto={() => {}}
					onReportWrong={() => setViewState("report-wrong")}
				/>
			)}

			{/* Report wrong link sheet */}
			{viewState === "report-wrong" && selectedMarker && (
				<WrongLinkSheet
					marker={selectedMarker}
					onClose={() => setViewState("source")}
					onSubmit={() => setViewState("source")}
				/>
			)}
		</View>
	);
}

const meta: Meta<typeof CalloutNavigationScreen> = {
	title: "Priority 1 — Callout Navigation",
	component: CalloutNavigationScreen,
	parameters: {
		layout: "fullscreen",
	},
};

export default meta;
type Story = StoryObj<typeof CalloutNavigationScreen>;

export const TapCalloutHighConfidence: Story = {
	name: "1. Tap Callout — High Confidence",
	args: {
		initialMarker: "m1",
	},
};

export const TapCalloutMediumConfidence: Story = {
	name: "2. Tap Callout — Medium Confidence",
	args: {
		initialMarker: "m2",
	},
};

export const TapCalloutLowConfidence: Story = {
	name: "3. Tap Callout — Low Confidence",
	args: {
		initialMarker: "m3",
	},
};

export const TapCalloutLikelyIncorrect: Story = {
	name: "4. Tap Callout — Likely Incorrect",
	args: {
		initialMarker: "m4",
	},
};

export const NavigatedToDestination: Story = {
	name: "5. Arrived at Destination",
	args: {
		initialMarker: "m1",
		initialState: "destination",
	},
};

export const ReportWrongLink: Story = {
	name: "6. Report Wrong Link",
	args: {
		initialMarker: "m3",
		initialState: "report-wrong",
	},
};

export const BrowseAllMarkers: Story = {
	name: "7. Browse All Markers",
	args: {},
};
