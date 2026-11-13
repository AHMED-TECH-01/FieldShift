import { GoogleGenAI } from '@google/genai';
import { SupabaseClient } from '@supabase/supabase-js';
import { FarmerPriorities, WhatIfScenario } from '../src/types';
import { calculateStrategyEvaluations, DEFAULT_PRIORITIES } from './agronomy';
import { logGeminiEvent } from './logger';
import { FarmNasaSummary } from './nasa';
import { DbFarmRecord } from './supabase';

let geminiClient: GoogleGenAI | null = null;
const inFlightAdvisorRequests = new Map<string, Promise<AdvisorResult>>();

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  if (!geminiClient) {
    try {
      geminiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
      logGeminiEvent('GEMINI_CLIENT_INITIALIZED', { sdk: '@google/genai', status: 'ready' });
    } catch (err: any) {
      logGeminiEvent('GEMINI_INIT_ERROR', { error: err?.message });
      return null;
    }
  }
  return geminiClient;
}

export interface AdvisorResult {
  reply: string;
  source: string;
  isFallback: boolean;
  fallbackReason?: string;
  requestId: string;
  latencyMs: number;
  farmId: string;
  groundingSummary: Record<string, unknown>;
}

function isTransientError(err: any): boolean {
  const msg = String(err?.message || '').toLowerCase();
  const status = err?.status || err?.statusCode || err?.response?.status;
  if (status === 429 || status === 500 || status === 503 || status === 504) return true;
  if (
    msg.includes('503') ||
    msg.includes('unavailable') ||
    msg.includes('high demand') ||
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('resource_exhausted') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('econnreset') ||
    msg.includes('fetch failed')
  ) {
    return true;
  }
  return false;
}

