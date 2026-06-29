# APT(utor)

**Subject: AP Physics C: Electricity and Magnetism.**

APT(utor) is a learn-by-doing physics tutor modeled on Brilliant. The name is
short for AP Tutor. It is built on one stance, taken from the research on how
people actually learn: the experience should stay about as effortful as working
through the physics by hand, and the job of the AI is to make that effort more
effective, not to make studying more enjoyable. So every lesson is a single
guided session where you retrieve what you already know, predict before anything
is explained, read just enough to teach the idea, study worked examples that fade
into your own solving, and then solve real AP-level problems by hand. An AI grader
reads your handwritten work and points to the first place your reasoning breaks.

This repository began as the Phase 1 MVP for the "Build Brilliant" assignment:
one subject, taught deep. It is now the final submission, with the AI layer and
the learning-science layer built on top.

**Persona:** a high school student taking AP Physics C: Electricity and Magnetism
(or someone self-studying for the exam) who learns better by doing than by
reading.

Live demo: https://brilliant-apt.vercel.app

## Build phases

The project was built in the order the assignment requires: a working app first,
intelligence second, learning science third. All three are now realized.

- **Phase 1 (MVP).** The core learn-by-doing app: a guided lesson session, a
  by-hand whiteboard, hand-authored problems and feedback, accounts, a course
  path, progress, and a habit loop. It teaches with the AI turned off.
- **Phase 2 (AI).** A server-side AI layer on top of the MVP: handwriting
  grading that finds the first conceptual error, tiered hints, free-form
  questions about your own work, and on-the-fly problem generation, all grounded
  in structured problem state with answers kept on the server.
- **Phase 3 (learning science).** Evidence-based technique wired through the
  whole loop: predict-before-reveal inquiry, worked-to-faded examples with
  self-explanation, retrieval and generation as the default practice mode,
  spaced and interleaved review composed from your own history, and a headless
  mastery model that targets your weakest, most-decayed misconceptions. The
  design stance and its citations live in
  [`docs/brainlift-effortful-learning.md`](docs/brainlift-effortful-learning.md).

## The lesson loop

