import { AlertCircle, RefreshCw, X } from "lucide-react-native";
import * as React from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import {
	hasExceededMaxRetries,
	type PendingUpload,
} from "@/services/upload-queue";

interface PendingUploadItemProps {
	upload: PendingUpload;
	onRetry: (id: string) => void;
	onDismiss: (id: string) => void;
	isRetrying: boolean;
}

function PendingUploadItem({
	upload,
	onRetry,
	onDismiss,
	isRetrying,
}: PendingUploadItemProps) {
	const exceeded = hasExceededMaxRetries(upload);

	return (
		<View className="flex-row items-center gap-3 py-3 px-4 border-b border-border">
			<Icon
				as={AlertCircle}
				className={`size-4 ${exceeded ? "text-destructive" : "text-amber-500"}`}
			/>
			<View className="flex-1">
				<Text className="text-sm font-medium text-foreground" numberOfLines={1}>
					{upload.fileName}
				</Text>
				{upload.lastError && (
					<Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={1}>
						{exceeded
							? "Failed after 3 attempts"
							: `Retry ${upload.retryCount}/3 — ${upload.lastError}`}
					</Text>
				)}
			</View>
			{!exceeded && (
				<Pressable
					onPress={() => onRetry(upload.id)}
					disabled={isRetrying}
					className="p-2"
					accessibilityLabel="Retry upload"
				>
					{isRetrying ? (
						<ActivityIndicator size="small" />
					) : (
						<Icon as={RefreshCw} className="size-4 text-primary" />
					)}
				</Pressable>
			)}
			<Pressable
				onPress={() => onDismiss(upload.id)}
				className="p-2"
				accessibilityLabel="Dismiss upload"
			>
				<Icon as={X} className="size-4 text-muted-foreground" />
			</Pressable>
		</View>
	);
}

interface PendingUploadsListProps {
	uploads: PendingUpload[];
	onRetry: (id: string) => void;
	onRetryAll: () => void;
	onDismiss: (id: string) => void;
	isRetrying: boolean;
}

export function PendingUploadsList({
	uploads,
	onRetry,
	onRetryAll,
	onDismiss,
	isRetrying,
}: PendingUploadsListProps) {
	if (uploads.length === 0) return null;

	const retryable = uploads.filter((u) => !hasExceededMaxRetries(u));

	return (
		<View className="bg-card rounded-xl border border-border overflow-hidden">
			<View className="flex-row items-center justify-between px-4 py-2.5 bg-muted/50">
				<Text className="text-sm font-semibold text-foreground">
					{uploads.length} pending upload{uploads.length !== 1 ? "s" : ""}
				</Text>
				{retryable.length > 1 && (
					<Pressable
						onPress={onRetryAll}
						disabled={isRetrying}
						className="flex-row items-center gap-1.5"
						accessibilityLabel="Retry all pending uploads"
					>
						<Icon as={RefreshCw} className="size-3 text-primary" />
						<Text className="text-xs text-primary font-medium">Retry all</Text>
					</Pressable>
				)}
			</View>
			{uploads.map((upload) => (
				<PendingUploadItem
					key={upload.id}
					upload={upload}
					onRetry={onRetry}
					onDismiss={onDismiss}
					isRetrying={isRetrying}
				/>
			))}
		</View>
	);
}
