import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Badge } from '../../components/Badge';
import { DataState } from '../../components/DataState';
import { api } from '../../lib/api';
import type { Cliente, Reservacion } from '../../types';

type Tab = 'general' | 'salud' | 'actividad' | 'membresia' | 'historial';

const tabs: { value: Tab; label: string }[] = [
  { value: 'general', label: 'Datos Generales' },
  { value: 'salud', label: 'Perfil de Salud' },
  { value: 'actividad', label: 'Actividad' },
  { value: 'membresia', label: 'Membresía' },
  { value: 'historial', label: 'Historial' },
];

const nivelLabels: Record<string, string> = {
  sedentario: 'Sedentario', ligero: 'Ligero', moderado: 'Moderado',
  activo: 'Activo', 'muy activo': 'Muy activo',
};

const membresiaColors: Record<string, string> = {
  mensual: 'bg-[color:var(--info-bg)] text-[color:var(--info)]',
  trimestral: 'bg-[color:var(--violet-bg)] text-[color:var(--violet)]',
  semestral: 'bg-[color:var(--warn-bg)] text-[color:var(--warn-ink)]',
  anual: 'bg-[color:var(--ok-bg)] text-[color:var(--ok-ink)]',
};

function InfoRow({ label, value }: { label: string; value?: string | number }) {
  return (
    <div className="flex justify-between py-3 border-b border-[color:var(--line)] last:border-0">
      <span className="text-sm text-[color:var(--ink2)]">{label}</span>
      <span className="text-sm font-medium text-[color:var(--ink)] text-right max-w-xs">{value ?? '—'}</span>
    </div>
  );
}

