// src/router.tsx
import { createRootRoute, createRouter, createRoute, redirect } from "@tanstack/react-router"
import App from "./App"
import Landing from "./pages/Landing"
import Landing2 from "./pages/Landing2"
import Landing3 from "./pages/Landing3"
import Landing4 from "./pages/Landing4"
import Landing5ProjectBlue from "./pages/Landing5ProjectBlue"
import Feed from "./pages/Feed"
import PipeExample from "./pages/PipeExample"
import PipeLandingPage from "./pages/PipeLandingPage"
import PipeLandingV1 from "./pages/PipeLandingV1"
import PipeSwipeTrain from "./pages/PipeSwipeTrain"
import PipeSwipeResult from "./pages/PipeSwipeResult"
import PipeQuiz from "./pages/PipeQuiz"
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
import CsLanding from "./pages/cs/Landing"
import CsLoading from "./pages/cs/Loading"
import CsName from "./pages/cs/Name"
import CsWeek from "./pages/cs/Week"
import CsPass from "./pages/cs/Pass"
import CsSwipe from "./pages/cs/Swipe"
import CsSummary from "./pages/cs/Summary"
import CsFeed from "./pages/cs/Feed"
import CsProfile from "./pages/cs/Profile"
import CsAdmin from "./pages/cs/Admin"
import CsAdminWeek from "./pages/cs/AdminWeek"
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
// Root entry — the bot's WebApp button + Main Mini App open "/", so send
// it straight to the CitySignal journey landing (the triptych). The old
// dev Landing is preserved at /landing-1 for reference.
const landingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => { throw redirect({ to: "/cs/landing" }) },
})
const landingOldRoute = createRoute({ getParentRoute: () => rootRoute, path: "/landing-1", component: Landing })
const landing2Route = createRoute({ getParentRoute: () => rootRoute, path: "/landing-2", component: Landing2 })
const landing3Route = createRoute({ getParentRoute: () => rootRoute, path: "/landing-3", component: Landing3 })
const landing4Route = createRoute({ getParentRoute: () => rootRoute, path: "/landing-4", component: Landing4 })
const landing5ProjectBlueRoute = createRoute({ getParentRoute: () => rootRoute, path: "/landing-5-project-blue", component: Landing5ProjectBlue })
const feedRoute = createRoute({ getParentRoute: () => rootRoute, path: "/feed", component: Feed })
const feed2Route = createRoute({ getParentRoute: () => rootRoute, path: "/feed-2", component: Feed2 })
const pipeExampleRoute = createRoute({ getParentRoute: () => rootRoute, path: "/pipe-example", component: PipeExample })
const pipeLandingRoute = createRoute({ getParentRoute: () => rootRoute, path: "/pipe-landing", component: PipeLandingPage })
const pipeLandingV1Route = createRoute({ getParentRoute: () => rootRoute, path: "/pipe-landing-v1", component: PipeLandingV1 })
const pipeSwipeTrainRoute = createRoute({ getParentRoute: () => rootRoute, path: "/pipe-swipe-train", component: PipeSwipeTrain })
const pipeSwipeResultRoute = createRoute({ getParentRoute: () => rootRoute, path: "/pipe-swipe-result", component: PipeSwipeResult })
const pipeQuizRoute = createRoute({ getParentRoute: () => rootRoute, path: "/pipe-quiz", component: PipeQuiz })
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
const csLandingRoute = createRoute({ getParentRoute: () => rootRoute, path: "/cs/landing", component: CsLanding })
const csLoadingRoute = createRoute({ getParentRoute: () => rootRoute, path: "/cs/loading", component: CsLoading })
const csNameRoute = createRoute({ getParentRoute: () => rootRoute, path: "/cs/name", component: CsName })
const csWeekRoute = createRoute({ getParentRoute: () => rootRoute, path: "/cs/week", component: CsWeek })
const csPassRoute = createRoute({ getParentRoute: () => rootRoute, path: "/cs/pass", component: CsPass })
const csSwipeRoute = createRoute({ getParentRoute: () => rootRoute, path: "/cs/swipe", component: CsSwipe })
const csSummaryRoute = createRoute({ getParentRoute: () => rootRoute, path: "/cs/summary", component: CsSummary })
const csFeedRoute = createRoute({ getParentRoute: () => rootRoute, path: "/cs/feed", component: CsFeed })
const csProfileRoute = createRoute({ getParentRoute: () => rootRoute, path: "/cs/profile", component: CsProfile })
const csAdminRoute = createRoute({ getParentRoute: () => rootRoute, path: "/admin", component: CsAdmin })
const csAdminWeekRoute = createRoute({ getParentRoute: () => rootRoute, path: "/cs/admin/week", component: CsAdminWeek })
const aboutRoute = createRoute({ getParentRoute: () => rootRoute, path: "/about", component: About })
const profileRoute = createRoute({ getParentRoute: () => rootRoute, path: "/profile", component: Profile })
const notFoundRoute = createRoute({ getParentRoute: () => rootRoute, path: "$", component: NotFound })

const routeTree = rootRoute.addChildren([
  landingRoute,
  landingOldRoute,
  landing2Route,
  landing3Route,
  landing4Route,
  landing5ProjectBlueRoute,
  feedRoute,
  feed2Route,
  pipeExampleRoute,
  pipeLandingRoute,
  pipeLandingV1Route,
  pipeSwipeTrainRoute,
  pipeSwipeResultRoute,
  pipeQuizRoute,
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
  csLandingRoute,
  csLoadingRoute,
  csNameRoute,
  csWeekRoute,
  csPassRoute,
  csSwipeRoute,
  csSummaryRoute,
  csFeedRoute,
  csProfileRoute,
  csAdminRoute,
  csAdminWeekRoute,
  aboutRoute,
  profileRoute,
  notFoundRoute,
])
export const router = createRouter({ routeTree })
declare module "@tanstack/react-router" { interface Register { router: typeof router } }
