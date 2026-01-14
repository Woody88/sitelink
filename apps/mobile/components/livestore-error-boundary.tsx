import * as Updates from "expo-updates";
import type React from "react";
import { Component, type ReactNode } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { clearLiveStoreDatabase } from "@/lib/clear-database";
import { logLiveStoreError } from "@/lib/store-config";

interface Props {
	children: ReactNode;
}

interface State {
	hasError: boolean;
	error: Error | null;
}

export class LiveStoreErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		// Log with helpful diagnostics
		logLiveStoreError(error);
		console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);
	}

	handleClearDatabase = async () => {
		try {
			const success = await clearLiveStoreDatabase();
			if (success) {
				// Reload the app
				await Updates.reloadAsync();
			} else {
				console.error("Failed to clear database");
			}
		} catch (error) {
			console.error("Error clearing database:", error);
		}
	};

	render() {
		if (this.state.hasError) {
			const error = this.state.error;
			const isMaterializerError =
				error?.message?.includes("MaterializerHashMismatchError") ||
				error?.message?.includes("MaterializeError") ||
				error?.toString?.().includes("MaterializerHashMismatchError");

			return (
				<View className="bg-background flex-1 items-center justify-center p-6">
					<View className="w-full max-w-md gap-4">
						<Text className="text-destructive text-center text-2xl font-bold">
							{isMaterializerError
								? "Database Schema Mismatch"
								: "Something went wrong"}
						</Text>

						{isMaterializerError && (
							<>
								<Text className="text-muted-foreground text-center">
									The local database schema doesn't match the current code. This
									happens during development when schema changes.
								</Text>

								<View className="bg-muted rounded-lg p-4">
									<Text className="text-muted-foreground font-mono text-sm">
										{error?.message || String(error)}
									</Text>
								</View>

								<Button
									variant="destructive"
									className="h-12 rounded-xl"
									onPress={this.handleClearDatabase}
								>
									<Text className="text-destructive-foreground text-base font-semibold">
										Clear Database & Restart
									</Text>
								</Button>

								<Text className="text-muted-foreground text-center text-xs">
									This will delete all local data and restart the app. Data will
									be resynced from the server.
								</Text>
							</>
						)}

						{!isMaterializerError && (
							<>
								<View className="bg-muted rounded-lg p-4">
									<Text className="text-muted-foreground font-mono text-sm">
										{error?.message || String(error)}
									</Text>
								</View>

								<Button
									className="h-12 rounded-xl"
									onPress={() => {
										this.setState({ hasError: false, error: null });
										Updates.reloadAsync();
									}}
								>
									<Text className="text-base font-semibold">Reload App</Text>
								</Button>
							</>
						)}
					</View>
				</View>
			);
		}

		return this.props.children;
	}
}
