# Ativar as fases 1–9 no seu projeto

Projeto: `fukfidkpmfbdapemsbpr`. Estes passos exigem acesso ao painel/CLI do Supabase e à conta Google. Nenhum secret precisa ser enviado no chat. Migrações e publicação remota não foram executadas pelo desenvolvimento local. Chaves ficam no .env da raiz; Supabase Secrets não são necessários.

## 1. Google: plano pago e chave

Abra [Google AI Studio → API Keys](https://aistudio.google.com/apikey), associe um projeto Google Cloud e ative faturamento nele antes de enviar dados de saúde/fotos. Crie a chave nesse projeto. Confirme o serviço pago conforme os [termos](https://ai.google.dev/gemini-api/terms); chave gratuita não atende o requisito de privacidade do app.

## 2. Revogar a chave anterior

Revogue a chave do provedor anterior no painel dele, inclusive a chave compartilhada anteriormente no chat. Remova os secrets antigos no Supabase. Não reutilize essa chave como chave Google.

## 3. Migrações em ordem

Supabase → SQL Editor → New query. Abra cada arquivo local abaixo, copie o conteúdo inteiro, execute e confirme sucesso antes do seguinte. Se já aplicado, não execute novamente as três primeiras. Todas as migrações novas de 04/10 são idempotentes.

1. `202610030001_vitra.sql` — Auth/perfil/painel.
2. `202610030002_history.sql` — arquivo diário.
3. `202610030003_integrations.sql` — passos/tokens.
4. Ative **Integrations → Cron (pg_cron)**.
5. `202610040001_security.sql` — limites/limpeza.
6. `202610040002_ai_provider.sql` — quota genérica Gemini.
7. `202610040003_exercise_library.sql` — exercícios personalizados.
8. `202610040004_session_tools.sql` — desconforto.
9. `202610040005_body_progress.sql` — medidas/fotos/análises/Storage.
10. `202610040006_checkins_habits.sql` — check-ins/hábitos.
11. `202610040007_vit.sql` — conversas, mensagens e memórias do VIT.

Os arquivos ficam em `supabase/migrations/`. Não altere migrações antigas e não apague tabelas para resolver erro. Guarde a mensagem de erro se alguma falhar.

## 4. Verificar Storage e Cron

A migração de fotos cria o bucket **progress-photos**, privado, máximo 1.500.000 bytes, JPEG/WebP. Em Storage, confirme **Public = desligado** e a policy `vitra_progress_photos_owner`: a primeira pasta deve corresponder a auth.uid(). Não crie policy pública.

No Cron confirme job `vitra-cleanup-integration-limits`, agenda `17 * * * *`, comando `select public.cleanup_integration_limits();`, e uma execução bem-sucedida. Isso remove quotas antigas, não dados de saúde.

## 5. Configurar o .env

Abra `.env` na raiz do Vitra. Todas as chaves ficam nele, sem cadastrar Secrets no Supabase. Consulte [ENVIRONMENT.md](ENVIRONMENT.md) para detalhes.

- VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY: conexão pública existente, preservada neste checkout.
- SUPABASE_SECRET_KEY: copie/crie a Secret key em Supabase > Settings > API Keys > Publishable and secret API keys e cole somente no .env. Alternativa legada: SUPABASE_SERVICE_ROLE_KEY.
- GEMINI_API_KEY: chave Google criada no passo 1.
- GEMINI_MODEL: gemini-3.1-flash-lite; overrides MEAL/BODY/COACH/VIT são opcionais.
- ALLOWED_ORIGINS: origens exatas do frontend, incluindo o domínio HTTPS publicado, sem barra final.
- API_PORT: 8787 por padrão. VITE_API_URL: /api para app e backend juntos.

Não adicione prefixo VITE_ a uma chave privada. Não envie chaves no chat. Preencha os campos privados somente no seu ambiente. O modelo padrão tem encerramento anunciado em 07/05/2027; revise [descontinuações oficiais](https://ai.google.dev/gemini-api/docs/deprecations).

## 6. Executar o backend e o app

Na pasta Vitra:

```sh
npm ci
npm run dev
```

Isso inicia Vite em 5173 (ou próxima porta livre) e API em 8787. Encerre com Ctrl+C e reinicie depois de editar o .env. Para produção:

```sh
npm run build
npm start
```

O servidor entrega `dist/` e `/api` pela mesma porta; publique por HTTPS num host que mantenha o processo ativo e instale as dependências incluindo o runtime Deno. Não é necessário publicar Edge Functions. Os handlers continuam verificando JWT/token, consentimentos e quotas no banco.

## 7. Publicar e testar o app

Publique app e backend Vitra em HTTPS, com o .env privado no servidor. Em hospedagem separada, configure VITE_API_URL antes do build e ALLOWED_ORIGINS no backend. Configure Site URL/Redirect URLs no Auth. No Perfil, salve seus dados e autorize o novo termo de IA versão 2. Para fotos, há um consentimento separado versão 1, em Evolução → Fotos.

Verifique:

- Conta antiga mantém modelos, histórico, água, refeições, peso e cardio.
- Programa novo não apaga treinos; editor associa exercícios legados.
- Academia: valores sugeridos, um toque, descanso, desfazer, aquecimento, suspensão/retomada.
- Medidas e check-in salvam/editar na mesma data; hábitos respeitam dias programados.
- Foto envia somente JPEG reencodado; URL assinada funciona e expira; outra conta não vê arquivo/registro.
- Sem consentimento/adulto, IA é recusada; refeição é editável e só salva na confirmação.
- Análise corporal aceita fotos próprias do mesmo ângulo; comparação cautelosa e sem nota do corpo.
- Coach mostra período/origem; Aplicar abre revisão; o chat numérico antigo não altera dados nem grava conversa.
- VIT: autorize na própria tela, envie texto, confirme uma memória, abra outra conversa e confira o contexto; voltar/recarregar mantém o histórico. Apagar conversa não apaga memória/foto.
- Backup inclui todas as tabelas; baixe fotos separadamente.
- Exclusão de conta: confirme apenas numa conta de teste após exportar; senha incorreta deve recusar, conta/fotos próprias devem desaparecer, outra conta deve permanecer.

A migração do VIT já foi confirmada pelo titular neste checkout; uma consulta remota sem linhas confirmou as três tabelas. Não é necessário repetir a criação. Veja [VIT.md](VIT.md).

No iPhone, valide safe areas, tema, teclado, botões e timer após bloquear/reabrir. Timer na tela bloqueada/Live Activity requer aplicativo nativo; o webapp não promete esse recurso. Passos do Saúde precisam do Atalhos conforme INTEGRATIONS.md. Não há push real nesta versão.
