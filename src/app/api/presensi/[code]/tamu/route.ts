import { catatPresensiTamu } from "@/lib/presensi-tamu";

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return catatPresensiTamu(req, { code });
}
