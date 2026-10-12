# Implementation Plan: 2nd_Home

A mobile app for running a student house rental for ~12 tenants and 1 admin. Android-only, zero cost to build and host.

## Architecture Decisions
- **Framework:** Expo (React Native, TypeScript).
- **Package ID:** `com.secondhome.app`, Display Name: `2nd_Home`.
- **Database & Auth:** Supabase (Postgres, GoTrue Auth, Realtime, Edge Functions). Client communicates exclusively via `@supabase/supabase-js`.
- **Schema Management:** Prisma is strictly used for defining models and generating migrations via `DATABASE_URL` and `DIRECT_URL`. Prisma Client is NOT bundled in the Expo mobile app.
- **Security & Authorization:** Row-Level Security (RLS) on all tables with a `security definer` `is_admin()` SQL function. Public sign-up is disabled; admin provisions accounts via an Edge Function with temporary passwords.
- **Password Policy:** Enforced password change on first login (`must_change_password` flag).
- **Payments:** UPI deep links (`generic`, `PhonePe`, `Google Pay`) + fallback QR code. Tenant inputs UTR and optional screenshot; admin validates against bank records.
- **Media:** Direct unsigned upload to Cloudinary with image compression (`expo-image-manipulator`), URLs stored in Postgres.
- **Notifications:** Expo Push Notifications (`expo-notifications`) with FCM credentials.

## Phased Execution Roadmap

### Phase 1: Setup and Login
- Setup Expo TypeScript project (`com.secondhome.app`, `2nd_Home`).
- Configure environment variables and create `.env.example`.
- Setup Prisma schema with all 10 tables (`profiles`, `settings`, `rooms`, `tenancies`, `rent_dues`, `payments`, `complaints`, `announcements`, `meeting_rsvps`, `messages`).
- Write raw SQL migration for Supabase auth foreign keys, `is_admin()`, and comprehensive RLS policies.
- Build Supabase client singleton with SecureStore session persistence.
- Implement Authentication state management:
  - Login screen (email/password with phone-alias helper).
  - Force Password Change modal/screen on first login.
  - Role-based navigation split: Admin Navigator vs Tenant Navigator.

### Phase 2: Admin Tools
- Setup Supabase Edge Function `create-tenant` with auth verification and service-role user creation.
- Admin screens:
  - Tenant list & management (view active tenants, disable/deactivate account, reset password trigger).
  - Room management (list rooms, add room, set capacity and monthly rent).
  - Tenancy allocation (assign tenant to room bed, transfer room, end tenancy).

### Phase 3: Payments
- Admin Rent Dues generation UI (generate dues for all active tenancies for any month).
- Tenant Payment Screen:
  - Display unpaid dues.
  - UPI deep links (Generic UPI, PhonePe, Google Pay) with pre-filled amount and reference note.
  - QR Code fallback generator.
  - UTR entry & optional payment screenshot upload (Cloudinary).
- Admin Payment Approval Queue:
  - Review pending payments with UTR, tenant name, room number, screenshot.
  - Confirm or Reject actions.
- Push notification triggers for payment submission and verification.

### Phase 4: Complaints
- Tenant complaint submission form (Category, Description, optional photo upload via Cloudinary).
- Admin complaint triage screen (filter by open, in-progress, resolved).
- Admin reply & status update interface.
- Push notification updates to tenants on resolution.

### Phase 5: Announcements and Meetings
- Admin broadcast creator (Title, Body, optional Meeting timestamp & Venue).
- Tenant feed for announcements and meeting invitations.
- RSVP interactive component (Yes / No / Maybe).
- Admin attendee/RSVP breakdown view.
- 1-hour pre-meeting reminder scheduling.

### Phase 6: Realtime Chat
- Supabase Realtime channel setup for `messages` table.
- General Group Chat for all residents.
- Private 1-on-1 Direct Chat between each tenant and Admin.
- Message input with emoji keyboard support and compressed image sharing.

### Phase 7: Polish and Release
- Device testing & styling refinements across Android screen sizes.
- `eas.json` configuration for `preview` APK profile.
- `expo-updates` integration.
- Comprehensive `README.md` documentation covering all manual setup steps (Supabase, FCM, Cloudinary, EAS).
