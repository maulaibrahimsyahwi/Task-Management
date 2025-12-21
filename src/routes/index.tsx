import { Navigate, Route, Routes } from "react-router-dom";
import { useParams } from "react-router-dom";
import RequireAuth from "../components/RequireAuth";
import Layout from "../layout";
import Auth from "../pages/Auth";
import Home from "../pages/Home";
import NotFound from "../pages/NotFound";
import Analytics from "../pages/Analytics";
import ProjectBoard from "../pages/ProjectBoard";
import Projects from "../pages/Projects";

const ProjectToBoardRedirect = () => {
  const { projectId } = useParams();
  if (!projectId) return <Navigate to="/projects" replace />;
  return <Navigate to={`/board/${projectId}`} replace />;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />

      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/home" element={<Home />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:projectId" element={<ProjectToBoardRedirect />} />
          <Route path="/board/:projectId" element={<ProjectBoard />} />
          <Route path="/analytics" element={<Analytics />} />
        </Route>
      </Route>

      <Route path="/404" element={<NotFound />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
};

export default AppRoutes;
