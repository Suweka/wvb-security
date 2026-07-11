# Admin Dashboard — Completeness Audit

> Generated: 2026-06-30 · Last updated: 2026-06-30

---

## Summary Table

| Section      | Backend Data    | Buttons Working          | Status       |
|--------------|-----------------|--------------------------|--------------|
| Dashboard    | Real (Prisma)   | Refresh only             | ✅ Done       |
| Financials   | Real (Prisma)   | None                     | 🟡 Partial   |
| Guests       | Real (Prisma)   | None                     | 🟡 Partial   |
| Housekeeping | Real (Prisma)   | ✅ All wired             | ✅ Done       |
| Rooms        | Real (Prisma)   | ✅ All wired             | ✅ Done       |
| Reservations | Real (Prisma)   | ✅ View + Cancel + Receipt | ✅ Done     |
| Newsletter   | Real API        | Send works               | ✅ Done       |
| Calendar     | ✅ Real (Prisma) | Navigation works        | ✅ Done       |
| Concierge    | Hardcoded       | None                     | ❌ Not started |
| Messages     | ✅ Real (Prisma) | ✅ All wired             | ✅ Done       |
| Reviews      | ✅ Real (Prisma) | ✅ Delete wired          | ✅ Done       |

---

## What Was Completed (2026-06-30)

### 1. Messages System — Full Stack ✅

**Schema**
- [x] Added `ContactMessage` model to `prisma/schema.prisma` (firstName, email, phone, subject, message, status, starred, adminReply, repliedAt)
- [x] Added `ContactMessageStatus` enum (`UNREAD`, `READ`, `ARCHIVED`)
- [x] Pushed schema to database via `prisma db push`

**Backend**
- [x] `POST /api/contact` — saves guest contact form submissions to DB
- [x] `GET /api/admin/messages` — fetches all messages ordered by date
- [x] `PATCH /api/admin/messages/[id]` — handles read / star toggle / archive / reply actions
- [x] `DELETE /api/admin/messages/[id]` — deletes a message permanently

**Frontend (client) — `app/(guest)/contact/page.tsx`**
- [x] Form now posts to `POST /api/contact`
- [x] Shows success message on submission
- [x] Shows error message on failure
- [x] Clears form after successful send

**Frontend (admin) — `app/admin/messages/page.tsx`**
- [x] Replaced 5 hardcoded messages with real API fetch
- [x] Star button toggles starred state (persisted to DB)
- [x] Clicking a message marks it as READ (persisted)
- [x] Archive button sets status to ARCHIVED
- [x] Delete button removes message with confirmation
- [x] Reply textarea saves admin reply to DB
- [x] Shows "Replied" badge on messages that have a reply

---

### 2. Reviews — Connected to Real Data ✅

**Backend**
- [x] Added `getReviewsData()` server action in `lib/admin-actions.ts` — queries real `Review` model
- [x] `DELETE /api/admin/reviews/[id]` — deletes a review

**Frontend (admin) — `app/admin/reviews/page.tsx`**
- [x] Replaced 5 hardcoded reviews with real Prisma data
- [x] Rating summary and distribution calculated from live data
- [x] Delete Review button works with confirmation
- [x] Search and filter work on real data

---

### 3. Housekeeping — Actions Fully Wired ✅

**Backend**
- [x] `PATCH /api/admin/tasks/[id]` — update status, title, description, priority, due date
- [x] `POST /api/admin/tasks` — create new housekeeping task

**Frontend (admin) — `app/admin/housekeeping/page.tsx`**
- [x] Mark Complete button calls API and updates UI instantly
- [x] Edit Task modal — edit title, description, priority, due date
- [x] New Task modal — create tasks with title, description, priority, due date
- [x] Loading spinner on async actions

---

### 4. Rooms — CRUD Fully Wired ✅

**Backend**
- [x] `POST /api/admin/rooms` — create new room
- [x] `PATCH /api/admin/rooms/[id]` — edit room name, description, price
- [x] `DELETE /api/admin/rooms/[id]` — delete room (blocked if bookings exist)

**Frontend (admin) — `app/admin/rooms/page.tsx`**
- [x] Edit Room button opens modal — edit name, description, price
- [x] Add Room button opens modal — create with name, description, price
- [x] UI refreshes after changes without full page reload

---

### 5. Reservations — Cancel + View Detail Wired ✅

**Backend**
- [x] `PATCH /api/admin/reservations/[id]` — cancel action (sets status to CANCELLED)

**Frontend (admin) — `app/admin/reservations/page.tsx`**
- [x] View Detail button (Eye icon) opens full booking info modal
- [x] Cancel button with confirmation dialog, spinner during request
- [x] Cancel also available from inside the View Detail modal
- [x] Table row reflects cancelled status immediately after action

---

### 6. Calendar — Real Booking Data ✅

**Backend**
- [x] Added `getCalendarData()` server action — fetches all non-cancelled bookings with guest/room info

**Frontend (admin) — `app/admin/calendar/page.tsx`**
- [x] Calendar grid highlights dates that have active bookings
- [x] Hovering a date shows room name(s) booked that day
- [x] Upcoming Check-ins sidebar replaced with real data (next 8 check-ins from today)
- [x] Navigation (prev/next month) works as before
- [x] Refresh button re-fetches live data

---

## Remaining Tasks

### 1. Reviews — Google Reviews Integration ✅ + Internal submission ❌

