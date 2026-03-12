import type { Meta, StoryObj } from "@storybook/react";
import { MembersScreen } from "@/app/_story-components";

function MembersStory() {
	return <MembersScreen />;
}

const meta: Meta<typeof MembersStory> = {
	title: "Screens/Members",
	component: MembersStory,
	parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof MembersStory>;

export const Default: Story = {};
