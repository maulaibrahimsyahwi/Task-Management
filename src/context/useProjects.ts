import { useContext } from "react";
import { ProjectContext } from "./projectContextStore";

export const useProjects = () => {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error("useProjects must be used within ProjectProvider");
  }
  return ctx;
};

