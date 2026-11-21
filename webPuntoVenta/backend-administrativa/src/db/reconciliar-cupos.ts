/**
 * Reconciliación de reservaciones y cupos (se corre una vez tras unificar el modelo de reservaciones).
 *
 *   1. Reservaciones sin `fechaClase`: la copia de `fechaReservacion` (antes ese campo era el día de la clase
 *      cuando la reservación se creaba desde la web administrativa).
 *   2. Reservaciones sin `estadoCupo`: quedan como 'confirmada'.
 *   3. `capacidadDisponible` de cada horario: capacidadTotal menos las reservaciones vigentes con lugar
 *      confirmado (la lista de espera, las canceladas y las inasistencias no ocupan lugar).
 *
 * Es idempotente: se puede correr las veces que haga falta.
 * Uso: npm run db:reconciliar-cupos   (desde backend-administrativa)
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { Reservacion } from '../models/Reservaciones/reservacion';
import { Horario } from '../models/Horarios/horarios';

async function main() {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('Falta MONGO_URI en el .env');
    await mongoose.connect(uri);

    const Reservaciones = Reservacion as unknown as mongoose.Model<any>;
    const Horarios = Horario as unknown as mongoose.Model<any>;

    // 1) fechaClase
    const sinFecha = await Reservaciones.collection.updateMany(
        { $or: [{ fechaClase: { $exists: false } }, { fechaClase: '' }] },
        [{ $set: { fechaClase: '$fechaReservacion' } }],
    );
    // 2) estadoCupo
    const sinCupo = await Reservaciones.collection.updateMany(
        { estadoCupo: { $exists: false } },
        { $set: { estadoCupo: 'confirmada' } },
    );

    // 3) cupos
    const ocupadas = await Reservaciones.aggregate([
        { $match: { estatus: { $in: ['pendiente', 'confirmada'] }, estadoCupo: { $ne: 'espera' } } },
        { $group: { _id: '$idHorario', total: { $sum: 1 } } },
    ]);
    const porHorario = new Map<string, number>(ocupadas.map((o: any) => [String(o._id), o.total]));
    let corregidos = 0;
    for (const horario of await Horarios.find({}).select('capacidadTotal capacidadDisponible')) {
        const disponibles = Math.max(0, horario.capacidadTotal - (porHorario.get(String(horario._id)) ?? 0));
        if (horario.capacidadDisponible !== disponibles) {
            await Horarios.updateOne({ _id: horario._id }, { capacidadDisponible: disponibles });
            corregidos++;
        }
    }

    console.log(`fechaClase completada en ${sinFecha.modifiedCount} reservaciones`);
    console.log(`estadoCupo completado en ${sinCupo.modifiedCount} reservaciones`);
    console.log(`cupo corregido en ${corregidos} horarios`);
    await mongoose.disconnect();
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
