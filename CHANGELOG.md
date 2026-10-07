# Changelog

## Não lançado

### Funcionalidade 12 · Modo parceiro (specs/funcionalidades/12-modo-parceiro.md)
- Migration `0005_parceiro.sql`: `partner_invites` (só o hash do token; código de 6 sem ambíguos; 7 dias; um ativo por família), remoção suave em `membros_familia.removido_em` com um parceiro ativo por gestação (índice único), permissão `birth_plan` (padrão ligada), `minha_familia` com a DPP da gestante, central de `avisos`, `partner_tips`, RPCs `criar_convite_parceiro`, `revogar_convite_parceiro`, `convite_parceiro_publico`, `aceitar_convite_parceiro` (exige conta não anônima; um papel por conta), `sair_da_gestacao`, `exames_marcados_parceiro`; `remover_membro` passa a ser suave para o parceiro (push apagado, diário fica com ela). RN-04 no banco: o parceiro deixa de ler `user_exams` e vê só os exames marcados (nome e data). pgTAP: `supabase/tests/parceiro.test.sql`, 47 testes.
- Telas: Eu → Parceiro (convidar com link e código, compartilhar pela Web Share API, gerar outro, permissões agenda/fotos/plano, remover), aceitar convite pelo link ou pelo código em `/convite` (explica o que ele verá, pede login com Google ou e-mail, mensagens de expirado/cancelado/usado/outra conta), home do parceiro (semana, tamanho, DPP, "Como ela pode estar", "Como ajudar esta semana", próximos compromissos, atalhos), ajustes dele (avisos por tipo e sair) e a central de Avisos em Eu.
- Avisos do parceiro no job `enviar-lembretes`: véspera de consulta às 18h, exame marcado por ela (na hora), marcos nas semanas 12/20/28/36/38/40 às 9h; opt-out por tipo e no máximo 3 por semana, respeitando silêncio e limite diário.
- Conteúdo: `supabase/seed/dicas-parceiro.json` (semanas 4–40 e um por trimestre), **rascunho aguardando revisão editorial**; vai no bundle e para `partner_tips` pelo `conteudo:sync`.
- Testes: Vitest +15 (convite, dicas, avisos, compromissos); Playwright: 7 fluxos.

### Funcionalidade 01 · Galeria de exames e ultrassons (specs/funcionalidades/01-galeria-exames.md)
- Migration `0004_galeria.sql`: `medical_documents` completa (substitui a ponte mínima da 0003), `document_pages`, `profiles.consents`, cota `ai_document_reads` (só service role), FK `user_exams.document_id`, RLS (parceiro só vê o compartilhado, RN-10; cuidadora nada), Storage das páginas e da pasta `exportacoes/{uid}/`, funções de faxina `limpar_documentos_excluidos` (RN-03) e `exportacoes_vencidas` (RN-09). pgTAP: `supabase/tests/galeria.test.sql`, 43 testes.
- Telas: Galeria (chips de tipo, linha do tempo/grade, semana calculada da data, volta na rolagem), Adicionar/editar (câmera, galeria, PDF com várias páginas, reordenar e remover páginas, tipo, data, título, observação), Documento (zoom, folhear lembrando a página, favoritar só ultrassom, compartilhar só com parceiro na família, editar, excluir com confirmação), Exportar (premium, até 50 páginas, capa com nome/DPP/semana, uma seção por documento, link de 24 h ou download direto sem servidor) e consentimento da IA na primeira leitura. Atalho e retirada da permissão em Eu.
- RN-01 data obrigatória, não futura, confirmação antes de DUM − 90 dias; RN-02 limite free de 20 páginas com paywall (editar sem página nova nunca é barrado); RN-04 pergunta "Este é o resultado de…?" e conclui o exame; RN-11 offline com selo "Aguardando envio".
- Leitura por IA (premium): Edge Function `ler-laudo` confere sessão, papel, plano, consentimento (RN-05) e cota (RN-08), manda as páginas ao modelo com saída estruturada e fallback do lado do servidor, valida o JSON (RN-07: falha vira `failed` sem gastar cota) e só transcreve (RN-06: destaque apenas quando o laudo marca; aviso fixo sob o resumo).
- Exames (spec 03): "Anexar resultado" abre o Adicionar da galeria já vinculado; "Ver resultado" abre o documento.
- PDF com o build `legacy` do pdf.js (o build padrão quebra em navegadores sem `Map.getOrInsertComputed`).
- Testes: Vitest +57 (domínio, regras, ações, exportação, consentimento); Playwright: 13 fluxos com os critérios de aceite.

