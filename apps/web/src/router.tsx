import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { z } from "zod";
import { getToken } from "./lib/auth";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Settings from "./pages/Settings";
import Builder from "./pages/Builder";
import Sets from "./pages/Sets";
import SetDetail from "./pages/SetDetail";

const rootRoute = createRootRoute({ component: Outlet });

function requireLogin() {
  if (!getToken()) throw redirect({ to: "/login" });
}

const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: "/login", component: Login });
const registerRoute = createRoute({ getParentRoute: () => rootRoute, path: "/register", component: Register });

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  beforeLoad: requireLogin,
  component: Settings,
});

const builderSearchSchema = z.object({
  setId: z.string().optional(),
});

const builderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/builder",
  beforeLoad: requireLogin,
  validateSearch: builderSearchSchema,
  component: Builder,
});

const setsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sets",
  beforeLoad: requireLogin,
  component: Sets,
});

const setDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sets/$id",
  beforeLoad: requireLogin,
  component: SetDetail,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: getToken() ? "/builder" : "/login" });
  },
  component: () => null,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  registerRoute,
  settingsRoute,
  builderRoute,
  setsRoute,
  setDetailRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
