// src/router.tsx
import { createRootRoute, createRouter, createRoute } from "@tanstack/react-router"
import App from "./App"
import Landing from "./pages/Landing"
import Feed from "./pages/Feed"
import Feed2 from "./pages/Feed2"
import Bauhaus from "./pages/Bauhaus"
import Bauhaus2 from "./pages/Bauhaus2"
import Profile1 from "./pages/Profile1"
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
const feed2Route = createRoute({ getParentRoute: () => rootRoute, path: "/feed-2", component: Feed2 })
const bauhausRoute = createRoute({ getParentRoute: () => rootRoute, path: "/bauhaus", component: Bauhaus })
const bauhaus2Route = createRoute({ getParentRoute: () => rootRoute, path: "/bauhaus-2", component: Bauhaus2 })
const profile1Route = createRoute({ getParentRoute: () => rootRoute, path: "/profile-1", component: Profile1 })
const aboutRoute = createRoute({ getParentRoute: () => rootRoute, path: "/about", component: About })
const profileRoute = createRoute({ getParentRoute: () => rootRoute, path: "/profile", component: Profile })
const notFoundRoute = createRoute({ getParentRoute: () => rootRoute, path: "$", component: NotFound })

const routeTree = rootRoute.addChildren([
  landingRoute,
  feedRoute,
  feed2Route,
  bauhausRoute,
  bauhaus2Route,
  profile1Route,
  aboutRoute,
  profileRoute,
  notFoundRoute,
])
export const router = createRouter({ routeTree })
declare module "@tanstack/react-router" { interface Register { router: typeof router } }
