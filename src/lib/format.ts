// Formatos de datos del UI Kit (sección 29): moneda, fechas, horas, celular, plurales y búsqueda sin acentos.
export const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const MES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const DIA_LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** $1,350 · sin decimales salvo que existan centavos */
export const money = (n: number | null | undefined) => {
  const v = Number(n ?? 0);
  return '$' + v.toLocaleString('es-MX', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
};

/** Quita acentos y pasa a minúsculas: "PÉDRÓ PÁRÁMÓ" → "pedro paramo" */
export const norm = (s: unknown) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Coincidencia por nombre y/o apellidos, sin acentos ni mayúsculas, en cualquier orden de palabras. */
export const coincideNombre = (nombreCompleto: string, consulta: string) => {
  const q = norm(consulta);
  if (!q) return true;
  const n = norm(nombreCompleto);
  return n.includes(q) || q.split(' ').every((p) => n.split(' ').some((w) => w.startsWith(p)));
};

export const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export const iniciales = (nombre: string, apellidos = '') => {
  const p = `${nombre} ${apellidos}`.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '·';
};

export const celular = (c?: string | null) => {
  const d = String(c ?? '').replace(/\D/g, '');
  if (d.length !== 10) return c ?? '';
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
};

export const mascaraCelular = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 10);
  return d.length > 6 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : d.length > 3 ? `${d.slice(0, 3)} ${d.slice(3)}` : d;
};

const pad = (n: number) => String(n).padStart(2, '0');
export const claveDia = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const deClave = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
export const hoy = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
export const hoyClave = () => claveDia(new Date());
export const sumarDias = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const diasEntre = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 864e5);

/** 13 nov 2026 */
export const fechaCorta = (v?: string | Date | null) => {
  if (!v) return '';
  const d = typeof v === 'string' ? (/^\d{4}-\d{2}-\d{2}$/.test(v) ? deClave(v) : new Date(v)) : v;
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MES[d.getMonth()]} ${d.getFullYear()}`;
};

/** Hoy · Ayer · Mañana · 13 nov 2026 */
export const fechaRelativa = (v: string | Date) => {
  const d = typeof v === 'string' ? (/^\d{4}-\d{2}-\d{2}$/.test(v) ? deClave(v) : new Date(v)) : v;
  const k = diasEntre(hoy(), new Date(d.getFullYear(), d.getMonth(), d.getDate()));
  return k === 0 ? 'Hoy' : k === -1 ? 'Ayer' : k === 1 ? 'Mañana' : fechaCorta(d);
};

/** "06:00" → "6:00 a.m." */
export const hora12 = (hhmm?: string | null) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm ?? ''));
  if (!m) return hhmm ?? '';
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'a.m.' : 'p.m.'}`;
};
export const horaDe = (d: Date | string) =>
  new Date(d).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' }).replace(/\s?a\.?\s?m\.?/i, ' a.m.').replace(/\s?p\.?\s?m\.?/i, ' p.m.');

/** "Viernes 13 de noviembre · 4:34 p.m." (topbar) */
export const fechaLarga = (d = new Date()) => {
  const dia = DIA_LARGO[d.getDay()];
  return `${dia.charAt(0).toUpperCase() + dia.slice(1)} ${d.getDate()} de ${MES_LARGO[d.getMonth()]} · ${horaDe(d)}`;
};

export const edad = (nacimiento?: string | null) => {
  if (!nacimiento || !/^\d{4}-\d{2}-\d{2}$/.test(nacimiento)) return null;
  const b = deClave(nacimiento);
  const t = hoy();
  let a = t.getFullYear() - b.getFullYear();
  if (t < new Date(t.getFullYear(), b.getMonth(), b.getDate())) a--;
  return a;
};

export const okCorreo = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

export const uuid = () =>
  (crypto as Crypto & { randomUUID?: () => string }).randomUUID?.() ??
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

/** Fecha de hoy como la devuelve el punto de venta: "23/11/2026" */
export const hoyDMY = (d = new Date()) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
/** "23/11/2026" → Date */
export const deDMY = (s: string) => { const [d, m, y] = s.split('/').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
