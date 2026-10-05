# Segurança e privacidade — Vitra

## Dados e ameaças

O Vitra guarda dados de saúde e hábitos. Os riscos principais são acesso entre contas, roubo de sessão/token, exposição de secrets, abuso de quotas e conteúdo não confiável enviado à IA.

O navegador recebe apenas URL/chave pública Supabase. RLS protege os registros pelo titular. Senhas ficam no Auth. Service role e chave de IA nunca entram no navegador, bundle, respostas ou logs. Não registrar Authorization, fotos, descrições ou detalhes de erros do provedor.

## Análise de refeições

Fluxo: navegador reencoda pixels em JPEG a 1024 px/qualidade 0,8 → usuário autoriza e salva preferências → clique explícito em Analisar → backend Vitra valida JWT com auth.getUser → lê consentimento/idade do titular em user_data → valida tamanho/formato → consome quota → provedor Gemini → JSON validado → revisão editável → confirmação salva refeição.

A foto permanece em memória, é descartada ao fechar e não é armazenada pelo Vitra. Descrição/foto saem do Supabase e chegam ao Google; não enviamos nome, e-mail, UUID, senha ou JWT. O usuário deve evitar dados pessoais na própria foto/descrição. A aplicação envia store=false e não usa Files API/cache explícito. Isso não elimina retenção de segurança do Google.

Consentimento: `preferences.ai_consent = { version, grantedAt }`, com versão atual e timestamp ISO; null significa desativado. Conta antiga começa sem autorização. Perfil deve ter idade adulta salva (18–100). O servidor lê a preferência do banco por UUID autenticado, ignorando alegações de consentimento/user_id no corpo. Salvar autorização é aguardado antes da chamada. Perfil e tela de análise permitem desativar; a desativação precisa ser sincronizada para valer em todos os dispositivos. Não é possível retirar uma foto que já tenha sido enviada durante uma análise em curso. Fotos do corpo usam consentimento separado, conforme a secao de fotos abaixo.

O JSON do painel ainda usa último salvamento entre dispositivos: um painel antigo pode substituir preferências. Evite editar simultaneamente; controle de concorrência/revogação resistente a snapshots antigos será necessário antes de múltiplos dispositivos concorrentes. A função sempre verifica o estado atualmente persistido.

## Privacidade e plano do Gemini

**Plano pago com faturamento ativo no projeto Google Cloud é obrigatório para o Vitra**, por tratar dados de saúde/fotos. Não basta criar uma chave gratuita.

