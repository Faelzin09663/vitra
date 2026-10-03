# Vitra

Webapp pessoal de treino, alimentação e hábitos, em React e TypeScript.

## Executar

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
```

Inclui painel diário, água, calorias e macros, cardio em quilômetros, cronômetro de treino, registro de séries, descanso, peso a cada três dias, metas e exportação JSON. Cadastro por nome, e-mail e senha, login, confirmação de e-mail, recuperação de senha e saída da conta usam o Supabase Auth. Os registros ficam no banco, vinculados ao usuário autenticado. O painel reinicia os contadores na virada do dia/semana sem apagar o histórico e preserva treinos em andamento. IA de refeições e passos do Saúde via Atalhos exigem a configuração adicional descrita em [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md).

## Configurar o Supabase

1. No SQL Editor do seu projeto Supabase, execute as migrações em ordem, uma vez cada: `supabase/migrations/202610030001_vitra.sql` e `supabase/migrations/202610030002_history.sql`. Se já executou a primeira, execute apenas a segunda. Elas criam `profiles`, `user_data`, `daily_records`, os gatilhos do perfil e do histórico e as regras de Row Level Security.
2. Copie `.env.example` para `.env.local` e preencha a URL e a chave pública publishable (ou anon). O projeto usa Vite: variáveis `NEXT_PUBLIC_*` devem ser renomeadas para `VITE_*` conforme o exemplo. Nunca use service_role ou chave secreta no frontend.
3. Em **Authentication → URL Configuration**, configure a Site URL e adicione `http://localhost:5173` às Redirect URLs durante o desenvolvimento. Adicione também o endereço do aplicativo publicado. O cadastro e a recuperação retornam à origem atual do app.
4. Mantenha o provedor de e-mail habilitado. Com a confirmação ativa, o usuário só acessa o painel após confirmar o e-mail. Para enviar e-mails a usuários reais, configure um SMTP próprio em Authentication conforme a [documentação de e-mails do Supabase](https://supabase.com/docs/guides/auth/auth-smtp).
5. Reinicie `npm run dev` após alterar as variáveis.

Senhas são gerenciadas pelo Supabase Auth e não são armazenadas na tabela de perfis. A tabela `profiles` contém nome e e-mail; `user_data` contém um documento JSON com o painel de cada usuário, metas, exercícios, peso, atividades de cardio, registros individuais de água e séries/cargas de todos os treinos finalizados. `daily_records` guarda os totais de água, refeições, metas e séries por dia: um gatilho atualiza o histórico na mesma transação de salvamento, preservando o dia anterior ao reiniciar os contadores. A tela Evolução exibe peso, histórico diário, treinos concluídos e cardio. As regras do banco permitem acesso somente pelo titular. Registros antigos do navegador não são importados automaticamente para evitar atribuí-los à conta errada.

O app mostra o status de salvamento, permite repetir uma gravação que falhou e salva as alterações pendentes antes de sair. Alterações offline ficam em memória até serem salvas: mantenha a página aberta se houver erro. Em edição simultânea em dois dispositivos, prevalece o último painel salvo; não há mesclagem de alterações concorrentes.

## Testes

O layout prioriza celulares e usa colunas e navegação lateral em telas maiores. O botão de lua/sol no topo troca o tema; em Perfil → Aparência há opções Claro, Escuro e Sistema. A preferência fica salva neste dispositivo e acompanha mudanças do sistema quando essa opção é escolhida.

Os recursos de timer persistente, cardio em quilômetros, peso a cada três dias, IA NVIDIA e passos por Atalhos estão descritos em [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md), com os passos para ativar as funções e a migração adicional.

```sh
npm test
```

Os testes verificam os fluxos de autenticação e persistência com um cliente Supabase simulado, além da preservação dos históricos após a virada do dia e da semana. Para verificar a configuração real, após aplicar as migrações: crie uma conta, confirme o e-mail, registre água e entre em outro navegador; o registro deve ser carregado. Uma segunda conta deve abrir sem os registros da primeira. Teste também recuperação de senha, logout e os registros na tela Evolução. Esses testes reais exigem um projeto Supabase configurado e não são executados automaticamente contra contas reais.
