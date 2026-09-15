import ethiopianGuidelines from '@/data/ethiopian_guidelines.json';

export interface LocalGuidelineMatch {
  id: string;
  condition: string;
  category: string;
  clinical_features: string;
  moh_protocol: string;
  urgent_referral_flags: string;
  source: string;
  relevance: number;
}

/**
 * Searches the local Ethiopian guidelines dataset by condition name and keywords.
 * Returns matching entries ranked by relevance — works fully offline.
 */
export function searchEthiopianGuidelines(query: string): LocalGuidelineMatch[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const tokens = q.split(/\s+/).filter((t) => t.length > 1);

  const scored: LocalGuidelineMatch[] = [];

  for (const entry of ethiopianGuidelines as any[]) {
    let score = 0;
    const condLower = entry.condition.toLowerCase();
    const kwLower: string[] = (entry.keywords ?? []).map((k: string) => k.toLowerCase());

    // Exact condition match
    if (condLower === q) {
      score += 100;
    } else if (condLower.includes(q)) {
      score += 60;
    }

    // Token matches in condition name
    for (const t of tokens) {
      if (condLower.includes(t)) score += 15;
    }

    // Keyword matches
    for (const t of tokens) {
      for (const kw of kwLower) {
        if (kw === t) score += 20;
        else if (kw.includes(t)) score += 8;
      }
    }

    // Clinical features (low weight)
    const featLower = (entry.clinical_features ?? '').toLowerCase();
    for (const t of tokens) {
      if (featLower.includes(t)) score += 3;
    }

    if (score > 0) {
      scored.push({
        id: entry.id,
        condition: entry.condition,
        category: entry.category,
        clinical_features: entry.clinical_features,
        moh_protocol: entry.moh_protocol,
        urgent_referral_flags: entry.urgent_referral_flags,
        source: entry.source,
        relevance: score,
      });
    }
  }

  return scored.sort((a, b) => b.relevance - a.relevance).slice(0, 5);
}
