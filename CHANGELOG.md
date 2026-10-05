# Alterações

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
