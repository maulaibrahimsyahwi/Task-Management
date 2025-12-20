import type { ReactElement } from "react";
import { Navigate } from "react-router";
import { useAuth } from "../../context/useAuth";

const RequireAuth = ({ children }: { children: ReactElement }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="w-screen h-screen grid place-items-center">
        <div className="text-lg font-semibold text-gray-200">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return children;
};

export default RequireAuth;
