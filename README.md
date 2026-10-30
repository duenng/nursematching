# CareKnock

A home-nursing coordination application for Hong Kong. The **staff workspace uses shared server-side SQLite records**, staff authentication, separate clinical and administrative permissions, bank-transfer reconciliation and an email delivery log. The public enquiry form creates records in the same workflow. The patient “My care” preview remains a separate demonstration.

## Run locally

Requires Node.js **22.16+** (built-in SQLite).

```sh
npm install
npm run dev
```

Open the local URL printed in the terminal (normally http://localhost:5173).

The interface defaults to **Traditional Chinese (Hong Kong)**. Use **繁中 / EN** in the patient header, staff toolbar or dialog header to switch languages. The browser remembers your selection across pages and reloads. Switching languages preserves active forms and stored records; original enquiries and user-entered text keep their original language.

The default page is the **patient and family website**. Open [My care](http://localhost:5173/#patient/care) to explore the fictional Mr. Chan journey, or submit a new enquiry to see your own demo request. Patients can review/correct their details, approve proposed visits, request a different time, and leave a question. A requested time stays pending until the staff demo prepares a revised proposal and the patient approves it.

The [staff workspace](http://localhost:5173/#staff) requires staff access. It no longer reads or writes the patient preview's browser records.

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

## Staff workspace

Open `/#staff`. All staff routes are behind the session check. Administrators see overview counts, enquiries, case management, service arrangements, the provider directory, email delivery, client records, ledgers and settings. Senior nurses receive only the clinical worklist and schedule review controls; the API excludes contact, finance and family action links from their worklist.

- **Enquiries:** blank form, recorded consent, server validation, manual routing and quotation. Public submissions at `/#enquire` appear in the same case list.
- **Cases:** families accept quotations through their own email links. Staff independently verify bank receipts before dispatch. Care readiness requires assignment, address confirmation, senior-nurse review and independent administrator approval.
- **Providers:** create real RN/EN records; activating a provider requires a registration number, verification note and explicit confirmation. Changes are audited. Active assignments prevent changing email, category or status until the case is handled.
- **Schedule and clients:** searchable server records, service date/status filters, and patient references grouped within contact email. All displayed times use Hong Kong time.
- **Messages:** distinguish locally saved notifications from SMTP acceptance, failures and restricted recipients. Retry definite failures after fixing the connection; interrupted deliveries remain marked unknown to avoid accidental duplicate sending. Staff cannot use this page to impersonate family or nurse confirmations.
- **Ledgers:** package reservations/deductions and nurse payouts. After transferring a payout in the bank, staff record the exact amount, reference and time separately; the application does not move money.
- **Settings:** configure nurse rates, administrative email and workflow policies. Pricing/policy changes lock during active cases. Connection status and recent audit events are visible. There is no demo reset or simulated payment control.

The workspace refreshes every 30 seconds while visible and when returning to the browser. Mutation results refresh related views. An API failure shows an error and never substitutes demonstration records. Staff records are not stored in browser localStorage.

## Configuration for real operations

`WORKSPACE_MODE=live` is the default. A new live database contains no seeded nurses or cases. Existing experimental records are retained in the database and excluded from the live worklist, finance views and worker. Use a **separate database** for test mode rather than mixing environments.

Public live deployments require `AUTH_MODE=google`, HTTPS, OAuth credentials and separate `STAFF_ADMIN_EMAILS` / `STAFF_SENIOR_NURSE_EMAILS`. Local loopback access is available for development. See [staff login setup](docs/STAFF_LOGIN.md).

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` and `SMTP_FROM` to enable external email. In live mode an empty `TEST_EMAIL_ALLOWLIST` permits real recipients; a populated list restricts delivery. Without SMTP, notifications are saved locally and clearly marked **not delivered**. Verify delivery with controlled accounts before accepting bookings.

Live mode requires `PAYMENT_MODE=bank_transfer` and wall time. Set `BANK_NAME`, `BANK_ACCOUNT_NAME` and `BANK_ACCOUNT_NUMBER`; missing receiving-account details prevent quote acceptance for payment. Staff still check actual bank receipts and perform refunds/payroll transfers themselves.

Use Settings to confirm nurse rates and the administrative follow-up email, then add and verify providers before dispatching cases. Enable arrival/completion confirmation if providers should record service progress by email. The service and holiday catalogue currently covers **2026–2027**; unresolved rules route to manual review. Clinical scope and suitability must be checked by qualified staff.

Mount persistent `/app/data`, run one replica and back up the SQLite database with its WAL consistently (use SQLite backup tooling or stop the server before copying). JSON exports are operational records, not full database recovery backups. Protect backups and the volume because they contain personal data and documents.

## Tests and experimental workflows

`npm run build` checks TypeScript and builds the frontend. `npm run test:workflow` covers the workflow engine and HTTP permission boundaries. `npm test` starts an isolated live-mode backend with SMTP disabled and fictional test submissions; it never uses the deployment database. Set `PLAYWRIGHT_PORT` and `PLAYWRIGHT_API_PORT` if the defaults are already occupied.

Legacy engine experiments require `WORKSPACE_MODE=test`, a separate `WORKFLOW_DB`, and an explicit test payment mode. Test mode restricts SMTP recipients to `TEST_EMAIL_ALLOWLIST`. There is no test-workspace navigation in the staff application. The historical [TRL 3 documentation](docs/TRL3_EMAIL.md) describes those experiments, not a production-readiness certification.

The application organises services and records human decisions. It does not diagnose, prescribe, infer RN/EN clinical scope, or send actual bank transfers. Live SMTP delivery, Google OAuth and bank-account ownership must be verified in the deployed environment.