### Funcionalidades 02–06 (specs/funcionalidades)

#### Base comum
- `supabase/functions/_shared/dominio/`: regras puras usadas pelo app (`@dominio/*`) e pelas Edge Functions: tempo com fuso explícito (`profiles.tz`), UUID determinístico, doses, exames, consultas, barriga, diário, lembretes, preferências e token assinado.
- Migration `0003_funcionalidades.sql`: 14 tabelas com RLS, catálogos semeados (13 exames, 12 marcos), bucket privado `ninho-privado` com policy que segue a RLS da linha, `push_subscriptions`, `reminders_sent`, `profiles.tz/prefs`, `membros_familia.permissoes` + RPC `definir_permissoes_parceiro`. Validada em Postgres 16 com pgTAP (`supabase/tests/funcionalidades.test.sql`, 50 testes: RLS por papel, faixas, unicidades, imutabilidade, Storage) e com dados reais da antiga `consultas`.
- Fila de arquivos offline (IndexedDB → Storage, depois da linha); processamento de foto no aparelho (≤ 1600 px, JPEG 0,85, orientação aplicada, EXIF removido).
- Paywall das funcionalidades (`SheetPaywall`, `paywall_shown`) sempre com saída que não perde nada; a assinatura é a spec 14.
- Permissões do parceiro em Eu → Família (agenda ligada, fotos da barriga desligadas por padrão).
- Lembretes derivados do estado (`planejar` + `selecionarParaEnvio`): tolerância de 30 min (sem enxurrada), 2 por dia, silêncio 22h–7h, medicamentos furam silêncio e limite e respeitam a suspensão. Edge Function `enviar-lembretes` (Cron a cada minuto: materializa doses, marca "Sem registro", envia Web Push) e `acao-lembrete` ("Tomei"/"Adiar" na notificação com token HMAC). Service worker com ações e fila `acoes_push` para aplicar offline; sem servidor, o app mostra os avisos sozinho. Eu → Notificações: ligar avisos, modo discreto, pausar.
- Componentes: Interruptor, Escolha, CampoArea, SheetConfirmar, Foto, Audio; BotaoDitado (mesma transcrição da captura por voz).
- Correção: `supabase/tests/rls.test.sql` não rodava (inseria no catálogo como usuária e lia convite sem permissão).

#### 02 · Medicamentos
- Cadastro com autocompletar de 30 nomes (sem dose), texto fixo da RN-01, horários fixos, a cada N horas, dias da semana e "se necessário"; lembrete desligável (RN-15).
- Doses materializadas no aparelho e no servidor com o mesmo id (7 dias à frente, recupera dias não gerados, nunca toca estado final; troca de fuso mantém a hora local).
- Hoje com "Tomei", sheet com horário real/Pular/Adiar (2×), retroativo de 7 dias, "Sem registro" após 2 h; adesão 7/30 dias e sequência; limite free de 3 ativos; compartilhar a lista; "tomei o ferro" por voz com "Desfazer" por 5 s.

#### 03 · Exames
- Lista gerada na gestação (nunca vazia), seções Agora/Próximos/Marcados/Feitos/Anteriores/Dispensados ("Agora" inclui janela abrindo em até 14 dias, para o critério da semana 9), janelas recalculadas com a DUM, marcar com aviso fora da janela, concluir anexando resultado (na galeria, funcionalidade 01) ou só marcar, dispensar/restaurar, outros exames e "Criar o meu", card "Seu exame foi ontem?" na Hoje, lembretes de janela e de agendamento.

