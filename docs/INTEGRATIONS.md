# Timer, Gemini e Apple Saúde

## Recursos do webapp

- O treino começa um cronômetro com horário inicial salvo na conta. Pausas e retomadas também são salvas. Ao reabrir o app, o tempo é recalculado pelo relógio, mesmo que o iOS tenha suspendido a página. A duração efetiva fica no histórico do treino concluído.
- O descanso usa um horário de término, não depende de intervalos em segundo plano. Não há alarme garantido com o iPhone bloqueado. O botão Manter tela acesa usa Screen Wake Lock quando disponível.
- Cardio é registrado por distância em quilômetros. Duração em minutos é opcional. Registros antigos em minutos permanecem no histórico sem inventar uma distância. A meta inicial é de 15 km/semana e pode ser ajustada.
- O registro de peso tem data, observação, contexto do treino e cardio daquele dia. O painel lembra a próxima pesagem após três dias; não bloqueia registros intermediários. Um novo registro no mesmo dia substitui o anterior. O gráfico mostra o histórico de peso e não atribui causalidade a um treino.
- Refeições podem ser analisadas por foto ou descrição. A estimativa precisa ser revisada e confirmada. Apenas a refeição confirmada é salva no banco; a foto fica na memória da página e é enviada ao provedor somente ao clicar em Analisar.

## Ativar as integrações no Supabase

O estado remoto precisa ser conferido no painel. Siga MANUAL-STEPS.md para todas as migrações e configuração do backend das fases 1–9; aplique somente arquivos pendentes. Este desenvolvimento não verificou a publicação remota.

As tabelas iniciais `profiles` e `user_data` precisam existir. Se ainda não aplicou, execute as migrações anteriores em ordem. Execute **uma vez** no SQL Editor:

1. `supabase/migrations/202610030002_history.sql` (somente se ainda não aplicou).
2. `supabase/migrations/202610030003_integrations.sql`.

A terceira migração cria passos diários, conexões do Saúde e uma quota de 20 análises por usuário/hora. RLS separa os registros por usuário. O horário do treino, quilômetros, peso e suas relações usam o documento já existente em `user_data` e não exigem conversões destrutivas.

### Backend Vitra

As chaves ficam no `.env` da raiz e são lidas pelo servidor Vitra. `npm run dev` inicia frontend e backend; `npm start` entrega o build e `/api` em produção. Não precisa de Secrets ou deploy de Edge Functions no Supabase. Consulte [ENVIRONMENT.md](ENVIRONMENT.md).

`/api/analyze-meal` verifica JWT com `auth.getUser`; `/api/health-steps` aceita somente o token restrito de sincronização. Banco, Auth, Storage e quotas continuam no Supabase. Atualize atalhos antigos para a URL `/api/health-steps` mostrada no app; tokens existentes continuam válidos.

### Gemini: ativação e modelos

