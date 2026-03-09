import type { Preview } from "@storybook/react";
import "./storybook.css";

if (typeof document !== "undefined") {
	document.documentElement.classList.add("dark");
	document.body.style.backgroundColor = "#121212";
}

const preview: Preview = {
	initialGlobals: {
		viewport: { value: "mobile2" },
	},
	parameters: {
		layout: "centered",
		backgrounds: {
			default: "dark",
			values: [{ name: "dark", value: "#121212" }],
		},
	},
};

export default preview;
