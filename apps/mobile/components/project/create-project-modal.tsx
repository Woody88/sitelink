import { X } from "lucide-react-native";
import * as React from "react";
import { Modal, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";

interface CreateProjectModalProps {
	isVisible: boolean;
	onClose: () => void;
	onSubmit: (data: { name: string; address?: string }) => void;
}

export function CreateProjectModal({
	isVisible,
	onClose,
	onSubmit,
}: CreateProjectModalProps) {
	const [name, setName] = React.useState("");
	const [address, setAddress] = React.useState("");

	const handleSubmit = () => {
		if (!name.trim()) return;
		onSubmit({ name, address });
		setName("");
		setAddress("");
		onClose();
	};

	return (
		<Modal
			animationType="slide"
			presentationStyle="pageSheet"
			visible={isVisible}
			onRequestClose={onClose}
		>
			<View className="bg-background flex-1">
				<View className="border-border flex-row items-center justify-between border-b px-6 py-4">
					<Text className="text-lg font-bold">New Project</Text>
					<Button variant="ghost" size="icon" onPress={onClose}>
						<X size={24} className="text-foreground" />
					</Button>
				</View>

				<View className="gap-6 p-6">
					<View className="gap-2">
						<Label nativeID="projectName">Project Name</Label>
						<Input
							nativeID="projectName"
							className="h-12 rounded-xl"
							placeholder="e.g. Riverside Apartments"
							value={name}
							onChangeText={setName}
							autoFocus
						/>
					</View>

					<View className="gap-2">
						<Label nativeID="address">Address (Optional)</Label>
						<Input
							nativeID="address"
							className="h-12 rounded-xl"
							placeholder="e.g. 123 Main St, Denver, CO"
							value={address}
							onChangeText={setAddress}
						/>
					</View>

					<View className="mt-4">
						<Button
							onPress={handleSubmit}
							disabled={!name.trim()}
							className="h-12 w-full rounded-xl"
						>
							<Text className="text-base font-semibold">Create Project</Text>
						</Button>
					</View>
				</View>
			</View>
		</Modal>
	);
}
