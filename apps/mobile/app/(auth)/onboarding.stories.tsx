import type { Meta, StoryObj } from "@storybook/react";
import {
	ArrowRight,
	Camera,
	Check,
	Eye,
	EyeOff,
	FileText,
	FolderOpen,
	Mic,
	Search,
	Shield,
	Sparkles,
	Zap,
} from "lucide-react-native";
import * as React from "react";
import { Pressable, ScrollView, View } from "react-native";
import {
	CreateProjectOverlay,
	StoryToast,
} from "@/app/_story-components";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";

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
						{
							icon: Zap,
							title: "Auto-Linked Callouts",
							desc: "Tap any callout marker to jump directly to referenced details",
							color: "#3b82f6",
						},
						{
							icon: Camera,
							title: "Photo Documentation",
							desc: "Photos auto-linked to plan locations with voice notes",
							color: "#22c55e",
						},
						{
							icon: Sparkles,
							title: "AI-Extracted Schedules",
							desc: "Schedules, notes, and legends extracted automatically",
							color: "#a855f7",
						},
						{
							icon: Shield,
							title: "Works Offline",
							desc: "Full plan access on site, even without cell service",
							color: "#f59e0b",
						},
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
								<Icon
									as={item.icon}
									style={{ color: item.color }}
									className="size-5"
								/>
							</View>
							<View className="flex-1">
								<Text className="text-foreground text-sm font-bold">
									{item.title}
								</Text>
								<Text className="text-muted-foreground text-xs leading-relaxed">
									{item.desc}
								</Text>
							</View>
						</View>
					))}
				</View>
			</View>

			<View className="gap-4 pt-8">
				<Button onPress={onGetStarted}>
					<View className="flex-row items-center gap-2">
						<Text className="text-primary-foreground font-bold">
							Get Started
						</Text>
						<Icon
							as={ArrowRight}
							className="text-primary-foreground size-4"
						/>
					</View>
				</Button>
				<Text className="text-muted-foreground text-center text-xs">
					No credit card required
				</Text>
			</View>
		</View>
	);
}

