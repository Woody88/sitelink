import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";

const SYNC_TASK_NAME = "background-sync-task";
const FETCH_TASK_NAME = "background-fetch-task";

// Define tasks at module level (OUTSIDE any component)
TaskManager.defineTask(SYNC_TASK_NAME, async () => {
	try {
		console.log("Background sync starting...");

		// Your sync logic here
		await performSync();

		console.log("Background sync completed");
		return BackgroundTask.BackgroundTaskResult.Success;
	} catch (error) {
		console.error("Background sync failed:", error);
		return BackgroundTask.BackgroundTaskResult.Failed;
	}
});

TaskManager.defineTask(FETCH_TASK_NAME, async () => {
	try {
		console.log("Background fetch starting...");

		// Your fetch logic here
		await fetchNewContent();

		return BackgroundTask.BackgroundTaskResult.Success;
	} catch (error) {
		console.error("Background fetch failed:", error);
		return BackgroundTask.BackgroundTaskResult.Failed;
	}
});

// Registration functions (call from components)
export async function registerSyncTask(): Promise<void> {
	await BackgroundTask.registerTaskAsync(SYNC_TASK_NAME, {
		minimumInterval: 15, // minutes (minimum on Android due to WorkManager)
	});
	console.log("Sync task registered");
}

export async function unregisterSyncTask(): Promise<void> {
	await BackgroundTask.unregisterTaskAsync(SYNC_TASK_NAME);
	console.log("Sync task unregistered");
}

export async function registerFetchTask(): Promise<void> {
	await BackgroundTask.registerTaskAsync(FETCH_TASK_NAME, {
		minimumInterval: 30, // 30 minutes
	});
}

export async function unregisterFetchTask(): Promise<void> {
	await BackgroundTask.unregisterTaskAsync(FETCH_TASK_NAME);
}

// Check if task is registered
export async function isTaskRegistered(taskName: string): Promise<boolean> {
	const tasks = await TaskManager.getRegisteredTasksAsync();
	return tasks.some((task) => task.taskName === taskName);
}

// Development testing - trigger task immediately
export async function triggerTaskForTesting(): Promise<void> {
	await BackgroundTask.triggerTaskWorkerForTestingAsync();
	console.log("Background task triggered for testing");
}

// Example sync logic
async function performSync(): Promise<void> {
	// Simulate sync operation
	await new Promise((resolve) => setTimeout(resolve, 2000));

	// In real app: sync with server, update local DB, etc.
	console.log("Sync operation completed");
}

// Example fetch logic
async function fetchNewContent(): Promise<void> {
	// Simulate fetch operation
	await new Promise((resolve) => setTimeout(resolve, 1000));

	// In real app: fetch new data, check for updates, etc.
	console.log("Fetch operation completed");
}

// Usage in a component:
/*
import { useEffect } from 'react'
import { registerSyncTask, unregisterSyncTask } from './background-task'

export function App() {
  useEffect(() => {
    registerSyncTask()

    return () => {
      unregisterSyncTask()
    }
  }, [])

  return <View>...</View>
}
*/

// iOS Configuration (add to app.json):
/*
{
  "expo": {
    "ios": {
      "infoPlist": {
        "UIBackgroundModes": ["processing"]
      }
    }
  }
}
*/

// Key constraints to remember:
// - Android: Minimum 15-minute intervals (WorkManager limitation)
// - iOS: System determines optimal timing; not available in simulator
// - Tasks persist after app restart
// - Tasks stop if user force-kills the app
// - Only runs when battery is sufficient and network available
