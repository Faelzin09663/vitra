type HealthDeps = { findOwner: (hash: string) => Promise<string | null>; save: (owner: string, date: string, steps: number) => Promise<void> };
const headers = { 'Content-Type': 'application/json' };
export async function tokenHash(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
export function validateStepsInput(body: unknown, now = Date.now()): body is { date: string; steps: number } {
  if (!body || typeof body !== 'object') return false;
  const { date, steps } = body as { date?: unknown; steps?: unknown };
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(steps) || (steps as number) < 0 || (steps as number) > 300000) return false;
  const timestamp = Date.parse(`${date}T12:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === date && timestamp <= now + 86400000 && timestamp >= now - 366 * 86400000;
}
export function createHealthHandler(deps: HealthDeps) {
  const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers });
  return async (req: Request) => {
    if (req.method !== 'POST') return reply(405, { error: 'Método não permitido.' });
    const token = req.headers.get('Authorization')?.match(/^Bearer (vitra_health_[a-f0-9]{64})$/)?.[1];
    if (!token) return reply(401, { error: 'Token de sincronização inválido.' });
    try {
      const owner = await deps.findOwner(await tokenHash(token));
      if (!owner) return reply(401, { error: 'Token inválido, revogado ou expirado.' });
      if (Number(req.headers.get('Content-Length') || 0) > 1024) return reply(413, { error: 'Requisição muito grande.' });
      const raw = await req.text(); if (raw.length > 1024) return reply(413, { error: 'Requisição muito grande.' });
      let body; try { body = JSON.parse(raw); } catch { return reply(400, { error: 'Envie JSON válido.' }); }
      if (!validateStepsInput(body)) return reply(400, { error: 'Informe date no formato AAAA-MM-DD e steps como um inteiro válido.' });
      // Identity is derived only from the token; a caller-supplied user_id is ignored.
      await deps.save(owner, body.date, body.steps);
      return reply(200, { ok: true, date: body.date, steps: body.steps });
    } catch { return reply(503, { error: 'Não foi possível salvar os passos. Tente novamente.' }); }
  };
}
