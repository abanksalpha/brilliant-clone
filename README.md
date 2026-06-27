# APT(utor)

**Subject: AP Physics C: Electricity and Magnetism.**

APT(utor) is a learn-by-doing physics tutor modeled on Brilliant. The name is
short for AP Tutor. Instead of videos and multiple-choice trivia, every step
drops you into a problem you can touch. You drag charges, aim force vectors,
build the equation one piece at a time, sort steps, and watch the visual respond
in real time. Each answer gets instant, specific feedback, and the idea is
explained only after you have wrestled with it.

After a lesson you put the idea to work on a problem set you solve by hand on a
whiteboard. An AI grader reads your handwritten work, finds the first place your
reasoning breaks, names the misconception behind it, and explains it in plain
language. Finishing the problem set is what unlocks the next lesson.

**Persona:** a high school student taking AP Physics C: Electricity and
Magnetism (or someone self-studying for the exam) who learns better by doing
than by reading.

Live demo: https://aptutorlearn.vercel.app

## Build phases

This project is built in the order the assignment requires: a working app first,
intelligence second, learning science third.

- **Phase 1 (MVP):** the core learn-by-doing app with hand-built lessons,
  hand-written feedback, persistence, accounts, a course path, and a habit loop.
  No AI.
- **Phase 2 (AI features):** an AI layer added on top of the working MVP. The
  app still teaches with AI turned off; the AI makes it adapt and never run dry.
  This is the current state of the repository.
- **Phase 3 (learning science):** evidence-based techniques layered on the app
  (retrieval practice, spaced repetition, interleaving, mastery learning). Some
  of this is already present (mastery gating and spaced review); the rest is the
  next step.

## Scope: what is real and what is a placeholder

The app shows the shape of a full course, but most of that surface is a mockup.
Please read this before exploring so nothing surprises you.

**Real and fully working:**

- Two complete lessons: Coulomb's Law and Charging, Conductors and Insulators,
  the first two topics in AP Physics C: Electricity and Magnetism, each with its
  handwritten problem set.
- Hands-on interactions, instant hand-written feedback, AI handwriting grading,
  AI hints, AI problem generation, a per-misconception mastery model, progress
  and streaks, accounts, and cross-device persistence (all described below).

**Faux (shown in the UI to convey where the product is headed, but not built):**

- Every later lesson in the course path. The dashboard renders the full College
  Board unit map, but only the two live lessons open. The remaining topics are
  locked placeholder nodes.
- The subject list on the landing page (Math, Biology, Chemistry, Computer
  Science, and the other courses). Only AP Physics C: Electricity and Magnetism
  leads into the product.

In short: two real lessons, in one real subject. Everything wider than that is a
placeholder for a future build.

## The lessons

Each lesson is a short sequence of interactive steps that assume no prior
knowledge. A step introduces an idea, then makes the learner do something with
it, and every answer gets instant feedback. Wrong answers get a short
explanation, not just a red X. The lessons mix several hand-built interaction
types so the learner is always doing something, not reading:

- **Charge sandbox:** drag a point charge around a field and watch the net force
  arrow update live.
- **Vector aim:** rotate a force arrow to the correct direction before the step
  accepts your answer.
- **Build the formula:** drag symbols into place to assemble Coulomb's Law.
- **Numeric input:** type exact answers and ratios with instant checking.
- **Ordering:** reorder steps into the correct sequence.
- **Multiple choice and tap:** quick checks with targeted feedback.
- **Custom guided scenes:** the Charging lesson is a set of bespoke animated
  scenes (sticky balloons, electron mobility, induction, grounding, and more)
  the learner steps through and interacts with.

Every wrong answer gets a short explanation that was written by hand in Phase 1,
never generated.

## Problem sets and the whiteboard

Each lesson is followed by its own problem set on the course path. A problem set
is gray until you finish its lesson, red once it is your active step, and green
when every problem in it is solved. Completing a problem set unlocks the next
lesson.

You solve each problem by hand on a whiteboard: pen and eraser, undo and redo
(toolbar or Cmd+Z and Cmd+Shift+Z), pan and zoom, finger drawing on touch
devices, and a movable, zoomable equation sheet rendered with pdf.js. The work
is graded by the AI grader described next.

## AI features (Phase 2)

The AI layer was chosen to do the things that are hard to hand-author and that
make the course adapt to each learner. Every AI feature reads the lesson and
problem's structured state, not raw text, and answers and rubrics stay on the
server.

- **Grade handwritten reasoning.** A Cloud Function sends the canvas and the
  problem's server-side key to OpenAI, which returns the first conceptual error,
  the named misconception behind it, and a plain-language explanation. The canvas
  circles the offending step and the learner revises until correct. Grading is
  for reasoning, not just the final number.
- **Targeted hints.** Tiered hints read the current canvas and nudge the learner
  toward the next move without handing over the answer.
- **Ask a question.** The learner can ask a free-form question about the current
  problem and get an answer grounded in that problem's state.
- **Generate practice problems.** Template variants and AI-synthesized problems
  keep the post-lesson sets and the anytime practice quiz from ever running dry,
  drawn at the right skill and difficulty.
- **Generate targeted review.** When the mastery model finds a weak spot, the
  backend can synthesize a fresh problem aimed at that specific misconception.

**Grounding and safety.** Generated problems are verified on the server before
they are ever shown, so a fabricated or wrong problem is never used. Answer keys
and the model API key live only in Cloud Functions and never ship to the browser.
There is no fallback by design: if a grade or generation cannot be produced, the
function fails and the UI shows a short, friendly error rather than inventing a
result. Because the MVP teaches without AI, all of this is additive: turn the AI
off and the two lessons still work.

