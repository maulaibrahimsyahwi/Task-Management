import { Navigate, Route, Routes, useParams } from "react-router-dom";
import RequireAuth from "../components/RequireAuth";
import Layout from "../layout";
import Auth from "../pages/Auth";
import Landing from "../pages/Landing";
import Home from "../pages/Home";
import NotFound from "../pages/NotFound";
import Analytics from "../pages/Analytics";
import ProjectBoard from "../pages/ProjectBoard";
import Projects from "../pages/Projects";
import { useProjects } from "../context/useProjects";

const ProjectToBoardRedirect = () => {
  const { projectId } = useParams();
  if (!projectId) return <Navigate to="/projects" replace />;
  return <Navigate to={`/board/${projectId}`} replace />;
};

const AnalyticsRedirect = () => {
  const { activeProjectId, loading, projects } = useProjects();
  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-10">
        <span className="text-lg font-semibold text-gray-200">
          Loading analytics...
        </span>
      </div>
    );
  }
  const fallbackId = projects[0]?.id ?? null;
  const targetId = activeProjectId ?? fallbackId;
  if (!targetId) return <Navigate to="/projects" replace />;
  return <Navigate to={`/analytics/${targetId}`} replace />;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<Auth />} />

      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route path="/home" element={<Home />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:projectId" element={<ProjectToBoardRedirect />} />
          <Route path="/board/:projectId" element={<ProjectBoard />} />
          <Route path="/analytics" element={<AnalyticsRedirect />} />
          <Route path="/analytics/:projectId" element={<Analytics />} />
        </Route>
      </Route>

      <Route path="/404" element={<NotFound />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
};

export default AppRoutes;
