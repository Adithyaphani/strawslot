import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

// Officer console strings: English and Punjabi (the local language of Sangrur district).
const EN = {
  // layout
  nav_overview: 'Overview', nav_alerts: 'Early warnings', nav_dispatch: 'Dispatch board', nav_fields: 'Fields', nav_whatif: 'What-if planner',
  nav_registry: 'Machines & centres', nav_activity: 'Activity log', nav_method: 'Methodology', district: 'Sangrur district',
  officer: 'District Nodal Officer', logout: 'Log out', language: 'Language', retry: 'Retry', loading: 'Loading',
  // login
  login_title: 'Officer login', login_sub: 'Sangrur district console', username: 'Username', password: 'Password', login_btn: 'Log in',
  demo_title: 'Judges and demo access', demo_body: 'Username {u}, password {p}', fill_demo: 'Fill demo login',
  farmer_link: 'Are you a farmer? Book a machine here',
  login_hero: 'Every field in the district, against its own deadline.',
  login_hero_sub: 'See which fields will miss their sowing window a week ahead, move machines between blocks, and track fires and air quality from one screen.',
  login_foot: 'Officer console for district and block crop-residue nodal officers.',
  expired: 'Your session expired. Please log in again.',
  // dashboard
  dash_title: 'District overview', dash_sub: '{d}. Schedule recalculated just now against the live rain forecast and fire activity.',
  export: 'Export schedule', rerun: 'Re-run optimiser', loading_sched: "Running today's schedule",
  kpi_ontime: 'Fields on time', kpi_ontime_note: 'vs {n}% with first-come booking',
  kpi_risk: 'Fields at risk', kpi_risk_note: '{h} high risk, {a} acres',
  kpi_util: 'Machine use, next 14 days', kpi_util_note: '{a} of {t} machines active',
  kpi_straw: 'Straw kept from fire', kpi_straw_note: '{c} t CO₂, {p} kg PM avoided',
  map_title: 'Fields by burn risk', map_sub: '{p} pending, {c} cleared. Click a field to act on it.',
  fires_live: 'FIRMS live: {n} fires, 7 days', fires_sample: 'Fires: sample data',
  layer_pending: 'Pending fields', layer_cleared: 'Cleared fields', layer_chcs: 'Hiring centres', layer_fires: 'Fire hotspots',
  brief_title: "Today's briefing", brief_ai: 'AI summary', brief_auto: 'Auto summary', preparing: 'Preparing…',
  weather_title: 'Field-work weather', weather_live: 'Open-Meteo forecast, Sangrur', weather_fallback: 'Forecast unavailable, assuming dry days',
  no_work: 'No work', wind_note: 'Wind today {n} km/h. Calm days trap smoke near villages.',
  air_title: 'Air right now', air_live: 'PM2.5, Open-Meteo air quality', air_off: 'Air quality feed unavailable',
  load_title: 'Daily machine load', load_sub: 'Acres scheduled vs total machine capacity, next 3 weeks', scheduled: 'Scheduled', capacity: 'Capacity',
  blocks_title: 'Blocks', blocks_sub: 'Where the pressure is', plan_more: 'Plan more machines',
  on_time: 'On time', at_risk: 'At risk', cleared: 'Cleared',
  sim_note: 'Farms, machines and phone numbers are a simulated Sangrur season. Weather, air quality and (with a key) fire hotspots are live.',
  acres_u: 'ac',
  // briefing
  b_ontime: '{p}% of {n} pending fields are scheduled before their sowing deadline; {r} are at risk ({h} high).',
  b_block: 'Most pressure is in {b} ({n} at risk). Consider moving a machine there.', b_noblock: 'No block currently has fields at risk.',
  b_util: 'Machine utilisation over the next 14 working days is {n}%.',
  b_rain: 'Rain is forecast on {d}; those days are blocked for field work.', b_norain: 'No rain stoppages in the forecast.',
  b_fires: '{n} fire hotspots in the district over the last 7 days.', b_fires_sample: '{n} fire hotspots in the district over the last 7 days (sample data, add a FIRMS key for live).',
  b_issues: '{n} farmer report(s) are waiting for a response.', b_top: 'Top priority: {f} in {v}, {a} acres, deadline {d}.',
  // labels
  risk_high: 'High risk', risk_medium: 'Watch', risk_low: 'On track',
  st_scheduled: 'Scheduled', st_awaiting_harvest: 'Booked, awaiting harvest', st_at_risk: 'At risk', st_cleared: 'Cleared', st_burned: 'Burned',
  pref_in_situ: 'Mix into soil', pref_ex_situ: 'Sell as bales', pref_any: 'Either',
  mt_super_seeder: 'Super Seeder', mt_happy_seeder: 'Happy Seeder', mt_mulcher: 'Mulcher + RMB Plough', mt_baler: 'Rake + Baler',
  r_no_machine: 'No machine available before the deadline', r_late: 'Projected {n} day(s) after the sowing deadline', r_buffer: 'Only {n} day(s) of buffer',
  r_no_tractor: 'Farmer has no tractor, needs a CHC tractor', r_small_tractor: 'Own tractor ({n} HP) too small for seeders',
  r_far: 'Nearest CHC is {n} km away', r_fires: '{n} fire hotspot(s) within 5 km this week',
  sg_reassign: 'Assign {m} #{no} from {c} ({km} km), free from {d}', sg_switch: 'Offer baling (ex-situ) so straw is sold instead of burnt',
  sg_tractor: 'Pair with a CHC tractor of 55 HP or more',
  // alerts
  al_title: 'Early warnings', al_sub: 'Fields projected to miss their sowing deadline, with fixes ranked by distance. Acting here re-runs the schedule instantly.',
  al_loading: 'Checking every field against its deadline',
  tab_alerts: 'At-risk fields ({n})', tab_issues: 'Farmer reports ({n})', show: 'Show', all: 'All', high: 'High', watch: 'Watch',
  none_title: 'Every pending field is scheduled before its deadline', none_body: 'New bookings and weather changes are checked each time the schedule runs.',
  days_to: '{n} days to deadline', days_past: '{n} days past', deadline_on: 'Deadline {d}',
  unsched: '{n} acres have no machine before the deadline.', plan_finishes: 'Current plan finishes {d}, after the deadline.',
  apply: 'Apply', autofix: 'Auto-fix', net_change: 'Fields at risk: {a} → {b}', autofix_all: 'Auto-fix district', autofix_all_done: 'Fixed {n} of {t} fields checked. At risk: {a} → {b}', autofix_all_none: 'No fix found that helps without pushing other fields late.', autofix_fail: '{f}: no single machine can finish in time. Try baling or a manual choice.', more_opts: 'Show {n} more machine options', manual: 'Choose machine manually', close: 'Close', open_field: 'Open field',
  fixed_toast: '{f} fixed: machine starts {s}, done {c}', still_short: '{f}: still short. Try the next suggestion.',
  resolved_toast: 'Report marked resolved', no_reports: 'No farmer reports yet', no_reports_body: 'Farmers can report a late machine or changed harvest date from their booking screen.',
  resolve: 'Resolve', resolved: 'Resolved', on_field: 'on {f}, {n}',
  is_machine_late: 'Machine did not come', is_harvest_changed: 'Harvest date changed', is_machine_not_needed: 'No longer needs a machine', is_other: 'Something else',
  // dispatch
  dp_title: 'Dispatch board', dp_sub: 'Each row is a machine, each column a day. Coloured chips are booked fields; the shaded fill shows how much of the day is used. Blue days are blocked by rain.',
  all_centres: 'All hiring centres', csv: 'CSV', machine: 'Machine', tractors_n: '{n} tractor(s) ({hp})', per_day: '{a} ac/day · needs {h} HP',
  maint_on: 'Mark under maintenance', maint_off: 'Return to service', toast_maint: '{m} taken off the road, jobs reshuffled', toast_active: '{m} back in service',
  more_n: '+{n} more', lg_booked: 'Booked, on time (field id, acres)', lg_late: 'Late or high-risk field', lg_share: 'Share of daily capacity used', lg_rain: 'Rain, no field work',
  building: 'Building the dispatch board',
  // fields
  fl_title: 'Fields', fl_sub: '{a} of {b} fields. Phone numbers are masked here; open a field to see contact details.',
  search: 'Search by field id, farmer or village', all_status: 'All statuses', all_blocks: 'All blocks',
  sort_risk: 'Highest risk first', sort_deadline: 'Earliest deadline', sort_acres: 'Largest first', sort_new: 'Newest bookings',
  col_field: 'Field', col_farmer: 'Farmer', col_acres: 'Acres', col_plan: 'Straw plan', col_window: 'Window and slot', col_deadline: 'Deadline', col_status: 'Status', col_risk: 'Risk',
  no_match: 'No fields match', no_match_body: 'Try clearing the search or filters.', page: 'Page {a} of {b}', prev: 'Previous', next: 'Next', cleared_on: 'Cleared {d}',
  // drawer
  field: 'Field', officer_override: 'Officer override', booked_by_farmer: 'Booked by farmer', risk_n: 'Risk {n}', village_line: '{v} village, {a} acres, {p}',
  harvest: 'Harvest', sowing_deadline: 'Sowing deadline', today: 'Today', slot: 'Booked slot', tractor: 'Tractor', tractor_own: 'Own, {n} HP', tractor_none: 'None (needs CHC tractor)',
  nearest: 'Nearest centre', why_score: 'Why this risk score', part_slack: 'slack', part_tractor: 'tractor', part_distance: 'distance', part_fires: 'fires',
  work_plan: 'Work plan', own_tractor: 'own tractor', chc_tractor: 'CHC tractor', pickup_line: 'Straw pickup: {v}, {d}', farmer_sms: 'Farmer SMS', farmer_reports: 'Farmer reports',
  reassign: 'Assign a different machine', remove_override: 'Remove officer override', mark_cleared: 'Mark cleared', mark_burned: 'Mark burned', reopen: 'Reopen field',
  choose_machine: 'Choose a machine', start_after: 'Start no earlier than', assign_btn: 'Assign and reschedule',
  toast_resched: '{f} rescheduled: starts {d}', toast_still: '{f} reassigned, still at risk. Try another machine.', toast_override_removed: 'Override removed, the optimiser decides again',
  toast_cleared: '{f} marked cleared', toast_burned: '{f} marked burned', toast_reopened: '{f} reopened',
  // what-if
  wi_title: 'What-if planner', wi_sub: 'Test a change before you make it: add machines to a hiring centre, repair idle ones or rent tractors, and see how many more fields reach sowing without fire. Nothing is saved.',
  changes: 'Changes to test', centre: 'Hiring centre', count: 'Count', none_added: 'No machines added yet. Add one below, or start from a preset.',
  add_machine: 'Add machine', preset_south: 'Preset: reinforce the south', preset_each: 'Preset: one Super Seeder per centre',
  repair: 'Repair every machine currently under maintenance', rent: 'Rent extra 60 HP tractors for hiring centres', run: 'Run simulation',
  result: 'Result', result_sub: 'Same fields, same weather, same day. Only your changes differ.', result_empty: 'Run a simulation to compare.', result_placeholder: 'Before and after numbers appear here',
  metric: 'Metric', now: 'Now', with_changes: 'With changes', change: 'Change',
  m_ontime: 'Fields on time', m_atrisk: 'Fields at risk', m_acres: 'Acres cleared or booked', m_co2: 'CO₂ kept from fire (t)', m_util: 'Machine use, 14 days', m_machines: 'Active machines',
  // registry
  rg_title: 'Machines & centres', rg_sub: 'Everything the scheduler can assign. Taking a machine off the road reschedules its jobs immediately.',
  tab_machines: 'Machines ({n})', tab_centres: 'Hiring centres ({n})', tab_buyers: 'Straw buyers ({n})',
  col_machine: 'Machine', col_centre: 'Hiring centre', col_capacity: 'Capacity', col_tractor_needed: 'Tractor needed', col_booked: 'Booked, next 14 working days',
  active: 'Active', maintenance: 'Maintenance', machines: 'Machines', tractors_l: 'Tractors', operator: 'Operator', block_suffix: '{b} block',
  col_buyer: 'Straw buyer / aggregator', col_to: 'Takes straw to', col_pickcap: 'Pickup capacity', col_contact: 'Contact',
  toast_machine: '{m} at {c}: {s}', back_service: 'back in service', under_maint: 'under maintenance',
  // activity
  ac_title: 'Activity log', ac_sub: 'Every booking, override and status change, newest first.', reset_btn: 'Reset demo data', reset_q: 'Reset demo data?',
  reset_body: 'This regenerates the simulated Sangrur season around today and removes farmer bookings, reports and overrides made during the demo. It cannot be undone.',
  keep: 'Keep data', reset_done: 'Demo data reset to a fresh season',
  act_register: 'Farmer booked a field', act_issue: 'Farmer reported a problem', act_reassign: 'Machine reassigned', act_unpin: 'Override removed', act_status: 'Field status changed',
  act_machine: 'Machine status changed', act_resolve: 'Report resolved', act_reset: 'Demo data reset', act_seed: 'Season generated', act_reseed: 'Season refreshed',
  rt_now: 'just now', rt_min: '{n} min ago', rt_h: '{n} h ago', rt_d: '{n} d ago',
};

