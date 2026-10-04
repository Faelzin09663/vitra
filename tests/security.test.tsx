import { afterEach, describe, expect, it, vi } from 'vitest';
import { uid } from '../src/lib/uid';
import { createAnalysisHandler } from '../supabase/functions/_shared/analyze-handler';
import { parseAllowedOrigins } from '../supabase/functions/_shared/cors';
import { createHealthHandler, tokenHash } from '../supabase/functions/_shared/health-handler';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('IDs em HTTP local', () => {
  it('usa o UUID nativo quando disponível', () => {
    const id = '12345678-1234-4234-8234-123456789abc';
    const native = vi.spyOn(crypto, 'randomUUID').mockReturnValue(id);
    expect(uid()).toBe(id);
    expect(native).toHaveBeenCalledOnce();
  });
  it('usa getRandomValues quando randomUUID não existe, preservando formato e unicidade', () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
    const values = Array.from({ length: 100 }, uid);
    expect(new Set(values).size).toBe(100);
    values.forEach(id => expect(id).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/));
  });
});

describe('CORS por origem exata', () => {
  const setup = (allowedOrigins = 'http://localhost:5173,https://vitra.example') => {
    const authenticate = vi.fn().mockResolvedValue(null);
    const fetcher = vi.fn();
    return { authenticate, fetcher, handler: createAnalysisHandler({ allowedOrigins, authenticate, fetcher, allowRequest: async () => true }) };
  };
  it('ignora curingas, origens opacas, credenciais e caminhos', () => {
    expect(parseAllowedOrigins('*,null,https://vitra.example/,https://user:pass@vitra.example,http://localhost:5173,http://localhost:5173')).toEqual(['http://localhost:5173']);
  });
  it('permite preflight somente para origens configuradas, POST e cabeçalhos conhecidos', async () => {
    const { handler, authenticate } = setup();
    const response = await handler(new Request('https://api.example', { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization, content-type, apikey' } }));
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    expect(response.headers.get('Vary')).toBe('Origin');
    expect(authenticate).not.toHaveBeenCalled();
    for (const extra of [{ 'Access-Control-Request-Method': 'DELETE' }, { 'Access-Control-Request-Headers': 'x-unknown' }]) {
      expect((await handler(new Request('https://api.example', { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST', ...extra } }))).status).toBe(403);
    }
  });
  it('bloqueia origens não permitidas antes de autenticar ou chamar o provedor', async () => {
    const { handler, authenticate, fetcher } = setup();
    for (const method of ['OPTIONS', 'POST']) {
      const response = await handler(new Request('https://api.example', { method, headers: { Origin: 'https://vitra.example.attacker.test', 'Access-Control-Request-Method': 'POST' } }));
      expect(response.status).toBe(403);
      expect(response.headers.has('Access-Control-Allow-Origin')).toBe(false);
    }
    expect(authenticate).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('falha fechado sem configuração, e mantém CORS nos erros de origem permitida', async () => {
    expect((await setup('').handler(new Request('https://api.example', { method: 'POST', headers: { Origin: 'http://localhost:5173' } }))).status).toBe(403);
    const response = await setup().handler(new Request('https://api.example', { method: 'POST', headers: { Origin: 'https://vitra.example' } }));
    expect(response.status).toBe(401);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://vitra.example');
    expect((await setup().handler(new Request('https://api.example', { method: 'OPTIONS' }))).status).toBe(403);
  });
});

describe('Quota e token do Saúde', () => {
  const token = `vitra_health_${'a'.repeat(64)}`;
  const request = (body = '{}') => new Request('https://api.example', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body });
  it('não consulta titulares nem grava após atingir a quota', async () => {
    const allowRequest = vi.fn().mockResolvedValue(false), findOwner = vi.fn(), save = vi.fn();
    const response = await createHealthHandler({ allowRequest, findOwner, save })(request());
    expect(response.status).toBe(429);
    expect(allowRequest).toHaveBeenCalledWith(await tokenHash(token));
    expect(findOwner).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(response.headers.has('Access-Control-Allow-Origin')).toBe(false);
  });
  it('conta tentativas com token revogado e falha fechado quando a quota está indisponível', async () => {
    const allowRequest = vi.fn().mockResolvedValue(true), save = vi.fn();
    const handler = createHealthHandler({ allowRequest, findOwner: async () => null, save });
    expect((await handler(request())).status).toBe(401);
    expect(allowRequest).toHaveBeenCalledOnce();
    allowRequest.mockRejectedValueOnce(new Error('database unavailable'));
    expect((await handler(request())).status).toBe(503);
    expect(save).not.toHaveBeenCalled();
  });
  it('recusa corpo grande sem depender de Content-Length e não oferece preflight', async () => {
    const save = vi.fn();
    const handler = createHealthHandler({ allowRequest: async () => true, findOwner: async () => 'owner-a', save });
    expect((await handler(request('a'.repeat(1025)))).status).toBe(413);
    expect((await handler(new Request('https://api.example', { method: 'OPTIONS' }))).status).toBe(405);
    expect(save).not.toHaveBeenCalled();
  });
});
