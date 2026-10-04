type HealthDeps = { allowRequest: (hash: string) => Promise<boolean>; findOwner: (hash: string) => Promise<string | null>; save: (owner: string, date: string, steps: number) => Promise<void> };
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
      const hash = await tokenHash(token);
      // Count attempts before owner lookup, including expired/revoked tokens.
      if (!await deps.allowRequest(hash)) return reply(429, { error: 'Limite de 60 requisições nesta hora atingido. Tente novamente mais tarde.' });
      const owner = await deps.findOwner(hash);
      if (!owner) return reply(401, { error: 'Token inválido, revogado ou expirado.' });
      if (Number(req.headers.get('Content-Length') || 0) > 1024) return reply(413, { error: 'Requisição muito grande.' });
      const reader = req.body?.getReader();
      let raw = '';
      if (reader) {
        let size = 0;
        const decoder = new TextDecoder();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 1024) { await reader.cancel(); return reply(413, { error: 'Requisição muito grande.' }); }
          raw += decoder.decode(value, { stream: true });
        }
        raw += decoder.decode();
      }
      let body; try { body = JSON.parse(raw); } catch { return reply(400, { error: 'Envie JSON válido.' }); }
      if (!validateStepsInput(body)) return reply(400, { error: 'Informe date no formato AAAA-MM-DD e steps como um inteiro válido.' });
      // Identity is derived only from the token; a caller-supplied user_id is ignored.
      await deps.save(owner, body.date, body.steps);
      return reply(200, { ok: true, date: body.date, steps: body.steps });
    } catch { return reply(503, { error: 'Não foi possível salvar os passos. Tente novamente.' }); }
  };
}
