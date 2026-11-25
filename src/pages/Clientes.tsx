import { useMemo, useRef, useState } from 'react';
import { mensajeError } from '../lib/api';
import { catalogoSalud, clientes as apiClientes, DOCS_MENOR as DOCS, membresiaDe, type Cliente, type DatosCliente, type ItemCatalogo } from '../lib/datos';
import { celular, claveDia, coincideNombre, deClave, diasEntre, edad, fechaCorta, hoy, iniciales, mascaraCelular, MES, norm, okCorreo } from '../lib/format';
import { Icon } from '../ui/Icon';
import { Avatar, Cargando, Drawer, DrawerFooter, EmptyRow, ErrorBox, EstatusSeg, Field, IB, Kpis, PillEstatus, Search, SecHead, Switch, Tabs, useCarga, useFeedback } from '../ui/kit';

export type { Cliente };

/** Separa la lista guardada del cliente en lo que viene del catálogo y lo adicional. */
const separar = (lista: string[], catalogo: ItemCatalogo[]) => {
  const del = new Map(catalogo.map((c) => [norm(c.nombre), c.nombre]));
  return {
    cat: lista.filter((x) => del.has(norm(x))).map((x) => del.get(norm(x))!),
    ad: lista.filter((x) => !del.has(norm(x))),
  };
};

function cumple(n?: string) {
  if (!n || !/^\d{4}-\d{2}-\d{2}$/.test(n)) return null;
  const b = deClave(n), t = hoy();
  let nx = new Date(t.getFullYear(), b.getMonth(), b.getDate());
  if (nx < t) nx = new Date(t.getFullYear() + 1, b.getMonth(), b.getDate());
  return { d: fechaCorta(b), dias: diasEntre(t, nx), mes: b.getMonth() === t.getMonth() };
}

