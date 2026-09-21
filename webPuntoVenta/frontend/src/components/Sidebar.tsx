// Importa el tipo que identifica los módulos de la aplicación.
import type { AppModule } from "../types";
import MaterialIcon from "./MaterialIcon";

/**
 * Define las propiedades que recibe el menú lateral.
 */
interface SidebarProps {
    activeModule: AppModule;
    onModuleChange: (module: AppModule) => void;
}

/**
 * Describe cada opción que aparecerá en el menú.
 */
interface MenuItem {
    id: AppModule;
    label: string;
    icon: string;
}

/**
 * Mantiene las opciones fuera del componente porque son
 * valores fijos y no necesitan recrearse en cada renderizado.
 * Esto evita repetir manualmente cinco botones.
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

/**
 * Renderiza el menú principal y comunica a App cuál
 * opción fue seleccionada.
 */
export default function Sidebar({
    activeModule,
    onModuleChange,
}: SidebarProps) {
    return (
        // aside contiene la navegación complementaria al contenido principal.
        <aside className="flex h-screen w-60 flex-shrink-0 flex-col bg-[#0D0F14] text-white">
        {/* Identidad visual de la aplicación. */}
        <div className="border-b border-white/10 px-5 py-5">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF5C00] text-xl">
                    <MaterialIcon name="fitness_center" className="text-2xl" filled />
                </div>

                <div>
                    <h1 className="text-base font-bold">
                        Sistema Gym
                    </h1>

                    <p className="text-xs text-white/50">
                        Gestión de ventas
                    </p>
                </div>
            </div>
        </div>

        {/* Opciones de navegación. */}
        <nav className="flex-1 space-y-1 p-3">
            {MENU_ITEMS.map((item) => {
                const isActive = activeModule === item.id;

                return (
                  <button
                      key={item.id}
                      type="button"
                      onClick={() => onModuleChange(item.id)}
                      className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition-colors ${
                        isActive
                          ? "bg-[#FF5C00] text-white"
                          : "text-white/65 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                        <MaterialIcon name={item.icon} className="text-xl" filled={isActive} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Usuario simulado mientras se implementa la autenticación. */}
            <div className="border-t border-white/10 p-4">
              <p className="text-sm font-semibold">
                Edgar Rodríguez
              </p>

              <p className="text-xs text-white/50">
                Recepcionista
              </p>
            </div>
        </aside>
    );
}