# React Native Migration Plan

## ✅ Confirmed Options
- **Platform**: Expo + EAS (builds, deployments)
- **Authentication**: Standalone app (email/phone/OTP/social login) - NOT Telegram WebApp
- **Backend**: Can modify FastAPI for mobile needs (refresh tokens, pagination, push)
- **Offline/Cache**: Yes (feed, profile)
- **Push Notifications**: Yes (Expo Notifications - FCM/APNs)

## 📋 Detailed Migration Steps

### 0) Project Inventory (1-2 hours)
**Goal**: Understand what we're migrating

- **Screens Analysis** (`src/pages/*`): Landing*, Feed, Profile, About, Home, RouteError
- **Navigation Map**: Current routing structure (`src/router.tsx`)
- **API Calls Inventory**:
  - Backend endpoints usage
  - Data models and types
  - Session/token management
- **Telegram Dependencies**:
  - `useTelegramInitData.ts` - REMOVE (WebApp only)
  - `src/tg.ts` - REMOVE or refactor
  - Telegram-specific UX elements

**Artifact**: `MIGRATION_INVENTORY.md` document

### 1) Target Architecture Setup (0.5-1 day)
**Goal**: Choose technologies for smooth migration

**Recommended Stack**:
- **Expo SDK** + **TypeScript**
- **Navigation**: `expo-router` (file-based routing like Next.js)
- **Data Management**: TanStack Query (`@tanstack/react-query`)
- **HTTP Client**: Native `fetch` + typed wrapper
- **Validation/Types**: Zod schemas
- **Storage**:
  - `expo-secure-store` for tokens
  - `AsyncStorage` for cache
- **UI**: React Native + StyleSheet (native approach)

**Project Structure**:
```
backend/          # Existing FastAPI
web/             # Current Vite React (optional: move later)
mobile/          # New Expo project
├── app/         # expo-router screens (file-based)
├── components/  # Reusable UI components
├── hooks/       # Custom hooks
├── lib/         # Utilities, API client, types
├── providers/   # Context providers
└── constants/   # App constants
```

### 2) Repository Preparation (0.5 day)
**Goal**: Enable parallel web/mobile development

- Create `mobile/` directory
- Move current web code to `web/` (optional)
- Update root `package.json` with scripts for both platforms
- Set up monorepo tooling if needed (optional)

### 3) Expo App Creation & Base Platform (0.5-1 day)
**Goal**: Runnable app with navigation and theming

```bash
npx create-expo-app mobile --template typescript
cd mobile
npm install @tanstack/react-query expo-router expo-secure-store @react-native-async-storage/async-storage
```

**Setup Tasks**:
- Configure `expo-router` with file-based navigation
- Set up QueryClient provider
- Create base screen placeholders
- Configure environment (dev/prod URLs)
- Set up ESLint/Prettier
- Configure import aliases

**Acceptance Criteria**:
- App runs on iOS/Android simulators
- Basic navigation between placeholder screens works

### 4) API Layer: Typed Client + Error Handling (0.5-2 days)
**Goal**: Make API calls from mobile reliable and typed

**Backend Changes First** (if needed):
- Add refresh token endpoints
- Implement pagination for feed
- Add push token registration endpoints

**Mobile API Layer**:
- `lib/api/request.ts` - Core HTTP wrapper (timeouts, JSON parsing, error handling)
- `lib/api/auth.ts` - Token injection and refresh logic
- `lib/api/endpoints.ts` - Typed API methods (`getFeed()`, `login()`, etc.)
- `lib/api/types.ts` - Request/Response types

**TanStack Query Setup**:
- Query keys configuration
- Retry policies
- Cache invalidation strategies
- Background refetching

**Error Handling**:
- Unified `ApiError` type for all failures
- User-friendly error messages
- Network state detection (online/offline)

### 5) Authentication System (1-3 days)
**Goal**: Email/phone/OTP/social login flow

**Backend Requirements**:
- User registration/login endpoints
- OTP verification (SMS/email)
- Social login integration (Google/Apple)
- Access/refresh token system
- Token refresh endpoint

**Mobile Implementation**:
- `providers/AuthProvider.tsx` - Global auth state
- Secure token storage with `expo-secure-store`
- Auto token refresh on 401 responses
- Login/Register screens with validation
- OTP verification flow
- Social login buttons (Google Sign-In, Apple Sign-In)

**Screens**: Login, Register, OTP Verification, Forgot Password

### 6) Navigation & App Structure (0.5-1.5 days)
**Goal**: Replicate web user flows

