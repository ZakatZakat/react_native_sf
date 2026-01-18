// src/router.tsx
import { createRootRoute, createRouter, createRoute } from "@tanstack/react-router"
import App from "./App"
import Landing from "./pages/Landing"
import Landing2 from "./pages/Landing2"
import Landing3 from "./pages/Landing3"
import Landing5 from "./pages/Landing5"
import Landing6 from "./pages/Landing6"
import Feed from "./pages/Feed"
import About from "./pages/About"
import Profile from "./pages/Profile"
import RouteError from "./pages/RouteError"

const rootRoute = createRootRoute({ component: App, errorComponent: RouteError })
const landingRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: Landing })
const landing2Route = createRoute({ getParentRoute: () => rootRoute, path: "/landing-2", component: Landing2 })
const landing3Route = createRoute({ getParentRoute: () => rootRoute, path: "/landing-3", component: Landing3 })
const landing5Route = createRoute({ getParentRoute: () => rootRoute, path: "/landing-5", component: Landing5 })
const landing6Route = createRoute({ getParentRoute: () => rootRoute, path: "/landing-6", component: Landing6 })
const feedRoute = createRoute({ getParentRoute: () => rootRoute, path: "/feed", component: Feed })
const aboutRoute = createRoute({ getParentRoute: () => rootRoute, path: "/about", component: About })
const profileRoute = createRoute({ getParentRoute: () => rootRoute, path: "/profile", component: Profile })

const routeTree = rootRoute.addChildren([
  landingRoute,
  landing2Route,
  landing3Route,
  landing5Route,
  landing6Route,
  feedRoute,
  aboutRoute,
  profileRoute,
])
export const router = createRouter({ routeTree })
declare module "@tanstack/react-router" { interface Register { router: typeof router } }
