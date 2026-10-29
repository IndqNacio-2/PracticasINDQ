import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../components/Badge';
import { DataState } from '../../components/DataState';
import { Icon } from '../../components/Icon';
import { InputField, TextareaField } from '../../components/FormField';
import { Modal } from '../../components/Modal';
import { StatCard } from '../../components/StatCard';
import { useAuth } from '../../context/AuthContext';
import type { Estatus } from '../../types';
import { membresiasService } from './membresia.service';
import type { OpcionMembresia, Membresia, MembresiaInput } from './types';

type Filtro = 'todos' | Estatus;

const filtros: { value: Filtro; label: string }[] = [
    { value: 'todos', label: 'Todos' },
    { value: 'activo', label: 'Activas' },
    { value: 'inactivo', label: 'Inactivas' },
];

// Áreas que ya existen en el gimnasio; se pueden agregar otras escribiéndolas
const AREAS_SUGERIDAS = ['Open gym', 'Reset room', 'Force room'];

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
interface OpcionForm { id: string; entradas: string; ilimitado: boolean; vigenciaDias: string; costo: string }

interface FormMembresia {
    nombre: string;
    descripcion: string;
    estatus: Estatus;
    accesos: string[];
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
const nuevaOpcion = (): OpcionForm => ({ id: `nueva-${++contadorOpciones}`, entradas: '', ilimitado: false, vigenciaDias: '30', costo: '' });

const FORM_VACIO = (): FormMembresia => ({
    nombre: '', descripcion: '', estatus: 'activo', accesos: [], opciones: [nuevaOpcion()],
    locker: false, regaderas: false, preventas: false,
    descuentoActivo: false, descuentoPorcentaje: '', descuentoAplicaEn: '',
    kitActivo: false, kitProductos: [], kitCortesias: [],
});

const aForm = (p: Membresia): FormMembresia => ({
    nombre: p.nombre,
    descripcion: p.descripcion,
    estatus: p.estatus,
    accesos: [...p.accesos],
    opciones: p.opciones.map(o => ({
        id: o.id,
        entradas: o.entradas === null ? '' : String(o.entradas),
        ilimitado: o.entradas === null,
        vigenciaDias: String(o.vigenciaDias),
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
    if (f.accesos.length === 0) return { ok: false, error: 'Elige al menos un área o clase de acceso.' };
    if (f.opciones.length === 0) return { ok: false, error: 'Agrega al menos una opción de entradas, vigencia y costo.' };

    const opciones: OpcionMembresia[] = [];
    const vistas = new Set<string>();
    for (const [i, o] of f.opciones.entries()) {
        const n = i + 1;
        let entradas: number | null = null;
        if (!o.ilimitado) {
            entradas = Number(o.entradas);
            if (!Number.isInteger(entradas) || entradas < 1) return { ok: false, error: `Opción ${n}: indica cuántas entradas incluye o márcala como ilimitada.` };
        }
        const vigencia = Number(o.vigenciaDias);
        if (!Number.isInteger(vigencia) || vigencia < 1) return { ok: false, error: `Opción ${n}: los días de vigencia deben ser un número entero mayor a 0.` };
        let costo: number | null = null;
        if (o.costo.trim() !== '') {
            costo = Number(o.costo);
            if (!Number.isFinite(costo) || costo < 0) return { ok: false, error: `Opción ${n}: el costo no es válido.` };
        }
        const clave = String(entradas);
        if (vistas.has(clave)) return { ok: false, error: `Hay dos opciones con ${textoEntradas(entradas).toLowerCase()}. Deja una sola.` };
        vistas.add(clave);
        opciones.push({ id: o.id.startsWith('nueva-') ? `op-${Date.now()}-${i}` : o.id, entradas, vigenciaDias: vigencia, costo });
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
                <label className="block text-sm font-semibold text-[color:var(--ink)]">{titulo}</label>
                {ayuda && <p className="text-xs text-[color:var(--ink3)]">{ayuda}</p>}
            </div>
            {items.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {items.map(i => (
                        <span key={i} className="inline-flex items-center gap-1 rounded-full bg-[#EEF8D2] border border-[#D5E8A0] pl-3 pr-1.5 py-1 text-[13px] font-semibold text-[color:var(--ink)]">
                            {i}
                            <button type="button" onClick={() => onChange(items.filter(x => x !== i))} aria-label={`Quitar ${i}`}
                                className="w-5 h-5 rounded-full hover:bg-black/10 text-[color:var(--ink2)] leading-none">×</button>
                        </span>
                    ))}
                </div>
            )}
            {pendientes.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {pendientes.map(s => (
                        <button key={s} type="button" onClick={() => agregar(s)}
                            className="rounded-full border-[1.5px] border-dashed border-[color:var(--line)] px-3 py-1 text-[13px] font-semibold text-[color:var(--ink2)] hover:border-[color:var(--ink)] hover:text-[color:var(--ink)]">
                            + {s}
                        </button>
                    ))}
                </div>
            )}
            <div className="flex gap-2">
                <input value={nuevo} onChange={e => setNuevo(e.target.value)} placeholder={placeholder}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregar(nuevo); } }}
                    className="flex-1 px-3.5 py-2 text-sm text-[color:var(--ink)] border-[1.5px] border-[color:var(--line)] rounded-2xl bg-white placeholder:text-[color:var(--ink3)] focus:outline-none focus:border-[color:var(--ink)]" />
                <button type="button" onClick={() => agregar(nuevo)}
                    className="px-4 py-2 rounded-2xl text-sm font-bold border-[1.5px] border-[color:var(--line)] text-[color:var(--ink)] hover:border-[color:var(--ink)]">
                    Agregar
                </button>
            </div>
        </div>
    );
}

