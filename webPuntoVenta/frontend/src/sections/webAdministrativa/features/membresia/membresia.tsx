import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../components/Badge';
import { DataState } from '../../components/DataState';
import { Icon } from '../../components/Icon';
import { InputField, TextareaField } from '../../components/FormField';
import { Modal } from '../../components/Modal';
import { StatCard } from '../../components/StatCard';
import { useAuth } from '../../context/AuthContext';
import type { Clase, Estatus } from '../../types';
import { api } from '../../lib/api';
import { membresiasService } from './membresia.service';
import type { OpcionMembresia, Membresia, MembresiaInput } from './types';

type Filtro = 'todos' | Estatus;

const filtros: { value: Filtro; label: string }[] = [
    { value: 'todos', label: 'Todos' },
    { value: 'activo', label: 'Activas' },
    { value: 'inactivo', label: 'Inactivas' },
];


// ───────────── Utilidades de formato ─────────────
const dinero = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: n % 1 ? 2 : 0 }).format(n);

const textoEntradas = (n: number | null) => (n === null ? 'Ilimitado' : n === 1 ? '1 entrada' : `${n} entradas`);
const textoVigencia = (d: number) => (d === 1 ? '1 día' : `${d} días`);

// "$180 a $2,500", "$1,200" o "Por definir"
function rangoPrecios(opciones: OpcionMembresia[]): string {
    const costos = opciones.map(o => o.costo).filter((c): c is number => c !== null);
    if (costos.length === 0) return 'Por definir';
    const min = Math.min(...costos);
    const max = Math.max(...costos);
    return min === max ? dinero(min) : `${dinero(min)} a ${dinero(max)}`;
}

// ───────────── Formulario ─────────────
interface OpcionForm { id: string; entradas: string; ilimitado: boolean; vigenciaDias: string; costo: string; unidadDuracion: 'dias' | 'meses'; distribucion: 'compartida' | 'por_clase'; entradasPorClase: Record<string, string> }

interface FormMembresia {
    nombre: string;
    descripcion: string;
    estatus: Estatus;
    accesos: string[];
    clasesIds: string[];
    opciones: OpcionForm[];
    locker: boolean;
    regaderas: boolean;
    preventas: boolean;
    descuentoActivo: boolean;
    descuentoPorcentaje: string;
    descuentoAplicaEn: string;
    kitActivo: boolean;
    kitProductos: string[];
    kitCortesias: string[];
}

let contadorOpciones = 0;
const nuevaOpcion = (): OpcionForm => ({ id: `nueva-${++contadorOpciones}`, entradas: '', ilimitado: false, vigenciaDias: '', costo: '', unidadDuracion: 'dias', distribucion: 'compartida', entradasPorClase: {} });

const FORM_VACIO = (): FormMembresia => ({
    nombre: '', descripcion: '', estatus: 'activo', accesos: [], opciones: [nuevaOpcion()],
    clasesIds: [],
    locker: false, regaderas: false, preventas: false,
    descuentoActivo: false, descuentoPorcentaje: '', descuentoAplicaEn: '',
    kitActivo: false, kitProductos: [], kitCortesias: [],
});

const aForm = (p: Membresia): FormMembresia => ({
    nombre: p.nombre,
    descripcion: p.descripcion,
    estatus: p.estatus,
    accesos: [...p.accesos],
    clasesIds: [...(p.clasesIds ?? [])],
    opciones: p.opciones.map(o => ({
        id: o.id,
        entradas: o.entradas === null ? '' : String(o.entradas),
        ilimitado: o.entradas === null,
        vigenciaDias: String(o.duracion ?? o.vigenciaDias ?? ''),
        unidadDuracion: o.unidadDuracion ?? 'dias',
        distribucion: o.distribucion ?? 'compartida',
        entradasPorClase: Object.fromEntries(Object.entries(o.entradasPorClase ?? {}).map(([id, cantidad]) => [id, String(cantidad)])),
        costo: o.costo === null ? '' : String(o.costo),
    })),
    locker: p.complementos.locker,
    regaderas: p.complementos.regaderas,
    preventas: p.complementos.preventas,
    descuentoActivo: !!p.complementos.descuento,
    descuentoPorcentaje: p.complementos.descuento ? String(p.complementos.descuento.porcentaje) : '',
    descuentoAplicaEn: p.complementos.descuento?.aplicaEn ?? '',
    kitActivo: !!p.kit,
    kitProductos: p.kit ? [...p.kit.productos] : [],
    kitCortesias: p.kit ? [...p.kit.cortesias] : [],
});