function TrialStartScreen({
	onCreateProject,
	onSkip,
}: {
	onCreateProject: () => void;
	onSkip: () => void;
}) {
	return (
		<ScrollView
			className="bg-background flex-1"
			contentContainerClassName="px-6 py-12"
		>
			<View className="items-center gap-2">
				<View className="flex-row items-baseline gap-1">
					<Text className="text-foreground text-2xl font-black tracking-tight">
						Site
					</Text>
					<Text className="text-primary text-2xl font-black tracking-tight">
						Link
					</Text>
				</View>
			</View>

			<View className="mt-8 items-center gap-2">
				<View className="bg-primary/15 rounded-full px-4 py-1.5">
					<Text className="text-primary text-xs font-bold uppercase tracking-wider">
						Pro Trial Active
					</Text>
				</View>
				<Text className="text-foreground text-2xl font-bold">
					14 Days Free
				</Text>
				<Text className="text-muted-foreground text-center text-sm leading-relaxed">
					Full Pro features, no credit card required.{"\n"}Downgrade
					to Starter anytime.
				</Text>
			</View>

			<View
				className="mt-8 gap-0 overflow-hidden rounded-2xl"
				style={{
					backgroundColor: "rgba(255,255,255,0.04)",
					borderWidth: 1,
					borderColor: "rgba(255,255,255,0.08)",
				}}
			>
				<View className="border-b px-5 py-4" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
					<Text className="text-foreground text-sm font-bold">
						What&apos;s included:
					</Text>
				</View>
				{[
					{ label: "5 projects", icon: FileText },
					{ label: "15 team members", icon: Check },
					{ label: "Unlimited sheets", icon: FileText },
					{ label: "Auto callout detection (96% accuracy)", icon: Zap },
					{ label: "Voice notes + transcription", icon: Mic },
					{ label: "Plan text search", icon: Search },
					{ label: "AI daily summaries", icon: Sparkles },
					{ label: "Offline access", icon: Shield },
				].map((item) => (
					<View
						key={item.label}
						className="flex-row items-center gap-3 border-b px-5 py-3"
						style={{ borderColor: "rgba(255,255,255,0.04)" }}
					>
						<Icon as={Check} className="text-primary size-4" />
						<Text className="text-foreground text-sm">
							{item.label}
						</Text>
					</View>
				))}
			</View>

			<View className="mt-8 gap-4">
				<Button onPress={onCreateProject}>
					<View className="flex-row items-center gap-2">
						<Text className="text-primary-foreground font-bold">
							Create First Project
						</Text>
						<Icon
							as={ArrowRight}
							className="text-primary-foreground size-4"
						/>
					</View>
				</Button>
				<Pressable onPress={onSkip}>
					<Text className="text-muted-foreground text-center text-sm underline">
						Skip for now
					</Text>
				</Pressable>
			</View>

			<View className="mt-8 items-center gap-1 pb-4">
				<Text className="text-muted-foreground text-center text-xs">
					After trial: Starter ($29/mo) or Pro ($79/mo)
				</Text>
				<Text className="text-muted-foreground text-center text-xs">
					Projects become read-only if you don&apos;t subscribe
				</Text>
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
		<ScrollView
			className="bg-background flex-1"
			contentContainerClassName="px-6 py-12"
		>
			<View className="items-center gap-2">
				<View className="flex-row items-baseline gap-1">
					<Text className="text-foreground text-2xl font-black tracking-tight">
						Site
					</Text>
					<Text className="text-primary text-2xl font-black tracking-tight">
						Link
					</Text>
				</View>
			</View>

			<View className="mt-8 items-center gap-2">
				<Text className="text-foreground text-2xl font-bold">
					Create Your Account
				</Text>
				<Text className="text-muted-foreground text-center text-sm leading-relaxed">
					Start your 14-day Pro trial today
				</Text>
			</View>

			<View className="mt-8 gap-3">
				<Button variant="outline" onPress={onSignUp}>
					<Text className="text-foreground font-medium">
						Continue with Google
					</Text>
				</Button>
				<Button variant="outline" onPress={onSignUp}>
					<Text className="text-foreground font-medium">
						Continue with Microsoft
					</Text>
				</Button>
			</View>

			<View className="my-6 flex-row items-center gap-4">
				<View className="bg-border h-px flex-1" />
				<Text className="text-muted-foreground text-xs uppercase tracking-wider">
					or
				</Text>
				<View className="bg-border h-px flex-1" />
			</View>

			<View className="gap-5">
				<View className="gap-2">
					<Label nativeID="onboardingName">Full Name</Label>
					<Input
						nativeID="onboardingName"
						className="h-12 rounded-xl"
						placeholder="John Smith"
						value={name}
						onChangeText={setName}
					/>
				</View>
				<View className="gap-2">
					<Label nativeID="onboardingEmail">Email</Label>
					<Input
						nativeID="onboardingEmail"
						className="h-12 rounded-xl"
						placeholder="john@company.com"
						value={email}
						onChangeText={setEmail}
						autoCapitalize="none"
						keyboardType="email-address"
					/>
				</View>
				<View className="gap-2">
					<Label nativeID="onboardingPassword">Password</Label>
					<View className="relative">
						<Input
							nativeID="onboardingPassword"
							className="h-12 rounded-xl pr-12"
							placeholder="Minimum 8 characters"
							value={password}
							onChangeText={setPassword}
							secureTextEntry={!showPassword}
						/>
						<Pressable
							onPress={() => setShowPassword((s) => !s)}
							className="absolute right-3 top-3"
						>
							<Icon
								as={showPassword ? EyeOff : Eye}
								className="text-muted-foreground size-5"
							/>
						</Pressable>
					</View>
				</View>
				<View className="gap-2">
					<Label nativeID="onboardingOrg">Organization Name</Label>
					<Input
						nativeID="onboardingOrg"
						className="h-12 rounded-xl"
						placeholder="Acme Construction"
						value={orgName}
						onChangeText={setOrgName}
					/>
				</View>
			</View>

			<View className="mt-8 gap-4">
				<Button onPress={onSignUp}>
					<View className="flex-row items-center gap-2">
						<Text className="text-primary-foreground font-bold">
							Create Account
						</Text>
						<Icon
							as={ArrowRight}
							className="text-primary-foreground size-4"
						/>
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
		<View
			className="bg-background flex-1"
			style={{ minHeight: "100vh" } as any}
		>
			<View className="flex-row items-center justify-between px-4 py-3">
				<View style={{ width: 44 }} />
				<Text className="text-foreground text-lg font-bold">Projects</Text>
				<View style={{ width: 44 }} />
			</View>

			<View className="flex-1 items-center justify-center px-8">
				<View className="bg-muted/20 mb-6 size-20 items-center justify-center rounded-full">
					<Icon as={FolderOpen} className="text-muted-foreground size-10" />
				</View>
				<Text className="text-foreground mb-2 text-xl font-bold">
					Welcome to SiteLink
				</Text>
				<Text className="text-muted-foreground mb-8 text-center text-sm leading-relaxed">
					Create your first project to start managing construction plans with
					AI-powered intelligence.
				</Text>
				<Button className="h-12 rounded-xl px-8" onPress={onCreateProject}>
					<Text className="text-primary-foreground text-base font-bold">
						Create Project
					</Text>
				</Button>
			</View>
		</View>
	);
}

