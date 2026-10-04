# Ativar as fases 1–9 no seu projeto

Projeto: `fukfidkpmfbdapemsbpr`. Estes passos exigem acesso ao painel/CLI do Supabase e à conta Google. Nenhum secret precisa ser enviado no chat. Migrações e deploy remoto não foram executados pelo desenvolvimento local.

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

Os arquivos ficam em `supabase/migrations/`. Não altere migrações antigas e não apague tabelas para resolver erro. Guarde a mensagem de erro se alguma falhar.

## 4. Verificar Storage e Cron

A migração de fotos cria o bucket **progress-photos**, privado, máximo 1.500.000 bytes, JPEG/WebP. Em Storage, confirme **Public = desligado** e a policy `vitra_progress_photos_owner`: a primeira pasta deve corresponder a auth.uid(). Não crie policy pública.

No Cron confirme job `vitra-cleanup-integration-limits`, agenda `17 * * * *`, comando `select public.cleanup_integration_limits();`, e uma execução bem-sucedida. Isso remove quotas antigas, não dados de saúde.

## 5. Configurar secrets

Opção mais simples: **Supabase → Edge Functions → Secrets → Add new secret**:

- GEMINI_API_KEY: chave Google criada no passo 1.
- GEMINI_MODEL: gemini-3.1-flash-lite.
- ALLOWED_ORIGINS: origens reais separadas por vírgula, por exemplo http://localhost:5173,https://SEU-DOMINIO; sem barra final e sem asterisco.
- GEMINI_MODEL_MEAL, GEMINI_MODEL_BODY, GEMINI_MODEL_COACH: opcionais; usam o modelo geral se vazios.
- GEMINI_ENDPOINT: normalmente não precisa configurar.

O modelo de fotos pode ser trocado por um mais capaz usando GEMINI_MODEL_BODY. Confira suporte do modelo na sua conta. O modelo padrão confirmado tem encerramento anunciado em 07/05/2027; revise [descontinuações oficiais](https://ai.google.dev/gemini-api/docs/deprecations) antes dessa data.

Para CLI, copie `supabase/functions/.env.example` para `supabase/functions/.env.local`, preencha num editor e mantenha ignorado pelo Git. Não use arquivo de ambiente do frontend para secrets:

```sh
npx supabase login
npx supabase secrets set --env-file supabase/functions/.env.local --project-ref fukfidkpmfbdapemsbpr
```

SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY são fornecidos automaticamente às funções hospedadas. Nunca leve service role ao frontend.

## 6. Publicar funções

No terminal da pasta Vitra:

```sh
npx supabase login
npx supabase functions deploy analyze-meal --project-ref fukfidkpmfbdapemsbpr --no-verify-jwt
npx supabase functions deploy analyze-body-photos --project-ref fukfidkpmfbdapemsbpr --no-verify-jwt
npx supabase functions deploy coach --project-ref fukfidkpmfbdapemsbpr --no-verify-jwt
npx supabase functions deploy health-steps --project-ref fukfidkpmfbdapemsbpr --no-verify-jwt
npx supabase functions deploy delete-account --project-ref fukfidkpmfbdapemsbpr --no-verify-jwt
```

As três funções de IA e delete-account validam JWT internamente com auth.getUser. Health usa token restrito e revogável. Não troque essa validação por confiança no user_id enviado pelo cliente.

## 7. Publicar e testar o app

Publique o frontend em HTTPS com apenas as variáveis públicas Supabase. Configure Site URL/Redirect URLs no Auth. No Perfil, salve seus dados e autorize o novo termo de IA versão 2. Para fotos, há um consentimento separado versão 1, em Evolução → Fotos.

Verifique:

- Conta antiga mantém modelos, histórico, água, refeições, peso e cardio.
- Programa novo não apaga treinos; editor associa exercícios legados.
- Academia: valores sugeridos, um toque, descanso, desfazer, aquecimento, suspensão/retomada.
- Medidas e check-in salvam/editar na mesma data; hábitos respeitam dias programados.
- Foto envia somente JPEG reencodado; URL assinada funciona e expira; outra conta não vê arquivo/registro.
- Sem consentimento/adulto, IA é recusada; refeição é editável e só salva na confirmação.
- Análise corporal aceita fotos próprias do mesmo ângulo; comparação cautelosa e sem nota do corpo.
- Coach mostra período/origem; Aplicar abre revisão; chat não altera dados nem grava conversa.
- Backup inclui todas as tabelas; baixe fotos separadamente.
- Exclusão de conta: confirme apenas numa conta de teste após exportar; senha incorreta deve recusar, conta/fotos próprias devem desaparecer, outra conta deve permanecer.

No iPhone, valide safe areas, tema, teclado, botões e timer após bloquear/reabrir. Timer na tela bloqueada/Live Activity requer aplicativo nativo; o webapp não promete esse recurso. Passos do Saúde precisam do Atalhos conforme INTEGRATIONS.md. Não há push real nesta versão.
