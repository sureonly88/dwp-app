// Inline error state untuk dipakai di dalam <tbody> tabel atau area konten.
// Menampilkan ikon, pesan, dan tombol retry.

interface FetchErrorRowProps {
  colSpan: number;
  message?: string;
  onRetry: () => void;
}

export function FetchErrorRow({ colSpan, message = "Gagal memuat data. Periksa koneksi dan coba lagi.", onRetry }: FetchErrorRowProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-6 py-16 text-center">
        <span className="material-symbols-outlined text-[48px] block mb-3 text-error opacity-70">wifi_off</span>
        <p className="text-on-surface-variant text-body-sm mb-4">{message}</p>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 bg-surface-container-high text-on-surface rounded-lg text-label-sm hover:bg-surface-container transition-colors border border-outline-variant"
        >
          <span className="material-symbols-outlined text-[16px]">refresh</span>
          Coba Lagi
        </button>
      </td>
    </tr>
  );
}

interface FetchErrorBoxProps {
  message?: string;
  onRetry: () => void;
}

export function FetchErrorBox({ message = "Gagal memuat data. Periksa koneksi dan coba lagi.", onRetry }: FetchErrorBoxProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <span className="material-symbols-outlined text-[56px] text-error opacity-60">wifi_off</span>
      <p className="text-on-surface-variant text-body-md text-center max-w-xs">{message}</p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-surface-container-high text-on-surface rounded-xl text-label-md hover:bg-surface-container transition-colors border border-outline-variant"
      >
        <span className="material-symbols-outlined text-[18px]">refresh</span>
        Coba Lagi
      </button>
    </div>
  );
}