function OnboardingWorkspace({ projectName }: { projectName: string }) {
	return (
		<View
			className="bg-background flex-1"
			style={{ minHeight: "100vh" } as any}
		>
			<View className="flex-row items-center justify-between px-4 py-3">
				<View style={{ width: 44 }} />
				<Text className="text-foreground text-base font-bold" numberOfLines={1}>
					{projectName}
				</Text>
				<View style={{ width: 44 }} />
			</View>
			<View className="flex-1 items-center justify-center px-8">
				<View className="bg-primary/15 mb-4 size-16 items-center justify-center rounded-full">
					<Icon as={Check} className="text-primary size-8" />
				</View>
				<Text className="text-foreground mb-2 text-xl font-bold">
					{"You're All Set!"}
				</Text>
				<Text className="text-muted-foreground text-center text-sm leading-relaxed">
					Your project is ready. Upload a plan to get started with
					AI-powered callout detection and schedule extraction.
				</Text>
			</View>
		</View>
	);
}

function OnboardingFlow() {
	const [step, setStep] = React.useState<
		"welcome" | "trial" | "signup" | "projects" | "create-project" | "workspace"
	>("welcome");
	const [toastMsg, setToastMsg] = React.useState("");
	const [createdProjectName, setCreatedProjectName] = React.useState("");

	if (step === "workspace") {
		return (
			<View className="flex-1" style={{ position: "relative" } as any}>
				<OnboardingWorkspace projectName={createdProjectName} />
				<StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
			</View>
		);
	}

	if (step === "create-project") {
		return (
			<View className="flex-1" style={{ position: "relative" } as any}>
				<EmptyProjectsScreen />
				<CreateProjectOverlay
					onClose={() => setStep("projects")}
					onCreated={(data) => {
						setCreatedProjectName(data.name);
						setToastMsg("Project created! Welcome to SiteLink");
						setStep("workspace");
					}}
				/>
			</View>
		);
	}

	if (step === "projects") {
		return (
			<View className="flex-1" style={{ position: "relative" } as any}>
				<EmptyProjectsScreen onCreateProject={() => setStep("create-project")} />
				<StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
			</View>
		);
	}

	if (step === "signup") {
		return <SignUpScreen onSignUp={() => setStep("projects")} />;
	}

	if (step === "trial") {
		return (
			<TrialStartScreen
				onCreateProject={() => setStep("signup")}
				onSkip={() => setStep("signup")}
			/>
		);
	}

	return <WelcomeScreen onGetStarted={() => setStep("trial")} />;
}

const meta: Meta<typeof OnboardingFlow> = {
	title: "Screens/Onboarding",
	component: OnboardingFlow,
	parameters: {
		layout: "fullscreen",
	},
};

export default meta;
type Story = StoryObj<typeof OnboardingFlow>;

export const Default: Story = {};

export const TrialStart: Story = {
	render: () => <TrialStartScreen onCreateProject={() => {}} onSkip={() => {}} />,
};

export const SignUp: Story = {
	render: () => <SignUpScreen onSignUp={() => {}} />,
};
