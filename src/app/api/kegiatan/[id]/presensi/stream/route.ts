import { NextRequest } from "next/server";
import pool from "@/lib/db";
import type { RowDataPacket } from "mysql2";

/**
 * GET /api/kegiatan/[id]/presensi/stream
 *
 * Server-Sent Events endpoint. Polls the DB every 2 seconds and pushes
 * incremental presensi / tamu updates to the connected client.
 *
 * Events emitted:
 *   data: {"type":"presensi","rows":[...]}   – new anggota rows (since last seen id)
 *   data: {"type":"tamu","rows":[...]}        – full tamu list when tamu count changes
 *   data: {"type":"deleted","ids":[...]}      – ids removed since last snapshot
 *   : heartbeat                               – SSE comment to keep the connection alive
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Snapshot the current state before opening the stream
  let lastPresensiId = 0;
  let lastTamuCount = 0;
  let knownPresensiIds: Set<number> = new Set();

  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT id FROM presensi WHERE kegiatan_id = ? ORDER BY id",
      [id]
    );
    rows.forEach((r) => knownPresensiIds.add(r.id));
    lastPresensiId = rows.length ? rows[rows.length - 1].id : 0;

    const [[tc]] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) AS c FROM presensi_tamu WHERE kegiatan_id = ?",
      [id]
    );
    lastTamuCount = Number(tc.c);
  } catch {
    // proceed from baseline 0
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          // stream already closed
        }
      };

      const sendJson = (obj: object) => {
        enqueue(`data: ${JSON.stringify(obj)}\n\n`);
      };

      // Initial heartbeat so the browser knows the connection is open
      enqueue(": connected\n\n");

      let closed = false;
      req.signal.addEventListener("abort", () => {
        closed = true;
      });

      while (!closed) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        if (closed) break;

        try {
          // ── New presensi rows ──────────────────────────────────────────────
          const [newRows] = await pool.execute<RowDataPacket[]>(
            `SELECT p.id, p.anggota_id, p.waktu_hadir, p.metode, p.catatan, p.foto,
                    a.nama, a.nip, a.jabatan, a.unit_kerja
             FROM presensi p
             INNER JOIN anggota a ON a.id = p.anggota_id
             WHERE p.kegiatan_id = ? AND p.id > ?
             ORDER BY p.id ASC`,
            [id, lastPresensiId]
          );

          if (newRows.length > 0) {
            lastPresensiId = newRows[newRows.length - 1].id;
            newRows.forEach((r) => knownPresensiIds.add(r.id));
            sendJson({ type: "presensi", rows: newRows });
          }

          // ── Deleted presensi ───────────────────────────────────────────────
          if (knownPresensiIds.size > 0) {
            const [allRows] = await pool.execute<RowDataPacket[]>(
              "SELECT id FROM presensi WHERE kegiatan_id = ?",
              [id]
            );
            const currentIds = new Set(allRows.map((r) => Number(r.id)));
            const deletedIds = [...knownPresensiIds].filter((rid) => !currentIds.has(rid));
            if (deletedIds.length > 0) {
              deletedIds.forEach((rid) => knownPresensiIds.delete(rid));
              sendJson({ type: "deleted", ids: deletedIds });
            }
          }

          // ── Tamu changes ───────────────────────────────────────────────────
          const [[tc]] = await pool.execute<RowDataPacket[]>(
            "SELECT COUNT(*) AS c FROM presensi_tamu WHERE kegiatan_id = ?",
            [id]
          );
          const currentTamuCount = Number(tc.c);

          if (currentTamuCount !== lastTamuCount) {
            lastTamuCount = currentTamuCount;
            const [tamuRows] = await pool.execute<RowDataPacket[]>(
              `SELECT id, nama, instansi, keterangan, foto, waktu_hadir
               FROM presensi_tamu WHERE kegiatan_id = ? ORDER BY waktu_hadir DESC`,
              [id]
            );
            sendJson({ type: "tamu", rows: tamuRows });
          }

          // Heartbeat comment keeps connection alive through proxies
          enqueue(": heartbeat\n\n");
        } catch {
          // DB hiccup – skip this cycle
          enqueue(": error\n\n");
        }
      }

      try {
        controller.close();
      } catch {
        // already closed
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable nginx/reverse-proxy buffering
    },
  });
}
