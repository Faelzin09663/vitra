# Vitra

Webapp de treino, alimentação e hábitos com React 19, TypeScript, Vite e Supabase.

## Funcionalidades

- Cadastro com nome, e-mail e senha, confirmação de e-mail, recuperação de senha e login.
- Modelos de treino personalizados por dia da semana; carga, repetições e descanso.
- Cronômetro por timestamps, pausas e recuperação após suspensão da página.
- Água diária, cardio semanal em quilômetros, refeições e macros.
- Peso e evolução, perfil com estimativas de IMC e calorias, metas e exportação JSON.
- Análise de refeições pelo Google Gemini, com consentimento versionado verificado no servidor, revisão editável e confirmação antes de salvar. A foto é reduzida e reencodada sem EXIF; não é armazenada no Vitra.
- Passos manuais ou importados pelo app Atalhos do iPhone.
- Layout mobile-first e temas Claro, Escuro e Sistema, com preferência salva neste dispositivo.

## Executar

Requer Node compatível com Vite e npm.

```sh
npm ci
npm run dev
```

Copie `.env.example` para `.env.local` e preencha somente `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Chave anon pública também é aceita. Não usar service role ou chave de IA no frontend. Variáveis `NEXT_PUBLIC_*` precisam ser renomeadas para Vite.

Em Supabase → Authentication → URL Configuration, configure Site URL e Redirect URLs para `http://localhost:5173` e o domínio HTTPS publicado. O cadastro/recuperação retornam à origem atual. Para uso público configure [SMTP próprio](https://supabase.com/docs/guides/auth/auth-smtp). Reinicie o servidor ao mudar o ambiente.

## Banco e integrações

As migrações ficam em `supabase/migrations/`, em ordem. Execute somente as pendentes: as três primeiras não são idempotentes. As duas de 04/10/2026 são idempotentes e preservam dados.

`user_data` ainda guarda o documento do painel, metas, perfil, modelos, séries e logs. `daily_records` arquiva os dias por gatilho transacional. Passos/conexões e quotas têm tabelas próprias. A troca do provedor não migra nem apaga os logs antigos.

A tela mostra status de salvamento/repetição e salva antes de sair. Offline permanece em memória; mantenha a página aberta enquanto houver alterações pendentes. Em dois dispositivos prevalece o último painel salvo, sem mesclagem.

Para ativar IA, siga [MANUAL-STEPS.md](docs/MANUAL-STEPS.md): plano pago do Gemini com faturamento ativo, secret `GEMINI_API_KEY` no Supabase, origens permitidas, migração de quotas e deploy de `analyze-meal`. O modelo padrão é `gemini-3.1-flash-lite`, configurável por função sem editar o código. A IA exige perfil adulto e consentimento; registros manuais continuam disponíveis.

Veja [INTEGRATIONS.md](docs/INTEGRATIONS.md) para o timer, Gemini, perfil e Atalhos; [SECURITY.md](docs/SECURITY.md) para privacidade, quotas, rotação e revogação; [PLAN-FEATURES.md](docs/PLAN-FEATURES.md) para o reconhecimento e fases futuras.

## Validação

```sh
npm test
npm run build
npx deno check supabase/functions/analyze-meal/index.ts supabase/functions/health-steps/index.ts
```

Vitest/Testing Library usam clientes e provedor simulados; nenhuma chamada real ao Gemini. Cobrem autenticação, salvamento, histórico, timer, perfil, consentimento, revisão, foto reduzida, CORS e erros do provedor.

Há também verificação SQL isolada com PostgreSQL/WASM (sem banco remoto):

```sh
npx deno run --node-modules-dir=auto --allow-read --allow-env --allow-sys tests/sql/ai-quota.check.ts
```

Essa verificação testa quotas, wrapper, permissões, limpeza e idempotência; o agendador Cron é simulado. Verifique o cron no Supabase e os recursos iOS em um iPhone.

## Estrutura

`src/`: app, componentes, autenticação, tema, lógica e persistência.
`supabase/functions/`: handlers, provedor Gemini e Edge Functions.
`supabase/migrations/`: esquema/RLS e quotas.
`tests/`: testes locais; `docs/`: plano, integrações, segurança e publicação.

O build estático fica em `dist/`; publique em HTTPS com as duas variáveis públicas de ambiente. As funções/secrets/migrações são publicados separadamente no Supabase. O webapp instalado ainda não oferece Live Activities/HealthKit direto nem fila offline durável.
Biblioteca: 134 exercicios originais, busca e filtros, personalizados no Supabase e sete programas importaveis sem sobrescrever treinos.

Fase 3: substituicoes preservam o modelo e registram a origem no historico. Relatos de desconforto usam `202610040004_session_tools.sql`; aviso conservador com 3 relatos da mesma regiao em 14 dias.

Fase 4: modo academia com autofill, descanso absoluto, tipos de serie, recordes estimados e desfazer. Wake Lock retoma com visibilitychange; som depende do navegador e autorizacao por toque. Sem migracao adicional.

Evolução: medidas em cm, estimativas por medidas, fotos privadas, comparação por ângulo e análise visual opcional com Gemini, consentimento específico e idade adulta. Veja `docs/ANALYTICS.md` e `docs/MANUAL-STEPS.md`.
