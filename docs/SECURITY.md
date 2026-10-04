# Segurança — Vitra

## Escopo e ameaças

O app guarda dados de saúde e hábitos. Os principais riscos são acesso entre contas, roubo de sessão/token, exposição de chaves, abuso dos endpoints e envio de conteúdo não confiável ao provedor de IA.

- O navegador usa somente a URL Supabase e a chave pública; RLS aplica a identidade `auth.uid()` aos registros. A chave pública não substitui autenticação.
- `analyze-meal` valida o JWT com `auth.getUser`, limita a entrada e usa a quota atômica existente de **20 análises por usuário por hora de calendário**. Fotos/descrições são enviadas à NVIDIA somente para análise; identidade e JWT não são enviados. Estimativas são dados não confiáveis e passam por validação.
- `ALLOWED_ORIGINS` contém origens exatas separadas por vírgula, sem barra final. Inclua `http://localhost:5173` e o domínio HTTPS publicado. Não há curinga. Sem configuração, requisições de navegador são recusadas. Preflight aceita apenas POST e os cabeçalhos previstos. Respostas variam por Origin.
- CORS limita navegadores, não autentica clientes. Clientes sem Origin continuam sujeitos ao JWT e à quota. Não confie em Origin como prova de identidade.
- `health-steps` não oferece CORS. O app Atalhos envia um token dedicado de 256 bits. Apenas o hash SHA-256 é armazenado; titular e validade vêm de `health_connections`, nunca do JSON recebido. Tokens expiram em 90 dias.
- A nova quota limita a **60 tentativas por hash por hora de calendário**, antes da consulta de titular, inclusive para tokens revogados/expirados com formato válido. A operação no banco é atômica. Falha na quota bloqueia a gravação. Clientes não podem ler, consumir ou zerar quotas.
- Limites por token não impedem ataques distribuídos com hashes aleatórios. Para uso público em maior escala, adicione proteção por IP no gateway e monitore tráfego e custo. Nunca registre Authorization, tokens ou corpos de refeições em logs.
- Um job horário limpa somente quotas de refeições/passos com mais de sete dias; não remove perfis nem registros de saúde. RLS, timer e histórico existentes permanecem inalterados.
- `uid()` gera identificadores de registros com `randomUUID` ou `getRandomValues` em HTTP local. Não o use para senhas/tokens; a geração de tokens do Saúde continua separada e criptográfica. Use HTTPS em produção.

## Segredos e auditoria do Git

