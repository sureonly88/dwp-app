"use client";

import { useState } from "react";

interface DeleteConfirmProps {
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function DeleteConfirm({ name, onConfirm, onCancel, loading }: DeleteConfirmProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-sm border border-outline-variant p-6 flex flex-col gap-5">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 bg-error-container rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined text-error text-[28px]">delete_forever</span>
          </div>
          <h3 className="font-h3 text-h3 text-on-surface">Hapus Anggota?</h3>
          <p className="text-body-sm text-on-surface-variant">
            Data <span className="font-bold text-on-surface">{name}</span> akan dihapus secara permanen dan tidak dapat dikembalikan.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 border border-outline-variant text-on-surface-variant rounded-xl font-label-md hover:bg-surface-container transition-colors text-label-md"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-error text-on-error rounded-xl font-label-md hover:bg-error/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 text-label-md"
          >
            {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            Hapus
          </button>
        </div>
      </div>
    </div>
  );
}
