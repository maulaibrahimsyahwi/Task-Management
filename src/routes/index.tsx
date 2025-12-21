import { Navigate, RouteObject } from "react-router";
import RequireAuth from "../components/RequireAuth";
import Layout from "../layout";
import Auth from "../pages/Auth";
import Home from "../pages/Home";
import Boards from "../pages/Boards";
import BoardsHub from "../pages/BoardsHub";
import Projects from "../pages/Projects";
import ProjectBoard from "../pages/ProjectBoard";
import Analytics from "../pages/Analytics";
import NotFound from "../pages/NotFound";

const routes: RouteObject[] = [
  {
    path: "/auth",
    element: <Auth />,
  },
  {
    path: "/",
    element: (
      <RequireAuth>
        <Layout />
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/projects" replace />,
      },
      {
        path: "home",
        element: <Home />,
      },
      {
        path: "boards",
        element: <Boards />,
      },
      {
        path: "boards/manage",
        element: <BoardsHub />,
      },
      {
        path: "boards/:boardId",
        element: <Boards />,
      },
      {
        path: "projects",
        element: <Projects />,
      },
      {
        path: "projects/boards/:projectId",
        element: <ProjectBoard />,
      },
      {
        path: "projects/:projectId",
        element: <ProjectBoard />,
      },
      {
        path: "analytics",
        element: <Analytics />,
      },
      {
        path: "*",
        element: <NotFound />,
      },
    ],
  },
];

export default routes;
