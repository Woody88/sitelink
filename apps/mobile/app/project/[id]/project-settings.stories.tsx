import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import {
	MembersScreen,
	ProjectSettingsScreen,
} from "@/app/_story-components";

function ProjectSettingsStory() {
	const [screen, setScreen] = React.useState<"settings" | "members">(
		"settings",
	);

	if (screen === "members") {
		return <MembersScreen onBack={() => setScreen("settings")} />;
	}

	return (
		<ProjectSettingsScreen
			onNavigateToMembers={() => setScreen("members")}
		/>
	);
}

const meta: Meta<typeof ProjectSettingsStory> = {
	title: "Screens/Project Settings",
	component: ProjectSettingsStory,
	parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof ProjectSettingsStory>;

export const Default: Story = {};