#### Google Reviews via Elfsight — Done

- [x] Created reusable `components/GoogleReviewsWidget.tsx` using `next/script`
- [x] Home page testimonials section replaced with live Google Reviews widget
- [x] Admin Reviews page has a **Google Reviews** tab alongside the Internal Reviews tab
- [x] Booking success page has a **"Review us on Google"** CTA button with star icons
- [x] Updated `GOOGLE_REVIEW_URL` with real Place ID `ChIJbbCxySeB4zoRFdNz-tS865g` (No.35 Windermere Park, Nuwara Eliya)

#### Internal Review Submission ✅

- [x] "Leave a Review" button in My Bookings tab — only shown for CONFIRMED bookings with past check-out date
- [x] "Reviewed ✓" badge shown after submitting (or if user already reviewed that room)
- [x] Review modal: interactive 5-star picker (hover + click), comment textarea, error display
- [x] `POST /api/reviews` — verifies completed booking, prevents duplicate reviews, creates `Review` record
- [x] Awards 25 loyalty points atomically via `prisma.$transaction` alongside review creation
- [x] Immediate UI update via `submittedRooms` state — no page reload needed

---

### 2. Guests — View Detail + Add Guest ❌

**Frontend (admin) — `app/admin/guests/page.tsx`**
- [ ] View Guest Details (Eye icon) — modal showing full booking history, total spent, contact info
- [ ] Add Guest button — manual guest creation form

**Backend**
- [ ] `POST /api/admin/guests` — manually create a guest record

---

### 3. Financials — Export Report ❌

**Frontend (admin) — `app/admin/financials/page.tsx`**
- [ ] Export Report button — generate and download a CSV of revenue data
- [ ] Could use a server action that streams a CSV response

---

### 4. Concierge — Full Stack Not Started ❌

The concierge section is entirely hardcoded. No schema model exists.

**Schema**
- [ ] Design and add a `ConciergeRequest` model (or repurpose `ServiceBooking`)

**Backend**
- [ ] `GET /api/admin/concierge` — list requests
- [ ] `POST /api/admin/concierge` — create request
- [ ] `PATCH /api/admin/concierge/[id]` — update status (Start Processing / Mark Complete)

**Frontend (admin) — `app/admin/concierge/page.tsx`**
- [ ] Replace hardcoded data with real API fetch
- [ ] Wire up Start Processing and Mark Complete buttons
- [ ] New Request modal

---

### 5. Reservations — Edit Booking ❌

- [ ] Edit reservation details (dates, guests, room) — requires availability check
- [ ] `PATCH /api/admin/reservations/[id]` with `action: 'edit'`

---

### 6. Layout — Global Admin UI ❌

- [ ] Search bar in top navbar — search across bookings/guests
- [ ] Notifications bell — show unread messages count or pending receipt count
- [ ] Settings page — admin profile, property details

---

## API Routes — Current State

| Route                                    | Method         | Purpose                                  | Status      |
|------------------------------------------|----------------|------------------------------------------|-------------|
| `/api/contact`                           | POST           | Save guest contact form message          | ✅ Done     |
| `/api/admin/messages`                    | GET            | Fetch all contact messages               | ✅ Done     |
| `/api/admin/messages/[id]`               | PATCH, DELETE  | Update / delete a message                | ✅ Done     |
| `/api/admin/reviews/[id]`                | DELETE         | Delete a guest review                    | ✅ Done     |
| `/api/admin/tasks`                       | POST           | Create new housekeeping task             | ✅ Done     |
| `/api/admin/tasks/[id]`                  | PATCH          | Update task status / details             | ✅ Done     |
| `/api/admin/rooms`                       | POST           | Create new room                          | ✅ Done     |
| `/api/admin/rooms/[id]`                  | PATCH, DELETE  | Edit / delete a room                     | ✅ Done     |
| `/api/admin/reservations/[id]`           | PATCH          | Cancel a booking                         | ✅ Done     |
| `/api/admin/receipts/[id]`               | PATCH          | Approve / reject bank transfer receipt   | ✅ Pre-existing |
| `/api/admin/newsletter/subscribers`      | GET            | Fetch all newsletter subscribers         | ✅ Pre-existing |
| `/api/admin/newsletter/send`             | POST           | Send broadcast newsletter email          | ✅ Pre-existing |
| `/api/auth/logout`                       | POST           | Log out admin user                       | ✅ Pre-existing |

---

## Data Models Status

| Model              | Schema | Admin UI          | Notes                                      |
|--------------------|--------|-------------------|--------------------------------------------|
| `ContactMessage`   | ✅ New  | ✅ Fully wired    | Added 2026-06-30                           |
| `Review`           | ✅     | ✅ Read + Delete  | Guest submission UI still missing           |
| `Task`             | ✅     | ✅ Full CRUD      | Housekeeping category only                 |
| `Room`             | ✅     | ✅ Full CRUD      |                                            |
| `Booking`          | ✅     | ✅ View + Cancel  | Edit dates not yet implemented             |
| `NewsletterSubscriber` | ✅ | ✅ List + Send   |                                            |
| `Service`          | ✅     | ❌ Not displayed  | Could power Concierge section              |
| `ServiceBooking`   | ✅     | ❌ Not displayed  | Could power Concierge section              |
| `Coupon`           | ✅     | ❌ No interface   |                                            |
