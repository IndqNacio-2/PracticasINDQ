import MaterialIcon from "./MaterialIcon";
/**
 * Propiedades de una pantalla temporal.
 */
interface ModulePlaceholderProps {
    title: string;
    description: string;
    icon: string;
}  

/**
 * Esta pantalla permite validar la navegación antes de
 * desarrollar cada módulo completo.
 */

export default function ModulePlaceholder({
    title,
    description,
    icon,
}: ModulePlaceholderProps) {
    return (
        <section className="flex h-full flex-1 items-center justify-center bg-[var(--rx-surface-soft)] p-8">
      <div className="w-full max-w-lg rounded-[var(--rx-radius-extra-large)] border border-[var(--rx-line)] bg-[var(--rx-surface)] p-10 text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[var(--rx-radius-extra-large)] bg-[var(--rx-surface-soft)] text-[color:var(--rx-dark)]">
                    <MaterialIcon name={icon} className="text-4xl" filled />
                </div>

                <h2 className="mb-2 text-2xl font-bold text-[color:var(--rx-ink)]">
                    {title}
                </h2>

                <p className="text-sm leading-6 text-[color:var(--rx-ink-secondary)]">
                    {description}
                </p>
            </div>
        </section>
    );
}