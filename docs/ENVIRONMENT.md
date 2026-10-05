# Chaves no .env da raiz

O backend Vitra carrega `.env` com o [suporte nativo do Deno](https://docs.deno.com/runtime/reference/env_variables/). Ele executa os mesmos handlers validados das fases 1–9. O frontend chama `/api`, autentica com o JWT da sessão e mantém seus registros no Supabase. Não precisa de Supabase Secrets nem deploy de Edge Functions.

## Configuração local

1. Abra `.env` na raiz. Se não existir, copie `.env.example` para `.env`.
2. `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`: conexão pública usada pelo React e compartilhada com o backend. Neste checkout, já foram preservadas.
3. `SUPABASE_SECRET_KEY`: em Supabase → Settings → API Keys → Publishable and secret API keys, copie/crie uma Secret key dedicada ao backend Vitra. Cole somente no `.env`. O nome legado `SUPABASE_SERVICE_ROLE_KEY` também é aceito; use apenas um dos dois. A chave pública não substitui essa chave, pois quotas e exclusão autenticada precisam de privilégios administrativos. [Tipos de chaves e uso no backend](https://supabase.com/docs/guides/getting-started/api-keys).
4. `GEMINI_API_KEY`: chave Google do projeto com faturamento ativo conforme as instruções de privacidade. Não reutilize a chave do provedor anterior.
5. `ALLOWED_ORIGINS`: origens exatas do frontend e do site publicado, separadas por vírgula, sem barra final. O modelo inclui localhost. Produção deve incluir o domínio HTTPS real.
6. Execute `npm ci` e `npm run dev`. Ao mudar `.env`, encerre e reinicie o comando. React usa porta 5173 ou a próxima livre, mostrada no terminal; o comando autoriza exatamente essa origem local no backend. O backend usa `API_PORT`, padrão 8787.

Somente variáveis com prefixo `VITE_` são públicas. Nunca nomeie uma chave privada `VITE_GEMINI_API_KEY`, `VITE_SUPABASE_SECRET_KEY` ou equivalente. Não envie o `.env` pelo chat nem o coloque no Git. O arquivo `.env.example` contém apenas campos vazios/padrões públicos.

As antigas configurações locais `.env.local` foram preservadas como `.env.local.backup`, quando presentes. Esses backups são ignorados e não são carregados. Se criar um novo `.env.local`, o Vite poderá priorizá-lo sobre `.env`; mantenha a configuração centralizada na raiz.

## Desenvolvimento e publicação

- `npm run dev`: frontend e backend juntos, encerrados com Ctrl+C.
- `npm run api`: somente backend; `npm run dev:web`: somente Vite, com proxy para a API.
- `npm run build` e `npm start`: build e servidor de produção, entregando app e API na porta `API_PORT`.
- `npm run check:server`: checagem TypeScript dos handlers e servidor.

Para produção, instale as dependências (`npm ci`), gere o build e mantenha `npm start` ativo em um host com processos persistentes. Configure HTTPS no proxy do host e deixe `VITE_API_URL=/api`. Transfira o `.env` diretamente ao servidor por um canal privado ou forneça as mesmas variáveis no ambiente do processo; variáveis já presentes no processo têm precedência sobre o arquivo. Um site estático sozinho não lê chaves privadas nem executa IA.

Na Vercel, use as funções Node de `api/` e o `vercel.json` do projeto. Cadastre as variáveis do `.env.vercel` nas Environment Variables, incluindo as chaves privadas com seus nomes sem `VITE_`, e faça um novo deploy. Use `VITE_API_URL=/api`; `API_PORT` não é necessário na Vercel. As origens do deploy são adicionadas a partir de metadados confiáveis da Vercel; domínios adicionais exigem `ALLOWED_ORIGINS` exato. O `.env.vercel` atualizado contém segredos e permanece ignorado pelo Git. Consulte [VERCEL.md](VERCEL.md).

Se frontend e API estiverem em domínios separados, `VITE_API_URL` deve ser a URL pública terminada em `/api` do backend (sem credenciais, query ou fragmento). Faça novo build do frontend e adicione sua origem a `ALLOWED_ORIGINS`. A chave privada continua exclusivamente no backend. Atualize Site URL/Redirect URLs do Supabase Auth para o endereço do frontend.

## iPhone e rotas

O Atalhos deve usar a URL HTTPS de `/api/health-steps` mostrada no app. Um iPhone não consegue acessar o localhost do computador; para teste na mesma rede use o IP do computador e inclua sua origem em `ALLOWED_ORIGINS`. Para uso diário, publique o servidor por HTTPS. Atalhos antigos que usam `/functions/v1/health-steps` precisam ter a URL atualizada; o token restrito já criado continua válido até expirar/revogar.

As rotas de IA e exclusão validam JWT; Saúde valida seu token restrito. Consentimentos, quotas SQL, permissões por titular, fotos privadas e validação de respostas continuam ativos. Erros internos não são registrados nem devolvidos. O servidor entrega apenas arquivos de `dist/`; `.env`, backups e `.git` não são arquivos públicos.

## Banco e modelos

As migrações/bucket precisam estar aplicados; mudar o local das chaves não cria tabelas. A migração `202610040007_vit.sql` foi confirmada pelo titular, e as tabelas foram verificadas por leitura remota sem retornar registros pessoais. Os testes de IA usam mocks; essa verificação não confirma faturamento nem disponibilidade do modelo na conta Google.

`GEMINI_MODEL_VIT` escolhe o modelo do assistente; se vazio, usa `GEMINI_MODEL` e depois o padrão do provedor. Os overrides MEAL, BODY e COACH permanecem independentes. Todas as chaves continuam no `.env` do backend; reinicie o processo para carregar alterações. Os adaptadores legados existem, mas o app chama `/api`, incluindo `/api/vit`.
