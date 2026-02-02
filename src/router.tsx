// src/router.tsx
import { createRootRoute, createRouter, createRoute } from "@tanstack/react-router"
import App from "./App"
import Landing from "./pages/Landing"
import Landing2 from "./pages/Landing2"
import Landing3 from "./pages/Landing3"
import Landing4 from "./pages/Landing4"
import Landing5 from "./pages/Landing5"
import Feed from "./pages/Feed"
import Feed3 from "./pages/Feed3"
import Feed2 from "./pages/Feed2"
import Bauhaus from "./pages/Bauhaus"
import Bauhaus2 from "./pages/Bauhaus2"
import Profile1 from "./pages/Profile1"
import Profile2 from "./pages/Profile2"
import Profile21 from "./pages/Profile21"
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
const landing2Route = createRoute({ getParentRoute: () => rootRoute, path: "/landing-2", component: Landing2 })
const landing3Route = createRoute({ getParentRoute: () => rootRoute, path: "/landing-3", component: Landing3 })
const landing4Route = createRoute({ getParentRoute: () => rootRoute, path: "/landing-4", component: Landing4 })
const landing5Route = createRoute({ getParentRoute: () => rootRoute, path: "/landing-5", component: Landing5 })
const feedRoute = createRoute({ getParentRoute: () => rootRoute, path: "/feed", component: Feed })
const feed2Route = createRoute({ getParentRoute: () => rootRoute, path: "/feed-2", component: Feed2 })
const feed3Route = createRoute({ getParentRoute: () => rootRoute, path: "/feed-3", component: Feed3 })
const bauhausRoute = createRoute({ getParentRoute: () => rootRoute, path: "/bauhaus", component: Bauhaus })
const bauhaus2Route = createRoute({ getParentRoute: () => rootRoute, path: "/bauhaus-2", component: Bauhaus2 })
const profile1Route = createRoute({ getParentRoute: () => rootRoute, path: "/profile-1", component: Profile1 })
const profile2Route = createRoute({ getParentRoute: () => rootRoute, path: "/profile-2", component: Profile2 })
const profile21Route = createRoute({ getParentRoute: () => rootRoute, path: "/profile-2-1", component: Profile21 })
const aboutRoute = createRoute({ getParentRoute: () => rootRoute, path: "/about", component: About })
const profileRoute = createRoute({ getParentRoute: () => rootRoute, path: "/profile", component: Profile })
const notFoundRoute = createRoute({ getParentRoute: () => rootRoute, path: "$", component: NotFound })

const routeTree = rootRoute.addChildren([
  landingRoute,
  landing2Route,
  landing3Route,
  landing4Route,
  landing5Route,
  feedRoute,
  feed2Route,
  feed3Route,
  bauhausRoute,
  bauhaus2Route,
  profile1Route,
  profile2Route,
  profile21Route,
  aboutRoute,
  profileRoute,
  notFoundRoute,
])
export const router = createRouter({ routeTree })
declare module "@tanstack/react-router" { interface Register { router: typeof router } }
