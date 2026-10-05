# VIT — assistente pessoal

O menu **VIT** aparece na lateral do computador e na navegação inferior do celular. Conversas, mensagens e memórias ficam em tabelas próprias do Supabase, com acesso por titular. A migração `202610040007_vit.sql` já foi executada pelo usuário e as tabelas foram verificadas por uma consulta sem registros pessoais.

## Usar

1. Reinicie `npm run dev` para carregar o backend atualizado.
2. Salve sua idade adulta no Perfil e abra VIT. No botão **Autorizações e privacidade** do cabeçalho, leia e marque a autorização específica; salvar a autorização não chama IA.
3. Escreva seu objetivo, uma dúvida de alimentação ou treino. O assistente recebe um resumo dos registros, orçamento calórico de hoje, últimas 16 mensagens e até 20 memórias ativas mais recentes.
4. Para lembrar uma preferência, abra **Gerenciar memórias** no cabeçalho ou confirme a sugestão na resposta. Edite, desative ou apague quando quiser. Memórias são compartilhadas entre suas conversas, sem inferir preferências por fotos.
5. Para fotos próprias, autorize também a análise corporal em Autorizações e privacidade. Escolha JPEG/PNG/WebP, selecione o ângulo e envie com sua pergunta. A imagem é reencodada em JPEG sem EXIF e salva no acervo privado de Evolução → Fotos. HEIC precisa ser convertido antes.

O VIT pode propor refeições com porções e ajustes de organização do treino. As sugestões são revisáveis e não alteram registros ou metas automaticamente. Fotos permitem observações cautelosas de qualidade, posição e diferenças visíveis, sem estimar gordura, peso, diagnóstico ou julgar aparência. O modelo pode errar; as calorias continuam sendo estimativas.

## Interface de chat

A conversa ocupa uma área própria: histórico lateral no computador, mensagens centrais e campo de envio na parte inferior. No celular, **Abrir histórico de conversas** mostra a lista em um painel com foco e fechamento por Escape. Temas claro/escuro usam as cores do Vitra.

**Nova conversa** limpa o campo e abre sugestões para começar; o registro só é criado ao enviar a primeira pergunta. Conversas anteriores permanecem na lista. Durante o envio, sua mensagem e o estado de espera aparecem na conversa; os turnos continuam sendo confirmados após salvar no Supabase. Buscar mensagens anteriores mantém a posição da leitura.

No computador, Enter envia e Shift + Enter adiciona uma linha. Durante composição de teclado, Enter não envia. No celular, Enter mantém a digitação e o botão de seta envia. Anexos ficam ao lado do campo de mensagem; memórias e autorizações abrem em painéis separados.

## Configuração

O backend usa `SUPABASE_SECRET_KEY` e `GEMINI_API_KEY` exclusivamente no `.env` da raiz. `GEMINI_MODEL_VIT` é um override opcional; vazio usa o modelo geral. Não há chave privada no frontend nem necessidade de Supabase Secrets. Execute o servidor Vitra para atender `/api/vit`; uma hospedagem somente estática não executa IA. Veja [ENVIRONMENT.md](ENVIRONMENT.md).

VIT, coach e chat numérico compartilham 30 solicitações por hora. Fotos também usam a quota corporal de 5 análises por dia. Erros após consumir quota podem contar. Testes sempre usam provedor simulado, sem chamada Gemini real; faturamento e acesso ao modelo precisam estar ativos na conta Google.

## Histórico, privacidade e backup

Histórico carrega as 100 mensagens mais recentes e permite buscar anteriores. Apenas a janela recente entra no contexto do modelo. O servidor verifica JWT, consentimentos, titular da conversa/foto e quota antes de analisar. Pergunta e resposta são gravadas juntas antes da confirmação; ao repetir uma solicitação concluída, o turno salvo é reutilizado.

Excluir uma conversa apaga suas mensagens. Memórias e fotos permanecem até serem removidas em seus próprios controles. Remover um anexo do formulário não apaga uma foto já enviada. Excluir conta remove conversas/mensagens/memórias por cascata. Backup JSON v4 inclui esses textos e metadados; imagens devem ser baixadas separadamente. Não envie credenciais ou dados de terceiros nas mensagens.

## Validação

```sh
npm test
npm run build
npm run check:server
npx deno run --node-modules-dir=none --allow-read --allow-env --allow-sys tests/sql/vit-rls.check.ts
```

Os testes verificam consentimentos independentes, contexto montado no servidor, erro de persistência, repetição, fotos restritas, histórico após remontagem e confirmação de memórias. PostgreSQL/WASM verifica a migração aplicada duas vezes, RLS, mensagens somente pelo servidor, turnos atômicos, ordenação e cascatas sem alterar o banco remoto.
