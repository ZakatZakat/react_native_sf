// src/router.tsx
import { createRootRoute, createRouter, createRoute } from "@tanstack/react-router"
import App from "./App"
import Feed from "./pages/Feed"
import About from "./pages/About"
import Profile from "./pages/Profile"
import RouteError from "./pages/RouteError"

const rootRoute = createRootRoute({ component: App, errorComponent: RouteError })
const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: Feed })
const feedRoute = createRoute({ getParentRoute: () => rootRoute, path: "/feed", component: Feed })
const aboutRoute = createRoute({ getParentRoute: () => rootRoute, path: "/about", component: About })
const profileRoute = createRoute({ getParentRoute: () => rootRoute, path: "/profile", component: Profile })

const routeTree = rootRoute.addChildren([
  homeRoute,
  feedRoute,
  aboutRoute,
  profileRoute,
])
export const router = createRouter({ routeTree })
declare module "@tanstack/react-router" { interface Register { router: typeof router } }