const PA = {
  nav_overview: 'ਸਾਰ', nav_alerts: 'ਅਗਾਊਂ ਚੇਤਾਵਨੀਆਂ', nav_dispatch: 'ਡਿਸਪੈਚ ਬੋਰਡ', nav_fields: 'ਖੇਤ', nav_whatif: 'ਕੀ-ਜੇ ਯੋਜਨਾਕਾਰ',
  nav_registry: 'ਮਸ਼ੀਨਾਂ ਅਤੇ ਕੇਂਦਰ', nav_activity: 'ਗਤੀਵਿਧੀ ਲੌਗ', nav_method: 'ਵਿਧੀ', district: 'ਸੰਗਰੂਰ ਜ਼ਿਲ੍ਹਾ',
  officer: 'ਜ਼ਿਲ੍ਹਾ ਨੋਡਲ ਅਧਿਕਾਰੀ', logout: 'ਲਾਗ ਆਊਟ', language: 'ਭਾਸ਼ਾ', retry: 'ਮੁੜ ਕੋਸ਼ਿਸ਼ ਕਰੋ', loading: 'ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ',
  login_title: 'ਅਧਿਕਾਰੀ ਲਾਗਇਨ', login_sub: 'ਸੰਗਰੂਰ ਜ਼ਿਲ੍ਹਾ ਕੰਸੋਲ', username: 'ਯੂਜ਼ਰਨੇਮ', password: 'ਪਾਸਵਰਡ', login_btn: 'ਲਾਗਇਨ ਕਰੋ',
  demo_title: 'ਜੱਜਾਂ ਅਤੇ ਡੈਮੋ ਲਈ', demo_body: 'ਯੂਜ਼ਰਨੇਮ {u}, ਪਾਸਵਰਡ {p}', fill_demo: 'ਡੈਮੋ ਲਾਗਇਨ ਭਰੋ',
  farmer_link: 'ਕੀ ਤੁਸੀਂ ਕਿਸਾਨ ਹੋ? ਇੱਥੇ ਮਸ਼ੀਨ ਬੁੱਕ ਕਰੋ',
  login_hero: 'ਜ਼ਿਲ੍ਹੇ ਦਾ ਹਰ ਖੇਤ, ਉਸਦੀ ਆਪਣੀ ਆਖਰੀ ਤਰੀਕ ਅਨੁਸਾਰ।',
  login_hero_sub: 'ਇੱਕ ਹਫ਼ਤਾ ਪਹਿਲਾਂ ਦੇਖੋ ਕਿਹੜੇ ਖੇਤ ਬਿਜਾਈ ਤੋਂ ਖੁੰਝ ਜਾਣਗੇ, ਬਲਾਕਾਂ ਵਿਚਕਾਰ ਮਸ਼ੀਨਾਂ ਭੇਜੋ, ਅਤੇ ਅੱਗ ਤੇ ਹਵਾ ਦੀ ਗੁਣਵੱਤਾ ਇੱਕ ਸਕਰੀਨ ਤੇ ਦੇਖੋ।',
  login_foot: 'ਜ਼ਿਲ੍ਹਾ ਅਤੇ ਬਲਾਕ ਫ਼ਸਲ-ਰਹਿੰਦ-ਖੂੰਹਦ ਨੋਡਲ ਅਧਿਕਾਰੀਆਂ ਲਈ ਕੰਸੋਲ।',
  expired: 'ਤੁਹਾਡਾ ਸੈਸ਼ਨ ਖਤਮ ਹੋ ਗਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਲਾਗਇਨ ਕਰੋ।',
  dash_title: 'ਜ਼ਿਲ੍ਹਾ ਸਾਰ', dash_sub: '{d}। ਸਮਾਂ-ਸਾਰਣੀ ਹੁਣੇ ਲਾਈਵ ਮੀਂਹ ਦੀ ਭਵਿੱਖਬਾਣੀ ਅਤੇ ਅੱਗ ਦੀਆਂ ਘਟਨਾਵਾਂ ਅਨੁਸਾਰ ਦੁਬਾਰਾ ਬਣਾਈ ਗਈ।',
  export: 'ਸਮਾਂ-ਸਾਰਣੀ ਡਾਊਨਲੋਡ ਕਰੋ', rerun: 'ਦੁਬਾਰਾ ਗਣਨਾ ਕਰੋ', loading_sched: 'ਅੱਜ ਦੀ ਸਮਾਂ-ਸਾਰਣੀ ਬਣ ਰਹੀ ਹੈ',
  kpi_ontime: 'ਸਮੇਂ ਸਿਰ ਖੇਤ', kpi_ontime_note: 'ਪਹਿਲਾਂ-ਆਓ ਬੁਕਿੰਗ ਨਾਲ {n}% ਦੇ ਮੁਕਾਬਲੇ',
  kpi_risk: 'ਖ਼ਤਰੇ ਵਾਲੇ ਖੇਤ', kpi_risk_note: '{h} ਵੱਧ ਖ਼ਤਰਾ, {a} ਏਕੜ',
  kpi_util: 'ਮਸ਼ੀਨ ਵਰਤੋਂ, ਅਗਲੇ 14 ਦਿਨ', kpi_util_note: '{t} ਵਿੱਚੋਂ {a} ਮਸ਼ੀਨਾਂ ਚਾਲੂ',
  kpi_straw: 'ਅੱਗ ਤੋਂ ਬਚਾਈ ਪਰਾਲੀ', kpi_straw_note: '{c} ਟਨ CO₂, {p} ਕਿਲੋ PM ਤੋਂ ਬਚਾਅ',
  map_title: 'ਸਾੜਨ ਦੇ ਖ਼ਤਰੇ ਅਨੁਸਾਰ ਖੇਤ', map_sub: '{p} ਬਾਕੀ, {c} ਸਾਫ਼। ਕਾਰਵਾਈ ਲਈ ਖੇਤ ਤੇ ਕਲਿੱਕ ਕਰੋ।',
  fires_live: 'FIRMS ਲਾਈਵ: 7 ਦਿਨਾਂ ਵਿੱਚ {n} ਅੱਗਾਂ', fires_sample: 'ਅੱਗ: ਨਮੂਨਾ ਡਾਟਾ',
  layer_pending: 'ਬਾਕੀ ਖੇਤ', layer_cleared: 'ਸਾਫ਼ ਖੇਤ', layer_chcs: 'ਹਾਇਰਿੰਗ ਕੇਂਦਰ', layer_fires: 'ਅੱਗ ਦੇ ਟਿਕਾਣੇ',
  brief_title: 'ਅੱਜ ਦੀ ਜਾਣਕਾਰੀ', brief_ai: 'AI ਸਾਰ', brief_auto: 'ਆਟੋ ਸਾਰ', preparing: 'ਤਿਆਰ ਹੋ ਰਿਹਾ ਹੈ…',
  weather_title: 'ਖੇਤੀ ਕੰਮ ਲਈ ਮੌਸਮ', weather_live: 'Open-Meteo ਭਵਿੱਖਬਾਣੀ, ਸੰਗਰੂਰ', weather_fallback: 'ਭਵਿੱਖਬਾਣੀ ਉਪਲਬਧ ਨਹੀਂ, ਸੁੱਕੇ ਦਿਨ ਮੰਨੇ ਗਏ',
  no_work: 'ਕੰਮ ਨਹੀਂ', wind_note: 'ਅੱਜ ਹਵਾ {n} ਕਿ.ਮੀ./ਘੰਟਾ। ਸ਼ਾਂਤ ਦਿਨਾਂ ਵਿੱਚ ਧੂੰਆਂ ਪਿੰਡਾਂ ਨੇੜੇ ਰੁਕਦਾ ਹੈ।',
  air_title: 'ਹੁਣ ਦੀ ਹਵਾ', air_live: 'PM2.5, Open-Meteo ਹਵਾ ਗੁਣਵੱਤਾ', air_off: 'ਹਵਾ ਗੁਣਵੱਤਾ ਡਾਟਾ ਉਪਲਬਧ ਨਹੀਂ',
  load_title: 'ਰੋਜ਼ਾਨਾ ਮਸ਼ੀਨ ਭਾਰ', load_sub: 'ਅਗਲੇ 3 ਹਫ਼ਤਿਆਂ ਲਈ ਬੁੱਕ ਏਕੜ ਬਨਾਮ ਕੁੱਲ ਮਸ਼ੀਨ ਸਮਰੱਥਾ', scheduled: 'ਬੁੱਕ', capacity: 'ਸਮਰੱਥਾ',
  blocks_title: 'ਬਲਾਕ', blocks_sub: 'ਦਬਾਅ ਕਿੱਥੇ ਹੈ', plan_more: 'ਹੋਰ ਮਸ਼ੀਨਾਂ ਦੀ ਯੋਜਨਾ',
  on_time: 'ਸਮੇਂ ਸਿਰ', at_risk: 'ਖ਼ਤਰੇ ਵਿੱਚ', cleared: 'ਸਾਫ਼',
  sim_note: 'ਖੇਤ, ਮਸ਼ੀਨਾਂ ਅਤੇ ਫ਼ੋਨ ਨੰਬਰ ਸੰਗਰੂਰ ਦੇ ਨਮੂਨਾ ਸੀਜ਼ਨ ਦੇ ਹਨ। ਮੌਸਮ, ਹਵਾ ਗੁਣਵੱਤਾ ਅਤੇ (ਕੁੰਜੀ ਨਾਲ) ਅੱਗ ਦੇ ਟਿਕਾਣੇ ਲਾਈਵ ਹਨ।',
  acres_u: 'ਏਕੜ',
  b_ontime: '{n} ਬਾਕੀ ਖੇਤਾਂ ਵਿੱਚੋਂ {p}% ਬਿਜਾਈ ਦੀ ਆਖਰੀ ਤਰੀਕ ਤੋਂ ਪਹਿਲਾਂ ਬੁੱਕ ਹਨ; {r} ਖ਼ਤਰੇ ਵਿੱਚ ਹਨ ({h} ਵੱਧ ਖ਼ਤਰਾ)।',
  b_block: 'ਸਭ ਤੋਂ ਵੱਧ ਦਬਾਅ {b} ਵਿੱਚ ਹੈ ({n} ਖ਼ਤਰੇ ਵਿੱਚ)। ਉੱਥੇ ਮਸ਼ੀਨ ਭੇਜਣ ਬਾਰੇ ਸੋਚੋ।', b_noblock: 'ਇਸ ਸਮੇਂ ਕਿਸੇ ਬਲਾਕ ਵਿੱਚ ਖ਼ਤਰੇ ਵਾਲੇ ਖੇਤ ਨਹੀਂ ਹਨ।',
  b_util: 'ਅਗਲੇ 14 ਕੰਮਕਾਜੀ ਦਿਨਾਂ ਵਿੱਚ ਮਸ਼ੀਨ ਵਰਤੋਂ {n}% ਹੈ।',
  b_rain: '{d} ਨੂੰ ਮੀਂਹ ਦੀ ਭਵਿੱਖਬਾਣੀ ਹੈ; ਉਹਨਾਂ ਦਿਨਾਂ ਖੇਤੀ ਕੰਮ ਬੰਦ ਰਹੇਗਾ।', b_norain: 'ਭਵਿੱਖਬਾਣੀ ਵਿੱਚ ਮੀਂਹ ਕਾਰਨ ਕੋਈ ਰੁਕਾਵਟ ਨਹੀਂ।',
  b_fires: 'ਪਿਛਲੇ 7 ਦਿਨਾਂ ਵਿੱਚ ਜ਼ਿਲ੍ਹੇ ਵਿੱਚ {n} ਅੱਗ ਦੇ ਟਿਕਾਣੇ।', b_fires_sample: 'ਪਿਛਲੇ 7 ਦਿਨਾਂ ਵਿੱਚ ਜ਼ਿਲ੍ਹੇ ਵਿੱਚ {n} ਅੱਗ ਦੇ ਟਿਕਾਣੇ (ਨਮੂਨਾ ਡਾਟਾ, ਲਾਈਵ ਲਈ FIRMS ਕੁੰਜੀ ਪਾਓ)।',
  b_issues: '{n} ਕਿਸਾਨ ਸ਼ਿਕਾਇਤਾਂ ਜਵਾਬ ਦੀ ਉਡੀਕ ਵਿੱਚ ਹਨ।', b_top: 'ਪਹਿਲੀ ਤਰਜੀਹ: {f}, {v}, {a} ਏਕੜ, ਆਖਰੀ ਤਰੀਕ {d}।',
  risk_high: 'ਵੱਧ ਖ਼ਤਰਾ', risk_medium: 'ਧਿਆਨ ਦਿਓ', risk_low: 'ਠੀਕ',
  st_scheduled: 'ਬੁੱਕ', st_awaiting_harvest: 'ਬੁੱਕ, ਕਟਾਈ ਦੀ ਉਡੀਕ', st_at_risk: 'ਖ਼ਤਰੇ ਵਿੱਚ', st_cleared: 'ਸਾਫ਼', st_burned: 'ਸਾੜਿਆ',
  pref_in_situ: 'ਮਿੱਟੀ ਵਿੱਚ ਮਿਲਾਓ', pref_ex_situ: 'ਗੰਢਾਂ ਵੇਚੋ', pref_any: 'ਕੋਈ ਵੀ',
  mt_super_seeder: 'ਸੁਪਰ ਸੀਡਰ', mt_happy_seeder: 'ਹੈਪੀ ਸੀਡਰ', mt_mulcher: 'ਮਲਚਰ + ਹਲ', mt_baler: 'ਰੇਕ + ਬੇਲਰ',
  r_no_machine: 'ਆਖਰੀ ਤਰੀਕ ਤੋਂ ਪਹਿਲਾਂ ਕੋਈ ਮਸ਼ੀਨ ਉਪਲਬਧ ਨਹੀਂ', r_late: 'ਬਿਜਾਈ ਦੀ ਆਖਰੀ ਤਰੀਕ ਤੋਂ {n} ਦਿਨ ਬਾਅਦ ਪੂਰਾ ਹੋਵੇਗਾ', r_buffer: 'ਸਿਰਫ਼ {n} ਦਿਨ ਦੀ ਗੁੰਜਾਇਸ਼',
  r_no_tractor: 'ਕਿਸਾਨ ਕੋਲ ਟਰੈਕਟਰ ਨਹੀਂ, ਕੇਂਦਰ ਦਾ ਟਰੈਕਟਰ ਚਾਹੀਦਾ ਹੈ', r_small_tractor: 'ਆਪਣਾ ਟਰੈਕਟਰ ({n} HP) ਸੀਡਰ ਲਈ ਛੋਟਾ ਹੈ',
  r_far: 'ਨੇੜਲਾ ਕੇਂਦਰ {n} ਕਿ.ਮੀ. ਦੂਰ ਹੈ', r_fires: 'ਇਸ ਹਫ਼ਤੇ 5 ਕਿ.ਮੀ. ਅੰਦਰ {n} ਅੱਗ ਦੇ ਟਿਕਾਣੇ',
  sg_reassign: '{c} ਤੋਂ {m} #{no} ਭੇਜੋ ({km} ਕਿ.ਮੀ.), {d} ਤੋਂ ਖਾਲੀ', sg_switch: 'ਗੰਢਾਂ ਬਣਾਉਣ ਦੀ ਪੇਸ਼ਕਸ਼ ਕਰੋ ਤਾਂ ਜੋ ਪਰਾਲੀ ਸਾੜਨ ਦੀ ਬਜਾਏ ਵਿਕੇ',
  sg_tractor: 'ਕੇਂਦਰ ਦਾ 55 HP ਜਾਂ ਵੱਧ ਦਾ ਟਰੈਕਟਰ ਨਾਲ ਭੇਜੋ',
  al_title: 'ਅਗਾਊਂ ਚੇਤਾਵਨੀਆਂ', al_sub: 'ਉਹ ਖੇਤ ਜੋ ਬਿਜਾਈ ਦੀ ਆਖਰੀ ਤਰੀਕ ਤੋਂ ਖੁੰਝ ਸਕਦੇ ਹਨ, ਦੂਰੀ ਅਨੁਸਾਰ ਹੱਲਾਂ ਸਮੇਤ। ਇੱਥੇ ਕਾਰਵਾਈ ਕਰਨ ਨਾਲ ਸਮਾਂ-ਸਾਰਣੀ ਤੁਰੰਤ ਦੁਬਾਰਾ ਬਣਦੀ ਹੈ।',
  al_loading: 'ਹਰ ਖੇਤ ਦੀ ਆਖਰੀ ਤਰੀਕ ਜਾਂਚੀ ਜਾ ਰਹੀ ਹੈ',
  tab_alerts: 'ਖ਼ਤਰੇ ਵਾਲੇ ਖੇਤ ({n})', tab_issues: 'ਕਿਸਾਨ ਸ਼ਿਕਾਇਤਾਂ ({n})', show: 'ਦਿਖਾਓ', all: 'ਸਾਰੇ', high: 'ਵੱਧ', watch: 'ਧਿਆਨ ਦਿਓ',
  none_title: 'ਹਰ ਬਾਕੀ ਖੇਤ ਆਖਰੀ ਤਰੀਕ ਤੋਂ ਪਹਿਲਾਂ ਬੁੱਕ ਹੈ', none_body: 'ਹਰ ਵਾਰ ਸਮਾਂ-ਸਾਰਣੀ ਬਣਨ ਤੇ ਨਵੀਆਂ ਬੁਕਿੰਗਾਂ ਅਤੇ ਮੌਸਮ ਦੀ ਜਾਂਚ ਹੁੰਦੀ ਹੈ।',
  days_to: 'ਆਖਰੀ ਤਰੀਕ ਤੱਕ {n} ਦਿਨ', days_past: '{n} ਦਿਨ ਲੰਘ ਗਏ', deadline_on: 'ਆਖਰੀ ਤਰੀਕ {d}',
  unsched: '{n} ਏਕੜ ਲਈ ਆਖਰੀ ਤਰੀਕ ਤੋਂ ਪਹਿਲਾਂ ਕੋਈ ਮਸ਼ੀਨ ਨਹੀਂ।', plan_finishes: 'ਮੌਜੂਦਾ ਯੋਜਨਾ {d} ਨੂੰ ਪੂਰੀ ਹੋਵੇਗੀ, ਆਖਰੀ ਤਰੀਕ ਤੋਂ ਬਾਅਦ।',
  apply: 'ਲਾਗੂ ਕਰੋ', autofix: 'ਆਪੇ ਹੱਲ ਕਰੋ', net_change: 'ਖ਼ਤਰੇ ਵਾਲੇ ਖੇਤ: {a} → {b}', autofix_all: 'ਜ਼ਿਲ੍ਹਾ ਆਪੇ ਹੱਲ ਕਰੋ', autofix_all_done: '{t} ਜਾਂਚੇ ਖੇਤਾਂ ਵਿੱਚੋਂ {n} ਠੀਕ। ਖ਼ਤਰੇ ਵਿੱਚ: {a} → {b}', autofix_all_none: 'ਅਜਿਹਾ ਕੋਈ ਹੱਲ ਨਹੀਂ ਮਿਲਿਆ ਜੋ ਹੋਰ ਖੇਤਾਂ ਨੂੰ ਦੇਰੀ ਵਿੱਚ ਪਾਏ ਬਿਨਾਂ ਮਦਦ ਕਰੇ।', autofix_fail: '{f}: ਕੋਈ ਇੱਕ ਮਸ਼ੀਨ ਸਮੇਂ ਸਿਰ ਕੰਮ ਪੂਰਾ ਨਹੀਂ ਕਰ ਸਕਦੀ। ਗੰਢਾਂ ਜਾਂ ਖੁਦ ਚੋਣ ਅਜ਼ਮਾਓ।', more_opts: '{n} ਹੋਰ ਮਸ਼ੀਨ ਵਿਕਲਪ ਦਿਖਾਓ', manual: 'ਮਸ਼ੀਨ ਖੁਦ ਚੁਣੋ', close: 'ਬੰਦ ਕਰੋ', open_field: 'ਖੇਤ ਖੋਲ੍ਹੋ',
  fixed_toast: '{f} ਠੀਕ: ਮਸ਼ੀਨ {s} ਨੂੰ ਸ਼ੁਰੂ, {c} ਨੂੰ ਪੂਰਾ', still_short: '{f}: ਅਜੇ ਵੀ ਘਾਟ। ਅਗਲਾ ਸੁਝਾਅ ਅਜ਼ਮਾਓ।',
  resolved_toast: 'ਸ਼ਿਕਾਇਤ ਹੱਲ ਕੀਤੀ ਗਈ', no_reports: 'ਅਜੇ ਕੋਈ ਕਿਸਾਨ ਸ਼ਿਕਾਇਤ ਨਹੀਂ', no_reports_body: 'ਕਿਸਾਨ ਆਪਣੀ ਬੁਕਿੰਗ ਸਕਰੀਨ ਤੋਂ ਦੇਰੀ ਵਾਲੀ ਮਸ਼ੀਨ ਜਾਂ ਬਦਲੀ ਕਟਾਈ ਤਰੀਕ ਦੱਸ ਸਕਦੇ ਹਨ।',
  resolve: 'ਹੱਲ ਕਰੋ', resolved: 'ਹੱਲ ਹੋਈ', on_field: '{f}, {n}',
  is_machine_late: 'ਮਸ਼ੀਨ ਨਹੀਂ ਆਈ', is_harvest_changed: 'ਕਟਾਈ ਦੀ ਤਰੀਕ ਬਦਲੀ', is_machine_not_needed: 'ਹੁਣ ਮਸ਼ੀਨ ਦੀ ਲੋੜ ਨਹੀਂ', is_other: 'ਕੁਝ ਹੋਰ',
  dp_title: 'ਡਿਸਪੈਚ ਬੋਰਡ', dp_sub: 'ਹਰ ਕਤਾਰ ਇੱਕ ਮਸ਼ੀਨ, ਹਰ ਕਾਲਮ ਇੱਕ ਦਿਨ। ਰੰਗਦਾਰ ਚਿੱਪ ਬੁੱਕ ਖੇਤ ਹਨ; ਛਾਂ ਦਿਨ ਦੀ ਵਰਤੀ ਸਮਰੱਥਾ ਦਿਖਾਉਂਦੀ ਹੈ। ਨੀਲੇ ਦਿਨ ਮੀਂਹ ਕਾਰਨ ਬੰਦ ਹਨ।',
  all_centres: 'ਸਾਰੇ ਹਾਇਰਿੰਗ ਕੇਂਦਰ', csv: 'CSV', machine: 'ਮਸ਼ੀਨ', tractors_n: '{n} ਟਰੈਕਟਰ ({hp})', per_day: '{a} ਏਕੜ/ਦਿਨ · {h} HP ਲੋੜੀਂਦਾ',
  maint_on: 'ਮੁਰੰਮਤ ਅਧੀਨ ਕਰੋ', maint_off: 'ਮੁੜ ਚਾਲੂ ਕਰੋ', toast_maint: '{m} ਮੁਰੰਮਤ ਲਈ ਰੋਕੀ, ਕੰਮ ਦੁਬਾਰਾ ਵੰਡੇ', toast_active: '{m} ਮੁੜ ਚਾਲੂ',
  more_n: '+{n} ਹੋਰ', lg_booked: 'ਬੁੱਕ, ਸਮੇਂ ਸਿਰ (ਖੇਤ ਨੰਬਰ, ਏਕੜ)', lg_late: 'ਦੇਰੀ ਜਾਂ ਵੱਧ ਖ਼ਤਰੇ ਵਾਲਾ ਖੇਤ', lg_share: 'ਦਿਨ ਦੀ ਵਰਤੀ ਸਮਰੱਥਾ', lg_rain: 'ਮੀਂਹ, ਖੇਤੀ ਕੰਮ ਨਹੀਂ',
  building: 'ਡਿਸਪੈਚ ਬੋਰਡ ਬਣ ਰਿਹਾ ਹੈ',
  fl_title: 'ਖੇਤ', fl_sub: '{b} ਵਿੱਚੋਂ {a} ਖੇਤ। ਇੱਥੇ ਫ਼ੋਨ ਨੰਬਰ ਲੁਕੇ ਹਨ; ਸੰਪਰਕ ਲਈ ਖੇਤ ਖੋਲ੍ਹੋ।',
  search: 'ਖੇਤ ਨੰਬਰ, ਕਿਸਾਨ ਜਾਂ ਪਿੰਡ ਨਾਲ ਖੋਜੋ', all_status: 'ਸਾਰੀਆਂ ਸਥਿਤੀਆਂ', all_blocks: 'ਸਾਰੇ ਬਲਾਕ',
  sort_risk: 'ਵੱਧ ਖ਼ਤਰਾ ਪਹਿਲਾਂ', sort_deadline: 'ਨੇੜਲੀ ਆਖਰੀ ਤਰੀਕ', sort_acres: 'ਵੱਡੇ ਪਹਿਲਾਂ', sort_new: 'ਨਵੀਆਂ ਬੁਕਿੰਗਾਂ',
  col_field: 'ਖੇਤ', col_farmer: 'ਕਿਸਾਨ', col_acres: 'ਏਕੜ', col_plan: 'ਪਰਾਲੀ ਯੋਜਨਾ', col_window: 'ਸਮਾਂ ਅਤੇ ਸਲਾਟ', col_deadline: 'ਆਖਰੀ ਤਰੀਕ', col_status: 'ਸਥਿਤੀ', col_risk: 'ਖ਼ਤਰਾ',
  no_match: 'ਕੋਈ ਖੇਤ ਨਹੀਂ ਮਿਲਿਆ', no_match_body: 'ਖੋਜ ਜਾਂ ਫਿਲਟਰ ਹਟਾ ਕੇ ਦੇਖੋ।', page: 'ਸਫ਼ਾ {a} / {b}', prev: 'ਪਿਛਲਾ', next: 'ਅਗਲਾ', cleared_on: '{d} ਨੂੰ ਸਾਫ਼',
  field: 'ਖੇਤ', officer_override: 'ਅਧਿਕਾਰੀ ਦੀ ਚੋਣ', booked_by_farmer: 'ਕਿਸਾਨ ਵੱਲੋਂ ਬੁੱਕ', risk_n: 'ਖ਼ਤਰਾ {n}', village_line: '{v} ਪਿੰਡ, {a} ਏਕੜ, {p}',
  harvest: 'ਕਟਾਈ', sowing_deadline: 'ਬਿਜਾਈ ਦੀ ਆਖਰੀ ਤਰੀਕ', today: 'ਅੱਜ', slot: 'ਬੁੱਕ ਸਲਾਟ', tractor: 'ਟਰੈਕਟਰ', tractor_own: 'ਆਪਣਾ, {n} HP', tractor_none: 'ਨਹੀਂ (ਕੇਂਦਰ ਦਾ ਟਰੈਕਟਰ ਚਾਹੀਦਾ)',
  nearest: 'ਨੇੜਲਾ ਕੇਂਦਰ', why_score: 'ਇਹ ਖ਼ਤਰਾ ਅੰਕ ਕਿਉਂ', part_slack: 'ਗੁੰਜਾਇਸ਼', part_tractor: 'ਟਰੈਕਟਰ', part_distance: 'ਦੂਰੀ', part_fires: 'ਅੱਗ',
  work_plan: 'ਕੰਮ ਦੀ ਯੋਜਨਾ', own_tractor: 'ਆਪਣਾ ਟਰੈਕਟਰ', chc_tractor: 'ਕੇਂਦਰ ਦਾ ਟਰੈਕਟਰ', pickup_line: 'ਪਰਾਲੀ ਚੁਕਾਈ: {v}, {d}', farmer_sms: 'ਕਿਸਾਨ ਨੂੰ SMS', farmer_reports: 'ਕਿਸਾਨ ਸ਼ਿਕਾਇਤਾਂ',
  reassign: 'ਹੋਰ ਮਸ਼ੀਨ ਭੇਜੋ', remove_override: 'ਅਧਿਕਾਰੀ ਦੀ ਚੋਣ ਹਟਾਓ', mark_cleared: 'ਸਾਫ਼ ਦਰਜ ਕਰੋ', mark_burned: 'ਸਾੜਿਆ ਦਰਜ ਕਰੋ', reopen: 'ਖੇਤ ਮੁੜ ਖੋਲ੍ਹੋ',
  choose_machine: 'ਮਸ਼ੀਨ ਚੁਣੋ', start_after: 'ਇਸ ਤਰੀਕ ਤੋਂ ਪਹਿਲਾਂ ਨਹੀਂ', assign_btn: 'ਭੇਜੋ ਅਤੇ ਸਮਾਂ-ਸਾਰਣੀ ਬਦਲੋ',
  toast_resched: '{f} ਦੁਬਾਰਾ ਬੁੱਕ: {d} ਨੂੰ ਸ਼ੁਰੂ', toast_still: '{f} ਨੂੰ ਮਸ਼ੀਨ ਭੇਜੀ, ਅਜੇ ਵੀ ਖ਼ਤਰੇ ਵਿੱਚ। ਹੋਰ ਮਸ਼ੀਨ ਅਜ਼ਮਾਓ।', toast_override_removed: 'ਚੋਣ ਹਟਾਈ, ਹੁਣ ਸਿਸਟਮ ਫ਼ੈਸਲਾ ਕਰੇਗਾ',
  toast_cleared: '{f} ਸਾਫ਼ ਦਰਜ', toast_burned: '{f} ਸਾੜਿਆ ਦਰਜ', toast_reopened: '{f} ਮੁੜ ਖੋਲ੍ਹਿਆ',
  wi_title: 'ਕੀ-ਜੇ ਯੋਜਨਾਕਾਰ', wi_sub: 'ਫ਼ੈਸਲੇ ਤੋਂ ਪਹਿਲਾਂ ਜਾਂਚੋ: ਕੇਂਦਰ ਵਿੱਚ ਮਸ਼ੀਨਾਂ ਜੋੜੋ, ਖੜ੍ਹੀਆਂ ਮਸ਼ੀਨਾਂ ਠੀਕ ਕਰੋ ਜਾਂ ਟਰੈਕਟਰ ਕਿਰਾਏ ਤੇ ਲਓ, ਅਤੇ ਦੇਖੋ ਕਿੰਨੇ ਹੋਰ ਖੇਤ ਬਿਨਾਂ ਅੱਗ ਬੀਜੇ ਜਾਣਗੇ। ਕੁਝ ਵੀ ਸੇਵ ਨਹੀਂ ਹੁੰਦਾ।',
  changes: 'ਜਾਂਚਣ ਲਈ ਬਦਲਾਅ', centre: 'ਹਾਇਰਿੰਗ ਕੇਂਦਰ', count: 'ਗਿਣਤੀ', none_added: 'ਅਜੇ ਕੋਈ ਮਸ਼ੀਨ ਨਹੀਂ ਜੋੜੀ। ਹੇਠਾਂ ਜੋੜੋ ਜਾਂ ਤਿਆਰ ਵਿਕਲਪ ਚੁਣੋ।',
  add_machine: 'ਮਸ਼ੀਨ ਜੋੜੋ', preset_south: 'ਤਿਆਰ ਵਿਕਲਪ: ਦੱਖਣ ਨੂੰ ਮਜ਼ਬੂਤ ਕਰੋ', preset_each: 'ਤਿਆਰ ਵਿਕਲਪ: ਹਰ ਕੇਂਦਰ ਨੂੰ ਇੱਕ ਸੁਪਰ ਸੀਡਰ',
  repair: 'ਮੁਰੰਮਤ ਅਧੀਨ ਸਾਰੀਆਂ ਮਸ਼ੀਨਾਂ ਠੀਕ ਕਰੋ', rent: 'ਕੇਂਦਰਾਂ ਲਈ 60 HP ਦੇ ਵਾਧੂ ਟਰੈਕਟਰ ਕਿਰਾਏ ਤੇ', run: 'ਜਾਂਚ ਚਲਾਓ',
  result: 'ਨਤੀਜਾ', result_sub: 'ਉਹੀ ਖੇਤ, ਉਹੀ ਮੌਸਮ, ਉਹੀ ਦਿਨ। ਸਿਰਫ਼ ਤੁਹਾਡੇ ਬਦਲਾਅ ਵੱਖਰੇ ਹਨ।', result_empty: 'ਤੁਲਨਾ ਲਈ ਜਾਂਚ ਚਲਾਓ।', result_placeholder: 'ਪਹਿਲਾਂ ਅਤੇ ਬਾਅਦ ਦੇ ਅੰਕ ਇੱਥੇ ਦਿਸਣਗੇ',
  metric: 'ਮਾਪ', now: 'ਹੁਣ', with_changes: 'ਬਦਲਾਅ ਨਾਲ', change: 'ਫ਼ਰਕ',
  m_ontime: 'ਸਮੇਂ ਸਿਰ ਖੇਤ', m_atrisk: 'ਖ਼ਤਰੇ ਵਾਲੇ ਖੇਤ', m_acres: 'ਸਾਫ਼ ਜਾਂ ਬੁੱਕ ਏਕੜ', m_co2: 'ਅੱਗ ਤੋਂ ਬਚਿਆ CO₂ (ਟਨ)', m_util: 'ਮਸ਼ੀਨ ਵਰਤੋਂ, 14 ਦਿਨ', m_machines: 'ਚਾਲੂ ਮਸ਼ੀਨਾਂ',
  rg_title: 'ਮਸ਼ੀਨਾਂ ਅਤੇ ਕੇਂਦਰ', rg_sub: 'ਸਾਰੀਆਂ ਮਸ਼ੀਨਾਂ ਜੋ ਸਿਸਟਮ ਭੇਜ ਸਕਦਾ ਹੈ। ਮਸ਼ੀਨ ਰੋਕਣ ਨਾਲ ਉਸਦੇ ਕੰਮ ਤੁਰੰਤ ਦੁਬਾਰਾ ਵੰਡੇ ਜਾਂਦੇ ਹਨ।',
  tab_machines: 'ਮਸ਼ੀਨਾਂ ({n})', tab_centres: 'ਹਾਇਰਿੰਗ ਕੇਂਦਰ ({n})', tab_buyers: 'ਪਰਾਲੀ ਖਰੀਦਦਾਰ ({n})',
  col_machine: 'ਮਸ਼ੀਨ', col_centre: 'ਹਾਇਰਿੰਗ ਕੇਂਦਰ', col_capacity: 'ਸਮਰੱਥਾ', col_tractor_needed: 'ਲੋੜੀਂਦਾ ਟਰੈਕਟਰ', col_booked: 'ਬੁੱਕ, ਅਗਲੇ 14 ਕੰਮਕਾਜੀ ਦਿਨ',
  active: 'ਚਾਲੂ', maintenance: 'ਮੁਰੰਮਤ', machines: 'ਮਸ਼ੀਨਾਂ', tractors_l: 'ਟਰੈਕਟਰ', operator: 'ਸੰਚਾਲਕ', block_suffix: '{b} ਬਲਾਕ',
  col_buyer: 'ਪਰਾਲੀ ਖਰੀਦਦਾਰ / ਐਗਰੀਗੇਟਰ', col_to: 'ਪਰਾਲੀ ਕਿੱਥੇ ਜਾਂਦੀ ਹੈ', col_pickcap: 'ਚੁਕਾਈ ਸਮਰੱਥਾ', col_contact: 'ਸੰਪਰਕ',
  toast_machine: '{c} ਦੀ {m}: {s}', back_service: 'ਮੁੜ ਚਾਲੂ', under_maint: 'ਮੁਰੰਮਤ ਅਧੀਨ',
  ac_title: 'ਗਤੀਵਿਧੀ ਲੌਗ', ac_sub: 'ਹਰ ਬੁਕਿੰਗ, ਚੋਣ ਅਤੇ ਸਥਿਤੀ ਬਦਲਾਅ, ਨਵੇਂ ਪਹਿਲਾਂ।', reset_btn: 'ਡੈਮੋ ਡਾਟਾ ਰੀਸੈੱਟ ਕਰੋ', reset_q: 'ਡੈਮੋ ਡਾਟਾ ਰੀਸੈੱਟ ਕਰਨਾ ਹੈ?',
  reset_body: 'ਇਹ ਅੱਜ ਦੇ ਆਲੇ-ਦੁਆਲੇ ਨਵਾਂ ਨਮੂਨਾ ਸੀਜ਼ਨ ਬਣਾਉਂਦਾ ਹੈ ਅਤੇ ਡੈਮੋ ਦੌਰਾਨ ਕੀਤੀਆਂ ਬੁਕਿੰਗਾਂ, ਸ਼ਿਕਾਇਤਾਂ ਅਤੇ ਚੋਣਾਂ ਹਟਾ ਦਿੰਦਾ ਹੈ। ਇਹ ਵਾਪਸ ਨਹੀਂ ਹੋ ਸਕਦਾ।',
  keep: 'ਡਾਟਾ ਰੱਖੋ', reset_done: 'ਡੈਮੋ ਡਾਟਾ ਨਵੇਂ ਸੀਜ਼ਨ ਨਾਲ ਰੀਸੈੱਟ',
  act_register: 'ਕਿਸਾਨ ਨੇ ਖੇਤ ਬੁੱਕ ਕੀਤਾ', act_issue: 'ਕਿਸਾਨ ਨੇ ਸਮੱਸਿਆ ਦੱਸੀ', act_reassign: 'ਮਸ਼ੀਨ ਬਦਲੀ', act_unpin: 'ਚੋਣ ਹਟਾਈ', act_status: 'ਖੇਤ ਦੀ ਸਥਿਤੀ ਬਦਲੀ',
  act_machine: 'ਮਸ਼ੀਨ ਦੀ ਸਥਿਤੀ ਬਦਲੀ', act_resolve: 'ਸ਼ਿਕਾਇਤ ਹੱਲ', act_reset: 'ਡੈਮੋ ਡਾਟਾ ਰੀਸੈੱਟ', act_seed: 'ਸੀਜ਼ਨ ਬਣਾਇਆ', act_reseed: 'ਸੀਜ਼ਨ ਨਵਾਂ ਕੀਤਾ',
  rt_now: 'ਹੁਣੇ', rt_min: '{n} ਮਿੰਟ ਪਹਿਲਾਂ', rt_h: '{n} ਘੰਟੇ ਪਹਿਲਾਂ', rt_d: '{n} ਦਿਨ ਪਹਿਲਾਂ',
};

