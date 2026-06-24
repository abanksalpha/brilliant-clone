# APT(utor)

**Subject: AP Physics C: Electricity and Magnetism.**

APT(utor) is a learn-by-doing physics tutor modeled on Brilliant. The name is
short for AP Tutor.
Instead of videos and multiple-choice trivia, every step drops you into a problem
you can touch. You drag charges, aim force vectors, build the equation one piece
at a time, and watch the visual respond in real time. Each answer gets instant,
specific feedback that was written by hand, and the idea is explained only after
you have wrestled with it.

This repository is the **Phase 1 MVP** for the "Build Brilliant" assignment: one
subject, taught deep, with no AI anywhere in the experience.

**Persona:** a high school student taking AP Physics C: Electricity and Magnetism
(or someone self-studying for the exam) who learns better by doing than by
reading.

Live demo: https://aptutorlearn.vercel.app

## Scope: what is real and what is a placeholder

This is an MVP, and it is intentionally narrow. Please read this before exploring
so nothing surprises you. The app shows the shape of a full course, but most of
that surface is a mockup.

**Real and fully working:**

- Exactly one complete lesson: Coulomb's Law, the first topic in AP Physics C:
  Electricity and Magnetism.
- Hands-on interactions, instant hand-written feedback, progress and streaks,
  accounts, and cross-device persistence (all described below).

**Faux (shown in the UI to convey where the product is headed, but not built):**

- Every other lesson in the course path. The dashboard renders the full College
  Board unit map, but only Coulomb's Law opens. The remaining topics are locked
  placeholder nodes.
- The subject list on the landing page (Math, Biology, Chemistry, Computer
  Science, English, History, and the other Physics courses). Only AP Physics C:
  Electricity and Magnetism leads into the product, and inside it only Coulomb's
  Law exists today.

In short: one real lesson, in one real subject. Everything wider than that is a
placeholder for a future build.

## The lesson

The one complete lesson is Coulomb's Law, built as 27 short steps (11 concept
cards and 16 interactive problems) that assume no prior knowledge of electricity
and magnetism. It mixes several hand-built interaction types so the learner is
always doing something, not reading:

- **Charge sandbox**: drag a point charge around a field and watch the net force
  arrow update live.
- **Vector aim**: rotate a force arrow to the correct direction before the step
  accepts your answer.
- **Build the formula**: drag symbols into place to assemble Coulomb's Law.
- **Numeric input**: type exact answers and ratios with instant checking.
- **Multiple choice and tap**: quick checks with targeted feedback.

Every wrong answer gets a short explanation that was written by hand, never
generated.

## Features

- One deep, fully interactive lesson with instant, specific feedback.
- SVG simulations that stay smooth while the learner manipulates them.
- A course path for AP Physics C: Electricity and Magnetism, with Coulomb's Law
  live and later topics shown as locked nodes (placeholders for now).
- Progress that persists across sessions and devices, stored per user in
  Firestore.
- Resume support: leave mid-lesson and pick up where you left off.
- Accounts with email and password (including email verification) and Google
  sign-in.
- A habit loop: XP per question (10) and per lesson (120), a daily XP goal (500),
  and a completion streak.
- A friends layer: find other learners, send and accept requests, and see where
  your friends are on the course path.
- Responsive layout that works on phone-sized screens with touch input.

## Tech stack

- React 19 with React Router for the UI and routing.
- Vite for the dev server and builds.
- TypeScript across the app.
- SVG for the interactive physics scenes and arrows.
- Firebase Authentication and Cloud Firestore for auth and persistence.
- Vitest, Testing Library, and jsdom for the test suite.

There is no custom server. The "backend" is Firebase: Authentication for
accounts, Cloud Firestore for per-user progress and the friends graph, and
security rules that enforce per-user ownership.

## Architecture overview

The repository is split into two folders.

```
.
├── package.json                Root scripts that delegate into frontend/
├── backend/                    Firebase backend (auth + Firestore config)
│   ├── firebase.json           Firestore config
│   ├── firestore.rules         Per-user security rules
│   ├── firestore.indexes.json  Firestore indexes
│   └── .firebaserc             Firebase project alias
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.ts          Vite and Vitest config
    ├── .env.example            Firebase env var template
    └── src/
        ├── main.tsx            App entry point
        ├── App.tsx             Route definitions
        ├── auth/               Auth context, Google sign-in, protected routes
        ├── components/
        │   ├── lesson/         Lesson player, renderers, physics, scenes, interactions
        │   └── shell/          App shell, top bar, course switcher
        ├── content/            Lesson content model, Coulomb's Law JSON, course map
        ├── lib/                Firebase init and confetti
        ├── pages/              Landing, dashboard, lesson, friends, and auth pages
        ├── progress/           Progress context, Firestore store, dashboard and session progress
        ├── social/             Profiles and friendships (the friends layer)
        └── test/               Vitest setup and lesson test driver
```

A few ideas tie it together:

- **Content is data, not code.** A lesson is a typed JSON document validated by a
  schema, so new lessons can be added without touching the player.
- **The physics is pure and tested.** The sandbox, the numeric checks, and the
  force arrows all read from one small, unit-tested physics module, so they agree
  on the same ground truth.
- **State lives in the cloud.** Progress, XP, streak, and in-lesson position are
  written to a single Firestore document per user, so the account follows the
  learner across devices.

## Getting started

### Prerequisites

- Node.js 20.19 or newer (or 22 or newer).
- A Firebase project with Authentication and Firestore enabled.

### 1. Install dependencies

```bash
cd frontend
npm install
```

### 2. Configure Firebase

In the Firebase console:

1. Create a project.
2. Under Authentication, enable the Email/Password and Google providers.
3. Create a Cloud Firestore database.
4. Copy the web app config values into a new `frontend/.env.local` file using
   `frontend/.env.example` as the template:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

5. Deploy the Firestore security rules. The Firebase config now lives in
   `backend/`, so run Firebase commands from there:

```bash
cd backend
firebase deploy --only firestore
```

### 3. Run the app

From the repository root or from `frontend/`:

```bash
npm run dev
```

The dev server prints a local URL. Open it and create an account to start the
Coulomb's Law lesson.

## Scripts

Run these from the repository root (they delegate to `frontend/`) or from inside
`frontend/`:

- `npm run dev` starts the Vite dev server.
- `npm run build` type-checks and builds the production bundle.
- `npm run preview` serves the production build locally.
- `npm test` runs the Vitest suite.

## Testing

The suite covers the physics math, the content model, the interaction
components, progress and persistence logic, and full lesson walkthroughs driven
by a shared test helper.

```bash
cd frontend
npm test
```

## Deployment

The app is a static Vite build backed by Firebase.

1. Create a Vercel project pointing at this repository.
2. Set the project root directory to `frontend`.
3. Use `npm run build` as the build command and `dist` as the output directory.
4. Add the same `VITE_FIREBASE_*` environment variables in the Vercel project
   settings.
5. Deploy the Firestore rules from `backend/` to the same Firebase project
   (`cd backend && firebase deploy --only firestore`).

## Roadmap

This MVP stops at one lesson on purpose. The natural next steps, in order, are:
more lessons along the Coulomb's Law path (superposition, fields, and so on),
then the AI and learning-science layers that are out of scope for Phase 1.