#### 04 · Cronograma de consultas
- `appointments` substitui a `consultas` da spec 05 (migração no banco e no aparelho, inclusive itens parados na outbox). Pauta com perguntas soltas indo para a próxima, ditado, parceiro anotando; concluir em 3 passos opcionais (medidas com faixas e "Confira o valor", perguntas feitas, orientações), sugestão de retorno 28/14/7 dias, "Como foi a consulta?" uma vez cada, "Levar para a consulta" com compartilhar, "pergunta para o médico" por voz, lembretes de véspera (com a contagem da pauta) e 2 h antes.

#### 05 · Foto semanal da barriga
- Grade 4–42, câmera com câmera traseira/virar, 3:4, grade 3×3 e silhueta da semana anterior (0–60 %), galeria sem câmera, substituir com confirmação, legenda, excluir, timelapse (0,2/0,4/0,8 s), vídeo no aparelho (720p com marca no free, 1080p premium), PNG 1080×1350 para compartilhar, lembrete na virada da semana e reforço, pausa após 3 semanas com "Retomar as fotos?".

#### 06 · Diário
- Linha do tempo com busca normalizada e filtro por marco, cards de marco (até 3, o mais recente no topo), "Pular"/"Mais tarde", modo fé, editor com ditado (que cai para gravação se falhar), áudio de até 3 min, até 3 fotos e data, entrada com "Compartilhar com meu parceiro", excluir que apaga áudio e fotos, lista de marcos, limite free de 10 entradas com áudio com "Salvar o texto sem o áudio".

#### Testes
- Vitest: +165 testes das regras numeradas das cinco specs. Playwright: 8 fluxos novos (câmera falsa do Chromium, EXIF checado no arquivo salvo, vídeo exportado).

### Bebê 3D · fatia vertical (semana 20)
- Rota `/hoje/bebe-3d` em tela cheia, lazy e sem SSR; card hero "Veja seu bebê hoje" na Hoje. Abre na semana do perfil (por enquanto só a 20 tem cena; as outras caem na mais próxima).
- Cena com three.js + React Three Fiber: sol quente fora da barriga, preenchimento frio, environment sintético, névoa, parede do útero com veias pulsando no ritmo do coração, janela de sol (god rays), placenta com lóbulos, cordão umbilical espiralado que segue o bebê, partículas em suspensão que reagem à câmera.
- Bebê placeholder gerado por código (campo implícito de cápsulas com kernel de Wyvill → marching cubes → suavização → pesos de pele por proximidade ao osso), com rosto (pálpebras fechadas, nariz, boca, queixo), orelhas e dedos. Geração num Web Worker. Esqueleto de 19 ossos com os nomes da especificação de assets.
- Pele com dispersão subsuperficial por contraluz (espessura por vértice: dedos e orelhas acendem contra o sol), vérnix e modo ultrassom no shader.
- Animação procedural em camadas (B3D-01/04, com testes): repouso flutuante, respiração e batimento por semana, gestos sorteados por idade gestacional (mãos, polegar, chute, espreguiçar, soluço, virar a cabeça, piscar) com entrada e saída suaves e sem repetição; "reduzir movimento" deixa só repouso e coração.
- Câmera: órbita com inércia e pinça, auto-órbita após 6 s, enquadramentos Rosto (na direção do rosto), Mãos e Corpo calculados pela largura necessária e pelo aspecto da tela; foco da profundidade de campo segue o enquadramento.
- Pós: AgX, god rays, DoF, bloom contido, vinheta e grão; MSAA 4× no nível alto. Níveis de qualidade alto/médio/baixo com detecção por GPU e ajuste ao vivo; medidor de fps na tela.
- Dados da semana 20 (comprimento, peso, comparação, marcos, descrição em texto) em `src/conteudo/semanas-3d.json`, marcados para revisão médica, com fontes (NHS, ACOG, Hadlock). Escala do bebê e raio do útero coerentes por semana (B3D-02/03, com testes).
- `docs/bebe-3d-assets.md` (especificação para comprar ou encomendar o modelo definitivo) e `public/bebe3d/MANIFESTO.md` (origem e licença de cada asset). Teste E2E da entrada e da ficha.

