import type { Meta, StoryObj } from "@storybook/react";
import { NotificationsScreen } from "./_story-components";

function NotificationsStory() {
	return <NotificationsScreen />;
}

const meta: Meta<typeof NotificationsStory> = {
	title: "Screens/Notifications",
	component: NotificationsStory,
	parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof NotificationsStory>;

export const Default: Story = {};