A análise usa a API REST do Google Gemini, com chave `GEMINI_API_KEY` somente no .env do backend Vitra. Crie a chave no [Google AI Studio](https://aistudio.google.com/apikey) e ative o faturamento no projeto Google Cloud. Não coloque a chave no frontend nem em `VITE_*`. Siga [MANUAL-STEPS.md](MANUAL-STEPS.md) para a migração `202610040002_ai_provider.sql`, configuração do servidor Vitra.

O padrão é `gemini-3.1-flash-lite`, estável, de menor custo, com imagens e JSON estruturado conforme a [documentação do modelo](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite). O encerramento anunciado é 07/05/2027; planeje trocar antes. `GEMINI_MODEL_MEAL` tem prioridade sobre `GEMINI_MODEL`. `GEMINI_MODEL_BODY` e `GEMINI_MODEL_COACH` configuram fotos corporais e coach e seguem o mesmo fallback. Se a qualidade for insuficiente, configure um modelo mais capaz compatível com imagens/schema sem mudar o código. A disponibilidade na sua conta precisa ser validada no deploy.

`GEMINI_ENDPOINT` é uma base HTTPS administrativa, por padrão `https://generativelanguage.googleapis.com/v1beta`, sem query/credenciais. A chave vai no cabeçalho `x-goog-api-key`, nunca na URL. Usuários não podem escolher URLs. Timeout padrão de 60 s; bloqueios de segurança, quota do provedor e falhas têm mensagens em português. Não há SDK novo ou parâmetros de amostragem.

A foto é reencodada em canvas para JPEG (qualidade 0,8, maior lado até 1024 px), sem copiar EXIF/GPS; apenas pixels seguem para a função. O limite de saída é cerca de 1 MB. JPEG, PNG e WebP são aceitos como origem; no iPhone configure captura compatível ou converta HEIC antes. A IA pede esclarecimentos quando não identifica alimentos/porções; isso não pode ser salvo como refeição.

### Consentimento e revisão

Perfil → Você escolhe usar IA, ou a primeira análise, explica o envio ao Google. A autorização salva versão e timestamp em `preferences.ai_consent`; o servidor a lê da conta autenticada e não aceita alegações no JSON. Conta antiga começa sem autorização. Por exigência dos termos do provedor, a IA é destinada a adultos: salve idade de 18 anos ou mais no Perfil. A análise aguarda o salvamento das preferências; sem conexão não envia.

Depois de analisar, todos os dados úteis da estimativa são editáveis: nome, calorias, macros, notas, confiança, alimentos e porções. Só Confirmar e salvar grava. Desativar IA na análise ou Perfil impede novas análises após sincronizar; não remove refeições confirmadas e não desfaz uma transmissão já iniciada. Registros manuais continuam funcionando.

### Privacidade e plano do Gemini

**Para o Vitra, use exclusivamente o plano pago, com faturamento ativo no projeto Google Cloud.** No plano gratuito, o Google pode usar entradas/saídas para melhorar produtos e envolver revisão humana; não envie dados de saúde/fotos. No plano pago, esse conteúdo não é usado para melhorar produtos, mas existe retenção limitada para segurança/obrigações legais. Serviços gratuitos não devem atender usuários no EEE, Reino Unido e Suíça. Confira os [termos do Gemini](https://ai.google.dev/gemini-api/terms); não há promessa de retenção zero.

Revogue a chave do provedor anterior no painel dele e remova seus secrets antigos do Supabase. A nova chave não deve ser compartilhada no chat. A raiz `.env.example` lista todas as variáveis; campos de chaves privadas ficam vazios.

Preencha `GEMINI_API_KEY`, `SUPABASE_SECRET_KEY` e os modelos no `.env` da raiz. Reinicie o servidor após alterar o arquivo. Nunca use VITE_ em variáveis privadas.

A nova quota é genérica: meal 20/hora, body_photo 5/dia, coach/chat juntos 30/hora, buckets UTC e limites administrativos em `ai_quota_settings`. O wrapper antigo permanece compatível, contadores existentes são preservados e o cron limpa buckets de mais de sete dias. Fotos corporais e coach estão implementados e dependem do deploy descrito abaixo.

## Passos do Saúde por Atalhos

Safari e um webapp instalado não acessam HealthKit diretamente. A alternativa implementada usa o app Atalhos no iPhone, que pede sua permissão para ler Saúde e envia apenas a data e o total de passos ao Vitra.

1. No Vitra, em Hoje ou Evolução, abra **Conectar Saúde pelo Atalhos** e gere um token. Ele é exibido somente nesta sessão; copie para o atalho. O banco armazena apenas seu hash SHA-256. Tokens expiram após 90 dias; gerar outro substitui o anterior e o botão Revogar invalida a conexão.
2. No app Atalhos do iPhone, crie um atalho com **Buscar Amostras de Saúde**: tipo **Passos**, data de início no dia atual. Desative limite. Para evitar duplicar dados sobrepostos, filtre uma única origem (iPhone ou Apple Watch). Esse método envia os passos dessa origem; pode diferir do total agregado pelo app Saúde.
3. Obtenha o **Valor** das amostras e use **Calcular Estatísticas → Soma**. Formate a data local atual como `yyyy-MM-dd`.
4. Adicione **Obter Conteúdo de URL**, método POST, com a URL mostrada no Vitra. Use corpo JSON: `date` como texto (data formatada) e `steps` como número (soma). Cabeçalhos: `Authorization: Bearer SEU_TOKEN` e `Content-Type: application/json`.
5. Execute e autorize o acesso aos passos. A resposta deve conter `ok: true`. Use Atualizar no Vitra.
6. Se desejar, associe o atalho a uma automação pessoal diária no iPhone. A execução e as permissões continuam sob controle do iOS.

Formato do corpo:

```json
{"date":"2026-10-03","steps":6500}
```

Não envie e-mail, senha ou UUID de usuário. A função deriva a conta do token. Repetir o envio substitui o total daquele dia; não soma duas vezes. O token não pode ler registros nem alterar treino, alimentação ou peso. O usuário pode inserir o total de passos manualmente quando não quiser criar um atalho.

## Timer na tela bloqueada / Dynamic Island

[Live Activities usam ActivityKit](https://developer.apple.com/documentation/activitykit). Isso exige um aplicativo iOS com uma extensão WidgetKit; o Safari e o webapp instalado não expõem esse recurso. O timer desta versão aparece no Vitra e no título da página, com recuperação de tempo ao retornar, mas não na barra de notificações.

Para Live Activities e sincronização direta de passos, a próxima etapa é um aplicativo iOS (por exemplo, React via Capacitor com integração Swift). O app precisa de ActivityKit/WidgetKit, autorização e entitlement HealthKit, e compilação/validação com Xcode em um Mac. Instalar o webapp pela opção Compartilhar → Adicionar à Tela de Início não remove essas limitações. Nenhuma integração nativa está apresentada como funcionando nesta versão.

## Verificação

`npm test` valida cronômetro após suspensão, pausas, retomada, persistência, pesagem a cada três dias, distância e preservação de histórico. Também testa os handlers de IA e passos com dependências simuladas: login obrigatório, quota, validação de respostas, token revogado e isolamento por titular. `npm run build` valida os tipos do frontend.

Depois de configurar o servidor, valide com sua própria conta: iniciar/pausar/reabrir/finalizar treino, registrar quilômetros, peso e refeição, analisar uma foto, sincronizar passos duas vezes e confirmar que o total não duplica. As chamadas reais ao modelo, as permissões Saúde e o comportamento do iOS exigem essa configuração e um iPhone; não são simulados como se estivessem aprovados em produção.

## Perfil e vários treinos

Toque na bolinha com as iniciais, no topo do app, para abrir Perfil. Há nome, peso atual, altura em centímetros, idade, sexo utilizado na fórmula e nível de atividade. O peso vem do registro mais recente por data, não da ordem em que foi digitado. Alterar o peso no perfil também cria/atualiza o registro do dia na Evolução. Um registro antigo não substitui o peso atual.

O IMC é calculado como peso/altura². A estimativa de repouso usa [Mifflin–St Jeor](https://pubmed.ncbi.nlm.nih.gov/2305711/) e a manutenção diária usa um fator aproximado de atividade escolhido pelo usuário. Não é uma medição individual de gasto energético. Os cálculos de calorias ficam indisponíveis com dados incompletos ou idade fora da faixa adulta suportada. A meta manual é mantida até selecionar a modalidade automática; nesse modo, novos pesos e alterações de perfil recalculam a manutenção estimada. Editar calorias em Metas retorna ao modo manual.

Em Treinos, use Criar treino ou Duplicar. Cada modelo tem nome, foco, dias da semana, exercícios, séries, repetições e descanso. É possível montar, por exemplo, Peito 1 na segunda e Peito 2 na sexta com exercícios diferentes. O painel Hoje prioriza uma sessão agendada para o dia. A sessão em andamento guarda uma cópia do nome e dos exercícios, e finalizar registra o modelo correto no histórico. Excluir um modelo preserva os treinos concluídos.

Esses campos ficam em `user_data`, sob as regras de acesso existentes. Não é necessária uma migração nova para perfil ou modelos de treino. O treino A anterior é convertido automaticamente em um modelo, preservando seus exercícios e os registros já existentes.

## Fotos de progresso

Execute `202610040005_body_progress.sql` e configure o backend Vitra para `/api/analyze-body-photos`. A validação JWT ocorre no handler. O bucket é privado e criado pela migração. `GEMINI_MODEL_BODY` sobrescreve `GEMINI_MODEL`; se a análise visual do Flash-Lite for insuficiente, configure um modelo mais capaz no .env sem mudar código. Ative faturamento e consentimento específico antes de analisar.

## Coach e chat

O coach usa `/api/coach` do servidor Vitra. JWT é validado internamente por `auth.getUser`. `GEMINI_MODEL_COACH` sobrescreve o modelo geral. Coach e chat compartilham 30 requisições por hora, incluindo as duas chamadas do fluxo de chat como uma solicitação. Uma falha após consumir quota também conta. Nenhuma resposta altera registros automaticamente.

O termo geral de IA agora é versão 2: solicita nova autorização dos usuários da versão anterior porque inclui resumo de treino, alimentação, peso, hábitos, check-in e desconforto. O consentimento de fotos continua separado, versão 1. O resumo é agregado no servidor, sem nomes, e-mail, IDs pessoais ou fotos. Não coloque informações pessoais nas perguntas. Perguntas ficam na memória da tela.

## Fechamento e ativação

As rotas de refeições, fotos corporais e coach funcionam após as migrações e preenchimento do .env do backend. Todos os comandos e o checklist estão em [MANUAL-STEPS.md](MANUAL-STEPS.md). A exclusão com senha do Perfil usa `/api/delete-account` no mesmo backend. Fotos usam URLs assinadas de 5 minutos e podem ser baixadas separadamente. Backup v3 exporta metadados, não os arquivos binários nem tokens do Saúde.

Treino/evolução e seus recursos usam lazy/Suspense com skeletons. Diálogos têm foco, Tab/Escape e restauração. Telas/botões usam tokens de tema e safe areas; valide no aparelho conforme o checklist. O histórico do chat dura somente enquanto a tela permanece aberta.
