// Shared domain types. The React app imports these too (type-only), so the API
// contract has a single source of truth.

export type Lang = 'en' | 'hi' | 'pa';
export type MachineType = 'super_seeder' | 'happy_seeder' | 'mulcher' | 'baler';
export type StrawPlan = 'in_situ' | 'ex_situ';
export type Preference = StrawPlan | 'any';
export type FieldStatus = 'pending' | 'cleared' | 'burned';
export type ResultStatus = FieldStatus | 'scheduled' | 'at_risk' | 'awaiting_harvest';
export type RiskLevel = 'low' | 'medium' | 'high';
export type ISODate = string; // YYYY-MM-DD

export interface LatLon { lat: number; lon: number }

export interface Block extends LatLon { id: string; name: string }
export interface Village extends LatLon { id: string; name: string; blockId: string }
export interface Tractor { id: string; hp: number }
export interface Chc extends LatLon { id: string; name: string; blockId: string; phone: string; operator?: string; tractors: Tractor[] }
export interface Machine { id: string; chcId: string; type: MachineType; label: string; acresPerDay: number; status: 'active' | 'maintenance' }
export interface Vendor { id: string; name: string; phone: string; destination: string; capacityTonnesPerDay: number }

export interface Field {
  id: string;
  source: 'seed' | 'farmer';
  farmerName: string;
  phone: string;
  language: Lang;
  villageId: string;
  lat: number;
  lon: number;
  acres: number;
  harvestDate: ISODate;
  windowDays: number;
  nextCrop?: string;
  preference: Preference;
  tractor: { owns: boolean; hp: number };
  status: FieldStatus;
  createdAt?: ISODate;
  clearedOn?: ISODate;
  clearedBy?: string;
}

export interface Pin { fieldId: string; machineId: string; fromDate: ISODate; by: string; at: string }
export interface Issue {
  id: string; fieldId: string; phone: string; type: string; note?: string;
  status: 'open' | 'resolved'; createdAt: string; resolvedAt?: string; resolution?: string;
}
export interface LogEntry { at: string; actor: string; action: string; detail: string }

export interface State {
  meta: { anchor: ISODate; seed?: number; generatedAt?: string; district?: string; simulated?: boolean };
  blocks: Block[];
  villages: Village[];
  chcs: Chc[];
  machines: Machine[];
  vendors: Vendor[];
  fields: Field[];
  pins?: Pin[];
  issues?: Issue[];
  log?: LogEntry[];
}

export interface RiskCode { k: 'no_machine' | 'late' | 'buffer' | 'no_tractor' | 'small_tractor' | 'far' | 'fires'; n?: number }
export interface Risk {
  score: number;
  level: RiskLevel;
  reasons: string[];
  codes: RiskCode[];
  parts?: { slack: number; tractor: number; distance: number; fires: number };
}
export interface Assignment { date: ISODate; machineId: string; chcId: string; type: MachineType; acres: number; travelKm: number; tractor: string }
export interface Pickup { date: ISODate; vendorId: string; tonnes: number }

export interface FieldResult {
  id: string;
  status: ResultStatus;
  onTime: boolean;
  deadline: ISODate;
  daysLeft: number;
  start?: ISODate | null;
  completion?: ISODate | null;
  slackDays?: number | null;
  unscheduledAcres?: number;
  assignments: Assignment[];
  pickups: Pickup[];
  risk: Risk;
  nearestChc?: { id: string; km: number } | null;
  village?: string;
  blockId?: string;
  method?: StrawPlan | null;
}

export interface ScheduleDay { date: ISODate; working: boolean; rainMm: number; capacityAcres: number; scheduledAcres: number }
export interface Schedule {
  today: ISODate;
  horizonEnd: ISODate;
  days: ScheduleDay[];
  usage: Record<string, Record<ISODate, number>>;
  results: FieldResult[];
}
export interface ScheduleOptions {
  today: ISODate;
  rain?: Record<ISODate, number>;
  fires?: { lat: number; lon: number; date: ISODate }[];
  horizonDays?: number;
  mode?: 'optimised' | 'baseline';
}

export interface Suggestion {
  kind: 'reassign' | 'switch_method' | 'tractor';
  text: string;
  machineId?: string; machineType?: MachineType; machineNo?: string; chcId?: string; km?: number; fromDate?: ISODate;
}
export interface Alert {
  fieldId: string; farmerName: string; village?: string; blockId?: string; acres: number; deadline: ISODate;
  leadDays: number; risk: Risk; completion?: ISODate | null; unscheduledAcres?: number; assignedMachine?: string | null;
  suggestions: Suggestion[];
}

export interface AdminClaims { sub: string; role: 'officer'; exp: number }
