import type { Meta, StoryObj } from "@storybook/react";
import {
	ArrowRight,
	Camera,
	Check,
	CheckCircle,
	ChevronRight,
	Eye,
	EyeOff,
	FileText,
	FolderOpen,
	Layers,
	Link2,
	Loader,
	MapPin,
	Mic,
	ScanLine,
	Search,
	Shield,
	Sparkles,
	Upload,
	Zap,
} from "lucide-react-native";
import * as React from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import {
	CreateProjectOverlay,
	StoryToast,
	UploadPlanOverlay,
} from "@/app/_story-components";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

type FlowStep =
	| "splash"
	| "welcome"
	| "trial"
	| "signup"
	| "empty-projects"
	| "create-project"
	| "upload"
	| "processing"
	| "reveal";

function SplashScreen({ onComplete }: { onComplete: () => void }) {
	React.useEffect(() => {
		const timer = setTimeout(onComplete, 2000);
		return () => clearTimeout(timer);
	}, [onComplete]);

	return (
		<View className="bg-background flex-1 items-center justify-center" style={{ minHeight: "100vh" } as any}>
			<View className="items-center gap-6">
				<View className="items-center justify-center rounded-3xl" style={{ width: 88, height: 88, backgroundColor: "rgba(59,130,246,0.1)" }}>
					<View className="items-center justify-center rounded-2xl" style={{ width: 64, height: 64, backgroundColor: "rgba(59,130,246,0.15)" }}>
						<Icon as={Zap} style={{ color: "#3b82f6" }} className="size-8" />
					</View>
				</View>
				<View className="items-center gap-1.5">
					<View className="flex-row items-baseline gap-1.5">
						<Text className="text-foreground text-3xl font-black tracking-tight">Site</Text>
						<Text className="text-primary text-3xl font-black tracking-tight">Link</Text>
					</View>
					<Text className="text-muted-foreground text-xs tracking-widest uppercase">Construction Plan Intelligence</Text>
				</View>
			</View>
		</View>
	);
}

function WelcomeScreen({ onGetStarted }: { onGetStarted: () => void }) {
	return (
		<View className="bg-background flex-1 justify-between px-6 py-12">
			<View className="flex-1 items-center justify-center gap-8">
				<View className="items-center gap-4">
					<View className="flex-row items-baseline gap-1.5">
						<Text className="text-foreground text-4xl font-black tracking-tight">
							Site
						</Text>
						<Text className="text-primary text-4xl font-black tracking-tight">
							Link
						</Text>
					</View>
					<Text className="text-muted-foreground text-sm tracking-widest uppercase">
						Construction Plan Intelligence
					</Text>
				</View>

				<View className="w-full gap-4 pt-4">
					{[
						{ icon: Zap, title: "Auto-Linked Callouts", desc: "Tap any callout marker to jump directly to referenced details", color: "#3b82f6" },
						{ icon: Camera, title: "Photo Documentation", desc: "Photos auto-linked to plan locations with voice notes", color: "#22c55e" },
						{ icon: Sparkles, title: "AI-Extracted Schedules", desc: "Schedules, notes, and legends extracted automatically", color: "#a855f7" },
						{ icon: Shield, title: "Works Offline", desc: "Full plan access on site, even without cell service", color: "#f59e0b" },
					].map((item) => (
						<View
							key={item.title}
							className="flex-row items-center gap-4 rounded-xl px-4 py-3"
							style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
						>
							<View
								className="size-10 items-center justify-center rounded-xl"
								style={{ backgroundColor: item.color + "18" }}
							>
								<Icon as={item.icon} style={{ color: item.color }} className="size-5" />
							</View>
							<View className="flex-1">
								<Text className="text-foreground text-sm font-bold">{item.title}</Text>
								<Text className="text-muted-foreground text-xs leading-relaxed">{item.desc}</Text>
							</View>
						</View>
					))}
				</View>
			</View>

			<View className="gap-4 pt-8">
				<Button onPress={onGetStarted}>
					<View className="flex-row items-center gap-2">
						<Text className="text-primary-foreground font-bold">Get Started</Text>
						<Icon as={ArrowRight} className="text-primary-foreground size-4" />
					</View>
				</Button>
				<Text className="text-muted-foreground text-center text-xs">No credit card required</Text>
			</View>
		</View>
	);
}

