// Importo useState para controlar si el menú está abierto o contraído.
import { useState } from "react";

// Importo el tipo que identifica los módulos disponibles.
import type { AppModule } from "../types";

// Reutilizo el componente de Material Icons de la aplicación.
import MaterialIcon from "./MaterialIcon";

/*
 * Defino los datos que el componente recibe desde App.
 */
interface SidebarProps {
  // Indica qué módulo está seleccionado actualmente.
  activeModule: AppModule;

  // Comunica a App cuando selecciono otro módulo.
  onModuleChange: (module: AppModule) => void;
}

/*
 * Defino la estructura de cada opción del menú.
 */
interface MenuItem {
  id: AppModule;
  label: string;
  icon: string;
}

/*
 * Mantengo las opciones fuera del componente porque son fijas
 * y no necesitan volver a crearse en cada renderizado.
 */
const MENU_ITEMS: MenuItem[] = [
  {
    id: "sale",
    label: "Venta",
    icon: "point_of_sale",
  },
  {
    id: "inventory",
    label: "Inventario",
    icon: "inventory_2",
  },
  {
    id: "waste",
    label: "Mermas",
    icon: "delete_sweep",
  },
  {
    id: "cash-closing",
    label: "Corte de caja",
    icon: "payments",
  },
  {
    id: "reports",
    label: "Reportes",
    icon: "bar_chart",
  },
];

/*
 * Muestro la navegación lateral de la aplicación.
 *
 * El componente controla localmente si el menú se encuentra
 * expandido o contraído.
 */
export default function Sidebar({
  activeModule,
  onModuleChange,
}: SidebarProps) {
  /*
   * true significa que el sidebar está expandido.
   * false significa que solamente se muestran los iconos.
   */
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <aside
      className={`flex h-screen flex-shrink-0 flex-col overflow-hidden border-r border-[#FED7C3] bg-[#FFF7F2] text-[#5A3825] shadow-sm transition-[width] duration-300 ease-in-out ${
        isExpanded ? "w-60" : "w-20"
      }`}
    >
      {/*
       * Botón para expandir o contraer el sidebar.
       *
       * Lo coloco sobre el borde derecho para que sea fácil
       * encontrarlo en los dos estados.
       */}
        {/* Encabezado e identidad visual de la aplicación. */}
        <div
        className={`flex h-[73px] flex-shrink-0 items-center border-b border-[#FED7C3] ${
            isExpanded
            ? "gap-3 px-5"
            : "justify-center px-3"
        }`}
        >
        {isExpanded ? (
            <>
            {/* Logotipo del sistema. */}
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#FF5C00] text-white shadow-sm">
                <MaterialIcon
                name="fitness_center"
                className="text-2xl"
                filled
                />
            </div>

            {/* Nombre y descripción del sistema. */}
            <div className="min-w-0 flex-1">
                <h1 className="truncate text-base font-bold text-[#3A2418]">
                Sistema Gym
                </h1>

                <p className="truncate text-xs text-[#9A6B50]">
                Gestión de ventas
                </p>
            </div>

            {/* Botón para contraer el menú. */}
            <button
                type="button"
                onClick={() =>
                setIsExpanded((currentValue) => !currentValue)
                }
                aria-label="Contraer menú lateral"
                title="Contraer menú"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-[#FED7C3] bg-white text-[#FF5C00] shadow-sm transition-all duration-150 hover:border-[#FFB58C] hover:bg-[#FFE8D9] active:scale-95"
            >
                <MaterialIcon
                name="chevron_left"
                className="text-xl"
                />
            </button>
            </>
        ) : (
            /* En modo compacto, el botón ocupa el lugar del logotipo. */
            <button
            type="button"
            onClick={() =>
                setIsExpanded((currentValue) => !currentValue)
            }
            aria-label="Expandir menú lateral"
            title="Expandir menú"
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FF5C00] text-white shadow-sm transition-all duration-150 hover:bg-[#E54E00] hover:shadow-md active:scale-95"
            >
            <MaterialIcon
                name="chevron_right"
                className="text-2xl"
            />
            </button>
        )}
        </div>
      {/* Opciones principales de navegación. */}
      <nav
        className={`flex flex-1 flex-col gap-1 py-4 ${
          isExpanded ? "px-3" : "px-2"
        }`}
      >
        {/*
         * Este título únicamente aparece cuando existe
         * suficiente espacio para mostrar texto.
         */}
        {isExpanded && (
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#B98A6D]">
            Módulos
          </p>
        )}

        {MENU_ITEMS.map((item) => {
          // Compruebo si esta opción corresponde al módulo actual.
          const isActive =
            activeModule === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() =>
                onModuleChange(item.id)
              }
              aria-label={item.label}
              title={
                isExpanded
                  ? undefined
                  : item.label
              }
              className={`flex h-11 w-full items-center rounded-xl text-sm font-semibold transition-all duration-150 ${
                isExpanded
                  ? "gap-3 px-3"
                  : "justify-center px-0"
              } ${
                isActive
                  ? "bg-[#FF5C00] text-white shadow-sm"
                  : "text-[#7A4A31] hover:bg-[#FFE8D9] hover:text-[#E54E00]"
              }`}
            >
              <MaterialIcon
                name={item.icon}
                className="flex-shrink-0 text-xl"
                filled={isActive}
              />

              {/*
               * El nombre del módulo desaparece cuando
               * el menú está contraído.
               */}
              {isExpanded && (
                <span className="truncate">
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Información temporal del usuario. */}
      <div className="flex-shrink-0 border-t border-[#FED7C3] p-3">
        <div
          className={`flex items-center rounded-xl bg-white/70 ${
            isExpanded
              ? "gap-3 px-3 py-2.5"
              : "justify-center p-2"
          }`}
        >
          {/*
           * Uso las iniciales como avatar mientras se
           * implementa la autenticación real.
           */}
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#FFE8D9] text-xs font-bold text-[#FF5C00]">
            ER
          </div>

          {isExpanded && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#3A2418]">
                Edgar Rodríguez
              </p>

              <p className="truncate text-xs text-[#9A6B50]">
                Recepcionista
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
