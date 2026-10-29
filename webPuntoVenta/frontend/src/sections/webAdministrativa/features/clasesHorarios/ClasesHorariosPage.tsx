import { useSearchParams } from 'react-router';
import { ClasesPage } from '../clases/ClasesPage';
import { HorariosPage } from '../horarios/HorariosPage';

type VistaClasesHorarios = 'agenda' | 'catalogo' | 'cambios';

const VISTAS: Array<{
  id: VistaClasesHorarios;
  label: string;
  descripcion: string;
}> = [
  {
    id: 'agenda',
    label: 'Agenda',
    descripcion: 'Consulta y administra las sesiones programadas por fecha.',
  },
  {
    id: 'catalogo',
    label: 'Catálogo de clases',
    descripcion: 'Administra los servicios, precios y capacidades disponibles.',
  },
  {
    id: 'cambios',
    label: 'Cambios y excepciones',
    descripcion: 'Consulta sesiones movidas, canceladas o agregadas de forma especial.',
  },
];

function esVistaValida(valor: string | null): valor is VistaClasesHorarios {
  return valor === 'agenda' || valor === 'catalogo' || valor === 'cambios';
}

export default function ClasesHorariosPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const vistaParam = searchParams.get('vista');
  const vista: VistaClasesHorarios = esVistaValida(vistaParam) ? vistaParam : 'agenda';
  const vistaActual = VISTAS.find(item => item.id === vista) ?? VISTAS[0];

  const cambiarVista = (nuevaVista: VistaClasesHorarios) => {
    setSearchParams({ vista: nuevaVista }, { replace: true });
  };

  return (
    <div className="max-w-7xl space-y-5">
      <div>
        <h1
          className="text-2xl font-bold text-gray-900"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          Clases y horarios
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Administra el catálogo y la programación desde un solo lugar.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-2 shadow-sm">
        <div className="grid gap-2 md:grid-cols-3" role="tablist" aria-label="Vistas de clases y horarios">
          {VISTAS.map(item => {
            const activa = item.id === vista;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={activa}
                onClick={() => cambiarVista(item.id)}
                className={`rounded-xl px-4 py-3 text-left transition-colors ${
                  activa
                    ? 'bg-[#111827] text-white'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <span className="block text-sm font-semibold">{item.label}</span>
                <span className={`mt-1 block text-xs ${activa ? 'text-gray-300' : 'text-gray-400'}`}>
                  {item.descripcion}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <section aria-label={vistaActual.label}>
        {vista === 'agenda' && <HorariosPage />}
        {vista === 'catalogo' && <ClasesPage />}
        {vista === 'cambios' && (
          <div className="rounded-2xl border border-gray-100 bg-white px-6 py-12 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-500">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3M5 11h14M7 15h4m-4 4h8m4-8v8a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h10a2 2 0 012 2v4z"
                />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-gray-900">Cambios y excepciones</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-gray-500">
              La programación semanal ya está activa. Esta vista mostrará las sesiones movidas,
              canceladas o extraordinarias cuando se implemente el historial de excepciones.
              Por ahora, los cambios se realizan desde la agenda.
            </p>
            <button
              type="button"
              onClick={() => cambiarVista('agenda')}
              className="mt-5 rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#6B7280]"
            >
              Ir a la agenda
            </button>
          </div>
        )}
      </section>
    </div>
  );
}