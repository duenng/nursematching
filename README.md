# Kindred Care

A responsive, interactive **frontend prototype** for the Hong Kong home-nursing care navigation and coordination platform in the supplied development brief. Built with React, TypeScript and Vite. All profiles and initial records are fictional.

## Run locally

Requires Node.js 22+.

```sh
npm install
npm run dev
```

Open the local URL printed in the terminal (normally http://localhost:5173).

The default page is the **patient and family website**. Open [My care](http://localhost:5173/#patient/care) to explore the fictional Mr. Chan journey, or submit a new enquiry to see your own demo request. Patients can review/correct their details, approve proposed visits, request a different time, and leave a question. A requested time stays pending until the staff demo prepares a revised proposal and the patient approves it.

The [staff demo](http://localhost:5173/#staff) remains available from the link above the patient navigation. Switching views demonstrates roles; it is not authentication.

The public service structure takes inspiration from the user-provided [CARE U elderly-care reference](https://www.careu.com.hk/我們的服務/長者護理/): service descriptions, the enquiry journey and FAQs. Kindred Care uses its own text, illustrations and visual design. CARE U pricing, professional-scope claims and contact information are not used.

The patient homepage follows the supplied visual reference with a centred photographic hero, a welcome section, five photographic service tiles and a care-provider section. It uses a CUHK-inspired purple palette, warm peach accents and larger type. Service tiles reveal further information and open the enquiry flow. Stock photos are illustrative; [image sources](docs/IMAGE_SOURCES.md) are recorded separately.

```sh
npm run build     # Type checking and production build
npm run preview   # Preview the production build
npm test          # Browser workflow tests
```

Local browser tests use installed Google Chrome. On CI, install Chromium with `npx playwright install --with-deps chromium` and set `CI=1`.

## Explore the prototype

1. **Overview** — live counts from browser data, care pipeline, recent requests, daily visits, activity, global search and CSV export.
2. **Care enquiries** — start an English or Traditional Chinese enquiry; use the Cantonese example; inspect extracted fields and unknowns; add follow-up details; make corrections; save to a new or explicitly selected client.
3. **Care requests** — filter cases, edit details, review the original message, record approval checks and prepare an anonymised simulated broadcast. Editing resets approvals. The seeded Mrs. Wong case is useful for testing review and publishing.
4. **Care schedule** — week and list views, client/status filters, date navigation, proposed visits from explicit requirements, conflict checking, family approval, revisions and saved versions.
5. **Care providers** — browse provider profiles, competencies and districts. In a published case, simulate voluntary applications; review eligibility; explicitly confirm assignment. The seeded Mr. Chan case has a pending application.
6. **Messages** — inspect simulated provider broadcasts and reminder previews. A reminder does not mark a task completed. Completion needs an explicit provider-confirmation control.
7. **Client records** — linked case records and CSV reporting. Existing clients are linked by explicit selection, never name similarity.
8. **Settings** — operational status, JSON backup and confirmed reset of demo data.

All visit dates and display times use Hong Kong time. Initial records use the current week. Records persist in `localStorage` in the same browser; reset them in Settings.

## Scope and limits

This is the **frontend-first stage** requested by the user. There is no server, authentication, live AI call or WhatsApp connection. The navigator uses an inspectable rules-based extractor; it is labelled as a demo throughout. Message delivery, registration verification and staff/family/provider roles are simulated. There is no autonomous reminder worker: reminders are explicitly simulated from a confirmed visit. Use fictional information only; browser storage is not an appropriate store for real clinical or identifying data.

The UI organises confirmed tasks. It does not diagnose, prescribe, decide clinical frequency, determine RN/EN scope autonomously, or generate treatment instructions.

See [prototype capabilities](docs/PROTOTYPE.md) and the [service-navigation framework](docs/SERVICE_NAVIGATION.md) for the next integration stage and review rules.
