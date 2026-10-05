# Vitra

Webapp pessoal de treino, alimentação e hábitos em React 19, TypeScript, Vite e Supabase. Interface em português, mobile-first, temas Claro/Escuro/Sistema.

## Recursos

- Cadastro com nome, e-mail e senha; confirmação, login e recuperação.
- Vários modelos de treino e agenda semanal; biblioteca original com 134 exercícios, personalizados no Supabase e sete programas importáveis sem sobrescrever modelos.
- Sessões com snapshot, substituições com motivo, registros de desconforto e alerta conservador de recorrência.
- Modo academia: um exercício por vez, valores do histórico, carga/repetições em um toque, tipos de série, recordes estimados, descanso, desfazer e Wake Lock.
- Água, refeições/macros, cardio em quilômetros, peso a cada três dias e perfil com IMC/calorias que acompanham o peso.
- Gasto estimado de treino/cardio, parcelas por exercício e meta com déficit/crédito configuráveis, sem duplicar o fator semanal. [Método e limites](docs/ENERGY.md).
- Medidas, gráficos, estimativa por circunferências e fotos privadas sem EXIF, comparação por ângulo e download/exclusão.
- Check-in diário, média móvel de sete dias, hábitos por agenda, sequências e calendário de 90 dias.
- Volume, 1RM estimado, possível platô e equilíbrio muscular com dados mínimos e alertas dispensáveis.
- VIT: interface de chatbot com histórico lateral, campo de envio fixo, conversas e memórias no Supabase, contexto dos registros e fotos próprias opcionais. [Como usar](docs/VIT.md).
- Gemini: refeições revisáveis por texto/porções ou foto, análise corporal opcional, coach e chat numérico com consultas fechadas, consentimentos e quotas.
- Passos manuais ou importados por Atalhos do iPhone; backup completo JSON e exclusão autenticada de conta.

As sugestões são informativas, sem diagnóstico ou prescrição. IA exige idade adulta, consentimento e plano pago do Gemini.

## Executar

Com Node compatível com Vite instalado:

```sh
npm ci
npm run dev
```

Todas as chaves ficam no **`.env` da raiz**, ignorado pelo Git. Use `.env.example` como modelo; neste checkout, a conexão pública existente foi preservada no `.env`. Preencha `SUPABASE_SECRET_KEY` e `GEMINI_API_KEY` no editor. Apenas variáveis `VITE_*` entram no navegador; nunca use esse prefixo em chaves privadas. A alternativa legada `SUPABASE_SERVICE_ROLE_KEY` também é aceita.

`npm run dev` inicia frontend e backend juntos: Vite em 5173 (ou próxima porta livre) e API em 8787, com proxy `/api`. O backend recarrega ao alterar seus arquivos. O runtime Deno é instalado pelo `npm ci`, sem instalação global. As rotas de refeições, fotos, coach, VIT, passos e exclusão de conta usam esse backend. Sem credenciais privadas, cadastro e registros continuam usando o Supabase diretamente, mas essas rotas informam configuração pendente.

Configure Site URL/Redirect URLs no Supabase Auth para localhost e seu domínio HTTPS. Para uso público configure [SMTP](https://supabase.com/docs/guides/auth/auth-smtp). Reinicie o servidor ao alterar ambiente.

## Ativar banco e backend

Siga [MANUAL-STEPS.md](docs/MANUAL-STEPS.md): configure o `.env`, migrações e bucket privado. **Não é necessário cadastrar Secrets ou publicar Edge Functions no Supabase.** Supabase continua responsável por banco, Auth, Storage e quotas SQL; a API do Vitra lê as chaves no servidor.

Na **Vercel**, `vercel.json` publica o frontend Vite e as seis funções Node em `api/`, incluindo `/api/vit`. Cadastre as variáveis do arquivo privado `.env.vercel` no projeto e faça novo deploy, com `VITE_API_URL=/api`. Chaves privadas são lidas apenas pelas funções. Veja [VERCEL.md](docs/VERCEL.md).

Em um servidor com processo persistente, execute `npm run build` e `npm start` com o `.env` configurado; exponha a porta 8787 por HTTPS. Ele entrega `dist/` e `/api` juntos. Se separar frontend e API, configure `VITE_API_URL` antes do build e inclua a origem do frontend em `ALLOWED_ORIGINS`. Veja [ENVIRONMENT.md](docs/ENVIRONMENT.md).

Logs legados permanecem em `user_data` e `daily_records`, sem migração destrutiva de datas ou histórico. Novos registros usam tabelas próprias com RLS por titular e datas ISO. Sessões continuam por timestamps.

O salvamento do painel é serializado, com estado de sincronização e repetição. Offline fica em memória: mantenha a página aberta até sincronizar. Entre dispositivos, o último documento salvo prevalece, sem mesclagem. Tabelas novas usam upsert por titular/data ou ID.

Backup v4 inclui todas as tabelas novas, registros arquivados e painel, com paginação. Não inclui tokens, credenciais ou bytes de fotos; baixe as imagens separadamente. Importação de backup ainda não existe.

## Validar

```sh
npm test
npm run build
npm run check:server
npx deno run --node-modules-dir=none --allow-read --allow-env --allow-sys tests/sql/ai-quota.check.ts
npx deno run --node-modules-dir=none --allow-read --allow-env --allow-sys tests/sql/features-rls.check.ts
npx deno run --node-modules-dir=none --allow-read --allow-env --allow-sys tests/sql/vit-rls.check.ts
```

Vitest/Testing Library usam Supabase e IA simulados. PostgreSQL/WASM verifica SQL/RLS, quota e idempotência, sem banco remoto; Cron e esquema Storage são fixtures. Não houve chamada real ao Gemini nem teste físico no iPhone. Valide publicação, faturamento, URLs assinadas e Atalhos no ambiente real seguindo o checklist manual.

## Documentação

- [Integrações e iOS](docs/INTEGRATIONS.md).
- [Privacidade, Storage e segurança](docs/SECURITY.md).
- [Regras das análises](docs/ANALYTICS.md).
- [Plano e fases concluídas](docs/PLAN-FEATURES.md).
- [Alterações](CHANGELOG.md).

`src/pages/` carrega treino/evolução por demanda; `src/components/` contém fluxos, `src/data/` o catálogo versionado e programas, `src/lib/` cálculos/persistência. Servidor em `server/`, handlers compartilhados em `supabase/functions/` e esquema em `supabase/migrations/`.
