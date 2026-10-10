import { useState } from 'react';
import { Wheat, IndianRupee, Leaf, Wind } from 'lucide-react';
import { useI18n } from '../../lib/i18n.jsx';
import { fmtNum } from '../../lib/format.js';

// Factors match the server (see Methodology page).
const STRAW_T_PER_ACRE = 2.6;
const PER_T = { co2: 1460, pm: 3, co: 60 };
const NUTR = { n: 5.5, p: 2.3, k: 25, s: 1.2 };

export default function StrawCalc() {
  const { t } = useI18n();
  const [acres, setAcres] = useState(5);
  const [price, setPrice] = useState(180);
  const tonnes = acres * STRAW_T_PER_ACRE;
  const income = tonnes * 10 * price;

  return (
    <div>
      <h1 className="text-[28px] font-extrabold">{t('calcTitle')}</h1>
      <div className="panel mt-5 space-y-5 p-5">
        <div>
          <label className="label" htmlFor="acres">{t('calcAcres')}</label>
          <div className="flex items-center gap-3">
            <input id="acres" type="range" min="0.5" max="30" step="0.5" value={acres} onChange={(e) => setAcres(Number(e.target.value))} className="flex-1 accent-sprout-600" />
            <span className="num w-14 text-right text-xl font-bold">{acres}</span>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="price">{t('calcPrice')}</label>
          <input id="price" className="input num" type="number" min="0" value={price} onChange={(e) => setPrice(Math.max(0, Number(e.target.value)))} />
          <p className="hint">{t('calcPriceHint')}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Out icon={Wheat} label={t('calcStraw')} value={`${fmtNum(tonnes, 1)} ${t('tonnes')}`} />
        <Out icon={IndianRupee} label={t('calcIncome')} value={`₹${fmtNum(income)}`} gold />
        <Out icon={Leaf} label={t('calcSaved')} value={`N ${fmtNum(tonnes * NUTR.n)} · K₂O ${fmtNum(tonnes * NUTR.k)} · P₂O₅ ${fmtNum(tonnes * NUTR.p)} ${t('kg')}`} />
        <Out icon={Wind} label={t('calcSmoke')} value={`CO₂ ${fmtNum(tonnes * PER_T.co2 / 1000, 1)} ${t('tonnes')} · PM ${fmtNum(tonnes * PER_T.pm)} ${t('kg')}`} />
      </div>
      <p className="mt-3 text-xs text-ink-mute">2.6 t straw/acre; per tonne burnt: 1,460 kg CO₂, 3 kg particulate matter, 5.5 kg N, 25 kg K₂O (ICAR figures via Govt. of Goa DIP).</p>
    </div>
  );
}

function Out({ icon: Icon, label, value, gold }) {
  return (
    <div className={`rounded-panel border p-4 ${gold ? 'border-stubble-300 bg-stubble-50' : 'border-line bg-white'}`}>
      <p className="flex items-center gap-2 text-sm text-ink-soft"><Icon className="h-4 w-4" />{label}</p>
      <p className="num mt-1 font-display text-xl font-bold">{value}</p>
    </div>
  );
}
