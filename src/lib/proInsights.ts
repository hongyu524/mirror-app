import { getEmotionEmoji } from './emotions';

export type AnalyzedEvent = {
  startAt?: any;
  primaryEmotion?: string | null;
  emotionIntensity?: number | null;
  contactIds?: string[];
  contactName?: string | null;
};

const asDate = (val: any): Date | null => {
  if (!val) return null;
  if (val?.toDate) return val.toDate();
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export function analyzeEmotionalTrends(events: AnalyzedEvent[]) {
  const now = new Date();
  const thisMonth = monthKey(now);
  const prev = new Date(now);
  prev.setMonth(prev.getMonth() - 1);
  const prevMonth = monthKey(prev);

  let thisCount = 0;
  let prevCount = 0;
  let thisIntensitySum = 0;
  let prevIntensitySum = 0;
  const thisEmotionCount: Record<string, number> = {};
  const prevEmotionCount: Record<string, number> = {};

  events.forEach((e) => {
    const d = asDate(e.startAt);
    if (!d) return;
    const key = monthKey(d);
    const intensity = Number(e.emotionIntensity ?? 0) || 0;
    const emo = e.primaryEmotion || 'unknown';
    if (key === thisMonth) {
      thisCount += 1;
      thisIntensitySum += intensity;
      thisEmotionCount[emo] = (thisEmotionCount[emo] || 0) + 1;
    } else if (key === prevMonth) {
      prevCount += 1;
      prevIntensitySum += intensity;
      prevEmotionCount[emo] = (prevEmotionCount[emo] || 0) + 1;
    }
  });

  const avgThis = thisCount ? thisIntensitySum / thisCount : 0;
  const avgPrev = prevCount ? prevIntensitySum / prevCount : 0;
  const changePct = avgPrev === 0 ? 0 : ((avgThis - avgPrev) / Math.max(0.01, Math.abs(avgPrev))) * 100;

  const dominantEmotion = Object.entries(thisEmotionCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';
  const prevDominantEmotion =
    Object.entries(prevEmotionCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

  return {
    thisMonth: { count: thisCount, avgIntensity: avgThis, dominantEmotion },
    prevMonth: { count: prevCount, avgIntensity: avgPrev, dominantEmotion: prevDominantEmotion },
    changePct,
  };
}

export function analyzeRelationshipImpact(
  events: AnalyzedEvent[],
  contacts: { id: string; name: string }[]
) {
  const contactMap = new Map(contacts.map((c) => [c.id, c.name || 'Unknown']));
  const agg: Record<
    string,
    { name: string; count: number; intensitySum: number; emotionCount: Record<string, number> }
  > = {};

  events.forEach((e) => {
    const cid = e.contactIds?.[0] || 'unknown';
    const name = contactMap.get(cid) || e.contactName || 'Unknown';
    if (!agg[cid]) {
      agg[cid] = { name, count: 0, intensitySum: 0, emotionCount: {} };
    }
    agg[cid].count += 1;
    agg[cid].intensitySum += Number(e.emotionIntensity ?? 0) || 0;
    const emo = e.primaryEmotion || 'unknown';
    agg[cid].emotionCount[emo] = (agg[cid].emotionCount[emo] || 0) + 1;
  });

  const total = Object.values(agg).reduce((sum, v) => sum + v.count, 0) || 1;
  return Object.entries(agg)
    .map(([id, v]) => {
      const dominantEmotion = Object.entries(v.emotionCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';
      return {
        id,
        name: v.name,
        count: v.count,
        share: (v.count / total) * 100,
        avgIntensity: v.count ? v.intensitySum / v.count : 0,
        dominantEmotion,
        dominantEmoji: getEmotionEmoji(dominantEmotion),
      };
    })
    .sort((a, b) => b.count - a.count);
}

export function analyzeEmotionalPhase(events: AnalyzedEvent[]) {
  if (!events.length) return { phase: 'Stable', reason: 'No data yet' };
  const intensities = events
    .map((e) => Number(e.emotionIntensity ?? 0) || 0)
    .filter((n) => !isNaN(n));
  const avg = intensities.reduce((a, b) => a + b, 0) / Math.max(1, intensities.length);
  const variance =
    intensities.reduce((sum, n) => sum + Math.pow(n - avg, 2), 0) / Math.max(1, intensities.length);
  const std = Math.sqrt(variance);

  let phase = 'Stable';
  let reason = 'Intensity is consistent.';

  if (std > 1.2 && avg >= 3) {
    phase = 'Volatile';
    reason = 'High variance with elevated intensity.';
  } else if (std > 1.2 && avg < 3) {
    phase = 'Recovering';
    reason = 'Variance is high but average intensity is lower.';
  } else if (std <= 0.8 && avg < 2) {
    phase = 'Numb';
    reason = 'Low variance and low intensity.';
  } else if (std <= 0.8 && avg >= 3.5) {
    phase = 'Escalating';
    reason = 'Stable but elevated intensity.';
  }

  return { phase, reason, avgIntensity: avg, variance: std };
}

export function generateInsightSummary(opts: {
  trend: ReturnType<typeof analyzeEmotionalTrends>;
  phase: ReturnType<typeof analyzeEmotionalPhase>;
  relationships: ReturnType<typeof analyzeRelationshipImpact>;
}) {
  const lines: string[] = [];
  const { trend, phase, relationships } = opts;

  const intensityDelta = trend.changePct;
  if (Math.abs(intensityDelta) > 10) {
    lines.push(
      `Your intensity is ${intensityDelta > 0 ? 'up' : 'down'} ${Math.abs(intensityDelta).toFixed(
        0
      )}% vs last month.`
    );
  }

  if (trend.thisMonth.dominantEmotion && trend.thisMonth.dominantEmotion !== 'unknown') {
    lines.push(`Dominant emotion this month: ${trend.thisMonth.dominantEmotion}.`);
  }

  if (relationships[0]) {
    lines.push(
      `${relationships[0].name} accounts for ${relationships[0].share.toFixed(
        0
      )}% of your moments with avg intensity ${relationships[0].avgIntensity.toFixed(1)}.`
    );
  }

  lines.push(`Phase: ${phase.phase} — ${phase.reason}`);

  return lines.slice(0, 3);
}