// Valida el formulario y lo convierte en lo que guarda el servicio; devuelve un mensaje si algo falta
function aMembresia(f: FormMembresia): { ok: true; valor: MembresiaInput } | { ok: false; error: string } {
    const nombre = f.nombre.trim();
    if (!nombre) return { ok: false, error: 'El nombre de la membresía es obligatorio.' };
    if (f.clasesIds.length === 0) return { ok: false, error: 'Selecciona al menos una clase del catálogo.' };
    if (f.opciones.length === 0) return { ok: false, error: 'Agrega al menos una opción de entradas, vigencia y costo.' };

    const opciones: OpcionMembresia[] = [];
    const vistas = new Set<string>();
    for (const [i, o] of f.opciones.entries()) {
        const n = i + 1;
        let entradas: number | null = null;
        const porClase = o.distribucion === 'por_clase';
        const entradasPorClase: Record<string, number> = {};
        if (porClase) {
            for (const id of f.clasesIds) {
                const cantidad = Number(o.entradasPorClase[id]);
                if (!Number.isSafeInteger(cantidad) || cantidad < 1) return { ok: false, error: 'Indica entradas positivas para cada clase.' };
                entradasPorClase[id] = cantidad;
            }
        }
        if (!o.ilimitado || porClase) {
            entradas = porClase ? Object.values(entradasPorClase).reduce((a, v) => a + v, 0) : Number(o.entradas);
            if (!Number.isInteger(entradas) || entradas < 1) return { ok: false, error: `Opción ${n}: indica cuántas entradas incluye o márcala como ilimitada.` };
        }
        const vigencia = Number(o.vigenciaDias);
        if (!Number.isInteger(vigencia) || vigencia < 1 || vigencia > 3650) return { ok: false, error: `Opción ${n}: los días de vigencia deben ser un entero entre 1 y 3650.` };
        let costo: number | null = null;
        if (o.costo.trim() === '') return { ok: false, error: 'Indica el precio de cada opción.' };
        if (o.unidadDuracion === 'meses' && vigencia > 120) return { ok: false, error: 'La duración máxima es de 120 meses.' };
        if (o.costo.trim() !== '') {
            costo = Number(o.costo);
            if (!Number.isFinite(costo) || costo < 0) return { ok: false, error: `Opción ${n}: el costo no es válido.` };
        }
        const clave = JSON.stringify([entradas, vigencia, o.unidadDuracion, o.distribucion, entradasPorClase, costo]);
        if (vistas.has(clave)) return { ok: false, error: `Hay dos opciones con ${textoEntradas(entradas).toLowerCase()}. Deja una sola.` };
        vistas.add(clave);
        opciones.push({ id: o.id.startsWith('nueva-') ? `op-${Date.now()}-${i}` : o.id, entradas, ...(o.unidadDuracion === 'dias' ? { vigenciaDias: vigencia } : {}), duracion: vigencia, unidadDuracion: o.unidadDuracion, distribucion: o.distribucion, entradasPorClase, costo });
    }

    let descuento: MembresiaInput['complementos']['descuento'] = null;
    if (f.descuentoActivo) {
        const porcentaje = Number(f.descuentoPorcentaje);
        if (!Number.isFinite(porcentaje) || porcentaje <= 0 || porcentaje > 100) {
            return { ok: false, error: 'El descuento debe ser un porcentaje entre 1 y 100.' };
        }
        descuento = { porcentaje, aplicaEn: f.descuentoAplicaEn.trim() };
    }

    const kit = f.kitActivo && (f.kitProductos.length > 0 || f.kitCortesias.length > 0)
        ? { productos: f.kitProductos, cortesias: f.kitCortesias }
        : null;
    if (f.kitActivo && !kit) return { ok: false, error: 'El kit de bienvenida está activado pero no tiene productos ni cortesías.' };

    return {
        ok: true,
        valor: {
            nombre,
            descripcion: f.descripcion.trim(),
            estatus: f.estatus,
            accesos: f.accesos,
            clasesIds: f.clasesIds,
            opciones,
            complementos: { locker: f.locker, regaderas: f.regaderas, preventas: f.preventas, descuento },
            kit,
        },
    };
}

