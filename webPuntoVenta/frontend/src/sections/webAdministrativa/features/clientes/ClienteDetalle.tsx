import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Badge } from '../../components/Badge';
import { mockClientes, mockReservaciones } from '../../data/mock';

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
  mensual: 'bg-blue-50 text-blue-700',
  trimestral: 'bg-purple-50 text-purple-700',
  semestral: 'bg-amber-50 text-amber-700',
  anual: 'bg-emerald-50 text-emerald-700',
};

function InfoRow({ label, value }: { label: string; value?: string | number }) {
  return (
    <div className="flex justify-between py-3 border-b border-slate-50 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-800 text-right max-w-xs">{value ?? '—'}</span>
    </div>
  );
}

export function ClienteDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('general');

  const cliente = mockClientes.find(c => c.idUsuario === id);
  if (!cliente) return (
    <div className="text-center py-20 text-slate-400">
      <p className="text-lg">Cliente no encontrado</p>
      <button onClick={() => navigate('/clientes')} className="mt-4 text-emerald-500 hover:underline text-sm">← Volver a clientes</button>
    </div>
  );

  const reservas = mockReservaciones.filter(r => r.idCliente === id);

  const calcEdad = (fecha: string) => {
    const diff = Date.now() - new Date(fecha).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  };

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/clientes')} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'DM Sans, sans-serif' }}>
            {cliente.nombre} {cliente.apellidos}
          </h1>
          <p className="text-slate-500 text-sm">Expediente de cliente · {cliente.codigoAcceso}</p>
        </div>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
        <div className="flex items-start gap-5">
          {cliente.avatar
            ? <img src={cliente.avatar} alt="" className="w-16 h-16 rounded-2xl object-cover bg-slate-100 flex-shrink-0" />
            : <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-700 text-xl font-bold flex-shrink-0">{cliente.nombre[0]}{cliente.apellidos[0]}</div>
          }
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'DM Sans, sans-serif' }}>{cliente.nombre} {cliente.apellidos}</h2>
              <Badge variant={cliente.estatus} />
              {cliente.membresia && <Badge variant={cliente.membresia.estatus} label={`Membresía ${cliente.membresia.tipo}`} />}
            </div>
            <p className="text-slate-500 text-sm mt-1">{cliente.correo} · {cliente.telefono}</p>
            <p className="text-slate-500 text-sm">{cliente.direccion}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-slate-400">Registrado</p>
            <p className="text-sm font-medium text-slate-700">{cliente.fechaRegistro}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-100 overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.value} onClick={() => setActiveTab(tab.value)}
              className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${activeTab === tab.value ? 'border-emerald-500 text-emerald-600 bg-emerald-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'general' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-semibold text-slate-900 mb-3" style={{ fontFamily: 'DM Sans, sans-serif' }}>Información Personal</h3>
                <InfoRow label="Nombre completo" value={`${cliente.nombre} ${cliente.apellidos}`} />
                <InfoRow label="Fecha de nacimiento" value={cliente.fechaNacimiento} />
                <InfoRow label="Edad" value={`${calcEdad(cliente.fechaNacimiento)} años`} />
                <InfoRow label="Correo electrónico" value={cliente.correo} />
                <InfoRow label="Teléfono" value={cliente.telefono} />
                <InfoRow label="Dirección" value={cliente.direccion} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-3" style={{ fontFamily: 'DM Sans, sans-serif' }}>Datos del Sistema</h3>
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
                    <h3 className="font-semibold text-slate-900 mb-3" style={{ fontFamily: 'DM Sans, sans-serif' }}>Métricas Físicas</h3>
                    <InfoRow label="Peso" value={`${cliente.perfilSalud.peso} kg`} />
                    <InfoRow label="Altura" value={`${cliente.perfilSalud.altura} cm`} />
                    <InfoRow label="IMC" value={`${(cliente.perfilSalud.peso / Math.pow(cliente.perfilSalud.altura / 100, 2)).toFixed(1)}`} />
                    <InfoRow label="Tipo de sangre" value={cliente.perfilSalud.tipoSangre} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-3" style={{ fontFamily: 'DM Sans, sans-serif' }}>Condición Médica</h3>
                    <div className="py-3 border-b border-slate-50">
                      <p className="text-sm text-slate-500 mb-1.5">Alergias</p>
                      <div className="flex flex-wrap gap-1.5">
                        {cliente.perfilSalud.alergias.length > 0
                          ? cliente.perfilSalud.alergias.map(a => <span key={a} className="px-2 py-0.5 bg-red-50 text-red-600 text-xs rounded-lg">{a}</span>)
                          : <span className="text-sm text-slate-400">Ninguna registrada</span>}
                      </div>
                    </div>
                    <div className="py-3 border-b border-slate-50">
                      <p className="text-sm text-slate-500 mb-1.5">Enfermedades</p>
                      <div className="flex flex-wrap gap-1.5">
                        {cliente.perfilSalud.enfermedades.length > 0
                          ? cliente.perfilSalud.enfermedades.map(e => <span key={e} className="px-2 py-0.5 bg-amber-50 text-amber-600 text-xs rounded-lg">{e}</span>)
                          : <span className="text-sm text-slate-400">Ninguna registrada</span>}
                      </div>
                    </div>
                    <div className="py-3 border-b border-slate-50">
                      <p className="text-sm text-slate-500 mb-1.5">Lesiones previas</p>
                      <div className="flex flex-wrap gap-1.5">
                        {cliente.perfilSalud.lesiones.length > 0
                          ? cliente.perfilSalud.lesiones.map(l => <span key={l} className="px-2 py-0.5 bg-orange-50 text-orange-600 text-xs rounded-lg">{l}</span>)
                          : <span className="text-sm text-slate-400">Ninguna registrada</span>}
                      </div>
                    </div>
                    {cliente.perfilSalud.observaciones && (
                      <div className="py-3">
                        <p className="text-sm text-slate-500 mb-1">Observaciones</p>
                        <p className="text-sm text-slate-700 bg-amber-50 p-3 rounded-xl border border-amber-100">{cliente.perfilSalud.observaciones}</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-slate-400 col-span-2 text-center py-8">Sin perfil de salud registrado</p>
              )}
            </div>
          )}

          {activeTab === 'actividad' && (
            <div>
              {cliente.perfilActividad ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-3" style={{ fontFamily: 'DM Sans, sans-serif' }}>Perfil de Actividad</h3>
                    <InfoRow label="Nivel de actividad" value={nivelLabels[cliente.perfilActividad.nivelActividad]} />
                    <InfoRow label="Objetivo principal" value={cliente.perfilActividad.objetivo} />
                    <InfoRow label="Frecuencia de ejercicio" value={cliente.perfilActividad.frecuenciaEjercicio} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-3" style={{ fontFamily: 'DM Sans, sans-serif' }}>Intereses</h3>
                    <div className="pt-2">
                      <p className="text-sm text-slate-500 mb-3">Hobbies y deportes</p>
                      <div className="flex flex-wrap gap-2">
                        {cliente.perfilActividad.hobbies.map(h => (
                          <span key={h} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-sm rounded-xl font-medium">{h}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : <p className="text-slate-400 text-center py-8">Sin perfil de actividad registrado</p>}
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
                      <div key={item.label} className="bg-slate-50 rounded-xl p-4">
                        <p className="text-xs text-slate-500 mb-1">{item.label}</p>
                        <p className="font-semibold text-slate-800 capitalize">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <p className="text-slate-400 text-center py-8">Sin membresía activa</p>}
            </div>
          )}

          {activeTab === 'historial' && (
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-900" style={{ fontFamily: 'DM Sans, sans-serif' }}>Historial de Reservaciones</h3>
              {reservas.length === 0 ? (
                <p className="text-slate-400 text-center py-8">Sin reservaciones registradas</p>
              ) : reservas.map(r => (
                <div key={r.idReservacion} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl">
                  <div>
                    <p className="font-medium text-slate-800 text-sm">{r.clase}</p>
                    <p className="text-xs text-slate-400">{r.entrenador} · {r.horaClase} · {r.fechaReservacion}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={r.estatus} />
                    {r.asistenciaConfirmada && (
                      <span className="flex items-center gap-1 text-xs text-emerald-600">
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
