// ── Row tuple types for type-safe bulk data ─────────────────────────
export type KundeRow = [kundenr: string, kundenavn: string];
export type BrukerRow = [username: string, passwordHash: string, role: string, kundenr: string];
export type VareRow = [varekode: string, varenavn: string, varegruppe: string];
export type OrdreRow = [
  ordrenr: number, dato: string, kundenr: string, kundeordreref: string,
  kunderef: string, firmaid: number, lagernavn: string, valutaid: string, sum: number,
];
export type OrdrelinjeRow = [
  linjenr: number, ordrenr: number, varekode: string, antall: number,
  enhet: string, nettpris: number, linjesum: number, linjestatus: number,
];
export type HenvisningRow = [
  ordrenr: number, linjenr: number, henvisning1: string, henvisning2: string,
  henvisning3: string, henvisning4: string | null, henvisning5: string | null,
];

export interface BulkData {
  kunder: KundeRow[];
  brukere: BrukerRow[];
  varer: VareRow[];
  ordrer: OrdreRow[];
  ordrelinjer: OrdrelinjeRow[];
  henvisninger: HenvisningRow[];
}
