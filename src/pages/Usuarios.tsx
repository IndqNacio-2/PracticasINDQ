import { useMemo, useState } from 'react';
import { admin, mensajeError } from '../lib/api';
import { celular, fechaCorta, horaDe, iniciales, mascaraCelular, norm, okCorreo } from '../lib/format';
import type { Rol, Usuario } from '../lib/session';
import { useSesion } from '../shell/AppShell';
import { Icon } from '../ui/Icon';
import { Avatar, Cargando, Drawer, DrawerFooter, EmptyRow, ErrorBox, EstatusSeg, Field, IB, Kpis, PillEstatus, Search, SecHead, Switch, Tabs, useCarga, useFeedback } from '../ui/kit';

type RolUsuario = Exclude<Rol, never>;
const ROLES: Record<RolUsuario, { n: string; p: string; d: string; cls: string }> = {
  administrador: { n: 'Administrador', p: 'ADM', d: 'Acceso total: usuarios, reportes y configuración.', cls: 'r-adm' },
  entrenador: { n: 'Entrenador', p: 'ENT', d: 'Ve sus clases y la lista de asistentes.', cls: 'r-ent' },
  recepcion: { n: 'Recepción', p: 'REC', d: 'Registra llegadas, cobra y da de alta clientes.', cls: 'r-rec' },
  vendedor: { n: 'Vendedor', p: 'VEN', d: 'Vende paquetes y productos en punto de venta.', cls: 'r-ven' },
  checador: { n: 'Checador', p: 'CHE', d: 'Cuenta del reloj checador: solo abre esa pantalla.', cls: 'r-che' },
};

interface Form { nombre: string; apellidos: string; correo: string; telefono: string; codigo: string; rol: RolUsuario | null; password: string; activo: boolean; foto: string }
const VACIO: Form = { nombre: '', apellidos: '', correo: '', telefono: '', codigo: '', rol: null, password: '', activo: true, foto: '' };

