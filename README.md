# 2nd_Home 🏠

A modern, student house rental management mobile application built for Android. **2nd_Home** connects house owners/administrators and student residents into a single unified mobile app with two role-based experiences (Admin & Tenant).

Built strictly on a **100% free-tier architecture** with zero ongoing hosting or build costs.

---

## 📱 Key Highlights & Architecture

- **Single Mobile App, Two Roles:** Everyone installs the same APK (`com.secondhome.app`). The UI dynamically transforms based on `profiles.role` (`admin` or `tenant`).
- **No Public Signup:** Accounts are provisioned solely by the house administrator. Tenants log in using their phone number and a temporary password, and are forced to set their own private password upon first login.
- **Direct UPI Payments (Zero Transaction Fees):** Integrates deep links to **PhonePe**, **Google Pay**, and generic UPI apps (`upi://pay`), alongside dynamic QR code generation (`react-native-qrcode-svg`). Tenants enter their bank UTR transaction reference; admin verifies and confirms manually against their bank statement.
- **Realtime House Chat & Private DMs:** Instant real-time messaging powered by Supabase Realtime channels (`supabase_realtime`), supporting both a general house resident group and private 1-on-1 admin-tenant threads.
- **Complaints & Maintenance Tracker:** Residents submit maintenance tickets with photos and categories (Electrical, Plumbing, Wi-Fi, Cleanliness); admin triages, updates status, and replies.
- **House Notices & Meetings:** Admin broadcasts house announcements and meeting invites. Residents RSVP (`Yes`, `Maybe`, `No`), and receive an automated local push reminder 1 hour before the meeting.
- **Image Compression & Storage:** Photos (receipts, complaint evidence, chat images) are automatically compressed on-device (~1280px width, 70% quality via `expo-image-manipulator`) and stored in Cloudinary via an unsigned upload preset.
- **Zero-Cost Standalone APK Distribution:** Built via EAS Build (`preview` profile), generating a standalone `.apk` distributed directly to tenants without requiring Google Play Store fees.

---

## 🛠 Tech Stack

| Component | Technology | Cost / Tier |
|---|---|---|
| **Mobile App** | React Native, Expo SDK 57, TypeScript | Free / Open Source |
| **Backend & DB** | Supabase (PostgreSQL, Auth, Realtime, Edge Functions) | Free Tier (500MB DB, 50k MAU) |
| **Schema & Migrations** | Prisma CLI (CLI & migrations only; never in app bundle) | Free / Open Source |
| **Media Storage** | Cloudinary (Unsigned Preset, on-device compression) | Free Tier (25 Monthly Credits) |
| **Push Notifications** | Expo Notifications & Firebase Cloud Messaging (FCM) | Free Tier |
| **App Builds** | EAS Build (`preview` profile generating standalone APK) | Free Tier (30 Android builds/mo) |
| **OTA Updates** | `expo-updates` (Over-the-air JS runtime patches) | Free Tier |

---

## 🔒 Security Model & Database Policies

1. **Security Definer Function:** A Postgres helper `public.is_admin()` verifies caller permissions securely without bypassing security contexts.
2. **Row Level Security (RLS) on all 10 Tables:**
   - `profiles`: Users read and edit their own row; admins read and manage all.
   - `rooms` & `settings`: All authenticated users read; only admin can create/modify.
   - `tenancies` & `rent_dues`: Tenants read only their own tenancies and rent dues; admin has full access.
   - `payments`: Tenants insert and view payments for their own dues; only admin can update status (`confirmed` or `rejected`).
   - `complaints`: Tenants insert and read their own; admin updates status and reply.
   - `announcements`: All users read; only admin creates/deletes.
   - `meeting_rsvps`: Tenants manage their own response; admin reads attendee roster.
   - `messages`: All users read and write in `room = 'general'`; in private threads (`room = <tenant_id>`), only that tenant and the admin can read or write.
