# Plano de funcionalidades — reconhecimento em 04/10/2026

## Estado encontrado (Fase 0)

Leitura: README, integrações, package.json, store/useCloudStore/App/MealAnalyzer, todas as migrações e funções compartilhadas, config Supabase, exemplos de ambiente e testes. Não existia AGENTS.md; foi criado com as regras desta entrega.

- React 19 + TypeScript estrito + Vite; Vitest/Testing Library. Sem SDK de IA. `App.tsx` não foi separado em páginas.
- `user_data.data` guarda perfil, metas, modelos, treino ativo, séries, refeições do dia e arrays de água/cardio/treinos/peso. `daily_records` arquiva totais e refeições por dia em gatilho transacional. Passos e conexões do Saúde já têm tabelas próprias.
- Datas do painel/logs antigos são `dd/mm/aaaa`. `localDateKey` já existe e passos usam SQL `date`. A migração geral de datas/logs NÃO pertence a esta entrega.
- Salvamentos do painel são serializados/debounced; offline só em memória; concorrência entre dispositivos segue último salvamento. Nenhuma promessa de fila offline durável.
- Timer guarda timestamps, pausas e snapshot de sessão. RLS por titular, quota de refeições de 20/hora e token do Saúde em SHA-256 existentes. A fase de segurança anterior adicionou CORS exato, quota de passos, cron e `uid()`.
- A aplicação das migrações/funções no projeto remoto não está confirmada; este plano descreve o código local.

Inventário da busca do provedor anterior (antes da troca): `README.md`; `docs/INTEGRATIONS.md`; `docs/SECURITY.md`; `src/components/MealAnalyzer.tsx`; `supabase/functions/.env.example`; `supabase/functions/_shared/analyze-handler.ts`; `supabase/functions/analyze-meal/index.ts`; `tests/integrations.test.tsx`. Incluía modelo, endpoint, secret, rótulo, prompt, erros e instruções. As referências serão removidas da árvore atual sem reescrever commits ou migrações anteriores. Revogue a chave anterior no painel do antigo provedor.

## Verificação oficial do Gemini

- Modelo escolhido: **`gemini-3.1-flash-lite`**, estável, imagens como entrada e saída estruturada conforme a [página do modelo](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite). Não usar a variante preview.
- A [tabela de descontinuações](https://ai.google.dev/gemini-api/docs/deprecations) anuncia encerramento em **07/05/2027**, com substituto `gemini-3.5-flash-lite`. Manter o padrão solicitado, porém programar a troca administrativa antes dessa data. Não foi feita chamada real para verificar acesso da conta ao modelo.
- Implementar REST `POST /v1beta/models/{model}:generateContent` com `x-goog-api-key`, `systemInstruction` e `contents[].parts`, imagens `inlineData: { mimeType, data }`. Não usar Files API nem envio de dados de identidade.
- A [referência REST](https://ai.google.dev/api/generate-content) atualmente marca `responseSchema`/`_responseJsonSchema` como obsoletos e indica `generationConfig.responseFormat.text`, com `mimeType: APPLICATION_JSON` e `schema`. Usar esse formato documentado, sem parâmetros de amostragem. `generateContent` é legado mas ainda suportado, conforme o [guia](https://ai.google.dev/gemini-api/docs); foi mantido por exigência desta tarefa.
- O [guia Gemini 3](https://ai.google.dev/gemini-api/docs/gemini-3) recomenda manter temperatura padrão. Não enviar temperature/topP/topK nem parâmetros do provedor anterior. Timeout padrão de 60 s; nunca enfraquecer filtros de segurança.
- Inspecionar `promptFeedback.blockReason` e `candidates[].finishReason`; descartar conteúdo bloqueado, truncado, pensamentos e JSON inválido. Validar novamente nutrientes/campos no servidor.
- Conforme os [termos](https://ai.google.dev/gemini-api/terms), serviços gratuitos podem usar entradas/saídas na melhoria de produtos. Plano pago não as usa para essa finalidade, mas tem retenção limitada para segurança. Exigir faturamento ativo para Vitra; serviços gratuitos não devem atender usuários no EEE/Reino Unido/Suíça. Não afirmar retenção zero. Recursos de IA são destinados a maiores de 18 anos.

## Adaptação das fases ao código real

1. **Gemini:** interface compartilhada, provedor REST injetável e configuração de modelo por função; manter `{ analysis, model }`. Consentimento versionado em preferências, persistido antes da análise e lido do banco no servidor. Revogação disponível no perfil e na análise. Foto em canvas 1024/JPEG 0,8, sem copiar EXIF. Nova quota genérica com migração dos contadores antigos e wrapper compatível; limpeza cron existente ampliada. Nenhuma migração geral de registros.
2. **Biblioteca/programas:** catálogo original no código e tabela apenas para exercícios personalizados. Referência opcional `exerciseId`, compatibilidade por nome e importação sem sobrescrever modelos. Extrair componentes quando a funcionalidade exigir; não refatorar todo App antecipadamente.
3. **Substituições/dor:** alteração do snapshot ativo; modelo apenas com opção explícita. `pain_reports` com datas ISO, índices e RLS; regra pura de recorrência.
4. **Modo academia:** reutilizar timestamps/sets e salvamento atual. Tipos de séries opcionais para preservar logs antigos; preenchimento/desfazer e descanso com testes.
5. **Medidas/fotos:** tabelas novas e Storage privado por titular, URLs assinadas curtas; consentimento separado adulto verificado no servidor. Análise só por IDs próprios, sem URLs do cliente, schema e proteção de bem-estar. Fórmulas puras testadas; nenhum cálculo corporal por imagem.
6. **Check-in/hábitos:** tabelas novas por usuário e dia ISO; hábitos derivados dos registros existentes sem duplicação. Sem push nesta fase.
7. **Análises:** funções puras em `src/lib/analytics`; adaptador para datas/logs legados em memória, sem reescrever históricos. Documentar Epley, janelas, volume, limiares e insuficiência de dados.
8. **Coach/chat:** JWT/RLS, consentimento e quotas compartilhadas. Contexto agregado no servidor, sem identidade ou fotos; consulta fechada validada, sem SQL do modelo, sem escrita automática.
9. **Fechamento:** acessibilidade, carregamento progressivo, docs e export de novas tabelas. Import ainda não existe e não será fingida como disponível. Políticas/testes de isolamento e passos manuais completos.

Todas as tabelas novas terão RLS por titular, FK com cascata adequada e índice `(user_id, data)`; nenhuma publicação remota sem configuração administrativa. O objetivo autorizado nesta rodada termina ao concluir a Fase 1; fases 2–9 aguardam revisão.