export default function Usuarios() {
  const yo = useSesion();
  const { toast, confirmar } = useFeedback();
  const { data, setData, error, loading, recargar } = useCarga(() => admin.get<Usuario[]>('/usuarios'));
  const lista = data ?? [];
  const [q, setQ] = useState('');
  const [rolF, setRolF] = useState<'all' | RolUsuario>('all');
  const [inactivos, setInactivos] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [f, setF] = useState<Form>(VACIO);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [verPw, setVerPw] = useState(false);
  const [fotoMsg, setFotoMsg] = useState('');
  const [guardando, setGuardando] = useState(false);

  const activos = lista.filter((u) => u.estatus === 'activo');
  const cuenta = (r: RolUsuario) => activos.filter((u) => u.rol === r).length;
  const filtrados = useMemo(() => {
    const t = norm(q), d = q.replace(/\D/g, '');
    return lista
      .filter((u) => (rolF === 'all' || u.rol === rolF) && (inactivos || u.estatus === 'activo'))
      .filter((u) => !t || norm(`${u.nombre} ${u.apellidos} ${u.correo} ${u.codigoAcceso}`).includes(t) || (d && (u.telefono ?? '').includes(d)))
      .sort((a, b) => (a.estatus === b.estatus ? 0 : a.estatus === 'activo' ? -1 : 1) || `${a.nombre} ${a.apellidos}`.localeCompare(`${b.nombre} ${b.apellidos}`, 'es'));
  }, [lista, q, rolF, inactivos]);

  const siguienteCodigo = (r: RolUsuario) => {
    const p = ROLES[r].p;
    const n = lista.map((u) => (u.codigoAcceso ?? '').toUpperCase()).filter((c) => c.startsWith(p)).map((c) => Number(c.replace(/\D/g, '')) || 0);
    const todos = lista.map((u) => Number((u.codigoAcceso ?? '').replace(/\D/g, '')) || 0);
    let sig = (n.length ? Math.max(...n) : 0) + 1;
    while (todos.includes(sig)) sig++; // el número no puede repetirse entre roles
    return `${p}${String(sig).padStart(3, '0')}`;
  };

  const abrir = (u?: Usuario) => {
    setEditId(u?.idUsuario ?? null);
    setF(u ? { nombre: u.nombre, apellidos: u.apellidos, correo: u.correo, telefono: mascaraCelular(u.telefono ?? ''), codigo: u.codigoAcceso ?? '', rol: u.rol, password: '', activo: u.estatus === 'activo', foto: u.foto ?? '' } : VACIO);
    setErrs({}); setFotoMsg(''); setVerPw(false); setAbierto(true);
  };
  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setF((x) => ({ ...x, [k]: v })); setErrs((e) => ({ ...e, [k]: '' })); };

  const elegirRol = (r: RolUsuario) => {
    setF((x) => ({ ...x, rol: r, codigo: !editId && (!x.codigo || (x.rol && x.codigo.startsWith(ROLES[x.rol].p))) ? siguienteCodigo(r) : x.codigo }));
    setErrs((e) => ({ ...e, rol: '' }));
  };

  const cargarFoto = (file?: File) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return setFotoMsg('Formato no permitido. Usa JPG, PNG o WEBP.');
    if (file.size > 10 * 1024 * 1024) return setFotoMsg('La foto pesa más de 10 MB. Elige una más ligera.');
    setFotoMsg('');
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const S = 320, c = document.createElement('canvas'), m = Math.min(img.width, img.height);
      c.width = c.height = S;
      c.getContext('2d')!.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, S, S);
      set('foto', c.toDataURL('image/jpeg', 0.85));
      URL.revokeObjectURL(url);
    };
    img.onerror = () => setFotoMsg('No pudimos leer la imagen. Prueba con otra.');
    img.src = url;
  };

  const guardar = async () => {
    const e: Record<string, string> = {};
    const tel = f.telefono.replace(/\D/g, '');
    if (!f.nombre.trim()) e.nombre = 'Escribe el nombre.';
    if (!f.apellidos.trim()) e.apellidos = 'Escribe los apellidos.';
    if (!okCorreo(f.correo)) e.correo = 'Escribe un correo válido.';
    else if (lista.some((u) => u.correo === f.correo.trim().toLowerCase() && u.idUsuario !== editId)) e.correo = 'Ya hay un usuario con este correo.';
    if (tel && tel.length !== 10) e.telefono = 'Escribe los 10 dígitos del celular.';
    if (!f.rol) e.rol = 'Elige un rol.';
    const cod = f.codigo.trim().toUpperCase();
    if (!cod) e.codigo = 'Escribe un código.';
    else if (f.rol && !new RegExp(`^${ROLES[f.rol].p}\\d{1,27}$`).test(cod)) e.codigo = `Debe empezar con ${f.rol ? ROLES[f.rol].p : ''} seguido de números (ej. ${f.rol ? siguienteCodigo(f.rol) : ''}).`;
    else if (lista.some((u) => u.idUsuario !== editId && (Number((u.codigoAcceso ?? '').replace(/\D/g, '')) || -1) === Number(cod.replace(/\D/g, '')))) e.codigo = 'Este código ya existe.';
    if (editId ? f.password.length > 0 && f.password.length < 8 : f.password.length < 8) e.password = 'Escribe al menos 8 caracteres.';
    setErrs(e);
    if (Object.keys(e).length) return;
    const cuerpo: Record<string, unknown> = {
      nombre: f.nombre.trim(), apellidos: f.apellidos.trim(), correo: f.correo.trim().toLowerCase(), telefono: tel,
      codigoAcceso: cod, rol: f.rol, estatus: f.activo ? 'activo' : 'inactivo', foto: f.foto,
    };
    if (f.password) cuerpo.password = f.password;
    setGuardando(true);
    try {
      if (editId) {
        const u = await admin.patch<Usuario>(`/usuarios/${editId}`, cuerpo);
        setData((l) => (l ?? []).map((x) => (x.idUsuario === editId ? u : x)));
        toast('Cambios guardados', `Actualizamos los datos de ${u.nombre} ${u.apellidos}.`);
      } else {
        const u = await admin.post<Usuario>('/usuarios', cuerpo);
        setData((l) => [...(l ?? []), u]);
        toast('Usuario creado', `${u.nombre} ${u.apellidos} ya puede iniciar sesión con su correo y contraseña.`);
      }
      setAbierto(false);
    } catch (err) {
      toast('No se pudo guardar', mensajeError(err), 'error');
    } finally {
      setGuardando(false);
    }
  };

  const alternar = async (u: Usuario) => {
    const nombre = `${u.nombre} ${u.apellidos}`;
    const activar = u.estatus !== 'activo';
    const ok = await confirmar(activar
      ? { t: `¿Reactivar a ${nombre}?`, p: 'Podrá volver a iniciar sesión con su correo y contraseña.', y: 'Sí, reactivar', tono: 'ok' }
      : { t: `¿Desactivar a ${nombre}?`, p: 'Ya no podrá iniciar sesión. Su historial se conserva y puedes reactivarlo cuando quieras.', y: 'Sí, desactivar', n: 'No, mantener activo' });
    if (!ok) return;
    try {
      const r = await admin.patch<Usuario>(`/usuarios/${u.idUsuario}`, { estatus: activar ? 'activo' : 'inactivo' });
      setData((l) => (l ?? []).map((x) => (x.idUsuario === u.idUsuario ? r : x)));
      toast(activar ? 'Usuario reactivado' : 'Usuario desactivado', activar ? `${nombre} ya puede iniciar sesión.` : `${nombre} ya no puede iniciar sesión.`);
    } catch (err) {
      toast('No se pudo actualizar', mensajeError(err), 'error');
    }
  };

  const esYo = editId === yo.idUsuario;
  return (
    <>
      <Kpis items={[
        { label: 'Administradores activos', value: cuenta('administrador'), tono: 'purple', icon: 'escudo' },
        { label: 'Entrenadores activos', value: cuenta('entrenador'), tono: 'blue', icon: 'pesa' },
        { label: 'Recepción activos', value: cuenta('recepcion'), tono: 'accent', icon: 'recepcion' },
        { label: 'Vendedores activos', value: cuenta('vendedor'), tono: 'gray', icon: 'venta' },
        { label: 'Personal inactivo', value: lista.length - activos.length, tono: 'bad', icon: 'off' },
      ]} />
      <SecHead title="Usuarios de la plataforma"><Search value={q} onChange={setQ} placeholder="Buscar por nombre, correo, celular o código" /></SecHead>
      <div className="tabrow">
        <Tabs value={rolF} onChange={setRolF} tabs={[['all', 'Todos', lista.length], ...(Object.keys(ROLES) as RolUsuario[]).map((r) => [r, ROLES[r].n, lista.filter((u) => u.rol === r).length] as [RolUsuario, string, number])]} />
        <Switch checked={inactivos} onChange={setInactivos} label="Mostrar inactivos" />
        <button className="btn acc" style={{ marginLeft: 'auto' }} onClick={() => abrir()}><Icon n="mas" w={2.4} />Nuevo usuario</button>
      </div>
      {error && <ErrorBox mensaje={error} onRetry={recargar} />}
      <table>
        <thead><tr><th>Usuario</th><th>Correo electrónico</th><th>Celular</th><th>Código</th><th>Rol</th><th>Estatus</th><th>Fecha de alta</th><th className="r">Acciones</th></tr></thead>
        <tbody>
          {loading ? <Cargando cols={8} /> : filtrados.length ? filtrados.map((u) => {
            const on = u.estatus === 'activo', me = u.idUsuario === yo.idUsuario, nombre = `${u.nombre} ${u.apellidos}`;
            return (
              <tr key={u.idUsuario} className={`r ${on ? '' : 'inact'}`}>
                <td><div className="who"><Avatar texto={iniciales(u.nombre, u.apellidos)} foto={u.foto} /><div><b>{nombre}{me && <span className="you">Tú</span>}</b></div></div></td>
                <td className="fade mail">{u.correo}</td>
                <td className="fade">{u.telefono ? celular(u.telefono) : <span className="none">Sin registrar</span>}</td>
                <td className="fade mono">{u.codigoAcceso}</td>
                <td className="fade"><span className={`pill ${ROLES[u.rol]?.cls ?? 'r-ven'}`}>{ROLES[u.rol]?.n ?? u.rol}</span></td>
                <td><PillEstatus activo={on} /></td>
                <td className="fade dt"><b>{fechaCorta(u.fechaCreacion)}</b><small>{u.fechaCreacion ? horaDe(u.fechaCreacion) : ''}</small></td>
                <td><div className="acts">
                  <IB icon="editar" tip="Editar" label={`Editar a ${nombre}`} onClick={() => abrir(u)} />
                  {on ? <IB icon="off" kind="off" tip="Desactivar" label={`Desactivar a ${nombre}`} na={me && 'No puedes desactivar tu propio usuario'} onClick={() => alternar(u)} />
                    : <IB icon="on" kind="on" tip="Reactivar" label={`Reactivar a ${nombre}`} onClick={() => alternar(u)} />}
                </div></td>
              </tr>
            );
          }) : <EmptyRow cols={8} title="No encontramos usuarios" text="Prueba con otro nombre, código o rol." />}
        </tbody>
      </table>

      <Drawer open={abierto} onClose={() => setAbierto(false)} onSubmit={guardar}
        title={editId ? 'Editar usuario' : 'Nuevo usuario'}
        sub={editId ? `Alta: ${fechaCorta(lista.find((u) => u.idUsuario === editId)?.fechaCreacion)}` : 'Da de alta a una persona del equipo.'}
        footer={<DrawerFooter label={editId ? 'Guardar cambios' : 'Crear usuario'} onSave={guardar} onCancel={() => setAbierto(false)} saving={guardando} />}>
        <div className="lbl">Foto de perfil</div>
        <div className="photo">
          <span className={`pav ${f.foto ? 'has' : ''}`}>{f.foto ? <img src={f.foto} alt="Foto de perfil" /> : <Icon n="persona" w={1.8} />}</span>
          <div className="pinfo"><small style={{ marginTop: 0 }}>Opcional · JPG, PNG o WEBP, máximo 10 MB. Se reduce automáticamente.</small>
            <div className="pbtns">
              <label className="btn line sm"><Icon n="camara" />{f.foto ? 'Cambiar foto' : 'Agregar foto'}
                <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { cargarFoto(e.target.files?.[0]); e.target.value = ''; }} /></label>
              {f.foto && <button type="button" className="plink" onClick={() => set('foto', '')}>Quitar</button>}
            </div>
            <div className="pmsg">{fotoMsg}</div>
          </div>
        </div>
        <div className="lbl">Datos personales</div>
        <div className="sbox">
          <Field label="Nombre(s)" req error={errs.nombre}><input value={f.nombre} onChange={(e) => set('nombre', e.target.value)} autoComplete="off" /></Field>
          <Field label="Apellido(s)" req error={errs.apellidos}><input value={f.apellidos} onChange={(e) => set('apellidos', e.target.value)} autoComplete="off" /></Field>
          <Field label="Correo electrónico" req error={errs.correo}><input type="email" value={f.correo} placeholder="nombre@nuucleo.mx" onChange={(e) => set('correo', e.target.value)} autoComplete="off" /></Field>
          <Field label="Celular" opt last error={errs.telefono}><input inputMode="numeric" placeholder="10 dígitos" value={f.telefono} onChange={(e) => set('telefono', mascaraCelular(e.target.value))} autoComplete="off" /></Field>
        </div>
        <div className="lbl">Rol y acceso</div>
        <div className="sbox">
          <div className="fld" style={{ marginBottom: 10 }}><label>Rol <em className="req">*</em></label></div>
          <div className={`roles-wrap ${errs.rol ? 'err' : ''}`}>
            <div className="roles">
              {(Object.keys(ROLES) as RolUsuario[]).filter((r) => r !== 'checador' || f.rol === 'checador').map((r) => (
                <button type="button" key={r} className={`role ${f.rol === r ? 'on' : ''}`} onClick={() => elegirRol(r)} disabled={esYo && r !== f.rol}>
                  <i /><span><b>{ROLES[r].n}</b><small>{ROLES[r].d}</small></span>
                </button>
              ))}
            </div>
            <div className="rmsg">Elige un rol.</div>
          </div>
          <Field label="Código de acceso" req error={errs.codigo} hint="Se genera según el rol; puedes cambiarlo." style={{ marginTop: 18 }}>
            <input className="mono" value={f.codigo} onChange={(e) => set('codigo', e.target.value.toUpperCase())} autoComplete="off" />
          </Field>
          <Field label={editId ? <>Nueva contraseña <span className="opt">Opcional</span></> : 'Contraseña'} req={!editId} last error={errs.password}
            hint={editId ? 'Déjala vacía para conservar la actual.' : 'Compártela con la persona; podrá cambiarla después.'}>
            <div className="pww">
              <input type={verPw ? 'text' : 'password'} autoComplete="new-password" placeholder="Mínimo 8 caracteres" value={f.password} onChange={(e) => set('password', e.target.value)} />
              <button type="button" className="eye" aria-label={verPw ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setVerPw(!verPw)}><Icon n={verPw ? 'ojoNo' : 'ojo'} /></button>
            </div>
          </Field>
        </div>
        <div className="lbl">Estatus</div>
        <div className="sbox stsb">
          <EstatusSeg activo={f.activo} onChange={(v) => set('activo', v)}
            textoOn={<><b style={{ color: 'var(--ink)' }}>Podrá iniciar sesión</b> con su correo y contraseña.</>}
            textoOff={<><b style={{ color: 'var(--ink)' }}>No podrá iniciar sesión.</b> Puedes reactivarlo después.</>}
            bloqueado={esYo ? <><b style={{ color: 'var(--ink)' }}>Es tu usuario.</b> No puedes desactivarte a ti mismo.</> : undefined} />
        </div>
      </Drawer>
    </>
  );
}