const DICTS = { en: EN, pa: PA };
export const ADMIN_LANGS = [{ code: 'en', name: 'English' }, { code: 'pa', name: 'ਪੰਜਾਬੀ' }];

interface AT { lang: string; setLang: (l: string) => void; t: (k: string, vars?: Record<string, string | number>) => string; locale: string; relTime: (iso: string) => string; reason: (c: { k: string; n?: number }) => string }
const Ctx = createContext<AT>(null as unknown as AT);

export function AdminI18nProvider({ children }: { children?: ReactNode }) {
  const [lang, setLang] = useState(() => { try { return localStorage.getItem('strawslot.adminLang') || 'en'; } catch { return 'en'; } });
  useEffect(() => { try { localStorage.setItem('strawslot.adminLang', lang); } catch { /* ignore */ } }, [lang]);
  const t = (k: string, vars?: Record<string, string | number>): string => {
    const s = DICTS[lang]?.[k] ?? EN[k] ?? k;
    return vars ? s.replace(/\{(\w+)\}/g, (_, v) => (vars[v] ?? '')) : s;
  };
  const locale = lang === 'pa' ? 'pa-IN' : 'en-IN';
  const relTime = (iso: string) => {
    const s = (Date.now() - Date.parse(iso)) / 1000;
    if (s < 60) return t('rt_now');
    if (s < 3600) return t('rt_min', { n: Math.floor(s / 60) });
    if (s < 86400) return t('rt_h', { n: Math.floor(s / 3600) });
    return t('rt_d', { n: Math.floor(s / 86400) });
  };
  const reason = (c: { k: string; n?: number }) => t(`r_${c.k}`, { n: c.n });
  return <Ctx.Provider value={{ lang, setLang, t, locale, relTime, reason }}>{children}</Ctx.Provider>;
}

export const useAT = () => useContext(Ctx);

export function AdminLangSwitch({ className = '' }: { className?: string }) {
  const { lang, setLang, t } = useAT();
  return (
    <div className={`inline-flex rounded-full border border-line bg-white p-1 ${className}`} role="radiogroup" aria-label={t('language')}>
      {ADMIN_LANGS.map((l) => (
        <button key={l.code} role="radio" aria-checked={lang === l.code} onClick={() => setLang(l.code)}
          className={`rounded-full px-3 py-1 text-sm font-semibold transition ${lang === l.code ? 'bg-sprout-900 text-white' : 'text-ink-soft hover:text-ink'}`}>{l.name}</button>
      ))}
    </div>
  );
}