/* ---------- Selector de enfermedades / lesiones (catálogo + adicionales) ---------- */
function SaludPicker({ titulo, catalogo, elegidas, adicionales, onChange, ph }: {
  titulo: string; catalogo: ItemCatalogo[]; elegidas: string[]; adicionales: string[]; ph: string;
  onChange: (elegidas: string[], adicionales: string[]) => void;
}) {
  const [q, setQ] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [idx, setIdx] = useState(0);
  const ya = new Set([...elegidas, ...adicionales].map(norm));
  const sugeridas = catalogo.filter((c) => !ya.has(norm(c.nombre)) && (!q.trim() || norm(c.nombre).includes(norm(q)))).slice(0, 8);
  const exacta = catalogo.find((c) => norm(c.nombre) === norm(q));
  const puedeAdicional = q.trim().length >= 2 && !exacta && !ya.has(norm(q));
  const opciones: { tipo: 'cat' | 'add'; texto: string }[] = [
    ...sugeridas.map((c) => ({ tipo: 'cat' as const, texto: c.nombre })),
    ...(puedeAdicional ? [{ tipo: 'add' as const, texto: q.trim() }] : []),
  ];
  const elegir = (o: { tipo: 'cat' | 'add'; texto: string }) => {
    if (o.tipo === 'cat') onChange([...elegidas, o.texto], adicionales);
    else onChange(elegidas, [...adicionales, o.texto.charAt(0).toUpperCase() + o.texto.slice(1)]);
    setQ(''); setIdx(0);
  };
  return (
    <div className="hl">
      <b>{titulo}</b>
      <div className="nu-combo">
        <div className="hadd">
          <input value={q} placeholder={ph} autoComplete="off" role="combobox" aria-expanded={abierto}
            onFocus={() => setAbierto(true)} onBlur={() => setTimeout(() => setAbierto(false), 150)}
            onChange={(e) => { setQ(e.target.value); setIdx(0); setAbierto(true); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, opciones.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
              else if (e.key === 'Enter') { e.preventDefault(); const o = exacta && !ya.has(norm(exacta.nombre)) ? { tipo: 'cat' as const, texto: exacta.nombre } : opciones[idx]; if (o) elegir(o); }
              else if (e.key === 'Escape') { e.stopPropagation(); setAbierto(false); }
            }} />
        </div>
        {abierto && opciones.length > 0 && (
          <ul className="nu-opts" role="listbox">
            {opciones.map((o, i) => (
              <li key={o.tipo + o.texto} role="option" aria-selected={i === idx} className={i === idx ? 'on' : ''} onMouseDown={(e) => { e.preventDefault(); elegir(o); }} onMouseEnter={() => setIdx(i)}>
                {o.tipo === 'cat' ? o.texto : <><Icon n="mas" w={2.4} />Agregar “{o.texto}” como adicional</>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <ul className="items">
        {elegidas.length + adicionales.length === 0 && <li className="empty">Sin {titulo.toLowerCase()} registradas.</li>}
        {elegidas.map((x) => <li key={'c' + x}>{x}<button type="button" aria-label={`Quitar ${x}`} onClick={() => onChange(elegidas.filter((y) => y !== x), adicionales)}><Icon n="x" w={2.6} /></button></li>)}
        {adicionales.map((x) => <li key={'a' + x} className="nu-adic" title="No está en el catálogo: se guarda solo en el perfil del cliente">{x}<span className="nu-tag">Adicional</span><button type="button" aria-label={`Quitar ${x}`} onClick={() => onChange(elegidas, adicionales.filter((y) => y !== x))}><Icon n="x" w={2.6} /></button></li>)}
      </ul>
    </div>
  );
}

interface Form {
  nombre: string; apellidos: string; nacimiento: string; correo: string; telefono: string; activo: boolean;
  tutor: string; ine: string; docs: Record<string, boolean>; validado: boolean;
  enf: string[]; enfAd: string[]; les: string[]; lesAd: string[]; terminado: boolean;
}
const VACIO: Form = { nombre: '', apellidos: '', nacimiento: '', correo: '', telefono: '', activo: true, tutor: '', ine: '', docs: {}, validado: false, enf: [], enfAd: [], les: [], lesAd: [], terminado: true };

export default function Clientes() {
  const { toast, confirmar } = useFeedback();
  const { data, setData, error, loading, recargar } = useCarga(async () => {
    const [clientes, enf, les] = await Promise.all([apiClientes.listar(), catalogoSalud('enfermedades'), catalogoSalud('lesiones')]);
    return { clientes, enf, les };
  });
  const clientes = data?.clientes ?? [];
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'all' | 'act' | 'none' | 'bday'>('all');
  const [inactivos, setInactivos] = useState(true);
  const [abierto, setAbierto] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [f, setF] = useState<Form>(VACIO);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const original = useRef<Cliente | null>(null);

  const maxFecha = claveDia(new Date());
  const tieneMem = (c: Cliente) => {
    const m = membresiaDe(c);
    return !!m && m.fechaFin >= maxFecha;
  };
  const activos = clientes.filter((c) => c.estatus === 'activo');
  const filtrar = (c: Cliente) =>
    tab === 'all' || (tab === 'act' && tieneMem(c)) || (tab === 'none' && !tieneMem(c)) || (tab === 'bday' && cumple(c.fechaNacimiento)?.mes);

  const lista = useMemo(() => clientes
    .filter((c) => (inactivos || c.estatus === 'activo') && filtrar(c) && coincideNombre(`${c.nombre} ${c.apellidos}`, q))
    .sort((a, b) => (a.estatus === b.estatus ? 0 : a.estatus === 'activo' ? -1 : 1)
      || (tab === 'bday' ? (cumple(a.fechaNacimiento)?.dias ?? 999) - (cumple(b.fechaNacimiento)?.dias ?? 999) : `${a.nombre} ${a.apellidos}`.localeCompare(`${b.nombre} ${b.apellidos}`, 'es'))),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [clientes, q, tab, inactivos]);

  const esMenor = (n: string) => { const e = edad(n); return e !== null && e < 18 && n <= maxFecha; };
  const menor = esMenor(f.nacimiento);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setF((x) => ({ ...x, [k]: v })); setErrs((e) => ({ ...e, [k]: '' })); };

  const abrir = (c?: Cliente) => {
    original.current = c ?? null;
    setEditId(c?.idUsuario ?? null);
    setF(c ? {
      nombre: c.nombre, apellidos: c.apellidos, nacimiento: c.fechaNacimiento ?? '', correo: c.correo, telefono: mascaraCelular(c.telefono ?? ''),
      activo: c.estatus === 'activo', tutor: c.tutor?.nombreCompleto ?? '', ine: c.tutor?.claveElector ?? '',
      docs: { ...(c.documentosMenor ?? {}) }, validado: !!c.menorValidado,
      enf: separar(c.enfermedades, data?.enf ?? []).cat, enfAd: separar(c.enfermedades, data?.enf ?? []).ad,
      les: separar(c.lesiones, data?.les ?? []).cat, lesAd: separar(c.lesiones, data?.les ?? []).ad, terminado: true,
    } : VACIO);
    setErrs({}); setAbierto(true);
  };

  const guardar = async () => {
    const e: Record<string, string> = {};
    const tel = f.telefono.replace(/\D/g, '');
    if (!f.nombre.trim()) e.nombre = 'Escribe el nombre.';
    if (!f.apellidos.trim()) e.apellidos = 'Escribe los apellidos.';
    if (!f.nacimiento) e.nacimiento = 'Elige la fecha de nacimiento.';
    else if (f.nacimiento > maxFecha) e.nacimiento = 'La fecha no puede ser futura.';
    if (!okCorreo(f.correo)) e.correo = 'Escribe un correo válido.';
    else if (clientes.some((c) => c.correo === f.correo.trim().toLowerCase() && c.idUsuario !== editId)) e.correo = 'Ya hay un cliente con este correo.';
    if (tel && tel.length !== 10) e.telefono = 'Escribe los 10 dígitos del celular.';
    if (menor) {
      if (f.tutor.trim().split(/\s+/).length < 2) e.tutor = 'Escribe el nombre completo del tutor (nombre y apellidos).';
      if (!/^[A-Z0-9]{18}$/.test(f.ine)) e.ine = 'Escribe la clave de elector (18 caracteres).';
    }
    setErrs(e);
    if (Object.keys(e).length) {
      setTimeout(() => (document.querySelector('.drawer.show .fld.err input') as HTMLInputElement | null)?.focus(), 0);
      return;
    }
    const datos: DatosCliente = {
      nombre: f.nombre.trim(), apellidos: f.apellidos.trim(), correo: f.correo.trim().toLowerCase(), telefono: tel, fechaNacimiento: f.nacimiento,
      activo: f.activo, enfermedades: [...f.enf, ...f.enfAd], lesiones: [...f.les, ...f.lesAd],
      menor: menor ? { nombreTutor: f.tutor.trim().replace(/\s+/g, ' '), claveElectorTutor: f.ine, validado: f.validado, documentos: Object.fromEntries(DOCS.map(([k]) => [k, !!f.docs[k]])) } : null,
    };
    setGuardando(true);
    try {
      if (editId) {
        const c = await apiClientes.actualizar(editId, datos);
        setData((d) => d && { ...d, clientes: d.clientes.map((x) => (x.idUsuario === editId ? c : x)) });
        toast('Cambios guardados', `Actualizamos los datos de ${c.nombre} ${c.apellidos}.`);
      } else {
        const c = await apiClientes.crear(datos);
        setData((d) => d && { ...d, clientes: [c, ...d.clientes] });
        toast('Cliente registrado', `${c.nombre} ${c.apellidos} ya puede reservar clases. Código: ${c.codigoAcceso}.`);
      }
      setAbierto(false);
    } catch (err) {
      toast('No se pudo guardar', mensajeError(err), 'error');
    } finally {
      setGuardando(false);
    }
  };

  const alternar = async (c: Cliente) => {
    const n = `${c.nombre} ${c.apellidos}`, activar = c.estatus !== 'activo';
    const ok = await confirmar(activar
      ? { t: `¿Reactivar a ${n}?`, p: 'Podrá volver a reservar clases y comprar paquetes.', y: 'Sí, reactivar', tono: 'ok' }
      : { t: `¿Dar de baja a ${n}?`, p: 'Ya no podrá reservar clases. Su historial y sus pagos se conservan, y puedes reactivarlo cuando quieras.', y: 'Sí, dar de baja', n: 'No, mantener activo' });
    if (!ok) return;
    try {
      const r = await apiClientes.activo(c.idUsuario, activar);
      setData((d) => d && { ...d, clientes: d.clientes.map((x) => (x.idUsuario === c.idUsuario ? r : x)) });
      toast(activar ? 'Cliente reactivado' : 'Cliente dado de baja', activar ? `${n} ya puede reservar clases.` : `${n} ya no puede reservar clases.`);
    } catch (err) { toast('No se pudo actualizar', mensajeError(err), 'error'); }
  };

  const edadF = f.nacimiento && f.nacimiento <= maxFecha ? edad(f.nacimiento) : null;
  const nDocs = DOCS.filter(([k]) => f.docs[k]).length;
  const orig = original.current;

  return (
    <>
      <Kpis items={[
        { label: 'Clientes activos', value: activos.length, tono: 'ok', icon: 'clientes' },
        { label: 'Con membresía activa', value: activos.filter(tieneMem).length, tono: 'accent', icon: 'membresias' },
        { label: 'Sin membresía o vencida', value: activos.filter((c) => !tieneMem(c)).length, tono: 'warn', icon: 'alerta' },
        { label: 'Cumpleaños este mes', value: activos.filter((c) => cumple(c.fechaNacimiento)?.mes).length, tono: 'purple', icon: 'pastel' },
        { label: 'Clientes inactivos', value: clientes.filter((c) => c.estatus !== 'activo').length, tono: 'bad', icon: 'candado' },
      ]} />
      <SecHead title="Clientes del club"><Search value={q} onChange={setQ} placeholder="Buscar por nombre y/o apellido" /></SecHead>
      <div className="tabrow">
        <Tabs value={tab} onChange={setTab} tabs={[
          ['all', 'Todos', clientes.length],
          ['act', 'Con membresía', clientes.filter(tieneMem).length],
          ['none', 'Sin membresía', clientes.filter((c) => !tieneMem(c)).length],
          ['bday', 'Cumpleaños del mes', clientes.filter((c) => cumple(c.fechaNacimiento)?.mes).length],
        ]} />
        <Switch checked={inactivos} onChange={setInactivos} label="Mostrar inactivos" />
        <button className="btn acc" style={{ marginLeft: 'auto' }} onClick={() => abrir()}><Icon n="mas" w={2.4} />Nuevo cliente</button>
      </div>
      {error && <ErrorBox mensaje={error} onRetry={recargar} />}
      <table>
        <thead><tr><th>Cliente</th><th>Correo electrónico</th><th>Celular</th><th>Cumpleaños</th><th>Membresía</th><th>Estatus</th><th className="r">Acciones</th></tr></thead>
        <tbody>
          {loading ? <Cargando cols={7} /> : lista.length ? lista.map((c) => {
            const on = c.estatus === 'activo', b = cumple(c.fechaNacimiento), n = `${c.nombre} ${c.apellidos}`;
            const m = membresiaDe(c);
            const fin = m ? deClave(m.fechaFin) : null, quedan = fin ? diasEntre(hoy(), fin) : 0;
            const cake = b && (b.dias === 0 ? 'Hoy' : b.dias <= 7 ? `En ${b.dias} día${b.dias > 1 ? 's' : ''}` : '');
            const docs = c.documentosMenor ? DOCS.filter(([k]) => c.documentosMenor?.[k]).length : 0;
            return (
              <tr key={c.idUsuario} className={`r ${on ? '' : 'inact'}`}>
                <td><div className="who"><Avatar texto={iniciales(c.nombre, c.apellidos)} />
                  <div><b>{n}</b><small className="mono">{c.codigoAcceso}</small></div></div></td>
                <td className="fade mail">{c.correo}</td>
                <td className="fade">{c.telefono ? celular(c.telefono) : <span className="none">Sin registrar</span>}</td>
                <td className="fade"><div className="bday"><div>
                  <b>{b?.d ?? <span className="none">Sin registrar</span>}</b>
                  {b && <small>{edad(c.fechaNacimiento)} años{on && cake ? ' · ' : ''}{on && cake && <span className="cake"><Icon n="pastel" />{cake}</span>}</small>}
                  {c.tutor && <div className="mtags"><span className="minor" style={{ margin: 0 }}>Menor</span>
                    {c.menorValidado ? <span className="dcount ok">Validado</span> : <span className={`dcount ${docs === 4 ? 'ok' : ''}`}>Docs {docs}/4</span>}</div>}
                </div></div></td>
                <td className="mem fadeok">{m ? <><b>{m.nombre}</b><small className={quedan < 0 ? 'exp' : quedan <= 7 ? 'warn' : ''}>
                  {quedan < 0 ? `Venció el ${fin!.getDate()} ${MES[fin!.getMonth()]}` : quedan === 0 ? 'Vence hoy' : `Vence el ${fin!.getDate()} ${MES[fin!.getMonth()]}${quedan <= 7 ? ` · ${quedan} día${quedan > 1 ? 's' : ''}` : ''}`}</small></>
                  : <span className="nomem">Sin membresía</span>}</td>
                <td><PillEstatus activo={on} />
</td>
                <td><div className="acts">
                  <IB icon="editar" tip="Editar" label={`Editar a ${n}`} onClick={() => abrir(c)} />
                  {on ? <IB icon="off" kind="off" tip="Dar de baja" label={`Dar de baja a ${n}`} onClick={() => alternar(c)} />
                    : <IB icon="on" kind="on" tip="Reactivar" label={`Reactivar a ${n}`} onClick={() => alternar(c)} />}
                </div></td>
              </tr>
            );
          }) : <EmptyRow cols={7} title="No encontramos clientes" text="Prueba con otro nombre, apellido o filtro." />}
        </tbody>
      </table>

      <Drawer open={abierto} onClose={() => setAbierto(false)} onSubmit={guardar}
        title={editId ? 'Editar cliente' : 'Nuevo cliente'}
        sub={editId && orig ? <>{orig.nombre} {orig.apellidos} · <span className="mono">{orig.codigoAcceso}</span></> : 'Registra a una persona que entrena en el club.'}
        footer={<DrawerFooter label={editId ? 'Guardar cambios' : 'Registrar cliente'} onSave={guardar} onCancel={() => setAbierto(false)} saving={guardando} />}>
        <div className="lbl">Datos personales</div>
        <div className="sbox">
          <Field label="Nombre(s)" req error={errs.nombre}><input placeholder="Ej. Juan" value={f.nombre} onChange={(e) => set('nombre', e.target.value)} autoComplete="off" /></Field>
          <Field label="Apellido(s)" req error={errs.apellidos}><input placeholder="Ej. Pérez López" value={f.apellidos} onChange={(e) => set('apellidos', e.target.value)} autoComplete="off" /></Field>
          <Field label={<>Fecha de nacimiento <em className="req">*</em>{edadF !== null && <span className="agetag">· {edadF} años{menor && <span className="minor">Menor de edad</span>}</span>}</>} error={errs.nacimiento}>
            <input type="date" max={maxFecha} min="1920-01-01" value={f.nacimiento} onChange={(e) => set('nacimiento', e.target.value)} />
          </Field>
          <Field label="Correo electrónico" req error={errs.correo} hint="Debe ser único. Lo usamos para enviarle su felicitación de cumpleaños y para entrar a la app.">
            <input type="email" placeholder="nombre@correo.com" value={f.correo} onChange={(e) => set('correo', e.target.value)} autoComplete="off" />
          </Field>
          <Field label="Celular" opt last error={errs.telefono}><input inputMode="numeric" placeholder="10 dígitos" value={f.telefono} onChange={(e) => set('telefono', mascaraCelular(e.target.value))} autoComplete="off" /></Field>
        </div>

        {menor && (
          <>
            <div className="lbl">Padre, madre o tutor <span className="minor">Menor de edad</span></div>
            <div className="sbox">
              <Field label="Nombre completo del padre, madre o tutor" req error={errs.tutor}><input placeholder="Nombre y apellidos" value={f.tutor} onChange={(e) => set('tutor', e.target.value)} autoComplete="off" /></Field>
              <Field label="Clave de elector (INE)" req error={errs.ine} hint="Clave de elector de 18 caracteres.">
                <input className="mono" placeholder="CLAVE DE ELECTOR" maxLength={18} value={f.ine} onChange={(e) => set('ine', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} autoComplete="off" />
              </Field>
              <div className="sep" />
              <div className="chead"><b>Copias entregadas</b><span className={`dcount ${nDocs === 4 ? 'ok' : ''}`}>{nDocs} de 4</span></div>
              <div className="checks">
                {DOCS.map(([k, l]) => (
                  <label className="chk" key={k}><input type="checkbox" checked={!!f.docs[k]} onChange={(e) => set('docs', { ...f.docs, [k]: e.target.checked })} /><span className="box2" />{l}</label>
                ))}
              </div>
              <div className="sep" />
              <label className="swrow" style={{ paddingBottom: 14 }}>
                <span><b>Menor validado con sus documentos</b><small>Se piden una sola vez: al renovar o comprar otra membresía ya no se vuelven a solicitar. Puedes registrar al cliente aunque falte algún documento.</small></span>
                <Switch bare checked={f.validado} onChange={(v) => set('validado', v)} />
              </label>
            </div>
          </>
        )}

        <div className="lbl">Salud</div>
        <div className="sbox">
          <p className="shint">Elige de la lista. Si no aparece, escríbela y agrégala como adicional: se guarda solo en este cliente y no cambia el catálogo.</p>
          <SaludPicker titulo="Enfermedades" ph="Buscar enfermedad… Ej. Asma" catalogo={data?.enf ?? []} elegidas={f.enf} adicionales={f.enfAd}
            onChange={(a, b) => setF((x) => ({ ...x, enf: a, enfAd: b }))} />
          <div className="sep" />
          <SaludPicker titulo="Lesiones" ph="Buscar lesión… Ej. Esguince de tobillo" catalogo={data?.les ?? []} elegidas={f.les} adicionales={f.lesAd}
            onChange={(a, b) => setF((x) => ({ ...x, les: a, lesAd: b }))} />
        </div>

        <div className="lbl">Estatus</div>
        <div className="sbox stsb">
          <EstatusSeg activo={f.activo} onChange={(v) => set('activo', v)}
            textoOn={<><b style={{ color: 'var(--ink)' }}>Puede reservar clases</b> y comprar paquetes.</>}
            textoOff={<><b style={{ color: 'var(--ink)' }}>No podrá reservar clases.</b> Su historial se conserva.</>} />
        </div>
        <div className="note"><Icon n="membresias" /><span>Las <b>membresías</b> se venden y se consultan en el módulo de Membresías; no se modifican desde este formulario.</span></div>
      </Drawer>
    </>
  );
}