// Lista de etiquetas editable (áreas, productos del kit, cortesías)
function ListaEtiquetas({ titulo, ayuda, items, onChange, placeholder, sugerencias = [] }: {
    titulo: string;
    ayuda?: string;
    items: string[];
    onChange: (items: string[]) => void;
    placeholder: string;
    sugerencias?: string[];
}) {
    const [nuevo, setNuevo] = useState('');

    const agregar = (texto: string) => {
        const t = texto.trim();
        if (!t || items.some(i => i.toLowerCase() === t.toLowerCase())) { setNuevo(''); return; }
        onChange([...items, t]);
        setNuevo('');
    };
    const pendientes = sugerencias.filter(s => !items.some(i => i.toLowerCase() === s.toLowerCase()));

    return (
        <div className="space-y-2">
            <div>
                <label className="block text-sm font-semibold text-[color:#111827]">{titulo}</label>
                {ayuda && <p className="text-xs text-[color:#6B7280]">{ayuda}</p>}
            </div>
            {items.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {items.map(i => (
                        <span key={i} className="inline-flex items-center gap-1 rounded-full bg-[#EEF8D2] border border-[#D5E8A0] pl-3 pr-1.5 py-1 text-[13px] font-semibold text-[color:#111827]">
                            {i}
                            <button type="button" onClick={() => onChange(items.filter(x => x !== i))} aria-label={`Quitar ${i}`}
                                className="rx-icon-btn rx-btn--danger rx-icon-btn--remove">×</button>
                        </span>
                    ))}
                </div>
            )}
            {pendientes.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {pendientes.map(s => (
                        <button key={s} type="button" onClick={() => agregar(s)}
                            className="rx-btn rx-btn--accent rx-btn--sm">
                            + {s}
                        </button>
                    ))}
                </div>
            )}
            <div className="flex gap-2">
                <input value={nuevo} onChange={e => setNuevo(e.target.value)} placeholder={placeholder}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregar(nuevo); } }}
                    className="flex-1 px-3.5 py-2 text-sm text-[color:#111827] border-[1.5px] border-[color:#E5E7EB] rounded-2xl bg-white placeholder:text-[color:#6B7280] focus:outline-none focus:border-[color:#111827]" />
                <button type="button" onClick={() => agregar(nuevo)}
                    className="rx-btn rx-btn--accent">
                    Agregar
                </button>
            </div>
        </div>
    );
}

