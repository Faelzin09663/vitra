import { describe, expect, it, vi } from 'vitest';
import { createAnalysisHandler } from '../supabase/functions/_shared/analyze-handler';
import { parseMealAnalysis } from '../supabase/functions/_shared/meal-schema';
import { createHealthHandler, validateStepsInput } from '../supabase/functions/_shared/health-handler';
const analysis = { name: 'Arroz e frango', calories: 450, protein: 35, carbs: 48, fat: 12, confidence: 'medium', notes: 'Porções estimadas.', foods: [{ name: 'Arroz', portion: '150 g' }] };
describe('Análise NVIDIA', () => {
  it('exige login antes de enviar qualquer informação à NVIDIA', async () => {
    const fetcher = vi.fn();
    const handler = createAnalysisHandler({ authenticate: async () => null, allowRequest: async () => true, apiKey: 'server-only', fetcher });
    const response = await handler(new Request('https://example.com', { method: 'POST', body: '{}' }));
    expect(response.status).toBe(401); expect(fetcher).not.toHaveBeenCalled();
  });
  it('envia somente a refeição e aceita resultado validado', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: JSON.stringify(analysis) } }] }));
    const handler = createAnalysisHandler({ authenticate: async () => 'owner-a', allowRequest: async () => true, apiKey: 'server-only', fetcher });
    const result = await handler(new Request('https://example.com', { method: 'POST', headers: { Authorization: 'Bearer user-token' }, body: JSON.stringify({ description: 'Arroz e frango' }) }));
    expect(result.status).toBe(200);
    expect((await result.json()).analysis.calories).toBe(450);
    const sent = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(sent.messages[1].content[0].text).toBe('Arroz e frango');
    expect(JSON.stringify(sent)).not.toContain('owner-a');
    expect(JSON.stringify(sent)).not.toContain('user-token');
  });
  it('não faz chamadas ao modelo quando a quota é atingida', async () => {
    const fetcher = vi.fn();
    const handler = createAnalysisHandler({ authenticate: async () => 'owner-a', allowRequest: async () => false, apiKey: 'secret', fetcher });
    const response = await handler(new Request('https://example.com', { method: 'POST', headers: { Authorization: 'Bearer user-token' }, body: JSON.stringify({ description: 'Arroz' }) }));
    expect(response.status).toBe(429); expect(fetcher).not.toHaveBeenCalled();
  });
  it('recusa valores nutricionais inválidos e suporta JSON cercado por markdown', () => {
    expect(() => parseMealAnalysis(JSON.stringify({ ...analysis, calories: -50 }))).toThrow();
    expect(() => parseMealAnalysis(JSON.stringify({ ...analysis, protein: '35' }))).toThrow();
    expect(parseMealAnalysis('```json\n' + JSON.stringify(analysis) + '\n```').name).toBe('Arroz e frango');
  });
  it('não aceita URL externa enviada pelo usuário como imagem', async () => {
    const fetcher = vi.fn();
    const handler = createAnalysisHandler({ authenticate: async () => 'owner-a', allowRequest: async () => true, apiKey: 'secret', fetcher });
    const response = await handler(new Request('https://example.com', { method: 'POST', headers: { Authorization: 'Bearer user-token' }, body: JSON.stringify({ image: 'http://internal/admin' }) }));
    expect(response.status).toBe(400); expect(fetcher).not.toHaveBeenCalled();
  });
});
describe('Passos pelo Atalhos', () => {
  it('bloqueia envio sem um token de sincronização', async () => {
    const save = vi.fn();
    const handler = createHealthHandler({ findOwner: async () => 'owner-a', save });
    expect((await handler(new Request('https://example.com', { method: 'POST', body: '{}' }))).status).toBe(401);
    expect(save).not.toHaveBeenCalled();
  });
  it('deriva a conta do token e não aceita um user_id enviado no JSON', async () => {
    const save = vi.fn(), findOwner = vi.fn().mockResolvedValue('owner-a');
    const handler = createHealthHandler({ findOwner, save });
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
    const handler = createHealthHandler({ findOwner: async () => null, save });
    const response = await handler(new Request('https://example.com', { method: 'POST', headers: { Authorization: `Bearer vitra_health_${'b'.repeat(64)}` }, body: '{}' }));
    expect(response.status).toBe(401); expect(save).not.toHaveBeenCalled();
  });
});
