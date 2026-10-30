# CareKnock

A responsive, interactive **prototype with a server-backed TRL 3 email validation workspace** for the Hong Kong home-nursing care navigation and coordination platform in the supplied development brief. Built with React, TypeScript and Vite. All profiles and initial records are fictional.

## Run locally

Requires Node.js **22.16+** (built-in SQLite).

```sh
npm install
npm run dev
```

Open the local URL printed in the terminal (normally http://localhost:5173).

The interface defaults to **Traditional Chinese (Hong Kong)**. Use **繁中 / EN** in the patient header, staff toolbar or dialog header to switch languages. The browser remembers your selection across pages and reloads. Switching languages preserves active forms and stored records; original enquiries and user-entered text keep their original language.

The default page is the **patient and family website**. Open [My care](http://localhost:5173/#patient/care) to explore the fictional Mr. Chan journey, or submit a new enquiry to see your own demo request. Patients can review/correct their details, approve proposed visits, request a different time, and leave a question. A requested time stays pending until the staff demo prepares a revised proposal and the patient approves it.

The [staff demo](http://localhost:5173/#staff) remains available from the link above the patient navigation. Switching views demonstrates roles; it is not authentication.

The public service structure takes inspiration from the user-provided [CARE U elderly-care reference](https://www.careu.com.hk/我們的服務/長者護理/): service descriptions, the enquiry journey and FAQs. CareKnock uses its own text, illustrations and visual design. CARE U pricing, professional-scope claims and contact information are not used.

The patient homepage follows the supplied visual reference with a centred photographic hero, a welcome section, five photographic service tiles and a care-provider section. It uses a CUHK-inspired purple palette, warm peach accents and larger type. Service tiles reveal further information and open the enquiry flow. Stock photos are illustrative; [image sources](docs/IMAGE_SOURCES.md) are recorded separately.

```sh
npm run build     # Type checking and production build
npm run preview   # Static-only preview; use npm start for email validation
npm test          # Browser workflow tests
npm run test:workflow # Engine and HTTP/concurrency tests
```

Local browser tests use installed Google Chrome. On CI, install Chromium with `npx playwright install --with-deps chromium` and set `CI=1`.

## Deploy with Dokploy (Nixpacks)

The repository includes `nixpacks.toml`. It installs the dependencies, builds
`dist`, and starts the Node workflow/API and static server on `0.0.0.0:3000` by default.

1. Select **Nixpacks** as the application's Build Type, using the repository root.
2. Use Install Command `npm ci --include=dev`, Build Command `npm run build`,
   and Start Command `npm start` if entering overrides in Dokploy. Otherwise the
   checked-in Nixpacks configuration supplies them.
3. Set `PORT=3000`, `BASE_URL=https://api.example.com`, `FRONTEND_URL=https://care.example.com`, and `CORS_ORIGINS=https://care.example.com` in Dokploy. `BASE_URL` is the backend public URL used for OAuth callbacks and email action links. Add [Google staff login settings](docs/STAFF_LOGIN.md) (`AUTH_MODE=google`, client ID/secret and two separate role allowlists). Mount a persistent volume at `/app/data` and run **one replica**. The workflow server rejects a second process opening the same database.
4. In Domains, set Host to `nursematching.duen.ng`, Path and Internal Path to `/`,
   and **Container Port to `3000`**. Leave Strip Path and Custom Entrypoint off.
5. Point DNS to the Dokploy server, configure HTTPS with a valid certificate,
   save, and redeploy after pushing the updated repository to GitHub.

The domain's container port must match `PORT`. A 502 means the proxy could not
get a valid upstream response. Check deployment logs for a successful build and
runtime logs for the workflow server listening on port 3000. Changing only the
Domain port cannot start a stopped container. No Vite development server is
needed for this deployment.

### Separate Cloudflare Pages frontend

Build the repository as a static Vite site on Cloudflare Pages. Use `npm run build` as the build command, `dist` as the output directory, and set this Pages build variable:

```dotenv
VITE_API_BASE_URL=https://api.example.com
```

The backend must set `FRONTEND_URL` and `CORS_ORIGINS` to the exact Pages origin. The frontend sends credentials for staff sessions; when the origins differ the backend sets a `SameSite=None; Secure` cookie. Configure Google Authorized redirect URI as `https://api.example.com/auth/google/callback`. Email action links remain on the backend URL and do not depend on the frontend.

To verify locally:

```sh
npm ci
npm run build
npm start
# Open http://localhost:3000
```

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

The original patient and coordination demos still use browser storage. The new **Email validation / 電郵流程驗證** page, available in the staff sidebar and Settings, uses server-side SQLite, confirmation links, a minute worker and append-only workflow events. These are separate experimental records: original demo cases do not automatically become server cases. All records must be fictional.

Run `npm run dev`, open `/#staff` and select **電郵流程驗證**. Open test settings, confirm experimental nurse rates, and create a fictional enquiry. The test inbox lets you follow customer/nurse links in new tabs. Refresh the workspace after each external confirmation. Without credentials, email is captured locally. Payment uses **manual bank transfer with independent reconciliation**: a customer report never marks a case paid; an administrator verifies the bank receipt before dispatch. Configure team Gmail SMTP in `.env` for external test email; no Stripe account is needed. Families can submit directly at `/#enquire`; individual staff Google login is available with separate administrator and senior-nurse permissions. See [email validation setup and evidence limits](docs/TRL3_EMAIL.md).

No live AI is connected. Care Schedule drafts are generated deterministically from chosen items/times; Google login separates senior-nurse review from administrator approval; local/shared-key rehearsal remains explicitly labelled. The workspace also covers packages, completion/deduction, rematching, cancellation and manual bank-transfer refunds, with explicit experiment-policy switches. Automated tests do not replace Gmail receipt, true 24-hour experiments or formal TRL review.

The UI organises confirmed tasks. It does not diagnose, prescribe, decide clinical frequency, determine RN/EN scope autonomously, or generate treatment instructions.

See [prototype capabilities](docs/PROTOTYPE.md) and the [service-navigation framework](docs/SERVICE_NAVIGATION.md) for the next integration stage and review rules.
