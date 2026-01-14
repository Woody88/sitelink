import { formatDistanceToNow } from "date-fns";
import { RefreshCcw, Sparkles } from "lucide-react-native";
import * as React from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import type { DailySummary } from "@/hooks/use-daily-summary";
import { cn } from "@/lib/utils";

interface SummaryCardProps {
	summary: DailySummary | null;
	isLoading: boolean;
	onGenerate: () => void;
	className?: string;
}

export const SummaryCard = React.memo(function SummaryCard({
	summary,
	isLoading,
	onGenerate,
	className,
}: SummaryCardProps) {
	return (
		<Card className={cn("overflow-hidden", className)}>
			<CardHeader className="flex-row items-center justify-between pb-2">
				<View className="flex-row items-center gap-2">
					<Icon as={Sparkles} className="text-primary size-5" />
					<CardTitle className="text-lg">Today&apos;s Summary</CardTitle>
				</View>
				<Button
					variant="outline"
					size="sm"
					className="h-9 gap-2 px-3"
					onPress={onGenerate}
					disabled={isLoading}
				>
					<Icon
						as={RefreshCcw}
						className={cn("size-4", isLoading && "animate-spin")}
					/>
					<Text className="text-sm font-medium">Generate</Text>
				</Button>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<View className="gap-2">
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-[90%]" />
						<Skeleton className="h-4 w-[95%]" />
						<Skeleton className="mt-2 h-4 w-[40%]" />
					</View>
				) : summary ? (
					<View className="gap-3">
						<Text className="text-foreground text-base leading-relaxed">
							{summary.text}
						</Text>
						<Text className="text-muted-foreground text-xs italic">
							Last generated{" "}
							{formatDistanceToNow(summary.lastGenerated, { addSuffix: true })}
						</Text>
					</View>
				) : (
					<View className="items-center py-4">
						<Text className="text-muted-foreground mb-4 text-center">
							Generate an AI summary of today&apos;s progress and photos.
						</Text>
						<Button variant="secondary" onPress={onGenerate} className="gap-2">
							<Icon as={Sparkles} className="size-4" />
							<Text>Generate Summary</Text>
						</Button>
					</View>
				)}
			</CardContent>
		</Card>
	);
});
