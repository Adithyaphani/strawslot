// Morning briefing for the officer: rule-based by default, written by Claude when an API key is set.
import { buildAlerts, buildStats } from '../lib/engine.js';
import { fmtDate } from '../lib/messages.js';
import { SCHED } from '../lib/constants.js';
import { config } from '../config.js';
import type { Schedule, State } from '../types.js';

interface Inputs {
  state: State;
  sched: Schedule;
  weather: { days: { date: string; rainMm: number }[] };
  fires: { districtCount: number; source: string };
  air: { spots?: { pm25?: number | null }[] };
}

export async function makeBriefing({ state, sched, weather, fires, air }: Inputs) {
  const stats = buildStats(state, sched);
  const alerts = buildAlerts(state, sched);
  const rainDays = weather.days.filter((d) => d.date >= sched.today && d.rainMm >= SCHED.rainStopMm).slice(0, 3).map((d) => d.date);
  const worstBlock = [...stats.byBlock].sort((x, y) => y.atRisk - x.atRisk)[0];
  const top = alerts[0];
  const facts = {
    date: sched.today,
    onTimePct: stats.onTimePct,
    pending: stats.fields.pending,
    atRisk: stats.fields.atRisk,
    highRisk: stats.fields.highRisk,
    utilisationPct: stats.utilisationPct,
    rainDays,
    firesDistrict7d: fires.districtCount,
    firesSource: fires.source,
    worstBlock: worstBlock?.atRisk ? { id: worstBlock.blockId, name: worstBlock.name, atRisk: worstBlock.atRisk } : null,
    topAlert: top ? { fieldId: top.fieldId, village: top.village, acres: top.acres, deadline: top.deadline, code: top.risk.codes[0] || null, reason: top.risk.reasons[0] || null } : null,
    pm25Sangrur: air.spots?.[0]?.pm25 ?? null,
    openIssues: (state.issues || []).filter((i) => i.status === 'open').length,
  };

  const ruleBased = [
    `${facts.onTimePct}% of ${facts.pending} pending fields are scheduled before their sowing deadline; ${facts.atRisk} are at risk (${facts.highRisk} high).`,
    facts.worstBlock ? `Most pressure is in ${facts.worstBlock.name} (${facts.worstBlock.atRisk} at risk). Consider moving a machine there.` : 'No block currently has fields at risk.',
    `Machine utilisation over the next 14 working days is ${facts.utilisationPct}%.`,
    facts.rainDays.length ? `Rain is forecast on ${facts.rainDays.map((d) => fmtDate(d)).join(', ')}; those days are blocked for field work.` : 'No rain stoppages in the forecast.',
    `${facts.firesDistrict7d} fire hotspots in the district over the last 7 days${facts.firesSource === 'sample' ? ' (sample data, add a FIRMS key for live)' : ''}.`,
    facts.openIssues ? `${facts.openIssues} farmer report(s) are waiting for a response.` : null,
    facts.topAlert ? `Top priority: ${facts.topAlert.fieldId} in ${facts.topAlert.village}, ${facts.topAlert.acres} ac, deadline ${fmtDate(facts.topAlert.deadline)}${facts.topAlert.reason ? ` (${facts.topAlert.reason.toLowerCase()})` : ''}.` : null,
  ].filter((x): x is string => Boolean(x));

  if (config.anthropicKey) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': config.anthropicKey, 'anthropic-version': '2023-06-01' },
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify({
          model: config.anthropicModel,
          max_tokens: 400,
          messages: [{ role: 'user', content: `You are the morning briefing assistant for a district crop-residue nodal officer in Punjab, India. Using ONLY these facts (JSON), write 4-6 short bullet points: what needs action today, in plain English, most urgent first. Do not invent numbers.\n\n${JSON.stringify(facts)}` }],
        }),
      });
      const j = (await res.json()) as { content?: { text?: string }[] };
      const text = j.content?.[0]?.text;
      if (text) return { source: 'claude' as const, bullets: text.split('\n').map((s) => s.replace(/^[-*•\s]+/, '').trim()).filter(Boolean), facts };
    } catch { /* fall back to rule-based */ }
  }
  return { source: 'rules' as const, bullets: ruleBased, facts };
}
