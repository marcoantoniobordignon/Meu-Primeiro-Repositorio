# Changelog

## Não lançado

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
