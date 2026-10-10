import { useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { RISK, STATUS, fmtDate } from '../lib/format.js';

const chcIcon = L.divIcon({
  className: '',
  html: '<div style="width:18px;height:18px;border-radius:5px;background:#14211B;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:grid;place-items:center"><div style="width:6px;height:6px;border-radius:2px;background:#D9A93A"></div></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function colorFor(f) {
  if (f.status === 'cleared') return '#9AA19C';
  if (f.status === 'burned') return '#14211B';
  return RISK[f.level]?.color || '#2F8F4E';
}

const DEFAULT_T = (k) => ({ layer_pending: 'Pending fields', layer_cleared: 'Cleared fields', layer_chcs: 'Hiring centres', layer_fires: 'Fire hotspots', risk_high: 'High risk', risk_medium: 'Watch', risk_low: 'On track' }[k] || k);

export default function RiskMap({ fields = [], chcs = [], fires = [], centre, onSelect, height = 460, t = DEFAULT_T, statusLabel = (s) => STATUS[s]?.label, locale = 'en-IN' }) {
  const [layers, setLayers] = useState({ fields: true, cleared: false, chcs: true, fires: true });
  const shown = useMemo(() => fields.filter((f) => (f.status === 'cleared' ? layers.cleared : layers.fields)), [fields, layers]);
  const toggle = (k) => setLayers((s) => ({ ...s, [k]: !s[k] }));

  return (
    <div className="relative overflow-hidden rounded-b-panel" style={{ height }}>
      <MapContainer center={[centre.lat, centre.lon]} zoom={10} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        {layers.fires && fires.map((p, i) => (
          <CircleMarker key={`fire-${i}`} center={[p.lat, p.lon]} radius={5} pathOptions={{ color: '#D9482B', weight: 1, fillColor: '#D9482B', fillOpacity: 0.35 }}>
            <Tooltip>Fire hotspot {p.date}{p.time ? ` ${String(p.time).padStart(4, '0').slice(0, 2)}:${String(p.time).padStart(4, '0').slice(2)} UTC` : ''}</Tooltip>
          </CircleMarker>
        ))}
        {shown.map((f) => (
          <CircleMarker key={f.id} center={[f.lat, f.lon]} radius={Math.max(3.5, Math.min(9, Math.sqrt(f.acres) * 2))}
            pathOptions={{ color: '#fff', weight: 1, fillColor: colorFor(f), fillOpacity: 0.9 }}
            eventHandlers={{ click: () => onSelect?.(f.id) }}>
            <Tooltip direction="top">
              <div className="text-xs">
                <b>{f.id}</b> {f.village}<br />
                {f.acres} ac · {statusLabel(f.status)} · {f.risk}<br />
                {fmtDate(f.deadline, undefined, locale)}
              </div>
            </Tooltip>
          </CircleMarker>
        ))}
        {layers.chcs && chcs.map((c) => (
          <Marker key={c.id} position={[c.lat, c.lon]} icon={chcIcon}>
            <Popup><b>{c.name}</b><br />{c.machines ?? ''} machines · {c.tractors?.length ?? 0} tractors<br />Operator: {c.operator}</Popup>
          </Marker>
        ))}
      </MapContainer>

      <div className="absolute right-3 top-3 z-[500] flex flex-col gap-1 rounded-ctl bg-white/95 p-2 text-xs shadow-panel">
        {[
          ['fields', t('layer_pending'), '#2F8F4E'],
          ['cleared', t('layer_cleared'), '#9AA19C'],
          ['chcs', t('layer_chcs'), '#14211B'],
          ['fires', t('layer_fires'), '#D9482B'],
        ].map(([k, label, c]) => (
          <label key={k} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-smoke-100">
            <input type="checkbox" checked={layers[k]} onChange={() => toggle(k)} className="accent-sprout-600" />
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
            {label}
          </label>
        ))}
      </div>
      <div className="absolute bottom-3 left-3 z-[500] flex gap-3 rounded-ctl bg-white/95 px-3 py-2 text-xs shadow-panel">
        {['high', 'medium', 'low'].map((k) => (
          <span key={k} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: RISK[k].color }} />{t(`risk_${k}`)}</span>
        ))}
      </div>
    </div>
  );
}
