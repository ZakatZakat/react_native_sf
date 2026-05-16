// src/router.tsx
import { createRootRoute, createRouter, createRoute } from "@tanstack/react-router"
import App from "./App"
import Landing from "./pages/Landing"
import Landing2 from "./pages/Landing2"
import Landing3 from "./pages/Landing3"
import Landing4 from "./pages/Landing4"
import Landing5ProjectBlue from "./pages/Landing5ProjectBlue"
import Feed from "./pages/Feed"
import PipeExample from "./pages/PipeExample"
import PipeLandingPage from "./pages/PipeLandingPage"
import PipeLandingClassic from "./pages/PipeLandingClassic"
import PipeLandingBauhaus from "./pages/PipeLandingBauhaus"
import PipeRotate from "./pages/PipeRotate"
import PipeMyProfile from "./pages/PipeMyProfile"
import PipePersonalFeed from "./pages/PipePersonalFeed"
import PipeFeed from "./pages/PipeFeed"
import PipeFeedSwipe from "./pages/PipeFeedSwipe"
import PipeMyEvents from "./pages/PipeMyEvents"
import PipeOnboarding from "./pages/PipeOnboarding"
import PipeOnboardingClassic from "./pages/PipeOnboardingClassic"
import PipeAdminModeration from "./pages/PipeAdminModeration"
import PipeRadarCategory from "./pages/PipeRadarCategory"
import PipeExampleOnlyBlue from "./pages/PipeExampleOnlyBlue"
import PipeFeedOnlyBlue from "./pages/PipeFeedOnlyBlue"
import Feed2 from "./pages/Feed2"
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
const landing5ProjectBlueRoute = createRoute({ getParentRoute: () => rootRoute, path: "/landing-5-project-blue", component: Landing5ProjectBlue })
const feedRoute = createRoute({ getParentRoute: () => rootRoute, path: "/feed", component: Feed })
const feed2Route = createRoute({ getParentRoute: () => rootRoute, path: "/feed-2", component: Feed2 })
const pipeExampleRoute = createRoute({ getParentRoute: () => rootRoute, path: "/pipe-example", component: PipeExample })
const pipeLandingRoute = createRoute({ getParentRoute: () => rootRoute, path: "/pipe-landing", component: PipeLandingPage })
const pipeLandingClassicRoute = createRoute({ getParentRoute: () => rootRoute, path: "/pipe-landing-classic", component: PipeLandingClassic })
const pipeLandingBauhausRoute = createRoute({ getParentRoute: () => rootRoute, path: "/pipe-landing-bauhaus", component: PipeLandingBauhaus })
const pipeRotateRoute = createRoute({ getParentRoute: () => rootRoute, path: "/pipe-rotate", component: PipeRotate })
const pipeMyProfileRoute = createRoute({ getParentRoute: () => rootRoute, path: "/pipe-personal", component: PipeMyProfile })
const pipePersonalFeedRoute = createRoute({ getParentRoute: () => rootRoute, path: "/pipe-personal-feed", component: PipePersonalFeed })
const pipeFeedRoute = createRoute({ getParentRoute: () => rootRoute, path: "/pipe-feed", component: PipeFeed })
const pipeFeedSwipeRoute = createRoute({ getParentRoute: () => rootRoute, path: "/pipe-feed-swipe", component: PipeFeedSwipe })
const pipeMyEventsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/pipe-my-events", component: PipeMyEvents })
const pipeOnboardingRoute = createRoute({ getParentRoute: () => rootRoute, path: "/pipe-onboarding", component: PipeOnboarding })
const pipeOnboardingClassicRoute = createRoute({ getParentRoute: () => rootRoute, path: "/pipe-onboarding-classic", component: PipeOnboardingClassic })
const pipeAdminModerationRoute = createRoute({ getParentRoute: () => rootRoute, path: "/pipe-admin-moderation", component: PipeAdminModeration })
const pipeRadarCategoryRoute = createRoute({ getParentRoute: () => rootRoute, path: "/pipe-radar/$key", component: PipeRadarCategory })
const pipeExampleOnlyBlueRoute = createRoute({ getParentRoute: () => rootRoute, path: "/pipe-example-only-blue", component: PipeExampleOnlyBlue })
const pipeFeedOnlyBlueRoute = createRoute({ getParentRoute: () => rootRoute, path: "/pipe-feed-only-blue", component: PipeFeedOnlyBlue })
const aboutRoute = createRoute({ getParentRoute: () => rootRoute, path: "/about", component: About })
const profileRoute = createRoute({ getParentRoute: () => rootRoute, path: "/profile", component: Profile })
const notFoundRoute = createRoute({ getParentRoute: () => rootRoute, path: "$", component: NotFound })

const routeTree = rootRoute.addChildren([
  landingRoute,
  landing2Route,
  landing3Route,
  landing4Route,
  landing5ProjectBlueRoute,
  feedRoute,
  feed2Route,
  pipeExampleRoute,
  pipeLandingRoute,
  pipeLandingClassicRoute,
  pipeLandingBauhausRoute,
  pipeRotateRoute,
  pipeMyProfileRoute,
  pipePersonalFeedRoute,
  pipeFeedRoute,
  pipeFeedSwipeRoute,
  pipeMyEventsRoute,
  pipeOnboardingRoute,
  pipeOnboardingClassicRoute,
  pipeAdminModerationRoute,
  pipeRadarCategoryRoute,
  pipeExampleOnlyBlueRoute,
  pipeFeedOnlyBlueRoute,
  aboutRoute,
  profileRoute,
  notFoundRoute,
])
export const router = createRouter({ routeTree })
declare module "@tanstack/react-router" { interface Register { router: typeof router } }