function TrialStartScreen({ onContinue, onSkip }: { onContinue: () => void; onSkip: () => void }) {
	return (
		<ScrollView className="bg-background flex-1" contentContainerClassName="px-6 py-12">
			<View className="items-center gap-2">
				<View className="flex-row items-baseline gap-1">
					<Text className="text-foreground text-2xl font-black tracking-tight">Site</Text>
					<Text className="text-primary text-2xl font-black tracking-tight">Link</Text>
				</View>
			</View>

			<View className="mt-8 items-center gap-2">
				<View className="bg-primary/15 rounded-full px-4 py-1.5">
					<Text className="text-primary text-xs font-bold uppercase tracking-wider">Pro Trial Active</Text>
				</View>
				<Text className="text-foreground text-2xl font-bold">14 Days Free</Text>
				<Text className="text-muted-foreground text-center text-sm leading-relaxed">
					Full Pro features, no credit card required.{"\n"}Downgrade to Starter anytime.
				</Text>
			</View>

			<View
				className="mt-8 gap-0 overflow-hidden rounded-2xl"
				style={{ backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}
			>
				<View className="border-b px-5 py-4" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
					<Text className="text-foreground text-sm font-bold">What&apos;s included:</Text>
				</View>
				{[
					"5 projects", "15 team members", "Unlimited sheets",
					"Auto callout detection (96% accuracy)", "Voice notes + transcription",
					"Plan text search", "AI daily summaries", "Offline access",
				].map((label) => (
					<View key={label} className="flex-row items-center gap-3 border-b px-5 py-3" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
						<Icon as={Check} className="text-primary size-4" />
						<Text className="text-foreground text-sm">{label}</Text>
					</View>
				))}
			</View>

			<View className="mt-8 gap-4">
				<Button onPress={onContinue}>
					<View className="flex-row items-center gap-2">
						<Text className="text-primary-foreground font-bold">Continue</Text>
						<Icon as={ArrowRight} className="text-primary-foreground size-4" />
					</View>
				</Button>
				<Pressable onPress={onSkip}>
					<Text className="text-muted-foreground text-center text-sm underline">Skip for now</Text>
				</Pressable>
			</View>

			<View className="mt-8 items-center gap-1 pb-4">
				<Text className="text-muted-foreground text-center text-xs">After trial: Starter ($29/mo) or Pro ($79/mo)</Text>
				<Text className="text-muted-foreground text-center text-xs">Projects become read-only if you don&apos;t subscribe</Text>
			</View>
		</ScrollView>
	);
}

function SignUpScreen({ onSignUp }: { onSignUp: () => void }) {
	const [name, setName] = React.useState("");
	const [email, setEmail] = React.useState("");
	const [password, setPassword] = React.useState("");
	const [orgName, setOrgName] = React.useState("");
	const [showPassword, setShowPassword] = React.useState(false);

	return (
		<ScrollView className="bg-background flex-1" contentContainerClassName="px-6 py-12">
			<View className="items-center gap-2">
				<View className="flex-row items-baseline gap-1">
					<Text className="text-foreground text-2xl font-black tracking-tight">Site</Text>
					<Text className="text-primary text-2xl font-black tracking-tight">Link</Text>
				</View>
			</View>

			<View className="mt-8 items-center gap-2">
				<Text className="text-foreground text-2xl font-bold">Create Your Account</Text>
				<Text className="text-muted-foreground text-center text-sm leading-relaxed">Start your 14-day Pro trial today</Text>
			</View>

			<View className="mt-8 gap-3">
				<Button variant="outline" onPress={onSignUp}>
					<Text className="text-foreground font-medium">Continue with Google</Text>
				</Button>
				<Button variant="outline" onPress={onSignUp}>
					<Text className="text-foreground font-medium">Continue with Microsoft</Text>
				</Button>
			</View>

			<View className="my-6 flex-row items-center gap-4">
				<View className="bg-border h-px flex-1" />
				<Text className="text-muted-foreground text-xs uppercase tracking-wider">or</Text>
				<View className="bg-border h-px flex-1" />
			</View>

			<View className="gap-5">
				<View className="gap-2">
					<Label nativeID="obName">Full Name</Label>
					<Input nativeID="obName" className="h-12 rounded-xl" placeholder="John Smith" value={name} onChangeText={setName} />
				</View>
				<View className="gap-2">
					<Label nativeID="obEmail">Email</Label>
					<Input nativeID="obEmail" className="h-12 rounded-xl" placeholder="john@company.com" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
				</View>
				<View className="gap-2">
					<Label nativeID="obPassword">Password</Label>
					<View className="relative">
						<Input nativeID="obPassword" className="h-12 rounded-xl pr-12" placeholder="Minimum 8 characters" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
						<Pressable onPress={() => setShowPassword((s) => !s)} className="absolute right-3 top-3">
							<Icon as={showPassword ? EyeOff : Eye} className="text-muted-foreground size-5" />
						</Pressable>
					</View>
				</View>
				<View className="gap-2">
					<Label nativeID="obOrg">Organization Name</Label>
					<Input nativeID="obOrg" className="h-12 rounded-xl" placeholder="Acme Construction" value={orgName} onChangeText={setOrgName} />
				</View>
			</View>

			<View className="mt-8 gap-4">
				<Button onPress={onSignUp}>
					<View className="flex-row items-center gap-2">
						<Text className="text-primary-foreground font-bold">Create Account</Text>
						<Icon as={ArrowRight} className="text-primary-foreground size-4" />
					</View>
				</Button>
				<Text className="text-muted-foreground text-center text-xs leading-relaxed">
					By signing up you agree to our Terms of Service{"\n"}and Privacy Policy
				</Text>
			</View>
		</ScrollView>
	);
}

function EmptyProjectsScreen({ onCreateProject }: { onCreateProject?: () => void }) {
	return (
		<View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
			<View className="flex-row items-center justify-between px-4 py-3">
				<View style={{ width: 44 }} />
				<Text className="text-foreground text-lg font-bold">Projects</Text>
				<View style={{ width: 44 }} />
			</View>
			<View className="flex-1 items-center justify-center px-8">
				<View className="bg-muted/20 mb-6 size-20 items-center justify-center rounded-full">
					<Icon as={FolderOpen} className="text-muted-foreground size-10" />
				</View>
				<Text className="text-foreground mb-2 text-xl font-bold">Welcome to SiteLink</Text>
				<Text className="text-muted-foreground mb-8 text-center text-sm leading-relaxed">
					Create your first project to start managing construction plans with AI-powered intelligence.
				</Text>
				<Button className="h-12 rounded-xl px-8" onPress={onCreateProject}>
					<Text className="text-primary-foreground text-base font-bold">Create Project</Text>
				</Button>
			</View>
		</View>
	);
}

const PROCESSING_STEPS = [
	{ key: "upload", label: "Uploading plan", icon: Upload, color: "#3b82f6", detail: "structural-plans-v3.pdf" },
	{ key: "pages", label: "Splitting pages", icon: FileText, color: "#3b82f6", detail: "12 sheets detected" },
	{ key: "metadata", label: "Reading sheet titles", icon: Layers, color: "#a855f7", detail: "S1.0, S2.0, S3.0..." },
	{ key: "callouts", label: "Detecting callouts", icon: ScanLine, color: "#f59e0b", detail: "Scanning for detail markers, sections, elevations..." },
	{ key: "linking", label: "Linking references", icon: Link2, color: "#22c55e", detail: "Matching callouts to destination sheets" },
	{ key: "tiles", label: "Generating tiles", icon: Zap, color: "#22c55e", detail: "Creating zoomable view layers" },
];

function UploadScreen({ onUpload }: { onUpload: () => void }) {
	return (
		<View className="bg-background" style={{ minHeight: "100vh" } as any}>
			<View className="px-6 pt-8 pb-4">
				<Text className="text-foreground text-2xl font-bold">Add Your Plans</Text>
				<Text className="text-muted-foreground mt-1 text-base">Upload a PDF and watch the magic happen</Text>
			</View>
			<View className="flex-1 px-6">
				<Pressable
					onPress={onUpload}
					className="items-center justify-center rounded-3xl border-2 border-dashed py-16 active:opacity-80"
					style={{ borderColor: "rgba(255,255,255,0.15)", backgroundColor: "rgba(255,255,255,0.03)" }}
				>
					<View className="mb-5 items-center justify-center rounded-full" style={{ width: 72, height: 72, backgroundColor: "rgba(245,245,245,0.08)" }}>
						<Icon as={Upload} className="text-primary size-8" />
					</View>
					<Text className="text-foreground text-lg font-bold">Tap to upload PDF</Text>
					<Text className="text-muted-foreground mt-2 text-center text-sm leading-relaxed">
						Your structural plans, details, and schedules{"\n"}all in one file
					</Text>
					<View className="bg-primary mt-6 flex-row items-center gap-2 rounded-full px-6 py-3">
						<Icon as={FileText} className="text-primary-foreground size-4" />
						<Text className="text-primary-foreground text-sm font-bold">Choose File</Text>
					</View>
				</Pressable>

				<View className="mt-8">
					<Text className="text-muted-foreground mb-4 text-xs font-bold uppercase tracking-wider">What happens next</Text>
					<View className="gap-4">
						{[
							{ icon: ScanLine, color: "#f59e0b", text: "AI scans every sheet for callout symbols" },
							{ icon: Link2, color: "#22c55e", text: "Callouts are automatically linked to their target details" },
							{ icon: Sparkles, color: "#a855f7", text: "Schedules and tables are extracted for quick reference" },
						].map((item, i) => (
							<View key={i} className="flex-row items-center gap-3">
								<View className="items-center justify-center rounded-full" style={{ width: 36, height: 36, backgroundColor: item.color + "15" }}>
									<Icon as={item.icon} style={{ color: item.color }} className="size-4" />
								</View>
								<Text className="text-foreground flex-1 text-sm">{item.text}</Text>
							</View>
						))}
					</View>
				</View>

				<View className="mt-6 items-center pb-8">
					<Text className="text-muted-foreground text-xs">Supported: PDF, JPEG, PNG — Recommended: 300 DPI</Text>
				</View>
			</View>
		</View>
	);
}

function ProcessingScreen({ onComplete }: { onComplete: () => void }) {
	const [stepIndex, setStepIndex] = React.useState(0);
	const [subProgress, setSubProgress] = React.useState(0);
	const isComplete = stepIndex >= PROCESSING_STEPS.length;

	React.useEffect(() => {
		if (isComplete) return;
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
	}, [isComplete]);

	React.useEffect(() => {
		if (isComplete) {
			const timer = setTimeout(onComplete, 500);
			return () => clearTimeout(timer);
		}
	}, [isComplete, onComplete]);

	const currentStep = PROCESSING_STEPS[stepIndex];
	const progress = isComplete ? 100 : ((stepIndex + Math.min(subProgress, 100) / 100) / PROCESSING_STEPS.length) * 100;

	return (
		<View className="bg-background" style={{ minHeight: "100vh" } as any}>
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

			<View className="px-6 pb-2">
				<View className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
					<View className="h-full rounded-full" style={{ width: `${Math.min(progress, 100)}%` as any, backgroundColor: isComplete ? "#22c55e" : "#3b82f6" }} />
				</View>
			</View>

			<View className="items-center px-6 py-8">
				{isComplete ? (
					<>
						<View className="mb-4 items-center justify-center rounded-full" style={{ width: 80, height: 80, backgroundColor: "rgba(34,197,94,0.15)" }}>
							<Icon as={CheckCircle} style={{ color: "#22c55e" }} className="size-10" />
						</View>
						<Text className="text-foreground text-2xl font-bold">All Done!</Text>
						<Text className="text-muted-foreground mt-1 text-sm">Your plan is ready to explore</Text>
					</>
				) : (
					<>
						<View className="mb-4 items-center justify-center rounded-full" style={{ width: 80, height: 80, backgroundColor: (currentStep?.color ?? "#3b82f6") + "15" }}>
							<Icon as={currentStep?.icon ?? Loader} style={{ color: currentStep?.color ?? "#3b82f6" }} className="size-10" />
						</View>
						<Text className="text-foreground text-xl font-bold">{currentStep?.label}</Text>
						{currentStep?.detail && (
							<Text className="text-muted-foreground mt-1 text-center text-sm">{currentStep.detail}</Text>
						)}
					</>
				)}
			</View>

			<View className="flex-1 px-6">
				<View className="gap-1">
					{PROCESSING_STEPS.map((step, idx) => {
						const status = isComplete ? "completed" : idx < stepIndex ? "completed" : idx === stepIndex ? "active" : "pending";
						return (
							<View key={step.key} className={cn("flex-row items-center gap-3 rounded-xl px-4 py-3", status === "active" && "bg-muted/15")}>
								{status === "completed" ? (
									<View className="items-center justify-center rounded-full" style={{ width: 28, height: 28, backgroundColor: "rgba(34,197,94,0.15)" }}>
										<Icon as={Check} style={{ color: "#22c55e" }} className="size-4" />
									</View>
								) : (
									<View className="items-center justify-center rounded-full" style={{ width: 28, height: 28, backgroundColor: status === "active" ? step.color + "15" : "rgba(255,255,255,0.05)" }}>
										<Icon as={step.icon} style={{ color: status === "active" ? step.color : undefined }} className={cn("size-4", status === "pending" && "text-muted-foreground/40")} />
									</View>
								)}
								<Text className={cn("flex-1 text-sm font-medium", status === "completed" && "text-muted-foreground line-through", status === "active" && "text-foreground", status === "pending" && "text-muted-foreground/40")}>
									{step.label}
								</Text>
							</View>
						);
					})}
				</View>
			</View>
		</View>
	);
}

const MOCK_SHEETS = [
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

function RevealScreen({ onStartExploring }: { onStartExploring: () => void }) {
	const stats = [
		{ icon: FileText, color: "#3b82f6", label: "Sheets", value: "12" },
		{ icon: MapPin, color: "#22c55e", label: "Callouts", value: "47" },
		{ icon: Link2, color: "#a855f7", label: "Links", value: "38" },
	];

	return (
		<View className="bg-background" style={{ minHeight: "100vh" } as any}>
			<View className="items-center px-6 pt-8 pb-6" style={{ backgroundColor: "rgba(34,197,94,0.03)" }}>
				<View className="mb-4 items-center justify-center rounded-full" style={{ width: 72, height: 72, backgroundColor: "rgba(34,197,94,0.12)" }}>
					<Icon as={Sparkles} style={{ color: "#22c55e" }} className="size-8" />
				</View>
				<Text className="text-foreground text-2xl font-bold">Your Plans Are Ready</Text>
				<Text className="text-muted-foreground mt-1 text-center text-sm">structural-plans-v3.pdf</Text>

				<View className="mt-6 flex-row gap-4">
					{stats.map((stat) => (
						<View key={stat.label} className="flex-1 items-center rounded-2xl py-4" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
							<View className="mb-2 items-center justify-center rounded-full" style={{ width: 36, height: 36, backgroundColor: stat.color + "15" }}>
								<Icon as={stat.icon} style={{ color: stat.color }} className="size-4" />
							</View>
							<Text className="text-foreground text-2xl font-bold">{stat.value}</Text>
							<Text className="text-muted-foreground text-xs font-medium">{stat.label}</Text>
						</View>
					))}
				</View>

				<View className="mt-4 w-full flex-row items-center gap-2 rounded-xl px-4 py-3" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
					<Icon as={CheckCircle} style={{ color: "#22c55e" }} className="size-4" />
					<Text className="text-foreground flex-1 text-sm">
						<Text className="font-bold">38 of 47</Text> callouts auto-linked
					</Text>
					<Text className="text-muted-foreground text-xs">81% linked</Text>
				</View>

				<View className="mt-2 w-full flex-row items-center gap-2 rounded-xl px-4 py-3" style={{ backgroundColor: "rgba(234,88,12,0.06)" }}>
					<Icon as={ScanLine} style={{ color: "#ea580c" }} className="size-4" />
					<Text className="text-muted-foreground flex-1 text-sm">
						<Text className="text-foreground font-semibold">9 callouts</Text> need manual review
					</Text>
					<Text style={{ color: "#ea580c" }} className="text-xs font-semibold">Review</Text>
				</View>
			</View>

			<View className="flex-1">
				<View className="flex-row items-center justify-between px-6 py-4">
					<Text className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Detected Sheets</Text>
					<Text className="text-muted-foreground text-xs">{MOCK_SHEETS.length} sheets</Text>
				</View>
				<ScrollView className="flex-1" showsVerticalScrollIndicator>
					{MOCK_SHEETS.map((sheet) => (
						<Pressable key={sheet.id} className="active:bg-muted/20 flex-row items-center gap-3 px-6 py-3">
							<View className="items-center justify-center overflow-hidden rounded-lg" style={{ width: 48, height: 48, backgroundColor: "rgba(255,255,255,0.05)" }}>
								<Image source={{ uri: "/plan-sample.png" }} style={{ width: 48, height: 48 }} resizeMode="cover" />
							</View>
							<View className="flex-1">
								<View className="flex-row items-center gap-2">
									<Text className="text-foreground text-sm font-bold">{sheet.number}</Text>
									<Text className="text-foreground text-sm">{sheet.title}</Text>
								</View>
								<View className="mt-0.5 flex-row items-center gap-3">
									<View className="flex-row items-center gap-1">
										<Icon as={MapPin} className="text-muted-foreground size-3" />
										<Text className="text-muted-foreground text-xs">{sheet.calloutCount} callouts</Text>
									</View>
									<View className="flex-row items-center gap-1">
										<Icon as={Link2} className="text-muted-foreground size-3" />
										<Text className="text-muted-foreground text-xs">{sheet.linkCount} linked</Text>
									</View>
								</View>
							</View>
							<Icon as={ChevronRight} className="text-muted-foreground size-4" />
						</Pressable>
					))}
					<View style={{ height: 100 }} />
				</ScrollView>
			</View>

			<View style={{ position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingBottom: 32, paddingTop: 16, backgroundColor: "#121212" }}>
				<Pressable onPress={onStartExploring} className="bg-primary flex-row items-center justify-center gap-2 rounded-xl py-4">
					<Text className="text-primary-foreground text-base font-bold">Start Exploring</Text>
					<Icon as={ArrowRight} className="text-primary-foreground size-5" />
				</Pressable>
			</View>
		</View>
	);
}

function OnboardingFlow({ initialStep = "splash" as FlowStep }: { initialStep?: FlowStep }) {
	const [step, setStep] = React.useState<FlowStep>(initialStep);
	const [toastMsg, setToastMsg] = React.useState("");
	const [createdProjectName, setCreatedProjectName] = React.useState("");

	const renderStep = () => {
		switch (step) {
			case "splash":
				return <SplashScreen onComplete={() => setStep("welcome")} />;
			case "welcome":
				return <WelcomeScreen onGetStarted={() => setStep("trial")} />;
			case "trial":
				return <TrialStartScreen onContinue={() => setStep("signup")} onSkip={() => setStep("signup")} />;
			case "signup":
				return <SignUpScreen onSignUp={() => setStep("empty-projects")} />;
			case "empty-projects":
				return <EmptyProjectsScreen onCreateProject={() => setStep("create-project")} />;
			case "create-project":
				return (
					<View className="flex-1" style={{ position: "relative" } as any}>
						<EmptyProjectsScreen />
						<CreateProjectOverlay
							onClose={() => setStep("empty-projects")}
							onCreated={(data) => {
								setCreatedProjectName(data.name);
								setToastMsg("Project created!");
								setStep("upload");
							}}
						/>
					</View>
				);
			case "upload":
				return <UploadScreen onUpload={() => setStep("processing")} />;
			case "processing":
				return <ProcessingScreen onComplete={() => setStep("reveal")} />;
			case "reveal":
				return <RevealScreen onStartExploring={() => setToastMsg("Opening plan viewer...")} />;
		}
	};

	return (
		<View className="flex-1" style={{ position: "relative" } as any}>
			{renderStep()}
			<StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
		</View>
	);
}

const meta: Meta<typeof OnboardingFlow> = {
	title: "Flows/1. Onboarding",
	component: OnboardingFlow,
	parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof OnboardingFlow>;

export const FullFlow: Story = {
	name: "Full Flow",
	args: { initialStep: "splash" },
};

export const Splash: Story = {
	name: "Splash",
	args: { initialStep: "splash" },
};

export const WelcomeStart: Story = {
	name: "Welcome",
	args: { initialStep: "welcome" },
};

export const TrialInfo: Story = {
	name: "Trial Info",
	args: { initialStep: "trial" },
};

export const CreateAccount: Story = {
	name: "Create Account",
	args: { initialStep: "signup" },
};

export const UploadPlan: Story = {
	name: "Upload Plan",
	args: { initialStep: "upload" },
};

export const ProcessingPlan: Story = {
	name: "Processing",
	args: { initialStep: "processing" },
};

export const RevealResults: Story = {
	name: "Reveal Results",
	args: { initialStep: "reveal" },
};
