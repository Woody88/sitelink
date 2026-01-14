import * as React from "react";
import { Pressable, ScrollView } from "react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

interface FilterOption {
	label: string;
	value: string;
}

interface ActivityFiltersProps {
	options: FilterOption[];
	activeFilter: string;
	onFilterChange: (value: string) => void;
	className?: string;
}

export const ActivityFilters = React.memo(function ActivityFilters({
	options,
	activeFilter,
	onFilterChange,
	className,
}: ActivityFiltersProps) {
	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			className={cn("flex-grow-0", className)}
			contentContainerClassName="px-4 py-2 gap-2"
		>
			{options.map((option) => (
				<Pressable
					key={option.value}
					onPress={() => onFilterChange(option.value)}
					className={cn(
						"rounded-full px-3 py-1.5",
						activeFilter === option.value ? "bg-foreground" : "bg-muted/50",
					)}
					style={{ minHeight: 32 }}
				>
					<Text
						className={cn(
							"text-sm",
							activeFilter === option.value
								? "text-background font-medium"
								: "text-muted-foreground",
						)}
					>
						{option.label}
					</Text>
				</Pressable>
			))}
		</ScrollView>
	);
});
