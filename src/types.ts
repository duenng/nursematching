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
}
