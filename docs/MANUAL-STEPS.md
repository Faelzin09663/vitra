# Publicar a troca para Gemini — Fase 1

Nenhuma chamada real à API nem alteração no seu Supabase foi realizada nesta fase.

1. No [Google AI Studio](https://aistudio.google.com/apikey), crie/associe um projeto Google Cloud. Ative uma conta de faturamento no projeto **antes de enviar qualquer foto/dado de saúde**. Confirme uso como serviço pago. Veja [termos](https://ai.google.dev/gemini-api/terms).
2. Crie a chave Gemini. Configure-a somente em **Supabase → Edge Functions → Secrets → GEMINI_API_KEY**. Não envie no chat, não coloque no frontend nem em comandos com valor literal.
3. Revogue a chave do provedor anterior no painel dele e exclua os antigos secrets de IA do Supabase. As variáveis antigas foram retiradas do código/exemplos locais.
4. Confira quais migrações já foram aplicadas. Execute apenas as pendentes, nesta ordem:
   - 202610030001_vitra.sql, 202610030002_history.sql e 202610030003_integrations.sql, uma vez cada.
   - Habilite Supabase → Integrations → Cron → pg_cron.
   - 202610040001_security.sql, caso ainda não aplicada.
   - **202610040002_ai_provider.sql**, nova nesta fase; idempotente, preserva logs e contadores antigos.
5. Configure Secrets: GEMINI_MODEL=gemini-3.1-flash-lite; ALLOWED_ORIGINS=http://localhost:5173,https://SEU-DOMINIO. Opcionalmente GEMINI_MODEL_MEAL substitui o geral. GEMINI_MODEL_BODY/COACH são preparação para futuras funções. GEMINI_ENDPOINT é base administrativa; padrão https://generativelanguage.googleapis.com/v1beta.
6. Entre na CLI e publique a função atualizada:

```sh
npx supabase login
npx supabase functions deploy analyze-meal --project-ref fukfidkpmfbdapemsbpr --no-verify-jwt
```

JWT, consentimento e quota são verificados dentro da função. Publique health-steps apenas se ainda não publicou a versão da fase anterior:

```sh
npx supabase functions deploy health-steps --project-ref fukfidkpmfbdapemsbpr --no-verify-jwt
```

Para secrets por CLI, use arquivo local ignorado das funções, preenchido com editor; não faça echo da chave. O comando é `npx supabase secrets set --env-file supabase/functions/.env.local --project-ref fukfidkpmfbdapemsbpr`. Preencher esse arquivo não ativa a função remotamente. Não use o .env da raiz para secrets de IA.

7. Publique o frontend em HTTPS com somente as duas variáveis públicas Supabase. Não publique a pasta de funções como assets. Atualize Site URL/Redirect URLs no Supabase Auth.
8. No app, salve idade adulta no Perfil e autorize IA. Teste: sem autorização não envia; autorizado analisa descrição/foto; revisão permite editar todos os valores e porções; só confirmação salva; desativar bloqueia nova análise.
9. No Cron confirme vitra-cleanup-integration-limits, ativo, agendado 17 * * * *. A consulta agendada é select public.cleanup_integration_limits();. Inspecione execuções.
10. Antes de **07/05/2027**, altere o modelo padrão para um modelo suportado, por exemplo o substituto oficial gemini-3.5-flash-lite, e valide uma análise. A data anunciada está em [descontinuações](https://ai.google.dev/gemini-api/docs/deprecations).

As fases seguintes ainda não criaram bucket de fotos nem funções de corpo/coach. Não execute instruções de deploy para recursos que não existem.
Fase 2: execute tambem `202610040003_exercise_library.sql` para salvar exercicios personalizados. A biblioteca e os programas nao dependem dessa tabela.

Fase 3: substituicoes preservam o modelo e registram a origem no historico. Relatos de desconforto usam `202610040004_session_tools.sql`; aviso conservador com 3 relatos da mesma regiao em 14 dias.

Fase 5: execute `202610040005_body_progress.sql` depois da 004. Ela cria medidas, fotos, análises e o bucket privado com políticas. Publique `analyze-body-photos --no-verify-jwt`; configure o mesmo `GEMINI_API_KEY`, `ALLOWED_ORIGINS` e, opcionalmente, `GEMINI_MODEL_BODY`. Não há upload público.

Fase 6: check-in diario editavel, tendencias de 7 dias, habitos e sequencias por agenda, calendario de 90 dias e agua/treino derivados. Execute `202610040006_checkins_habits.sql`. Sem notificacao push; lembrete dentro do app.