**Navigation Structure**:
```
Auth Stack: Login → Register → OTP → Main
Main Tabs: Feed | Profile | Settings
Modals: Event Details, Filters, Create Event
```

**Key Features**:
- Deep linking for event sharing
- Authentication guards
- Error boundaries per screen
- Loading states and skeletons

### 7) Offline Cache Implementation (1-2 days)
**Goal**: App works offline for feed and profile

**Cache Strategy**:
- Feed data: Cache with TTL (1 hour)
- Profile data: Cache with invalidation on changes
- Images: Cache with react-native-fast-image

**Implementation**:
- React Query offline-first configuration
- Background sync when online
- Optimistic updates for mutations
- Cache size limits

### 8) Push Notifications (1-2 days)
**Goal**: FCM/APNs notifications via Expo

**Setup**:
- `expo-notifications` configuration
- Device token registration with backend
- Notification permissions handling
- Custom notification sounds/icons

**Features**:
- Event notifications
- Background/foreground handling
- Deep linking from notifications

### 9) Screen Migration (3-10 days)
**Goal**: Port screens one by one

**Migration Order** (by complexity):
1. **Feed** (most important, shows data flow)
2. **Profile** (user data)
3. **About** (static content)
4. **Landing pages** (onboarding/marketing)

**Per-Screen Process**:
1. **Data Layer**: Identify queries/mutations needed
2. **State Management**: Local vs server state decisions
3. **UI Components**: Extract reusable components
4. **Lists**: Convert to `FlatList` with virtualization
5. **Styling**: CSS → StyleSheet conversion
6. **Platform Specifics**: iOS/Android adaptations

**Common Web→RN Mappings**:
- `div` → `View`
- `span/p` → `Text`
- CSS → `StyleSheet`
- `img` → `Image`
- Web scroll → `ScrollView`/`FlatList`

### 10) Media & Permissions (0.5-2 days)
**Goal**: Handle camera, gallery, location if needed

**Permissions**:
- Unified permission request system
- Graceful degradation when denied
- Platform-specific handling

### 11) Performance Optimization (0.5-1.5 days)
**Goal**: Smooth user experience

**Optimizations**:
- `FlatList` best practices (keys, layouts)
- Image optimization and caching
- Memoization of expensive components
- Bundle size monitoring

### 12) Monitoring & Analytics (0.5-1 day)
**Goal**: Production readiness

**Setup**:
- Sentry for crashes and errors
- Centralized logging
- User analytics (optional: Firebase/Mixpanel)

### 13) EAS Builds Setup (1-2 days)
**Goal**: Automated iOS/Android builds

**Configuration**:
- `eas.json` setup
- Environment variables for builds
- Build profiles (development, production)

**Android**:
- `applicationId` configuration
- Keystore management (EAS managed)

**iOS**:
- `bundleId` configuration
- Code signing (EAS managed)

### 14) App Store Preparation (1-3 days)
**Goal**: Ready for submission

**Google Play**:
- App listing and screenshots
- Privacy policy
- Internal testing track

**App Store**:
- App Store Connect setup
- Compliance requirements
- TestFlight distribution

### 15) CI/CD Pipeline (0.5-2 days, optional)
**Goal**: Automated testing and releases

**GitHub Actions**:
- Linting and type checking
- EAS build triggers
- Automated submissions

## 🗓️ Recommended Implementation Order

1. **Week 1**: Setup + API + Auth (Days 0-4)
2. **Week 2**: Core Screens + Offline (Days 5-9)
3. **Week 3**: Polish + Notifications + Builds (Days 10-14)
4. **Week 4**: Testing + App Store Release (Days 15-19)

## 📝 Important Decisions Made

- **No Telegram WebApp**: Pure mobile app experience
- **Offline-first**: App works without internet for core features
- **Push notifications**: User engagement and real-time updates
- **Backend flexibility**: Can add mobile-specific endpoints
- **Expo ecosystem**: Faster development and deployment

## 🔄 Migration Strategy

- **Parallel development**: Keep web working while building mobile
- **Incremental migration**: One screen at a time
- **Shared types**: Generate from FastAPI OpenAPI if possible
- **API compatibility**: Mobile can use existing endpoints where possible

## ✅ Success Criteria

- [ ] App builds successfully on EAS
- [ ] All screens functional on iOS/Android
- [ ] Offline mode works for feed/profile
- [ ] Push notifications working
- [ ] Authentication flow complete
- [ ] Performance acceptable (60fps, <100MB bundle)
- [ ] Published to both app stores