function Interruptor({ marcado, onChange, children }: { marcado: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
    return (
        <label className={`flex items-center gap-2.5 rounded-2xl border-[1.5px] px-3.5 py-2.5 text-sm font-semibold cursor-pointer transition-colors ${marcado ? 'border-[color:var(--ink)] bg-[color:var(--soft)]' : 'border-[color:var(--line)] bg-white hover:border-[color:var(--ink3)]'}`}>
            <input type="checkbox" checked={marcado} onChange={e => onChange(e.target.checked)} className="w-4 h-4 accent-[#16181D]" />
            <span className="text-[color:var(--ink)]">{children}</span>
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
        <article className={`bg-white rounded-2xl border-[1.5px] border-[color:var(--line)] p-5 flex flex-col gap-4 ${p.estatus === 'inactivo' ? 'opacity-60' : ''}`}>
            <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-extrabold tracking-tight text-[color:var(--ink)]">{p.nombre}</h3>
                        <Badge variant={p.estatus} />
                    </div>
                    {p.descripcion && <p className="text-sm text-[color:var(--ink2)] mt-1">{p.descripcion}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--ink3)]">Costo</p>
                    <p className="text-lg font-extrabold text-[color:var(--ink)] whitespace-nowrap">{rangoPrecios(p.opciones)}</p>
                </div>
            </header>

            <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--ink3)] mb-1.5">Acceso a</p>
                <div className="flex flex-wrap gap-1.5">
                    {p.accesos.map(a => (
                        <span key={a} className="rounded-full bg-[color:var(--soft)] border border-[color:var(--line)] px-2.5 py-0.5 text-xs font-semibold text-[color:var(--ink)]">{a}</span>
                    ))}
                </div>
            </div>

            <div className="rounded-xl border border-[color:var(--line)] overflow-hidden">
                <table className="w-full text-[13px]">
                    <thead>
                        <tr className="bg-[color:var(--soft)] text-left text-[11px] uppercase tracking-wide text-[color:var(--ink3)]">
                            <th className="px-3 py-1.5 font-semibold">Núm. de entradas</th>
                            <th className="px-3 py-1.5 font-semibold">Días de vigencia</th>
                            <th className="px-3 py-1.5 font-semibold text-right">Costo</th>
                        </tr>
                    </thead>
                    <tbody>
                        {p.opciones.map(o => (
                            <tr key={o.id} className="border-t border-[color:var(--line)]">
                                <td className="px-3 py-1.5 font-semibold text-[color:var(--ink)]">{textoEntradas(o.entradas)}</td>
                                <td className="px-3 py-1.5 text-[color:var(--ink2)]">{textoVigencia(o.vigenciaDias)}</td>
                                <td className="px-3 py-1.5 text-right font-semibold">
                                    {o.costo === null
                                        ? <span className="text-[color:var(--warn-ink)] bg-[color:var(--warn-bg)] rounded-full px-2 py-0.5 text-[11px]">Por definir</span>
                                        : <span className="text-[color:var(--ink)]">{dinero(o.costo)}</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {complementos.length > 0 && (
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--ink3)] mb-1.5">Complementos</p>
                    <div className="flex flex-wrap gap-1.5">
                        {complementos.map(x => (
                            <span key={x} className="rounded-full bg-[#EEF8D2] border border-[#D5E8A0] px-2.5 py-0.5 text-xs font-semibold text-[color:var(--ink)]">{x}</span>
                        ))}
                    </div>
                </div>
            )}

            {p.kit && (
                <div className="rounded-xl bg-[color:var(--soft)] px-3.5 py-2.5 text-[13px] text-[color:var(--ink)] space-y-0.5">
                    <p className="flex items-center gap-1.5 font-bold"><Icon name="redeem" size={18} weight={500} /> Kit de bienvenida</p>
                    {p.kit.productos.length > 0 && <p><span className="text-[color:var(--ink2)]">Productos:</span> {p.kit.productos.join(', ')}</p>}
                    {p.kit.cortesias.length > 0 && <p><span className="text-[color:var(--ink2)]">Cortesías:</span> {p.kit.cortesias.join(', ')}</p>}
                </div>
            )}

            {puedeEditar && (
                <footer className="flex gap-2 pt-1 mt-auto">
                    <button onClick={onEditar}
                        className="flex-1 px-4 py-2 rounded-xl border-[1.5px] border-[color:var(--line)] text-sm font-semibold text-[color:var(--ink)] hover:border-[color:var(--ink)] transition-colors">
                        Editar
                    </button>
                    <button onClick={onEstatus}
                        className={`px-4 py-2 rounded-xl border-[1.5px] text-sm font-semibold transition-colors ${p.estatus === 'activo'
                            ? 'border-[color:var(--line)] text-[color:var(--bad)] hover:border-[color:var(--bad)]'
                            : 'border-[color:var(--line)] text-[color:var(--ok-ink)] hover:border-[color:var(--ok)]'}`}>
                        {p.estatus === 'activo' ? 'Dar de baja' : 'Reactivar'}
                    </button>
                </footer>
            )}
        </article>
    );
}

