import type { Preview } from "@storybook/react";
import "./storybook.css";

const preview: Preview = {
	initialGlobals: {
		viewport: { value: "mobile2" },
	},
	parameters: {
		layout: "centered",
	},
};

export default preview;
