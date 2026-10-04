# Timer, NVIDIA e Apple Saúde

## Recursos do webapp

- O treino começa um cronômetro com horário inicial salvo na conta. Pausas e retomadas também são salvas. Ao reabrir o app, o tempo é recalculado pelo relógio, mesmo que o iOS tenha suspendido a página. A duração efetiva fica no histórico do treino concluído.
- O descanso usa um horário de término, não depende de intervalos em segundo plano. Não há alarme garantido com o iPhone bloqueado. O botão Manter tela acesa usa Screen Wake Lock quando disponível.
- Cardio é registrado por distância em quilômetros. Duração em minutos é opcional. Registros antigos em minutos permanecem no histórico sem inventar uma distância. A meta inicial é de 15 km/semana e pode ser ajustada.
- O registro de peso tem data, observação, contexto do treino e cardio daquele dia. O painel lembra a próxima pesagem após três dias; não bloqueia registros intermediários. Um novo registro no mesmo dia substitui o anterior. O gráfico mostra o histórico de peso e não atribui causalidade a um treino.
- Refeições podem ser analisadas por foto ou descrição. A estimativa precisa ser revisada e confirmada. Apenas a refeição confirmada é salva no banco; a foto fica na memória da página e é enviada ao provedor somente ao clicar em Analisar.

## Ativar as integrações no Supabase

Na última verificação do projeto conectado, `daily_records` já existia; `daily_steps`, `health_connections` e as duas Edge Functions ainda não existiam. Nesse estado, execute apenas a migração `202610030003_integrations.sql` e publique as funções conforme os próximos passos. Se a configuração já mudou, confira as tabelas antes de repetir migrações.

As tabelas iniciais `profiles` e `user_data` precisam existir. Se ainda não aplicou, execute as migrações anteriores em ordem. Execute **uma vez** no SQL Editor:

1. `supabase/migrations/202610030002_history.sql` (somente se ainda não aplicou).
2. `supabase/migrations/202610030003_integrations.sql`.

A terceira migração cria passos diários, conexões do Saúde e uma quota de 20 análises por usuário/hora. RLS separa os registros por usuário. O horário do treino, quilômetros, peso e suas relações usam o documento já existente em `user_data` e não exigem conversões destrutivas.

### Publicar as funções

No terminal deste projeto, entre na sua conta Supabase:

```sh
npx supabase login
npx supabase functions deploy analyze-meal --project-ref fukfidkpmfbdapemsbpr --no-verify-jwt
npx supabase functions deploy health-steps --project-ref fukfidkpmfbdapemsbpr --no-verify-jwt
```

`verify_jwt = false` permite que a validação seja feita dentro da função: `analyze-meal` verifica o JWT do usuário com `auth.getUser`; `health-steps` aceita somente o token limitado de sincronização. Nenhuma função permite acesso anônimo aos dados. As variáveis `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são fornecidas pelo ambiente das Edge Functions e nunca vão para o frontend.

### Chave da NVIDIA

A chave deve existir somente em `supabase/functions/.env.local` e nos Secrets das Edge Functions. O arquivo da raiz contém apenas configurações públicas do frontend. Configure também `ALLOWED_ORIGINS`, incluindo localhost e a origem HTTPS publicada; veja [Segurança](SECURITY.md) para aplicar a migração de quotas e limpeza automática.

O modelo padrão é [`nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`](https://build.nvidia.com/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning), da família aberta Nemotron. O catálogo anuncia um endpoint gratuito de **prototipagem**, sujeito aos limites e termos da sua conta. Isso não garante hospedagem de produção gratuita ou ilimitada; executar os pesos por conta própria também exige infraestrutura.

Gere a chave no catálogo NVIDIA e configure **NVIDIA_API_KEY** em **Supabase → Edge Functions → Secrets**. Não coloque essa chave em variáveis `VITE_*` nem no código do navegador. Não precisa enviá-la no chat.

Alternativa com CLI: copie `supabase/functions/.env.example` para `supabase/functions/.env.local`, preencha a chave e execute:

```sh
npx supabase secrets set --env-file supabase/functions/.env.local --project-ref fukfidkpmfbdapemsbpr
```

Para hospedar o modelo NVIDIA por conta própria, defina `NVIDIA_ENDPOINT` para um endpoint confiável compatível com chat completions, `NVIDIA_MODEL` para o nome servido e `NVIDIA_API_KEY` para a autenticação desse servidor. O endpoint é configuração administrativa; o usuário não pode fornecer URLs arbitrárias na requisição.

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
