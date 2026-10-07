# Lista de nomes com votação do casal

## Problema
Escolher o nome gera discussão, e a lista fica solta em notas do celular.

## Escopo desta versão
- Banco de nomes com significado, origem e popularidade
- Descobrir por deslize (curtir e descartar) com filtros
- "Meus nomes": curtidos, descartados e ranking dos 10 favoritos
- Match com o parceiro: aparece só o que os dois curtiram
- Adicionar nome que não está no banco
- Pré-visualizar nome com sobrenomes e ouvir a pronúncia
- Marcar "Este é o nome!" e preencher o nome do bebê no app
- Santo(a) do nome quando o modo fé está ligado

## Fora de escopo
- Enquete aberta com a família
- Nomes de outros idiomas e etimologia detalhada
- Gerar nomes por IA ou por personalidade
- Orientação sobre registro em cartório

## Telas
1. Descobrir: card do nome (significado, origem, popularidade), filtros, botões curtir e descartar, desfazer
2. Detalhe do nome: significado, origem, ouvir, nome com sobrenomes, curtir ou descartar
3. Meus nomes: abas Curtidos, Descartados, Match; arrastar para ranquear até 10
4. Adicionar nome: campo de texto
5. Matches: lista do que os dois curtiram, com "Este é o nome!"

## Modelo de dados
```
names_catalog                           -- global
  id, name text unique, sex_hint text   -- f | m | u
  origin text null, meaning text null (<=160)
  ibge_rank_f int null, ibge_rank_m int null   -- posição por frequência (Censo IBGE)
  syllables smallint
  saint_name text null, saint_day text null     -- 'MM-DD'
  reviewed bool default false

name_votes
  id, pregnancy_id fk, user_id fk
  name_id uuid null fk names_catalog
  custom_name text null (<=40)           -- só letras, espaços e hífen
  vote text not null                     -- like | dislike
  rank smallint null                     -- 1..10, único por (pregnancy_id, user_id)
  created_at, updated_at
  -- check: exatamente um entre name_id e custom_name
  -- unique (pregnancy_id, user_id, coalesce(name_id::text, lower(unaccent(custom_name))))

view name_matches_v(pregnancy_id, name_id, custom_name)
  -- nomes com like de owner e de partner ativos
```
Semente: cerca de 800 nomes (os mais frequentes do Censo IBGE, feminino e masculino) com significado e origem revisados; os demais entram sem significado e com a frase "Significado em breve".

## Regras de negócio
- RN-01 Cada sessão traz 20 cards sorteados entre os nomes ainda sem voto dela, respeitando os filtros (sexo, letra inicial, número de sílabas, origem, popularidade: raro, comum, muito comum). Acabando, mostra "Você viu todos os nomes destes filtros".
- RN-02 Gesto para a direita curte, para a esquerda descarta, toque abre o detalhe, botão "Desfazer" anula o último voto. Há botões equivalentes aos gestos para acessibilidade.
- RN-03 Os votos são editáveis a qualquer hora. Descartados ficam numa aba e podem ser recuperados.
- RN-04 Ranking: até 10 favoritos, `rank` de 1 a 10, único por pessoa.
- RN-05 Match: quando os dois curtem o mesmo `name_id` (ou o mesmo `custom_name` sem acento e sem diferença de maiúscula), cria o match uma vez. Quem curtiu por último vê a animação "Deu match"; o primeiro recebe o push `name_match`.
- RN-06 O parceiro nunca vê os votos da gestante, nem ela os dele. Só os matches são visíveis para os dois.
- RN-07 "Este é o nome!" pede confirmação, grava `pregnancies.baby_name` e abre o marco `name_chosen` do diário (spec 06) para ela escrever. Pode ser desfeito em Ajustes.
- RN-08 Pré-visualização: até 2 sobrenomes digitados na hora (não vêm do perfil), mostrando o nome completo, as iniciais e o número de sílabas. "Ouvir" usa `speechSynthesis` em pt-BR e some se não houver suporte.
- RN-09 Santo(a) do nome e a data só aparecem com `faith_mode` ligado.
- RN-10 Nome próprio adicionado vira voto `like` automaticamente.
- RN-11 O catálogo é baixado uma vez (cerca de 200 KB comprimidos) e fica em cache; votos offline entram na fila.
- RN-12 Tudo é gratuito.

## Eventos
`names_swipe {vote}`, `names_undo`, `names_ranked`, `names_match_created`, `names_chosen`, `names_listen_tapped`, `names_custom_added`. Nunca enviar o nome em si.

## Critérios de aceite
- [ ] Deslizo 20 nomes e curto 5; eles aparecem em Curtidos
- [ ] Filtro por "começa com M" e só vejo nomes com M
- [ ] Desfaço o último voto e ele volta ao baralho
- [ ] Meu parceiro curte o mesmo nome e os dois vemos "Deu match"
- [ ] Ele não vê os nomes que só eu curti
- [ ] Digito "Joaquim", ele é adicionado e conta para o match
- [ ] Toco em "Ouvir" e escuto o nome pronunciado
- [ ] Confirmo "Este é o nome!" e o nome do bebê aparece no app
- [ ] Sem internet, deslizo nomes e os votos sobem depois
- [ ] Sem nenhum voto, vejo "Comece a descobrir nomes" e o baralho já montado
- [ ] Volto depois de meses e meus votos e o ranking estão intactos

## Decisões em aberto
- Fonte e curadoria dos significados e origens dos 800 nomes iniciais. Decide: Pietro
- Santos e datas por nome (calendário romano), somente para nomes tradicionais na v1. Decide: Pietro
