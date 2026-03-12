import type { Meta, StoryObj } from "@storybook/react";
import {
	ChevronRight,
	Clock,
	ExternalLink,
	FileText,
	MapPin,
	Search,
	StickyNote,
	TableProperties,
	X,
} from "lucide-react-native";
import * as React from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import { StoryHeader, StoryToast } from "@/app/_story-components";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";

type ResultType = "sheet" | "schedule" | "notes" | "callout";

interface SearchResult {
	id: string;
	type: ResultType;
	title: string;
	subtitle: string;
	snippet: string;
	matchTerm: string;
	sheetNumber: string;
}

const TYPE_CONFIG: Record<ResultType, { icon: typeof FileText; label: string; color: string; bg: string; iconClass: string }> = {
	sheet: { icon: FileText, label: "Sheet", color: "#6b7280", bg: "rgba(107,114,128,0.15)", iconClass: "text-gray-500 size-5" },
	schedule: { icon: TableProperties, label: "Schedule", color: "#2563eb", bg: "rgba(37,99,235,0.15)", iconClass: "text-blue-600 size-5" },
	notes: { icon: StickyNote, label: "Notes", color: "#9333ea", bg: "rgba(147,51,234,0.15)", iconClass: "text-purple-600 size-5" },
	callout: { icon: MapPin, label: "Callout", color: "#d97706", bg: "rgba(217,119,6,0.15)", iconClass: "text-amber-600 size-5" },
};

const MOCK_RESULTS: SearchResult[] = [
	{ id: "r1", type: "sheet", title: "S1.0 - Foundation Plan", subtitle: "Sheet S1.0", snippet: "4000 PSI concrete mix design per ACI 318", matchTerm: "concrete", sheetNumber: "S1.0" },
	{ id: "r2", type: "schedule", title: "Slab on Grade Schedule", subtitle: "Sheet S1.0 - 4 entries", snippet: 'SL1: 6" slab, 4000 PSI concrete, 6x6 WWF', matchTerm: "concrete", sheetNumber: "S1.0" },
	{ id: "r3", type: "schedule", title: "Footing Schedule", subtitle: "Sheet S0.0 - 3 entries", snippet: 'F1: 24"x12", 4000 PSI concrete', matchTerm: "concrete", sheetNumber: "S0.0" },
	{ id: "r4", type: "notes", title: "General Structural Notes", subtitle: "Sheet S0.0", snippet: "All concrete shall achieve minimum 28-day compressive strength", matchTerm: "concrete", sheetNumber: "S0.0" },
	{ id: "r5", type: "callout", title: "5/A7 - Electrical Junction", subtitle: "Sheet E2.0 - Grid D/4", snippet: "concrete pad required at base of junction box", matchTerm: "concrete", sheetNumber: "E2.0" },
];

const RECENT_SEARCHES = ["concrete strength", "rebar schedule", "electrical panel", "footing detail"];

function HighlightedSnippet({ text, term }: { text: string; term: string }) {
	if (!term) return <Text className="text-muted-foreground text-sm" numberOfLines={2}>...{text}...</Text>;
	const idx = text.toLowerCase().indexOf(term.toLowerCase());
	if (idx === -1) return <Text className="text-muted-foreground text-sm" numberOfLines={2}>...{text}...</Text>;
	return (
		<Text className="text-muted-foreground text-sm" numberOfLines={2}>
			...{text.slice(0, idx)}<Text className="text-foreground font-bold">{text.slice(idx, idx + term.length)}</Text>{text.slice(idx + term.length)}...
		</Text>
	);
}

