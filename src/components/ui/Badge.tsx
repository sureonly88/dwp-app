type BadgeVariant = "success" | "warning" | "error" | "neutral" | "info";

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  success: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
  warning: "bg-secondary-container text-on-secondary-container",
  error: "bg-error-container text-error",
  neutral: "bg-surface-container-high text-on-surface-variant",
  info: "bg-primary-fixed text-on-primary-fixed-variant",
};

const dotStyles: Record<BadgeVariant, string> = {
  success: "bg-on-tertiary-fixed-variant",
  warning: "bg-on-secondary-container",
  error: "bg-error",
  neutral: "bg-on-surface-variant",
  info: "bg-on-primary-fixed-variant",
};

export default function Badge({ label, variant = "neutral", dot = false }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-label-sm font-semibold ${variantStyles[variant]}`}
    >
      {dot && (
        <span className={`h-1.5 w-1.5 rounded-full ${dotStyles[variant]}`} />
      )}
      {label}
    </span>
  );
}
