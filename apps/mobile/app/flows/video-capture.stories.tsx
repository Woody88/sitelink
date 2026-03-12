import type { Meta, StoryObj } from "@storybook/react";
import {
	Check,
	CheckCircle,
	ChevronLeft,
	MapPin,
	Mic,
	Play,
	RotateCw,
	TriangleAlert,
	Video,
	X,
	Zap,
	ZapOff,
} from "lucide-react-native";
import * as React from "react";
import { Image, Pressable, View } from "react-native";
import { StoryToast } from "@/app/_story-components";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

type CapturePhase = "viewfinder" | "recording" | "preview";

function formatDuration(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${m}:${s.toString().padStart(2, "0")}`;
}

function GlassCircle({ children, size = 48, bg = "rgba(0,0,0,0.4)", onPress }: { children: React.ReactNode; size?: number; bg?: string; onPress?: () => void }) {
	return (
		<Pressable onPress={onPress} className="items-center justify-center rounded-full" style={{ width: size, height: size, backgroundColor: bg }}>
			{children}
		</Pressable>
	);
}

function VideoCaptureFlow({
	initialPhase = "viewfinder" as CapturePhase,
	initialIssueMode = false,
}: {
	initialPhase?: CapturePhase;
	initialIssueMode?: boolean;
}) {
	const [phase, setPhase] = React.useState<CapturePhase>(initialPhase);
	const [flashOn, setFlashOn] = React.useState(false);
	const [recordingTime, setRecordingTime] = React.useState(0);
	const [isLinked, setIsLinked] = React.useState(false);
	const [isIssueMode, setIsIssueMode] = React.useState(initialIssueMode);
	const [voiceAdded, setVoiceAdded] = React.useState(false);
	const [toastMsg, setToastMsg] = React.useState("");

	React.useEffect(() => {
		if (phase !== "recording") return;
		const timer = setInterval(() => setRecordingTime((t) => t + 1), 1000);
		return () => clearInterval(timer);
	}, [phase]);

	if (phase === "preview") {
		return (
			<View style={{ minHeight: "100vh", position: "relative", backgroundColor: "#000" } as any}>
				<Image source={{ uri: "https://picsum.photos/seed/vidpreview/1080/1920" }} style={{ width: "100%", height: "100%", position: "absolute" }} resizeMode="cover" />

				{/* Floating back button */}
				<View style={{ position: "absolute", top: 16, left: 12, zIndex: 20, flexDirection: "row", alignItems: "center", gap: 10 }}>
					<Pressable onPress={() => { setPhase("viewfinder"); setRecordingTime(0); }} className="items-center justify-center rounded-full" style={{ width: 40, height: 40, backgroundColor: "rgba(0,0,0,0.5)" }}>
						<Icon as={ChevronLeft} className="size-5 text-white" />
					</Pressable>
				</View>

				{/* Video icon overlay */}
				<View style={{ position: "absolute", top: "40%", left: 0, right: 0, zIndex: 15, alignItems: "center" } as any}>
					<View className="rounded-full px-4 py-2" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
						<Icon as={Video} className="size-6 text-white" />
					</View>
				</View>

				{/* Bottom sheet */}
				<View style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 20, backgroundColor: "rgba(0,0,0,0.78)", borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
					<View className="items-center py-3">
						<View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.25)" }} />
					</View>

					<View style={{ paddingHorizontal: 20, paddingBottom: 40 }}>
						{/* Confirm row */}
						<View className="flex-row items-center gap-3 mb-4">
							<View className="items-center justify-center rounded-full" style={{ width: 32, height: 32, backgroundColor: "rgba(34,197,94,0.15)" }}>
								<Icon as={CheckCircle} style={{ color: "#22c55e" }} className="size-5" />
							</View>
							<View className="flex-1">
								<Text style={{ color: "#ebebeb", fontSize: 14, fontWeight: "600" }}>
									Video saved · {formatDuration(recordingTime || 12)}
								</Text>
							</View>
						</View>

						{isLinked && (
							<View className="flex-row items-center gap-2 mb-4" style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, padding: 14 }}>
								<Icon as={MapPin} style={{ color: "#eab308" }} className="size-4" />
								<Text style={{ color: "#ebebeb", fontSize: 13 }}>5/A7 · Electrical Junction</Text>
							</View>
						)}

						{/* Voice note section */}
						{voiceAdded ? (
							<View style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, padding: 14, marginBottom: 16 }}>
								<View className="flex-row items-center gap-3">
									<View className="items-center justify-center rounded-full" style={{ width: 36, height: 36, backgroundColor: "rgba(59,130,246,0.15)" }}>
										<Icon as={Mic} style={{ color: "#3b82f6" }} className="size-4" />
									</View>
									<View className="flex-1">
										<Text style={{ color: "#ebebeb", fontSize: 14, fontWeight: "600" }}>Voice note · 0:05</Text>
									</View>
									<Pressable className="items-center justify-center rounded-full" style={{ width: 32, height: 32, backgroundColor: "rgba(59,130,246,0.2)" }}>
										<Icon as={Play} style={{ color: "#3b82f6" }} className="size-4" />
									</Pressable>
								</View>
							</View>
						) : (
							<Pressable
								onPress={() => setVoiceAdded(true)}
								className="flex-row items-center gap-3 mb-4"
								style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, padding: 14 }}
							>
								<View className="items-center justify-center rounded-full" style={{ width: 36, height: 36, backgroundColor: "rgba(255,255,255,0.1)" }}>
									<Icon as={Mic} className="size-4" style={{ color: "rgba(255,255,255,0.7)" }} />
								</View>
								<Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: "500" }}>Add voice note</Text>
							</Pressable>
						)}

						{/* Action buttons */}
						<View className="flex-row items-center gap-3">
							<Pressable onPress={() => { setPhase("viewfinder"); setRecordingTime(0); }} className="flex-row items-center justify-center gap-2 rounded-xl py-3.5" style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.1)" }}>
								<Icon as={RotateCw} className="size-4 text-white" />
								<Text className="text-sm font-semibold text-white">Retake</Text>
							</Pressable>
							<Pressable onPress={() => setToastMsg("Video saved")} className="bg-primary items-center justify-center rounded-xl py-3.5" style={{ flex: 1 }}>
								<Text className="text-primary-foreground text-sm font-bold">Done</Text>
							</Pressable>
						</View>
					</View>
				</View>

				<StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
			</View>
		);
	}

	// Viewfinder / Recording — matches field capture camera design
	return (
		<View style={{ minHeight: "100vh", position: "relative", backgroundColor: "#000" } as any}>
			<Image source={{ uri: "https://picsum.photos/seed/constructsite8/1080/1920" }} style={{ width: "100%", height: "100%", position: "absolute" }} resizeMode="cover" />

			{/* Top controls row */}
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

			{/* REC indicator */}
			{phase === "recording" && (
				<View style={{ position: "absolute", top: 120, left: 0, right: 0, zIndex: 15, alignItems: "center" }}>
					<View className="flex-row items-center gap-2 rounded-full px-4 py-2" style={{ backgroundColor: "rgba(239,68,68,0.85)" }}>
						<View className="size-2 rounded-full bg-white" />
						<Text className="text-sm font-bold text-white">REC {formatDuration(recordingTime)}</Text>
					</View>
				</View>
			)}

			{/* Callout pill row */}
			<View style={{ position: "absolute", top: 580, left: 0, right: 0, zIndex: 15, alignItems: "center" }}>
				{isLinked ? (
					<View className="flex-row items-center" style={{ backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 20, height: 36, paddingHorizontal: 14, gap: 6 }}>
						<Icon as={MapPin} style={{ color: "#ffffff" }} className="size-3.5" />
						<Text style={{ color: "#eab308", fontSize: 13, fontWeight: "700" }}>5/A7</Text>
						<Text style={{ color: "#ebebeb", fontSize: 13 }}>· Electrical Junction</Text>
					</View>
				) : (
					<View className="flex-row items-center" style={{ backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 20, height: 36, paddingHorizontal: 14, gap: 6 }}>
						<Text style={{ color: "#999", fontSize: 13 }}>Not linked to a callout</Text>
						<Pressable onPress={() => setIsLinked(true)} className="bg-primary ml-2 rounded-full px-3 py-1.5">
							<Text className="text-primary-foreground text-xs font-semibold">Link to Plan</Text>
						</Pressable>
					</View>
				)}
			</View>

			{/* Bottom dim area */}
			<View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 212, backgroundColor: "rgba(0,0,0,0.52)", zIndex: 10 }} />

			{/* Last video thumbnail */}
			<View style={{ position: "absolute", bottom: 126, left: 34, zIndex: 15 }}>
				<View style={{ width: 60, height: 60, borderRadius: 30, overflow: "hidden", backgroundColor: "#333" }}>
					<Image source={{ uri: "https://picsum.photos/seed/vidthumb/200/200" }} style={{ width: 60, height: 60 }} />
				</View>
				<View style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.75)", alignItems: "center", justifyContent: "center" }}>
					<Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>1</Text>
				</View>
			</View>

			{/* Shutter button - centered, red for video */}
			<View style={{ position: "absolute", bottom: 104, left: 0, right: 0, zIndex: 15, alignItems: "center" }}>
				<Pressable onPress={() => {
					if (phase === "recording") {
						setPhase("preview");
					} else {
						setPhase("recording");
						setRecordingTime(0);
					}
				}}>
					<View className="items-center justify-center rounded-full" style={{ width: 88, height: 88, borderWidth: 3, borderColor: "#ef4444" }}>
						{phase === "recording" ? (
							<View className="rounded-lg" style={{ width: 30, height: 30, backgroundColor: "#ef4444" }} />
						) : (
							<View className="rounded-full" style={{ width: 74, height: 74, backgroundColor: "#ef4444" }} />
						)}
					</View>
				</Pressable>
			</View>

			{/* Issue button - right side */}
			<View style={{ position: "absolute", bottom: 120, right: 34, zIndex: 15 }}>
				<Pressable
					onPress={() => setIsIssueMode((m) => !m)}
					className="items-center justify-center"
					style={{
						width: 56, height: 56, borderRadius: 28,
						backgroundColor: isIssueMode ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.12)",
						borderWidth: isIssueMode ? 1.5 : 1,
						borderColor: isIssueMode ? "#ef4444" : "rgba(255,255,255,0.22)",
					}}
				>
					<Icon as={TriangleAlert} className="size-5" style={{ color: isIssueMode ? "#ef4444" : "rgba(255,255,255,0.85)" }} />
					<Text style={{ fontSize: 10, fontWeight: isIssueMode ? "700" : "400", color: isIssueMode ? "#ef4444" : "#ebebeb", marginTop: 2 }}>Issue</Text>
				</Pressable>
			</View>

			{/* Mode tabs */}
			<View style={{ position: "absolute", bottom: 44, left: 0, right: 0, zIndex: 15, alignItems: "center" }}>
				<View className="flex-row items-center gap-6">
					<Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: "600" }}>PHOTO</Text>
					<View className="rounded-full px-3 py-1" style={{ backgroundColor: "rgba(239,68,68,0.25)" }}>
						<Text style={{ color: "#ef4444", fontSize: 13, fontWeight: "700" }}>VIDEO</Text>
					</View>
				</View>
			</View>

			<StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
		</View>
	);
}

const meta: Meta<typeof VideoCaptureFlow> = {
	title: "Flows/13. Video Capture",
	component: VideoCaptureFlow,
	parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof VideoCaptureFlow>;

export const Viewfinder: Story = { name: "1. Viewfinder", args: { initialPhase: "viewfinder" } };
export const Recording: Story = { name: "2. Recording", args: { initialPhase: "recording" } };
export const Preview: Story = { name: "3. Preview", args: { initialPhase: "preview" } };
export const IssueModeViewfinder: Story = { name: "4. Issue Mode", args: { initialPhase: "viewfinder", initialIssueMode: true } };
export const FullFlow: Story = { name: "Full Flow", args: { initialPhase: "viewfinder" } };
