# Direitos da gestante

## Problema
Ela não sabe quais direitos tem na gravidez (trabalho, saúde, parto, benefícios) e só descobre quando já foi desrespeitada.

## Escopo desta versão
- Cartões de direito em formato de pergunta e resposta curta, com a base legal e o que fazer se não respeitarem
- Busca, filtro por tema e favoritos
- Sugestão por fase da gravidez na home
- Compartilhar um cartão como texto
- Canais de ajuda (ligações) em uma tela própria
- Aviso fixo de que não substitui orientação jurídica

## Fora de escopo
- Consultoria ou petição automática
- Cálculo de valores (licença, salário-maternidade)
- Notícias jurídicas e comentários
- Direitos por estado ou município

## Telas
1. Direitos: busca, temas (Trabalho, Saúde, Parto, Pós-parto, Benefícios), "Para esta fase"
2. Cartão: pergunta, resposta curta, detalhes, base legal com link, "Se não respeitarem", favoritar, compartilhar, data da última revisão
3. Onde buscar ajuda: lista de canais com botão de ligar

## Modelo de dados
```
rights_cards
  id, slug text unique
  topic text not null     -- work | health | birth | postpartum | benefits
  question text (<=90), answer text (<=280), details_md text null (<=1500)
  legal_basis text[] not null, legal_links text[]
  what_to_do_md text (<=600)
  week_from smallint null, week_to smallint null
  applies_to text not null default 'mother'   -- mother | partner | both
  position int
  reviewed_by text not null, reviewed_on date not null
  status text default 'draft'

rights_favorites(user_id, card_id, pk both)
help_channels(id, name, phone text null, url text null, description, position, active bool)
```
Cartões de lançamento (base legal a conferir pelo revisor antes de publicar):
| tema | pergunta | base legal |
|---|---|---|
| work | Posso faltar ao trabalho para ir às consultas e exames? | CLT art. 392, §4º, II |
| work | Posso ser demitida durante a gravidez? | ADCT art. 10, II, "b" |
| work | Quanto tempo dura a licença-maternidade? | CF art. 7º, XVIII; CLT art. 392; Lei 11.770/2008 |
| work | Posso mudar de função por causa da gravidez? | CLT art. 392, §4º, I |
| work | Trabalho em local insalubre. E agora? | CLT art. 394-A |
| work | Terei intervalos para amamentar? | CLT art. 396 |
| work | A empresa pode exigir teste de gravidez? | Lei 9.029/1995 |
| work | E a licença do pai ou parceiro? | CF art. 7º, XIX; Lei 11.770/2008 |
| health | O pré-natal é gratuito? | Lei 8.080/1990 |
| health | Posso escolher a maternidade onde vou ter o bebê? | Lei 11.634/2007 |
| health | Posso ter acompanhante no parto? | Lei 11.108/2005 |
| health | Tenho prioridade em filas? | Lei 10.048/2000 |
| health | Meu plano de saúde cobre pré-natal e parto? | Lei 9.656/1998, art. 12 |
| birth | O que é violência obstétrica e como denunciar? | orientações do Ministério da Saúde e leis estaduais; canais de ajuda |
| postpartum | O registro de nascimento é gratuito? | Lei 9.534/1997 |
| postpartum | Quais testes o bebê faz ao nascer? | Lei 14.154/2021 (triagem neonatal) |
| benefits | Não tenho carteira assinada. Tenho salário-maternidade? | Lei 8.213/1991, arts. 71 a 73 |

Canais iniciais: Ligue 180 (Central de Atendimento à Mulher), Disque Saúde 136 (Ouvidoria do SUS), ANS (0800 701 9656), Defensoria Pública do estado. Conferir os números antes de publicar.

## Regras de negócio
- RN-01 Cartão só publica com `legal_basis`, `reviewed_by` e `reviewed_on` (fundação RN-F17).
- RN-02 Cartão com mais de 12 meses desde `reviewed_on` mostra o selo "Conferir atualização" e entra num alerta para o revisor.
- RN-03 "Para esta fase": até 2 cartões na home com `week_from` menor ou igual à semana menor ou igual a `week_to`, ainda não dispensados.
- RN-04 Busca por texto com `to_tsvector('portuguese')` na pergunta e na resposta, mais filtro por tema.
- RN-05 Compartilhar usa a Web Share API com texto: "{pergunta} {resposta} Base legal: {lei}. Via Ninho."
- RN-06 Aviso fixo em todo cartão: "Informação geral, não é orientação jurídica. Em caso de dúvida, procure a Defensoria Pública, o sindicato ou um advogado."
- RN-07 O parceiro vê os cartões `partner` e `both` (licença, acompanhante).
- RN-08 O plano de parto (spec 10) linka direto para os cartões do acompanhante e da maternidade.
- RN-09 Cartão alterado depois de favoritado mostra o selo "Atualizado" por 14 dias.
- RN-10 Todos os cartões e canais ficam em cache para uso offline.
- RN-11 Tudo é gratuito.

## Eventos
`rights_card_opened {slug, source}` (source: search | home | link), `rights_search`, `rights_card_shared`, `rights_favorited`, `rights_help_channel_tapped {channel}`.

## Critérios de aceite
- [ ] Busco "demissão" e acho o cartão de estabilidade com a base legal
- [ ] Abro o cartão e vejo "Se não respeitarem" com passos e o botão "Onde buscar ajuda"
- [ ] Toco em Ligue 180 e o discador abre
- [ ] Na semana 28 a home sugere o cartão do acompanhante
- [ ] Compartilho um cartão e o texto sai com a lei citada
- [ ] Um cartão revisado há mais de 12 meses mostra "Conferir atualização"
- [ ] Sem internet, leio todos os cartões
- [ ] Sem favoritos, a aba mostra "Salve aqui os direitos que mais importam" e atalhos
- [ ] Volto depois de meses e o cartão atualizado aparece com o selo "Atualizado" se eu o tinha favoritado
- [ ] O parceiro vê o cartão da licença-paternidade mas não os cartões só da gestante

## Decisões em aberto
- Revisão jurídica de todos os cartões antes do lançamento e a cada 12 meses. Decide: Pietro
- A legislação de licença-paternidade e de benefícios muda com frequência: conferir a data de revisão no lançamento
- Se o cartão sobre violência obstétrica cita leis estaduais por UF. Decidido: não na v1