- `.env.local` da raiz: apenas `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (públicos).
- `supabase/functions/.env.local`: `NVIDIA_API_KEY`, `ALLOWED_ORIGINS`, modelo e endpoint. Copie o exemplo e preencha localmente. O arquivo não é publicado com o frontend.
- Produção: Supabase → Edge Functions → Secrets. `SUPABASE_SERVICE_ROLE_KEY` é fornecida pelo ambiente Supabase; nunca deve entrar no frontend. `SUPABASE_ACCESS_TOKEN` da CLI fica fora do projeto.
- `.gitignore` exclui `.env`, `.env.*` e `node_modules/` em qualquer nível, permitindo somente `.env.example`. O exemplo das funções contém chave vazia.

Na revisão da Fase 1, `git ls-files` mostrou apenas os dois `.env.example` e nenhum `node_modules`. A consulta de histórico em todos os refs locais não encontrou versões dos arquivos de ambiente reais nem de `node_modules`. A inspeção dos blobs textuais históricos e do bundle não encontrou padrões de chaves privadas/token JWT. Essa auditoria cobre os refs disponíveis neste clone; não comprova ausência em outros clones, forks, reflogs remotos ou mensagens fora do Git.

Verifique sem abrir os valores:

```sh
git ls-files -- '.env*' 'supabase/functions/.env*' 'node_modules/*'
git log --all --oneline -- .env .env.local .env.production supabase/functions/.env.local node_modules
git check-ignore .env.local supabase/functions/.env.local node_modules/
```

Se algum segredo tiver sido publicado, revogue/rotacione primeiro. Em um clone dedicado, use `git filter-repo --path CAMINHO_DO_ARQUIVO --invert-paths` para cada arquivo afetado, revise e coordene o force-push de branches/tags com colaboradores. Eles deverão clonar novamente. Reescrever histórico não desfaz uma exposição; contate o GitHub se houver cópias em PRs/cache. Não execute limpeza destrutiva no clone de trabalho sem backup.

## Rotacionar a chave NVIDIA

A chave anterior foi compartilhada no chat; considere-a exposta e substitua-a antes de usar em produção.

1. Crie uma nova chave no painel NVIDIA.
2. Atualize `NVIDIA_API_KEY` em Supabase → Edge Functions → Secrets e no arquivo local **das funções**, sem imprimir o conteúdo nem incluir a chave em comandos/chamadas de log.
3. Teste uma análise com conta autenticada; confirme que origens externas são recusadas e que erros não revelam a chave.
4. Revogue a chave anterior no painel NVIDIA. Em caso de suspeita de abuso, revogue imediatamente antes dos demais passos.

Alternativa para enviar o arquivo local:

```sh
npx supabase secrets set --env-file supabase/functions/.env.local --project-ref SEU_PROJECT_REF
```

## Revogar tokens do Saúde

No Vitra, abra **Conectar Saúde pelo Atalhos → Revogar**. Isso exclui sua `health_connections`; o próximo envio será recusado. Gerar novo token substitui o hash antigo. Atualize o Atalho com o novo token e remova o anterior; nunca o inclua em backup compartilhado. O administrador pode excluir a conexão do usuário pelo SQL Editor, sem consultar o valor do token. As quotas antigas expiram pela limpeza automática.

## Aplicar a Fase 1

1. Confirme que as migrações 001, 002 e 003 já foram executadas. Não repita as antigas; elas não são idempotentes.
2. Ative **Supabase → Integrations → Cron → pg_cron**, conforme a [documentação oficial](https://supabase.com/docs/guides/cron/install).
3. No SQL Editor execute `supabase/migrations/202610040001_security.sql`. É transacional e idempotente. Se a extensão não estiver disponível, a transação falha inteira; habilite-a antes de repetir.
4. Copie/revise o exemplo das funções. Configure `ALLOWED_ORIGINS=http://localhost:5173,https://SEU-DOMINIO` (adicione IP/porta exatos para teste local por rede). Atualize os Secrets via painel ou comando acima. Não envie valores ao chat.
5. Publique as duas funções após a migração e os secrets:

```sh
npx supabase functions deploy analyze-meal --project-ref SEU_PROJECT_REF --no-verify-jwt
npx supabase functions deploy health-steps --project-ref SEU_PROJECT_REF --no-verify-jwt
```

O JWT de refeições e o token do Saúde são verificados dentro das funções; `--no-verify-jwt` não libera acesso aos dados.

6. Em Cron → Jobs confirme **vitra-cleanup-integration-limits**, ativo, `17 * * * *`. Consulte o histórico das execuções. O [agendamento nomeado](https://supabase.com/docs/guides/cron/quickstart) atualiza o job em reaplicações.
7. Verifique com uma conta de teste: origem permitida, origem recusada, sincronização e revogação de token. Não esgote quotas de uma conta em uso.

Os testes locais cobrem handlers, origens, erro de quota, revogação, tamanho de corpo e fallback de UUID. A aplicação da migração, concorrência SQL, permissões e execução do cron precisam ser verificadas no banco; build/testes de JavaScript não substituem essa validação.

## Entrega da Fase 1 — arquivos

- Ambientes: `.env.example`, `supabase/functions/.env.example`. Os arquivos locais ignorados foram ajustados sem serem versionados. `.gitignore` já possuía as regras necessárias e foi preservado.
- CORS: `supabase/functions/_shared/cors.ts`, `supabase/functions/_shared/analyze-handler.ts`, `supabase/functions/analyze-meal/index.ts`.
- Passos: `supabase/functions/_shared/health-handler.ts`, `supabase/functions/health-steps/index.ts`.
- Banco: `supabase/migrations/202610040001_security.sql`. Nenhuma migração anterior foi alterada.
- IDs: `src/lib/uid.ts`, `src/lib/store.ts`, `src/components/WorkoutLibrary.tsx`.
- Testes: `tests/security.test.tsx`, `tests/integrations.test.tsx`.
- Documentação: `docs/SECURITY.md`, `docs/INTEGRATIONS.md`, `README.md`.

Validação local: 49 testes passaram, build passou e `deno check` passou nas duas Edge Functions. Não foram aplicadas migrações nem publicados secrets/funções no Supabase nesta fase. As fases 2–6 aguardam revisão do usuário.
