# FAQ de comidas na gravidez

## Problema
A cada refeição ela duvida se pode comer aquilo e busca em fontes que se contradizem.

## Escopo desta versão
- Base de verbetes (alimento, bebida ou prática) com veredito em semáforo, explicação curta, condição e fonte
- Busca tolerante a acento e erro de digitação
- Navegação por categoria
- Favoritos
- Pergunta nova da usuária quando não acha o item, com voto "eu também quero saber"
- Fila de revisão para um revisor humano responder e publicar
- Aviso à usuária quando a pergunta é respondida

## Fora de escopo
- Leitura de código de barras
- Planos alimentares, calorias, recomendação personalizada
- Comentários e comunidade
- App para nutricionista
- Publicação automática de resposta gerada por IA

## Telas
1. FAQ: campo de busca, categorias, "Mais buscados", favoritos
2. Resultado da busca com semáforo em cada item
3. Verbete: veredito, resposta curta, condição, detalhes, fonte, "Perguntado por N mães", favoritar
4. Perguntar: texto, sugestão de perguntas parecidas, "Eu também quero saber"
5. Admin `/admin/faq` (só `is_reviewer`): perguntas abertas por votos, editor de verbete, publicar, rejeitar com motivo

## Modelo de dados
```
faq_foods
  id, slug text unique, name text, aliases text[]
  category text   -- meat | fish | dairy | fruit_veg | drink | sweet | herb_tea | other
  verdict text not null     -- safe | caution | avoid
  short_answer text (<=200), details text null (<=800), condition_note text null (<=200)
  source_label text not null, source_url text null
  reviewed_by text not null, reviewed_on date not null
  status text not null default 'draft'     -- draft | published | archived
  created_at, updated_at

faq_questions
  id, asked_by fk, text text (3..140), normalized text
  status text default 'open'     -- open | answered | rejected | duplicate
  duplicate_of uuid null, answered_food_id uuid null fk
  reject_reason text null, votes_count int default 1, created_at

faq_question_votes(question_id, user_id, pk both)
faq_favorites(user_id, food_id, pk both)
```
Busca: extensão `pg_trgm` e `unaccent`; índice trigram em `unaccent(lower(name))` e em `aliases`.

Exemplos para a semente inicial (sujeitos à revisão do profissional):
| item | veredito | condição |
|---|---|---|
| Peixe cru (sushi, ceviche) | avoid | risco de contaminação |
| Ovo com gema mole | avoid | só bem cozido |
| Carne mal passada | avoid | só bem passada |
| Queijo de leite cru | avoid | só pasteurizado |
| Queijo minas frescal | caution | só de leite pasteurizado e procedência conhecida |
| Açaí | caution | polpa pasteurizada, de procedência confiável |
| Café | caution | moderação, informar limite de cafeína orientado pelo médico |
| Kombucha | caution | pode ter álcool residual e não ser pasteurizada |
| Peixes grandes com mercúrio (cação, espadarte) | avoid | |
| Bebida alcoólica | avoid | |

## Regras de negócio
- RN-01 Só `published` aparece. Publicar exige `source_label`, `reviewed_by` e `reviewed_on`.
- RN-02 Busca: `lower(unaccent(texto))` contra nome e aliases, similaridade trigram de pelo menos 0,3, ordenação por similaridade, máximo 20 resultados.
- RN-03 Todo verbete mostra o aviso fixo: "Informação geral. Em caso de dúvida, confirme com seu médico ou nutricionista."
- RN-04 Busca sem resultado mostra "Não achei. Perguntar" com o texto já preenchido.
- RN-05 Limite de 5 perguntas por usuária por dia. Texto de 3 a 140 caracteres, com bloqueio de ofensas por lista simples.
- RN-06 Antes de criar, procura perguntas `open` com similaridade de pelo menos 0,6; se houver, mostra "Alguém já perguntou isso" e o botão "Eu também quero saber", que soma 1 voto (um por usuária) em vez de criar duplicata.
- RN-07 Ao publicar um verbete que responde uma pergunta, ela vira `answered`, e cada votante recebe um push `faq_answer` ("Sua pergunta foi respondida: {nome}"), um por pergunta. O verbete mostra "Perguntado por {votes_count} mães".
- RN-08 Rejeitar pede motivo padronizado (fora do escopo, pergunta médica, repetida) e avisa só na central de avisos, sem push.
- RN-09 O revisor é uma pessoa. IA pode gerar rascunho de verbete marcado como `draft`, mas nunca publica.
- RN-10 Favoritos ilimitados. Os favoritos e os 50 verbetes mais buscados ficam em cache para uso offline.
- RN-11 Lançar com pelo menos 120 verbetes revisados, distribuídos em todas as categorias, incluindo itens brasileiros (açaí, pequi, caldo de cana, tapioca, queijo coalho, chá-mate).
- RN-12 Tudo é gratuito.

## Eventos
`faq_search {query_len, results}`, `faq_item_viewed {slug, verdict}`, `faq_favorite_added`, `faq_question_submitted`, `faq_question_voted`, `faq_answer_push_opened`. Nunca enviar o texto da busca nem o da pergunta.

## Critérios de aceite
- [ ] Busco "acai" sem acento e acho "Açaí"
- [ ] Vejo o semáforo, a condição e a fonte no verbete
- [ ] Busco algo que não existe, toco em "Perguntar" e a pergunta é enviada
- [ ] Pergunto algo parecido com uma pergunta aberta e o app me oferece "Eu também quero saber"
- [ ] O revisor publica a resposta e eu recebo o aviso de que foi respondida
- [ ] Favorito um verbete e o encontro offline
- [ ] Sem internet, busco entre os favoritos e os mais buscados; perguntar pede conexão
- [ ] Antes de eu favoritar ou perguntar qualquer coisa, a tela de FAQ mostra categorias e mais buscados, não fica vazia
- [ ] Volto depois de meses e um verbete atualizado aparece com o texto novo
- [ ] Uma pergunta ofensiva é bloqueada

## Decisões em aberto
- Quem revisa os verbetes (nutricionista parceira) e quanto tempo de resposta prometer. Decide: Pietro
- Fontes aceitas (diretrizes do Ministério da Saúde e de sociedades médicas). Decide: Pietro
- Os 10 exemplos acima são ponto de partida, não conteúdo final