### Painel de admin (`/admin`)
- Visão geral: famílias, novas no período (com variação contra o período anterior), ativas em 1/7/30 dias, planos, gestação × bebê, funil perfil → onboarding → e-mail, séries diárias de famílias e uso, registros por tipo e sintomas mais marcados (só contagem).
- Usuárias: gestantes por semana, bebês por mês, papéis, planos, origem dos registros e lista de famílias paginada, sem nome nem dado de saúde.
- Conteúdo: lista com busca, filtros e leituras/guardados por story; calendário "por dia" que simula o carrossel dos próximos 7 dias para qualquer semana ou mês do bebê usando a mesma `storiesDoDia` do app; editor com preview em formato de celular, slug automático, categoria, faixa, dia fixo, premium/publicado e validação das regras CON-07/08 antes de salvar (ADM-01/02, com testes).
- Voz: taxa de aceitação, correções, confiança média, tempo mediano e as últimas interpretações. Sistema: status do Supabase, Edge Function, GA4 e banco de conteúdo, com o passo a passo para ligar.
- Servidor: `supabase/migrations/0002_admin.sql` com as RPCs `admin_eu`, `admin_resumo`, `admin_serie_diaria`, `admin_distribuicoes`, `admin_familias`, `admin_leituras` e `admin_voz`, todas `security definer` exigindo `eh_admin()`. Login por link mágico; só e-mails da tabela `admins` entram.
- App: passa a puxar a tabela `conteudos` na sincronização e mesclar com o bundle (`useBanco`), então o que a equipe edita no painel chega às mães sem novo deploy.
- Sem Supabase, o painel mostra dados de demonstração com faixa de aviso. Gráficos em SVG próprio, com hover, legenda e versão em tabela; cores só por token, claro e escuro.
- Playwright: 2 fluxos do painel (validação e publicação de conteúdo; visão geral e calendário).

### Spec 01 · Arquitetura (Supabase de verdade)
- `supabase/migrations/0001_schema.sql`: profiles, familias, membros_familia, bebes, registros, sintomas (+ catálogo), consultas, sessoes_chutes, contracoes, pos_parto_checkins, conteudos, conteudos_lidos, convites, voz_interpretacoes e admins. RLS por `familia_id` via `membros_familia`; sintomas e check-ins da mãe invisíveis para avó e cuidadora (CUI-04/05); só mãe e parceiro apagam registros de outros.
- Triggers: `handle_new_user` cria perfil, família e membro 'mae' no primeiro login (ARQ-03); `preencher_familia`/`preencher_autor` a partir da sessão; `manter_mais_recente` resolve conflito pelo maior `atualizado_em` (ARQ-02).
- RPCs: `criar_convite`, `convite_publico`, `aceitar_convite`, `remover_membro`, `iniciar_cortesia`, `meus_membros`, `minha_familia`; view `v_modo` (NAV-01). Teste pgTAP em `supabase/tests/rls.test.sql`.
- Cliente offline-first: outbox em IndexedDB com retry 1 s/4 s/16 s/60 s/5 min (ARQ-01), sincronização push+pull com merge por `atualizado_em`, promoção da sessão local para a anônima do Supabase, faixa "Sem conexão, salvando aqui" (ARQ-04) e aviso de pendências há mais de 24 h.
- Sessão anônima real com `signInAnonymously`, reaproveitando a sessão persistida pelo SDK; cadastro por `linkIdentity` preserva o uid.
- PWA: service worker com Serwist (pré-cache do build, cache de runtime, fallback `/~offline`), atalhos "Registrar" e "Bebê" no manifest.
- Edge Functions: `interpretar-registro` (Deno + SDK da Anthropic, Claude Haiku 4.5, temperatura 0, ferramenta JSON estrita, prompt de sistema em cache, JWT obrigatório, grava em `voz_interpretacoes` para medir precisão) e `enviar-push` (esqueleto para a spec 13). No cliente, `interpretar()` usa a function com rede e cai no parser local sem ela.
- GA4 via gtag quando `NEXT_PUBLIC_GA_ID` existe; `track()` já era tipado.
- Playwright com 3 fluxos críticos (`pnpm e2e`): onboarding até a Hoje em 4 toques, registro do bebê com timer que sobrevive ao reload e apagar com desfazer, virada do parto com cortesia e desfazer em 24 h.
- `types.generated.ts` escrito à mão a partir da migration, com teste que confere tabela por tabela até o `pnpm supabase:types` rodar no CI.
- Correção achada pelo E2E: `arredondar5min` arredondava para cima e um registro "agora" podia cair 2 min no futuro, sendo recusado em silêncio (BEB-07). Agora arredonda para baixo.
- Fora desta versão: Stripe (spec 14), Storage de fotos, fallback de voz por gravação de áudio, painel de conteúdo.

