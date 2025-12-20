import { useContext } from "react";
import type { User } from "firebase/auth";
import { AuthContext } from "./authContextStore";
import type { UserProfile } from "../types/collaboration";

const getDisplayName = (user: User) =>
  user.displayName || user.email?.split("@")[0] || "User";

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};

export const getUserLabel = (user: User | null, profile?: UserProfile | null) =>
  profile?.displayName || (user ? getDisplayName(user) : "User");
