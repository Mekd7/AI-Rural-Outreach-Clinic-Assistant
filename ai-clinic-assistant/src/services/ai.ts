import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
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

export interface AIQueryResult {
  success: boolean;
  response?: string;
  error?: string;
  errorType?: 'network' | 'api' | 'validation' | 'unknown';
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

/**
 * Validates that the query is not empty or whitespace-only.
 */
function validateQuery(query: string): boolean {
  return query.trim().length > 0;
}

/**
 * Retrieves the Gemini API key from Expo environment variables.
 * Expected environment variable: EXPO_PUBLIC_GEMINI_API_KEY
 */
function getApiKey(): string {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key not configured. Set EXPO_PUBLIC_GEMINI_API_KEY in your environment.');
  }
  return apiKey;
}

/**
 * Determines if an error is a network/connectivity failure.
 */
function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }
  if (error instanceof Error) {
    const networkMessages = [
      'network',
      'connection',
      'timeout',
      'ENOTFOUND',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'fetch failed',
    ];
    const message = error.message.toLowerCase();
    if (networkMessages.some((m) => message.includes(m))) {
      return true;
    }
  }
  return false;
}

/**
 * Clinical guideline query service for Ethiopian clinical guidance.
 *
 * This is a decision-support tool, not an autonomous diagnosis engine.
 * Responses should be verified against official Ethiopian clinical guidelines.
 */
export async function queryEthiopianGuidelines(query: string): Promise<AIQueryResult> {
  // Validate input
  if (!validateQuery(query)) {
    return {
      success: false,
      error: 'Query cannot be empty.',
      errorType: 'validation',
    };
  }

  try {
    const apiKey = getApiKey();
    const genAI = new GoogleGenerativeAI(apiKey);

    // Use gemini-1.5-flash for fast, cost-effective responses
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
      ],
    });

    // System prompt enforcing clinical safety requirements
    const systemPrompt = `You are a clinical decision-support assistant for Ethiopian healthcare workers.
Your role is to provide guideline-based information, NOT to diagnose or prescribe.

STRICT RULES:
1. Answer using Ethiopian clinical guidelines (FMOH, WHO-Ethiopia, Ethiopian Standard Treatment Guidelines) when available.
2. If Ethiopian guidance is unavailable or uncertain, EXPLICITLY STATE THIS.
3. NEVER invent guideline names, citations, drug doses, contraindications, or protocols.
4. NEVER present general medical knowledge as Ethiopian guidance.
5. Provide concise, clinician-oriented responses as a bulleted list when treatment recommendations are given.
6. Always end with: "This is decision support only. Verify against the applicable official Ethiopian guideline before clinical application."

If you cannot find specific Ethiopian guidance for the query, say so clearly.`;

    const fullPrompt = `${systemPrompt}\n\nClinician's question: ${query.trim()}`;

    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const text = response.text();

    if (!text || text.trim().length === 0) {
      return {
        success: false,
        error: 'Empty response from AI service.',
        errorType: 'api',
      };
    }

    return {
      success: true,
      response: text.trim(),
    };
  } catch (error) {
    console.error('AI guideline query failed:', error);

    const errorType = isNetworkError(error) ? 'network' : 'api';
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred.';

    // User-friendly error messages
    let userError: string;
    if (errorType === 'network') {
      userError = 'Network error: Unable to reach the AI service. Check your connection and try again.';
    } else if (errorMessage.includes('API key') || errorMessage.includes('authentication')) {
      userError = 'Configuration error: AI service not properly configured.';
    } else if (errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
      userError = 'Service temporarily unavailable: Rate limit exceeded. Please try again later.';
    } else {
      userError = `AI service error: ${errorMessage}`;
    }

    return {
      success: false,
      error: userError,
      errorType,
    };
  }
}