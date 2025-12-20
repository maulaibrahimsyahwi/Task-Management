import { Navigate, RouteObject } from "react-router";
import RequireAuth from "../components/RequireAuth";
import Layout from "../layout";
import Auth from "../pages/Auth";
import Home from "../pages/Home";
import Boards from "../pages/Boards";
import BoardsHub from "../pages/BoardsHub";
import Backlog from "../pages/Backlog";
import Projects from "../pages/Projects";
import Analytics from "../pages/Analytics";
import Workflows from "../pages/Workflows";
import Notifications from "../pages/Notifications";
import Newsletter from "../pages/Newsletter";
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
        element: <Navigate to="/boards" replace />,
      },
      {
        path: "home",
        element: <Home />,
      },
      {
        path: "boards",
        element: <BoardsHub />,
      },
      {
        path: "boards/:boardId",
        element: <Boards />,
      },
      {
        path: "backlog",
        element: <Backlog />,
      },
      {
        path: "projects",
        element: <Projects />,
      },
      {
        path: "analytics",
        element: <Analytics />,
      },
      {
        path: "workflows",
        element: <Workflows />,
      },
      {
        path: "notifications",
        element: <Notifications />,
      },
      {
        path: "newsletter",
        element: <Newsletter />,
      },
      {
        path: "*",
        element: <NotFound />,
      },
    ],
  },
];

export default routes;