**What we deliberately skipped.** No general-purpose chatbot tutor and no
free-form content generation in the lesson flow. The AI is scoped to grading,
hints, and bounded problem generation, where it can be grounded in structured
state and verified against known answers.

## Mastery and adaptivity

Every graded attempt updates a per-misconception mastery model backed by a
misconception graph. That model powers:

- The post-lesson problem sets at `/problem-set/:lessonId`.
- An anytime practice quiz at `/practice`.
- A spaced review selection that resurfaces weak or decaying concepts sooner.
- A soft mastery gate that surfaces review before moving on when a learner keeps
  missing the same idea.

The current mastery map is viewable at `/mastery`.

## Habit loop and social

- XP per question (10) and per lesson (120), a daily XP goal (500), and a daily
  streak you keep alive by completing a lesson or hitting the XP goal.
- A friends layer: find other learners, send and accept requests, and see where
  your friends are on the course path.

## Persistence and mobile

Progress, XP, streak, in-lesson position, and in-progress handwriting are written
to a single Firestore document per user, so the account follows the learner
across devices. Leave mid-lesson or mid-problem-set and come back to pick up
where you left off, including your handwriting. The layout works on phone-sized
screens with touch input.

## Tech stack

- React 19 with React Router for the UI and routing.
- Vite for the dev server and builds, TypeScript across the app.
- SVG for the interactive physics scenes, and a canvas whiteboard for
  handwriting.
- pdf.js for the in-app, scrollable, zoomable equation sheet.
- Firebase Authentication and Cloud Firestore for auth and persistence.
- Firebase Cloud Functions (TypeScript) calling OpenAI for server-side grading,
  hints, question answering, and problem generation.
- Vitest, Testing Library, and jsdom for the test suite.

## Architecture overview

The repository is split into two folders.

```
.
├── package.json                Root scripts that delegate into frontend/
├── backend/                    Firebase backend (auth, Firestore, functions)
│   ├── firebase.json           Firestore + functions config
│   ├── firestore.rules         Per-user security rules
│   └── functions/              Cloud Functions: OpenAI grading, hints,
│                               question answering, and problem generation
└── frontend/
    ├── index.html
    ├── vite.config.ts          Vite and Vitest config
    ├── .env.example            Firebase env var template
    └── src/
        ├── main.tsx            App entry point
        ├── App.tsx             Route definitions
        ├── auth/               Auth context, Google sign-in, protected routes
        ├── components/
        │   ├── lesson/         Lesson player, renderers, interactions, scenes
        │   ├── problem/        Whiteboard, problem player, equation sheet
        │   └── shell/          App shell, top bar, course switcher
        ├── content/            Lessons, problems, templates, schema, course map
        ├── mastery/            Mastery model, misconception graph, review, gating
        ├── lib/                Firebase init, grading client, confetti
        ├── pages/              Landing, dashboard, lesson, problem set, practice,
        │                       mastery, friends
        ├── progress/           Progress context, Firestore store, session state
        ├── social/             Profiles and friendships (the friends layer)
        └── test/               Vitest setup and test helpers
```

A few ideas tie it together:

- **Content is data, not code.** A lesson is a typed JSON document validated by a
  schema, so new lessons can be added without touching the player, and so AI can
  generate problems into the same shape.
- **The physics is pure and tested.** The sandbox, the numeric checks, and the
  force arrows read from one small, unit-tested physics module, so they agree on
  the same ground truth.
- **Answers stay on the server.** Problem answer keys and the model API key live
  only in Cloud Functions, so nothing about grading or generation ships to the
  browser.
- **State lives in the cloud.** Progress, XP, streak, in-lesson position, and
  in-progress handwriting are written to a single Firestore document per user.

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

5. Deploy the Firestore security rules. The Firebase config lives in `backend/`,
   so run Firebase commands from there:

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
first lesson.

## Scripts

Run these from the repository root (they delegate to `frontend/`) or from inside
`frontend/`:

- `npm run dev` starts the Vite dev server.
- `npm run build` type-checks and builds the production bundle.
- `npm run preview` serves the production build locally.
- `npm test` runs the Vitest suite.

## Testing

The suite covers the physics math, the content model, the interaction
components, the whiteboard geometry, the mastery and gating logic, progress and
persistence, the grading and generation response parsers, and full lesson
walkthroughs.

```bash
cd frontend
npm test
```

The pure logic is covered by Vitest. Live AI quality depends on the model and
must be checked against real handwriting once the OpenAI secret is set and the
functions are deployed.

## Deployment

The app is a static Vite build backed by Firebase.

1. Create a Vercel project pointing at this repository.
2. Set the project root directory to `frontend`.
3. Use `npm run build` as the build command and `dist` as the output directory.
4. Add the same `VITE_FIREBASE_*` environment variables in the Vercel project
   settings.
5. Deploy the Firestore rules and the Cloud Functions from `backend/` to the same
   Firebase project (see AI backend setup below).

## AI backend setup (Firebase Functions and OpenAI)

The AI runs server side so the API key is never shipped to the browser. Cloud
Functions require the Firebase Blaze plan.

1. Put the project on the Firebase Blaze plan.
2. Install function dependencies and set the OpenAI key as a function secret:

```bash
cd backend/functions
npm install
firebase functions:secrets:set OPENAI_API_KEY
```

3. Deploy the functions and the Firestore rules:

```bash
cd backend
firebase deploy --only functions,firestore
```

4. The frontend calls the deployed callables by default. To use the local
   Functions emulator instead, set `VITE_USE_FUNCTIONS_EMULATOR=true` in
   `frontend/.env.local`, build the functions (`cd backend/functions && npm run
   build`), and run the emulator with the key present in
   `backend/functions/.secret.local`.
