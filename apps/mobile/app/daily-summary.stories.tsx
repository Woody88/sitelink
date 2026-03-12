import type { Meta, StoryObj } from "@storybook/react";
import {
	AlertTriangle,
	Calendar,
	Camera,
	Cloud,
	Copy,
	Download,
	MapPin,
	Mic,
	RefreshCcw,
	Share2,
	Sparkles,
} from "lucide-react-native";
import * as React from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import { StoryHeader, StoryToast } from "./_story-components";

const REPORT_TEXT = {
	workPerformed: [
		"Electrical rough-in at Detail 5/A7 \u2014 junction box installation and conduit routing from Panel E-4",
		"Fire alarm conduit completed at 7/E-102, pulled wire to junction",
		"Panel rough-in at 3/A2 \u2014 mounted panel box, began circuit routing",
		"Foundation inspection prep at grid F/5 \u2014 verified footing dimensions match F1 schedule (24\" x 12\", 4-#5 E.W.)",
	],
	issues: [
		{
			text: "Junction box at 5/A7 requires relocation approximately 6 inches to the left to clear conduit routing path",
			voiceNote:
				'"Junction box needs to move about six inches to the left to clear the conduit run"',
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

function DailySummaryReport() {
	const [toastMsg, setToastMsg] = React.useState("");

	return (
		<View
			className="bg-background flex-1"
			style={{ minHeight: "100vh" } as any}
		>
			<StoryHeader title="Daily Summary" />

			<ScrollView className="flex-1" contentContainerClassName="px-4 pb-8">
				{/* Report Header */}
				<View
					className="mb-6 overflow-hidden rounded-2xl"
					style={{
						backgroundColor: "rgba(255,255,255,0.04)",
						borderWidth: 1,
						borderColor: "rgba(255,255,255,0.08)",
					}}
				>
					<View
						className="flex-row items-center gap-2 px-5 py-3"
						style={{ backgroundColor: "rgba(168,85,247,0.08)" }}
					>
						<Icon
							as={Sparkles}
							className="size-4"
							style={{ color: "#a855f7" }}
						/>
						<Text
							className="text-xs font-bold uppercase tracking-wider"
							style={{ color: "#a855f7" }}
						>
							AI-Generated Report
						</Text>
					</View>

					<View className="gap-3 px-5 py-4">
						<Text className="text-foreground text-xl font-black">
							Daily Construction Report
						</Text>

						<View className="gap-2">
							<View className="flex-row items-center gap-2">
								<Icon
									as={MapPin}
									className="text-muted-foreground size-3.5"
								/>
								<Text className="text-foreground text-sm">
									Holabird Ave Warehouse
								</Text>
							</View>
							<View className="flex-row items-center gap-2">
								<Icon
									as={Calendar}
									className="text-muted-foreground size-3.5"
								/>
								<Text className="text-foreground text-sm">
									March 9, 2026
								</Text>
							</View>
							<View className="flex-row items-center gap-2">
								<Icon
									as={Cloud}
									className="text-muted-foreground size-3.5"
								/>
								<Text className="text-foreground text-sm">
									Clear, 45°F
								</Text>
							</View>
						</View>

						<View className="mt-1 flex-row gap-4">
							<View className="flex-row items-center gap-1.5">
								<Icon
									as={Camera}
									className="text-muted-foreground size-3.5"
								/>
								<Text className="text-muted-foreground text-xs">
									5 photos
								</Text>
							</View>
							<View className="flex-row items-center gap-1.5">
								<Icon
									as={Mic}
									className="text-muted-foreground size-3.5"
								/>
								<Text className="text-muted-foreground text-xs">
									1 voice note
								</Text>
							</View>
							<View className="flex-row items-center gap-1.5">
								<Icon
									as={AlertTriangle}
									className="size-3.5"
									style={{ color: "#ef4444" }}
								/>
								<Text
									className="text-xs font-semibold"
									style={{ color: "#ef4444" }}
								>
									1 issue
								</Text>
							</View>
						</View>
					</View>
				</View>

				{/* Work Performed */}
				<View className="mb-6">
					<Text className="text-foreground mb-3 text-sm font-bold uppercase tracking-wider">
						Work Performed
					</Text>
					<View className="gap-3">
						{REPORT_TEXT.workPerformed.map((item, i) => (
							<View key={i} className="flex-row gap-3">
								<Text className="text-muted-foreground text-sm">{"•"}</Text>
								<Text className="text-foreground flex-1 text-sm leading-relaxed">
									{item}
								</Text>
							</View>
						))}
					</View>
				</View>

				<Separator className="mb-6" />

				{/* Issues / Delays */}
				<View className="mb-6">
					<View className="mb-3 flex-row items-center gap-2">
						<Text className="text-sm font-bold uppercase tracking-wider" style={{ color: "#ef4444" }}>
							Issues / Delays
						</Text>
					</View>
					{REPORT_TEXT.issues.map((issue, i) => (
						<View
							key={i}
							className="rounded-xl px-4 py-3"
							style={{
								backgroundColor: "rgba(239,68,68,0.06)",
								borderWidth: 1,
								borderColor: "rgba(239,68,68,0.15)",
							}}
						>
							<View className="mb-2 flex-row items-center gap-2">
								<Icon
									as={AlertTriangle}
									className="size-4"
									style={{ color: "#ef4444" }}
								/>
								<Text
									className="text-xs font-bold"
									style={{ color: "#ef4444" }}
								>
									{issue.location}
								</Text>
							</View>
							<Text className="text-foreground text-sm leading-relaxed">
								{issue.text}
							</Text>
							{issue.voiceNote && (
								<View
									className="mt-2 rounded-lg px-3 py-2"
									style={{
										backgroundColor: "rgba(255,255,255,0.04)",
									}}
								>
									<View className="flex-row items-center gap-1.5">
										<Icon
											as={Mic}
											className="text-muted-foreground size-3"
										/>
										<Text className="text-muted-foreground text-xs italic">
											{issue.voiceNote}
										</Text>
									</View>
								</View>
							)}
						</View>
					))}
				</View>

				<Separator className="mb-6" />

				{/* Photos */}
				<View className="mb-6">
					<Text className="text-foreground mb-3 text-sm font-bold uppercase tracking-wider">
						Photos ({REPORT_TEXT.photos.length})
					</Text>
					<View className="flex-row flex-wrap gap-2">
						{REPORT_TEXT.photos.map((photo) => (
							<View
								key={photo.seed}
								className="relative overflow-hidden rounded-lg"
								style={{ width: "31%", aspectRatio: 1 }}
							>
								<Image
									source={{
										uri: `https://picsum.photos/seed/${photo.seed}/200/200`,
									}}
									style={{
										width: "100%",
										height: "100%",
									}}
								/>
								{photo.isIssue && (
									<View
										className="absolute top-1 right-1 rounded-full px-1.5 py-0.5"
										style={{ backgroundColor: "#ef4444" }}
									>
										<Text className="text-[9px] font-bold text-white">
											ISSUE
										</Text>
									</View>
								)}
								<View
									className="absolute bottom-0 left-0 right-0 px-2 py-1"
									style={{
										backgroundColor: "rgba(0,0,0,0.6)",
									}}
								>
									<Text className="text-[10px] text-white">
										{photo.time}
									</Text>
								</View>
							</View>
						))}
					</View>
				</View>

				<Separator className="mb-6" />

				{/* Footer */}
				<View className="items-center gap-1">
					<Text className="text-muted-foreground text-xs">
						Generated by SiteLink · sitelink.app
					</Text>
					<Text className="text-muted-foreground text-xs">
						Generated just now
					</Text>
				</View>
			</ScrollView>

			{/* Action bar */}
			<View
				className="flex-row items-center justify-around border-t px-4 py-3"
				style={{ borderColor: "rgba(255,255,255,0.08)" }}
			>
				<Pressable className="items-center gap-1" onPress={() => setToastMsg("Report regenerated")}>
					<Icon as={RefreshCcw} className="text-foreground size-5" />
					<Text className="text-foreground text-[10px]">Regenerate</Text>
				</Pressable>
				<Pressable className="items-center gap-1" onPress={() => setToastMsg("Report copied to clipboard")}>
					<Icon as={Copy} className="text-foreground size-5" />
					<Text className="text-foreground text-[10px]">Copy</Text>
				</Pressable>
				<Pressable className="items-center gap-1" onPress={() => setToastMsg("Share link created")}>
					<Icon as={Share2} className="text-foreground size-5" />
					<Text className="text-foreground text-[10px]">Share</Text>
				</Pressable>
				<Pressable className="items-center gap-1" onPress={() => setToastMsg("PDF downloaded")}>
					<Icon as={Download} className="text-foreground size-5" />
					<Text className="text-foreground text-[10px]">PDF</Text>
				</Pressable>
			</View>
			<StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
		</View>
	);
}

const meta: Meta<typeof DailySummaryReport> = {
	title: "Screens/Daily Summary",
	component: DailySummaryReport,
	parameters: {
		layout: "fullscreen",
	},
};

export default meta;
type Story = StoryObj<typeof DailySummaryReport>;

export const Default: Story = {};