function SheetHighlightView({ result, onBack }: { result: SearchResult; onBack: () => void }) {
	return (
		<View style={{ minHeight: "100vh", position: "relative", backgroundColor: "#0a0a0a" } as any}>
			<Image source={{ uri: "/plan-sample.png" }} style={{ width: "100%", height: "100%", position: "absolute" }} resizeMode="contain" />

			{/* Simulated highlight overlay */}
			<View style={{ position: "absolute", top: "40%", left: "15%", width: "35%", height: "15%", borderWidth: 3, borderColor: "#facc15", borderRadius: 8, backgroundColor: "rgba(250,204,21,0.1)", zIndex: 5 }}>
				<View style={{ position: "absolute", top: -28, left: 0, backgroundColor: "#facc15", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
					<Text style={{ color: "#000", fontSize: 12, fontWeight: "700" }}>Match found</Text>
				</View>
			</View>

			<View style={{ position: "absolute", top: 16, left: 16, zIndex: 20 }}>
				<Pressable onPress={onBack} className="items-center justify-center rounded-full" style={{ width: 44, height: 44, backgroundColor: "rgba(0,0,0,0.6)" }}>
					<Icon as={X} className="size-5 text-white" strokeWidth={2.5} />
				</Pressable>
			</View>

			<View style={{ position: "absolute", top: 16, left: 68, right: 68, zIndex: 25, alignItems: "center" }}>
				<View className="flex-row items-center gap-2 rounded-full px-4 py-2.5" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
					<Icon as={Search} className="size-4 text-white/70" />
					<Text className="text-sm font-semibold text-white">{result.title}</Text>
				</View>
			</View>

			<View style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 10, paddingHorizontal: 16, paddingBottom: 24 }}>
				<View className="rounded-xl px-4 py-3" style={{ backgroundColor: "rgba(28,28,28,0.95)" }}>
					<Text className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">Search match on {result.sheetNumber}</Text>
					<Text className="text-foreground mt-1 text-sm font-medium">{result.snippet}</Text>
				</View>
			</View>
		</View>
	);
}

type FlowState = "search" | "result-view";

