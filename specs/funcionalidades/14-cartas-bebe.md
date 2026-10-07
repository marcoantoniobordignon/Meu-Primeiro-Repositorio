# Cartas para o bebê

## Problema
Ela quer guardar o que sente para o filho ler no futuro, mas não tem onde deixar isso protegido e entregue na hora certa.

## Escopo desta versão
- Escrever carta (texto) e, no premium, anexar áudio de até 5 minutos e 1 foto
- Data de abertura escolhida por regra (1º aniversário, 5, 10, 15 ou 18 anos) ou data própria
- Lacrar: depois de lacrada, nem a autora lê o conteúdo até a data
- No dia, a carta é liberada para a autora e pode ser entregue por link de leitura e por e-mail
- Parceiro pode escrever as próprias cartas
- Exportar cartas já abertas e rascunhos

## Fora de escopo
- Vídeo
- Conta própria para a criança
- Carta que muda de destinatário depois de aberta
- Entrega física impressa
- Carta de terceiros (avós, amigos)

## Telas
1. Cartas: rascunhos, lacradas (só título e data de abertura), abertas
2. Escrever: título, texto, áudio e foto (premium), regra de abertura, destinatário (nome do bebê)
3. Lacrar: confirmação com resumo ("Esta carta só poderá ser lida em 12/03/2027")
4. Carta aberta: leitura, "Entregar a {nome}" (link de leitura e e-mail), exportar
5. Leitura pública `/carta/{token}`: texto, áudio e foto, sem login

## Modelo de dados
```
letters
  id, pregnancy_id fk, author_id fk
  title text not null (<=80)
  body text null (<=5000)
  audio_path text null, audio_seconds smallint null (<=300)
  photo_path text null
  open_rule text null           -- first_birthday | age_5 | age_10 | age_15 | age_18 | custom
  open_on date null             -- calculada; nula em rascunho
  status text not null default 'draft'   -- draft | sealed | opened
  sealed_at, opened_at, unsealed_at timestamptz null
  delivery_email text null
  created_at, updated_at

letter_share_tokens
  id, letter_id fk, token_hash text unique, expires_at timestamptz, revoked_at null, views int default 0
```
Leitura protegida: uma view `letters_visible` devolve título, `open_on` e autor sempre, e `body`, `audio_path` e `photo_path` somente quando `status != 'sealed'` ou quando a carta é um rascunho do próprio autor. Escritas passam por função que valida as regras abaixo.

## Regras de negócio
- RN-01 Carta precisa de título e de texto ou áudio.
- RN-02 Regras de abertura calculam `open_on` a partir de `birth_date`. Enquanto o nascimento não está registrado, usa a DPP como referência e recalcula ao registrar o nascimento. `custom`: de hoje + 180 dias até hoje + 30 anos.
- RN-03 Lacrar exige `open_on`, confirmação e muda para `sealed`. Lacrada, o conteúdo some das telas da autora e da API; ela vê só título e data de abertura.
- RN-04 Desfazer o lacre é permitido com confirmação dupla ("Quer mesmo abrir antes da hora?"); volta a rascunho e grava `unsealed_at`.
- RN-05 Job diário às 06:00 local: cartas `sealed` com `open_on` menor ou igual a hoje (no fuso da autora) viram `opened`. A autora recebe push `letter_open` e e-mail "A carta '{título}' pode ser aberta hoje". Se há `delivery_email`, ele recebe um e-mail com o link de leitura.
- RN-06 Link de leitura: token de 32 bytes (só o hash é guardado), validade de 30 dias, revogável, página `noindex`, sem nenhum dado da gestação além da carta.
- RN-07 Free: 2 cartas por autor, só texto. Premium: ilimitadas, áudio e foto. Cartas existentes sobrevivem ao downgrade.
- RN-08 Excluir carta pede confirmação, é definitivo e apaga áudio e foto. Carta lacrada pode ser excluída sem ser lida.
- RN-09 Cada autor só vê as próprias cartas. O parceiro escreve as dele e a gestante nunca as vê, e vice-versa.
- RN-10 Exportar (ZIP com texto, áudio e foto) vale para rascunhos e cartas abertas, nunca para o conteúdo das lacradas.
- RN-11 E-mail anual no aniversário do nascimento para quem tem cartas lacradas: "Suas cartas para {nome} estão guardadas", para manter o contato atualizado. Cancelável.
- RN-12 O áudio usa o mesmo gravador do diário (limite de duração diferente).

## Eventos
`letter_draft_created`, `letter_sealed {open_rule, has_audio}`, `letter_unsealed`, `letter_opened` (servidor), `letter_share_link_created`, `letter_delivery_email_sent` (servidor), `letter_exported`, `paywall_shown {feature:'letters', trigger:'letter_limit'}`.

## Critérios de aceite
- [ ] Escrevo uma carta, escolho "1º aniversário" e a lacro; ela passa a mostrar só o título e a data
- [ ] Tento ler a carta lacrada e o conteúdo não aparece nem na rede
- [ ] Desfaço o lacre passando pelas duas confirmações e a carta volta a rascunho
- [ ] No dia da abertura recebo o push e o e-mail e consigo ler
- [ ] Gero o link de leitura, abro numa janela anônima e leio; revogo e o link para de funcionar
- [ ] No free, ao criar a 3ª carta vejo o paywall
- [ ] Sem internet, escrevo um rascunho e ele sincroniza depois; lacrar exige conexão
- [ ] Sem cartas, vejo "Escreva a primeira carta para {nome}" e o botão
- [ ] Registro o nascimento e a data de "1º aniversário" é recalculada
- [ ] Um ano depois recebo o e-mail anual dizendo que as cartas estão guardadas

## Decisões em aberto
- Garantia de longo prazo (a carta pode abrir 18 anos depois): se o app deixar de existir, o ZIP é a salvaguarda; oferecer exportação periódica. Decide: Pietro
- Provedor de e-mail transacional. Decide: Pietro
- Limite free de 2 cartas (reversível). Decide: Pietro
