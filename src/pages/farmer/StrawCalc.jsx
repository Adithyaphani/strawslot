import { useState } from 'react';
import { Wheat, IndianRupee, Leaf, Wind } from 'lucide-react';
import { useI18n, Dual } from '../../lib/i18n.jsx';
import { fmtNum } from '../../lib/format.js';
import { PageWrap } from './FarmerLayout.jsx';

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
    <PageWrap>
      <Dual k="calcTitle" as="h1" className="text-[32px] font-extrabold sm:text-[40px]" subClassName="text-[0.5em] font-bold text-stubble-700" />
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[400px_1fr]">
      <div className="panel space-y-6 p-6">
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Out icon={Wheat} label={t('calcStraw')} value={`${fmtNum(tonnes, 1)} ${t('tonnes')}`} />
        <Out icon={IndianRupee} label={t('calcIncome')} value={`₹${fmtNum(income)}`} gold />
        <Out icon={Leaf} label={t('calcSaved')} value={`N ${fmtNum(tonnes * NUTR.n)} · K₂O ${fmtNum(tonnes * NUTR.k)} · P₂O₅ ${fmtNum(tonnes * NUTR.p)} ${t('kg')}`} />
        <Out icon={Wind} label={t('calcSmoke')} value={`CO₂ ${fmtNum(tonnes * PER_T.co2 / 1000, 1)} ${t('tonnes')} · PM ${fmtNum(tonnes * PER_T.pm)} ${t('kg')}`} />
      </div>
      </div>
      <p className="mt-4 text-xs text-ink-mute">2.6 t straw/acre; per tonne burnt: 1,460 kg CO₂, 3 kg particulate matter, 5.5 kg N, 25 kg K₂O (ICAR figures via Govt. of Goa DIP).</p>
    </PageWrap>
  );
}

function Out({ icon: Icon, label, value, gold }) {
  return (
    <div className={`rounded-[18px] border p-5 ${gold ? 'border-stubble-300 bg-stubble-50' : 'border-line bg-white shadow-panel'}`}>
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${gold ? 'bg-stubble-500 text-ink' : 'bg-sprout-50 text-sprout-700'}`}><Icon className="h-5 w-5" /></span>
      <p className="mt-3 text-sm text-ink-soft">{label}</p>
      <p className={`num mt-1 font-display font-extrabold ${gold ? 'text-[34px]' : 'text-xl'}`}>{value}</p>
    </div>
  );
}
