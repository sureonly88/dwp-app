import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireSession, generateTransactionNumber } from "@/lib/kas";
import { getLaporanIuran } from "@/lib/iuran";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

// ============================================================================
// GET /api/kas/posting-iuran?bulan=5&tahun=2026
// Preview rekap iuran + status posting (sudah/belum) untuk tiap jenis
// ============================================================================
export async function GET(req: NextRequest) {
  const { response } = await requireSession(req);
  if (response) return response;

  const sp = new URL(req.url).searchParams;
  const bulan = Math.max(1, Math.min(12, parseInt(sp.get("bulan") ?? `${new Date().getMonth() + 1}`, 10)));
  const tahun = Math.max(2000, parseInt(sp.get("tahun") ?? `${new Date().getFullYear()}`, 10));

  const lap = await getLaporanIuran({ bulan, tahun });
  const ym = `${tahun}-${String(bulan).padStart(2, "0")}`;

  await ensureIuranKasCategory();

  const [postingRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, transaction_number, type, amount, status, source_type, source_id, transaction_date
       FROM cash_transactions
      WHERE source_type IN ('iuran_anggota','iuran_konsumsi_anggota','iuran_pengurus') AND source_id = ?`,
    [ym]
  );

  const findPost = (src: string) => postingRows.find((r) => r.source_type === src) ?? null;

  return NextResponse.json({
    periode: lap.periode,
    summary: lap.summary,
    tarif: lap.tarif,
    posting: {
      iuran_anggota: {
        amount: lap.summary.total_iuran_anggota,
        jumlah_anggota: lap.summary.total_anggota_aktif,
        existing: findPost("iuran_anggota"),
      },
      iuran_konsumsi_anggota: {
        amount: lap.summary.total_iuran_konsumsi_anggota,
        jumlah_anggota: lap.summary.total_anggota_aktif,
        existing: findPost("iuran_konsumsi_anggota"),
      },
      iuran_pengurus: {
        amount: lap.summary.total_iuran_pengurus,
        jumlah_pengurus: lap.summary.total_pengurus_aktif,
        existing: findPost("iuran_pengurus"),
      },
    },
  });
}

// ============================================================================
// POST /api/kas/posting-iuran  body: { bulan, tahun, jenis: 'anggota' | 'konsumsi' | 'pengurus' | 'both' }
// Membuat transaksi kas pemasukan rekap (bukan per anggota).
// Idempotent: jika sudah pernah posting (uniq source_type+source_id), tolak.
// ============================================================================
export async function POST(req: NextRequest) {
  const { session, response } = await requireSession(req);
  if (response) return response;

  try {
    const body = await req.json();
    const bulan = Math.max(1, Math.min(12, Number(body.bulan)));
    const tahun = Math.max(2000, Number(body.tahun));
    const jenis = body.jenis as "anggota" | "konsumsi" | "pengurus" | "both";

    if (!Number.isFinite(bulan) || !Number.isFinite(tahun)) {
      return NextResponse.json({ error: "Bulan/tahun tidak valid" }, { status: 400 });
    }
    if (!["anggota", "konsumsi", "pengurus", "both"].includes(jenis)) {
      return NextResponse.json({ error: "Jenis tidak valid" }, { status: 400 });
    }

    const lap = await getLaporanIuran({ bulan, tahun });
    const ym = `${tahun}-${String(bulan).padStart(2, "0")}`;
    const lastDay = new Date(tahun, bulan, 0).getDate();
    const trxDate = `${ym}-${String(lastDay).padStart(2, "0")}`;

    // Cari kategori sistem
    await ensureIuranKasCategory();

    const [catRows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, code FROM cash_categories WHERE code IN ('IURAN_ANGGOTA','IURAN_KONSUMSI_ANGGOTA','IURAN_PENGURUS')`
    );
    const catAnggota = catRows.find((r) => r.code === "IURAN_ANGGOTA");
    const catKonsumsiAnggota = catRows.find((r) => r.code === "IURAN_KONSUMSI_ANGGOTA");
    const catPengurus = catRows.find((r) => r.code === "IURAN_PENGURUS");
    if (!catAnggota || !catKonsumsiAnggota || !catPengurus) {
      return NextResponse.json({ error: "Kategori sistem iuran tidak ditemukan" }, { status: 500 });
    }

    const created: { jenis: string; id: number; amount: number }[] = [];
    const skipped: { jenis: string; reason: string }[] = [];

    const postOne = async (jns: "anggota" | "konsumsi" | "pengurus") => {
      const sourceType = jns === "anggota" ? "iuran_anggota" : jns === "konsumsi" ? "iuran_konsumsi_anggota" : "iuran_pengurus";
      const amount = jns === "anggota"
        ? lap.summary.total_iuran_anggota
        : jns === "konsumsi"
          ? lap.summary.total_iuran_konsumsi_anggota
          : lap.summary.total_iuran_pengurus;
      const jumlah = jns === "pengurus" ? lap.summary.total_pengurus_aktif : lap.summary.total_anggota_aktif;
      const categoryId = jns === "anggota" ? catAnggota.id : jns === "konsumsi" ? catKonsumsiAnggota.id : catPengurus.id;

      if (amount <= 0) {
        skipped.push({ jenis: jns, reason: "Nominal nol" });
        return;
      }

      // Cek duplikasi
      const [[exist]] = await pool.execute<RowDataPacket[]>(
        `SELECT id FROM cash_transactions WHERE source_type=? AND source_id=?`,
        [sourceType, ym]
      );
      if (exist) {
        skipped.push({ jenis: jns, reason: "Sudah pernah diposting" });
        return;
      }

      const trxNumber = await generateTransactionNumber(trxDate);
      const desc = jns === "anggota"
        ? `Rekap iuran arisan anggota ${lap.periode.label} (${jumlah} anggota)`
        : jns === "konsumsi"
          ? `Rekap iuran konsumsi anggota ${lap.periode.label} (${jumlah} anggota)`
          : `Rekap iuran pengurus ${lap.periode.label} (${jumlah} pengurus)`;
      const [r] = await pool.execute<ResultSetHeader>(
        `INSERT INTO cash_transactions
          (transaction_number, transaction_date, type, category_id, amount,
           payment_method, description, status, source_type, source_id, created_by)
         VALUES (?,?, 'income', ?, ?, 'Tunai', ?, 'pending', ?, ?, ?)`,
        [trxNumber, trxDate, categoryId, amount, desc, sourceType, ym, session!.id]
      );
      created.push({ jenis: jns, id: r.insertId, amount });
    };

    if (jenis === "anggota" || jenis === "both") await postOne("anggota");
    if (jenis === "konsumsi" || jenis === "both") await postOne("konsumsi");
    if (jenis === "pengurus" || jenis === "both") await postOne("pengurus");

    return NextResponse.json({ ok: true, created, skipped });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message ?? "Gagal posting iuran" }, { status: 400 });
  }
}

async function ensureIuranKasCategory() {
  await pool.execute(
    `INSERT IGNORE INTO cash_categories (code, name, type, is_system, description) VALUES
      ('IURAN_KONSUMSI_ANGGOTA', 'Iuran Konsumsi Anggota', 'income', 1, 'Posting rekap iuran konsumsi anggota dari modul Iuran')`
  );
  await pool.execute(
    `UPDATE cash_categories
        SET name='Iuran Arisan Anggota', description='Posting rekap iuran arisan anggota dari modul Iuran'
      WHERE code='IURAN_ANGGOTA'`
  );
}
