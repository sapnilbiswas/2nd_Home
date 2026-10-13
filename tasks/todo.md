# Tasks: 2nd_Home Implementation

## Phase 1: Setup and Login
- [x] Task 1.1: Project initialization & dependencies (Expo SDK, TypeScript, React Navigation, Supabase-js, SecureStore)
- [x] Task 1.2: Environment configuration (`.env.example` with Supabase, Cloudinary, Database URLs)
- [x] Task 1.3: Prisma schema (`prisma/schema.prisma`) for all 10 tables
- [x] Task 1.4: Raw SQL migration (`prisma/migrations/0001_initial_schema_and_rls/migration.sql`) with `is_admin()` and RLS on all tables
- [x] Task 1.5: Supabase client service with SecureStore storage adapter
- [x] Task 1.6: Auth context & state (Login, Session restore, Force password change)
- [x] Task 1.7: Role-based navigation structure (Root, Auth, Admin, Tenant navigators)
- [x] Checkpoint: Phase 1 complete, verified with typecheck and simulated auth flow

## Phase 2: Admin Tools
- [x] Task 2.1: Supabase Edge Function `create-tenant`
- [x] Task 2.2: Admin Room Management screen (List, Add, Update rooms and capacities)
- [x] Task 2.3: Admin Tenant Management & Allocation screen (List, Add Tenant via Edge Function, Assign Bed, Deactivate, Reset Password)
- [x] Checkpoint: Phase 2 complete, verified room & tenant lifecycle

## Phase 3: Payments
- [x] Task 3.1: Admin Rent Dues batch generator screen
- [x] Task 3.2: Tenant Rent Dues & Payment screen with UPI deep links (generic, PhonePe, GPay) and QR fallback
- [x] Task 3.3: Tenant UTR submission & Cloudinary receipt screenshot upload
- [x] Task 3.4: Admin Payment Review screen (Confirm / Reject payments)
- [x] Task 3.5: Push notification service for payment lifecycle
- [x] Checkpoint: Phase 3 complete, verified end-to-end payment flow

## Phase 4: Complaints
- [x] Task 4.1: Tenant Complaints screen & submission form with optional Cloudinary photo
- [x] Task 4.2: Admin Complaints triage queue with status switcher (`open`, `in_progress`, `resolved`) and admin reply
- [x] Task 4.3: Push notifications on complaint status change
- [x] Checkpoint: Phase 4 complete, verified complaint workflow

## Phase 5: Announcements and Meetings
- [x] Task 5.1: Admin Announcement & Meeting creator form
- [x] Task 5.2: Tenant Announcements feed with Meeting RSVP buttons (`yes`, `no`, `maybe`)
- [x] Task 5.3: Admin RSVP attendee breakdown view
- [x] Task 5.4: 1-hour pre-meeting reminder scheduling
- [x] Checkpoint: Phase 5 complete, verified announcements and RSVPs

## Phase 6: Realtime Chat
- [x] Task 6.1: Supabase Realtime message subscription service
- [x] Task 6.2: General Group Chat screen with emoji support
- [x] Task 6.3: Private 1-on-1 Admin-Tenant Chat threads
- [x] Task 6.4: Image attachment & Cloudinary upload integration
- [x] Checkpoint: Phase 6 complete, verified real-time messaging

## Phase 7: Polish and Release
- [x] Task 7.1: UI styling, safe area, and Android status bar polish
- [x] Task 7.2: Configure `eas.json` preview profile for standalone APK build
- [x] Task 7.3: Set up `expo-updates` configuration
- [x] Task 7.4: Comprehensive project `README.md` with step-by-step setup guide
- [x] Final Checkpoint: Full app verification complete
