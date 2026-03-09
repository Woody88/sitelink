import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { ProfileScreen } from "./_story-components";
import { SubscriptionScreen } from "./subscription.stories";

function SettingsStory() {
	const [screen, setScreen] = React.useState<"profile" | "subscription">(
		"profile",
	);

	if (screen === "subscription") {
		return <SubscriptionScreen onBack={() => setScreen("profile")} />;
	}

	return (
		<ProfileScreen
			onNavigate={(target) => {
				if (target === "subscription") {
					setScreen("subscription");
				}
			}}
		/>
	);
}

const meta: Meta<typeof SettingsStory> = {
	title: "Screens/Profile",
	component: SettingsStory,
	parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof SettingsStory>;

export const Default: Story = {};
