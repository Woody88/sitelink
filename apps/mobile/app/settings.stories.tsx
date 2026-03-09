import type { Meta, StoryObj } from "@storybook/react";
import { ProfileScreen } from "./_story-components";

function SettingsStory() {
	return <ProfileScreen />;
}

const meta: Meta<typeof SettingsStory> = {
	title: "Screens/Profile",
	component: SettingsStory,
	parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof SettingsStory>;

export const Default: Story = {};
