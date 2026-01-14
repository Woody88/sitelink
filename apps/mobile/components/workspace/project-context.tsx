import { MapPin } from "lucide-react-native";
import { memo } from "react";
import { View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

export interface ProjectContextProps {
	projectName: string;
	address?: string;
}

export const ProjectContext = memo(function ProjectContext({
	projectName,
	address,
}: ProjectContextProps) {
	return (
		<View className="bg-muted/10 px-4 py-3">
			<Text
				className="text-foreground text-base font-semibold"
				numberOfLines={1}
			>
				{projectName}
			</Text>
			{address && (
				<View className="mt-1 flex-row items-center">
					<Icon as={MapPin} className="text-muted-foreground mr-1 size-3.5" />
					<Text className="text-muted-foreground text-sm" numberOfLines={1}>
						{address}
					</Text>
				</View>
			)}
		</View>
	);
});
