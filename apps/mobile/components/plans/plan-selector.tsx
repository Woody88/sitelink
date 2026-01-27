import {
	ChevronDown,
	ChevronRight,
	FileText,
	Folder,
	LayoutGrid,
	List,
	Loader2,
	Search,
	X,
} from "lucide-react-native";
import * as React from "react";
import {
	ActivityIndicator,
	Image,
	Pressable,
	ScrollView,
	View,
} from "react-native";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withTiming,
} from "react-native-reanimated";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { type Sheet, type SheetFolder, useSheets } from "@/hooks/use-sheets";
import { cn } from "@/lib/utils";

function ProcessingFolderIcon() {
	const rotation = useSharedValue(0);

	React.useEffect(() => {
		rotation.value = withRepeat(withTiming(360, { duration: 1000 }), -1, false);
	}, [rotation]);

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ rotate: `${rotation.value}deg` }],
	}));

	return (
		<Animated.View style={animatedStyle}>
			<Icon as={Loader2} className="text-primary size-5" />
		</Animated.View>
	);
}

function FolderStatusIcon({ folder }: { folder: SheetFolder }) {
	if (folder.status === "processing") {
		return <ProcessingFolderIcon />;
	}
	return <Icon as={Folder} className="text-muted-foreground size-5" />;
}

export interface Plan {
	id: string;
	code: string;
	title: string;
	thumbnail: string;
}

interface PlanSelectorProps {
	projectId: string;
	onSelect: (plan: Plan) => void;
	onClose?: () => void;
	showCloseButton?: boolean;
}