export async function runGroundedAdvisor(params: {
  farm: DbFarmRecord;
  prompt: string;
  priorities?: FarmerPriorities;
  scenario?: WhatIfScenario | null;
  nasaSummary: FarmNasaSummary;
  userClient?: SupabaseClient | null;
  userId?: string | null;
}): Promise<AdvisorResult> {
  const { farm, prompt, priorities, scenario, nasaSummary, userClient, userId } = params;
  const effectivePriorities = priorities || DEFAULT_PRIORITIES;
  const requestId = `fs-adv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const startTime = Date.now();

  const evalResult = calculateStrategyEvaluations(farm, effectivePriorities, scenario, nasaSummary);
  const topStrategy = evalResult.strategies[0];

  const dedupKey = `${userId || 'anon'}:${farm.id}:${prompt.trim().toLowerCase()}`;
  const existingPromise = inFlightAdvisorRequests.get(dedupKey);
  if (existingPromise) {
    const cached = await existingPromise;
    return { ...cached, requestId: `${requestId}-dedup` };
  }

  const groundingSummary = {
    farmName: farm.name,
    coordinates: farm.coordinates,
    nasaPowerSynced: nasaSummary.hasPowerData,
    nasaPowerDays: nasaSummary.dailyTimeline.length,
    nasaPowerLatestDate: nasaSummary.powerLatestObservedAt,
    smapLatestGranule: nasaSummary.cmrGranulesByDataset?.smap?.latestGranuleId || null,
    gpmLatestGranule: nasaSummary.cmrGranulesByDataset?.gpm?.latestGranuleId || null,
    modisLatestGranule: nasaSummary.cmrGranulesByDataset?.modis?.latestGranuleId || null,
    ecostressLatestGranule: nasaSummary.cmrGranulesByDataset?.ecostress?.latestGranuleId || null,
    topStrategyCode: topStrategy.code,
    topStrategyScore: topStrategy.score,
    isHypotheticalScenario: Boolean(scenario),
  };

  const systemInstruction = `You are the FieldShift AI Agricultural Advisor, an agronomic decision-support assistant.
Strict Scientific Integrity Rules:
1. ONLY cite numeric NASA, climate, or soil values explicitly provided in the grounded context below. NEVER invent or fabricate satellite measurements (such as SMAP moisture numbers or MODIS NDVI numbers) if the context marks them as not synced or metadata-only.
2. Clearly distinguish between:
   - Real NASA POWER observations (when synced for the parcel's 0.5° grid),
   - NASA Earthdata CMR satellite granule coverage metadata (where HDF5/NetCDF pixel extraction is pending Earthdata Login),
   - Farmer-reported / lab soil records,
   - Deterministic strategy scores, and
   - Hypothetical "What-If" climate scenario inputs.
3. Explicitly list any missing local data (e.g., sub-surface tile maps, local elevator basis bids, unsynced satellite pixel values) and remind the user that this decision support does not replace on-site Certified Crop Advisor (CCA) testing.
4. Keep formatting concise, scannable, with clear markdown headings and bullet points.`;

  const powerBlock = nasaSummary.hasPowerData
    ? `* NASA POWER Daily Agroclimatology (LIVE SYNCED, ${nasaSummary.dailyTimeline.length} days, latest ${nasaSummary.powerLatestObservedAt?.slice(0, 10)}): Mean Air Temp ${nasaSummary.meanTempC}°C (Range ${nasaSummary.minTempC}°C to ${nasaSummary.maxTempC}°C), Cumulative Precipitation ${nasaSummary.precipTotalMm} mm, Mean Relative Humidity ${nasaSummary.meanHumidityPct}%, Mean Solar Flux ${nasaSummary.meanSolarRadiationMj} MJ/m²/day, Accumulated GDD (base 10°C) ${nasaSummary.growingDegreeDaysBase10C}.`
    : '* NASA POWER Daily Agroclimatology: NOT YET SYNCED for this farm in the database (do not invent temperature or precipitation readings).';

  const cmrBlock = ['smap', 'gpm', 'modis', 'ecostress']
    .map((ds) => {
      const info = nasaSummary.cmrGranulesByDataset[ds];
      if (info?.latestGranuleId) {
        return `* ${ds.toUpperCase()} (CMR Granule Metadata Verified): Latest granule ${info.latestGranuleId} (${info.latestTimeStart}); pixel-level numeric extraction pending authenticated Earthdata HDF5 reader.`;
      }
      return `* ${ds.toUpperCase()}: Not yet synced via Earthdata CMR for this farm.`;
    })
    .join('\n');

  const strategyBlock = evalResult.strategies
    .map((s) => `- Strategy ${s.code} (${s.title}): Score ${s.score}% | Sequence: ${s.cropSequence.join(' -> ')}`)
    .join('\n');

  const farmContextString = `
GROUNDED FARM & OBSERVATION CONTEXT:
1. Farmer & Soil Record (User/Lab Data):
   - Farm: ${farm.name} (${farm.location}, coordinates Lon ${farm.coordinates[0]}, Lat ${farm.coordinates[1]})
   - Acreage: ${farm.acreage} acres | Current Crop: ${farm.currentCrop} | Season: ${farm.plantingSeason}
   - Rotation History: ${farm.rotationHistory.join(' -> ') || 'Not specified'}
   - Soil: ${farm.soilType} | pH ${farm.soilPH} | Organic Matter ${farm.organicMatter}% | Drainage: ${farm.drainage}
   - Reported Nutrients: N=${farm.nitrogen}, P=${farm.phosphorus}, K=${farm.potassium} (Last Soil Test: ${farm.lastSoilTest})

2. Persisted NASA Earth Observations:
${powerBlock}
${cmrBlock}

3. Deterministic Crop Rotation Engine Output:
${strategyBlock}
   - Summary: ${evalResult.rankingExplanation}

4. Farmer Priority Weights (1-5 scale):
   ${JSON.stringify(effectivePriorities)}

5. Hypothetical What-If Scenario (Separate from Observed Data):
   ${scenario ? JSON.stringify(scenario) : 'None applied (baseline evaluation)'}
`;

  const buildDeterministicFallback = (fallbackReason: string): string => {
    const lines = [
      `> **FieldShift Deterministic Agronomic Advisory Notice**`,
      `> *Status:* Live Gemini service unavailable (${fallbackReason}). Generated deterministically from persisted farm & NASA records.`,
      ``,
      `### Grounded Assessment for ${farm.name}`,
      ``,
      `#### 1. Observed Baseline & Data Coverage`,
      nasaSummary.hasPowerData
        ? `* **NASA POWER (${nasaSummary.dailyTimeline.length} synced days):** Mean temperature **${nasaSummary.meanTempC}°C**, cumulative precipitation **${nasaSummary.precipTotalMm} mm**, mean solar flux **${nasaSummary.meanSolarRadiationMj} MJ/m²/day**.`
        : `* **NASA POWER:** Not yet synced for this parcel. Run a NASA POWER sync in the NASA Data Explorer to bind parcel-coordinate weather observations.`,
      `* **Soil Profile (Farmer/Lab Record):** ${farm.soilType} at **pH ${farm.soilPH}** with **${farm.organicMatter}% organic matter** and **${farm.drainage}** drainage.`,
      ``,
      `#### 2. Deterministic Rotation Strategy Ranking`,
      ...evalResult.strategies.map(
        (s) => `* **Strategy ${s.code} (${s.title}) — ${s.score}%:** ${s.cropSequence.join(' → ')}`
      ),
      ``,
      `#### 3. Missing Data & Local Validation Checklist`,
      ...evalResult.missingDataNotices.slice(0, 3).map((m) => `* ${m}`),
      `* Always verify seed inoculation, herbicide carryover, and local elevator specs with your Certified Crop Advisor (CCA).`,
    ];
    return lines.join('\n');
  };

  const executeQuery = async (): Promise<AdvisorResult> => {
    const gemini = getGeminiClient();
    const timeoutMs = Number(process.env.GEMINI_TIMEOUT_MS) || 25000;

    if (!gemini) {
      const reason = 'GEMINI_API_KEY not configured';
      logGeminiEvent('GEMINI_CONFIG_NOTICE', { requestId, farmId: farm.id, reason });
      return {
        reply: buildDeterministicFallback(reason),
        source: 'fieldshift-deterministic-engine',
        isFallback: true,
        fallbackReason: reason,
        requestId,
        latencyMs: Date.now() - startTime,
        farmId: farm.id,
        groundingSummary,
      };
    }

    const candidateModels = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];
    let lastError: any = null;

    for (let attempt = 0; attempt < candidateModels.length; attempt++) {
      const model = candidateModels[attempt];
      try {
        logGeminiEvent('GEMINI_REQUEST_START', {
          requestId,
          model,
          attempt: attempt + 1,
          farmId: farm.id,
          hasPowerData: nasaSummary.hasPowerData,
        });

        const generatePromise = gemini.models.generateContent({
          model,
          contents: `${farmContextString}\n\nFarmer Question:\n${prompt}`,
          config: { systemInstruction },
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Gemini API timeout after ${timeoutMs}ms`)), timeoutMs)
        );

        const response = await Promise.race([generatePromise, timeoutPromise]);
        const latencyMs = Date.now() - startTime;
        logGeminiEvent('GEMINI_RESPONSE_SUCCESS', { requestId, model, latencyMs });

        return {
          reply: response.text || buildDeterministicFallback('Empty Gemini response text'),
          source: model,
          isFallback: false,
          requestId,
          latencyMs,
          farmId: farm.id,
          groundingSummary,
        };
      } catch (err: any) {
        lastError = err;
        logGeminiEvent('GEMINI_ERROR', { requestId, model, attempt: attempt + 1, message: err?.message });
        if (attempt < candidateModels.length - 1 && isTransientError(err)) {
          await new Promise((resolve) => setTimeout(resolve, 750));
          continue;
        }
        break;
      }
    }

    const reason = lastError?.message || 'Gemini service temporarily unreachable';
    logGeminiEvent('FALLBACK_ACTIVATION', { requestId, farmId: farm.id, reason });
    return {
      reply: buildDeterministicFallback(reason),
      source: 'fieldshift-deterministic-engine',
      isFallback: true,
      fallbackReason: reason,
      requestId,
      latencyMs: Date.now() - startTime,
      farmId: farm.id,
      groundingSummary,
    };
  };

  const queryPromise = executeQuery();
  inFlightAdvisorRequests.set(dedupKey, queryPromise);

  try {
    const result = await queryPromise;
    // Persist history strictly under authenticated user's RLS client
    if (userClient && userId) {
      const { error: insertErr } = await userClient.from('ai_advisor_history').insert({
        farm_id: farm.id,
        user_id: userId,
        prompt: prompt.trim(),
        reply: result.reply,
        model_source: result.source,
        is_fallback: result.isFallback,
        fallback_reason: result.fallbackReason || null,
        latency_ms: result.latencyMs,
        grounding_summary: result.groundingSummary,
      });
      if (insertErr) {
        logGeminiEvent('AI_HISTORY_PERSIST_ERROR', { farmId: farm.id, error: insertErr.message });
      }
    }
    return result;
  } finally {
    inFlightAdvisorRequests.delete(dedupKey);
  }
}
