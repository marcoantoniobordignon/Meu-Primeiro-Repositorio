# Lembrete para marcar exames

## Problema
Ela não sabe quando cada exame do pré-natal deve ser feito e descobre tarde que perdeu a janela.

## Escopo desta versão
- Catálogo de exames de referência com janela em semanas gestacionais
- Lista "Meus exames" gerada ao criar a gestação, com estados: a marcar, marcado, feito, dispensado
- Lembretes: janela vai abrir, janela vai fechar, véspera, dia do exame e "como foi?"
- Marcar exame: data, hora opcional e local opcional (aparece no calendário, spec 08)
- Concluir exame anexando o resultado na galeria (spec 01) ou só marcando como feito
- Exame personalizado e outros exames comuns que ela adiciona
- Dispensar exame (o médico não pediu), reversível

## Fora de escopo
- Agendar de verdade em laboratório ou clínica
- Integração com plano de saúde
- Ler o pedido médico por foto
- Preço e cotação

## Telas
1. Meus exames: seções "Agora" (janela aberta), "Próximos", "Marcados", "Feitos", "Anteriores" (janela já fechada), "Dispensados"
2. Detalhe do exame: nome em linguagem simples, para que serve, janela, estado, ações
3. Marcar exame: data, hora, local, observação
4. Adicionar exame: lista "Outros exames comuns" e "Criar o meu"
5. Concluir: "Anexar resultado agora?" (vai para a spec 01) ou "Só marcar como feito"

## Modelo de dados
```
exam_catalog                       -- global, só leitura para usuárias
  code text pk, name text, short_desc text (<=140)
  window_start_day smallint, window_end_day smallint   -- dias desde a DUM
  trimester smallint, doc_kind text, is_default_on bool

user_exams
  id, pregnancy_id fk
  catalog_code text null fk exam_catalog
  custom_name text null (3..60)            -- obrigatório se catalog_code é nulo
  status text not null default 'to_schedule'   -- to_schedule | scheduled | done | dismissed
  window_start_date date null, window_end_date date null
  past_window bool not null default false
  scheduled_at timestamptz null, scheduled_all_day bool default false
  location text null (<=80), notes text null (<=300)
  done_on date null
  document_id uuid null fk medical_documents
  created_at, updated_at
```
Sementes de `exam_catalog` (janelas de referência; `window_end_day` inclui o último dia da semana):
| code | exame | início | fim | padrão |
|---|---|---|---|---|
| us_dating | Ultrassom inicial | 6s0d | 10s6d | sim |
| blood_1 | Exames de sangue do 1º trimestre | 6s0d | 13s6d | sim |
| urine_1 | Urina e urocultura | 6s0d | 13s6d | sim |
| nuchal | Ultrassom de translucência nucal | 11s0d | 13s6d | sim |
| morpho | Ultrassom morfológico | 20s0d | 24s6d | sim |
| ogtt | Curva glicêmica (TOTG) | 24s0d | 28s6d | sim |
| blood_3 | Repetição de exames de sangue | 28s0d | 32s6d | sim |
| urine_3 | Urina e urocultura (repetição) | 28s0d | 34s6d | sim |
| gbs | Cultura para estreptococo B | 35s0d | 37s6d | sim |
| coombs | Coombs indireto | 28s0d | 29s6d | não |
| fetal_echo | Ecocardiograma fetal | 24s0d | 28s6d | não |
| us_growth | Ultrassom de crescimento | 32s0d | 36s6d | não |
| ctg | Cardiotocografia | 36s0d | 40s6d | não |

## Regras de negócio
- RN-01 Ao criar a gestação, gera `user_exams` dos itens `is_default_on`. Janela que terminou antes da criação entra com `past_window=true`, na seção "Anteriores", com a ação "Já fiz".
- RN-02 Janelas são `lmp_date + window_*_day`. Mudar a DUM recalcula as janelas dos exames não concluídos e reagenda os lembretes (fundação RN-F03).
- RN-03 Lembretes de `to_schedule` (09:00 local): 14 dias antes de a janela abrir; 7 dias antes de fechar; 2 dias antes de fechar. Só enviados se o estado continua `to_schedule`.
- RN-04 Lembretes de `scheduled`: véspera às 18:00; 2 horas antes se há hora; no dia seguinte às 10:00, se continua `scheduled`, "Como foi {exame}?" com "Já fiz" e "Remarquei".
- RN-05 No máximo 1 lembrete por exame por dia. Dispensar ou concluir cancela os pendentes.
- RN-06 Marcar exige data, hora opcional. Data fora da janela é permitida com o aviso "fora da janela de referência". Data passada não é permitida em `scheduled`.
- RN-07 `scheduled` aparece no calendário (spec 08) e some se for cancelado ou concluído.
- RN-08 Concluir pergunta "Anexar resultado agora?". Aceitar abre a spec 01 com o tipo preenchido e vincula `document_id`. Recusar permitido.
- RN-09 Exame personalizado: nome obrigatório, janela opcional em semanas, sem lembretes de janela, mas com os de agendamento.
- RN-10 Dispensar é reversível na seção "Dispensados".
- RN-11 Um exame `scheduled` cuja data passou há um dia sem ação gera um card na home: "Seu exame foi ontem?".
- RN-12 O catálogo é orientação geral. Texto fixo: "Calendário de referência. Seu médico define quais exames você precisa e quando."
- RN-13 Tudo é gratuito.

## Eventos
`exam_reminder_sent {code, kind}` (servidor), `exam_reminder_opened {code}`, `exam_scheduled {code, days_to_window_end}`, `exam_marked_done {with_document}`, `exam_dismissed {code}`, `exam_restored`, `exam_custom_added`, `exam_extra_added {code}`.

## Critérios de aceite
- [ ] Crio a gestação na semana 9 e vejo a translucência nucal em "Agora" e o morfológico em "Próximos"
- [ ] Crio a gestação na semana 20 e os exames do 1º trimestre aparecem em "Anteriores" com "Já fiz"
- [ ] Recebo o aviso de 14 dias antes de a janela do morfológico abrir
- [ ] Marco um exame para uma data e ele aparece no calendário e gera lembrete na véspera
- [ ] Concluo um exame, anexo o resultado e o documento fica vinculado
- [ ] Dispenso um exame e os lembretes dele param; restauro e voltam
- [ ] Mudo a DUM e as janelas e os lembretes se ajustam sem duplicar
- [ ] Sem internet, marco um exame e ele sincroniza depois
- [ ] Recém-criada a gestação, a lista nunca está vazia
- [ ] Fico semanas sem abrir e, ao voltar, os exames cuja janela fechou aparecem em "Anteriores" e não como pendentes eternos

## Decisões em aberto
- O catálogo acima precisa de revisão por profissional de saúde antes do lançamento. Decide: Pietro
- Se "Já fiz" em exame anterior exige data ou aceita só marcar. Decidido: aceita só marcar, sem data
