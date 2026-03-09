import type { Meta, StoryObj } from "@storybook/react";
import {
	Camera,
	ChevronDown,
	ExternalLink,
	Layers,
	MapPin,
	Maximize,
	Plus,
	ScanLine,
	TableProperties,
	X,
	ZoomIn,
	ZoomOut,
} from "lucide-react-native";
import * as React from "react";
import { Image, Pressable, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

const MARKER_COLORS = {
	detail: "#22c55e",
	section: "#3b82f6",
	note: "#a855f7",
	selected: "#facc15",
} as const;

interface Marker {
	id: string;
	label: string;
	type: keyof typeof MARKER_COLORS;
	top: string;
	left: string;
	width: string;
	height: string;
}

const MOCK_MARKERS: Marker[] = [
	{ id: "m1", label: "5/A7", type: "detail", top: "52%", left: "7%", width: "6%", height: "4%" },
	{ id: "m2", label: "3/A2", type: "section", top: "60%", left: "18%", width: "8%", height: "5%" },
	{ id: "m3", label: "N1", type: "note", top: "4%", left: "78%", width: "16%", height: "12%" },
	{ id: "m4", label: "2/A1", type: "detail", top: "42%", left: "28%", width: "5%", height: "4%" },
];

function GlassButton({
	children,
	size = 44,
	onPress,
	className: extraClass,
}: {
	children: React.ReactNode;
	size?: number;
	onPress?: () => void;
	className?: string;
}) {
	return (
		<Pressable
			onPress={onPress}
			className={`items-center justify-center rounded-full ${extraClass ?? ""}`}
			style={{ width: size, height: size, backgroundColor: "rgba(0,0,0,0.6)" }}
		>
			{children}
		</Pressable>
	);
}

function MarkerOverlay({
	marker,
	isSelected,
}: {
	marker: Marker;
	isSelected?: boolean;
}) {
	const color = isSelected ? MARKER_COLORS.selected : MARKER_COLORS[marker.type];
	return (
		<View
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
				<Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
					{marker.label}
				</Text>
			</View>
		</View>
	);
}

function MarkerDetailSheet({ marker }: { marker: Marker }) {
	return (
		<View
			style={{
				position: "absolute",
				bottom: 0,
				left: 0,
				right: 0,
				backgroundColor: "#1c1c1c",
				borderTopLeftRadius: 20,
				borderTopRightRadius: 20,
				paddingTop: 12,
				paddingBottom: 32,
				paddingHorizontal: 20,
			}}
		>
			<View className="mb-4 items-center">
				<View className="bg-muted h-1 w-10 rounded-full" />
			</View>

			<View className="mb-1 flex-row items-center gap-2">
				<View
					className="items-center justify-center rounded-full"
					style={{
						width: 28,
						height: 28,
						backgroundColor: MARKER_COLORS[marker.type] + "20",
					}}
				>
					<Icon as={MapPin} style={{ color: MARKER_COLORS[marker.type] }} className="size-4" />
				</View>
				<Text className="text-foreground text-lg font-bold">{marker.label}</Text>
				<View
					className="rounded-full px-2 py-0.5"
					style={{ backgroundColor: MARKER_COLORS[marker.type] + "20" }}
				>
					<Text style={{ color: MARKER_COLORS[marker.type], fontSize: 11, fontWeight: "600" }}>
						{marker.type.charAt(0).toUpperCase() + marker.type.slice(1)}
					</Text>
				</View>
			</View>

			<Text className="text-muted-foreground mb-5 text-sm">
				Electrical Junction Detail — Referenced from Sheet S1.0
			</Text>

			<View className="flex-row gap-3">
				<Pressable
					className="flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3"
					style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
				>
					<Icon as={ExternalLink} className="text-foreground size-4" />
					<Text className="text-foreground text-sm font-semibold">Go to Sheet</Text>
				</Pressable>
				<Pressable className="bg-primary flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3">
					<Icon as={Camera} className="text-primary-foreground size-4" />
					<Text className="text-primary-foreground text-sm font-semibold">Take Photo Here</Text>
				</Pressable>
			</View>
		</View>
	);
}

function PlanViewerScreen({
	selectedMarkerId,
}: {
	selectedMarkerId?: string;
}) {
	const selectedMarker = selectedMarkerId
		? MOCK_MARKERS.find((m) => m.id === selectedMarkerId)
		: undefined;

	return (
		<View style={{ minHeight: "100vh", position: "relative", backgroundColor: "#0a0a0a" } as any}>
			{/* Plan image background */}
			<Image
				source={{ uri: "/plan-sample.png" }}
				style={{ width: "100%", height: "100%", position: "absolute" }}
				resizeMode="contain"
			/>

			{/* Marker overlays */}
			{MOCK_MARKERS.map((marker) => (
				<MarkerOverlay
					key={marker.id}
					marker={marker}
					isSelected={marker.id === selectedMarkerId}
				/>
			))}

			{/* Close button — top left */}
			<View style={{ position: "absolute", top: 16, left: 16, zIndex: 20 }}>
				<GlassButton>
					<Icon as={X} className="size-5 text-white" strokeWidth={2.5} />
				</GlassButton>
			</View>

			{/* Right-side controls */}
			<View style={{ position: "absolute", top: 16, right: 16, zIndex: 20, gap: 12, alignItems: "center" }}>
				{/* Zoom percentage */}
				<View
					className="items-center justify-center rounded-xl"
					style={{ backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 10, paddingVertical: 6 }}
				>
					<Text style={{ color: "#fff", fontSize: 13, fontWeight: "600", fontVariant: ["tabular-nums"] }}>
						42%
					</Text>
				</View>

				{/* Zoom controls stack */}
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

				{/* Region toggle */}
				<GlassButton>
					<Icon as={ScanLine} className="size-5 text-white" />
				</GlassButton>

				{/* Schedule drawer */}
				<GlassButton>
					<Icon as={TableProperties} className="size-5 text-white" />
				</GlassButton>

				{/* Add marker */}
				<GlassButton>
					<Icon as={Plus} className="size-5 text-white" strokeWidth={2.5} />
				</GlassButton>
			</View>

			{/* Bottom sheet info bar */}
			<View
				style={{
					position: "absolute",
					bottom: 0,
					left: 0,
					right: 0,
					zIndex: 10,
					paddingHorizontal: 16,
					paddingBottom: selectedMarker ? 0 : 24,
				}}
			>
				{!selectedMarker && (
					<View className="flex-row items-center justify-between">
						{/* Sheet pill */}
						<Pressable
							className="flex-row items-center gap-2 rounded-xl px-4 py-2.5"
							style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
						>
							<Icon as={Layers} className="size-4 text-white/70" />
							<Text className="text-sm font-bold text-white">S1.0</Text>
							<Text className="text-sm text-white/60">Foundation Plan</Text>
							<Icon as={ChevronDown} className="size-3.5 text-white/40" />
						</Pressable>

						{/* Marker count pill */}
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
				)}
			</View>

			{/* Marker detail sheet */}
			{selectedMarker && <MarkerDetailSheet marker={selectedMarker} />}
		</View>
	);
}

const meta: Meta<typeof PlanViewerScreen> = {
	title: "Screens/Plan Viewer",
	component: PlanViewerScreen,
	parameters: {
		layout: "fullscreen",
	},
};

export default meta;
type Story = StoryObj<typeof PlanViewerScreen>;

export const Default: Story = {};

export const MarkerSelected: Story = {
	args: {
		selectedMarkerId: "m1",
	},
};
