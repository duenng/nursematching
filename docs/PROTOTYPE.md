# Prototype capability map

The October 2026 update adds a separate server-backed **Email validation** workspace for the TRL 3 email experiment. The table below describes the original browser demo; see [TRL 3 email implementation and remaining evidence](TRL3_EMAIL.md) for the new server workflow. WhatsApp API is deferred.

| Capability       | Frontend implementation                                                                                   | Production work remaining                                                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Enquiry intake   | English / Traditional Chinese free text, editable extraction, missing fields, follow-up input             | Replaceable hosted or local model adapter; structured-output validation; representative extraction evaluation            |
| Care navigation  | Versioned, inspectable rules; urgent flag; clinical human-review requirement                              | Professional validation and governance of the care framework                                                             |
| Care requests    | Original enquiry, corrected structured fields, readable summary, approval gates                           | Secure APIs, roles, concurrent review and server enforcement                                                             |
| Scheduling       | Explicit requirements, week/list UI, proposals, conflict checks, family approval, revision versions       | Provider availability calendars, authentication for families, timezone-safe backend scheduling                           |
| Provider records | Fictional RN/EN/companion profiles, districts, skills, demo verification                                  | Verified registration and identity processes, secure consent records                                                     |
| Applications     | Voluntary demo application, timestamp, availability acknowledgement, eligibility checks, staff assignment | Authenticated application links, real provider consent, concurrency controls                                             |
| Case broadcasts  | Minimum-information text preview, copy control, simulated message log                                     | Use the separate email validation workflow; WhatsApp API is deferred                                                     |
| Reminders        | Confirmed-visit simulation; separate delivery and completion; explicit provider response; issue log       | Background scheduler, opt-in, approved templates, messaging-window rules, signed webhooks, retries and real staff alerts |
| CRM              | Browser persistence, explicit repeat-client linking, status/activity timestamps, CSV/JSON export          | PostgreSQL or equivalent, access controls, encryption, audit retention and backup                                        |
| Dashboard        | Derived statistics, activity, search, filters and daily schedule                                          | Live server data and authenticated roles                                                                                 |

## Architecture

`src/pages/Patient.tsx` is the default patient-facing homepage and My care area. `src/PatientModals.tsx` handles patient details, schedule approval, time-change requests and questions. `#staff` opens the original coordination workspace. Patient views filter to the selected demo client, including newly submitted enquiries, and omit directory search, publishing, assignment and provider-completion controls. This is frontend role presentation only; production needs authenticated, server-enforced access.

Patient time changes are stored as pending preferences without moving the current visit. Staff can prepare a revised proposal, which increments the version and requires patient reapproval. Patient corrections to a request reset its approval checks, invalidate uncompleted visit instruction confirmation and pause scheduled reminders pending team review. Questions appear in the browser's staff activity log; nothing is transmitted externally.

`src/types.ts` defines nursing-specific cases, provider applications, visits and events. `src/lib/workflow.ts` contains independently inspectable extraction, navigation, publishing, eligibility, time-conflict and privacy helpers. `src/data.ts` seeds fictional records and persists the workspace in browser localStorage. `src/store.tsx` owns shared state and events. `src/pages/` contains the workspace sections; `src/Modals.tsx` implements review and approval workflows. CSS is responsive and includes reduced-motion support. Dialogs have keyboard dismissal, focus trapping and focus restoration.

The production model can change without changing the case or schedule UI: replace the demo extraction boundary with a validated provider-independent extraction API. Ordinary persistence, messaging, application ordering and reminders should remain deterministic software automation.

The pasted brief ends at “C. Care Schedule Generation with Approval”. This prototype covers the available requirements up to that point. No unseen continuation or referenced architecture image is assumed.
