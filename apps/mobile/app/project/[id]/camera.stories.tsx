import type { Meta, StoryObj } from "@storybook/react";
import {
	AlertTriangle,
	Check,
	Copy,
	Edit2,
	MapPin,
	Mic,
	RotateCcw,
	X,
	Zap,
} from "lucide-react-native";
import * as React from "react";
import { Image, Pressable, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

function GlassCircle({
	children,
	size = 44,
	bg = "rgba(0,0,0,0.4)",
}: {
	children: React.ReactNode;
	size?: number;
	bg?: string;
}) {
	return (
		<View
			className="items-center justify-center rounded-full"
			style={{ width: size, height: size, backgroundColor: bg }}
		>
			{children}
		</View>
	);
}

function ShutterButton({ isIssueMode }: { isIssueMode?: boolean }) {
	const outerColor = isIssueMode ? "#ef4444" : "#ffffff";
	return (
		<View
			className="items-center justify-center rounded-full"
			style={{
				width: 72,
				height: 72,
				borderWidth: 4,
				borderColor: outerColor,
				backgroundColor: "transparent",
			}}
		>
			<View
				className="rounded-full"
				style={{
					width: 58,
					height: 58,
					backgroundColor: outerColor,
				}}
			/>
		</View>
	);
}

function CameraScreen({
	variant = "default",
}: {
	variant?: "default" | "linked" | "issue" | "preview";
}) {
	const isIssueMode = variant === "issue";
	const isLinked = variant === "linked";
	const isPreview = variant === "preview";

	const bgSeed = isPreview ? "construct99" : "constructsite7";

	return (
		<View style={{ minHeight: "100vh", position: "relative", backgroundColor: "#000" } as any}>
			{/* Viewfinder / preview background */}
			<Image
				source={{ uri: `https://picsum.photos/seed/${bgSeed}/1080/1920` }}
				style={{ width: "100%", height: "100%", position: "absolute" }}
				resizeMode="cover"
			/>

			{isPreview ? (
				<PreviewOverlay />
			) : (
				<>
					{/* Top overlay controls */}
					<View
						style={{
							position: "absolute",
							top: 16,
							left: 16,
							right: 16,
							zIndex: 20,
							flexDirection: "row",
							justifyContent: "space-between",
							alignItems: "flex-start",
						}}
					>
						<GlassCircle>
							<Icon as={X} className="size-5 text-white" strokeWidth={2.5} />
						</GlassCircle>
						<View style={{ flexDirection: "row", gap: 12 }}>
							<GlassCircle>
								<Icon as={Zap} className="size-5 text-white" />
							</GlassCircle>
							<GlassCircle>
								<Icon as={RotateCcw} className="size-5 text-white" />
							</GlassCircle>
						</View>
					</View>

					{/* Issue mode banner */}
					{isIssueMode && (
						<View
							style={{
								position: "absolute",
								top: 76,
								left: 0,
								right: 0,
								zIndex: 15,
								alignItems: "center",
							}}
						>
							<View
								className="flex-row items-center gap-2 rounded-full px-4 py-2"
								style={{ backgroundColor: "rgba(239,68,68,0.85)" }}
							>
								<Icon as={AlertTriangle} className="size-4 text-white" />
								<Text className="text-sm font-bold text-white">Issue Mode</Text>
							</View>
						</View>
					)}

					{/* Link context bar */}
					<View
						style={{
							position: "absolute",
							bottom: 140,
							left: 16,
							right: 16,
							zIndex: 15,
						}}
					>
						{isLinked ? (
							<View
								className="flex-row items-center gap-2 self-center rounded-full px-4 py-2.5"
								style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
							>
								<Icon as={MapPin} className="text-primary size-4" />
								<Text className="text-sm font-medium text-white">
									5/A7 - Electrical Junction
								</Text>
							</View>
						) : (
							<View
								className="flex-row items-center justify-between self-center rounded-full px-4 py-2"
								style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
							>
								<Text className="text-muted-foreground text-sm">
									Not linked to a callout
								</Text>
								<Pressable className="bg-primary ml-3 rounded-full px-3 py-1.5">
									<Text className="text-primary-foreground text-xs font-semibold">
										Link to Plan
									</Text>
								</Pressable>
							</View>
						)}
					</View>

					{/* Bottom controls */}
					<View
						style={{
							position: "absolute",
							bottom: 0,
							left: 0,
							right: 0,
							paddingBottom: 40,
							paddingHorizontal: 24,
							zIndex: 15,
						}}
					>
						<View className="flex-row items-center justify-center">
							{/* Issue mode toggle */}
							<View className="flex-1 items-start">
								<Pressable
									className="flex-row items-center gap-2 rounded-full px-4 py-2.5"
									style={{
										backgroundColor: isIssueMode
											? "rgba(239,68,68,0.25)"
											: "rgba(255,255,255,0.1)",
									}}
								>
									<View
										className="rounded-full"
										style={{
											width: 8,
											height: 8,
											backgroundColor: isIssueMode ? "#ef4444" : "#666",
										}}
									/>
									<Text
										className="text-xs font-semibold"
										style={{ color: isIssueMode ? "#ef4444" : "#999" }}
									>
										Issue
									</Text>
								</Pressable>
							</View>

							{/* Shutter */}
							<ShutterButton isIssueMode={isIssueMode} />

							<View className="flex-1" />
						</View>
					</View>
				</>
			)}
		</View>
	);
}

function PreviewOverlay() {
	return (
		<>
			{/* Top bar */}
			<View
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					right: 0,
					zIndex: 20,
					backgroundColor: "rgba(0,0,0,0.7)",
					paddingTop: 16,
					paddingBottom: 12,
					paddingHorizontal: 16,
				}}
			>
				<View className="flex-row items-center justify-between">
					<View className="flex-row items-center gap-2">
						<View className="items-center justify-center rounded-full bg-green-500/20" style={{ width: 28, height: 28 }}>
							<Icon as={Check} className="size-4 text-green-400" />
						</View>
						<Text className="text-sm font-semibold text-white">Photo Saved</Text>
					</View>
					<Text className="text-muted-foreground text-xs">Just now</Text>
				</View>

				{/* Linked callout */}
				<View className="mt-2 flex-row items-center gap-1.5">
					<Icon as={MapPin} className="text-primary size-3.5" />
					<Text className="text-sm text-white/70">
						5/A7 - Electrical Junction
					</Text>
				</View>
			</View>

			{/* OCR text card */}
			<View
				style={{
					position: "absolute",
					bottom: 120,
					left: 16,
					right: 16,
					zIndex: 20,
					backgroundColor: "rgba(28,28,28,0.95)",
					borderRadius: 16,
					padding: 16,
				}}
			>
				<Text className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wide">
					Detected Text
				</Text>
				<Text className="text-foreground mb-3 text-sm leading-relaxed">
					{`"PANEL SCH-2A\n208/120V 3PH 4W\nMLO 225A\nCKT 1: 20A 1P — LIGHTING"`}
				</Text>
				<View className="flex-row gap-2">
					<Pressable
						className="flex-row items-center gap-1.5 rounded-lg px-3 py-2"
						style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
					>
						<Icon as={Copy} className="size-3.5 text-white/70" />
						<Text className="text-xs font-medium text-white/70">Copy</Text>
					</Pressable>
					<Pressable
						className="flex-row items-center gap-1.5 rounded-lg px-3 py-2"
						style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
					>
						<Icon as={Edit2} className="size-3.5 text-white/70" />
						<Text className="text-xs font-medium text-white/70">Edit</Text>
					</Pressable>
				</View>
			</View>

			{/* Bottom action buttons */}
			<View
				style={{
					position: "absolute",
					bottom: 0,
					left: 0,
					right: 0,
					paddingBottom: 40,
					paddingHorizontal: 20,
					zIndex: 20,
				}}
			>
				<View className="flex-row items-center gap-3">
					<Pressable
						className="flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3.5"
						style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
					>
						<Icon as={RotateCcw} className="size-4 text-white" />
						<Text className="text-sm font-semibold text-white">Retake</Text>
					</Pressable>
					<Pressable
						className="flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3.5"
						style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
					>
						<Icon as={Mic} className="size-4 text-white" />
						<Text className="text-sm font-semibold text-white">Add Voice</Text>
					</Pressable>
					<Pressable className="bg-primary flex-1 items-center justify-center rounded-xl py-3.5">
						<Text className="text-primary-foreground text-sm font-bold">Done</Text>
					</Pressable>
				</View>
			</View>
		</>
	);
}

const meta: Meta<typeof CameraScreen> = {
	title: "Screens/Camera",
	component: CameraScreen,
	parameters: {
		layout: "fullscreen",
	},
};

export default meta;
type Story = StoryObj<typeof CameraScreen>;

export const Default: Story = {};

export const LinkedToCallout: Story = {
	args: {
		variant: "linked",
	},
};

export const IssueMode: Story = {
	args: {
		variant: "issue",
	},
};

export const PhotoPreview: Story = {
	args: {
		variant: "preview",
	},
};
