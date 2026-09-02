import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

export interface AIQueryResult {
  success: boolean;
  response?: string;
  error?: string;
  errorType?: 'network' | 'api' | 'validation' | 'unknown';
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