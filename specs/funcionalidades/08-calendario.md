# Calendário

## Problema
Os compromissos da gravidez estão em lugares diferentes e ela precisa de uma visão única.

## Escopo desta versão
- Visão mensal e agenda em lista, com a semana gestacional visível
- Itens vindos das outras features: consultas, exames marcados, medicamentos (resumo diário), foto semanal, DPP
- Eventos próprios: título, data, hora ou dia inteiro, categoria, lembrete
- Cor por tipo de registro
- Exportar um item (.ics) e assinar um feed iCal para o Google ou Apple Calendar

## Fora de escopo
- Importar de calendário externo e sincronização nos dois sentidos
- Convidar outras pessoas
- Eventos recorrentes
- Mais de um calendário e outro fuso

## Telas
1. Mês: grade com pontos coloridos (até 3 por dia e "+"), marcador de virada de semana gestacional, botão "Hoje"
2. Agenda: lista cronológica com cabeçalho "Hoje, 22s3d"
3. Dia: itens do dia com ação para abrir a tela de origem
4. Novo evento ou editar (apenas eventos próprios)
5. Ajustes do calendário: gerar, copiar e revogar o link do feed

## Modelo de dados
```
calendar_events                         -- só eventos próprios
  id, pregnancy_id fk, created_by fk
  title text not null (<=80)
  category text not null default 'other'   -- exam | appointment | course | purchase | other
  starts_at timestamptz null, all_day bool default false, all_day_date date null
  notes text null (<=500)
  remind_offset_minutes int null           -- 0 | 60 | 1440
  visible_to_partner bool default true
  created_at, updated_at

calendar_feed_tokens(id, pregnancy_id fk, token text unique, revoked_at null)

view calendar_items_v(pregnancy_id, item_type, item_id, title, starts_at, all_day, color_key, deep_link)
  -- item_type: appointment | exam | custom | med_day | belly_photo | edd
  -- une appointments (scheduled), user_exams (scheduled), calendar_events, resumo de doses por dia,
  -- a virada de semana sem foto, e a DPP
```
Itens de outras features não são copiados: a view os lê da origem, então não há sincronização.

## Regras de negócio
- RN-01 Mês: até 3 pontos por dia e "+n". Toque no dia abre a lista do dia.
- RN-02 Na virada de semana gestacional aparece o marcador "22s" no dia em que a semana muda. Na agenda, cada cabeçalho de dia mostra a semana e o dia (ex.: "22s3d").
- RN-03 Itens derivados (consulta, exame, DPP, foto, medicamentos) abrem a tela de origem; só eventos `custom` são editáveis aqui.
- RN-04 Medicamentos aparecem como um item por dia, "Medicamentos (n)", que abre a tela Hoje. Em dias passados mostra a adesão do dia.
- RN-05 Foto semanal: marcador no dia da virada de semana; com check se a foto existe.
- RN-06 Evento próprio: título obrigatório; se `all_day`, sem hora; senão a hora é obrigatória. Lembrete: nenhum, na hora, 1 hora antes, 1 dia antes às 09:00. Tipo de aviso `calendar_event`.
- RN-07 A DPP aparece como "Data provável do parto", não editável aqui.
- RN-08 Feed iCal: `{APP_URL}/ics/{token}.ics`, gerado por Edge Function com cache de 15 minutos. Inclui consultas, exames marcados, eventos próprios e DPP. Não inclui medicamentos, fotos nem notas. UID estável por item (`{item_type}-{item_id}@ninho`). Ao gerar, aviso: "Qualquer pessoa com este link vê esses compromissos." Revogar invalida o token e gera um novo.
- RN-09 "Adicionar ao meu calendário" em um item gera um .ics de um evento.
- RN-10 Todas as datas usam `profiles.tz`; dia inteiro usa a data local.
- RN-11 Parceiro (permissão `agenda`) vê consultas, exames marcados, DPP e eventos com `visible_to_partner`, e nunca vê medicamentos nem fotos.
- RN-12 Tudo é gratuito.

## Eventos
`cal_viewed {mode}` (month | agenda), `cal_event_created {category}`, `cal_item_opened {item_type}`, `cal_feed_created`, `cal_feed_revoked`, `cal_item_exported`.

## Critérios de aceite
- [ ] Vejo no mês um ponto colorido nos dias com consulta e exame marcados
- [ ] Crio um evento "Curso de gestantes" às 19:00 com lembrete de 1 hora antes e recebo o aviso
- [ ] Toco numa consulta no calendário e abro a tela da consulta
- [ ] Vejo o marcador de virada de semana nos dias certos
- [ ] Gero o link do feed, assino no Google Calendar e vejo consultas e exames marcados lá
- [ ] Revogo o link e o calendário externo deixa de atualizar
- [ ] Sem internet, vejo o calendário do que já carreguei e crio um evento que sobe depois
- [ ] Sem nada marcado, vejo o mês com a DPP e "Nada marcado. Que tal anotar sua próxima consulta?"
- [ ] Volto depois de meses e o mês aberto é o atual e "Hoje" me leva ao dia certo
- [ ] O parceiro não vê medicamentos nem as fotos da barriga no calendário

## Decisões em aberto
- Recorrência de eventos fica para a v2
- Se o feed deve incluir o título completo das consultas (inclui local e profissional). Decidido: inclui título e local, sem notas. Decide: Pietro
