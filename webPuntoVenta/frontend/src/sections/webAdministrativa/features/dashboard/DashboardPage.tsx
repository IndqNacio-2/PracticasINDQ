import { useCallback, useEffect, useMemo, useState } from "react"

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts"

import { Icon } from "../../components/Icon"

import { useAuth } from "../../context/AuthContext"

import { api, apiCobro } from "../../lib/api"

import type { HorarioClase, Venta } from "../../types"

interface ReservaCobro {
  id: number

  client: string

  type: "cliente" | "visitante"

  class: string

  time: string

  status: "pendiente" | "pagado" | "asistido" | "cancelado"

  price: number

  fecha?: string
}

interface SocioCobro {
  id: number

  nombre: string

  membresia: string

  telefono: string

  correo: string | null

  activo: boolean

  vigencia_hasta: string | null
}

interface KpisCobro {
  clientesEsperados: number

  ingresosHoy: number

  totalReservas: number
}

function fechaISO(fecha = new Date()): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, "0")

  const dia = String(fecha.getDate()).padStart(2, "0")

  return `${fecha.getFullYear()}-${mes}-${dia}`
}

function etiquetaDia(fecha: string): string {
  const [, mes, dia] = fecha.split("-").map(Number)

  return `${dia}/${mes}`
}

function socioVigente(socio: SocioCobro, hoy: string): boolean {
  return (
    socio.activo !== false &&
    (!socio.vigencia_hasta || socio.vigencia_hasta >= hoy)
  )
}

