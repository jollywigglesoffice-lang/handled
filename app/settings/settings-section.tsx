import type { ReactNode } from "react";

type SettingsSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

/** Primary settings block — light chrome, clear hierarchy. */
export function SettingsSection({
  title,
  description,
  children,
  className = "",
}: SettingsSectionProps) {
  return (
    <section className={`space-y-4 ${className}`}>
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-secondary">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