Every lesson is a single guided session with five phases. A phase bar tracks
progress along the top, and you can step back to any phase you have already
visited. Each phase is there for a reason grounded in cognitive science (see
[Learning science](#learning-science)).

1. **Review.** Spaced-retrieval problems generated on the fly from your own
   history (a synthesis of all past concepts, the previous lesson, and the one
   before that), each one set to trap the misconceptions you are weakest on,
   solved by hand on the whiteboard. (Lesson 1 seeds this from the mechanics
   prerequisites, since there is nothing yet to review.)
2. **Inquiry.** A quick predict-before-reveal primer: you commit to a guess about
   what a change will do, then watch the answer, before any teaching.
3. **Learn.** One or two concise explanation slides, the only direct instruction
   in the lesson.
4. **Apply.** A worked-to-faded ladder: fully worked examples that fade into
   completion problems where you fill in the remaining steps, each capped by a
   short written self-explanation the AI checks.
5. **Solve.** Independent AP-level problems, part hand-authored and part
   generated for you, solved by hand on the whiteboard and graded by the
   handwriting grader.

Finishing all five phases completes the lesson and unlocks the next one.

## Learning science

This is the heart of the final submission. The app is designed against a single,
defensible claim: durable learning comes from effortful retrieval, generation,
and doing, which feel hard and slow in the moment, while ease and the feeling of
learning are unreliable signals that often run opposite to real learning. The
full argument, with primary sources, is the BrainLift in
[`docs/brainlift-effortful-learning.md`](docs/brainlift-effortful-learning.md);
the synthesis of the underlying research lives in the `/learning-science` skill.

Every design choice below is deliberate, and each maps to that evidence.

- **Predict before reveal (Inquiry).** Each lesson opens by making you commit to
  a guess before anything is taught. Generating an answer, even a wrong one,
  primes the encoding of the real one (the pretesting and generation effects).
- **Explicit instruction, kept small (Learn).** The teaching is direct and
  brief, in small steps, not discovery. For novices, fully guided instruction
  beats minimal-guidance "search," which spends working memory finding an answer
  rather than building a schema.
- **Worked examples that fade (Apply).** You study complete solutions first, then
  fill in completion problems with fewer steps shown, then solve unaided. This is
  the worked-example effect plus deliberate fading as competence grows
  (expertise reversal), the opposite of throwing novices at blank problems.
- **Self-explanation (Apply).** After the steps are revealed, you write why the
  method works and the AI checks it before you continue. Explaining in your own
  words is active processing, not passive copying.
- **Retrieval and doing as the default (Solve, Review).** The bulk of every
  lesson is solving by hand, not watching. Retrieving from memory and producing
  the work yourself encodes far more durably than rereading, and interactive
  doing beats passive reception.
- **Spacing and interleaving (Review).** The Review phase is generated from your
  own past lessons and mixes problem types, so earlier ideas come back after a
  delay and you have to discriminate which method a problem needs. Spaced,
  interleaved practice is among the best-evidenced techniques there is.
- **A forgetting-curve mastery model.** Each misconception has a stored strength
  that decays over time, with a half-life that lengthens every time you get it
  right on a separate day. Review resurfaces the weakest, most-decayed ideas
  first, so you practice exactly what is fading.
- **Effort-preserving AI, by contract.** The grader points to the first broken
  step and names the misconception; hints are tiered and never hand over the
  answer. An assistant that gives answers lifts in-the-moment performance and
  then lowers real learning, while one constrained to hints does not. The
  guardrail is the point.
- **No fun for its own sake.** There is no seductive-detail decoration and no
  points-and-badges layer bolted on to drive engagement, both of which can
  actively depress learning. XP is earned only by solving graded problems (50 XP
  each), so the reward tracks effortful doing rather than clicking through.
- **Measured by what lasts.** Because in-session ease is a poor proxy for
  learning, the gate to the next lesson is mastery of the prior lesson's
  misconceptions across separate days, not merely finishing it once.

## The whiteboard and handwriting grading

You solve the Review, Apply, and Solve problems by hand on a whiteboard: pen and
eraser, undo and redo (with the toolbar or Cmd+Z and Cmd+Shift+Z), pan and zoom,
finger drawing on touch devices, and a movable, zoomable equation sheet.

The work is graded for reasoning, not just the final number, by OpenAI running
inside a Firebase Cloud Function. The model returns the first conceptual error,
the named misconception behind it, and a plain-language explanation; the canvas
circles that step; and you revise until correct. Tiered hints and a free-form
"ask about your work" both read the current canvas.

This path has no fallback by design: if a grade cannot be produced, the function
throws and the UI shows a short, friendly error rather than inventing a result.

## On-the-fly problem generation

The Review and Solve sets are generated per learner so practice never runs dry
and always lands at the right skill, difficulty, and weak spot. Generation runs
in two server-side stages, both grounded in structured state, never free text:

1. **Plan.** One model call proposes a single, mutually distinct description per
   slot (so duplicate problems are impossible by construction), scoped to the
   learner's principles and told the authored problems so it never echoes them.
2. **Generate and verify.** Each description is realized into a problem by one
   subagent, then an independent verifier subagent must agree by a majority of
   re-solves, and a structural gate must pass, with up to four attempts.

Grounding and safety are strict. A generated problem is verified on the server
before it is ever shown, so a fabricated or wrong problem is never used. Answer
keys and the model API key live only in Cloud Functions and never ship to the
browser. There is no template and no fallback: if the planner fails the whole set
offers a retry, and if a single slot fails it shows its own retry and is never
silently substituted.

## The mastery engine (headless)

Every graded attempt updates a per-misconception mastery model and a
misconception graph. A conceptual miss leaves a note; a second matching miss
promotes it to a tracked misconception; catches spread across separate days build
it toward mastery, and stored strength decays between sessions on a forgetting
curve. None of this is exposed as a separate map or page; it runs headless and
drives the spaced Review phase and the generated traps, choosing which earlier
skills and weak spots to bring back. A soft mastery gate uses the same model to
hold the next lesson until the prior lesson's misconceptions are genuinely
mastered. Problem answer keys and the model API key live only in Cloud Functions,
so nothing about grading or the answers ships to the browser.

## Scope: what is real and what is a placeholder

This is an MVP grown into a full first unit, and it is intentionally narrow beyond
that. The app shows the shape of a complete course, but most of that surface is a
mockup.

**Real and fully working:**

- Six complete lessons, in course order, the whole of the first College Board
  unit (Electric Charges, Fields and Gauss's Law) short of its capstone review:
  Coulomb's Law; Charging, Conductors and Insulators; Electric Field and Field
  Lines; Electric Fields of Charge Distributions; Electric Flux; and Gauss's Law.
  Each is a full five-phase session.
- The whiteboard, AI handwriting grading, tiered hints, ask-about-your-work,
  on-the-fly problem generation, the headless misconception and mastery engine,
  the predict-before-reveal inquiry and worked-to-faded scenes, progress and
  streaks, accounts, friends, and cross-device persistence (all described above).

**Faux (shown to convey where the product is headed, but not built):**

- Every later topic in the course path. The dashboard renders the full College
  Board unit map (Electric Potential, Conductors and Capacitors, Circuits,
  Magnetic Fields, Induction, and a final review), but only the six live lessons
  open. The remaining topics are locked placeholder nodes.
- The subject list on the landing page (Math, the other Sciences, Computer
  Science, English, History, and the rest). Only AP Physics C: Electricity and
  Magnetism leads into the product.

## Habit loop and social

- XP earned by solving graded problems (50 XP each, so a full lesson clears the
  goal), a daily XP goal of 500, and a daily streak you keep alive by hitting the
  goal. Clicking through instructional steps earns nothing, on purpose: the
  reward tracks effortful work.
- A friends layer: find other learners, send and accept requests, and see where
  your friends are on the course path.

## Persistence and mobile

Progress, XP, streak, the current lesson phase, the within-phase position, your
in-progress handwriting, and even the generated problem sets and their plans are
written to a single Firestore document per user, so the account follows the
learner across devices. Leave mid-lesson and pick up at the same phase, with the
same generated problems and the same handwriting. The layout works on
phone-sized screens with touch input.

## Features

- A guided five-phase lesson loop (Review, Inquiry, Learn, Apply, Solve) for each
  lesson, built end to end on learning-science evidence and ending in handwritten
  AP-level problems.
- Six complete lessons, where mastering one unlocks the next; later topics are
  shown as locked nodes (placeholders for now).
- AI handwriting grading that finds the first conceptual error, plus tiered hints
  and a free-form question about your own work.
- On-the-fly problem generation (plan, then generate and independently verify)
  that personalizes the Review and Solve sets and never runs dry.
- A whiteboard with pen and eraser, undo and redo, pan and zoom, finger drawing
  on touch devices, and a movable, zoomable equation sheet.
- A headless misconception and mastery engine with a forgetting curve that drives
  the spaced, interleaved Review phase and a soft mastery gate.
- Progress that persists across sessions and devices, stored per user in
  Firestore, including resume into the same phase, problems, and handwriting.
- Accounts with email and password (including email verification) and Google
  sign-in.
- A habit loop where XP is tied to graded problem solving, plus a friends layer.
- Responsive layout that works on phone-sized screens with touch input.

## Tech stack

- React 19 with React Router for the UI and routing.
- Vite for the dev server and builds.
- TypeScript across the app.
- A canvas whiteboard for handwriting, with SVG for the interactive physics
  scenes (charge sandboxes, field probes, flux and Gauss visualizations).
- pdf.js for the in-app, scrollable, zoomable equation sheet.
- Firebase Authentication and Cloud Firestore for auth and persistence.
- Firebase Cloud Functions (TypeScript) calling OpenAI for server-side
  handwriting grading, hints, question answering, self-explanation feedback, and
  two-stage problem generation.
- Vitest, Testing Library, and jsdom for the test suite.

The backend is Firebase: Authentication for accounts, Cloud Firestore for
per-user progress and the friends graph, security rules that enforce per-user
ownership, and Cloud Functions that run the server-side AI so the model API key
and the answer keys are never shipped to the browser.

## Architecture overview

The repository is split into two folders.

```
.
├── package.json                Root scripts that delegate into frontend/
├── docs/                       The BrainLift design stance and the design specs
├── backend/                    Firebase backend (auth, Firestore, functions)
│   ├── firebase.json           Firestore + functions config
│   ├── firestore.rules         Per-user security rules
│   ├── firestore.indexes.json  Firestore indexes
│   ├── .firebaserc             Firebase project alias
│   └── functions/              Cloud Functions: grading, hints, ask, explain
│       └── src/
│           ├── index.ts        Callable entry points
│           ├── openai.ts       Grading, hints, ask, explanation feedback
│           ├── synthesis.ts    Two-stage plan + generate + verify
│           ├── verifyProblem.ts Independent re-solve verifier
│           ├── keyResolver.ts  Resolve a problem id to its server-side key
│           └── problemKeys/    Per-problem answer keys (server only)
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.ts          Vite and Vitest config
    ├── .env.example            Firebase env var template
    └── src/
        ├── main.tsx            App entry point
        ├── App.tsx             Route definitions
        ├── assign/             Review and Solve set composers (spacing, traps)
        ├── auth/               Auth context, Google sign-in, protected routes
        ├── components/
        │   ├── lesson/         Five-phase session, phase bar, slides, scenes
        │   ├── problem/        Whiteboard, problem player, equation sheet
        │   └── shell/          App shell, top bar, course switcher
        ├── content/            Lesson modules, problem bank, schema, course map
        ├── mastery/            Misconception graph, forgetting-curve model, gating
        ├── lib/                Firebase init, grading/generation client, confetti
        ├── pages/              Landing, dashboard, lesson, friends, auth
        ├── progress/           Progress context, Firestore store, session state
        ├── social/             Profiles and friendships (the friends layer)
        └── test/               Vitest setup and the lesson test driver
```

A few ideas tie it together:

- **Content is data, not code.** A lesson is a typed module validated by a schema
  and the problem bank is typed JSON, so new lessons and problems can be added
  without touching the player, and generated problems flow into the same shape.
- **The physics is pure and tested.** The scenes, the numeric checks, and the
  force arrows read from one small, unit-tested physics module, so they agree on
  the same ground truth.
- **The learning-science logic is pure and tested.** The mastery decay, the
  misconception graph, the spaced and interleaved composers, and the gating are
  plain functions that take the current time explicitly, so they are
  deterministic and covered by unit tests rather than hidden behind a clock.
- **Answers stay on the server.** Problem answer keys and the model API key live
  only in Cloud Functions, so nothing about grading or generation ships to the
  browser.
- **State lives in the cloud.** Progress, XP, streak, the current lesson phase,
  in-progress handwriting, and the generated sets are written to a single
  Firestore document per user, so the account follows the learner across devices.

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
first lesson, Coulomb's Law.

### Routes

- `/` landing page
- `/login`, `/signup`, `/verify-email` accounts
- `/dashboard` the course path
- `/lesson/:lessonId` a lesson's five-phase session
- `/friends` the friends layer

## Scripts

Run these from the repository root (they delegate to `frontend/`) or from inside
`frontend/`:

- `npm run dev` starts the Vite dev server.
- `npm run build` type-checks and builds the production bundle.
- `npm run preview` serves the production build locally.
- `npm test` runs the Vitest suite.

## Testing

The suite covers the physics math, the content model and lesson scope, the
five-phase session and its phase components, the whiteboard geometry, the spaced
and interleaved set composers, the misconception graph and the forgetting-curve
mastery and gating logic, progress and persistence, the grading and generation
response parsers, and full lesson walkthroughs driven by a shared test helper. A
separate Vitest suite under `backend/functions` covers the server-side key
resolution, parsing, and the two-stage generation and verification logic.

```bash
cd frontend
npm test
```

The pure logic is covered by Vitest. Live grading and generation quality depend
on the model and must be checked against real handwriting once the secret is set
and the functions are deployed.

## Deployment

The app is a static Vite build backed by Firebase.

1. Create a Vercel project pointing at this repository.
2. Set the project root directory to `frontend`.
3. Use `npm run build` as the build command and `dist` as the output directory.
4. Add the same `VITE_FIREBASE_*` environment variables in the Vercel project
   settings.
5. Deploy the Firestore rules and the Cloud Functions from `backend/` to the same
   Firebase project (`cd backend && firebase deploy --only functions,firestore`).
   See AI backend setup below for the Blaze plan and the OpenAI secret.

## AI backend setup (Firebase Functions and OpenAI)

The AI runs server side so the API key and the answer keys are never shipped to
the browser. Cloud Functions require the Firebase Blaze plan.

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

The pure logic (mastery decay, the set composers, gating, ink segmentation, and
the response parsers) is covered by Vitest. Live grading and generation quality
depend on the model and must be checked against real handwriting once the secret
is set and the functions are deployed.

## Roadmap

This submission ships the entire first unit as full five-phase lessons. The
natural next steps, in order, are the remaining units along the course path, each
as a full five-phase session, then carrying the same learning-science loop
(spaced review, generation, mastery gating) across the whole AP Physics C:
Electricity and Magnetism framework.