### Spec 12 · Cuidadores (local)
- Modelo de família, membros e convites em coleções locais; quem passa pelo onboarding é a dona.
- Permissões por papel (CUI-01/04): mãe e parceiro veem tudo; avó e cuidador registram e veem tiles, dia e previsão, mas não sintomas, check-in pós-parto nem assinatura. A home e o "+" respeitam isso.
- `/eu/familia` com membros, papel, último acesso, remover (CUI-08); sheet "Convidar" com papel e link de 72 h de uso único (CUI-02).
- `/convite/[token]`: aceitar com nome, cria sessão anônima e perfil (CUI-09); convite usado ou expirado mostra a mensagem certa; trocar de família pede confirmação (CUI-03).
- Registros guardam `criado_por`; tiles mostram a inicial do autor e a linha do tempo mostra o nome (CUI-07).
- Limite desta versão: sem servidor, o link só funciona no mesmo aparelho, e a tela avisa. QR fica para quando houver Supabase.

### Spec 11 · Virada do parto
- "Registrar nascimento" na aba Bebê, no "+" a partir da semana 36 e na faixa da home depois da DPP.
- Sheet "Nasceu!": nome, data e hora, prematuro com semanas sugeridas quando nasceu antes de DPP − 21 dias (VIR-05), gêmeos no mesmo sheet. Futuro é rejeitado; mais de 12 meses pede confirmação (VIR-04).
- Gravar o nascimento vira o modo para bebê na hora, sem rede (VIR-01/08); tela `/bebe/bem-vindo` sem confete.
- Cortesia de 7 dias do Completo para quem não tem plano (VIR-02); `temPlano()` já considera.
- Check-in pós-parto 1x/dia nas 6 primeiras semanas (dor, sangramento, humor); dor 3, sangramento intenso ou humor baixo por 3 dias mostram a orientação com a lista de sinais e o botão de ligar, sem alarme (VIR-07). `/eu/pos-parto/sinais` com rascunho para revisão clínica.
- `/eu/bebe`: corrigir nome, data, hora e semanas; "não nasceu ainda" só nas primeiras 24 h (VIR-06); telefone da equipe.

### Spec 10 · Previsão de soneca
- `preverSoneca(registros, bebe, agora)` pura, com testes para as 7 faixas, prematuro, mediana com 5+ vigílias, sem dados e sono em andamento (SON-01..06, SON-09).
- Card "Próxima soneca" na home: janela de 25 min, motivo em uma linha, coral dentro e depois da janela; "Dormindo há X min" com sono em andamento. Copy sem "deveria", "atrasado", "errado" (SON-07).
- `/bebe/sono`: barras dos últimos 7 dias (sonecas e noite), vigília provável e o interruptor do aviso (a notificação em si é a spec 13).

