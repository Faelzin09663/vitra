# Publicar Vitra completo na Vercel

O frontend e a API agora podem ficar no mesmo projeto. `api/vit.ts` e os outros cinco entrypoints exportam handlers Web Request/Response para o runtime Node da Vercel. O servidor Deno local continua disponível, compartilhando a lista de rotas e a implementação dos handlers. Nenhuma migração de banco é necessária nesta mudança.

## Configurar

1. Use o repositório atualizado, branch `main`, Framework Preset **Vite**, Build Command **npm run build**, Output Directory **dist**. O `vercel.json` já define esses valores e duração máxima de 180 segundos nas funções; mantenha Fluid compute habilitado.
2. No projeto → **Environment Variables**, cadastre os campos do `.env.vercel` privado da raiz. Esse arquivo foi preenchido a partir do `.env` local, sem imprimir chaves e sem mudar sua configuração local. Se estiver usando outro checkout, use a lista abaixo e copie as chaves pelo editor.
3. Selecione **Production**; configure **Preview** apenas nos ambientes de teste que deseja habilitar. Marque as chaves privadas como Secret. Faça **Redeploy** para as novas variáveis e funções entrarem em vigor.
4. No Supabase Auth, configure Site URL/Redirect URLs para o domínio do app. Na tela VIT, mantenha idade adulta e consentimento salvos; o consentimento de fotos é independente.

Campos obrigatórios:

```dotenv
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=SUA-CHAVE-PUBLICA
VITE_API_URL=/api
SUPABASE_SECRET_KEY=SUA-CHAVE-PRIVADA-DO-BACKEND
GEMINI_API_KEY=SUA-CHAVE-GOOGLE
GEMINI_MODEL=gemini-3.1-flash-lite
```

A alternativa legada `SUPABASE_SERVICE_ROLE_KEY` é aceita. Overrides `GEMINI_MODEL_MEAL`, `GEMINI_MODEL_BODY`, `GEMINI_MODEL_COACH`, `GEMINI_MODEL_VIT` e `GEMINI_ENDPOINT` são opcionais. `API_PORT` é usado pelo servidor local, sem aplicação nas funções Vercel.

As origens HTTPS de `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL` e `VERCEL_BRANCH_URL` são incluídas a partir de variáveis do sistema quando `VERCEL=1`. Domínios próprios adicionais exigem `ALLOWED_ORIGINS=https://seu-dominio.example`, sem barra final; se houver várias origens, separe por vírgulas. Não use wildcard nem autorize uma origem com base em headers enviados pelo visitante. Habilite as variáveis de sistema da Vercel no projeto se tiverem sido desativadas.

## Verificar

Depois do deploy, abrir `/api/vit` por GET deve retornar JSON com **Método não permitido**, status 405. POST sem JWT deve retornar **Entre na sua conta**, status 401, quando as credenciais estão configuradas. Essas verificações não chamam IA. Uma página HTML/404 da Vercel indica que as funções ainda não foram publicadas; confirme o commit, pasta raiz e logs de build. Um 503 de configuração indica variáveis ausentes nesse ambiente/deploy.

Se aparecer **Rota indisponível** no localhost, encerre o ambiente antigo e rode `npm run dev` novamente. O comando agora observa alterações do backend para evitar uma lista de rotas desatualizada. Ao mudar `.env`, ainda é necessário reiniciar o comando para carregar os valores novos.

Schemas, consentimentos, quotas, RLS, validação de fotos e persistência do VIT permanecem nos handlers existentes. Testes de IA usam mocks; publicação de funções não confirma acesso/faturamento do modelo Google nem autoriza chamadas reais nos testes.

Referências: [funções Node](https://vercel.com/docs/functions/runtimes/node-js), [variáveis de ambiente e redeploy](https://vercel.com/docs/environment-variables/managing-environment-variables), [limites de duração](https://vercel.com/docs/functions/limitations). Adaptadores Supabase preservam o import map conforme [configuração de funções](https://supabase.com/docs/guides/functions/function-configuration).
