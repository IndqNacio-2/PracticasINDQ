/*
 * Migracion: la clase ya NO tiene hora fija.
 *
 * Antes el catalogo de clases guardaba un unico campo "hora" (HH:MM) y los
 * horarios solo traian la fecha. Ahora la fecha y el intervalo
 * (horaInicio/horaFin) viven exclusivamente en los HORARIOS, que son los que
 * validan la duracion minima (30 minutos) y los solapamientos del entrenador.
 *
 * Este script:
 *   1. Borra el campo "hora" de la coleccion de clases.
 *   2. Revisa los horarios: si el intervalo es invalido (fin <= inicio) o
 *      dura menos de 30 minutos, lo ajusta a una duracion valida (la minima)
 *      o lo deja inactivo, segun el caso.
 *
 * Uso: npm run db:migrar-hora-clase   (desde backend-administrativa)
 */
import 'dotenv/config';
import mongoose from 'mongoose';

const DURACION_MINIMA_MINUTOS = 30;

/* Convierte "HH:MM" a minutos desde medianoche; null si el formato no es valido. */
function minutosDeHora(hora: string): number | null {
    const coincidencia = /^(\d{2}):(\d{2})$/.exec(hora ?? '');
    if (!coincidencia) return null;
    const horas = Number(coincidencia[1]);
    const minutos = Number(coincidencia[2]);
    if (horas > 23 || minutos > 59) return null;
    return horas * 60 + minutos;
}

/* Vuelve de minutos a "HH:MM". */
function horaDesdeMinutos(minutos: number): string {
    const horas = Math.floor(minutos / 60);
    const resto = minutos % 60;
    return `${String(horas).padStart(2, '0')}:${String(resto).padStart(2, '0')}`;
}

async function main() {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('Falta MONGO_URI en el .env');
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    if (!db) throw new Error('No se pudo obtener la base de datos de MongoDB');

    // 1. Quitar el campo "hora" de las clases.
    const resultadoClases = await db.collection('webadministrativa_clases').updateMany(
        { hora: { $exists: true } },
        { $unset: { hora: '' } }
    );
    console.log(`Clases actualizadas (campo "hora" eliminado): ${resultadoClases.modifiedCount}`);

    // 2. Revisar los horarios: intervalo valido y duracion minima de 30 min.
    const horarios = await db.collection('webadministrativa_horarios').find({}).toArray();
    let corregidos = 0;
    let invalidos = 0;

    for (const h of horarios) {
        const inicio = minutosDeHora(h.horaInicio);
        const fin = minutosDeHora(h.horaFin);
        if (inicio === null) {
            console.log(`  Horario ${h._id}: horaInicio invalida ("${h.horaInicio}") -> se marca inactivo.`);
            await db.collection('webadministrativa_horarios').updateOne({ _id: h._id }, { $set: { estatus: 'inactivo' } });
            invalidos += 1;
            continue;
        }
        if (fin === null || fin <= inicio) {
            // Sin hora de fin utilizable: se estira a la duracion minima.
            const nuevaFin = horaDesdeMinutos(inicio + DURACION_MINIMA_MINUTOS);
            console.log(`  Horario ${h._id}: intervalo invalido ("${h.horaInicio}"-("${h.horaFin}")) -> horaFin ${nuevaFin}.`);
            await db.collection('webadministrativa_horarios').updateOne({ _id: h._id }, { $set: { horaFin: nuevaFin } });
            corregidos += 1;
            continue;
        }
        if (fin - inicio < DURACION_MINIMA_MINUTOS) {
            const nuevaFin = horaDesdeMinutos(inicio + DURACION_MINIMA_MINUTOS);
            console.log(`  Horario ${h._id}: duracion corta (${fin - inicio} min) -> horaFin ${nuevaFin}.`);
            await db.collection('webadministrativa_horarios').updateOne({ _id: h._id }, { $set: { horaFin: nuevaFin } });
            corregidos += 1;
        }
    }

    console.log(`Horarios revisados: ${horarios.length} (corregidos: ${corregidos}, invalidos: ${invalidos})`);
    await mongoose.disconnect();
}

main().catch((err) => {
    console.error('Error en la migracion:', err);
    process.exit(1);
});