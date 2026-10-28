export type Page =
  | "Overview"
  | "Care enquiries"
  | "Care requests"
  | "Care schedule"
  | "Care providers"
  | "Messages"
  | "Client records"
  | "Settings";
export type CaseStatus =
  | "Information required"
  | "Under review"
  | "Submitted"
  | "Manual review"
  | "No doctor order"
  | "No first insertion"
  | "Quoted"
  | "Awaiting payment"
  | "Payment expired"
  | "Paid"
  | "Posted"
  | "Matched"
  | "Rematching"
  | "Ready for service"
  | "Full refund"
  | "Partial refund"
  | "Cancelled"
  | "Ready to publish"
  | "Awaiting providers"
  | "Provider confirmed"
  | "Service active"
  | "Completed";
export type Category =
  "Registered nurse" | "Enrolled nurse" | "Care companion" | "Needs review";
export interface Application {
  providerId: string;
  appliedAt: string;
  available: boolean;
  status: "Pending" | "Assigned" | "Not selected";
}
export interface CareCase {
  id: string;
  clientId: string;
  name: string;
  age: string;
  district: string;
  category: Category;
  care: string;
  background: string;
  days: string[];
  time: string;
  duration: string;
  contact: string;
  budget: string;
  notes: string;
  status: CaseStatus;
  original: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  color: string;
  consent: boolean;
  clinicalReviewed: boolean;
  familyAgreed: boolean;
  priceConfirmed: boolean;
  approved: boolean;
  applications: Application[];
  providerId?: string;
  /** Structured v2 enquiry fields. Optional so existing demo records remain readable. */
  gender?: "Male" | "Female";
  building?: string;
  weightKg?: string;
  heightCm?: string;
  mobility?: string;
  recentConditions?: string[];
  doctorOrderStatus?: "Yes" | "No" | "Unsure";
  tubeStatus?: Record<string, "Existing" | "First insertion" | "Unsure">;
  companion?: "Yes" | "No" | "Part of the time";
  services?: ServiceSelection[];
  otherNeedText?: string;
  timeCategory?: "Day" | "Night 10 hours" | "Night 12 hours";
  serviceDates?: string[];
  startTime?: string;
  endTime?: string;
  paymentStatus?: "Not quoted" | "Quoted" | "Awaiting payment" | "Paid" | "Payment expired";
  paymentDeadline?: string;
  quoteTotal?: number;
  packageChoice?: "Single visit" | "30-hour package";
  dispatchStatus?: "Not posted" | "Posted" | "Assigned" | "No provider";
  addressStatus?: "Not requested" | "Requested privately" | "Received";
  remoteTier?: "A" | "B" | "C" | "admin" | "unmatched" | "not_accepting";
  nurseTravelAllowance?: number;
  remoteReviewRequired?: boolean;
  allowanceCancelledBy?: string;
  allowanceCancelReason?: string;
  transportTimeFlag?: string;
  holidayHours?: number;
  holidaySurcharge?: number;
  quoteLines?: QuoteLine[];
  quoteVersion?: number;
  paymentLink?: string;
  paymentLinkSentAt?: string;
  paidAt?: string;
  amountPaid?: number;
  postedAt?: string;
  repostCount?: number;
  noTakerFlag?: boolean;
  assignedAt?: string;
  scheduleStatus?: "Draft" | "Senior nurse reviewed" | "Confirmed";
  scheduleVersion?: number;
  lateFee?: number;
  refundAmount?: number;
  refundStatus?: "Pending" | "Approved" | "Paid";
  cancellationType?: string;
  auditLog?: AuditEntry[];
}
export interface ServiceSelection {
  itemId: string;
  label: string;
  category: "A" | "B" | "C";
  preferredTimes: string[];
  prn: boolean;
  tubeOnly?: boolean;
  doctorOrderRequired?: boolean;
}
export interface QuoteLine {
  date: string;
  category: "Day" | "Night 10 hours" | "Night 12 hours";
  startTime: string;
  endTime: string;
  billableHours: number;
  hourlyRate: number;
  baseAmount: number;
  holidayHours: number;
  holidaySurcharge: number;
  subtotal: number;
}
export interface AuditEntry {
  at: string;
  actor: "System" | "AI" | "Client" | "Yi admin" | "Senior nurse" | "Nurse";
  action: string;
  detail?: string;
}
export interface PackageLedger {
  id: string;
  clientId: string;
  patientRef: string;
  hoursTotal: number;
  hoursUsed: number;
  hoursReserved: number;
  price: number;
  discount: number;
  status: "Pending payment" | "Active" | "Used up" | "Payment expired" | "Refunded";
  paymentDeadline?: string;
  paidAt?: string;
  entries: { at: string; type: string; hours: number; caseId?: string; reason?: string }[];
}
export interface Provider {
  id: string;
  name: string;
  initials: string;
  category: Category;
  verified: boolean;
  registration: string;
  districts: string[];
  skills: string[];
  experience: number;
  available: boolean;
  optIn: boolean;
  color: string;
}
export interface Visit {
  id: string;
  caseId: string;
  date: string;
  time: string;
  duration: number;
  tasks: string;
  providerId?: string;
  status: "Proposed" | "Confirmed" | "Completed" | "Issue reported";
  version: number;
  instructionsConfirmed: boolean;
  reminder: "Not scheduled" | "Scheduled" | "Simulated delivery";
  previousTime?: string;
  completedAt?: string;
  changeRequest?: {
    date: string;
    time: string;
    note: string;
    requestedAt: string;
  };
}
export interface Activity {
  id: string;
  text: string;
  detail: string;
  time: string;
  kind: "case" | "schedule" | "provider" | "message";
}
export interface Message {
  id: string;
  caseId: string;
  content: string;
  createdAt: string;
  type: "Broadcast" | "Reminder";
  status: "Simulated";
}
export interface Store {
  cases: CareCase[];
  providers: Provider[];
  visits: Visit[];
  activities: Activity[];
  messages: Message[];
  packages?: PackageLedger[];
}