Nos [termos oficiais](https://ai.google.dev/gemini-api/terms), o serviço gratuito pode usar entrada/saída para melhorar produtos e envolver revisão humana; não envie dados sensíveis ao plano gratuito. Plano pago não usa prompts/respostas para essa melhoria, mas pode retê-los temporariamente para segurança e obrigações legais. Usuários no EEE, Reino Unido e Suíça só devem ser atendidos com serviços pagos. Recursos de IA são destinados a adultos e não fornecem aconselhamento médico.

O servidor não consegue inferir faturamento ativo a partir da chave: o administrador deve verificá-lo no Google Cloud. Os termos do fornecedor podem mudar; revise antes de disponibilizar o app a terceiros.

## Provedor, CORS e quotas

A interface AIProvider separa handlers do fornecedor. Gemini REST usa x-goog-api-key no cabeçalho, nunca query string; não segue redirects. Endpoint é base HTTPS administrativa sem query/credenciais; usuários não podem enviar URLs. Não há ferramentas nem escrita por IA. Texto livre entra delimitado como dado; schema não garante correção nutricional, por isso há validação local e confirmação humana.

Respostas bloqueadas, truncadas, com JSON/campos inválidos ou pensamentos são descartadas. Erros HTTP/timeout viram mensagens fixas, sem revelar resposta interna ou chave.

ALLOWED_ORIGINS lista origens exatas separadas por vírgula, incluindo http://localhost:5173 e domínio publicado, sem barra final. Sem configuração, origens de navegador são recusadas. CORS não é autenticação: chamadas sem Origin ainda exigem JWT e consentimento. Preflight aceita só POST/cabeçalhos conhecidos.

`consume_ai_request` e `ai_quota_settings` são acessíveis apenas por service_role; clientes não leem/zeram quotas. Limites padrão: meal 20 por hora UTC; body_photo 5 por dia UTC; VIT/coach/chat juntos 30 por hora UTC. Tipos desconhecidos são recusados. Limites podem ser alterados administrativamente em ai_quota_settings. O wrapper consume_meal_analysis compartilha a quota nova e mantém clientes já publicados funcionando. Contadores antigos são copiados com greatest para não ganhar nova franquia no deploy. O upsert é atômico.

O job horário existente limpa somente buckets com mais de sete dias nas quotas antigas, novas e de passos. Não remove registros de saúde. As rotas de corpo e coach exigem o backend Vitra ativo e configurado.

## Saúde por Atalhos

health-steps não oferece CORS; aceita token dedicado de 256 bits, armazena só SHA-256 e deriva o titular do banco. Token expira em 90 dias. Quota de 60 tentativas por hash/hora conta inclusive tokens revogados/expirados de formato válido. Falha na consulta de quota impede gravar.

Revogue em Conectar Saúde pelo Atalhos → Revogar. Gerar token novo substitui o anterior; atualize o Atalho e remova o antigo. Não compartilhe tokens. A quota por hash não bloqueia ataque distribuído com hashes aleatórios; proteções por IP/gateway podem ser necessárias para uso público.

## Ambiente e rotação

- Todas as credenciais ficam no .env da raiz, ignorado pelo Git. `.env.example` lista somente nomes, campos vazios e padrões públicos.
- Somente VITE_SUPABASE_* e VITE_API_URL chegam ao navegador. GEMINI_API_KEY e SUPABASE_SECRET_KEY são lidas exclusivamente pelo servidor Vitra. O nome legado SUPABASE_SERVICE_ROLE_KEY também é aceito.
- Não são necessários Supabase Secrets ou deploy de Edge Functions. Os adaptadores antigos compartilham os handlers, mas o app chama /api.
- Na Vercel, as funções Node leem as mesmas chaves privadas pelo ambiente do processo. Somente origens explícitas ou URLs de deploy fornecidas pelos metadados da plataforma entram no CORS; headers do visitante não autorizam uma origem. O `.env.vercel` privado fica fora do Git.
- O servidor entrega apenas dist/, bloqueia arquivos ocultos e nunca encaminha erros internos. Não registra valores de ambiente, corpo, tokens ou senhas. Credenciais ausentes produzem mensagem fixa de configuração pendente.
- Configurações .env.local anteriores foram guardadas como backups ignorados; somente o .env da raiz é usado pela API.

Para rotacionar Gemini: crie nova chave no projeto com faturamento ativo, atualize GEMINI_API_KEY no .env, reinicie o backend, verifique com conta de teste e revogue a anterior no Google AI Studio. Para Supabase, prefira uma Secret key dedicada ao backend e atualize SUPABASE_SECRET_KEY. Nunca envie essas chaves no chat.

## Git e validação

.gitignore exclui .env/.env.* e node_modules em qualquer nível, liberando apenas .env.example. Auditoria anterior dos refs locais não encontrou secrets nos blobs. Nenhuma reescrita de histórico ou mudança em migrações antigas foi feita nesta troca.

Se descobrir uma exposição: revogue primeiro; em clone dedicado, use git filter-repo para remover arquivos afetados e coordene force-push/reclones. Histórico limpo não desfaz vazamento em forks/caches. Não faça limpeza destrutiva no clone de trabalho sem backup.

uid() usa randomUUID quando disponível, ou getRandomValues em HTTP local. Não serve como helper de autenticação; tokens mantêm geração criptográfica separada. Use HTTPS em produção.

Testes usam IA simulada; verificação SQL isolada cobre limites, wrapper, idempotência e permissões sem tocar produção. Cron real e acesso ao modelo/plano precisam de confirmação administrativa. Siga [MANUAL-STEPS.md](MANUAL-STEPS.md).
## Fotos privadas e análise corporal

A migração 202610040005 cria `progress-photos` privado, com limite de 1,5 MB e políticas por pasta `{user_id}/…`. O navegador redesenha pixels em canvas, até 1600 px, JPEG 0,8: EXIF/GPS do arquivo original não são enviados. Acesso visual usa URLs assinadas por 5 minutos; quem recebe esse link pode usá-lo até expirar, portanto não compartilhe. [Políticas oficiais do Storage](https://supabase.com/docs/guides/storage/security/access-control).

`analyze-body-photos` recebe somente IDs. O JWT do titular rege a leitura de registros e download, sem bypass administrativo. O servidor exige consentimento específico e idade adulta, limita 5 análises por dia, envia somente as fotos escolhidas e notas ao Google e valida a resposta. Plano pago obrigatório; a aplicação não persiste imagens no provedor, mas isso não elimina retenção limitada do próprio Google para segurança. Comparações podem falhar e não são avaliações clínicas. Sinais de sofrimento nas notas interrompem a comparação detalhada.

Excluir foto apaga primeiro o objeto e depois o registro; o trigger apaga análises que mencionem a foto. Se a segunda operação falhar, tente novamente para remover metadados restantes. Exportação inclui metadados/textos; para guardar imagens, baixe-as separadamente antes de excluir. O Perfil inclui exclusao de conta com confirmacao textual e senha atual; o servidor remove arquivos proprios antes de excluir o usuário e suas tabelas por cascata.

## Coach e consultas fechadas

O contexto é montado com cliente Supabase autenticado pelo JWT, em janela de 90 dias; a API não aceita contexto do cliente. Nomes, e-mail, notas, fotos e caminhos não compõem o DTO enviado ao modelo. Exercícios referidos no contexto usam somente nomes do catálogo original. Notas podem produzir um sinal booleano de bem-estar, sem transmissão do texto. Há limites de leitura, e períodos incompletos causam erro em vez de silenciosamente gerar conclusões.

Perguntas são delimitadas como JSON de dados, sem ferramentas nem escrita. Classificação aceita somente best_lift, avg_nutrient, trend_weight, workouts_count, habit_streak e out_of_scope. Parâmetros, datas e IDs do catálogo são validados; nunca se executa SQL do modelo. A segunda chamada recebe somente o resultado numérico. Schemas fechados e checagem de números sem referência rejeitam respostas inválidas; linguagem natural ainda pode interpretar dados incorretamente. A interface mostra origem, período e quantidade. Aplicar abre formulário e só escreve depois de confirmação explícita.

Consentimento geral versão 2 e idade adulta verificados no servidor. Quota compartilhada de coach/chat usa o mesmo controle atômico da fase 1. Plano pago obrigatório. O chat numérico antigo não persiste por padrão; o VIT usa histórico próprio, conforme abaixo.

## Exclusão de conta e validação final

`delete-account` não aceita um user_id no corpo. Valida JWT, confirmação textual e senha atual pelo Auth; verifica que a reautenticação pertence ao mesmo usuário. Service role existe somente no servidor para remover arquivos sob o prefixo próprio e excluir o usuário; FKs removem os registros por cascata. Arquivos são apagados antes da conta. Se uma operação falhar, os passos já concluídos não são desfeitos; exporte primeiro e tente novamente. Nunca registrar senha ou tokens. RLS não protege contra alguém com acesso à conta do titular ou ao painel administrativo.

Os testes PostgreSQL/WASM aplicam as migrações novas duas vezes, verificam isolamento SELECT/INSERT/UPDATE/DELETE, vínculo de hábitos, fotos/análises, transferência de titular e cascata de conta. O esquema Storage é uma fixture; a API de URLs assinadas/upload e o Auth administrativo precisam de teste remoto com duas contas de teste. Sem promessa de validação de serviços não acessados.

## Conversas e memórias do VIT

Consentimento `vit_consent` versão 1 e idade adulta são lidos no servidor. O backend deriva o titular do JWT e monta o contexto por RLS: resumo de até 90 dias, orçamento calórico de hoje, últimas 16 mensagens e até 20 memórias ativas. O cliente envia somente conversa, requestId, pergunta e ID de foto opcional. E-mails no texto enviado ao provedor são omitidos; outros dados pessoais escritos voluntariamente não são automaticamente anonimizados.

Mensagens são somente leitura para clientes autenticados; apenas o servidor grava um turno por `save_vit_turn`, validando conversa/foto do titular. Pergunta e resposta são persistidas numa transação. Uma repetição concluída retorna a resposta salva e não consome nova quota; chamadas concorrentes podem consumir mais de uma análise antes do bloqueio transacional, mas não duplicam o turno. Os schemas e o limite de tamanho são validados antes de gravar.

Memórias só são criadas manualmente ou ao confirmar uma sugestão. É possível editar, desativar e apagar. Elas são independentes das conversas. Sugestões não alteram refeições, treinos ou metas. Fotos passam pelo pipeline corporal com consentimento, titular, quota, preparação sem EXIF e resposta validada; o VIT recebe observações, sem uma segunda transmissão da imagem. A análise pode errar e não estima gordura, peso, diagnóstico ou aparência desejável.

Apagar conversa remove suas mensagens; memórias e fotos têm controles próprios. Excluir a conta remove as três tabelas por cascata. O backup v4 contém conversas, mensagens e memórias, sem chaves/tokens nem bytes de imagens. Texto removido de uma conversa já enviada não pode ser retirado retroativamente do processamento do provedor.
