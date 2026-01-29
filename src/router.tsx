// src/router.tsx
import { createRootRoute, createRouter, createRoute } from "@tanstack/react-router"
import App from "./App"
import Landing from "./pages/Landing"
import Feed from "./pages/Feed"
import Bauhaus from "./pages/Bauhaus"
import Bauhaus2 from "./pages/Bauhaus2"
import About from "./pages/About"
import Profile from "./pages/Profile"
import RouteError from "./pages/RouteError"
import NotFound from "./pages/NotFound"

const rootRoute = createRootRoute({
  component: App,
  errorComponent: RouteError,
  notFoundComponent: NotFound,
})
const landingRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: Landing })
const feedRoute = createRoute({ getParentRoute: () => rootRoute, path: "/feed", component: Feed })
const bauhausRoute = createRoute({ getParentRoute: () => rootRoute, path: "/bauhaus", component: Bauhaus })
const bauhaus2Route = createRoute({ getParentRoute: () => rootRoute, path: "/bauhaus-2", component: Bauhaus2 })
const aboutRoute = createRoute({ getParentRoute: () => rootRoute, path: "/about", component: About })
const profileRoute = createRoute({ getParentRoute: () => rootRoute, path: "/profile", component: Profile })
const notFoundRoute = createRoute({ getParentRoute: () => rootRoute, path: "$", component: NotFound })

const routeTree = rootRoute.addChildren([
  landingRoute,
  feedRoute,
  bauhausRoute,
  bauhaus2Route,
  aboutRoute,
  profileRoute,
  notFoundRoute,
])
export const router = createRouter({ routeTree })
declare module "@tanstack/react-router" { interface Register { router: typeof router } }
