# 2nd_Home: Implementation Plan and Workflow

A mobile app for running a student house rental. One app, two roles (admin and tenant), about 12 users in total. Android only. Built and hosted at zero cost.

---

## 1. Decisions so far

- **App name:** 2nd_Home
- **One app, two roles.** Everyone installs the same APK. The screens shown depend on `profiles.role` (`admin` or `tenant`).
- **Platform:** Android only, shared as an APK (no Play Store needed).
- **Payments:** direct UPI deep links (PhonePe, Google Pay, or any UPI app). The tenant enters the UTR and the admin confirms manually.
- **No SMS automation.** No SMS access, nothing sensitive read from any phone.
- **Accounts:** no public signup. The admin creates tenant accounts. Tenants change their password after first login.
- **Media:** images only, no video. Stored on Cloudinary's free plan, with the URL saved in Supabase.
- **Notifications:** push notifications through Expo, free.

---

## 2. Tech stack

| Part | Tool |
|---|---|
| App | React Native with Expo |
| Database, login, realtime | Supabase (Postgres, Auth, Realtime) |
| Server logic | Supabase Edge Functions |
| Image storage | Cloudinary (free plan) |
| Push notifications | Expo Push plus Firebase (FCM) credentials |
| Builds | EAS Build (preview profile, APK) |
| Chat UI | react-native-gifted-chat |
| Emoji picker | rn-emoji-keyboard |
| Image tools | expo-image-picker, expo-image-manipulator |

Notes:
- Android package ID cannot start with a digit, so use something like `com.secondhome.app`. The display name can still be **2nd_Home**.
- Push notifications do not work in Expo Go. Use a development or preview build.
- Free-tier limits change. Check current limits for Supabase, Cloudinary and EAS before relying on them.

---

## 3. Roles and features

### Tenant
- View own room and rent
- Pay rent (UPI buttons, then enter UTR)
- Payment history and receipts
- Raise complaints (with an optional photo)
- View announcements and meetings, and RSVP
- Group chat and private chat with admin (emoji and images)
- Change password

### Admin
- Add and disable tenants, create their login
- Room allocation and member allocation (move, assign, free a bed)
- Confirm or reject payments, see who is due or overdue
- Handle complaints (status and reply)
- Post announcements and meetings
- Chat with everyone
- Reset a tenant's password

---

## 4. Database schema

```sql
create table profiles (
  id uuid primary key references auth.users,
  name text,
  phone text,
  role text check (role in ('admin','tenant')) default 'tenant',
  push_token text,
  is_active boolean default true
);

create table settings (
  id int primary key default 1,
  owner_upi_id text,
  owner_name text
);

create table rooms (
  id serial primary key,
  room_no text,
  monthly_rent int,
  capacity int default 1
);

create table tenancies (
  id serial primary key,
  tenant_id uuid references profiles,
  room_id int references rooms,
  start_date date,
  end_date date
);

create table rent_dues (
  id serial primary key,
  tenancy_id int references tenancies,
  month date,
  amount int,
  status text default 'unpaid'
);

create table payments (
  id serial primary key,
  due_id int references rent_dues,
  utr text unique,
  screenshot_url text,
  status text default 'pending'
    check (status in ('pending','confirmed','rejected')),
  created_at timestamptz default now()
);

create table complaints (
  id serial primary key,
  tenant_id uuid references profiles,
  category text,
  details text,
  photo_url text,
  admin_reply text,
  status text default 'open'
    check (status in ('open','in_progress','resolved')),
  created_at timestamptz default now()
);

create table announcements (
  id serial primary key,
  title text,
  body text,
  is_meeting boolean default false,
  meeting_at timestamptz,
  venue text,
  created_at timestamptz default now()
);

create table meeting_rsvps (
  announcement_id int references announcements,
  tenant_id uuid references profiles,
  response text check (response in ('yes','no','maybe')),
  primary key (announcement_id, tenant_id)
);

create table messages (
  id bigserial primary key,
  room text default 'general',  -- 'general' or a tenant id for admin DMs
  sender_id uuid references profiles,
  body text,
  media_url text,               -- images only
  created_at timestamptz default now()
);
```

The `unique` constraint on `payments.utr` stops the same transaction being claimed twice.

---

## 5. Row-level security (outline)

Turn RLS on for every table. Policies to write:

- **profiles:** a user reads their own row; admin reads and updates all.
- **rooms, settings:** all signed-in users can read; only admin can change.
- **tenancies, rent_dues:** a tenant reads only rows tied to their own tenancy; admin has full access.
- **payments:** a tenant inserts and reads only payments for their own dues; only admin can set status to `confirmed` or `rejected`.
- **complaints:** a tenant inserts and reads their own; admin reads all and updates status and reply.
- **announcements:** everyone reads; only admin writes.
- **meeting_rsvps:** a tenant writes only their own response; admin reads all.
- **messages:** everyone reads and writes in `general`; in a private room, only that tenant and the admin.

Keep a helper function such as `is_admin()` that checks the caller's role, and use it in the policies.

