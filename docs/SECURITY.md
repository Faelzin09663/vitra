# Segurança e privacidade — Vitra

## Dados e ameaças

O Vitra guarda dados de saúde e hábitos. Os riscos principais são acesso entre contas, roubo de sessão/token, exposição de secrets, abuso de quotas e conteúdo não confiável enviado à IA.

O navegador recebe apenas URL/chave pública Supabase. RLS protege os registros pelo titular. Senhas ficam no Auth. Service role e chave de IA nunca entram no navegador, bundle, respostas ou logs. Não registrar Authorization, fotos, descrições ou detalhes de erros do provedor.

## Análise de refeições

Fluxo: navegador reencoda pixels em JPEG a 1024 px/qualidade 0,8 → usuário autoriza e salva preferências → clique explícito em Analisar → Edge Function valida JWT com auth.getUser → lê consentimento/idade do titular em user_data → valida tamanho/formato → consome quota → provedor Gemini → JSON validado → revisão editável → confirmação salva refeição.

A foto permanece em memória, é descartada ao fechar e não é armazenada pelo Vitra. Descrição/foto saem do Supabase e chegam ao Google; não enviamos nome, e-mail, UUID, senha ou JWT. O usuário deve evitar dados pessoais na própria foto/descrição. A aplicação envia store=false e não usa Files API/cache explícito. Isso não elimina retenção de segurança do Google.

Consentimento: `preferences.ai_consent = { version, grantedAt }`, com versão atual e timestamp ISO; null significa desativado. Conta antiga começa sem autorização. Perfil deve ter idade adulta salva (18–100). O servidor lê a preferência do banco por UUID autenticado, ignorando alegações de consentimento/user_id no corpo. Salvar autorização é aguardado antes da chamada. Perfil e tela de análise permitem desativar; a desativação precisa ser sincronizada para valer em todos os dispositivos. Não é possível retirar uma foto que já tenha sido enviada durante uma análise em curso. Futuras fotos do corpo precisarão de consentimento separado e não estão implementadas nesta fase.

O JSON do painel ainda usa último salvamento entre dispositivos: um painel antigo pode substituir preferências. Evite editar simultaneamente; controle de concorrência/revogação resistente a snapshots antigos será necessário antes de múltiplos dispositivos concorrentes. A função sempre verifica o estado atualmente persistido.

## Privacidade e plano do Gemini

**Plano pago com faturamento ativo no projeto Google Cloud é obrigatório para o Vitra**, por tratar dados de saúde/fotos. Não basta criar uma chave gratuita.

Nos [termos oficiais](https://ai.google.dev/gemini-api/terms), o serviço gratuito pode usar entrada/saída para melhorar produtos e envolver revisão humana; não envie dados sensíveis ao plano gratuito. Plano pago não usa prompts/respostas para essa melhoria, mas pode retê-los temporariamente para segurança e obrigações legais. Usuários no EEE, Reino Unido e Suíça só devem ser atendidos com serviços pagos. Recursos de IA são destinados a adultos e não fornecem aconselhamento médico.

O servidor não consegue inferir faturamento ativo a partir da chave: o administrador deve verificá-lo no Google Cloud. Os termos do fornecedor podem mudar; revise antes de disponibilizar o app a terceiros.

## Provedor, CORS e quotas

A interface AIProvider separa handlers do fornecedor. Gemini REST usa x-goog-api-key no cabeçalho, nunca query string; não segue redirects. Endpoint é base HTTPS administrativa sem query/credenciais; usuários não podem enviar URLs. Não há ferramentas nem escrita por IA. Texto livre entra delimitado como dado; schema não garante correção nutricional, por isso há validação local e confirmação humana.

Respostas bloqueadas, truncadas, com JSON/campos inválidos ou pensamentos são descartadas. Erros HTTP/timeout viram mensagens fixas, sem revelar resposta interna ou chave.

ALLOWED_ORIGINS lista origens exatas separadas por vírgula, incluindo http://localhost:5173 e domínio publicado, sem barra final. Sem configuração, origens de navegador são recusadas. CORS não é autenticação: chamadas sem Origin ainda exigem JWT e consentimento. Preflight aceita só POST/cabeçalhos conhecidos.

`consume_ai_request` e `ai_quota_settings` são acessíveis apenas por service_role; clientes não leem/zeram quotas. Limites padrão: meal 20 por hora UTC; body_photo 5 por dia UTC; coach/chat juntos 30 por hora UTC. Tipos desconhecidos são recusados. Limites podem ser alterados administrativamente em ai_quota_settings. O wrapper consume_meal_analysis compartilha a quota nova e mantém clientes já publicados funcionando. Contadores antigos são copiados com greatest para não ganhar nova franquia no deploy. O upsert é atômico.

O job horário existente limpa somente buckets com mais de sete dias nas quotas antigas, novas e de passos. Não remove registros de saúde. Modelos/funções body/coach ainda não foram publicados; somente a configuração/quota está preparada.

## Saúde por Atalhos

health-steps não oferece CORS; aceita token dedicado de 256 bits, armazena só SHA-256 e deriva o titular do banco. Token expira em 90 dias. Quota de 60 tentativas por hash/hora conta inclusive tokens revogados/expirados de formato válido. Falha na consulta de quota impede gravar.

Revogue em Conectar Saúde pelo Atalhos → Revogar. Gerar token novo substitui o anterior; atualize o Atalho e remova o antigo. Não compartilhe tokens. A quota por hash não bloqueia ataque distribuído com hashes aleatórios; proteções por IP/gateway podem ser necessárias para uso público.

## Secrets e rotação

- Raiz: .env.local tem apenas variáveis públicas VITE_SUPABASE_*.
- Funções: .env.example lista nomes e padrões sem chave real; configure GEMINI_API_KEY em Supabase → Edge Functions → Secrets. Arquivos preenchidos .env* são ignorados pelo Git.
- SUPABASE_SERVICE_ROLE_KEY vem do ambiente Supabase. SUPABASE_ACCESS_TOKEN da CLI fica fora do projeto.
- Revogue a chave do provedor anterior no respectivo painel, pois foi compartilhada fora do repositório; remova secrets antigos do Supabase. Não os exiba no terminal.

Para rotacionar Gemini: crie uma nova chave no projeto com faturamento ativo, atualize o Secret no Supabase, faça uma análise com conta de teste e revogue a chave anterior no Google AI Studio. Em suspeita de abuso, revogue imediatamente. Não envie nenhuma chave no chat.

## Git e validação

.gitignore exclui .env/.env.* e node_modules em qualquer nível, liberando apenas .env.example. Auditoria anterior dos refs locais não encontrou secrets nos blobs. Nenhuma reescrita de histórico ou mudança em migrações antigas foi feita nesta troca.

Se descobrir uma exposição: revogue primeiro; em clone dedicado, use git filter-repo para remover arquivos afetados e coordene force-push/reclones. Histórico limpo não desfaz vazamento em forks/caches. Não faça limpeza destrutiva no clone de trabalho sem backup.

uid() usa randomUUID quando disponível, ou getRandomValues em HTTP local. Não serve como helper de autenticação; tokens mantêm geração criptográfica separada. Use HTTPS em produção.

Testes usam IA simulada; verificação SQL isolada cobre limites, wrapper, idempotência e permissões sem tocar produção. Cron real e acesso ao modelo/plano precisam de confirmação administrativa. Siga [MANUAL-STEPS.md](MANUAL-STEPS.md).