function Interruptor({ marcado, onChange, children }: { marcado: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
    return (
        <label className={`flex items-center gap-2.5 rounded-2xl border-[1.5px] px-3.5 py-2.5 text-sm font-semibold cursor-pointer transition-colors ${marcado ? 'border-[color:#111827] bg-[color:#F3F4F6]' : 'border-[color:#E5E7EB] bg-white hover:border-[color:#6B7280]'}`}>
            <input type="checkbox" checked={marcado} onChange={e => onChange(e.target.checked)} className="w-4 h-4 accent-[#16181D]" />
            <span className="text-[color:#111827]">{children}</span>
        </label>
    );
}

// ───────────── Tarjeta de una membresía ─────────────
function TarjetaMembresia({ p, puedeEditar, onEditar, onEstatus }: {
    p: Membresia;
    puedeEditar: boolean;
    onEditar: () => void;
    onEstatus: () => void;
}) {
    const c = p.complementos;
    const complementos = [
        c.locker && 'Locker',
        c.regaderas && 'Regaderas',
        c.preventas && 'Preventas',
        c.descuento && `${c.descuento.porcentaje}% de descuento${c.descuento.aplicaEn ? ` en ${c.descuento.aplicaEn}` : ''}`,
    ].filter((x): x is string => !!x);

    return (
        <article className={`bg-white rounded-2xl border-[1.5px] border-[color:#E5E7EB] p-5 flex flex-col gap-4 ${p.estatus === 'inactivo' ? 'opacity-60' : ''}`}>
            <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-extrabold tracking-tight text-[color:#111827]">{p.nombre}</h3>
                        <Badge variant={p.estatus} />
                    </div>
                    {p.descripcion && <p className="text-sm text-[color:#4B5563] mt-1">{p.descripcion}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:#6B7280]">Costo</p>
                    <p className="text-lg font-extrabold text-[color:#111827] whitespace-nowrap">{rangoPrecios(p.opciones)}</p>
                </div>
            </header>

            <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:#6B7280] mb-1.5">Acceso a</p>
                <div className="flex flex-wrap gap-1.5">
                    {p.accesos.map(a => (
                        <span key={a} className="rounded-full bg-[color:#F3F4F6] border border-[color:#E5E7EB] px-2.5 py-0.5 text-xs font-semibold text-[color:#111827]">{a}</span>
                    ))}
                </div>
            </div>

            <div className="rounded-xl border border-[color:#E5E7EB] overflow-hidden">
                <table className="w-full text-[13px]">
                    <thead>
                        <tr className="bg-[color:#F3F4F6] text-left text-[11px] uppercase tracking-wide text-[color:#6B7280]">
                            <th className="px-3 py-1.5 font-semibold">Núm. de entradas</th>
                            <th className="px-3 py-1.5 font-semibold">Duración</th>
                            <th className="px-3 py-1.5 font-semibold text-right">Costo</th>
                        </tr>
                    </thead>
                    <tbody>
                        {p.opciones.map(o => (
                            <tr key={o.id} className="border-t border-[color:#E5E7EB]">
                                <td className="px-3 py-1.5 font-semibold text-[color:#111827]">
                                    {textoEntradas(o.entradas)}
                                    {o.distribucion === 'por_clase' && <div className="text-xs font-normal">{Object.entries(o.entradasPorClase ?? {}).map(([id, cantidad]) => `${p.accesos[p.clasesIds?.indexOf(id) ?? -1] ?? 'Clase no disponible'}: ${cantidad}`).join(' · ')}</div>}
                                </td>
                                <td className="px-3 py-1.5 text-[color:#4B5563]">{o.unidadDuracion === 'meses' ? `${o.duracion} mes(es)` : textoVigencia(o.duracion ?? o.vigenciaDias ?? 0)}</td>
                                <td className="px-3 py-1.5 text-right font-semibold">
                                    {o.costo === null
                                        ? <span className="text-[color:#92400E] bg-[color:#FFFBEB] rounded-full px-2 py-0.5 text-[11px]">Por definir</span>
                                        : <span className="text-[color:#111827]">{dinero(o.costo)}</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {complementos.length > 0 && (
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:#6B7280] mb-1.5">Complementos</p>
                    <div className="flex flex-wrap gap-1.5">
                        {complementos.map(x => (
                            <span key={x} className="rounded-full bg-[#EEF8D2] border border-[#D5E8A0] px-2.5 py-0.5 text-xs font-semibold text-[color:#111827]">{x}</span>
                        ))}
                    </div>
                </div>
            )}

            {p.kit && (
                <div className="rounded-xl bg-[color:#F3F4F6] px-3.5 py-2.5 text-[13px] text-[color:#111827] space-y-0.5">
                    <p className="flex items-center gap-1.5 font-bold"><Icon name="redeem" size={18} weight={500} /> Kit de bienvenida</p>
                    {p.kit.productos.length > 0 && <p><span className="text-[color:#4B5563]">Productos:</span> {p.kit.productos.join(', ')}</p>}
                    {p.kit.cortesias.length > 0 && <p><span className="text-[color:#4B5563]">Cortesías:</span> {p.kit.cortesias.join(', ')}</p>}
                </div>
            )}

            {puedeEditar && (
                <footer className="flex gap-2 pt-1 mt-auto">
                    <button onClick={onEditar}
                        className="rx-btn rx-btn--outline flex-1">
                        Editar
                    </button>
                    <button onClick={onEstatus}
                        className={`rx-btn ${p.estatus === 'activo' ? 'rx-btn--danger' : 'rx-btn--dark'}`}>
                        {p.estatus === 'activo' ? 'Dar de baja' : 'Reactivar'}
                    </button>
                </footer>
            )}
        </article>
    );
}

// ───────────── Página ─────────────
export default function MembresiasPage() {
    const { user } = useAuth();
    const puedeEditar = user?.rol === 'administrador';

    const [membresias, setMembresias] = useState<Membresia[]>([]);
    const [clases, setClases] = useState<Clase[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const [filtro, setFiltro] = useState<Filtro>('todos');
    const [modal, setModal] = useState<{ open: boolean; editing?: Membresia }>({ open: false });
    const [form, setForm] = useState<FormMembresia>(FORM_VACIO);
    const [formError, setFormError] = useState('');
    const [confirmar, setConfirmar] = useState<Membresia | null>(null);

    const cargar = async () => {
        setLoading(true);
        setError(null);
        try {
            const [planes, catalogo] = await Promise.all([membresiasService.listar(), api.get<Clase[]>('/clases')]);
            setClases(catalogo);
            setMembresias(planes.map(plan => ({ ...plan, accesos: plan.clasesIds ? plan.clasesIds.map(id => catalogo.find(c => c.idClase === id)?.nombre ?? 'Clase no disponible') : plan.accesos })));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudieron cargar las membresías.');
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => { cargar(); }, []);

    const visibles = filtro === 'todos' ? membresias : membresias.filter(p => p.estatus === filtro);

    const resumen = useMemo(() => {
        const activos = membresias.filter(p => p.estatus === 'activo');
        const costos = activos.flatMap(p => p.opciones.map(o => o.costo)).filter((c): c is number => c !== null);
        return {
            activos: activos.length,
            desde: costos.length ? dinero(Math.min(...costos)) : '—',
            conKit: activos.filter(p => p.kit).length,
        };
    }, [membresias]);

    const abrirNuevo = () => { setForm(FORM_VACIO()); setFormError(''); setModal({ open: true }); };
    const abrirEditar = (p: Membresia) => { setForm(aForm(p)); setFormError(''); setModal({ open: true, editing: p }); };

    const guardar = async () => {
        const r = aMembresia(form);
        if (!r.ok) { setFormError(r.error); return; }
        setSaving(true);
        setFormError('');
        try {
            if (modal.editing) {
                const actualizado = await membresiasService.actualizar(modal.editing.idMembresia, r.valor);
                setMembresias(prev => prev.map(p => (p.idMembresia === actualizado.idMembresia ? actualizado : p)));
            } else {
                const nuevo = await membresiasService.crear(r.valor);
                setMembresias(prev => [...prev, nuevo]);
            }
            setModal({ open: false });
        } catch (err) {
            setFormError(err instanceof Error ? err.message : 'No se pudo guardar la membresía.');
        } finally {
            setSaving(false);
        }
    };

    const cambiarEstatus = async (p: Membresia) => {
        const nuevo: Estatus = p.estatus === 'activo' ? 'inactivo' : 'activo';
        setConfirmar(null);
        try {
            const actualizado = await membresiasService.cambiarEstatus(p.idMembresia, nuevo);
            setMembresias(prev => prev.map(x => (x.idMembresia === actualizado.idMembresia ? actualizado : x)));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo cambiar el estatus de la membresía.');
        }
    };

    const cambiarOpcion = (id: string, cambios: Partial<OpcionForm>) =>
        setForm(f => ({ ...f, opciones: f.opciones.map(o => (o.id === id ? { ...o, ...cambios } : o)) }));

    return (
        <div className="w-full min-w-0 space-y-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold text-[color:#111827]">Membresías</h1>
                    <p className="text-[color:#4B5563] text-sm mt-0.5">
                        Define qué incluye cada membresía: accesos, vigencia, costo, complementos y kit de bienvenida.
                    </p>
                </div>
                {puedeEditar && (
                    <button onClick={abrirNuevo} className="rx-btn rx-btn--accent">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        Nueva membresía
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard label="Membresías activas" value={resumen.activos} icon={<Icon name="card_membership" size={22} />} />
                <StatCard label="Precio desde" value={resumen.desde} icon={<Icon name="sell" size={22} />} accent="#3B6FD4" />
                <StatCard label="Con kit de bienvenida" value={resumen.conKit} icon={<Icon name="redeem" size={22} />} accent="#8A5CD6" />
            </div>

            <div className="flex gap-1.5 flex-wrap">
                {filtros.map(t => (
                    <button key={t.value} onClick={() => setFiltro(t.value)}
                        className={`rx-tab ${filtro === t.value ? 'rx-tab--active' : ''}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            <DataState loading={loading} error={error} onRetry={cargar} empty={!loading && !error && visibles.length === 0} emptyMessage="No hay membresías en esta vista">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {visibles.map(p => (
                        <TarjetaMembresia key={p.idMembresia} p={p} puedeEditar={puedeEditar}
                            onEditar={() => abrirEditar(p)} onEstatus={() => setConfirmar(p)} />
                    ))}
                </div>
            </DataState>

            {/* Alta y edición */}
            <Modal open={modal.open} onClose={() => setModal({ open: false })} title={modal.editing ? `Editar membresía: ${modal.editing.nombre}` : 'Nueva membresía'} size="xl">
                <div className="space-y-6">
                    <section className="grid grid-cols-2 gap-4">
                        <InputField label="Nombre de la membresía" required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
                        <div className="space-y-1">
                            <label className="block text-sm font-semibold text-[color:#111827]">Estatus</label>
                            <div className="flex gap-1.5 pt-0.5">
                                {(['activo', 'inactivo'] as Estatus[]).map(e => (
                                    <button key={e} type="button" onClick={() => setForm(f => ({ ...f, estatus: e }))}
                                        className={`rx-tab ${form.estatus === e ? 'rx-tab--active' : ''}`}>
                                        {e === 'activo' ? 'Activo' : 'Inactivo'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="col-span-2">
                            <TextareaField label="Descripción o contenido" value={form.descripcion} onChange={v => setForm(f => ({ ...f, descripcion: v }))} rows={2}
                                placeholder="Ej. Sólo clase. / Reset room + Force room (ilimitados)." />
                        </div>
                    </section>

                    <section className="border-t border-[color:#E5E7EB] pt-5">
                        <h4 className="text-sm font-semibold">Clases incluidas *</h4>
                        <p className="text-xs text-gray-500">Selecciona clases del catálogo. Los planes antiguos necesitan esta vinculación antes de guardar una edición.</p>
                        {clases.length === 0 && <p>No hay clases registradas. Crea las clases antes de crear una membresía.</p>}
                        {clases.map(clase => <label key={clase.idClase} className="flex items-center gap-2 py-1 text-sm">
                            <input type="checkbox" checked={form.clasesIds.includes(clase.idClase)} disabled={clase.estatus !== 'activo' && !form.clasesIds.includes(clase.idClase)}
                                onChange={e => setForm(f => {
                                    const clasesIds = e.target.checked ? [...f.clasesIds, clase.idClase] : f.clasesIds.filter(id => id !== clase.idClase);
                                    return { ...f, clasesIds, accesos: clasesIds.map(id => clases.find(c => c.idClase === id)?.nombre ?? id) };
                                })} />
                            {clase.nombre}{clase.estatus !== 'activo' ? ' (inactiva)' : ''}
                        </label>)}
                    </section>

                    <section className="border-t border-[color:#E5E7EB] pt-5 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h4 className="text-sm font-semibold text-[color:#111827]">Entradas, vigencia y costo *</h4>
                                <p className="text-xs text-[color:#6B7280]">Configura cada presentación con su precio y duración. Los meses se conservarán como meses calendario, no como 30 días.</p>
                            </div>
                            <button type="button" onClick={() => setForm(f => ({ ...f, opciones: [...f.opciones, nuevaOpcion()] }))}
                                className="rx-btn rx-btn--accent rx-btn--sm">+ Agregar opción</button>
                        </div>
                        <div className="space-y-2">
                            {form.opciones.map((o, i) => (
                                <div key={o.id} className="grid grid-cols-12 gap-2 items-end bg-[color:#F3F4F6] rounded-2xl p-3">
                                    <label className="col-span-12 text-xs">Distribución de entradas
                                        <select value={o.distribucion} onChange={e => cambiarOpcion(o.id, { distribucion: e.target.value as OpcionForm['distribucion'], ilimitado: false })} className="block w-full p-2 rounded-lg border">
                                            <option value="compartida">Bolsa compartida entre las clases incluidas</option>
                                            <option value="por_clase">Cantidad diferente por clase</option>
                                        </select>
                                    </label>
                                    {o.distribucion === 'por_clase' && form.clasesIds.map(id => <label key={id} className="col-span-6 text-xs">
                                        {clases.find(c => c.idClase === id)?.nombre ?? 'Clase no disponible'}
                                        <input type="number" min={1} step={1} value={o.entradasPorClase[id] ?? ''} onChange={e => cambiarOpcion(o.id, { entradasPorClase: { ...o.entradasPorClase, [id]: e.target.value } })} className="block w-full p-2 rounded-lg border" />
                                    </label>)}
                                    <label className="col-span-3 block text-xs text-[color:#4B5563] space-y-1">
                                        <span>Núm. de entradas</span>
                                        <input type="number" min={1} step={1} disabled={o.ilimitado || o.distribucion === 'por_clase'} value={o.distribucion === 'por_clase' ? form.clasesIds.reduce((s, id) => s + Number(o.entradasPorClase[id] || 0), 0) : o.ilimitado ? '' : o.entradas}
                                            placeholder={o.ilimitado ? 'Ilimitado' : 'Ej. 12'}
                                            onChange={e => cambiarOpcion(o.id, { entradas: e.target.value })}
                                            className="w-full px-3 py-2 text-sm text-[color:#111827] border border-[color:#E5E7EB] rounded-lg bg-white disabled:bg-[#ECEDF0] focus:outline-none focus:ring-2 focus:ring-[color:#111827]" />
                                    </label>
                                    <label className="col-span-2 flex items-center gap-1.5 pb-2 text-xs font-semibold text-[color:#111827] cursor-pointer">
                                        <input type="checkbox" disabled={o.distribucion === 'por_clase'} checked={o.ilimitado} onChange={e => cambiarOpcion(o.id, { ilimitado: e.target.checked })} className="w-4 h-4 accent-[#16181D]" />
                                        Ilimitado
                                    </label>
                                    <label className="col-span-3 block text-xs text-[color:#4B5563] space-y-1">
                                        <span>Duración</span>
                                        <select value={o.unidadDuracion} onChange={e => cambiarOpcion(o.id, { unidadDuracion: e.target.value as OpcionForm['unidadDuracion'] })} className="block w-full rounded-lg border p-1">
                                            <option value="dias">Días</option><option value="meses">Meses</option>
                                        </select>
                                        <input type="number" min={1} step={1} value={o.vigenciaDias} onChange={e => cambiarOpcion(o.id, { vigenciaDias: e.target.value })}
                                            className="w-full px-3 py-2 text-sm text-[color:#111827] border border-[color:#E5E7EB] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[color:#111827]" />
                                    </label>
                                    <label className="col-span-3 block text-xs text-[color:#4B5563] space-y-1">
                                        <span>Costo (MXN)</span>
                                        <input type="number" min={0} step="0.01" value={o.costo} placeholder="Por definir" onChange={e => cambiarOpcion(o.id, { costo: e.target.value })}
                                            className="w-full px-3 py-2 text-sm text-[color:#111827] border border-[color:#E5E7EB] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[color:#111827]" />
                                    </label>
                                    <button type="button" title="Quitar opción" disabled={form.opciones.length === 1}
                                        onClick={() => setForm(f => ({ ...f, opciones: f.opciones.filter(x => x.id !== o.id) }))}
                                        aria-label={`Quitar opción ${i + 1}`}
                                        className="rx-icon-btn rx-btn--danger rx-icon-btn--remove col-span-1">×</button>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="border-t border-[color:#E5E7EB] pt-5 space-y-3">
                        <div>
                            <h4 className="text-sm font-semibold text-[color:#111827]">Complementos <span className="font-normal text-[color:#6B7280]">(opcional)</span></h4>
                            <p className="text-xs text-[color:#6B7280]">Servicios adicionales que incluye la membresía.</p>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <Interruptor marcado={form.locker} onChange={v => setForm(f => ({ ...f, locker: v }))}>Locker</Interruptor>
                            <Interruptor marcado={form.regaderas} onChange={v => setForm(f => ({ ...f, regaderas: v }))}>Regaderas</Interruptor>
                            <Interruptor marcado={form.preventas} onChange={v => setForm(f => ({ ...f, preventas: v }))}>Preventas</Interruptor>
                        </div>
                        <Interruptor marcado={form.descuentoActivo} onChange={v => setForm(f => ({ ...f, descuentoActivo: v }))}>Incluye descuento</Interruptor>
                        {form.descuentoActivo && (
                            <div className="grid grid-cols-2 gap-4">
                                <InputField label="Porcentaje de descuento" type="number" min={1} max={100} placeholder="Ej. 10" value={form.descuentoPorcentaje}
                                    onChange={e => setForm(f => ({ ...f, descuentoPorcentaje: e.target.value }))} />
                                <InputField label="Aplica en" placeholder="Ej. laboratorio" value={form.descuentoAplicaEn}
                                    onChange={e => setForm(f => ({ ...f, descuentoAplicaEn: e.target.value }))} />
                            </div>
                        )}
                    </section>

                    <section className="border-t border-[color:#E5E7EB] pt-5 space-y-3">
                        <div>
                            <h4 className="text-sm font-semibold text-[color:#111827]">Kit de bienvenida <span className="font-normal text-[color:#6B7280]">(opcional)</span></h4>
                            <p className="text-xs text-[color:#6B7280]">Productos y cortesías que recibe el cliente al contratar la membresía.</p>
                        </div>
                        <Interruptor marcado={form.kitActivo} onChange={v => setForm(f => ({ ...f, kitActivo: v }))}>Esta membresía incluye kit de bienvenida</Interruptor>
                        {form.kitActivo && (
                            <div className="grid grid-cols-2 gap-5">
                                <ListaEtiquetas titulo="Productos" items={form.kitProductos} onChange={kitProductos => setForm(f => ({ ...f, kitProductos }))}
                                    placeholder="Ej. Termo" sugerencias={[...new Set(membresias.flatMap(m => m.kit?.productos ?? []))]} />
                                <ListaEtiquetas titulo="Cortesías" items={form.kitCortesias} onChange={kitCortesias => setForm(f => ({ ...f, kitCortesias }))}
                                    placeholder="Ej. 3 cortesías para laboratorio" />
                            </div>
                        )}
                    </section>
                </div>

                {formError && (
                    <p role="alert" className="mt-5 text-sm text-[color:#DC2626] bg-[color:#FEF2F2] border border-[color:#FEF2F2] px-3 py-2 rounded-xl">{formError}</p>
                )}
                <div className="flex gap-3 mt-6 pt-4 border-t border-[color:#E5E7EB]">
                    <button onClick={() => setModal({ open: false })} className="rx-btn rx-btn--outline flex-1">Cancelar</button>
                    <button onClick={guardar} disabled={saving} className="rx-btn rx-btn--dark flex-1">
                        {saving ? 'Guardando...' : modal.editing ? 'Guardar cambios' : 'Crear membresía'}
                    </button>
                </div>
            </Modal>

            {/* Baja / reactivación */}
            <Modal open={!!confirmar} onClose={() => setConfirmar(null)} title={confirmar?.estatus === 'activo' ? 'Dar de baja membresía' : 'Reactivar membresía'} size="sm">
                <p className="text-[color:#4B5563] text-sm">
                    {confirmar?.estatus === 'activo'
                        ? `¿Dar de baja "${confirmar?.nombre}"? Dejará de ofrecerse, pero se conserva para los clientes que ya la tienen.`
                        : `¿Reactivar "${confirmar?.nombre}"? Volverá a ofrecerse a los clientes.`}
                </p>
                <div className="flex gap-3 mt-5">
                    <button onClick={() => setConfirmar(null)} className="rx-btn rx-btn--outline flex-1">Cancelar</button>
                    <button onClick={() => confirmar && cambiarEstatus(confirmar)}
                        className={`rx-btn flex-1 ${confirmar?.estatus === 'activo' ? 'rx-btn--danger' : 'rx-btn--dark'}`}>
                        {confirmar?.estatus === 'activo' ? 'Dar de baja' : 'Reactivar'}
                    </button>
                </div>
            </Modal>
        </div>
    );
}