export function PlanSelector({
	projectId,
	onSelect,
	onClose,
	showCloseButton = false,
}: PlanSelectorProps) {
	const folders = useSheets(projectId);
	const [searchQuery, setSearchQuery] = React.useState("");
	const [viewMode, setViewMode] = React.useState<"grid" | "list">("list");
	const hasInitialized = React.useRef(false);
	const [expandedFolders, setExpandedFolders] = React.useState<string[]>([]);

	React.useEffect(() => {
		if (folders.length > 0 && !hasInitialized.current) {
			setExpandedFolders([folders[0].id]);
			hasInitialized.current = true;
		}
	}, [folders]);

	const toggleFolder = (folderId: string) => {
		setExpandedFolders((prev) =>
			prev.includes(folderId)
				? prev.filter((id) => id !== folderId)
				: [...prev, folderId],
		);
	};

	const sheetToPlan = (sheet: Sheet): Plan => ({
		id: sheet.id,
		code: sheet.number,
		title: sheet.title,
		thumbnail: sheet.imagePath,
	});

	const filteredFolders = folders
		.map((folder) => ({
			...folder,
			sheets: folder.sheets.filter(
				(sheet) =>
					sheet.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
					sheet.title.toLowerCase().includes(searchQuery.toLowerCase()),
			),
		}))
		.filter(
			(folder) =>
				folder.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				folder.sheets.length > 0,
		);

	const isLoading = !projectId;

	return (
		<View className="bg-background flex-1">
			{/* Header with Search and Close */}
			<View className="border-border/10 gap-4 border-b px-4 py-3">
				<View className="mb-1 flex-row items-center justify-between">
					<Text className="text-foreground text-xl font-bold">Select Plan</Text>
					{showCloseButton && onClose && (
						<Pressable
							onPress={onClose}
							className="active:bg-muted/20 rounded-full p-2"
						>
							<Icon as={X} className="text-foreground size-6" />
						</Pressable>
					)}
				</View>

				<View className="flex-row items-center gap-2">
					<View className="relative flex-1">
						<View className="absolute top-2.5 left-3 z-10">
							<Icon as={Search} className="text-muted-foreground size-4" />
						</View>
						<Input
							placeholder="Search plans"
							value={searchQuery}
							onChangeText={setSearchQuery}
							className="bg-muted/20 h-10 rounded-xl border-transparent pl-10"
						/>
					</View>

					<View className="bg-muted/20 flex-row rounded-xl p-1">
						<Pressable
							onPress={() => setViewMode("grid")}
							className={cn(
								"rounded-lg p-1.5",
								viewMode === "grid"
									? "bg-background shadow-sm"
									: "bg-transparent",
							)}
						>
							<Icon
								as={LayoutGrid}
								className={cn(
									"size-4",
									viewMode === "grid"
										? "text-foreground"
										: "text-muted-foreground",
								)}
							/>
						</Pressable>
						<Pressable
							onPress={() => setViewMode("list")}
							className={cn(
								"rounded-lg p-1.5",
								viewMode === "list"
									? "bg-background shadow-sm"
									: "bg-transparent",
							)}
						>
							<Icon
								as={List}
								className={cn(
									"size-4",
									viewMode === "list"
										? "text-foreground"
										: "text-muted-foreground",
								)}
							/>
						</Pressable>
					</View>
				</View>
			</View>

			<ScrollView className="flex-1" contentContainerClassName="px-4 py-4 pb-8">
				{isLoading && (
					<View className="flex-1 items-center justify-center py-20">
						<ActivityIndicator size="large" />
					</View>
				)}

				{!isLoading && folders.length === 0 && (
					<View className="flex-1 items-center justify-center py-20">
						<Icon
							as={FileText}
							className="text-muted-foreground mb-4 size-16"
						/>
						<Text className="text-foreground mb-2 text-lg font-semibold">
							No Plans Yet
						</Text>
						<Text className="text-muted-foreground px-8 text-center text-sm">
							Plans and sheets will appear here once they're uploaded to this
							project
						</Text>
					</View>
				)}

				{!isLoading &&
					filteredFolders.map((folder) => (
						<Collapsible
							key={folder.id}
							open={expandedFolders.includes(folder.id)}
							onOpenChange={() => toggleFolder(folder.id)}
							className="mb-4"
						>
							<CollapsibleTrigger asChild>
								<Pressable
									className={cn(
										"flex-row items-center justify-between rounded-xl px-4 py-3",
										folder.status === "processing"
											? "border-primary/30 bg-primary/5 border"
											: "bg-muted/10",
									)}
								>
									<View className="flex-1 flex-row items-center gap-3">
										<FolderStatusIcon folder={folder} />
										<View className="flex-1">
											<Text
												className="text-foreground text-base font-semibold"
												numberOfLines={1}
											>
												{folder.name}
											</Text>
											<Text className="text-muted-foreground text-xs">
												{folder.status === "processing"
													? `Processing... ${folder.processingProgress ?? 0}%`
													: `${folder.sheets.length} sheets`}
											</Text>
										</View>
									</View>
									<Icon
										as={
											expandedFolders.includes(folder.id)
												? ChevronDown
												: ChevronRight
										}
										className="text-muted-foreground size-5"
									/>
								</Pressable>
							</CollapsibleTrigger>

							<CollapsibleContent>
								<View className="pt-2">
									{viewMode === "grid" ? (
										<View className="flex-row flex-wrap gap-3">
											{folder.sheets.map((sheet) => {
												const plan = sheetToPlan(sheet);
												return (
													<Pressable
														key={sheet.id}
														className="mb-4 w-[48%] active:opacity-70"
														onPress={() => onSelect(plan)}
													>
														<View className="bg-muted/20 border-border/50 aspect-[3/2] overflow-hidden rounded-xl border">
															{sheet.imagePath ? (
																<Image
																	source={{ uri: sheet.imagePath }}
																	className="h-full w-full"
																	resizeMode="cover"
																/>
															) : (
																<View className="flex-1 items-center justify-center">
																	<Icon
																		as={FileText}
																		className="text-muted-foreground size-12"
																	/>
																</View>
															)}
														</View>
														<View className="mt-2 items-center">
															<Text
																className="text-foreground text-center text-sm font-bold"
																numberOfLines={1}
															>
																{sheet.number}
															</Text>
															<Text
																className="text-muted-foreground text-center text-[10px]"
																numberOfLines={1}
															>
																{sheet.title}
															</Text>
														</View>
													</Pressable>
												);
											})}
											{folder.status === "processing" &&
												folder.sheets.length === 0 &&
												Array.from({ length: 4 }).map((_, i) => (
													<View key={i} className="mb-4 w-[48%]">
														<Skeleton className="aspect-[3/2] rounded-xl" />
														<View className="mt-2 items-center gap-1">
															<Skeleton className="h-4 w-12" />
															<Skeleton className="h-3 w-20" />
														</View>
													</View>
												))}
										</View>
									) : (
										<View className="gap-1">
											{folder.sheets.map((sheet) => {
												const plan = sheetToPlan(sheet);
												return (
													<Pressable
														key={sheet.id}
														className="active:bg-muted/10 flex-row items-center gap-4 rounded-lg px-2 py-3"
														onPress={() => onSelect(plan)}
													>
														<View className="bg-muted/20 size-10 items-center justify-center rounded-lg">
															<Icon
																as={FileText}
																className="text-muted-foreground size-5"
															/>
														</View>
														<View className="flex-1">
															<Text className="text-foreground text-base font-bold">
																{sheet.number}
															</Text>
															<Text className="text-muted-foreground text-sm">
																{sheet.title}
															</Text>
														</View>
													</Pressable>
												);
											})}
											{folder.status === "processing" &&
												folder.sheets.length === 0 &&
												Array.from({ length: 3 }).map((_, i) => (
													<View
														key={i}
														className="flex-row items-center gap-4 px-2 py-3"
													>
														<Skeleton className="size-10 rounded-lg" />
														<View className="flex-1 gap-1">
															<Skeleton className="h-4 w-16" />
															<Skeleton className="h-3 w-32" />
														</View>
													</View>
												))}
										</View>
									)}
									{folder.sheets.length === 0 && folder.status !== "processing" && (
										<View className="items-center justify-center py-8">
											<Text className="text-muted-foreground text-sm italic">
												No plans in this folder
											</Text>
										</View>
									)}
								</View>
							</CollapsibleContent>
						</Collapsible>
					))}
			</ScrollView>
		</View>
	);
}