### Spec 09 · Home do bebê e registros
- `/hoje` e `/bebe` em modo bebê: anel do primeiro ano com "3 meses e 2 semanas" e idade corrigida (BEB-10), card de previsão, quatro tiles com "há 1 h 12" a cada 30 s e timers ao vivo (BEB-01/02), dica de voz.
- Sheets: Sono (timer ou início e fim; "Acordou agora"; só um em andamento, BEB-03), Mamada (peito com timer por lado e troca, BEB-04; mamadeira com teclado e 3 atalhos, BEB-05; bomba), Fralda (um toque), Banho.
- Hora ajustável de 5 em 5 min nas últimas 24 h; futuro rejeitado inline (BEB-06/07).
- `/bebe/dia`: barra 0h–24h com blocos coloridos, sono em andamento listrado até agora, lista com edição (BEB-08).
- Apagar é soft delete com "desfazer" no toast por 5 s (BEB-09). Seletor de bebê para gêmeos (BEB-11).

### Spec 08 · Registro por voz (transcrição no aparelho + parser local)
- `/registrar` com o microfone em cima: segurar fala, soltar registra, toque curto mostra a dica, 20 s no máximo (VOZ-01); haptics (VOZ-11).
- Transcrição pela Web Speech API em pt-BR com transcrição parcial em itálica; sem suporte ou sem permissão, avisa e oferece o registro à mão.
- Parser local de regras (VOZ-04/05/07): tipos, minutos, lado, ml, conteúdo da fralda, horários relativos e absolutos, até 3 registros por frase, nomes dos bebês. 32 frases em `tests/voz/frases.json`.
- Confiança < 0,6 ou horário no futuro: "não entendi" com 2 sugestões, nada gravado (VOZ-06). Sem rede, frase complexa vai para `voz_pendentes` (VOZ-08).
- Confirmação em uma linha com "Registrado ✓" (fecha em 4 s) e "Corrigir", que abre o sheet do tipo com o registro.
- Fora: Edge Function com LLM e fallback por gravação (dependem de Supabase). O parser local é o caminho principal até lá.

### Design system
- Correção: o mapeamento de `--spacing-5/6/7` para os tokens fazia `size-7`, `h-7`, `gap-6` etc. renderizarem maiores que o previsto. Removido; a escala de 4 px do Tailwind já cobre os tokens.
- Toast aceita ação inline ("desfazer"). Novos: Tile, SeletorHora, Teclado.

### Spec 07 · Conteúdo semanal e stories
- Banco de conteúdo em markdown (`content/*.md`, frontmatter + cards separados por `---`) compilado para `src/conteudo/banco.json` por `pnpm conteudo:build` (roda antes de `test` e `build`). As 42 stories "Semana X: o que muda" nascem de `conteudo-semanas.json`. Vai inteiro no bundle, então lê offline (CON-06).
- 35 artigos iniciais: toda semana de 1 a 42 tem ao menos 2 além da story da semana; todo mês do bebê de 0 a 12 tem ao menos 1. Seis são premium.
- Stories do dia na home: story da semana + 2 elegíveis, não lidas primeiro, `dia_da_semana` de hoje primeiro, ordem aleatória com semente = data (CON-01); modo bebê usa `mes_bebe` (CON-02); lida fica esmaecida e sai no dia seguinte (CON-04).
- Leitor em tela cheia: cards por toque, progresso segmentado, guardar, card de bloqueio para premium sem plano (CON-05).
- `/eu/guardados` (CON-03).
- Checagem CON-07 como teste: nenhum texto usa "sempre", "nunca" ou "garantido" e toda story de saúde termina com "Na dúvida, fale com quem te acompanha."; o build falha sem isso.
- Fora: painel `/admin/conteudo` (precisa de Supabase e allowlist).

