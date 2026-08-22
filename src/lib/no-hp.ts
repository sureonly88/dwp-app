export function normalizeNoHp(value: unknown) {
  if (typeof value !== "string") return { value: null, error: undefined };

  const noHp = value.trim();
  if (!noHp) return { value: null, error: undefined };

  if (noHp.length > 20) {
    return { value: null, error: "No. telepon maksimal 20 karakter" };
  }

  if (!/^[0-9+\-\s()]+$/.test(noHp)) {
    return { value: null, error: "No. telepon hanya boleh berisi angka, spasi, +, -, dan tanda kurung" };
  }

  if (noHp.replace(/\D/g, "").length < 8) {
    return { value: null, error: "No. telepon terlalu pendek" };
  }

  return { value: noHp, error: undefined };
}
