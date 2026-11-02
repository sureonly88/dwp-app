import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const rootDir = fileURLToPath(new URL("..", import.meta.url));

// Load the actual handlers with an isolated database and authenticated session.
function loadTs(filename, imports = {}) {
  const source = readFileSync(path.join(rootDir, filename), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  });
  const loadedModule = { exports: {} };
  vm.runInNewContext(outputText, {
    exports: loadedModule.exports,
    module: loadedModule,
    URL,
    require(name) {
      assert.ok(Object.hasOwn(imports, name), `Unexpected import: ${name}`);
      return imports[name];
    },
  }, { filename });
  return loadedModule.exports;
}

const umroh = loadTs("src/lib/iuran-umroh.ts");

function fixture({ jumlahPengurus = 3, admin = true } = {}) {
  const transactions = [];
  const categories = ["IURAN_ANGGOTA", "IURAN_KONSUMSI_ANGGOTA", "IURAN_PENGURUS", "IURAN_UMROH_PENGURUS"]
    .map((code, i) => ({ code, id: i + 1 }));
  const db = {
    async execute(sql, args) {
      if (sql.includes("INSERT IGNORE INTO cash_categories") || sql.includes("UPDATE cash_categories")) return [{}];
      if (sql.includes("SELECT id, code FROM cash_categories")) return [categories];
      if (sql.includes("SELECT id FROM cash_transactions")) {
        return [transactions.filter((t) => t.source_type === args[0] && t.source_id === args[1])];
      }
      if (sql.includes("SELECT id, transaction_number")) {
        return [transactions.filter((t) => t.source_id === args[0])];
      }
      if (sql.includes("INSERT INTO cash_transactions")) {
        const [transaction_number, transaction_date, category_id, amount, description, source_type, source_id] = args;
        assert.ok(!transactions.some((t) => t.source_type === source_type && t.source_id === source_id));
        const id = transactions.length + 1;
        transactions.push({ id, transaction_number, transaction_date, category_id, amount, description, source_type, source_id, status: "pending" });
        return [{ insertId: id }];
      }
      assert.fail(`Unexpected query: ${sql}`);
    },
  };
  const route = loadTs("src/app/api/kas/posting-iuran/route.ts", {
    "next/server": { NextResponse: { json: (data, options) => Response.json(data, options) } },
    "@/lib/db": db,
    "@/lib/kas": {
      requireSession: async () => ({ session: { id: 1 } }),
      generateTransactionNumber: async () => `KAS-${transactions.length + 1}`,
    },
    "@/lib/admin-auth": {
      requireAdmin: async () => admin ? {} : { response: Response.json({ error: "Forbidden" }, { status: 403 }) },
    },
    "@/lib/iuran-umroh": umroh,
    "@/lib/iuran": {
      getLaporanIuran: async ({ bulan, tahun }) => ({
        periode: { bulan, tahun, label: `${bulan}/${tahun}` },
        tarif: null,
        summary: {
          total_anggota_aktif: 10, total_pengurus_aktif: jumlahPengurus,
          total_iuran_anggota: 100_000, total_iuran_konsumsi_anggota: 50_000,
          total_iuran_pengurus: 75_000, grand_total: 225_000,
        },
      }),
    },
  });
  return {
    transactions,
    preview: (bulan, tahun = 2026) => route.GET(new Request(`http://localhost/api/kas/posting-iuran?bulan=${bulan}&tahun=${tahun}`)),
    post: (body) => route.POST(new Request("http://localhost/api/kas/posting-iuran", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tahun: 2026, ...body }),
    })),
  };
}

test("umroh starts in October 2026 and remains monthly in subsequent years", () => {
  assert.equal(umroh.getIuranUmrohPengurus(12, 2025, 3).amount, 0);
  assert.equal(umroh.getIuranUmrohPengurus(9, 2026, 3).amount, 0);
  assert.equal(umroh.getIuranUmrohPengurus(10, 2026, 3).amount, 3_000_000);
  assert.equal(umroh.getIuranUmrohPengurus(1, 2027, 3).amount, 3_000_000);
});

test("preview includes the umroh total and the correct effective status", async () => {
  const app = fixture();
  const september = await (await app.preview(9)).json();
  assert.equal(september.posting.iuran_umroh_pengurus.berlaku, false);
  assert.equal(september.summary.grand_total, 225_000);
  const october = await (await app.preview(10)).json();
  assert.equal(october.posting.iuran_umroh_pengurus.nominal, 1_000_000);
  assert.equal(october.posting.iuran_umroh_pengurus.jumlah_pengurus, 3);
  assert.equal(october.summary.total_iuran_umroh_pengurus, 3_000_000);
  assert.equal(october.summary.grand_total, 3_225_000);
});

test("posting umroh before October is rejected without creating a transaction", async () => {
  const app = fixture();
  assert.equal((await app.post({ bulan: 9, jenis: "umroh" })).status, 400);
  assert.equal(app.transactions.length, 0);
});

test("umroh posts once per period as pending with a dedicated category", async () => {
  const app = fixture();
  const first = await (await app.post({ bulan: 10, jenis: "umroh" })).json();
  assert.equal(first.created.length, 1);
  assert.equal(app.transactions[0].amount, 3_000_000);
  assert.equal(app.transactions[0].source_type, "iuran_umroh_pengurus");
  assert.equal(app.transactions[0].source_id, "2026-10");
  assert.equal(app.transactions[0].category_id, 4);
  assert.equal(app.transactions[0].transaction_date, "2026-10-31");
  assert.equal(app.transactions[0].status, "pending");
  const repeat = await (await app.post({ bulan: 10, jenis: "umroh" })).json();
  assert.equal(repeat.created.length, 0);
  assert.equal(repeat.skipped.length, 1);
  assert.equal(app.transactions.length, 1);
  const preview = await (await app.preview(10)).json();
  assert.equal(preview.posting.iuran_umroh_pengurus.existing.id, app.transactions[0].id);
  await app.post({ bulan: 11, jenis: "umroh", tanggal: "2026-11-02" });
  assert.equal(app.transactions.length, 2);
  assert.equal(app.transactions[1].transaction_date, "2026-11-02");
});

test("Posting Semua includes umroh only from its effective period", async () => {
  const september = fixture();
  await september.post({ bulan: 9, jenis: "both" });
  assert.equal(september.transactions.length, 3);
  const october = fixture();
  await october.post({ bulan: 10, jenis: "both" });
  assert.equal(october.transactions.length, 4);
  assert.equal(october.transactions.reduce((total, t) => total + t.amount, 0), 3_225_000);
});

test("no umroh is posted if there are no eligible pengurus", async () => {
  const app = fixture({ jumlahPengurus: 0 });
  const result = await (await app.post({ bulan: 10, jenis: "umroh" })).json();
  assert.equal(result.created.length, 0);
  assert.equal(app.transactions.length, 0);
});

test("invalid periods and posting dates cannot bypass the cutoff", async () => {
  const app = fixture();
  for (const body of [
    { bulan: 9.5 }, { bulan: 13 }, { bulan: 10, tahun: 2026.5 },
    { bulan: 10, tanggal: "2026-09-30" }, { bulan: 11, tanggal: "2026-11-31" },
  ]) {
    assert.equal((await app.post({ jenis: "umroh", ...body })).status, 400);
  }
  assert.equal(app.transactions.length, 0);
});

test("posting continues to require an admin", async () => {
  const app = fixture({ admin: false });
  assert.equal((await app.post({ bulan: 10, jenis: "umroh" })).status, 403);
  assert.equal(app.transactions.length, 0);
});
