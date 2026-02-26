import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import {
	AlertTriangle,
	ChevronDown,
	ChevronRight,
	Clock,
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
import { type Plan, PlanSelector } from "@/components/plans/plan-selector";
import { LegendDetailScreen } from "@/components/plans/legend-detail-screen";
import { NotesDetailScreen } from "@/components/plans/notes-detail-screen";
import { PlanInfoView } from "@/components/plans/plan-info-view";
import { PlanSearchResults } from "@/components/plans/plan-search-results";
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
import {
	type LayoutRegion,
	type ScheduleEntry,
} from "@/hooks/use-plan-info";
import { useCalloutReview } from "@/hooks/use-callout-review";
import { usePendingUploads } from "@/hooks/use-pending-uploads";
import { usePlanSearch } from "@/hooks/use-plan-search";
import { type Sheet, useSheets } from "@/hooks/use-sheets";
import { cn } from "@/lib/utils";
import { PendingUploadsList } from "@/components/plans/pending-uploads-list";

// Discipline color palette — the app's core visual identity
const DISCIPLINE_COLORS: Record<string, string> = {
	ARCH: "#3B82F6",
	ELEC: "#F59E0B",
	STRC: "#8B5CF6",
	MECH: "#10B981",
	PLMB: "#06B6D4",
	CIVIL: "#64748B",
	LAND: "#22C55E",
	FIRE: "#EF4444",
};

function getDisciplineColor(discipline?: string | null): string {
	const key = discipline?.toUpperCase()?.slice(0, 5) ?? "";
	return DISCIPLINE_COLORS[key] ?? "#6B7280";
}

function getDisciplineLabel(discipline?: string | null): string {
	return discipline?.toUpperCase()?.slice(0, 4) ?? "???";
}

export default function PlansScreen() {
	const router = useRouter();
	const { id: projectId } = useLocalSearchParams<{ id: string }>();
	const folders = useSheets(projectId!);
	const { pendingCount } = useCalloutReview(projectId!);
	const {
		pendingUploads,
		retryUpload,
		retryAll,
		dismissUpload,
		isRetrying,
	} = usePendingUploads(projectId!);
	const [searchQuery, setSearchQuery] = React.useState("");
	const [debouncedQuery, setDebouncedQuery] = React.useState("");
	const [recentSearches, setRecentSearches] = React.useState<string[]>([]);
	const [isSearchFocused, setIsSearchFocused] = React.useState(false);

	// Debounce search query by 300ms
	React.useEffect(() => {
		const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
		return () => clearTimeout(timer);
	}, [searchQuery]);

	// Load recent searches from storage on mount
	React.useEffect(() => {
		SecureStore.getItemAsync("recentPlanSearches").then((raw) => {
			if (raw) {
				try {
					setRecentSearches(JSON.parse(raw));
				} catch {}
			}
		});
	}, []);

	const saveRecentSearch = React.useCallback((query: string) => {
		const trimmed = query.trim();
		if (!trimmed || trimmed.length < 2) return;
		setRecentSearches((prev) => {
			const next = [trimmed, ...prev.filter((q) => q !== trimmed)].slice(0, 5);
			SecureStore.setItemAsync("recentPlanSearches", JSON.stringify(next));
			return next;
		});
	}, []);

	const searchResults = usePlanSearch(projectId!, debouncedQuery);
	const isSearchActive = debouncedQuery.trim().length >= 2;
	const showRecentSearches = isSearchFocused && searchQuery.trim().length === 0 && recentSearches.length > 0;
	const [viewMode, setViewMode] = React.useState<"grid" | "list">("list");
	const [plansTab, setPlansTab] = React.useState<"sheets" | "plan-info">("sheets");
	const [activeDiscipline, setActiveDiscipline] = React.useState<string | null>(null);
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
	const [notesDetail, setNotesDetail] = React.useState<{
		region: LayoutRegion;
		sheetNumber: string;
	} | null>(null);
	const [legendDetail, setLegendDetail] = React.useState<{
		region: LayoutRegion;
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

	const handleRegionPress = React.useCallback(
		(region: LayoutRegion, entries: ScheduleEntry[] | undefined, sheetNumber: string) => {
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
			if (region.regionClass === "schedule" && entries) {
				setScheduleDetail({ region, entries, sheetNumber });
			} else if (region.regionClass === "notes") {
				setNotesDetail({ region, sheetNumber });
			} else if (region.regionClass === "legend") {
				setLegendDetail({ region, sheetNumber });
			}
		},
		[],
	);

	const sheetToplan = (sheet: Sheet): Plan => ({
		id: sheet.id,
		code: sheet.number,
		title: sheet.title,
		thumbnail: sheet.imagePath,
	});

	// Collect unique disciplines for filter chips
	const allDisciplines = React.useMemo(() => {
		const seen = new Set<string>();
		for (const folder of folders) {
			for (const sheet of folder.sheets) {
				const key = sheet.discipline?.toUpperCase()?.slice(0, 5);
				if (key && DISCIPLINE_COLORS[key]) seen.add(key);
			}
		}
		return Array.from(seen).sort();
	}, [folders]);

	const filteredFolders = folders
		.map((folder) => ({
			...folder,
			sheets: folder.sheets.filter((sheet) => {
				const matchesSearch =
					sheet.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
					sheet.title.toLowerCase().includes(searchQuery.toLowerCase());
				const matchesDiscipline =
					!activeDiscipline ||
					sheet.discipline?.toUpperCase()?.slice(0, 5) === activeDiscipline;
				return matchesSearch && matchesDiscipline;
			}),
		}))
		.filter(
			(folder) =>
				folder.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				folder.sheets.length > 0,
		);

	const isLoading = !projectId;

	return (
		<View className="bg-background flex-1">
			{/* Review callouts banner */}
			{pendingCount > 0 && (
				<Pressable
					onPress={() =>
						router.push(`/project/${projectId}/review-callouts` as any)
					}
					className="active:opacity-80 mx-4 mt-3 flex-row items-center gap-3 overflow-hidden rounded-2xl bg-amber-500/10 px-4 py-3"
				>
					<Icon as={AlertTriangle} className="text-amber-600 size-5 flex-shrink-0" />
					<View className="flex-1">
						<Text className="text-amber-700 dark:text-amber-400 text-sm font-semibold">
							{pendingCount} callout{pendingCount !== 1 ? "s" : ""} need review
						</Text>
						<Text className="text-amber-600/80 dark:text-amber-500/80 text-xs">
							AI detected callouts with low confidence
						</Text>
					</View>
					<Icon as={ChevronRight} className="text-amber-600 size-4" />
				</Pressable>
			)}

			{/* Pending uploads */}
			{pendingUploads.length > 0 && (
				<View className="px-4 pt-3">
					<PendingUploadsList
						uploads={pendingUploads}
						onRetry={retryUpload}
						onRetryAll={retryAll}
						onDismiss={dismissUpload}
						isRetrying={isRetrying}
					/>
				</View>
			)}

			{/* Sheets / Plan Info tab toggle */}
			<View className="px-4 pt-3 pb-2 gap-3">
				<SegmentedControl
					options={["Sheets", "Plan Info"]}
					selectedIndex={plansTab === "sheets" ? 0 : 1}
					onIndexChange={(i) => {
						setPlansTab(i === 0 ? "sheets" : "plan-info");
						if (i === 0) { setSearchQuery(""); setDebouncedQuery(""); }
					}}
				/>

				{/* Search bar — only visible on Sheets tab */}
				{plansTab === "sheets" && (
					<View className="flex-row items-center gap-2">
						<View className="relative flex-1">
							<View className="absolute top-2.5 left-3 z-10">
								<Icon as={Search} className="text-muted-foreground size-4" />
							</View>
							<Input
								placeholder="Search plans"
								value={searchQuery}
								onChangeText={setSearchQuery}
								onFocus={() => setIsSearchFocused(true)}
								onBlur={() => setIsSearchFocused(false)}
								onSubmitEditing={() => saveRecentSearch(searchQuery)}
								returnKeyType="search"
								className="bg-muted/40 h-10 rounded-xl border-transparent pl-10"
							/>
							<Pressable
								className="active:bg-muted/20 absolute top-2.5 right-3 z-10 rounded p-0.5"
								onPress={() => setIsSelectorVisible(true)}
							>
								<Icon as={Maximize2} className="text-muted-foreground size-4" />
							</Pressable>
						</View>

						{!isSearchActive && (
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
						)}
					</View>
				)}

				{/* Discipline filter chips — only visible on Sheets tab with multiple disciplines */}
				{plansTab === "sheets" && allDisciplines.length > 1 && (
					<ScrollView
						horizontal
						showsHorizontalScrollIndicator={false}
						contentContainerStyle={{ gap: 8, flexDirection: "row" }}
					>
						{allDisciplines.map((disc) => {
							const color = DISCIPLINE_COLORS[disc] ?? "#6B7280";
							const isActive = activeDiscipline === disc;
							return (
								<Pressable
									key={disc}
									onPress={() => {
										Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
										setActiveDiscipline(isActive ? null : disc);
									}}
									style={{
										height: 36,
										flexDirection: "row",
										alignItems: "center",
										paddingHorizontal: 14,
										borderRadius: 18,
										backgroundColor: isActive ? color : color + "22",
										borderWidth: 1,
										borderColor: isActive ? color : color + "55",
									}}
								>
									<Text
										style={{
											fontSize: 11,
											fontWeight: "700",
											letterSpacing: 0.5,
											color: isActive ? "#fff" : color,
										}}
									>
										{disc}
									</Text>
								</Pressable>
							);
						})}
					</ScrollView>
				)}
			</View>

			{/* Content area */}
			{plansTab === "plan-info" ? (
				<PlanInfoView onRegionPress={handleRegionPress} />
			) : showRecentSearches ? (
				<ScrollView className="flex-1" contentContainerClassName="px-4 pb-8">
					<Text className="text-muted-foreground mb-2 mt-4 text-xs font-semibold uppercase tracking-wider">
						Recent Searches
					</Text>
					{recentSearches.map((q) => (
						<Pressable
							key={q}
							className="active:bg-muted/10 flex-row items-center gap-3 rounded-lg px-2 py-3"
							onPress={() => {
								setSearchQuery(q);
								setDebouncedQuery(q);
							}}
						>
							<Icon as={Clock} className="text-muted-foreground size-4" />
							<Text className="text-foreground flex-1 text-sm">{q}</Text>
						</Pressable>
					))}
				</ScrollView>
			) : isSearchActive ? (
				<PlanSearchResults
					results={searchResults}
					query={debouncedQuery}
					onSheetPress={(sheet) => {
						saveRecentSearch(searchQuery);
						handleOpenPlan(sheetToplan(sheet), sheet);
					}}
					onSchedulePress={(region, entries, sheetNumber) => {
						saveRecentSearch(searchQuery);
						setScheduleDetail({ region, entries, sheetNumber });
					}}
					onNotesPress={(region, sheetNumber) => {
						saveRecentSearch(searchQuery);
						setNotesDetail({ region, sheetNumber });
					}}
				/>
			) : (
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
								Plans and sheets will appear here once they&apos;re uploaded to
								this project
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
															<View className="mt-2 items-center gap-0.5">
																<Text
																	className="text-foreground text-center text-sm font-bold font-mono"
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
																<View
																	className="mt-0.5 rounded px-1.5 py-0.5"
																	style={{
																		backgroundColor:
																			getDisciplineColor(sheet.discipline) + "33",
																	}}
																>
																	<Text
																		className="text-[9px] font-bold"
																		style={{
																			color: getDisciplineColor(sheet.discipline),
																		}}
																	>
																		{getDisciplineLabel(sheet.discipline)}
																	</Text>
																</View>
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
															className="active:bg-muted/10 flex-row items-center gap-4 rounded-lg px-2 py-3.5"
															onPress={() => handleOpenPlan(plan, sheet)}
														>
															<View
																className="size-11 items-center justify-center rounded-lg"
																style={{
																	backgroundColor:
																		getDisciplineColor(sheet.discipline) + "33",
																}}
															>
																<Text
																	className="text-[11px] font-bold"
																	style={{
																		color: getDisciplineColor(sheet.discipline),
																	}}
																>
																	{getDisciplineLabel(sheet.discipline)}
																</Text>
															</View>
															<View className="flex-1">
																<Text className="text-foreground font-mono text-base font-bold">
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

			{/* Notes Detail Modal */}
			<Modal
				visible={notesDetail != null}
				animationType="slide"
				presentationStyle="fullScreen"
				onRequestClose={() => setNotesDetail(null)}
				statusBarTranslucent
			>
				{notesDetail && (
					<NotesDetailScreen
						region={notesDetail.region}
						sheetNumber={notesDetail.sheetNumber}
						onBack={() => setNotesDetail(null)}
						onViewOnSheet={(sheetId) => {
							setNotesDetail(null);
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

			{/* Legend Detail Modal */}
			<Modal
				visible={legendDetail != null}
				animationType="slide"
				presentationStyle="fullScreen"
				onRequestClose={() => setLegendDetail(null)}
				statusBarTranslucent
			>
				{legendDetail && (
					<LegendDetailScreen
						region={legendDetail.region}
						sheetNumber={legendDetail.sheetNumber}
						onBack={() => setLegendDetail(null)}
						onViewOnSheet={(sheetId) => {
							setLegendDetail(null);
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
