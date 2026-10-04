# Vitra

Webapp pessoal de treino, alimentação e hábitos em React 19, TypeScript, Vite e Supabase. Interface em português, mobile-first, temas Claro/Escuro/Sistema.

## Recursos

- Cadastro com nome, e-mail e senha; confirmação, login e recuperação.
- Vários modelos de treino e agenda semanal; biblioteca original com 134 exercícios, personalizados no Supabase e sete programas importáveis sem sobrescrever modelos.
- Sessões com snapshot, substituições com motivo, registros de desconforto e alerta conservador de recorrência.
- Modo academia: um exercício por vez, valores do histórico, carga/repetições em um toque, tipos de série, recordes estimados, descanso, desfazer e Wake Lock.
- Água, refeições/macros, cardio em quilômetros, peso a cada três dias e perfil com IMC/calorias que acompanham o peso.
- Medidas, gráficos, estimativa por circunferências e fotos privadas sem EXIF, comparação por ângulo e download/exclusão.
- Check-in diário, média móvel de sete dias, hábitos por agenda, sequências e calendário de 90 dias.
- Volume, 1RM estimado, possível platô e equilíbrio muscular com dados mínimos e alertas dispensáveis.
- Gemini: refeições revisáveis, análise corporal opcional, coach e chat numérico com consultas fechadas, consentimentos e quotas.
- Passos manuais ou importados por Atalhos do iPhone; backup completo JSON e exclusão autenticada de conta.

As sugestões são informativas, sem diagnóstico ou prescrição. IA exige idade adulta, consentimento e plano pago do Gemini.

## Executar

Com Node compatível com Vite instalado:

```sh
npm ci
npm run dev
```

Copie `.env.example` para `.env.local` e configure apenas `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (anon pública também aceita). Renomeie variáveis NEXT_PUBLIC para VITE neste projeto. Nunca coloque chave de IA ou service role no frontend.

Configure Site URL/Redirect URLs no Supabase Auth para localhost e seu domínio HTTPS. Para uso público configure [SMTP](https://supabase.com/docs/guides/auth/auth-smtp). Reinicie o servidor ao alterar ambiente.

## Ativar no Supabase

Siga [MANUAL-STEPS.md](docs/MANUAL-STEPS.md), em ordem: faturamento/chave Google, rotação da chave anterior, migrações, bucket privado, secrets e deploy. Código pronto não significa que migrations/functions já estejam publicadas.

Logs legados permanecem em `user_data` e `daily_records`, sem migração destrutiva de datas ou histórico. Novos registros usam tabelas próprias com RLS por titular e datas ISO. Sessões continuam por timestamps.

O salvamento do painel é serializado, com estado de sincronização e repetição. Offline fica em memória: mantenha a página aberta até sincronizar. Entre dispositivos, o último documento salvo prevalece, sem mesclagem. Tabelas novas usam upsert por titular/data ou ID.

Backup v3 inclui todas as tabelas novas, registros arquivados e painel, com paginação. Não inclui tokens, credenciais ou bytes de fotos; baixe as imagens separadamente. Importação de backup ainda não existe.

## Validar

```sh
npm test
npm run build
npx deno check supabase/functions/analyze-meal/index.ts supabase/functions/analyze-body-photos/index.ts supabase/functions/coach/index.ts supabase/functions/health-steps/index.ts supabase/functions/delete-account/index.ts
npx deno run --node-modules-dir=auto --allow-read --allow-env --allow-sys tests/sql/ai-quota.check.ts
npx deno run --node-modules-dir=auto --allow-read --allow-env --allow-sys tests/sql/features-rls.check.ts
```

Vitest/Testing Library usam Supabase e IA simulados. PostgreSQL/WASM verifica SQL/RLS, quota e idempotência, sem banco remoto; Cron e esquema Storage são fixtures. Não houve chamada real ao Gemini nem teste físico no iPhone. Valide publicação, faturamento, URLs assinadas e Atalhos no ambiente real seguindo o checklist manual.

## Documentação

- [Integrações e iOS](docs/INTEGRATIONS.md).
- [Privacidade, Storage e segurança](docs/SECURITY.md).
- [Regras das análises](docs/ANALYTICS.md).
- [Plano e fases concluídas](docs/PLAN-FEATURES.md).
- [Alterações](CHANGELOG.md).

`src/pages/` carrega treino/evolução por demanda; `src/components/` contém fluxos, `src/data/` o catálogo versionado e programas, `src/lib/` cálculos/persistência. Backend em `supabase/functions/` e esquema em `supabase/migrations/`.
