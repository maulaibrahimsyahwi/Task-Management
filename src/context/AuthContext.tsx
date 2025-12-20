import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "firebase/auth";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from "firebase/auth";
import { auth } from "../firebase";
import {
  ensurePersonalBoard,
  ensureUserProfile,
  subscribeUserProfile,
  updateUserActivity,
} from "../services/collaborationService";
import { AuthContext, type AuthContextValue } from "./authContextStore";
import type { UserProfile } from "../types/collaboration";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        await ensureUserProfile(nextUser);
        await ensurePersonalBoard(nextUser);
        await updateUserActivity(nextUser.uid);
      } catch {
        // ignore
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeUserProfile(user.uid, setProfile);
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const onFocus = () => updateUserActivity(user.uid);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [user]);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      const result = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      if (name.trim()) {
        await updateProfile(result.user, { displayName: name.trim() });
      }
      await ensureUserProfile(result.user);
    },
    []
  );

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      signIn,
      signUp,
      signOut,
    }),
    [loading, profile, signIn, signOut, signUp, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
