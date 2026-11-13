// Validaciones de los datos de registro y perfil.
type Ok<T> = { ok: true; valor: T };
type Mal = { ok: false; error: string };

// ¿Es una fecha AAAA-MM-DD real, de 1900 en adelante y no futura?
function esFechaReal(v: unknown): v is string {
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    const [a, m, d] = v.split('-').map(Number);
    const fecha = new Date(a, m - 1, d);
    if (fecha.getFullYear() !== a || fecha.getMonth() !== m - 1 || fecha.getDate() !== d) return false;
    return a >= 1900 && fecha <= new Date();
}

export function validarFechaNacimiento(v: unknown): Ok<string> | Mal {
    if (!esFechaReal(v)) return { ok: false, error: 'La fecha de nacimiento no es válida (formato AAAA-MM-DD, no futura)' };
    return { ok: true, valor: v };
}

// Celular de 10 a 15 dígitos (se aceptan espacios, guiones, paréntesis y + al inicio)
export function validarCelular(v: unknown): Ok<string> | Mal {
    const limpio = String(v ?? '').replace(/[\s\-().]/g, '');
    if (!/^\+?\d{10,15}$/.test(limpio)) return { ok: false, error: 'El celular debe tener entre 10 y 15 dígitos' };
    return { ok: true, valor: limpio };
}

export function validarCorreo(v: unknown): Ok<string> | Mal {
    const c = String(v ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) || c.length > 120) return { ok: false, error: 'El correo electrónico no es válido' };
    return { ok: true, valor: c };
}

export function validarPassword(v: unknown, confirmar: unknown): Ok<string> | Mal {
    if (typeof v !== 'string' || v.length < 8) return { ok: false, error: 'La contraseña debe tener al menos 8 caracteres' };
    if (v.length > 72) return { ok: false, error: 'La contraseña admite máximo 72 caracteres' };
    if (confirmar !== v) return { ok: false, error: 'Las contraseñas no coinciden' };
    return { ok: true, valor: v };
}

export function validarNombre(v: unknown, etiqueta: string): Ok<string> | Mal {
    const n = String(v ?? '').trim();
    if (!n) return { ok: false, error: `${etiqueta} es obligatorio` };
    if (n.length > 80) return { ok: false, error: `${etiqueta} admite máximo 80 caracteres` };
    return { ok: true, valor: n };
}

const MAX_FOTO_CHARS = 400_000; // ~300 KB de imagen en base64
const FOTO_OK = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

// '' = sin foto / quitar foto
export function validarFoto(v: unknown): Ok<string> | Mal {
    if (v === null || v === undefined || v === '') return { ok: true, valor: '' };
    if (typeof v !== 'string' || !FOTO_OK.test(v)) return { ok: false, error: 'La foto debe ser una imagen PNG, JPG o WEBP' };
    if (v.length > MAX_FOTO_CHARS) return { ok: false, error: 'La foto es demasiado grande (máximo ~300 KB)' };
    return { ok: true, valor: v };
}
