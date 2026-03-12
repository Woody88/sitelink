import {
	AlertCircle,
	AlertTriangle,
	ArrowLeft,
	Bell,
	Box,
	Camera,
	CheckCircle,
	ChevronRight,
	Clock,
	Cloud,
	CreditCard,
	FileText,
	HardDrive,
	ImageIcon,
	Info,
	Map,
	Plus,
	Search,
	Smartphone,
	UserPlus,
	Users,
	X,
} from "lucide-react-native";
import * as React from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

export function StorySegmentedControl({
	options,
	selectedIndex,
	onIndexChange,
}: {
	options: string[];
	selectedIndex: number;
	onIndexChange: (index: number) => void;
}) {
	return (
		<View
			className="bg-muted/40 border-border/10 flex-row self-center rounded-full border p-1"
			style={{ height: 40 }}
		>
			{options.map((option, index) => {
				const isSelected = index === selectedIndex;
				return (
					<Pressable
						key={index}
						onPress={() => onIndexChange(index)}
						className={cn(
							"items-center justify-center rounded-full px-5",
							isSelected && "bg-foreground/10 border border-white/5",
						)}
						style={{ height: 32 }}
					>
						<Text
							className={cn(
								"text-sm",
								isSelected
									? "text-foreground font-semibold"
									: "text-muted-foreground font-medium",
							)}
							numberOfLines={1}
						>
							{option}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
}

export function StoryHeader({
	title,
	onBack,
	rightIcon,
	onRight,
	subtitle,
}: {
	title: string;
	onBack?: () => void;
	rightIcon?: React.ComponentType<any>;
	onRight?: () => void;
	subtitle?: string;
}) {
	return (
		<View className="bg-background" style={{ paddingTop: 8 }}>
			<View className="min-h-[56px] flex-row items-center justify-between px-4">
				{onBack ? (
					<Pressable
						onPress={onBack}
						className="-ml-1 items-center justify-center"
						style={{ width: 44, height: 44 }}
					>
						<Icon as={ArrowLeft} className="text-foreground size-6" />
					</Pressable>
				) : (
					<View style={{ width: 44 }} />
				)}
				<View className="flex-1 items-center justify-center px-2">
					<Text
						className="text-foreground text-center text-base leading-tight font-bold"
						numberOfLines={1}
					>
						{title}
					</Text>
					{subtitle && (
						<Text className="text-muted-foreground mt-0.5 text-center text-[11px] leading-snug">
							{subtitle}
						</Text>
					)}
				</View>
				{rightIcon && onRight ? (
					<Pressable
						onPress={onRight}
						className="-mr-1 items-center justify-center"
						style={{ width: 44, height: 44 }}
					>
						<Icon as={rightIcon} className="text-foreground size-5" />
					</Pressable>
				) : (
					<View style={{ width: 44 }} />
				)}
			</View>
		</View>
	);
}

export function StoryToast({
	message,
	visible,
	onDismiss,
}: {
	message: string;
	visible: boolean;
	onDismiss: () => void;
}) {
	React.useEffect(() => {
		if (visible) {
			const timer = setTimeout(onDismiss, 2000);
			return () => clearTimeout(timer);
		}
	}, [visible, onDismiss]);

	if (!visible) return null;

	return (
		<View
			style={{
				position: "absolute",
				bottom: 80,
				left: 16,
				right: 16,
				zIndex: 200,
			}}
		>
			<View
				className="items-center rounded-xl px-5 py-3"
				style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
			>
				<Text className="text-center text-sm font-medium text-white">
					{message}
				</Text>
			</View>
		</View>
	);
}

export function CreateProjectOverlay({
	onClose,
	onCreated,
}: {
	onClose: () => void;
	onCreated?: (data: { name: string; address?: string }) => void;
}) {
	const [name, setName] = React.useState("");
	const [address, setAddress] = React.useState("");

	const handleSubmit = () => {
		if (!name.trim()) return;
		const data = { name, address: address || undefined };
		setName("");
		setAddress("");
		if (onCreated) {
			onCreated(data);
		} else {
			onClose();
		}
	};

	return (
		<View
			style={{
				position: "absolute",
				top: 0,
				bottom: 0,
				left: 0,
				right: 0,
				zIndex: 100,
			}}
		>
			<Pressable
				onPress={onClose}
				style={{
					position: "absolute",
					top: 0,
					bottom: 0,
					left: 0,
					right: 0,
					backgroundColor: "rgba(0,0,0,0.5)",
				}}
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
				<View className="flex-row items-center justify-between px-6 pb-3">
					<Text className="text-foreground text-lg font-bold">New Project</Text>
					<Pressable
						onPress={onClose}
						className="bg-muted/20 active:bg-muted/40 size-8 items-center justify-center rounded-full"
					>
						<Icon as={X} className="text-foreground size-5" />
					</Pressable>
				</View>
				<View className="gap-6 px-6 pb-8">
					<View className="gap-2">
						<Label nativeID="storyProjectName">Project Name</Label>
						<Input
							nativeID="storyProjectName"
							className="h-12 rounded-xl"
							placeholder="e.g. Riverside Apartments"
							value={name}
							onChangeText={setName}
						/>
					</View>
					<View className="gap-2">
						<Label nativeID="storyAddress">Address (Optional)</Label>
						<Input
							nativeID="storyAddress"
							className="h-12 rounded-xl"
							placeholder="e.g. 123 Main St, Denver, CO"
							value={address}
							onChangeText={setAddress}
						/>
					</View>
					<Button
						onPress={handleSubmit}
						disabled={!name.trim()}
						className="h-12 w-full rounded-xl"
					>
						<Text className="text-primary-foreground text-base font-semibold">
							Create Project
						</Text>
					</Button>
				</View>
			</View>
		</View>
	);
}

export function UploadPlanOverlay({
	onClose,
	onDeviceStorage,
}: {
	onClose: () => void;
	onDeviceStorage?: () => void;
}) {
	return (
		<View
			style={{
				position: "absolute",
				top: 0,
				bottom: 0,
				left: 0,
				right: 0,
				zIndex: 100,
			}}
		>
			<Pressable
				onPress={onClose}
				style={{
					position: "absolute",
					top: 0,
					bottom: 0,
					left: 0,
					right: 0,
					backgroundColor: "rgba(0,0,0,0.5)",
				}}
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
				<View className="flex-row items-center justify-between px-6 pb-3">
					<Text className="text-foreground text-lg font-bold">Upload Plan</Text>
					<Pressable
						onPress={onClose}
						className="bg-muted/20 active:bg-muted/40 size-8 items-center justify-center rounded-full"
					>
						<Icon as={X} className="text-foreground size-5" />
					</Pressable>
				</View>
				<View className="gap-4 px-6">
					<Text className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">
						Select Source
					</Text>
					<Pressable
						onPress={onDeviceStorage}
						className="bg-muted/10 active:bg-muted/20 flex-row items-center gap-4 rounded-2xl p-4"
					>
						<View className="bg-primary/10 size-12 items-center justify-center rounded-full">
							<Icon as={Smartphone} className="text-primary size-6" />
						</View>
						<View className="flex-1">
							<Text className="text-foreground text-base font-bold">
								Device Storage
							</Text>
							<Text className="text-muted-foreground text-sm">
								Upload PDF or images from your phone
							</Text>
						</View>
					</Pressable>
					<View className="bg-muted/5 flex-row items-center gap-4 rounded-2xl p-4 opacity-60">
						<View className="bg-muted/20 size-12 items-center justify-center rounded-full">
							<Icon as={Cloud} className="text-muted-foreground size-6" />
						</View>
						<View className="flex-1">
							<View className="flex-row items-center gap-2">
								<Text className="text-muted-foreground text-base font-bold">
									Google Drive
								</Text>
								<Badge
									variant="secondary"
									className="bg-primary/10 border-transparent"
								>
									<Text className="text-primary text-[10px] font-bold">
										COMING SOON
									</Text>
								</Badge>
							</View>
							<Text className="text-muted-foreground/60 text-sm">
								Import directly from your drive
							</Text>
						</View>
					</View>
					<View className="bg-muted/5 flex-row items-center gap-4 rounded-2xl p-4 opacity-60">
						<View className="bg-muted/20 size-12 items-center justify-center rounded-full">
							<Icon as={Box} className="text-muted-foreground size-6" />
						</View>
						<View className="flex-1">
							<View className="flex-row items-center gap-2">
								<Text className="text-muted-foreground text-base font-bold">
									Dropbox
								</Text>
								<Badge
									variant="secondary"
									className="bg-primary/10 border-transparent"
								>
									<Text className="text-primary text-[10px] font-bold">
										COMING SOON
									</Text>
								</Badge>
							</View>
							<Text className="text-muted-foreground/60 text-sm">
								Import from your Dropbox folders
							</Text>
						</View>
					</View>
				</View>
				<View className="items-center px-6 pt-6 pb-8">
					<Text className="text-muted-foreground text-center text-xs leading-relaxed">
						Supported formats: PDF, JPEG, PNG.{"\n"}Recommended resolution: 300
						DPI.
					</Text>
				</View>
			</View>
		</View>
	);
}

export function NotificationsScreen({ onBack }: { onBack?: () => void }) {
	const [readIds, setReadIds] = React.useState<Set<string>>(
		new Set(["3", "4"]),
	);

	const notifications = [
		{
			id: "1",
			title: "Plan Processing Complete",
			body: "Riverside Apartments plans are ready to view.",
			time: "2h ago",
			type: "success" as const,
		},
		{
			id: "2",
			title: "New Issue Flagged",
			body: "Mike flagged an issue at 5/A7.",
			time: "5h ago",
			type: "alert" as const,
		},
		{
			id: "3",
			title: "Trial Ending Soon",
			body: "Your Pro trial ends in 3 days.",
			time: "2 days ago",
			type: "info" as const,
		},
		{
			id: "4",
			title: "Sheet Updated",
			body: "Floor 2 Electrical has been updated.",
			time: "3 days ago",
			type: "info" as const,
		},
	];

	const getIcon = (type: string) => {
		switch (type) {
			case "success":
				return CheckCircle;
			case "alert":
				return AlertTriangle;
			default:
				return Info;
		}
	};

	const getColor = (type: string) => {
		switch (type) {
			case "success":
				return "text-green-500";
			case "alert":
				return "text-amber-500";
			default:
				return "text-blue-500";
		}
	};

	const hasUnread = notifications.some((n) => !readIds.has(n.id));

	return (
		<View
			className="bg-background"
			style={{ minHeight: "100vh" } as any}
		>
			<StoryHeader
				title="Notifications"
				onBack={onBack}
			/>
			<ScrollView className="flex-1">
				<View className="flex-row items-center justify-between px-4 py-4">
					<Text className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
						This Week
					</Text>
					{hasUnread && (
						<Pressable
							onPress={() =>
								setReadIds(new Set(notifications.map((n) => n.id)))
							}
						>
							<Text className="text-primary text-xs font-semibold">
								Mark All Read
							</Text>
						</Pressable>
					)}
				</View>
				{notifications.map((item) => {
					const isRead = readIds.has(item.id);
					return (
						<Pressable
							key={item.id}
							onPress={() =>
								setReadIds((prev) => new Set([...prev, item.id]))
							}
							className="active:bg-muted/30 flex-row gap-4 px-4 py-4"
						>
							{!isRead && (
								<View
									className="absolute top-0 bottom-0 left-0"
									style={{
										width: 3,
										backgroundColor: "#3b82f6",
										borderTopRightRadius: 2,
										borderBottomRightRadius: 2,
									}}
								/>
							)}
							<View className="bg-muted/20 size-8 items-center justify-center rounded-full">
								<Icon
									as={getIcon(item.type)}
									className={cn("size-4", getColor(item.type))}
								/>
							</View>
							<View className="flex-1 gap-0.5">
								<View className="flex-row items-start justify-between">
									<Text
										className={cn(
											"flex-1 pr-2 text-base leading-tight",
											isRead ? "font-medium" : "font-bold",
										)}
									>
										{item.title}
									</Text>
									<Text className="text-muted-foreground mt-0.5 text-xs">
										{item.time}
									</Text>
								</View>
								<Text
									className={cn(
										"text-sm leading-snug",
										isRead
											? "text-muted-foreground/60"
											: "text-muted-foreground",
									)}
								>
									{item.body}
								</Text>
							</View>
						</Pressable>
					);
				})}
			</ScrollView>
		</View>
	);
}

export function ProfileScreen({
	onBack,
	onNavigate,
}: {
	onBack?: () => void;
	onNavigate?: (screen: string) => void;
}) {
	const [saved, setSaved] = React.useState(false);

	const handleSave = () => {
		setSaved(true);
		setTimeout(() => setSaved(false), 2000);
	};

	return (
		<View
			className="bg-background"
			style={{ minHeight: "100vh" } as any}
		>
			<StoryHeader title="Profile" onBack={onBack} />
			<ScrollView
				className="flex-1"
				contentContainerClassName="px-6 pb-12"
				showsVerticalScrollIndicator={false}
			>
				<View className="items-center pt-4 pb-8">
					<View className="relative">
						<View className="bg-primary/10 border-background size-24 items-center justify-center rounded-full border-4">
							<Text className="text-primary text-3xl font-bold">JS</Text>
						</View>
						<View className="bg-secondary border-background absolute right-0 bottom-0 rounded-full border-4 p-2">
							<Icon as={Camera} className="text-secondary-foreground size-4" />
						</View>
					</View>
				</View>
				<View className="gap-6">
					<View className="gap-2">
						<Label nativeID="storyFullName">Full Name</Label>
						<Input
							nativeID="storyFullName"
							className="h-12 rounded-xl"
							defaultValue="John Smith"
						/>
					</View>
					<View className="gap-2">
						<Label nativeID="storyEmail">Email</Label>
						<Input
							nativeID="storyEmail"
							className="h-12 rounded-xl opacity-50"
							defaultValue="john@sitelink.com"
							editable={false}
						/>
						<Text className="text-muted-foreground px-1 text-xs">
							Email cannot be changed.
						</Text>
					</View>
					<View className="gap-2">
						<Label nativeID="storyPhone">Phone Number</Label>
						<Input
							nativeID="storyPhone"
							className="h-12 rounded-xl"
							defaultValue="(555) 123-4567"
						/>
					</View>
					<View className="gap-2">
						<Label nativeID="storyCompany">Company</Label>
						<Input
							nativeID="storyCompany"
							className="h-12 rounded-xl"
							defaultValue="Smith Electrical LLC"
						/>
					</View>

					<Separator />

					<Pressable
						onPress={() => onNavigate?.("subscription")}
						className="active:bg-muted/30 flex-row items-center justify-between py-2"
					>
						<View className="flex-row items-center gap-3">
							<View className="bg-muted size-10 items-center justify-center rounded-full">
								<Icon as={CreditCard} className="text-foreground size-5" />
							</View>
							<View>
								<Text className="text-foreground text-base font-medium">
									Subscription
								</Text>
								<Text className="text-muted-foreground text-sm">
									Pro Trial · 12 days left
								</Text>
							</View>
						</View>
						<Icon as={ChevronRight} className="text-muted-foreground size-5" />
					</Pressable>

					<View className="mt-2">
						<Button className="h-12 rounded-xl" onPress={handleSave}>
							<Text className="text-primary-foreground text-base font-semibold">
								{saved ? "Saved!" : "Save Changes"}
							</Text>
						</Button>
					</View>
				</View>
			</ScrollView>
		</View>
	);
}

export function ProjectSettingsScreen({
	onBack,
	onNavigateToMembers,
}: {
	onBack?: () => void;
	onNavigateToMembers?: () => void;
}) {
	const [notifyPlans, setNotifyPlans] = React.useState(true);
	const [notifyMedia, setNotifyMedia] = React.useState(true);
	const [notifyComments, setNotifyComments] = React.useState(true);

	return (
		<View
			className="bg-background"
			style={{ minHeight: "100vh" } as any}
		>
			<StoryHeader title="Project Settings" onBack={onBack} />
			<ScrollView
				className="flex-1"
				contentContainerClassName="pb-12"
				showsVerticalScrollIndicator={false}
			>
				{/* Details */}
				<View className="px-4 pt-6">
					<Text className="text-muted-foreground mb-3 text-sm font-semibold tracking-wider uppercase">
						Details
					</Text>
					<View className="bg-card border-border/50 overflow-hidden rounded-2xl border">
						<View className="flex-row items-center justify-between px-4 py-4">
							<View className="flex-row items-center gap-3">
								<View className="bg-muted size-8 items-center justify-center rounded-full">
									<Icon as={FileText} className="text-foreground size-4" />
								</View>
								<View>
									<Text className="text-muted-foreground text-xs">
										Project Name
									</Text>
									<Text className="text-foreground text-base font-medium">
										Holabird Ave Warehouse
									</Text>
								</View>
							</View>
						</View>
						<Separator />
						<View className="flex-row items-center justify-between px-4 py-4">
							<View className="flex-row items-center gap-3">
								<View className="bg-muted size-8 items-center justify-center rounded-full">
									<Icon as={FileText} className="text-foreground size-4" />
								</View>
								<View>
									<Text className="text-muted-foreground text-xs">Address</Text>
									<Text className="text-foreground text-base font-medium">
										4200 Holabird Ave, Baltimore, MD
									</Text>
								</View>
							</View>
						</View>
					</View>
				</View>

				{/* Storage */}
				<View className="px-4 pt-6">
					<Text className="text-muted-foreground mb-3 text-sm font-semibold tracking-wider uppercase">
						Storage
					</Text>
					<View className="bg-card border-border/50 overflow-hidden rounded-2xl border">
						<View className="flex-row items-center justify-between px-4 py-4">
							<View className="flex-row items-center gap-3">
								<View className="bg-muted size-8 items-center justify-center rounded-full">
									<Icon as={HardDrive} className="text-foreground size-4" />
								</View>
								<Text className="text-foreground text-base font-medium">
									Total Storage
								</Text>
							</View>
							<Text className="text-muted-foreground text-sm">245.3 MB</Text>
						</View>
						<Separator />
						<View className="flex-row items-center justify-between px-4 py-4">
							<View className="flex-row items-center gap-3">
								<View className="bg-muted size-8 items-center justify-center rounded-full">
									<Icon as={FileText} className="text-foreground size-4" />
								</View>
								<Text className="text-foreground text-base font-medium">
									Plans
								</Text>
							</View>
							<Text className="text-muted-foreground text-sm">
								180.2 MB - 12 files
							</Text>
						</View>
						<Separator />
						<View className="flex-row items-center justify-between px-4 py-4">
							<View className="flex-row items-center gap-3">
								<View className="bg-muted size-8 items-center justify-center rounded-full">
									<Icon as={Camera} className="text-foreground size-4" />
								</View>
								<Text className="text-foreground text-base font-medium">
									Media
								</Text>
							</View>
							<Text className="text-muted-foreground text-sm">
								65.1 MB - 48 files
							</Text>
						</View>
					</View>
				</View>

				{/* Notifications */}
				<View className="px-4 pt-6">
					<Text className="text-muted-foreground mb-3 text-sm font-semibold tracking-wider uppercase">
						Notifications
					</Text>
					<View className="bg-card border-border/50 overflow-hidden rounded-2xl border">
						<View className="flex-row items-center justify-between px-4 py-4">
							<View className="flex-row items-center gap-3">
								<View className="bg-muted size-8 items-center justify-center rounded-full">
									<Icon as={FileText} className="text-foreground size-4" />
								</View>
								<Text className="text-foreground text-base font-medium">
									New Plans
								</Text>
							</View>
							<Switch checked={notifyPlans} onCheckedChange={setNotifyPlans} />
						</View>
						<Separator />
						<View className="flex-row items-center justify-between px-4 py-4">
							<View className="flex-row items-center gap-3">
								<View className="bg-muted size-8 items-center justify-center rounded-full">
									<Icon as={Camera} className="text-foreground size-4" />
								</View>
								<Text className="text-foreground text-base font-medium">
									New Media
								</Text>
							</View>
							<Switch checked={notifyMedia} onCheckedChange={setNotifyMedia} />
						</View>
						<Separator />
						<View className="flex-row items-center justify-between px-4 py-4">
							<View className="flex-row items-center gap-3">
								<View className="bg-muted size-8 items-center justify-center rounded-full">
									<Icon as={Bell} className="text-foreground size-4" />
								</View>
								<Text className="text-foreground text-base font-medium">
									Comments
								</Text>
							</View>
							<Switch
								checked={notifyComments}
								onCheckedChange={setNotifyComments}
							/>
						</View>
					</View>
				</View>

				{/* Team */}
				<View className="px-4 pt-6">
					<Text className="text-muted-foreground mb-3 text-sm font-semibold tracking-wider uppercase">
						Team
					</Text>
					<View className="bg-card border-border/50 overflow-hidden rounded-2xl border">
						<Pressable
							onPress={onNavigateToMembers}
							className="active:bg-muted/30 flex-row items-center justify-between px-4 py-4"
						>
							<View className="flex-row items-center gap-3">
								<View className="bg-muted size-8 items-center justify-center rounded-full">
									<Icon as={Users} className="text-foreground size-4" />
								</View>
								<Text className="text-foreground text-base font-medium">
									Team Members
								</Text>
							</View>
							<Icon as={ChevronRight} className="text-muted-foreground size-5" />
						</Pressable>
					</View>
				</View>
			</ScrollView>
		</View>
	);
}

const STORY_MEMBERS = [
	{ id: "1", name: "John Smith", email: "john@sitelink.com", role: "Owner" },
	{
		id: "2",
		name: "Mike Chen",
		email: "mike@sitelink.com",
		role: "Admin",
	},
	{
		id: "3",
		name: "Sarah Johnson",
		email: "sarah@sitelink.com",
		role: "Member",
	},
	{
		id: "4",
		name: "David Lee",
		email: "david@sitelink.com",
		role: "Member",
	},
	{
		id: "5",
		name: "Emily Brown",
		email: "emily@sitelink.com",
		role: "Viewer",
	},
];

export function MembersScreen({ onBack }: { onBack?: () => void }) {
	const [searchQuery, setSearchQuery] = React.useState("");
	const [showAddModal, setShowAddModal] = React.useState(false);
	const [newEmail, setNewEmail] = React.useState("");
	const [newRole, setNewRole] = React.useState<"Admin" | "Member" | "Viewer">(
		"Member",
	);

	const filteredMembers = React.useMemo(() => {
		if (!searchQuery) return STORY_MEMBERS;
		return STORY_MEMBERS.filter(
			(m) =>
				m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				m.email.toLowerCase().includes(searchQuery.toLowerCase()),
		);
	}, [searchQuery]);

	return (
		<View
			className="bg-background"
			style={{ minHeight: "100vh", position: "relative" } as any}
		>
			<View className="bg-background" style={{ paddingTop: 8 }}>
				<View className="min-h-[56px] flex-row items-center justify-between px-4">
					{onBack ? (
						<Pressable
							onPress={onBack}
							className="-ml-1 items-center justify-center"
							style={{ width: 44, height: 44 }}
						>
							<Icon as={ArrowLeft} className="text-foreground size-6" />
						</Pressable>
					) : (
						<View style={{ width: 44 }} />
					)}
					<Text className="text-foreground text-base font-bold">
						Project Members
					</Text>
					<Pressable
						onPress={() => setShowAddModal(true)}
						className="-mr-1 items-center justify-center"
						style={{ width: 44, height: 44 }}
					>
						<Icon as={Plus} className="text-primary size-6" />
					</Pressable>
				</View>
			</View>

			<View className="border-border border-b px-4 py-2">
				<View className="bg-muted/40 flex-row items-center rounded-xl px-3" style={{ height: 40 }}>
					<Icon as={Search} className="text-muted-foreground mr-2 size-4" />
					<Input
						placeholder="Search members..."
						value={searchQuery}
						onChangeText={setSearchQuery}
						className="h-10 flex-1 border-transparent bg-transparent"
					/>
				</View>
			</View>

			<ScrollView className="flex-1" contentContainerClassName="p-4 gap-3">
				{filteredMembers.map((member) => (
					<View
						key={member.id}
						className="bg-card border-border/50 flex-row items-center justify-between rounded-2xl border p-4"
					>
						<View className="flex-row items-center gap-3">
							<View className="bg-secondary size-10 items-center justify-center rounded-full">
								<Text className="text-secondary-foreground font-semibold">
									{member.name
										.split(" ")
										.map((n) => n[0])
										.join("")}
								</Text>
							</View>
							<View>
								<Text className="text-foreground font-medium">
									{member.name}
								</Text>
								<Text className="text-muted-foreground text-sm">
									{member.email}
								</Text>
							</View>
						</View>
						<Badge variant={member.role === "Owner" ? "default" : "outline"}>
							<Text
								className={
									member.role === "Owner"
										? "text-primary-foreground"
										: "text-foreground"
								}
							>
								{member.role}
							</Text>
						</Badge>
					</View>
				))}
			</ScrollView>

			{showAddModal && (
				<View
					style={{
						position: "absolute",
						top: 0,
						bottom: 0,
						left: 0,
						right: 0,
						zIndex: 100,
					}}
				>
					<Pressable
						onPress={() => setShowAddModal(false)}
						style={{
							position: "absolute",
							top: 0,
							bottom: 0,
							left: 0,
							right: 0,
							backgroundColor: "rgba(0,0,0,0.5)",
						}}
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
						<View className="flex-row items-center justify-between px-6 pb-3">
							<Text className="text-foreground text-lg font-bold">
								Add Team Member
							</Text>
							<Pressable
								onPress={() => setShowAddModal(false)}
								className="bg-muted/20 active:bg-muted/40 size-8 items-center justify-center rounded-full"
							>
								<Icon as={X} className="text-foreground size-5" />
							</Pressable>
						</View>
						<View className="gap-6 px-6 pb-8">
							<View className="gap-2">
								<Text className="text-foreground text-sm font-medium">
									Email Address
								</Text>
								<Input
									placeholder="member@example.com"
									value={newEmail}
									onChangeText={setNewEmail}
									className="h-12 rounded-xl"
								/>
							</View>
							<View className="gap-2">
								<Text className="text-foreground text-sm font-medium">Role</Text>
								<View className="flex-row gap-2">
									{(["Admin", "Member", "Viewer"] as const).map((role) => (
										<Pressable
											key={role}
											onPress={() => setNewRole(role)}
											className={cn(
												"flex-1 rounded-xl border-2 px-4 py-3",
												newRole === role
													? "bg-primary border-primary"
													: "bg-muted/10 border-border",
											)}
										>
											<Text
												className={cn(
													"text-center font-medium",
													newRole === role
														? "text-primary-foreground"
														: "text-foreground",
												)}
											>
												{role}
											</Text>
										</Pressable>
									))}
								</View>
							</View>
							<Button
								onPress={() => {
									setNewEmail("");
									setNewRole("Member");
									setShowAddModal(false);
								}}
								className="h-12 rounded-xl"
							>
								<Icon
									as={UserPlus}
									className="text-primary-foreground mr-2 size-5"
								/>
								<Text className="text-primary-foreground text-base font-semibold">
									Add Member
								</Text>
							</Button>
						</View>
					</View>
				</View>
			)}
		</View>
	);
}

type ProcessingStage =
	| "waiting"
	| "images"
	| "metadata"
	| "callouts"
	| "tiles"
	| "completed";

const PROCESSING_STAGES: {
	key: ProcessingStage;
	label: string;
	icon: typeof Clock;
	color: string;
}[] = [
	{ key: "waiting", label: "Waiting for connection", icon: Clock, color: "#3b82f6" },
	{ key: "images", label: "Generating images", icon: ImageIcon, color: "#3b82f6" },
	{ key: "metadata", label: "Extracting metadata", icon: FileText, color: "#a855f7" },
	{ key: "callouts", label: "Detecting callouts", icon: AlertCircle, color: "#f59e0b" },
	{ key: "tiles", label: "Creating tiles", icon: Map, color: "#22c55e" },
	{ key: "completed", label: "Ready", icon: CheckCircle, color: "#22c55e" },
];

export function useProcessingState() {
	const [stageIndex, setStageIndex] = React.useState(-1);
	const isProcessing = stageIndex >= 0;
	const isCompleted =
		isProcessing && PROCESSING_STAGES[stageIndex]?.key === "completed";

	React.useEffect(() => {
		if (!isProcessing || isCompleted) return;
		const timer = setInterval(() => {
			setStageIndex((prev) => {
				if (prev >= PROCESSING_STAGES.length - 1) return prev;
				return prev + 1;
			});
		}, 2000);
		return () => clearInterval(timer);
	}, [isProcessing, isCompleted]);

	return {
		stageIndex,
		start: () => setStageIndex(0),
		reset: () => setStageIndex(-1),
		isProcessing,
		isCompleted,
		currentStage: isProcessing ? PROCESSING_STAGES[stageIndex] : null,
	};
}

export function ProcessingBanner({
	stageIndex,
	onPress,
}: {
	stageIndex: number;
	onPress: () => void;
}) {
	const stage = PROCESSING_STAGES[stageIndex];
	if (!stage) return null;
	const isCompleted = stage.key === "completed";

	return (
		<Pressable
			onPress={onPress}
			className="mx-4 mb-3 flex-row items-center gap-3 rounded-xl px-4 py-3 active:opacity-80"
			style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
		>
			<View
				className="items-center justify-center rounded-full"
				style={{
					width: 28,
					height: 28,
					backgroundColor: stage.color + "20",
				}}
			>
				<Icon
					as={stage.icon}
					style={{ color: stage.color }}
					className="size-4"
				/>
			</View>
			<View className="flex-1">
				<Text className="text-foreground text-sm font-semibold">
					{isCompleted ? "Plan Ready" : "Processing Plan..."}
				</Text>
				<Text className="text-muted-foreground text-xs">
					{stage.label}
				</Text>
			</View>
			<Icon as={ChevronRight} className="text-muted-foreground size-4" />
		</Pressable>
	);
}

export function ProcessingOverlay({
	onClose,
	stageIndex: externalStageIndex,
}: {
	onClose: () => void;
	stageIndex?: number;
}) {
	const [internalStageIndex, setInternalStageIndex] = React.useState(0);
	const stageIndex =
		externalStageIndex !== undefined ? externalStageIndex : internalStageIndex;

	React.useEffect(() => {
		if (externalStageIndex !== undefined) return;
		const timer = setInterval(() => {
			setInternalStageIndex((prev) => {
				if (prev >= PROCESSING_STAGES.length - 1) return prev;
				return prev + 1;
			});
		}, 2000);
		return () => clearInterval(timer);
	}, [externalStageIndex]);

	const currentStage = PROCESSING_STAGES[stageIndex];
	const isCompleted = currentStage.key === "completed";

	return (
		<View
			style={{
				position: "absolute",
				top: 0,
				bottom: 0,
				left: 0,
				right: 0,
				zIndex: 100,
				backgroundColor: "#111111",
			}}
		>
			<View className="flex-row items-center justify-between px-6 py-4">
				<Text className="text-foreground text-lg font-bold">
					Processing Plan
				</Text>
				<Pressable
					onPress={onClose}
					className="bg-muted/20 active:bg-muted/40 size-8 items-center justify-center rounded-full"
				>
					<Icon as={X} className="text-foreground size-5" />
				</Pressable>
			</View>

			<View className="flex-1 items-center justify-center px-6">
				<View className="mb-8 items-center">
					<View
						className="mb-4 items-center justify-center rounded-full"
						style={{
							width: 80,
							height: 80,
							backgroundColor: currentStage.color + "20",
						}}
					>
						<Icon
							as={currentStage.icon}
							style={{ color: currentStage.color }}
							className="size-10"
						/>
					</View>
					<Text className="text-foreground text-2xl font-bold">
						{currentStage.label}
					</Text>
					{isCompleted && (
						<Text className="text-muted-foreground mt-2 text-center">
							Your plan is ready to view
						</Text>
					)}
				</View>

				<View className="w-full gap-3">
					{PROCESSING_STAGES.map((stage, idx) => {
						const status =
							isCompleted
								? "completed"
								: idx < stageIndex
									? "completed"
									: idx === stageIndex
										? "active"
										: "pending";

						return (
							<View
								key={stage.key}
								className={cn(
									"flex-row items-center gap-3 rounded-lg px-4 py-3",
									status === "active" && "bg-muted/20",
									status === "completed" && "opacity-60",
								)}
							>
								<Icon
									as={status === "completed" ? CheckCircle : stage.icon}
									style={{
										color:
											status === "completed"
												? "#22c55e"
												: status === "active"
													? stage.color
													: undefined,
									}}
									className={cn(
										"size-5",
										status === "pending" && "text-muted-foreground",
									)}
								/>
								<Text
									className={cn(
										"flex-1 text-sm font-medium",
										status === "active" && "text-foreground",
										status !== "active" && "text-muted-foreground",
									)}
								>
									{stage.label}
								</Text>
							</View>
						);
					})}
				</View>
			</View>

			<View className="items-center px-6 pb-8">
				<Text className="text-muted-foreground text-center text-xs leading-relaxed">
					This process may take a few minutes depending on the size of your
					plan
				</Text>
			</View>
		</View>
	);
}
