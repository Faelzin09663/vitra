import { describe, expect, it, vi } from 'vitest';
import { createHealthHandler, validateStepsInput } from '../supabase/functions/_shared/health-handler';
describe('Passos pelo Atalhos', () => {
  it('bloqueia envio sem um token de sincronização', async () => {
    const save = vi.fn();
    const handler = createHealthHandler({ allowRequest: async () => true, findOwner: async () => 'owner-a', save });
    expect((await handler(new Request('https://example.com', { method: 'POST', body: '{}' }))).status).toBe(401);
    expect(save).not.toHaveBeenCalled();
  });
  it('deriva a conta do token e não aceita um user_id enviado no JSON', async () => {
    const save = vi.fn(), findOwner = vi.fn().mockResolvedValue('owner-a');
    const handler = createHealthHandler({ allowRequest: async () => true, findOwner, save });
    const date = new Date().toISOString().slice(0, 10);
    const response = await handler(new Request('https://example.com', { method: 'POST', headers: { Authorization: `Bearer vitra_health_${'a'.repeat(64)}` }, body: JSON.stringify({ date, steps: 6000, user_id: 'owner-b' }) }));
    expect(response.status).toBe(200);
    expect(save).toHaveBeenCalledWith('owner-a', date, 6000);
    expect(findOwner.mock.calls[0][0]).toMatch(/^[a-f0-9]{64}$/);
    expect(findOwner.mock.calls[0][0]).not.toContain('vitra_health');
  });
  it('recusa passos negativos, fracionários, datas inexistentes e tokens revogados', async () => {
    expect(validateStepsInput({ date: '2026-02-30', steps: 1000 })).toBe(false);
    expect(validateStepsInput({ date: new Date().toISOString().slice(0, 10), steps: -1 })).toBe(false);
    expect(validateStepsInput({ date: new Date().toISOString().slice(0, 10), steps: 10.5 })).toBe(false);
    const save = vi.fn();
    const handler = createHealthHandler({ allowRequest: async () => true, findOwner: async () => null, save });
    const response = await handler(new Request('https://example.com', { method: 'POST', headers: { Authorization: `Bearer vitra_health_${'b'.repeat(64)}` }, body: '{}' }));
    expect(response.status).toBe(401); expect(save).not.toHaveBeenCalled();
  });
});