### Spec 06 · Sintomas e diário
- Catálogo de 28 sintomas em `supabase/seed/sintomas.json` (rascunho para revisão), com grupo e faixas de semanas frequentes.
- Chips na home: registrados hoje primeiro + frequentes da semana, até 5, e o "+" (SIN-01); um toque registra leve, outro remove (SIN-02); "Chutes" e "Contrações" abrem os sheets (SIN-04).
- Sheet "Como você está hoje?" por grupo; toque cicla leve → incômodo → forte → remove (SIN-03); nota livre.
- Entre 0h e 4h pergunta "Ainda é ontem?" uma vez por sessão (SIN-05).
- `/hoje/diario` por dia com filtro por sintoma, edição até 30 dias (SIN-08), linha "Vale comentar na próxima consulta" após 3 dias fortes (SIN-07), estado vazio com "Registrar hoje".
- `/hoje/diario/resumo`: grade dia × sintoma dos últimos 14 dias e "Copiar como texto" no formato da SIN-06, com fallback selecionável.

### Spec 05 · Home da gestação
- `/hoje`: saudação por hora (HG-04), anel de 40 semanas com trimestres, cheio depois da 40 (HG-02), legenda "N semanas para o parto" / "pode ser a qualquer momento" / "X dias além da data" (HG-03), pílula "Como você está hoje?", chips, stories, card da próxima consulta.
- Consultas: sheet de criar/editar, lista em `/eu/consultas`, marcar realizada. Card fica coral a partir de 24 h antes (HG-05); passada sem marcar pergunta "Foi bem?" por 3 dias (HG-06).
- Contador de chutes: encerra sozinho em 10 chutes ou 2 h com toast; a sessão aparece no diário do dia (HG-07).
- Timer de contrações com duração e intervalo das últimas 6; aviso "Padrão de trabalho de parto. Fale com sua equipe." com 6 em 1 h, ≥ 45 s e intervalo ≤ 5 min (HG-08), sem palavra de diagnóstico.

### Fundação (specs 01–03, parcial)
- Coleções locais (`src/lib/dados`) no formato de registro da spec 01 (id no cliente, `atualizado_em`, `apagado_em`), reativas via `useSyncExternalStore`; a outbox de sincronização entra sem mudar as telas.
- TabBar com 4 abas e "+"; `/registrar`; `/bebe` e `/enxoval`; `/eu` com nome, DPP, tema, atalhos e "apagar tudo".
- Componentes: Sheet, Toast, TabBar, Story, Vazio, Skeleton, Cabeçalho, Tile, SeletorHora, Teclado.

### Spec 04 · Onboarding
- Fluxo de 7 telas, uma pergunta por tela, barra de progresso sempre visível e "pular" da tela 4 em diante.
- Momento de valor na tela 3: anel com a semana, dias, trimestre, semanas para o parto, comparação de tamanho e o que muda esta semana, tudo antes de pedir nome.
- DPP direta ou calculada pela DUM (+280 dias), editável; DPP no passado pergunta "o bebê já nasceu?" e vira modo bebê (ONB-01, ONB-02).
- Conteúdo das 42 semanas embutido no bundle; a tela 3 abre sem rede (ONB-03).
- Rascunho do fluxo em localStorage: fechar e voltar retoma na mesma tela por até 7 dias (ONB-04).
- Instalação do PWA guiada por sistema e pedido de push só depois de instalado (ONB-05).
- Cadastro só na última tela e pulável; pular mantém a sessão anônima e a Hoje mostra a faixa "Guardar minha linha do tempo" por 3 dias (ONB-06).
- Voltar sempre possível, exceto da tela 3 para a 2 depois de gravar a DPP (ONB-08).

### Base do projeto
- Next.js 15 App Router, TypeScript strict, Tailwind 4 lendo só `src/styles/tokens.css`, Vitest, ESLint com regra que barra hex fora dos tokens.
- Tokens claro/escuro, fontes Outfit e EB Garamond via `next/font`, `data-tema` com `auto | claro | escuro`.
- `lib/dates.ts` (semana gestacional, DPP/DUM, idade do bebê, legendas, formatação) com testes.
- Sessão anônima local, com Supabase opcional por variáveis de ambiente. Manifest do PWA e ícones.
