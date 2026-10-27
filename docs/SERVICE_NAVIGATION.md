# Hong Kong home-care navigation framework · v0.1

The inspectable prototype rules live in `src/lib/workflow.ts`, independently of a language model. They require professional review before clinical use.

| Input signal                                                                        | Suggested pathway         | Required action                                                                                                               |
| ----------------------------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Chest pain, difficulty breathing, unconsciousness, or Chinese equivalents           | Needs review, urgent flag | Show emergency notice: for an immediate Hong Kong emergency, call 999. Do not use this enquiry form for emergency assessment. |
| TPN, tracheostomy, ventilator, intravenous-care language                            | Needs review              | Qualified professional assesses the case and relevant competencies.                                                           |
| Wounds, glucose, diabetes, insulin, catheter care, blood pressure, nursing requests | Needs review              | Qualified reviewer confirms RN or EN scope, approved tasks and provider competencies.                                         |
| Accompaniment / appointment navigation without a clinical signal                    | Care companion suggestion | Staff confirm the non-clinical scope.                                                                                         |
| Unclear or unrecognised need                                                        | Needs review              | Ask for missing information; preserve the original message.                                                                   |

Rules are ordered; clinical or urgent signals take precedence over accompaniment. No rule automatically approves RN or EN clinical care.

The extractor handles selected English / Traditional Chinese and written Cantonese phrases for age, district, task, days and time. It is not a language model and is not robust general natural-language understanding. Explicit time ranges are retained; morning/afternoon stay qualitative; duration is blank unless supplied. It preserves the original enquiry and follow-up messages. Medical conditions are only recorded when corresponding text is present. The display summary is a deterministic rendering of saved fields.

Publishing requires known patient alias, district, requested care, days, time and duration; consent; an explicit professional category; professional review; family agreement; price confirmation; and company approval. Any pre-publication edits invalidate the four review checks. Public message previews omit patient names, age, contact, address, original text, medical background and instruction notes.

Provider assignment requires verification, communication opt-in, exact professional category, district coverage, matching task competencies, an application with availability confirmation, and no existing visit conflict. This is conservative prototype business logic. Actual professional eligibility must be verified against applicable requirements.

Schedules require an explicit date range, time, duration, days and tasks, plus an acknowledgement that tasks and frequency come from confirmed requirements. Clinical review must be recorded. Proposed schedules become confirmed only after the family-approval control is explicitly checked. Revisions increment the version, record the previous date/time, clear reminder state and require reapproval. Conflicts use half-open time intervals, checking both the client and any assigned provider. Overlapping adjacent visits are allowed only when one finishes before or when another starts.

Simulated reminders require a confirmed visit and confirmed provider assignment. Delivery alone never changes completion state. Explicit provider confirmation records completion and timestamp. Reported issues appear in the activity log for simulated staff follow-up; no notification is sent externally.
