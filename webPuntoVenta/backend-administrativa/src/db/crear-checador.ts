import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { parse } from 'dotenv';
import { Usuario } from '../models/Usuarios/usuarios';

// Alta exclusiva y repetible: no carga semillas ni cambia contraseñas existentes.
async function main() {
    if (!process.env.MONGO_URI) throw new Error('Falta MONGO_URI');
    const envPath = fileURLToPath(new URL('../../../backend-cobro/.env', import.meta.url));
    const contenido = readFileSync(envPath, 'utf8');
    const correo = 'checador@gymfit.mx';
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    try {
        await Usuario.init();
        let usuario = await Usuario.findOne({ correo });
        let password: string | undefined;
        if (usuario && (String(usuario.get('rol')) !== 'checador' || String(usuario.get('estatus')) !== 'activo')) {
            throw new Error('El correo ya pertenece a otra cuenta o está inactivo. No se modifica.');
        }
        if (!usuario) {
            password = randomBytes(18).toString('base64url');
            usuario = await Usuario.create({
                nombre: 'Reloj', apellidos: 'Checador', correo, rol: 'checador',
                estatus: 'activo', codigoAcceso: `KIOSK-${randomBytes(8).toString('hex').toUpperCase()}`,
                password: await bcrypt.hash(password, 12),
            });
        }
        const id = String(usuario._id);
        const clave = 'CHECADOR_USUARIOS_AUTORIZADOS';
        const ids = new Set((parse(contenido)[clave] || '').split(',').map(v => v.trim()).filter(Boolean));
        ids.add(id);
        const linea = `${clave}=${[...ids].join(',')}`;
        const actualizado = /^\s*CHECADOR_USUARIOS_AUTORIZADOS\s*=.*$/m.test(contenido)
            ? contenido.replace(/^\s*CHECADOR_USUARIOS_AUTORIZADOS\s*=.*$/m, linea)
            : `${contenido.trimEnd()}\n${linea}\n`;
        writeFileSync(envPath, actualizado, 'utf8');
        console.log(JSON.stringify({ correo, id, rol: usuario.rol, password: password ?? 'Sin cambios: cuenta existente', autorizacion: 'Configurada; reiniciar backend de cobro/gateway' }));
    } finally {
        await mongoose.disconnect();
    }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });