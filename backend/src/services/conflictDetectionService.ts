import { query } from '../db/index.js';
import { PriceRule } from '../types/pricing.js';

/**
 * Conflict Detection Service
 * Detects overlapping price rules within the same price list.
 */

export interface RuleConflict {
  conflicting_rule_id: number;
  conflicting_rule: PriceRule;
  overlap_reason: string;
  severity: 'warning' | 'info';
}

interface RuleCandidate {
  price_list_id: number;
  varekode?: string | null;
  varegruppe?: string | null;
  kundenr?: string | null;
  customer_group_id?: number | null;
  min_quantity?: number;
}

/**
 * Check if two scopes match (both null = match, both same value = match)
 */
function scopesMatch(a: string | number | null | undefined, b: string | number | null | undefined): boolean {
  const aNorm = a ?? null;
  const bNorm = b ?? null;
  return aNorm === bNorm;
}

/**
 * Determine the overlap between two rules and produce a human-readable reason.
 */
function analyzeOverlap(candidate: RuleCandidate, existing: PriceRule): { reason: string; severity: 'warning' | 'info' } | null {
  // Must be same price list
  if (candidate.price_list_id !== existing.price_list_id) return null;

  // Check product scope overlap
  const exactProductMatch = scopesMatch(candidate.varekode, existing.varekode)
    && scopesMatch(candidate.varegruppe, existing.varegruppe);

  // One targets specific product, the other targets the group that product belongs to
  const partialProductOverlap =
    (candidate.varekode && !existing.varekode && !existing.varegruppe) ||
    (!candidate.varekode && !candidate.varegruppe && existing.varekode) ||
    (candidate.varegruppe && !existing.varegruppe && !existing.varekode) ||
    (!candidate.varekode && !candidate.varegruppe && existing.varegruppe);

  if (!exactProductMatch && !partialProductOverlap) return null;

  // Check customer scope overlap
  const exactCustomerMatch = scopesMatch(candidate.kundenr, existing.kundenr)
    && scopesMatch(candidate.customer_group_id, existing.customer_group_id);

  const partialCustomerOverlap =
    (candidate.kundenr && !existing.kundenr && !existing.customer_group_id) ||
    (!candidate.kundenr && !candidate.customer_group_id && existing.kundenr) ||
    (candidate.customer_group_id && !existing.customer_group_id && !existing.kundenr) ||
    (!candidate.kundenr && !candidate.customer_group_id && existing.customer_group_id);

  if (!exactCustomerMatch && !partialCustomerOverlap) return null;

  // Build reason
  const isExactDuplicate = exactProductMatch && exactCustomerMatch;

  if (isExactDuplicate) {
    const productDesc = existing.varekode
      ? `varekode "${existing.varekode}"`
      : existing.varegruppe
        ? `varegruppe "${existing.varegruppe}"`
        : 'alle produkter';
    const customerDesc = existing.kundenr
      ? `kunde "${existing.kundenr}"`
      : existing.customer_group_name
        ? `kundegruppe "${existing.customer_group_name}"`
        : 'alle kunder';

    return {
      reason: `Eksakt overlapp: Begge regler dekker ${productDesc} for ${customerDesc} (min. antall: ${existing.min_quantity})`,
      severity: 'warning',
    };
  }

  // Partial overlap
  const parts: string[] = [];
  if (!exactProductMatch) {
    parts.push('delvis overlappende produktomfang');
  }
  if (!exactCustomerMatch) {
    parts.push('delvis overlappende kundeomfang');
  }

  return {
    reason: `Delvis overlapp med regel #${existing.id}: ${parts.join(' og ')}. Den mer spesifikke regelen vil ha prioritet.`,
    severity: 'info',
  };
}

/**
 * Detect conflicts for a candidate rule against existing rules in the same price list.
 * @param candidate - The rule being created or updated
 * @param excludeRuleId - If updating, exclude the rule being updated from conflict check
 */
export async function detectConflicts(
  candidate: RuleCandidate,
  excludeRuleId?: number
): Promise<RuleConflict[]> {
  if (!candidate.price_list_id) return [];

  // Fetch all rules in the same price list
  const result = await query(
    `SELECT pr.*, cg.name as customer_group_name
     FROM price_rule pr
     LEFT JOIN customer_group cg ON pr.customer_group_id = cg.id
     WHERE pr.price_list_id = $1`,
    [candidate.price_list_id]
  );

  const existingRules: PriceRule[] = result.rows;
  const conflicts: RuleConflict[] = [];

  for (const existing of existingRules) {
    // Skip the rule being updated
    if (excludeRuleId && existing.id === excludeRuleId) continue;

    const overlap = analyzeOverlap(candidate, existing);
    if (overlap) {
      conflicts.push({
        conflicting_rule_id: existing.id,
        conflicting_rule: existing,
        overlap_reason: overlap.reason,
        severity: overlap.severity,
      });
    }
  }

  // Sort: warnings first, then info
  conflicts.sort((a, b) => {
    if (a.severity === 'warning' && b.severity === 'info') return -1;
    if (a.severity === 'info' && b.severity === 'warning') return 1;
    return 0;
  });

  return conflicts;
}
