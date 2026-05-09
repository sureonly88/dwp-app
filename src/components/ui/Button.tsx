import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  icon?: string;
  iconPosition?: "left" | "right";
}

export default function Button({
  variant = "primary",
  size = "md",
  icon,
  iconPosition = "left",
  children,
  className = "",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 font-label-md transition-all active:scale-[0.98] rounded-xl disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary: "bg-primary text-on-primary hover:bg-primary-container shadow-sm",
    secondary: "bg-secondary-container text-on-secondary-container hover:bg-secondary-fixed",
    outline: "border border-secondary text-secondary hover:bg-secondary-container/10",
    ghost: "text-on-surface-variant hover:bg-surface-container-high",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-label-sm",
    md: "px-5 py-2.5 text-label-md",
    lg: "px-7 py-3 text-body-md",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {icon && iconPosition === "left" && (
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
      )}
      {children}
      {icon && iconPosition === "right" && (
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
      )}
    </button>
  );
}
