# Cronograma de consultas

## Problema
Ela esquece o que queria perguntar ao médico e perde a conta de quando é a próxima consulta.

## Escopo desta versão
- Cadastro de consultas: data e hora, profissional, tipo, local
- Linha do tempo de consultas futuras e passadas
- Sugestão da próxima data conforme o ritmo comum do pré-natal
- Pauta de perguntas (soltas ou por consulta), inclusive por voz
- Pós-consulta: peso, pressão, altura uterina, batimentos, orientações e retorno
- Lembretes de véspera e de 2 horas antes
- Tela "Levar para a consulta" com o resumo para mostrar ao médico

## Fora de escopo
- Telemedicina e integração com agenda do médico
- Interpretar peso ou pressão, curvas de ganho de peso, alertas clínicos
- Gráficos das medidas
- Prontuário

## Telas
1. Consultas: próxima em destaque, lista de futuras e de passadas
2. Nova consulta ou editar
3. Pauta: perguntas pendentes da próxima consulta, campo para escrever ou ditar
4. Concluir consulta: 3 passos opcionais (medidas, perguntas, orientações e retorno)
5. Levar para a consulta: perguntas pendentes, medicamentos ativos, exames dos últimos 30 dias, últimas medidas, botão compartilhar

## Modelo de dados
```
appointments
  id, pregnancy_id fk
  starts_at timestamptz not null
  kind text not null default 'prenatal'      -- prenatal | ultrasound | other
  provider_name text null (<=80)
  provider_role text null                    -- obstetrician | midwife | nurse | nutritionist | dentist | other
  location text null (<=120)
  status text not null default 'scheduled'   -- scheduled | done | cancelled
  notes_after text null (<=1000)
  created_at, updated_at

appointment_questions
  id, pregnancy_id fk, created_by fk
  appointment_id uuid null fk                -- nulo = "para a próxima consulta"
  text text not null (3..280)
  was_asked bool default false
  answer text null (<=500)
  position int

appointment_measures
  appointment_id uuid pk fk
  weight_kg numeric(5,2) null                -- 30..250
  bp_sys smallint null                       -- 60..260
  bp_dia smallint null                       -- 30..160
  fundal_height_cm numeric(4,1) null         -- 0..60
  fetal_heart_rate smallint null             -- 60..220
```

## Regras de negócio
- RN-01 Nova consulta pede data e hora. Data passada é permitida e cria com `status='done'`.
- RN-02 Pergunta sem consulta (`appointment_id` nulo) aparece na pauta da consulta `scheduled` mais próxima. Ao concluir essa consulta, as perguntas nulas viram vinculadas a ela; as marcadas como feitas ficam com a resposta e as não feitas voltam a ter `appointment_id` nulo, seguindo para a próxima.
- RN-03 Concluir a consulta abre 3 passos, todos opcionais, e muda o `status` para `done`.
- RN-04 Valores fora das faixas do modelo são rejeitados com "Confira o valor". O app não interpreta os valores nem alerta.
- RN-05 Sugestão de retorno ao concluir: calcula a idade gestacional na data da consulta e sugere 28 dias (antes de 28s0d), 14 dias (de 28s0d a 35s6d) ou 7 dias (a partir de 36s0d). Texto: "Ritmo comum no pré-natal. Seu médico pode orientar diferente." Aceitar abre o formulário de nova consulta com a data preenchida.
- RN-06 Lembretes: véspera às 18:00, com a contagem de perguntas pendentes se houver; 2 horas antes. Cancelar ou concluir apaga os pendentes.
- RN-07 No dia seguinte a uma consulta `scheduled` sem conclusão, aparece o card "Como foi a consulta?".
- RN-08 Por voz, a intenção "pergunta para o médico" cria uma pergunta com `appointment_id` nulo, quando a captura por voz estiver disponível.
- RN-09 "Levar para a consulta" é só leitura. O botão compartilhar usa a Web Share API com texto; sem suporte, copia.
- RN-10 Parceiro (permissão `agenda`) vê data, local, profissional e pauta, pode adicionar perguntas (com o autor) e nunca vê medidas nem `notes_after`.
- RN-11 Excluir consulta pede confirmação e apaga medidas; perguntas vinculadas voltam a ser soltas.
- RN-12 Tudo é gratuito.

## Eventos
`appt_created {kind, source}` (source: manual | suggestion), `appt_completed {has_measures}`, `appt_cancelled`, `appt_question_added {source}` (text | voice | partner), `appt_question_asked`, `appt_bring_opened`, `appt_share_tapped`, `appt_reminder_opened`.

## Critérios de aceite
- [ ] Cadastro uma consulta para daqui a 10 dias e recebo o aviso na véspera às 18:00
- [ ] Anoto 3 perguntas e na véspera o aviso diz "3 perguntas na sua pauta"
- [ ] Concluo a consulta, marco 2 perguntas como feitas e a que sobrou aparece na pauta da próxima
- [ ] Registro peso e pressão e eles aparecem na consulta, sem nenhum alerta
- [ ] Na semana 30 o app sugere o retorno para 14 dias depois
- [ ] "Levar para a consulta" mostra perguntas, medicamentos ativos, exames recentes e últimas medidas
- [ ] Sem internet, adiciono uma pergunta e ela sincroniza depois
- [ ] Sem nenhuma consulta, vejo "Cadastre sua próxima consulta" e posso anotar perguntas mesmo assim
- [ ] Fico meses sem abrir e, ao voltar, consultas passadas sem conclusão perguntam "Como foi?" uma única vez cada
- [ ] O parceiro vê a pauta e adiciona uma pergunta, mas não vê peso nem pressão

## Decisões em aberto
- Faixas de validação das medidas (revisão por profissional de saúde). Decide: Pietro
- Gráfico de peso fica para a v2 por exigir curvas de referência e revisão clínica
