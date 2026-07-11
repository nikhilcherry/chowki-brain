export type Urgency = "low" | "moderate" | "urgent" | "critical";

export type IncidentKind =
  | "injury"
  | "medical"
  | "lost"
  | "wildlife"
  | "weather"
  | "other";

export interface StructuredIncident {
  kind: IncidentKind;
  urgency: Urgency;
  persons: number;
  locationHint: string;
  boothId: string;
  summary: string;
}

export interface HikerCheckin {
  hikerId: string;
  name: string;
  lastCheckin: string;
  expectedCheckin: string;
  route: string;
  groupSize: number;
}

export type BundleKind = "incident" | "checkin" | "status" | "sos";

export interface Bundle {
  bundleId: string;
  kind: BundleKind;
  payload: Record<string, unknown>;
  priority: "low" | "normal" | "high" | "sos";
  originBoothId: string;
}

export type CarrierDirection = "uphill" | "downhill" | "unknown";

export interface CarrierInfo {
  peerId: string;
  direction: CarrierDirection;
  notes: string;
}

export interface TriagePacket {
  k: string;
  u: string;
  p: number;
  loc: string;
  b: string;
}
