interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  id?: string;
}

export default function Card({ children, className = "", hover = false, id }: CardProps) {
  return (
    <div
      id={id}
      className={`bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm ${
        hover ? "hover:shadow-md transition-shadow cursor-pointer" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