3. **No Service-Role Key in Client Code:** The client application bundles **only** `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Administrative operations (such as user creation) execute inside isolated Supabase Edge Functions.

---

## 📁 Project Structure

```
2nd_Home/
├── assets/                       # App icons, splash, adaptive icons
├── prisma/
│   ├── schema.prisma             # Canonical Prisma schema (10 models)
│   └── migrations/
│       └── 0001_initial_schema_and_rls/
│           └── migration.sql     # RLS policies, triggers & publications
├── scripts/                      # Verification test runners & seeders
│   ├── migrate.js                # Migration execution script
│   ├── seed_admin.js             # Initial admin account seeder
│   ├── seed_test_tenant.js       # Test resident seeder
│   ├── verify_phase1.js          # Auth & Login verification
│   ├── verify_phase2.js          # Room & Tenant tools verification
│   ├── verify_phase3.js          # Payments & UPI deep links verification
│   ├── verify_phase4.js          # Complaints lifecycle verification
│   ├── verify_phase5.js          # Notices & Meeting RSVPs verification
│   └── verify_phase6.js          # Realtime Chat & DMs verification
├── src/
│   ├── api/                      # Supabase, Cloudinary, Chat, UPI & Notifications APIs
│   │   ├── admin.ts
│   │   ├── announcements.ts
│   │   ├── chat.ts
│   │   ├── cloudinary.ts
│   │   ├── complaints.ts
│   │   ├── notifications.ts
│   │   ├── payments.ts
│   │   └── supabase.ts
│   ├── components/               # Button, Input, Card reusable primitives
│   ├── context/                  # AuthContext (role detection, session persistence)
│   ├── navigation/               # RootNavigator, AdminNavigator, TenantNavigator
│   ├── screens/
│   │   ├── admin/                # Dashboard, Rooms, Tenants, Payments, Complaints, Notices, Chat
│   │   ├── auth/                 # LoginScreen, ForcePasswordChangeScreen
│   │   └── tenant/               # HomeScreen, PaymentScreen, ComplaintsScreen, Notices, Chat
│   ├── theme/                    # Color palette, spacing, typography
│   ├── types/                    # TypeScript DB models & Navigation route params
│   └── utils/                    # UPI deep links & formatters
├── supabase/
│   └── functions/                # Deno Edge Functions (create-tenant, reset-password)
├── app.json                      # Expo application manifest
├── eas.json                      # EAS Build profiles (preview APK)
└── package.json
```

---

## 🚀 Setup & Installation

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v20+ recommended)
- [Expo CLI](https://docs.expo.dev/) (`npx expo`)
- [EAS CLI](https://docs.expo.dev/eas/) (`npm install -g eas-cli`)

### 2. Environment Variables
Copy `.env.example` to `.env` in the project root:

```bash
cp .env.example .env
```

Fill in your project credentials:
```ini
# Supabase Postgres URLs (used for Prisma schema & migrations)
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"

# Supabase Public Anon Configuration (bundled in app)
EXPO_PUBLIC_SUPABASE_URL="https://[PROJECT-REF].supabase.co"
EXPO_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"

# Cloudinary Unsigned Upload Configuration
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME="your-cloud-name"
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET="secondhome_unsigned_preset"
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Database Setup & Seeding
Apply migrations and seed initial accounts:
```bash
# Execute schema migration & RLS policies
node scripts/migrate.js

# Seed the House Admin account
node scripts/seed_admin.js

# Seed a sample resident account
node scripts/seed_test_tenant.js
```

---

## 🧪 Verification Test Suite

Every subsystem includes an automated verification script:

```bash
node scripts/verify_phase1.js   # Verify Auth, Session & RLS
node scripts/verify_phase2.js   # Verify Rooms, Allocations & Tenancies
node scripts/verify_phase3.js   # Verify Rent Dues, UPI Links & Payments
node scripts/verify_phase4.js   # Verify Complaints Workflow & Replies
node scripts/verify_phase5.js   # Verify Notices, Meeting RSVPs & Reminders
node scripts/verify_phase6.js   # Verify Realtime Chat & Direct Messages
```

To typecheck the entire TypeScript codebase:
```bash
npx tsc --noEmit
```

---

## 📦 Building Standalone APK (EAS Build)

To generate the standalone Android `.apk` file for direct distribution:

1. **Log in to EAS:**
   ```bash
   npx eas login
   ```
2. **Build the Preview APK:**
   ```bash
   npx eas build -p android --profile preview
   ```
3. Once the cloud build completes, download the generated `.apk` and share it with residents via WhatsApp, Google Drive, or Telegram. Residents simply tap the APK to install (enabling *"Install from unknown sources"* once).

---

## 🔄 Over-the-Air (OTA) Updates

When shipping bug fixes or UI updates that do not alter native modules, publish an OTA update instantly without rebuilding the APK:

```bash
npx eas update --branch preview --message "Fixed payment summary layout"
```

The next time residents launch the app, `expo-updates` will automatically download and apply the new JavaScript bundle.
