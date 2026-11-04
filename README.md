# MAANAS — Mind check & therapist connect (full-stack prototype)

MAANAS lets a person take a short, private **mind check** (mood, worry, overthinking, sleep,
focus/clear thinking, connection + a 30-second colour–word focus task), see a summary, get
**matched with human therapists/counsellors**, book a slot, **chat** with the therapist and join a
**video call** in the browser. Therapists have their own portal; an admin approves therapists.

> Student prototype. Therapist profiles are fictional. Not a diagnostic or emergency service.
> The ML part is intentionally left as a pluggable stub (see "Where the ML model goes").

---

## Run it (Windows)

Requires **Node.js 22.13 or newer** (uses Node's built-in SQLite, so there is no database to install).

```bash
cd "E:\MAHI PROJECT\backend"
npm install
npm start
```

Open **http://localhost:3000**. The server serves both the API and the website.
The console also prints a LAN address (e.g. `http://192.168.1.5:3000`) — open that on your phone
on the same Wi-Fi. (If Windows Firewall asks, allow Node.js on private networks.)

| Role      | Email              | Password       |
|-----------|--------------------|----------------|
| User      | demo@maanas.app    | demo1234       |
| Therapist | aanya@maanas.app   | therapist123   |
| Admin     | admin@maanas.app   | admin1234      |

Other seeded therapists (`rohan@`, `mira@`, `kabir@`, `priya@`, `arjun@maanas.app`) also use
`therapist123`. `neha@maanas.app` is a pending applicant for the admin to approve.

Other commands (inside `backend/`):

```bash
npm run dev     # restart automatically when files change
npm test        # 11 tests: scoring, slots, matching, full API flow, double-booking race
npm run seed    # wipe the database; fresh demo data is created on next start
```

**Sign-up email codes:** in development (`OTP_MOCK=true`) no email is sent — the 6-digit code is
shown on the verify screen and printed in the server console.

---

## Try the full flow

1. **Sign up** as a user → verify the code → dashboard.
2. **Mind check** → answer the questions → do the focus task → see your wellbeing index,
   per-area bars and therapists matched to your answers.
3. Open a therapist → pick a day/time (IST) → choose video or chat → optionally share your
   mind-check summary → **Request session** → **Pay (demo)** → send a message.
4. Log out, log in as **aanya@maanas.app** → accept the request → reply in chat → see the
   shared summary → write private notes → **Join video call** (opens a Jitsi room).
5. Log in as **admin** → approve/suspend therapists, see platform stats.
6. Also: daily check-in, mood tracker (7-day chart, CSV export), calm tools (breathing,
   5-4-3-2-1 grounding), account editing and full account deletion.

If someone answers the safety question with anything other than "Not at all", the results page
shows Tele-MANAS (14416) and emergency (112) contacts, and the therapist sees a safety flag on a
shared summary.

---

## Project structure

```
MAHI PROJECT/
├── backend/                     Node.js + Express API (also serves the frontend)
│   ├── src/
│   │   ├── server.js            starts the server, migrates + seeds the DB
│   │   ├── app.js               Express app, routes, static hosting
│   │   ├── db.js                SQLite schema (node:sqlite), transactions
│   │   ├── seed.js              demo users / therapists / check-ins
│   │   ├── auth.js              JWT + role middleware
│   │   ├── validate.js          request validation
│   │   ├── errors.js            AppError + error middleware
│   │   ├── routes/              auth, assessments, checkins, therapists, bookings(+chat), admin
│   │   └── services/
│   │       ├── questionBank.js  mind-check questions, scale, specialities, crisis lines
│   │       ├── scoringModel.js  ★ scoring "model" — the ML plug-in point
│   │       ├── matching.js      therapist ranking
│   │       ├── slots.js         availability (IST ↔ UTC)
│   │       └── therapistRepo.js
│   ├── test/                    node:test unit + API tests
│   ├── data/                    maanas.db (created automatically)
│   └── .env.example
└── frontend/                    Vanilla JS single-page app (no build step)
    ├── index.html
    ├── styles.css               original MAANAS v5.5 design
    ├── app.css                  styles for the new screens
    └── js/
        ├── app.js               hash router, nav, session
        ├── api.js               fetch wrapper (JWT)
        ├── ui.js                helpers, formatting (Asia/Kolkata)
        └── views/               public, assessment, wellbeing, therapists, sessions, portal
```

## API overview

| Method | Path | Who |
|---|---|---|
| POST | `/api/auth/signup`, `/verify-otp`, `/resend-otp`, `/login` | public |
| GET/PATCH/DELETE | `/api/auth/me` | logged in |
| GET | `/api/assessments/questions` | public |
| POST/GET | `/api/assessments`, `/api/assessments/:id` | user |
| GET/POST/DELETE | `/api/checkins` | user |
| GET | `/api/therapists`, `/:id`, `/:id/slots`, `/specialities` | public |
| GET | `/api/therapists/recommended` | user |
| GET/PUT | `/api/therapists/me/profile` | therapist |
| POST | `/api/bookings` | user |
| GET | `/api/bookings`, `/api/bookings/:id` | participant |
| POST | `/api/bookings/:id/pay` (mock), `/cancel` | user / participant |
| POST | `/api/bookings/:id/respond`, `/complete`; PUT `/notes` | therapist |
| GET/POST | `/api/bookings/:id/messages` | participant |
| GET/POST | `/api/admin/stats`, `/api/admin/therapists`, `/:id/status` | admin |

Key safeguards: bcrypt password hashing, JWT auth with role checks plus ownership checks on every
booking, a partial unique index so a therapist slot can only hold one active booking (tested with
concurrent requests), times stored in UTC and shown in IST, assessments shared with a therapist
only when the user opts in, and account deletion that cascades all personal data.

## Where the ML model goes

`backend/src/services/scoringModel.js` exports `activeModel` with
`{ version, predict({ answers, focusTask }) }`. Today it is a transparent rules engine
(`rules-v1`): weighted per-area strain, a 0–100 wellbeing index, recommended specialities and a
crisis flag. To plug in ML, write an object with the same `predict` shape — e.g. one that calls a
Python/FastAPI service — and assign it to `activeModel`. Every saved assessment stores
`model_version`, and raw answers + focus-task timings are kept, so they can become training data
(with consent).

## What is mocked (replace before real use)

- **Email OTP** — printed to console (`OTP_MOCK=true`); plug in an email/SMS provider in `routes/auth.js`.
- **Payments** — `POST /bookings/:id/pay` just marks paid; replace with Razorpay order + webhook.
- **Video** — opens a public Jitsi Meet room named from a random per-booking code; use a
  self-hosted Jitsi / Daily / Agora with access tokens for production.
- **Chat** — polls every 3 s; switch to WebSockets for scale.
- **Therapist verification** — admin approves manually; add licence/RCI document checks.
