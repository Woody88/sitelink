import type { Meta, StoryObj } from "@storybook/react";
import { View } from "react-native";
import { Button } from "./button";
import { Text } from "./text";

const meta: Meta<typeof Button> = {
	title: "UI/Button",
	component: Button,
	decorators: [
		(Story) => (
			<View style={{ padding: 16, gap: 12 }}>
				<Story />
			</View>
		),
	],
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
	render: () => (
		<Button>
			<Text>Default Button</Text>
		</Button>
	),
};

export const Destructive: Story = {
	render: () => (
		<Button variant="destructive">
			<Text>Delete</Text>
		</Button>
	),
};

export const Outline: Story = {
	render: () => (
		<Button variant="outline">
			<Text>Outline</Text>
		</Button>
	),
};

export const Secondary: Story = {
	render: () => (
		<Button variant="secondary">
			<Text>Secondary</Text>
		</Button>
	),
};

export const Ghost: Story = {
	render: () => (
		<Button variant="ghost">
			<Text>Ghost</Text>
		</Button>
	),
};

export const Link: Story = {
	render: () => (
		<Button variant="link">
			<Text>Link</Text>
		</Button>
	),
};

export const Small: Story = {
	render: () => (
		<Button size="sm">
			<Text>Small</Text>
		</Button>
	),
};

export const Large: Story = {
	render: () => (
		<Button size="lg">
			<Text>Large</Text>
		</Button>
	),
};

export const Disabled: Story = {
	render: () => (
		<Button disabled>
			<Text>Disabled</Text>
		</Button>
	),
};

export const AllVariants: Story = {
	render: () => (
		<View style={{ gap: 8 }}>
			<Button variant="default">
				<Text>Default</Text>
			</Button>
			<Button variant="destructive">
				<Text>Destructive</Text>
			</Button>
			<Button variant="outline">
				<Text>Outline</Text>
			</Button>
			<Button variant="secondary">
				<Text>Secondary</Text>
			</Button>
			<Button variant="ghost">
				<Text>Ghost</Text>
			</Button>
			<Button variant="link">
				<Text>Link</Text>
			</Button>
		</View>
	),
};
