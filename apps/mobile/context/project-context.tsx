import * as React from "react";

interface ProjectContextType {
	activeProjectId: string | null;
	setActiveProjectId: (id: string | null) => void;
}

const ProjectContext = React.createContext<ProjectContextType | undefined>(
	undefined,
);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
	const [activeProjectId, setActiveProjectId] = React.useState<string | null>(
		null,
	);

	// In a real app, we might persist this ID to AsyncStorage or User Defaults
	// so the session remembers the last active project.

	return (
		<ProjectContext.Provider value={{ activeProjectId, setActiveProjectId }}>
			{children}
		</ProjectContext.Provider>
	);
}

export function useProject() {
	const context = React.useContext(ProjectContext);
	if (context === undefined) {
		throw new Error("useProject must be used within a ProjectProvider");
	}
	return context;
}