export function DashboardPage() {
  const { hasRole } = useAuth()

  const puedeEntrarAlPuntoDeVenta = hasRole(["administrador", "recepcion"])

  const [kpis, setKpis] = useState<KpisCobro | null>(null)

  const [reservas, setReservas] = useState<ReservaCobro[]>([])

  const [clientes, setClientes] = useState<SocioCobro[]>([])

  const [horariosHoy, setHorariosHoy] = useState<HorarioClase[]>([])

  const [ventasMes, setVentasMes] = useState<Venta[]>([])

  const [cargando, setCargando] = useState(true)

  const [error, setError] = useState<string | null>(null)

  const hoy = fechaISO()

  const inicioMes = `${hoy.slice(0, 7)}-01`

  // El dashboard se alimenta únicamente de datos reales. Si una fuente no

  // tiene registros, su sección queda en cero o muestra un estado vacío.

  const cargar = useCallback(async () => {
    setCargando(true)

    setError(null)

    const resultados = await Promise.allSettled([
      apiCobro.get<KpisCobro>("/kpis"),

      apiCobro.get<ReservaCobro[]>("/reservas"),

      apiCobro.get<SocioCobro[]>("/clientes"),

      api.get<HorarioClase[]>(`/horarios?fecha=${hoy}&estatus=activo`),

      api.get<Venta[]>(`/ventas?desde=${inicioMes}&hasta=${hoy}`),
    ])

    const [
      resultadoKpis,

      resultadoReservas,

      resultadoClientes,

      resultadoHorarios,

      resultadoVentas,
    ] = resultados

    setKpis(resultadoKpis.status === "fulfilled" ? resultadoKpis.value : null)

    setReservas(
      resultadoReservas.status === "fulfilled" &&
        Array.isArray(resultadoReservas.value)
        ? resultadoReservas.value
        : [],
    )

    setClientes(
      resultadoClientes.status === "fulfilled" &&
        Array.isArray(resultadoClientes.value)
        ? resultadoClientes.value
        : [],
    )

    setHorariosHoy(
      resultadoHorarios.status === "fulfilled" &&
        Array.isArray(resultadoHorarios.value)
        ? resultadoHorarios.value
        : [],
    )

    setVentasMes(
      resultadoVentas.status === "fulfilled" &&
        Array.isArray(resultadoVentas.value)
        ? resultadoVentas.value
        : [],
    )

    if (resultados.some((resultado) => resultado.status === "rejected")) {
      setError(
        "Algunos datos no se pudieron cargar. Las secciones afectadas se muestran vacías.",
      )
    }

    setCargando(false)
  }, [hoy, inicioMes])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const clientesActivos = clientes.filter((cliente) =>
    socioVigente(cliente, hoy),
  ).length

  const ingresosMes = ventasMes.reduce(
    (total, venta) => total + Number(venta.total || 0),

    0,
  )

  const reservacionesPendientes = reservas

    .filter((reserva) => reserva.status === "pendiente")

    .sort((a, b) =>
      `${a.fecha ?? ""} ${a.time}`.localeCompare(`${b.fecha ?? ""} ${b.time}`),
    )

    .slice(0, 5)

  const ventasRecientes = [...ventasMes]

    .sort((a, b) => b.fecha.localeCompare(a.fecha))

    .slice(0, 4)

  const ventasPorDia = useMemo(() => {
    const totales = new Map<string, number>()

    ventasMes.forEach((venta) =>
      totales.set(
        venta.fecha,

        (totales.get(venta.fecha) ?? 0) + Number(venta.total || 0),
      ),
    )

    return [...totales.entries()]

      .sort(([fechaA], [fechaB]) => fechaA.localeCompare(fechaB))

      .map(([fecha, ventas]) => ({ fecha, dia: etiquetaDia(fecha), ventas }))
  }, [ventasMes])

  const asistenciasUltimosSieteDias = useMemo(() => {
    const dias = Array.from({ length: 7 }, (_, indice) => {
      const fecha = new Date()

      fecha.setDate(fecha.getDate() - (6 - indice))

      const iso = fechaISO(fecha)

      return { fecha: iso, dia: etiquetaDia(iso), asistencias: 0 }
    })

    const porFecha = new Map(dias.map((dia) => [dia.fecha, dia]))

    reservas.forEach((reserva) => {
      if (
        reserva.status === "asistido" &&
        reserva.fecha &&
        porFecha.has(reserva.fecha)
      ) {
        porFecha.get(reserva.fecha)!.asistencias += 1
      }
    })

    return dias
  }, [reservas])

  const fechaHoy = new Date().toLocaleDateString("es-MX", {
    weekday: "long",

    day: "numeric",

    month: "long",

    year: "numeric",
  })

  const nombreMes = new Date().toLocaleDateString("es-MX", { month: "long" })

  const anioActual = new Date().getFullYear()

  return (
    <section className="rx-admin-dashboard" aria-busy={cargando}>
      <header className="rx-page-header rx-admin-dashboard-header">
        <div className="rx-page-heading">
          <span className="rx-section-eyebrow">Resumen operativo</span>
          <h1 className="rx-page-title">Dashboard</h1>
          <p className="rx-page-subtitle">
            {fechaHoy.charAt(0).toUpperCase() + fechaHoy.slice(1)}
          </p>
        </div>
        {puedeEntrarAlPuntoDeVenta && (
          <a href="/" className="rx-btn rx-btn--primary">
            <Icon name="point_of_sale" size={19} />
            Ir al Punto de Venta
          </a>
        )}
      </header>

      <div className="rx-page-content">
        {error && (
          <div className="rx-admin-alert" role="alert">
            <Icon name="warning" size={20} />
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void cargar()}
              className="rx-admin-alert-action"
            >
              Reintentar
            </button>
          </div>
        )}

        <div className="rx-grid-kpi rx-admin-kpi-grid" aria-live="polite">
          <DashboardStat
            label="Clientes activos"
            value={cargando ? "—" : clientesActivos}
            icon="groups"
            tone="accent"
          />
          <DashboardStat
            label="Reservaciones hoy"
            value={cargando ? "—" : (kpis?.totalReservas ?? 0)}
            icon="event_available"
            tone="info"
          />
          <DashboardStat
            label="Ingresos hoy"
            value={
              cargando
                ? "—"
                : `$${Number(kpis?.ingresosHoy ?? 0).toLocaleString("es-MX")}`
            }
            icon="payments"
            tone="success"
          />
          <DashboardStat
            label={`Ingresos en ${nombreMes}`}
            value={cargando ? "—" : `$${ingresosMes.toLocaleString("es-MX")}`}
            icon="trending_up"
            tone="special"
          />
        </div>

        <div className="rx-admin-chart-grid">
          <article className="rx-admin-card rx-admin-chart-card">
            <div className="rx-admin-card-header">
              <div>
                <span className="rx-section-eyebrow">Rendimiento</span>
                <h2 className="rx-admin-card-title">Ingresos del mes</h2>
              </div>
              <span className="rx-admin-period">
                {nombreMes} {anioActual}
              </span>
            </div>
            {cargando ? (
              <EmptyChart text="Cargando ingresos..." />
            ) : ventasPorDia.length === 0 ? (
              <EmptyChart text="Sin ventas registradas este mes" />
            ) : (
              <div
                className="rx-admin-chart"
                aria-label="Gráfica de ingresos del mes"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={ventasPorDia}
                    margin={{ top: 12, right: 8, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="incomeGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="var(--rx-accent)"
                          stopOpacity={0.5}
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--rx-accent)"
                          stopOpacity={0.04}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--rx-line)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="dia"
                      tick={{ fontSize: 11, fill: "var(--rx-ink-muted)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "var(--rx-ink-muted)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,

                        border: "1px solid var(--rx-line)",

                        fontSize: 12,
                      }}
                      formatter={(value) => [
                        `$${Number(value).toLocaleString("es-MX")}`,

                        "Ingresos",
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="ventas"
                      stroke="var(--rx-dark)"
                      strokeWidth={2.5}
                      fill="url(#incomeGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </article>

          <article className="rx-admin-card rx-admin-chart-card">
            <div className="rx-admin-card-header">
              <div>
                <span className="rx-section-eyebrow">Actividad</span>
                <h2 className="rx-admin-card-title">
                  Asistencias · últimos 7 días
                </h2>
              </div>
            </div>
            {cargando ? (
              <EmptyChart text="Cargando asistencias..." />
            ) : (
              <div
                className="rx-admin-chart"
                aria-label="Gráfica de asistencias de los últimos siete días"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={asistenciasUltimosSieteDias}
                    margin={{ top: 12, right: 8, left: -28, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--rx-line)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="dia"
                      tick={{ fontSize: 11, fill: "var(--rx-ink-muted)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: "var(--rx-ink-muted)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--rx-surface-soft)" }}
                      contentStyle={{
                        borderRadius: 12,

                        border: "1px solid var(--rx-line)",

                        fontSize: 12,
                      }}
                    />
                    <Bar
                      dataKey="asistencias"
                      fill="var(--rx-dark-secondary)"
                      radius={[7, 7, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </article>
        </div>

        <div className="rx-admin-list-grid">
          <article className="rx-admin-card">
            <div className="rx-admin-card-header">
              <div>
                <span className="rx-section-eyebrow">Agenda</span>
                <h2 className="rx-admin-card-title">Clases de hoy</h2>
              </div>
              <span className="rx-admin-count">{horariosHoy.length}</span>
            </div>
            <div className="rx-admin-list">
              {cargando && <EmptyList text="Cargando clases..." />}
              {!cargando &&
                horariosHoy.map((horario) => {
                  const ocupados = Math.max(
                    0,

                    horario.capacidadTotal - horario.capacidadDisponible,
                  )

                  const porcentaje =
                    horario.capacidadTotal > 0
                      ? Math.round((ocupados / horario.capacidadTotal) * 100)
                      : 0

                  return (
                    <div key={horario.idHorario} className="rx-admin-list-item">
                      <div className="rx-admin-time">{horario.horaInicio}</div>
                      <div className="rx-admin-list-copy">
                        <strong>{horario.nombreClase}</strong>
                        <span>
                          {horario.nombreEntrenador} · {horario.salon}
                        </span>
                      </div>
                      <div className="rx-admin-capacity">
                        <span>
                          {ocupados}/{horario.capacidadTotal}
                        </span>
                        <div className="rx-admin-progress">
                          <span style={{ width: `${porcentaje}%` }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              {!cargando && horariosHoy.length === 0 && (
                <EmptyList text="Sin clases programadas para hoy" />
              )}
            </div>
          </article>

          <article className="rx-admin-card">
            <div className="rx-admin-card-header">
              <div>
                <span className="rx-section-eyebrow">Seguimiento</span>
                <h2 className="rx-admin-card-title">
                  Reservaciones pendientes
                </h2>
              </div>
              <span className="rx-admin-count rx-admin-count--warning">
                {reservacionesPendientes.length}
              </span>
            </div>
            <div className="rx-admin-list">
              {cargando && <EmptyList text="Cargando reservaciones..." />}
              {!cargando &&
                reservacionesPendientes.map((reserva) => (
                  <div key={reserva.id} className="rx-admin-list-item">
                    <div className="rx-admin-list-icon">
                      <Icon name="person" size={20} />
                    </div>
                    <div className="rx-admin-list-copy">
                      <strong>{reserva.client}</strong>
                      <span>
                        {reserva.class} ·{" "}
                        {reserva.fecha ? `${reserva.fecha} ` : ""}
                        {reserva.time}
                      </span>
                    </div>
                    <span className="rx-badge rx-badge--warning">
                      Pendiente
                    </span>
                  </div>
                ))}
              {!cargando && reservacionesPendientes.length === 0 && (
                <EmptyList text="Sin reservaciones pendientes" />
              )}
            </div>
          </article>
        </div>

        <article className="rx-admin-card rx-admin-table-card">
          <div className="rx-admin-card-header">
            <div>
              <span className="rx-section-eyebrow">Últimos movimientos</span>
              <h2 className="rx-admin-card-title">Ventas recientes</h2>
            </div>
          </div>
          {cargando ? (
            <EmptyList text="Cargando ventas..." />
          ) : ventasRecientes.length === 0 ? (
            <EmptyList text="Sin ventas registradas este mes" />
          ) : (
            <div className="rx-table-wrap">
              <table className="rx-table rx-admin-sales-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Productos</th>
                    <th>Fecha</th>
                    <th className="rx-table-number">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ventasRecientes.map((venta) => (
                    <tr key={venta.idVenta}>
                      <td className="rx-cell-strong">{venta.nombreCliente}</td>
                      <td className="rx-cell-muted">
                        {venta.productos

                          .map((producto) => producto.nombre)

                          .join(", ") || "Sin detalle"}
                      </td>
                      <td className="rx-cell-muted">{venta.fecha}</td>
                      <td className="rx-cell-strong rx-table-number">
                        ${Number(venta.total).toLocaleString("es-MX")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </div>
    </section>
  )
}

function DashboardStat({
  label,

  value,

  icon,

  tone,
}: {
  label: string

  value: string | number

  icon: string

  tone: "accent" | "info" | "success" | "special"
}) {
  return (
    <article className="rx-kpi-card rx-admin-stat">
      <div>
        <p className="rx-kpi-label">{label}</p>
        <p className="rx-kpi-value">{value}</p>
      </div>
      <div className={`rx-admin-stat-icon rx-admin-stat-icon--${tone}`}>
        <Icon name={icon} size={22} filled />
      </div>
    </article>
  )
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="rx-admin-empty rx-admin-empty--chart">
      <Icon name="monitoring" size={28} />
      <p>{text}</p>
    </div>
  )
}

function EmptyList({ text }: { text: string }) {
  return (
    <div className="rx-admin-empty">
      <Icon name="inbox" size={24} />
      <p>{text}</p>
    </div>
  )
}
