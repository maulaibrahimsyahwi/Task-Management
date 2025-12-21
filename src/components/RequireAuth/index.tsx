import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/useAuth";

const RequireAuth = () => {
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

  return <Outlet />;
};

export default RequireAuth;