---

## 6. Workflows

### 6.1 Create a tenant (admin)
1. Public signups are off in Supabase Auth.
2. Admin opens **Add tenant** and enters name, phone (or email) and room.
3. The app calls the `create-tenant` Edge Function with the admin's session token.
4. The function checks the caller is an admin, then uses the service-role key to create the auth user with a temporary password and `must_change_password: true`, inserts the `profiles` row, and creates the tenancy.
5. Admin shares the credentials with the tenant.
6. On first login, the app forces a new password: `supabase.auth.updateUser({ password, data: { must_change_password: false } })`.

Rules:
- The service-role key lives only in the Edge Function, never in the app.
- If tenants have no email, log in with a hidden email built from the phone number, like `9876543210@house.app`.
- Moving out means disabling the account (`is_active = false`), not deleting it, so history stays.
- Forgotten password: admin taps **Reset password**, which calls another Edge Function that sets a new temporary password.

### 6.2 Rent payment
1. Admin creates monthly `rent_dues` (manually or a scheduled function).
2. Tenant opens **Pay Rent**. The app builds the link from the owner's UPI ID, the due amount and a note like `Rent Room 4 Oct`:
   - `upi://pay?pa=<upi>&pn=2nd_Home&am=<amount>&cu=INR&tn=<note>` (generic)
   - `phonepe://pay?...` and `gpay://upi/pay?...` (app-specific)
3. The UPI app opens, the tenant pays.
4. Tenant returns and enters the UTR (and an optional screenshot).
5. A `payments` row is created as `pending`. A database webhook triggers an Edge Function that sends the admin a push notification.
6. Admin checks the bank statement and taps **Confirm** or **Reject**.
7. On confirm, the due becomes `paid`, and the tenant gets a push notification and a receipt.

Rules:
- UPI apps do not report payment results back, so confirmation is always manual.
- Test with a real small payment first. Personal UPI IDs can trigger warnings in some apps.
- Show a QR code as a fallback for devices where deep links fail.

### 6.3 Complaints
1. Tenant submits category, details and an optional photo (uploaded to Cloudinary, URL stored).
2. Admin sees it in the queue and sets status (open, in progress, resolved) with an optional reply.
3. Each status change sends the tenant a push notification.

### 6.4 Announcements and meetings
1. Admin posts a title and body. For a meeting, also date, time and venue.
2. Everyone gets a push notification.
3. Tenants RSVP (yes, no, maybe). Admin sees the count and the list.
4. A scheduled function can send a reminder an hour before the meeting.

### 6.5 Chat
1. Supabase Realtime streams new `messages` rows to the app.
2. A general group chat, plus a private chat between each tenant and the admin.
3. Emoji: the phone keyboard works already; add an in-app picker if wanted.
4. Images: pick, compress (about 1280 px wide, quality around 70%), upload to Cloudinary, save the URL in `media_url`.
5. Cloudinary upload preset: images only, with a small max file size.

### 6.6 Notifications
- On login, the app asks for permission and saves the Expo push token in `profiles.push_token`.
- Edge Functions send pushes through Expo's push service for: new payment, payment confirmed or rejected, complaint status change, new announcement, meeting reminder.
- Needs a free Firebase project with FCM credentials added to Expo.

---

## 7. Build phases

1. **Setup and login.** Create the Supabase project, Expo app (2nd_Home), auth, roles, role-based navigation, forced password change.
2. **Admin tools.** `create-tenant` function, rooms, member and room allocation.
3. **Payments.** Rent dues, UPI buttons, UTR entry, admin confirm screen, push notification.
4. **Complaints.**
5. **Announcements and meetings,** with RSVP and reminders.
6. **Chat.** Text first, then emoji, then images.
7. **Polish and release.** Test on real devices, build the APK, share with tenants.

Finish and test each phase before starting the next.

---

## 8. Distribution

1. Set `buildType: "apk"` in the `preview` profile of `eas.json`.
2. Run `eas build -p android --profile preview`.
3. Share the APK over WhatsApp or Drive. Tenants allow installs from unknown sources once.
4. Use `expo-updates` to push small JavaScript fixes without a new APK.

---

## 9. Security checklist

- Service-role key only inside Edge Functions
- Public signup disabled
- RLS on every table, tested with a tenant account
- Edge Functions verify the caller's role
- Payment webhook and function endpoints protected by tokens
- Unique UTRs and amount checks before marking anything paid
- Cloudinary preset limited to images and small files
- No SMS access, no raw sensitive data stored
- Disable accounts instead of deleting them

---

## 10. Free-tier watch list

- **Supabase:** free projects can pause after a period of inactivity. Log in or ping the app now and then.
- **Cloudinary:** storage, bandwidth and transformations share one monthly credit pool. Images only and compression keep usage low.
- **EAS Build:** monthly build limits on the free plan.
- **Supabase email:** built-in email sending is rate-limited, another reason to use admin-reset passwords.
- Limits change, so check each service's current free plan before launch.
