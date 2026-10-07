# Medicamentos da mãe

## Problema
Ela precisa lembrar de vários remédios e suplementos em horários diferentes e não tem como mostrar ao médico o que de fato tomou.

## Escopo desta versão
- Cadastro de medicamento: nome, dose (texto livre), orientação (texto livre), frequência, horários, início e fim
- Frequências: horários fixos no dia (1 a 4), a cada N horas, dias da semana, "se necessário" (sem lembrete)
- Lembrete por push com ação "Tomei" e "Adiar"
- Tela Hoje com as doses do dia e seus estados
- Registro retroativo de até 7 dias
- Adesão dos últimos 7 e 30 dias e sequência de dias
- Registro por voz ("tomei o ferro") quando a captura por voz estiver disponível
- Compartilhar a lista de medicamentos ativos como texto

## Fora de escopo
- Sugerir remédio, suplemento ou dose
- Interações medicamentosas e bula
- Ler receita por foto
- Controle de estoque
- Medicamentos do bebê
- Alarme sonoro nativo (limitação do PWA)

## Telas
1. Hoje: doses do dia em ordem, cada uma com estado e botão "Tomei"
2. Meus medicamentos: ativos e arquivados
3. Cadastro e edição de medicamento
4. Sheet de confirmação da dose (horário real, "Tomei", "Pular")
5. Adesão: barras dos últimos 7 e 30 dias e sequência atual

## Modelo de dados
```
medications
  id, pregnancy_id fk
  name text not null (<=80)
  dose text null (<=40)
  instructions text null (<=120)
  schedule_type text not null        -- fixed_times | interval | weekdays | as_needed
  times time[] null                  -- horário local; fixed_times e weekdays
  interval_hours smallint null       -- 4..24 (interval)
  interval_anchor time null          -- primeira dose do dia (interval)
  weekdays smallint[] null           -- 0=domingo .. 6=sábado
  starts_on date not null default local_today
  ends_on date null
  is_active bool not null default true
  color_key text not null
  created_at, updated_at

medication_doses
  id, medication_id fk
  scheduled_at timestamptz null      -- null em as_needed
  status text not null default 'pending'   -- pending | taken | skipped | missed
  taken_at timestamptz null
  source text null                   -- push | app | voice | backfill
  unique (medication_id, scheduled_at)
```
Materialização: job diário gera as doses dos próximos 7 dias. Ao editar o medicamento, apaga as doses `pending` futuras e regenera. Doses com estado final (`taken`, `skipped`, `missed`) nunca são alteradas.

## Regras de negócio
- RN-01 Nome é obrigatório. O app não sugere dose. Texto fixo no cadastro: "Anote exatamente o que seu médico receitou. O app só lembra e registra."
- RN-02 O campo nome tem autocompletar com uma lista curta de nomes comuns, sem dose e sem recomendação. Nome livre sempre permitido.
- RN-03 Horários são em hora local de `profiles.tz`. Se o fuso mudar, as doses `pending` futuras são recalculadas mantendo o horário local.
- RN-04 Lembrete na hora marcada. Sem resposta, um único reforço 30 minutos depois. Passadas 2 horas do horário, a dose pendente vira `missed` (rótulo "Sem registro").
- RN-05 "Adiar" empurra 15 minutos, no máximo 2 vezes por dose.
- RN-06 "Tomei" grava `taken_at` agora; a usuária pode ajustar o horário real no sheet. No iPhone não há botões na notificação: o toque abre direto o sheet de confirmação.
- RN-07 "Pular" conta como registrada (não vira `missed`) e não conta como tomada na adesão.
- RN-08 Registro retroativo permitido até 7 dias atrás.
- RN-09 Adesão = tomadas / (tomadas + puladas + sem registro) das doses cujo horário já passou na janela. `as_needed` fica fora do cálculo.
- RN-10 Sequência = dias consecutivos com 100% das doses do dia tomadas. O dia de hoje só entra ao terminar. Dia sem dose programada não quebra a sequência.
- RN-11 Free: 3 medicamentos ativos. O 4º abre o paywall. Premium ilimitado. Ao passar de `ends_on`, o medicamento vira inativo sozinho.
- RN-12 Por voz: normaliza o nome (minúsculas, sem acento) e compara com os medicamentos ativos. Um único acerto registra a dose pendente mais próxima de agora e mostra "Desfazer" por 5 segundos. Zero ou vários acertos abre o sheet para escolher.
- RN-13 `med_dose` ignora o horário silencioso e o limite diário (ver fundação). Respeita `notifications_suspended`.
- RN-14 Parceiro nunca vê medicamentos.
- RN-15 Desligar o lembrete de um medicamento mantém o registro manual das doses.

## Eventos
`med_added {schedule_type}`, `med_dose_taken {source, minutes_late}`, `med_dose_skipped`, `med_dose_snoozed`, `med_dose_missed` (servidor), `med_adherence_viewed`, `med_voice_logged {matched}`, `med_list_shared`, `paywall_shown {feature:'medications', trigger:'active_limit'}`.

## Critérios de aceite
- [ ] Cadasto um remédio às 08:00 e 20:00 e recebo os dois lembretes nos horários
- [ ] Toco em "Tomei" na notificação (Android) ou abro o sheet (iPhone) e a dose fica registrada
- [ ] Adio uma dose duas vezes e a terceira tentativa não é oferecida
- [ ] Ignoro uma dose por mais de 2 horas e ela aparece como "Sem registro"
- [ ] Registro uma dose esquecida de anteontem e a adesão se atualiza
- [ ] Digo "tomei o ferro" e a dose do ferro é marcada, com opção de desfazer
- [ ] No free, ao cadastrar o 4º medicamento, vejo o paywall e os 3 existentes seguem funcionando
- [ ] Sem internet, marco "Tomei" e o registro sobe sozinho depois, com o horário real
- [ ] Sem nenhum medicamento, vejo "Cadastre o primeiro lembrete" com o botão
- [ ] Fico 10 dias sem abrir e, ao voltar, as doses antigas aparecem como "Sem registro", sem avalanche de avisos
- [ ] Com notificações em modo discreto, o texto do push não mostra o nome do remédio

## Decisões em aberto
- Lista de nomes do autocompletar: curadoria própria de cerca de 30 nomes comuns, sem dose. Decide: Pietro
- Limite free de 3 medicamentos (reversível). Decide: Pietro
- Se o texto do push de medicamento deve ser discreto por padrão. Decide: Pietro
