import type { OrderWorkflowStatus } from './notification';

export interface OrderLine {
  linjenr: number;
  ordrenr?: number; // Added from OrderLines.tsx
  varekode: string;
  varenavn?: string; // Optional in OrderLines.tsx
  varegruppe?: string; // from OrderDetail.tsx
  antall: number;
  enhet: string;
  nettpris: number;
  linjesum: number;
  linjestatus: number;
  henvisning1?: string;
  henvisning2?: string;
  henvisning3?: string;
  henvisning4?: string;
  henvisning5?: string;
}

export interface Order {
  ordrenr: number;
  dato: string;
  kundenr: string;
  kundenavn: string;
  firmanavn: string;
  lagernavn: string;
  valutaid: string;
  sum: number;
  kunderef?: string;
  kundeordreref?: string;
  workflow_status?: OrderWorkflowStatus;
  status_updated_at?: string;
}

export interface OrderDetail extends Order {
  firmaid?: number; // found in OrderDetail.tsx
  lines: OrderLine[];
}

export interface Suggestion {
  suggestion: string;
  type: string;
}
