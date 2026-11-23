// ============================================================================
// NÚCLEO COMPARTIDO DE SALUD  ·  catalogo.model.ts
// Carpeta idéntica en backend-administrativa y movilClientes/backendMovil (`diff -r` debe salir vacío).
//
// Catálogos de enfermedades y de lesiones más usuales, cada uno con su propio modelo. Se consultan al registrar a un
// cliente. Si el cliente tiene algo que no viene en la lista, lo escribe y se guarda tal cual en su perfil de salud.
// ============================================================================
import { Schema, model } from 'mongoose';
import { sinAcentos } from '../clientes-core/busqueda';

function crearCatalogo(nombreModelo: string, coleccion: string) {
    const esquema = new Schema(
        {
            nombre: { type: String, required: true, trim: true, maxlength: 80 },
            // Nombre sin acentos ni mayúsculas: evita repetidos como "Asma" y "ásma".
            clave: { type: String, unique: true },
            estatus: { type: String, enum: ['activo', 'inactivo'], default: 'activo' },
            fechaCreacion: { type: Date, default: Date.now, immutable: true },
        },
        {
            toJSON: {
                transform(_doc, ret: Record<string, any>) {
                    ret.id = ret._id.toString();
                    delete ret._id;
                    delete ret.__v;
                    delete ret.clave;
                    return ret;
                },
            },
        },
    );
    esquema.pre('validate', function () {
        (this as any).clave = sinAcentos(String((this as any).nombre ?? '')).replace(/\s+/g, ' ').trim();
    });
    return model(nombreModelo, esquema, coleccion);
}

export const Enfermedad = crearCatalogo('Enfermedad', 'webadministrativa_enfermedades');
export const Lesion = crearCatalogo('Lesion', 'webadministrativa_lesiones');

export const ENFERMEDADES_USUALES = [
    'Hipertensión arterial', 'Presión arterial baja', 'Diabetes tipo 1', 'Diabetes tipo 2', 'Asma', 'Bronquitis crónica',
    'Enfermedad cardiaca', 'Arritmia cardiaca', 'Colesterol alto', 'Triglicéridos altos', 'Hipotiroidismo', 'Hipertiroidismo',
    'Epilepsia', 'Migraña', 'Anemia', 'Obesidad', 'Artritis', 'Artrosis', 'Osteoporosis', 'Fibromialgia', 'Gastritis',
    'Insuficiencia renal', 'Várices', 'Apnea del sueño', 'Hernia inguinal',
];

export const LESIONES_USUALES = [
    'Esguince de tobillo', 'Esguince de rodilla', 'Desgarre muscular', 'Tendinitis', 'Tendinitis de Aquiles',
    'Lesión de menisco', 'Lesión de ligamento cruzado', 'Fractura', 'Luxación de hombro', 'Lumbalgia (dolor lumbar)',
    'Hernia de disco', 'Cervicalgia (dolor de cuello)', 'Contractura muscular', 'Fascitis plantar', 'Bursitis de hombro',
    'Epicondilitis (codo de tenista)', 'Síndrome del túnel carpiano', 'Lesión de manguito rotador', 'Periostitis tibial',
    'Condromalacia rotuliana', 'Escoliosis',
];

/** Carga las listas iniciales si faltan. Es idempotente: no repite ni pisa lo que el administrador ya cambió. */
export async function sembrarCatalogoSalud(): Promise<void> {
    for (const [Modelo, nombres] of [[Enfermedad, ENFERMEDADES_USUALES], [Lesion, LESIONES_USUALES]] as const) {
        const operaciones = nombres.map((nombre) => ({
            updateOne: {
                filter: { clave: sinAcentos(nombre).replace(/\s+/g, ' ').trim() },
                update: { $setOnInsert: { nombre, estatus: 'activo', fechaCreacion: new Date() } },
                upsert: true,
            },
        }));
        await (Modelo as any).bulkWrite(operaciones);
    }
}
