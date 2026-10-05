# Alterações

## 2026-10-05 — Persistência de treinos ao fechar o app

- Criar, editar, duplicar, excluir e importar modelos aguarda confirmação do Supabase; falhas mantêm o editor/rascunho e permitem repetir sem duplicação.
- Cópia temporária síncrona por conta recupera alterações que ainda não chegaram ao banco quando o app fecha; confirmação antiga não descarta uma alteração mais recente.
- Recuperação aplica apenas campos alterados sobre a conta recém-carregada, mescla a biblioteca por ID e preserva consumo do novo dia/semana e sessão por timestamps.
- `flush` aguarda também as alterações feitas durante uma gravação em andamento; os treinos usam a versão atual do estado ao salvar.
- Supabase permanece o banco do localhost e do site Vercel, sem migração ou mudanças em registros remotos nesta correção. Documentação inclui privacidade da cópia temporária e validação no app publicado.
- Validação: 184 testes com mocks, incluindo criação de vários treinos, fechamento/reabertura, interrupção antes do autosave, repetição após erro, isolamento por conta, gravações lentas e virada de dia/semana; build e checagem Deno aprovados.

## 2026-10-04 — Rotas VIT no localhost e Vercel

- Lista compartilhada de endpoints evita divergência entre servidor local e publicação.
- Desenvolvimento observa alterações do backend; ambiente local antigo reiniciado e rota `/api/vit` verificada diretamente e pelo proxy, sem chamada de IA.
- Seis funções Node na Vercel com os mesmos handlers, chaves privadas no ambiente, CORS exato por configuração/metadados confiáveis e duração de 180 segundos.
- Dependência Supabase portável por import map Deno/Edge e pacote npm no Node, mantendo autenticação, consentimentos, quotas e dados existentes.
- `.env.vercel` privado atualizado para frontend e backend no mesmo domínio; TypeScript das funções integrado ao build e guia de publicação incluído.
- Validação: 174 testes com mocks, build, checagem Deno e entrypoint executado no Node real sem autenticação/IA. Deploy remoto ainda exige as variáveis do ambiente e uma nova publicação.

## 2026-10-04 — Interface de chatbot do VIT

- Conversas em uma área dedicada, histórico lateral no computador e painel de histórico no celular.
- Tela inicial com sugestões, mensagens alinhadas por autor, campo inferior com foto e estado de envio.
- Memórias e autorizações em diálogos acessíveis; nova conversa permanece como rascunho até o primeiro envio.
- Enter envia no computador, Shift/composição preservam digitação; no celular, envio pelo botão.
- Persistência, consentimentos, quotas e histórico no Supabase preservados; nenhuma migração necessária.
- Validação: 167 testes com IA simulada, build e checagem Deno; nova conversa, atalhos de teclado, foco dos painéis e repetição após falha de memória.

## 2026-10-04 — VIT com conversas e memórias

- Menu VIT no computador e celular, com histórico paginado e memórias confirmadas/editáveis/desativáveis no Supabase.
- Contexto carregado no servidor: registros recentes, orçamento diário, histórico e preferências escolhidas. Refeições, treinos e metas não são alterados automaticamente.
- Consentimento específico, idade adulta, quota compartilhada e fotos próprias opcionais pelo pipeline corporal privado, sem inferências clínicas.
- Migração nova idempotente: RLS por titular, mensagens somente pelo backend, turno atômico/idempotente e exclusão por cascata. Criação confirmada pelo titular e tabelas verificadas por consulta remota sem linhas.
- Chaves continuam no `.env`; override opcional `GEMINI_MODEL_VIT`, rota `/api/vit` e backup JSON v4 com conversas/memórias.
- Validação: 163 testes, build, checagem Deno, 28 verificações SQL/RLS isoladas e smoke HTTP de backend/proxy/arquivos privados. Provedor sempre simulado; nenhuma chamada real de IA ou gravação remota de teste.

## 2026-10-04 — Gasto, déficit e refeições por texto

- Snapshot de gasto MET por treino/cardio, com peso/duração/intensidade e rateio por exercícios concluídos.
- Perfil permite déficit e crédito do gasto registrado; painel de alimentação mostra o orçamento diário e atividades sem dados.
- Fator semanal e atividades registradas são métodos alternativos; virada de dia recalcula sem reestimar logs antigos.
- Análise de refeições abre em Texto e porções, com foto opcional e revisão antes de salvar.
- Validação: cálculos puros, mudança de peso/dia, ausência de dados e compatibilidade com metas antigas/manuais.

## 2026-10-04 — Estimativa no perfil

- Perfil mostra os dados faltantes para calorias automáticas e a estimativa junto ao botão de salvar, inclusive no celular.
- Mensagem de erro antiga desaparece ao editar campos; peso, altura, idade adulta, sexo e atividade usam validação consistente.
- Testes verificam formulário incompleto, correção dos campos, prévia sem salvar e recálculo após mudar o peso. Perfil manual continua aceitando dados parciais.

## 2026-10-04 — Configuração centralizada em .env

- Backend Vitra com Deno, API `/api` e build servido pelo mesmo processo em produção.
- Todas as credenciais no `.env` da raiz; somente conexão pública e URL da API usam `VITE_`.
- Frontend deixa de chamar Supabase Edge Functions; refeições, fotos, coach, passos e exclusão usam a API Vitra com a autenticação existente.
- Conexão existente preservada; configurações anteriores guardadas como backups ignorados. Campos privados sem credencial permanecem vazios.
- Handlers compartilhados preservam quotas, consentimentos, isolamento e validação; adaptação não muda o esquema SQL.
- `npm run dev` inicia os dois processos; `npm start` entrega app/API. Guias de ativação atualizados sem depender de Supabase Secrets.
- Validação: 142 testes, build, checagem Deno e teste HTTP real de proxy/CORS/arquivos privados, sem chamadas de IA ou modificações no banco remoto.

## 2026-10-04 — Fases 0–9

- Reconhecimento documentado e Gemini REST com modelos por função, consentimento, quotas e respostas validadas.
- Biblioteca original com 134 exercícios e sete programas; personalizados no Supabase e associação de legado.
- Substituições por sessão, motivo no histórico, desconforto e recorrência.
- Modo academia, autofill, tipos de série, recordes, descanso e desfazer.
- Medidas e estimativas por circunferências; fotos privadas sem EXIF, comparador, análise opcional e exclusão em cascata.
- Check-ins, hábitos, sequências por agenda e gráficos.
- Platô/equilíbrio em funções puras e alertas dispensáveis.
- Coach e chat com DTO agregado no servidor, consultas fechadas e confirmação de propostas.
- Telas por demanda, skeletons, foco/diálogos, backup v3 e exclusão autenticada de conta.
- Novas migrações incrementais; logs/datas legados preservados sem migração geral.

A ativação remota de tabelas e Storage e a configuração do backend dependem de seguir docs/MANUAL-STEPS.md. Testes locais usam mocks de IA e PostgreSQL isolado.
