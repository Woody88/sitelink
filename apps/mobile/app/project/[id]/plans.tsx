import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import {
	ChevronDown,
	ChevronRight,
	FileText,
	Folder,
	LayoutGrid,
	List,
	Maximize2,
	Search,
} from "lucide-react-native";
import * as React from "react";
import {
	ActivityIndicator,
	Image,
	Modal,
	Pressable,
	ScrollView,
	View,
} from "react-native";
import { PlanInfoView } from "@/components/plans/plan-info-view";
import { type Plan, PlanSelector } from "@/components/plans/plan-selector";
import { ScheduleDetailScreen } from "@/components/plans/schedule-detail-screen";
import { PlanViewer } from "@/components/plans/viewer";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Text } from "@/components/ui/text";
import type { LayoutRegion, ScheduleEntry } from "@/hooks/use-plan-info";
import { type Sheet, useSheets } from "@/hooks/use-sheets";
import { cn } from "@/lib/utils";

type PlansTab = "sheets" | "plan-info";

export default function PlansScreen() {
	const { id: projectId } = useLocalSearchParams<{ id: string }>();
	const folders = useSheets(projectId!);
	const [plansTab, setPlansTab] = React.useState<PlansTab>("sheets");
	const [searchQuery, setSearchQuery] = React.useState("");
	const [viewMode, setViewMode] = React.useState<"grid" | "list">("list");
	const hasInitialized = React.useRef(false);
	const [expandedFolders, setExpandedFolders] = React.useState<string[]>([]);
	const [isSelectorVisible, setIsSelectorVisible] = React.useState(false);
	const [selectedPlan, setSelectedPlan] = React.useState<Plan | null>(null);
	const [selectedSheet, setSelectedSheet] = React.useState<Sheet | null>(null);
	const [isViewerVisible, setIsViewerVisible] = React.useState(false);
	const [scheduleDetail, setScheduleDetail] = React.useState<{
		region: LayoutRegion;
		entries: ScheduleEntry[];
		sheetNumber: string;
	} | null>(null);

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

	const handleSelectPlan = (plan: Plan) => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		const allSheets = folders.flatMap((f) => f.sheets);
		const sheet = allSheets.find((s) => s.id === plan.id);
		if (sheet) {
			setSelectedPlan(plan);
			setSelectedSheet(sheet);
			setIsSelectorVisible(false);
			setIsViewerVisible(true);
		}
	};

	const handleOpenPlan = React.useCallback((plan: Plan, sheet: Sheet) => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		setSelectedPlan(plan);
		setSelectedSheet(sheet);
		setIsViewerVisible(true);
	}, []);

	const handleCloseViewer = React.useCallback(() => {
		setIsViewerVisible(false);
		setSelectedPlan(null);
		setSelectedSheet(null);
	}, []);

	const handleSheetChange = React.useCallback(
		(sheetRef: string) => {
			const allSheets = folders.flatMap((f) => f.sheets);
			const sheet = allSheets.find(
				(s) => s.id === sheetRef || s.number === sheetRef,
			);
			if (sheet) {
				setSelectedPlan(sheetToplan(sheet));
				setSelectedSheet(sheet);
			}
		},
		[folders],
	);

	const sheetToplan = (sheet: Sheet): Plan => ({
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
			{/* Plans sub-tab: Sheets / Plan Info */}
			<View className="items-center py-2">
				<SegmentedControl
					options={["Sheets", "Plan Info"]}
					selectedIndex={plansTab === "sheets" ? 0 : 1}
					onIndexChange={(index) =>
						setPlansTab(index === 0 ? "sheets" : "plan-info")
					}
				/>
			</View>

			{plansTab === "plan-info" ? (
				<PlanInfoView
					onRegionPress={(region, entries, sheetNumber) => {
						if (region.regionClass === "schedule" && entries) {
							Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
							setScheduleDetail({ region, entries, sheetNumber });
						}
					}}
				/>
			) : (
			<>
			{/* Search and Toggle Header */}
			<View className="gap-4 px-4 py-3">
				<View className="flex-row items-center gap-2">
					<View className="relative flex-1">
						<View className="absolute top-2.5 left-3 z-10">
							<Icon as={Search} className="text-muted-foreground size-4" />
						</View>
						<Input
							placeholder="Search plans"
							value={searchQuery}
							onChangeText={setSearchQuery}
							className="bg-muted/40 h-10 rounded-xl border-transparent pl-10"
						/>
						{/* Magnifying glass/QR scanner placeholder */}
						<Pressable
							className="active:bg-muted/20 absolute top-2.5 right-3 z-10 rounded p-0.5"
							onPress={() => setIsSelectorVisible(true)}
						>
							<Icon as={Maximize2} className="text-muted-foreground size-4" />
						</Pressable>
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

			<ScrollView className="flex-1" contentContainerClassName="px-4 pb-8">
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
								<Pressable className="bg-muted/10 flex-row items-center justify-between rounded-xl px-4 py-3">
									<View className="flex-1 flex-row items-center gap-3">
										<Icon
											as={Folder}
											className="text-muted-foreground size-5"
										/>
										<View className="flex-1">
											<Text
												className="text-foreground text-base font-semibold"
												numberOfLines={1}
											>
												{folder.name}
											</Text>
											<Text className="text-muted-foreground text-xs">
												{folder.sheets.length} plans
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
												const plan = sheetToplan(sheet);
												return (
													<Pressable
														key={sheet.id}
														className="mb-4 w-[48%] active:opacity-80"
														onPress={() => handleOpenPlan(plan, sheet)}
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
										</View>
									) : (
										<View className="gap-1">
											{folder.sheets.map((sheet) => {
												const plan = sheetToplan(sheet);
												return (
													<Pressable
														key={sheet.id}
														className="active:bg-muted/10 flex-row items-center gap-4 rounded-lg px-2 py-3"
														onPress={() => handleOpenPlan(plan, sheet)}
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
										</View>
									)}
									{folder.sheets.length === 0 && (
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
			</>
			)}

			{/* Plan Selector Modal */}
			<Modal
				visible={isSelectorVisible}
				animationType="slide"
				presentationStyle="pageSheet"
				onRequestClose={() => setIsSelectorVisible(false)}
			>
				<PlanSelector
					projectId={projectId!}
					onSelect={handleSelectPlan}
					onClose={() => setIsSelectorVisible(false)}
					showCloseButton
				/>
			</Modal>

			{/* Schedule Detail Modal */}
			<Modal
				visible={scheduleDetail != null}
				animationType="slide"
				presentationStyle="fullScreen"
				onRequestClose={() => setScheduleDetail(null)}
				statusBarTranslucent
			>
				{scheduleDetail && (
					<ScheduleDetailScreen
						region={scheduleDetail.region}
						entries={scheduleDetail.entries}
						sheetNumber={scheduleDetail.sheetNumber}
						onBack={() => setScheduleDetail(null)}
						onViewOnSheet={(sheetId) => {
							setScheduleDetail(null);
							const allSheets = folders.flatMap((f) => f.sheets);
							const sheet = allSheets.find((s) => s.id === sheetId);
							if (sheet) {
								setSelectedPlan(sheetToplan(sheet));
								setSelectedSheet(sheet);
								setIsViewerVisible(true);
							}
						}}
					/>
				)}
			</Modal>

			{/* Full-screen Plan Viewer */}
			<Modal
				visible={isViewerVisible}
				animationType="fade"
				presentationStyle="fullScreen"
				onRequestClose={handleCloseViewer}
				statusBarTranslucent
			>
				{selectedPlan && selectedSheet && (
					<PlanViewer
						sheetId={selectedSheet.id}
						projectId={projectId!}
						planId={selectedSheet.planId}
						planCode={selectedPlan.code}
						planTitle={selectedPlan.title}
						imageUrl={
							selectedSheet.imagePath || "https://picsum.photos/2000/1500"
						}
						imageWidth={selectedSheet.width}
						imageHeight={selectedSheet.height}
						onClose={handleCloseViewer}
						onSheetChange={handleSheetChange}
						processingStage={selectedSheet.processingStage}
						remotePmtilesPath={selectedSheet.remotePmtilesPath}
					/>
				)}
			</Modal>
		</View>
	);
}
