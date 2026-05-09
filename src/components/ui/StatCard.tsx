import type { StatCardData } from "@/lib/types";
import Badge from "./Badge";

interface StatCardProps {
  data: StatCardData;
}

export default function StatCard({ data }: StatCardProps) {
  return (
    <div
      className={`bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow ${
        data.borderAccent ? "border-l-4 border-l-secondary" : ""
      }`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2 ${data.iconBg} rounded-lg ${data.iconColor}`}>
          <span className="material-symbols-outlined text-[22px]">{data.icon}</span>
        </div>
        {data.badge && (
          <Badge label={data.badge.label} variant={data.badge.variant} />
        )}
      </div>
      <h3 className="text-on-surface-variant font-label-md text-label-md uppercase tracking-wide">
        {data.title}
      </h3>
      <p className="font-h2 text-h2 text-on-surface mt-1 leading-tight">{data.value}</p>
      <p className="text-label-sm text-on-surface-variant mt-2">{data.subtitle}</p>
    </div>
  );
}
