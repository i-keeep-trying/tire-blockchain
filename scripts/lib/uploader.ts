// scripts/lib/uploader.ts
import crypto from "node:crypto";

type UploadResult = { ok: boolean; status: number; text?: string };

export async function uploadJSON(
  name: string,
  payload: unknown,
  opts?: { url?: string; key?: string; timeoutMs?: number }
): Promise<UploadResult> {
  const url = opts?.url ?? process.env.MIRROR_URL;
  const key = opts?.key ?? process.env.MIRROR_KEY;
  if (!url) return { ok: false, status: 0, text: "MIRROR_URL not set" };
  if (!key) return { ok: false, status: 0, text: "MIRROR_KEY not set" };

  const body = JSON.stringify({
    name,
    exportedAt: new Date().toISOString(),
    data: payload,
  });

  const sig = crypto.createHmac("sha256", key).update(body).digest("hex");

  // Node 18+ has global fetch. If your TS complains about fetch types,
  // either add `"lib": ["es2021", "dom"]` to tsconfig, or keep skipLibCheck=true.
  const controller = new AbortController();
  const timeout = opts?.timeoutMs ?? 15000;
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-mirror-name": name,
        "x-mirror-sig": sig,
      },
      body,
      signal: controller.signal,
    } as any);
    clearTimeout(timer);
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch (e: any) {
    clearTimeout(timer);
    return { ok: false, status: 0, text: String(e) };
  }
}
