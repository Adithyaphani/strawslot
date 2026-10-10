// Illustrated Punjab field at harvest: golden stubble being cleared by a
// tractor-drawn seeder, with green wheat rows already sown in front. No smoke.
export default function FieldScene({ className = '', animate = true }) {
  const vp = { x: 520, y: 238 };
  const stubbleRows = Array.from({ length: 15 }, (_, i) => -260 + i * 95);
  const wheatRows = Array.from({ length: 19 }, (_, i) => -420 + i * 96);
  return (
    <svg viewBox="0 0 900 460" className={className} role="img" aria-label="Tractor clearing a harvested paddy field while wheat grows in the next field" preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id="fs-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F9E7B0" />
          <stop offset="0.7" stopColor="#FBF3DC" />
          <stop offset="1" stopColor="#F3F5EF" />
        </linearGradient>
        <linearGradient id="fs-stubble" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E8C566" />
          <stop offset="1" stopColor="#D9A93A" />
        </linearGradient>
        <linearGradient id="fs-wheat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7CC096" />
          <stop offset="1" stopColor="#2F8F4E" />
        </linearGradient>
        <clipPath id="fs-stubble-clip"><path d="M0 240 H900 V350 H0 Z" /></clipPath>
        <clipPath id="fs-wheat-clip"><path d="M0 350 C 220 338, 560 344, 900 352 V460 H0 Z" /></clipPath>
      </defs>

      <rect width="900" height="460" fill="url(#fs-sky)" />
      <circle cx="700" cy="120" r="54" fill="#F2C14E" opacity="0.85" />
      <circle cx="700" cy="120" r="80" fill="#F2C14E" opacity="0.18" />

      {/* distant tree line and farmhouse */}
      <path d="M0 238 C 40 214, 70 228, 100 216 C 130 204, 160 226, 190 214 C 230 200, 260 222, 300 218 C 330 206, 360 220, 400 224 L 400 240 L0 240 Z" fill="#9DB89A" />
      <path d="M560 236 C 600 216, 640 230, 680 214 C 720 200, 760 222, 800 212 C 840 204, 870 222, 900 216 L900 240 L560 240 Z" fill="#9DB89A" />
      <rect x="430" y="214" width="46" height="26" fill="#E7DCC2" />
      <path d="M424 216 L453 198 L482 216 Z" fill="#B88A22" />
      <rect x="448" y="226" width="9" height="14" fill="#8C6812" />

      {/* harvested paddy field: rows converge to the horizon */}
      <path d="M0 240 H900 V350 H0 Z" fill="url(#fs-stubble)" />
      <g clipPath="url(#fs-stubble-clip)" stroke="#C49A33" strokeWidth="2" opacity="0.7">
        {stubbleRows.map((x) => <line key={x} x1={vp.x} y1={vp.y} x2={x} y2={360} />)}
      </g>
      {/* cleared strip behind the tractor */}
      <path d="M0 300 L 330 286 L 330 314 L 0 332 Z" fill="#B88A55" opacity="0.55" />

      {/* tractor with seeder */}
      <g className={animate ? 'fs-tractor' : ''}>
        <g transform="translate(300 250)">
          <rect x="-58" y="38" width="62" height="16" rx="3" fill="#6B7570" />
          {[-52, -40, -28, -16, -4].map((x) => <rect key={x} x={x} y="52" width="4" height="10" fill="#46534C" />)}
          <rect x="4" y="44" width="14" height="5" fill="#46534C" />
          <rect x="18" y="16" width="62" height="32" rx="5" fill="#1C5C32" />
          <rect x="62" y="0" width="30" height="34" rx="4" fill="#24753F" />
          <rect x="67" y="5" width="20" height="14" rx="2" fill="#D3EBDB" />
          <rect x="84" y="24" width="18" height="16" rx="3" fill="#1C5C32" />
          <rect x="96" y="6" width="5" height="16" rx="2" fill="#14211B" />
          <circle cx="36" cy="54" r="20" fill="#14211B" />
          <circle cx="36" cy="54" r="8" fill="#D9A93A" />
          <circle cx="92" cy="60" r="13" fill="#14211B" />
          <circle cx="92" cy="60" r="5" fill="#D9A93A" />
        </g>
        {/* straw flecks being mulched, not burnt */}
        {[[236, 302], [228, 294], [244, 290], [220, 304], [252, 298]].map(([x, y], i) => (
          <rect key={i} x={x} y={y} width="6" height="2" rx="1" fill="#F5E6B8" transform={`rotate(${i * 35} ${x} ${y})`} />
        ))}
      </g>

      {/* sown wheat field in front */}
      <path d="M0 350 C 220 338, 560 344, 900 352 V460 H0 Z" fill="url(#fs-wheat)" />
      <g clipPath="url(#fs-wheat-clip)" stroke="#24753F" strokeWidth="3" opacity="0.6">
        {wheatRows.map((x) => <line key={x} x1={vp.x} y1={vp.y} x2={x} y2={470} />)}
      </g>
      <g fill="#ADDBB8">
        {[60, 140, 760, 840].map((x) => (
          <g key={x} transform={`translate(${x} 420)`}>
            <path d="M0 0 C -2 -14, -8 -22, -14 -26 C -6 -20, -2 -12, 0 0 Z" />
            <path d="M0 0 C 2 -16, 8 -24, 13 -30 C 6 -22, 2 -14, 0 0 Z" />
            <path d="M0 0 C 0 -14, 1 -24, 2 -34" stroke="#ADDBB8" strokeWidth="2" fill="none" />
          </g>
        ))}
      </g>
      <style>{`
        .fs-tractor { animation: fsDrive 2.2s cubic-bezier(.2,.7,.2,1) both; }
        @keyframes fsDrive { from { transform: translateX(-120px); } to { transform: none; } }
        @media (prefers-reduced-motion: reduce) { .fs-tractor { animation: none; } }
      `}</style>
    </svg>
  );
}
