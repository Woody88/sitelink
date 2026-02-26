// apps/mobile/app/index.tsx
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { isOnboardingCompleted } from "@/lib/onboarding";

export default function Index() {
	const [destination, setDestination] = useState<string | null>(null);

	useEffect(() => {
		isOnboardingCompleted().then((completed) => {
			setDestination(completed ? "/projects" : "/(onboarding)/trial-start");
		});
	}, []);

	if (!destination) return null;

	return <Redirect href={destination as any} />;
}
