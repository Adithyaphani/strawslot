// Farmer-facing messages in English, Hindi and Punjabi (Gurmukhi).
// Template-based so they are reliable and work with no AI key.

import { MACHINE_TYPES } from './constants.js';

const LOCALE = { en: 'en-IN', hi: 'hi-IN', pa: 'pa-IN' };

const MACHINE_NAMES = {
  super_seeder: { en: 'Super Seeder', hi: 'सुपर सीडर', pa: 'ਸੁਪਰ ਸੀਡਰ' },
  happy_seeder: { en: 'Happy Seeder', hi: 'हैप्पी सीडर', pa: 'ਹੈਪੀ ਸੀਡਰ' },
  mulcher: { en: 'Mulcher + plough', hi: 'मल्चर + हल', pa: 'ਮਲਚਰ + ਹਲ' },
  baler: { en: 'Baler', hi: 'बेलर', pa: 'ਬੇਲਰ' },
};

const T = {
  booked: {
    en: 'StrawSlot: {name}, your {acres}-acre field ({id}) is booked. {machine} from {chc} will come on {date}. Sowing deadline: {deadline}. Please keep the field ready and do not burn the straw. Help: {phone}',
    hi: 'स्ट्रॉस्लॉट: {name} जी, आपके {acres} एकड़ खेत ({id}) की बुकिंग हो गई है। {machine} ({chc}) {date} को आएगी। बुवाई की अंतिम तिथि: {deadline}। कृपया खेत तैयार रखें और पराली न जलाएं। संपर्क: {phone}',
    pa: 'ਸਟ੍ਰਾਸਲਾਟ: {name} ਜੀ, ਤੁਹਾਡੇ {acres} ਏਕੜ ਖੇਤ ({id}) ਦੀ ਬੁਕਿੰਗ ਹੋ ਗਈ ਹੈ। {machine} ({chc}) {date} ਨੂੰ ਆਵੇਗੀ। ਬਿਜਾਈ ਦੀ ਆਖਰੀ ਤਰੀਕ: {deadline}। ਕਿਰਪਾ ਕਰਕੇ ਖੇਤ ਤਿਆਰ ਰੱਖੋ ਅਤੇ ਪਰਾਲੀ ਨਾ ਸਾੜੋ। ਸੰਪਰਕ: {phone}',
  },
  pickup: {
    en: ' Straw pickup by {vendor} on {date}.',
    hi: ' पराली उठाने के लिए {vendor} {date} को आएंगे।',
    pa: ' ਪਰਾਲੀ ਚੁੱਕਣ ਲਈ {vendor} {date} ਨੂੰ ਆਉਣਗੇ।',
  },
  atRisk: {
    en: 'StrawSlot: {name}, we are arranging a machine for your {acres}-acre field ({id}). The block officer has been alerted and will contact you before {deadline}. Please do not burn the straw.',
    hi: 'स्ट्रॉस्लॉट: {name} जी, आपके {acres} एकड़ खेत ({id}) के लिए मशीन की व्यवस्था की जा रही है। ब्लॉक अधिकारी को सूचना दे दी गई है, वे {deadline} से पहले आपसे संपर्क करेंगे। कृपया पराली न जलाएं।',
    pa: 'ਸਟ੍ਰਾਸਲਾਟ: {name} ਜੀ, ਤੁਹਾਡੇ {acres} ਏਕੜ ਖੇਤ ({id}) ਲਈ ਮਸ਼ੀਨ ਦਾ ਪ੍ਰਬੰਧ ਕੀਤਾ ਜਾ ਰਿਹਾ ਹੈ। ਬਲਾਕ ਅਧਿਕਾਰੀ ਨੂੰ ਸੂਚਿਤ ਕਰ ਦਿੱਤਾ ਗਿਆ ਹੈ, ਉਹ {deadline} ਤੋਂ ਪਹਿਲਾਂ ਤੁਹਾਡੇ ਨਾਲ ਸੰਪਰਕ ਕਰਨਗੇ। ਕਿਰਪਾ ਕਰਕੇ ਪਰਾਲੀ ਨਾ ਸਾੜੋ।',
  },
  cleared: {
    en: 'StrawSlot: {name}, your field ({id}) is cleared. Thank you for not burning!',
    hi: 'स्ट्रॉस्लॉट: {name} जी, आपका खेत ({id}) साफ हो गया है। पराली न जलाने के लिए धन्यवाद!',
    pa: 'ਸਟ੍ਰਾਸਲਾਟ: {name} ਜੀ, ਤੁਹਾਡਾ ਖੇਤ ({id}) ਸਾਫ਼ ਹੋ ਗਿਆ ਹੈ। ਪਰਾਲੀ ਨਾ ਸਾੜਨ ਲਈ ਧੰਨਵਾਦ!',
  },
};

const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));

export function fmtDate(date, lang = 'en') {
  return new Intl.DateTimeFormat(LOCALE[lang] || 'en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(date + 'T00:00:00Z'));
}

export function machineName(type, lang = 'en') {
  return MACHINE_NAMES[type]?.[lang] || MACHINE_TYPES[type]?.label || type;
}

export function farmerMessage({ field, result, machine, chc, vendor, lang }) {
  const l = T.booked[lang] ? lang : 'en';
  const name = field.farmerName.split(' ')[0];
  const base = { name, id: field.id, acres: field.acres, deadline: fmtDate(result.deadline, l) };
  if (result.status === 'cleared') return fill(T.cleared[l], base);
  if (result.status === 'at_risk' || !machine) return fill(T.atRisk[l], base);
  let msg = fill(T.booked[l], { ...base, machine: machineName(machine.type, l), chc: chc?.name || '', date: fmtDate(result.start, l), phone: chc?.phone || '' });
  if (result.pickups?.length && vendor) msg += fill(T.pickup[l], { vendor: vendor.name, date: fmtDate(result.pickups[0].date, l) });
  return msg;
}
