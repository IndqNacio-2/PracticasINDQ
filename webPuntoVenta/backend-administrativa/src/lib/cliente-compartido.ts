import { createRequire } from 'node:module';

// Reutiliza las mismas reglas que Recepción; no mantener otra copia móvil.
const require = createRequire(import.meta.url);
const { esNombreValido, esCorreoValido, esTelefonoValido } = require('../../../backend-cobro/validacionCliente.js');
const { normalizarSalud } = require('../../../backend-cobro/saludCliente.js');

export function normalizarCliente(body: unknown, parcial = false): Record<string, unknown> {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Se esperaba un objeto JSON.');
    const b = body as Record<string, unknown>;
    const datos: Record<string, unknown> = {};
    for (const campo of Object.keys(b)) {
        if (!['nombre', 'apellidos', 'correo', 'telefono', 'enfermedades', 'lesiones', 'perfilSalud', 'password', 'confirmarPassword'].includes(campo)) {
            throw new Error(`El campo ${campo} no se puede modificar desde el móvil.`);
        }
    }
    if (!parcial || b.nombre !== undefined || b.apellidos !== undefined) {
        if (typeof b.nombre !== 'string' || !esNombreValido(b.nombre)) throw new Error('El nombre debe contener al menos 3 letras y solo admite letras y espacios.');
        if (b.apellidos !== undefined && (typeof b.apellidos !== 'string' || !/^[\p{L}\p{M} ]+$/u.test(b.apellidos.trim()) || !b.apellidos.trim())) throw new Error('Los apellidos solo admiten letras y espacios.');
        // El nombre completo permanece en la columna histórica, sin intentar dividir nombres antiguos.
        datos.nombre = [b.nombre.trim(), typeof b.apellidos === 'string' ? b.apellidos.trim() : ''].filter(Boolean).join(' ').normalize('NFC');
    }
    if (!parcial || b.correo !== undefined) {
        if (!esCorreoValido(b.correo)) throw new Error('Introduce un correo electrónico válido.');
        datos.correo = (b.correo as string).trim().toLowerCase();
    }
    if (b.telefono !== undefined) {
        if (!esTelefonoValido(b.telefono)) throw new Error('El teléfono solo admite números y un máximo de 10 dígitos.');
        datos.telefono = typeof b.telefono === 'string' ? b.telefono.trim() : '';
    }
    if (b.perfilSalud !== undefined) {
        if (!b.perfilSalud || typeof b.perfilSalud !== 'object' || Array.isArray(b.perfilSalud)) throw new Error('El perfil de salud no es válido.');
        const perfil = b.perfilSalud as Record<string, unknown>;
        if (Object.keys(perfil).some(c => !['enfermedades', 'lesiones'].includes(c))) throw new Error('Solo se comparten enfermedades y lesiones en este perfil.');
        for (const campo of ['enfermedades', 'lesiones']) {
            if (b[campo] !== undefined && perfil[campo] !== undefined) throw new Error(`Envía ${campo} una sola vez.`);
        }
        Object.assign(datos, normalizarSalud(perfil));
    }
    Object.assign(datos, normalizarSalud(b));
    return datos;
}

export function validarPassword(password: unknown, confirmar: unknown): string {
    if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) throw new Error('La contraseña debe tener al menos 8 caracteres y un máximo de 72 bytes.');
    if (password !== confirmar) throw new Error('Las contraseñas no coinciden.');
    return password;
}

export function perfilCompartido(c: Record<string, any>) {
    const nombre = String(c.nombre);
    return {
        idCliente: String(c.id), idUsuario: String(c.id), codigoAcceso: c.codigo_usuario || `CLI-${c.id}`,
        nombre, apellidos: '', nombreCompleto: nombre,
        iniciales: nombre.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase(),
        correo: c.correo ?? '', telefono: c.telefono ?? '',
        estatus: c.activo ? 'activo' : 'inactivo',
        enfermedades: c.enfermedades ?? [], lesiones: c.lesiones ?? [],
        perfilSalud: { enfermedades: c.enfermedades ?? [], lesiones: c.lesiones ?? [] },
    };
}