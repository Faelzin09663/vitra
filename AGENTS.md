# Vitra

- React 19, TypeScript, Vite, Supabase e Vitest. Interface em português do Brasil, mobile-first, com temas claro/escuro e acessibilidade.
- Antes de concluir cada fase: `npm run build`, `npm test` e checagem Deno das funções alteradas. Testes de IA sempre usam mocks; não chamar a API real.
- Uma fase por vez, commit Conventional Commits e atualização de README/docs. Parar para revisão conforme o pedido do usuário.
- Nunca imprimir, registrar ou commitar segredos. Frontend recebe só URL/chave pública Supabase. Chaves de IA e service role ficam nas Edge Functions.
- Migrações SQL novas, idempotentes, com timestamp maior que as existentes; nunca modificar as antigas nem apagar dados dos usuários.
- Preservar timer por timestamps, virada de dia/semana, histórico e RLS por titular. Novos dados contínuos vão em tabelas próprias com índices e RLS; não migrar logs antigos sem autorização específica.
- Datas novas em `yyyy-mm-dd` com `localDateKey`, pt-BR só na exibição. IDs de registros usam `uid()`; tokens continuam criptográficos.
- Cálculos em funções puras testadas. IA usa provedor injetado, consentimento verificado no servidor, quotas, CORS exato e respostas validadas. Não gerar afirmações médicas.