function SearchFlow({ initialQuery = "" }: { initialQuery?: string }) {
	const [flowState, setFlowState] = React.useState<FlowState>("search");
	const [selectedResult, setSelectedResult] = React.useState<SearchResult | null>(null);
	const [query, setQuery] = React.useState(initialQuery);
	const [toastMsg, setToastMsg] = React.useState("");
	const [displayedResults, setDisplayedResults] = React.useState<SearchResult[]>(() => {
		if (!initialQuery) return [];
		return MOCK_RESULTS.filter((r) => r.matchTerm.toLowerCase().includes(initialQuery.toLowerCase()));
	});
	const [isSearching, setIsSearching] = React.useState(false);
	const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

	if (flowState === "result-view" && selectedResult) {
		return <SheetHighlightView result={selectedResult} onBack={() => setFlowState("search")} />;
	}

	const handleQueryChange = (text: string) => {
		setQuery(text);
		if (debounceRef.current) clearTimeout(debounceRef.current);
		if (!text.trim()) { setDisplayedResults([]); setIsSearching(false); return; }
		setIsSearching(true);
		debounceRef.current = setTimeout(() => {
			const lower = text.toLowerCase();
			setDisplayedResults(MOCK_RESULTS.filter((r) => r.title.toLowerCase().includes(lower) || r.snippet.toLowerCase().includes(lower) || r.matchTerm.toLowerCase().includes(lower)));
			setIsSearching(false);
		}, 300);
	};

	const handleResultPress = (item: SearchResult) => {
		setSelectedResult(item);
		setFlowState("result-view");
	};

	const showEmpty = !query.trim();
	const showNoResults = query.trim().length >= 2 && displayedResults.length === 0 && !isSearching;
	const showResults = displayedResults.length > 0 && !isSearching;

	return (
		<View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
			<StoryHeader title="Plan Search" />
			<View className="px-4 pt-1 pb-2">
				<Badge variant="secondary" className="bg-primary/10 self-start border-transparent">
					<Text className="text-primary text-[10px] font-bold">PRO FEATURE</Text>
				</Badge>
			</View>
			<View className="border-border/50 border-b px-4 py-2">
				<View className="bg-muted/40 flex-row items-center rounded-xl px-3" style={{ height: 44 }}>
					<Icon as={Search} className="text-muted-foreground mr-2 size-5" />
					<Input placeholder="Search plans, schedules, notes..." value={query} onChangeText={handleQueryChange} className="h-11 flex-1 border-transparent bg-transparent text-base" autoFocus />
					{query.length > 0 && (
						<Pressable onPress={() => { setQuery(""); setDisplayedResults([]); }} className="ml-1 items-center justify-center" style={{ width: 28, height: 28 }}>
							<Icon as={X} className="text-muted-foreground size-4" />
						</Pressable>
					)}
				</View>
			</View>

			<ScrollView className="flex-1" contentContainerClassName="pb-8" showsVerticalScrollIndicator={false}>
				{showEmpty && (
					<View className="px-4 pt-6">
						<Text className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">Recent Searches</Text>
						<View className="flex-row flex-wrap gap-2">
							{RECENT_SEARCHES.map((term) => (
								<Pressable key={term} onPress={() => { setQuery(term); handleQueryChange(term); }} className="active:bg-muted/40 flex-row items-center gap-1.5 rounded-full px-3 py-2" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
									<Icon as={Clock} className="text-muted-foreground size-3.5" />
									<Text className="text-foreground text-sm">{term}</Text>
								</Pressable>
							))}
						</View>
						<View className="mt-8 items-center">
							<View className="mb-4 items-center justify-center rounded-full" style={{ width: 64, height: 64, backgroundColor: "rgba(255,255,255,0.04)" }}>
								<Icon as={Search} className="text-muted-foreground size-8" />
							</View>
							<Text className="text-muted-foreground text-center text-sm leading-relaxed">Search across all sheets, schedules,{"\n"}notes, and callouts in your plan set</Text>
						</View>
					</View>
				)}
				{isSearching && <View className="items-center py-20"><Text className="text-muted-foreground text-sm">Searching...</Text></View>}
				{showResults && (
					<View>
						<View className="flex-row items-center justify-between px-4 pt-4 pb-1">
							<Text className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">{displayedResults.length} Results</Text>
						</View>
						{displayedResults.map((item) => {
							const config = TYPE_CONFIG[item.type];
							return (
								<Pressable key={item.id} onPress={() => handleResultPress(item)} className="active:bg-muted/10 flex-row items-center gap-3 px-4 py-3">
									<View className="size-10 items-center justify-center rounded-lg" style={{ backgroundColor: config.bg }}>
										<Icon as={config.icon} className={config.iconClass} />
									</View>
									<View className="flex-1 gap-0.5">
										<View className="flex-row items-center gap-2">
											<Text className="text-foreground shrink text-base font-bold" numberOfLines={1}>{item.title}</Text>
											<View className="rounded-full px-2 py-0.5" style={{ backgroundColor: config.bg }}>
												<Text className="text-xs font-medium" style={{ color: config.color }}>{config.label}</Text>
											</View>
										</View>
										<Text className="text-muted-foreground text-xs" numberOfLines={1}>{item.subtitle}</Text>
										<HighlightedSnippet text={item.snippet} term={query} />
									</View>
									<Icon as={ChevronRight} className="text-muted-foreground size-4" />
								</Pressable>
							);
						})}
					</View>
				)}
				{showNoResults && (
					<View className="items-center py-20">
						<View className="mb-4 items-center justify-center rounded-full" style={{ width: 64, height: 64, backgroundColor: "rgba(255,255,255,0.04)" }}>
							<Icon as={Search} className="text-muted-foreground size-8" />
						</View>
						<Text className="text-foreground mb-1 text-base font-semibold">No results for &quot;{query}&quot;</Text>
						<Text className="text-muted-foreground text-center text-sm leading-relaxed">Try a different search term or check{"\n"}your spelling</Text>
					</View>
				)}
			</ScrollView>
			<StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
		</View>
	);
}

const meta: Meta<typeof SearchFlow> = {
	title: "Flows/5. Search",
	component: SearchFlow,
	parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof SearchFlow>;

export const EmptySearch: Story = { name: "1. Empty Search", args: { initialQuery: "" } };
export const WithResults: Story = { name: "2. Results for 'concrete'", args: { initialQuery: "concrete" } };
export const FullFlow: Story = { name: "Full Flow", args: { initialQuery: "" } };