// ───────────── Página ─────────────
export function MembresiasPage() {
    const { user } = useAuth();
    const puedeEditar = user?.rol === 'administrador';

    const [membresias, setMembresias] = useState<Membresia[]>([]);
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
            setMembresias(await membresiasService.listar());
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
        <div className="space-y-5 max-w-7xl">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold text-[color:var(--ink)]">Membresías</h1>
                    <p className="text-[color:var(--ink2)] text-sm mt-0.5">
                        Define qué incluye cada membresía: accesos, vigencia, costo, complementos y kit de bienvenida.
                    </p>
                </div>
                {puedeEditar && (
                    <button onClick={abrirNuevo} className="flex items-center gap-2 bg-[color:var(--accent)] hover:brightness-95 text-[color:var(--ink)] px-4 py-2 rounded-xl text-sm font-bold transition-colors">
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
                        className={`px-3.5 py-1.5 rounded-full text-[13px] font-semibold border transition-colors ${filtro === t.value ? 'bg-[color:var(--dark)] text-white border-[color:var(--dark)]' : 'bg-white text-[color:var(--ink)] border-[color:var(--line)] hover:border-[color:var(--ink3)]'}`}>
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
                            <label className="block text-sm font-semibold text-[color:var(--ink)]">Estatus</label>
                            <div className="flex gap-1.5 pt-0.5">
                                {(['activo', 'inactivo'] as Estatus[]).map(e => (
                                    <button key={e} type="button" onClick={() => setForm(f => ({ ...f, estatus: e }))}
                                        className={`flex-1 px-3 py-2 rounded-2xl text-sm font-semibold border-[1.5px] transition-colors ${form.estatus === e ? 'bg-[color:var(--dark)] text-white border-[color:var(--dark)]' : 'bg-white text-[color:var(--ink)] border-[color:var(--line)]'}`}>
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

                    <section className="border-t border-[color:var(--line)] pt-5">
                        <ListaEtiquetas titulo="Áreas o clases de acceso *" ayuda="A qué espacios o clases da acceso esta membresía."
                            items={form.accesos} onChange={accesos => setForm(f => ({ ...f, accesos }))}
                            placeholder="Otra área o clase…" sugerencias={AREAS_SUGERIDAS} />
                    </section>

                    <section className="border-t border-[color:var(--line)] pt-5 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h4 className="text-sm font-semibold text-[color:var(--ink)]">Entradas, vigencia y costo *</h4>
                                <p className="text-xs text-[color:var(--ink3)]">Una membresía puede ofrecerse en varias presentaciones (por ejemplo 1, 6 o 12 entradas). Deja el costo vacío si aún no está definido.</p>
                            </div>
                            <button type="button" onClick={() => setForm(f => ({ ...f, opciones: [...f.opciones, nuevaOpcion()] }))}
                                className="text-xs font-bold text-[color:var(--ink)] hover:underline whitespace-nowrap">+ Agregar opción</button>
                        </div>
                        <div className="space-y-2">
                            {form.opciones.map((o, i) => (
                                <div key={o.id} className="grid grid-cols-12 gap-2 items-end bg-[color:var(--soft)] rounded-2xl p-3">
                                    <label className="col-span-3 block text-xs text-[color:var(--ink2)] space-y-1">
                                        <span>Núm. de entradas</span>
                                        <input type="number" min={1} step={1} disabled={o.ilimitado} value={o.ilimitado ? '' : o.entradas}
                                            placeholder={o.ilimitado ? 'Ilimitado' : 'Ej. 12'}
                                            onChange={e => cambiarOpcion(o.id, { entradas: e.target.value })}
                                            className="w-full px-3 py-2 text-sm text-[color:var(--ink)] border border-[color:var(--line)] rounded-lg bg-white disabled:bg-[#ECEDF0] focus:outline-none focus:ring-2 focus:ring-[color:var(--ink)]" />
                                    </label>
                                    <label className="col-span-2 flex items-center gap-1.5 pb-2 text-xs font-semibold text-[color:var(--ink)] cursor-pointer">
                                        <input type="checkbox" checked={o.ilimitado} onChange={e => cambiarOpcion(o.id, { ilimitado: e.target.checked })} className="w-4 h-4 accent-[#16181D]" />
                                        Ilimitado
                                    </label>
                                    <label className="col-span-3 block text-xs text-[color:var(--ink2)] space-y-1">
                                        <span>Días de vigencia</span>
                                        <input type="number" min={1} step={1} value={o.vigenciaDias} onChange={e => cambiarOpcion(o.id, { vigenciaDias: e.target.value })}
                                            className="w-full px-3 py-2 text-sm text-[color:var(--ink)] border border-[color:var(--line)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--ink)]" />
                                    </label>
                                    <label className="col-span-3 block text-xs text-[color:var(--ink2)] space-y-1">
                                        <span>Costo (MXN)</span>
                                        <input type="number" min={0} step="0.01" value={o.costo} placeholder="Por definir" onChange={e => cambiarOpcion(o.id, { costo: e.target.value })}
                                            className="w-full px-3 py-2 text-sm text-[color:var(--ink)] border border-[color:var(--line)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--ink)]" />
                                    </label>
                                    <button type="button" title="Quitar opción" disabled={form.opciones.length === 1}
                                        onClick={() => setForm(f => ({ ...f, opciones: f.opciones.filter(x => x.id !== o.id) }))}
                                        aria-label={`Quitar opción ${i + 1}`}
                                        className="col-span-1 pb-1.5 text-xl leading-none text-[color:var(--ink3)] hover:text-[color:var(--bad)] disabled:opacity-30 disabled:hover:text-[color:var(--ink3)]">×</button>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="border-t border-[color:var(--line)] pt-5 space-y-3">
                        <div>
                            <h4 className="text-sm font-semibold text-[color:var(--ink)]">Complementos <span className="font-normal text-[color:var(--ink3)]">(opcional)</span></h4>
                            <p className="text-xs text-[color:var(--ink3)]">Servicios adicionales que incluye la membresía.</p>
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

                    <section className="border-t border-[color:var(--line)] pt-5 space-y-3">
                        <div>
                            <h4 className="text-sm font-semibold text-[color:var(--ink)]">Kit de bienvenida <span className="font-normal text-[color:var(--ink3)]">(opcional)</span></h4>
                            <p className="text-xs text-[color:var(--ink3)]">Productos y cortesías que recibe el cliente al contratar la membresía.</p>
                        </div>
                        <Interruptor marcado={form.kitActivo} onChange={v => setForm(f => ({ ...f, kitActivo: v }))}>Esta membresía incluye kit de bienvenida</Interruptor>
                        {form.kitActivo && (
                            <div className="grid grid-cols-2 gap-5">
                                <ListaEtiquetas titulo="Productos" items={form.kitProductos} onChange={kitProductos => setForm(f => ({ ...f, kitProductos }))}
                                    placeholder="Ej. Termo" sugerencias={['Termo', 'Toalla', 'Playera']} />
                                <ListaEtiquetas titulo="Cortesías" items={form.kitCortesias} onChange={kitCortesias => setForm(f => ({ ...f, kitCortesias }))}
                                    placeholder="Ej. 3 cortesías para laboratorio" />
                            </div>
                        )}
                    </section>
                </div>

                {formError && (
                    <p role="alert" className="mt-5 text-sm text-[color:var(--bad)] bg-[color:var(--bad-bg)] border border-[color:var(--bad-bg)] px-3 py-2 rounded-xl">{formError}</p>
                )}
                <div className="flex gap-3 mt-6 pt-4 border-t border-[color:var(--line)]">
                    <button onClick={() => setModal({ open: false })} className="flex-1 px-4 py-2.5 border border-[color:var(--line)] text-[color:var(--ink)] rounded-xl text-sm font-medium hover:bg-[color:var(--soft)] transition-colors">Cancelar</button>
                    <button onClick={guardar} disabled={saving} className="flex-1 px-4 py-2.5 bg-[color:var(--dark)] hover:bg-[color:var(--dark2)] disabled:opacity-60 text-white rounded-xl text-sm font-bold transition-colors">
                        {saving ? 'Guardando...' : modal.editing ? 'Guardar cambios' : 'Crear membresía'}
                    </button>
                </div>
            </Modal>

            {/* Baja / reactivación */}
            <Modal open={!!confirmar} onClose={() => setConfirmar(null)} title={confirmar?.estatus === 'activo' ? 'Dar de baja membresía' : 'Reactivar membresía'} size="sm">
                <p className="text-[color:var(--ink2)] text-sm">
                    {confirmar?.estatus === 'activo'
                        ? `¿Dar de baja "${confirmar?.nombre}"? Dejará de ofrecerse, pero se conserva para los clientes que ya la tienen.`
                        : `¿Reactivar "${confirmar?.nombre}"? Volverá a ofrecerse a los clientes.`}
                </p>
                <div className="flex gap-3 mt-5">
                    <button onClick={() => setConfirmar(null)} className="flex-1 px-4 py-2.5 border border-[color:var(--line)] text-[color:var(--ink)] rounded-xl text-sm font-medium hover:bg-[color:var(--soft)] transition-colors">Cancelar</button>
                    <button onClick={() => confirmar && cambiarEstatus(confirmar)}
                        className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors ${confirmar?.estatus === 'activo' ? 'bg-[color:var(--bad)] hover:brightness-95' : 'bg-[color:var(--dark)] hover:bg-[color:var(--dark2)]'}`}>
                        {confirmar?.estatus === 'activo' ? 'Dar de baja' : 'Reactivar'}
                    </button>
                </div>
            </Modal>
        </div>
    );
}