export function ClienteDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('general');

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [reservas, setReservas] = useState<Reservacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [clienteRes, reservasRes] = await Promise.all([
        api.get<Cliente>(`/clientes/${id}`),
        api.get<Reservacion[]>(`/reservaciones?idCliente=${id}`),
      ]);
      setCliente(clienteRes);
      setReservas(reservasRes);
    } catch {
      setError('No se pudo cargar el expediente del cliente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const calcEdad = (fecha: string) => {
    const diff = Date.now() - new Date(fecha).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  };

  if (loading || error) {
    return <DataState loading={loading} error={error} onRetry={load} />;
  }

  if (!cliente) return (
    <div className="text-center py-20 text-[color:var(--ink3)]">
      <p className="text-lg">Cliente no encontrado</p>
      <button onClick={() => navigate('/clientes')} className="mt-4 text-[color:var(--ink)] hover:underline text-sm">← Volver a clientes</button>
    </div>
  );

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/clientes')} className="p-2 rounded-xl text-[color:var(--ink3)] hover:text-[color:var(--ink)] hover:bg-[color:var(--soft)] transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--ink)]">
            {cliente.nombre} {cliente.apellidos}
          </h1>
          <p className="text-[color:var(--ink2)] text-sm">Expediente de cliente · {cliente.codigoAcceso}</p>
        </div>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-2xl p-6 border border-[color:var(--line)]">
        <div className="flex items-start gap-5">
          {cliente.avatar
            ? <img src={cliente.avatar} alt="" className="w-16 h-16 rounded-2xl object-cover bg-[color:var(--soft)] flex-shrink-0" />
            : <div className="w-16 h-16 rounded-2xl bg-[color:var(--avatar)] flex items-center justify-center text-[color:var(--ink)] text-xl font-bold flex-shrink-0">{cliente.nombre[0]}{cliente.apellidos[0]}</div>
          }
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-lg font-semibold text-[color:var(--ink)]">{cliente.nombre} {cliente.apellidos}</h2>
              <Badge variant={cliente.estatus} />
              {cliente.membresia && <Badge variant={cliente.membresia.estatus} label={`Membresía ${cliente.membresia.tipo}`} />}
            </div>
            <p className="text-[color:var(--ink2)] text-sm mt-1">{cliente.correo} · {cliente.telefono}</p>
            <p className="text-[color:var(--ink2)] text-sm">{cliente.direccion}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-[color:var(--ink3)]">Registrado</p>
            <p className="text-sm font-medium text-[color:var(--ink)]">{cliente.fechaRegistro}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-[color:var(--line)] overflow-hidden">
        <div className="flex border-b border-[color:var(--line)] overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.value} onClick={() => setActiveTab(tab.value)}
              className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${activeTab === tab.value ? 'border-[color:var(--dark)] text-[color:var(--ink)] bg-[color:var(--soft)]' : 'border-transparent text-[color:var(--ink2)] hover:text-[color:var(--ink)]'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'general' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-semibold text-[color:var(--ink)] mb-3">Información Personal</h3>
                <InfoRow label="Nombre completo" value={`${cliente.nombre} ${cliente.apellidos}`} />
                <InfoRow label="Fecha de nacimiento" value={cliente.fechaNacimiento} />
                <InfoRow label="Edad" value={cliente.fechaNacimiento ? `${calcEdad(cliente.fechaNacimiento)} años` : undefined} />
                <InfoRow label="Correo electrónico" value={cliente.correo} />
                <InfoRow label="Teléfono" value={cliente.telefono} />
                <InfoRow label="Dirección" value={cliente.direccion} />
              </div>
              <div>
                <h3 className="font-semibold text-[color:var(--ink)] mb-3">Datos del Sistema</h3>
                <InfoRow label="ID Cliente" value={cliente.idUsuario} />
                <InfoRow label="Código de acceso" value={cliente.codigoAcceso} />
                <InfoRow label="Fecha de registro" value={cliente.fechaRegistro} />
                <InfoRow label="Estatus" value={cliente.estatus} />
              </div>
            </div>
          )}

          {activeTab === 'salud' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {cliente.perfilSalud ? (
                <>
                  <div>
                    <h3 className="font-semibold text-[color:var(--ink)] mb-3">Métricas Físicas</h3>
                    <InfoRow label="Peso" value={`${cliente.perfilSalud.peso} kg`} />
                    <InfoRow label="Altura" value={`${cliente.perfilSalud.altura} cm`} />
                    <InfoRow label="IMC" value={`${(cliente.perfilSalud.peso / Math.pow(cliente.perfilSalud.altura / 100, 2)).toFixed(1)}`} />
                    <InfoRow label="Tipo de sangre" value={cliente.perfilSalud.tipoSangre} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[color:var(--ink)] mb-3">Condición Médica</h3>
                    <div className="py-3 border-b border-[color:var(--line)]">
                      <p className="text-sm text-[color:var(--ink2)] mb-1.5">Alergias</p>
                      <div className="flex flex-wrap gap-1.5">
                        {cliente.perfilSalud.alergias.length > 0
                          ? cliente.perfilSalud.alergias.map(a => <span key={a} className="px-2 py-0.5 bg-[color:var(--bad-bg)] text-[color:var(--bad)] text-xs rounded-lg">{a}</span>)
                          : <span className="text-sm text-[color:var(--ink3)]">Ninguna registrada</span>}
                      </div>
                    </div>
                    <div className="py-3 border-b border-[color:var(--line)]">
                      <p className="text-sm text-[color:var(--ink2)] mb-1.5">Enfermedades</p>
                      <div className="flex flex-wrap gap-1.5">
                        {cliente.perfilSalud.enfermedades.length > 0
                          ? cliente.perfilSalud.enfermedades.map(e => <span key={e} className="px-2 py-0.5 bg-[color:var(--warn-bg)] text-[color:var(--warn)] text-xs rounded-lg">{e}</span>)
                          : <span className="text-sm text-[color:var(--ink3)]">Ninguna registrada</span>}
                      </div>
                    </div>
                    <div className="py-3 border-b border-[color:var(--line)]">
                      <p className="text-sm text-[color:var(--ink2)] mb-1.5">Lesiones previas</p>
                      <div className="flex flex-wrap gap-1.5">
                        {cliente.perfilSalud.lesiones.length > 0
                          ? cliente.perfilSalud.lesiones.map(l => <span key={l} className="px-2 py-0.5 bg-[color:var(--warn-bg)] text-[color:var(--warn)] text-xs rounded-lg">{l}</span>)
                          : <span className="text-sm text-[color:var(--ink3)]">Ninguna registrada</span>}
                      </div>
                    </div>
                    {cliente.perfilSalud.observaciones && (
                      <div className="py-3">
                        <p className="text-sm text-[color:var(--ink2)] mb-1">Observaciones</p>
                        <p className="text-sm text-[color:var(--ink)] bg-[color:var(--warn-bg)] p-3 rounded-xl border border-[color:var(--warn-bg)]">{cliente.perfilSalud.observaciones}</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-[color:var(--ink3)] col-span-2 text-center py-8">Sin perfil de salud registrado</p>
              )}
            </div>
          )}

          {activeTab === 'actividad' && (
            <div>
              {cliente.perfilActividad ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="font-semibold text-[color:var(--ink)] mb-3">Perfil de Actividad</h3>
                    <InfoRow label="Nivel de actividad" value={nivelLabels[cliente.perfilActividad.nivelActividad]} />
                    <InfoRow label="Objetivo principal" value={cliente.perfilActividad.objetivo} />
                    <InfoRow label="Frecuencia de ejercicio" value={cliente.perfilActividad.frecuenciaEjercicio} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[color:var(--ink)] mb-3">Intereses</h3>
                    <div className="pt-2">
                      <p className="text-sm text-[color:var(--ink2)] mb-3">Hobbies y deportes</p>
                      <div className="flex flex-wrap gap-2">
                        {cliente.perfilActividad.hobbies.map(h => (
                          <span key={h} className="px-3 py-1.5 bg-[color:var(--ok-bg)] text-[color:var(--ok-ink)] text-sm rounded-xl font-medium">{h}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : <p className="text-[color:var(--ink3)] text-center py-8">Sin perfil de actividad registrado</p>}
            </div>
          )}

          {activeTab === 'membresia' && (
            <div>
              {cliente.membresia ? (
                <div className="space-y-4">
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${membresiaColors[cliente.membresia.tipo]}`}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
                    Membresía {cliente.membresia.tipo}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Fecha inicio', value: cliente.membresia.fechaInicio },
                      { label: 'Fecha fin', value: cliente.membresia.fechaFin },
                      { label: 'Precio', value: `$${cliente.membresia.precio.toLocaleString()}` },
                      { label: 'Estatus', value: cliente.membresia.estatus },
                    ].map(item => (
                      <div key={item.label} className="bg-white border border-[color:var(--line)] rounded-2xl p-4">
                        <p className="text-xs text-[color:var(--ink2)] mb-1">{item.label}</p>
                        <p className="font-semibold text-[color:var(--ink)] capitalize">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <p className="text-[color:var(--ink3)] text-center py-8">Sin membresía activa</p>}
            </div>
          )}

          {activeTab === 'historial' && (
            <div className="space-y-3">
              <h3 className="font-semibold text-[color:var(--ink)]">Historial de Reservaciones</h3>
              {reservas.length === 0 ? (
                <p className="text-[color:var(--ink3)] text-center py-8">Sin reservaciones registradas</p>
              ) : reservas.map(r => (
                <div key={r.idReservacion} className="flex items-center justify-between p-3.5 bg-white border border-[color:var(--line)] rounded-2xl">
                  <div>
                    <p className="font-medium text-[color:var(--ink)] text-sm">{r.clase}</p>
                    <p className="text-xs text-[color:var(--ink3)]">{r.entrenador} · {r.horaClase} · {r.fechaReservacion}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={r.estatus} />
                    {r.asistenciaConfirmada && (
                      <span className="flex items-center gap-1 text-xs text-[color:var(--ok)]">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        Asistió
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}