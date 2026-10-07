# Adaptação por trimestre (home, artigos, tema)

## Problema
A home e os conteúdos são iguais da semana 5 à 40, mas o que ela precisa muda a cada fase.

## Escopo desta versão
- Home com cards ordenados por regras de trimestre e de ação pendente
- Artigos por semana e por trimestre: "Para esta semana", biblioteca com abas, leitura, favoritos
- Tela de virada de trimestre com mini-retrospectiva e "o que esperar"
- Variação sutil do tema (anel e ilustrações) por trimestre, com modo escuro

## Fora de escopo
- Stories diárias (usarão os mesmos campos de semana quando existirem)
- Recomendação personalizada por IA
- Conteúdo pago aprofundado (a coluna `is_premium` existe, mas a v1 publica tudo gratuito)
- Mudar a navegação (tab bar) por trimestre

## Telas
1. Home: anel da semana com número grande, até 6 cards em ordem de prioridade
2. Para esta semana: 3 artigos
3. Biblioteca: abas T1, T2 e T3 (a do trimestre atual abre primeiro), busca, favoritos
4. Artigo: título, tempo de leitura, corpo, revisor e data, favoritar
5. Virada de trimestre: celebração, números do trimestre, 3 cards "o que esperar"

## Modelo de dados
```
articles
  id, slug text unique, title text (<=90), summary text (<=200), body_md text
  hero_image_path text null
  week_from smallint, week_to smallint, trimester smallint   -- trimester derivado de week_from
  reading_minutes smallint, featured bool default false, position int
  is_premium bool default false
  reviewed_by text not null, reviewed_on date not null
  status text default 'draft', published_at

article_reads(user_id, article_id, first_opened_at, read_at null, is_favorite bool default false, pk both)
```
Cards da home e prioridade por trimestre (maior número aparece primeiro; +10 se há ação pendente; os concluídos descem para o fim com check):
| card | T1 | T2 | T3 |
|---|---|---|---|
| Resumo da semana (anel) | 100 | 100 | 100 |
| Exames a marcar | 90 | 80 | 60 |
| Medicamentos de hoje | 85 | 50 | 50 |
| Marco do diário | 80 | 85 | 40 |
| Foto da semana | 40 | 90 | 70 |
| Próxima consulta | 60 | 60 | 85 |
| Plano de parto | 0 | 20 | 95 |
| Mala e enxoval | 0 | 10 | 80 |
| Artigo da semana | 70 | 70 | 55 |
| "Posso comer?" (atalho do FAQ) | 75 | 45 | 30 |
| Direitos para esta fase | 35 | 55 | 65 |
| Nomes | 10 | 40 | 30 |
Prioridade 0 = não aparece naquele trimestre.

Tokens de tema por trimestre (provisórios, a validar com o design system):
| trimestre | início do anel | fim do anel |
|---|---|---|
| 1 | teal claro | teal |
| 2 | teal | teal escuro |
| 3 | teal escuro | coral |

## Regras de negócio
- RN-01 O trimestre vem de `trimester(ga_days)` (fundação) e muda à meia-noite local. Não existe escolha manual.
- RN-02 A home mostra no máximo 6 cards, os de maior prioridade efetiva. Cards de features sem dados (ex.: medicamentos sem cadastro) mostram o estado vazio com a ação principal.
- RN-03 "Para esta semana": até 3 artigos com `week_from <= semana <= week_to`, ordem `featured desc, position`. Faltando, completa com artigos não lidos do trimestre.
- RN-04 Artigo lido = aberto por pelo menos 20 s ou rolado até 80%. Marca `read_at` e some de "Para esta semana".
- RN-05 Biblioteca: trimestres futuros ficam abertos para leitura. A busca é por texto simples no título e resumo.
- RN-06 Virada de trimestre: no primeiro acesso depois de 14s0d e de 28s0d, mostra a tela uma única vez (`t2_seen_at`, `t3_seen_at`). Números: fotos tiradas, marcos registrados, consultas feitas no trimestre. Push `trimester_turn` no dia da virada às 09:00, uma vez.
- RN-07 Tema: troca com transição de 400 ms na virada. Modo escuro mantém contraste AA.
- RN-08 Sem artigo para a semana, usa os do trimestre; sem nenhum, esconde o card.
- RN-09 Artigo só publica com `reviewed_by` e `reviewed_on`, exibidos no rodapé.
- RN-10 Lançamento com pelo menos 1 artigo por semana (da 4 à 40) mais 6 artigos gerais por trimestre.
- RN-11 `is_premium` é respeitado se algum dia for usado: o free vê o resumo e o paywall. Na v1 todos os artigos são gratuitos.

## Eventos
`home_card_tapped {card, position}`, `article_opened {slug, source}`, `article_read {slug}`, `article_favorited`, `trimester_transition_viewed {to}`, `trimester_transition_cta {target}`.

## Critérios de aceite
- [ ] Na semana 10 a home mostra exames a marcar e medicamentos antes de plano de parto, que nem aparece
- [ ] Na semana 30 o plano de parto e a mala estão no topo
- [ ] Um card cuja ação já foi feita (foto da semana) desce e mostra check
- [ ] "Para esta semana" mostra 3 artigos e o que li sai da lista
- [ ] Na virada para o 2º trimestre vejo a tela de celebração uma única vez
- [ ] Sem internet, leio artigos já abertos e favoritos
- [ ] Conta nova, sem dados, a home mostra anel, artigo da semana e cards de estado vazio, sem buracos
- [ ] Volto depois de 6 semanas e a home já está no trimestre correto e a tela de virada, se perdida, aparece uma vez
- [ ] No modo escuro, o anel e o texto continuam legíveis nos três trimestres

## Decisões em aberto
- Cores finais do anel por trimestre. Decide: Pietro (design system)
- Quem escreve e quem revisa os cerca de 260 artigos de lançamento. Decide: Pietro
