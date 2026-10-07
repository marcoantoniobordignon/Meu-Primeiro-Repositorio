# Diário de grávida

## Problema
Os primeiros momentos da gravidez passam rápido e ela não tem onde registrar o que sentiu.

## Escopo desta versão
- Entradas com texto, áudio (até 3 minutos) e até 3 fotos
- Marcos guiados com pergunta pronta, que aparecem na semana certa
- Entrada livre a qualquer hora
- Ditado por voz no campo de texto
- Linha do tempo com filtro por marco e busca por texto
- Entradas do parceiro e marcação de entradas para o parceiro ler
- Alimenta a retrospectiva (spec 07)

## Fora de escopo
- Bloqueio do diário por PIN ou biometria
- Vídeo
- Modelos de página, adesivos, formatação rica
- Importar de outros apps
- Compartilhar publicamente

## Telas
1. Diário: linha do tempo, card do próximo marco no topo, botão "+ Escrever", busca
2. Marco: pergunta, campo de texto com microfone, botão de áudio, fotos, data, "Salvar", "Pular", "Mais tarde"
3. Entrada livre: mesmo editor sem pergunta
4. Entrada: leitura, editar, excluir, "Compartilhar com meu parceiro" (liga e desliga)
5. Marcos: lista de todos os marcos com o estado de cada um

## Modelo de dados
```
diary_entries
  id, pregnancy_id fk, author_id fk
  kind text not null                     -- free | milestone
  milestone_code text null fk milestone_catalog
  body text null (<=5000)
  entry_date date not null default local_today
  audio_path text null, audio_seconds smallint null (<=180)
  shared_with_partner bool default false
  created_at, updated_at
  -- check: body, audio_path ou ao menos uma foto presente
  -- unique (pregnancy_id, author_id, milestone_code) quando milestone_code não é nulo

diary_photos(id, entry_id fk, position smallint (1..3), storage_path)

milestone_catalog                         -- global
  code pk, title, prompt_text, prompt_text_faith text null
  faith_only bool default false
  window_start_week smallint null, window_end_week smallint null
  push_on_open bool default false, position int
```
Sementes de `milestone_catalog`:
| code | título | janela (semanas) | push |
|---|---|---|---|
| discovery | Quando descobri | agora | sim (2 dias depois do cadastro, se vazio) |
| told_partner | Contei para quem amo | 5 a 14 | não |
| first_ultrasound | Primeiro ultrassom | 6 a 12 | não |
| heartbeat | Ouvi o coração | 6 a 12 | não |
| belly_shows | A barriga apareceu | 12 a 20 | não |
| sex_known | Descobri o sexo | 14 a 22 | sim |
| first_kick | Primeiro chute | 16 a 24 | sim |
| name_chosen | Escolhemos o nome | 16 a 36 | não |
| baby_shower | Chá de bebê | 28 a 36 | não |
| bag_ready | A mala ficou pronta | 34 a 38 | não |
| feelings_before | Como estou me sentindo | 36 a 41 | não |
| first_prayer | Primeira oração pelo bebê | 5 a 20 | não (`faith_only`) |

## Regras de negócio
- RN-01 A entrada precisa de texto, áudio ou foto.
- RN-02 Um marco por autor: reabrir o marco edita a entrada existente.
- RN-03 O card do marco aparece quando a semana atual entra na janela e fica até ela responder, pular ou passarem 4 semanas do fim da janela. "Pular" some de vez. "Mais tarde" some por 3 dias. Marcos `faith_only` só aparecem com `faith_mode` ligado, e `prompt_text_faith` substitui `prompt_text` quando existir e o modo estiver ligado.
- RN-04 Push só nos marcos com `push_on_open`, um por marco, tipo `diary_milestone`. Os demais só aparecem como card.
- RN-05 Áudio: `MediaRecorder` (audio/mp4 no Safari, audio/webm no Chrome), 64 kbps, máximo 180 segundos. O microfone do campo de texto usa o mesmo componente de transcrição da captura por voz; se falhar, grava só o áudio.
- RN-06 Free: texto e fotos sem limite, até 10 entradas com áudio. A 11ª entrada com áudio abre o paywall e salva o texto sem o áudio se a usuária escolher.
- RN-07 A data da entrada não pode ser futura. A semana exibida é calculada pela data.
- RN-08 Editar é livre. Excluir pede confirmação, é definitivo e apaga áudio e fotos.
- RN-09 Parceiro (spec 12) só vê entradas com `shared_with_partner=true`. Entradas escritas por ele aparecem sempre para a gestante, com o rótulo "Escrito por {nome}", e só ele as edita.
- RN-10 Busca por texto simples (`ilike` normalizado) nas entradas da própria usuária.
- RN-11 Offline: texto é salvo localmente e sincroniza; áudio entra na fila.
- RN-12 Cartas para o bebê (spec 14) são outra coisa e não aparecem no diário.

## Eventos
`diary_entry_created {kind, milestone_code, has_audio, photos, source}` (source: text | dictation), `diary_milestone_shown {code}`, `diary_milestone_skipped {code}`, `diary_milestone_snoozed {code}`, `diary_entry_shared_partner`, `diary_search_used`, `paywall_shown {feature:'diary', trigger:'audio_limit'}`.

## Critérios de aceite
- [ ] Na semana 17 vejo o card "Primeiro chute", escrevo, anexo uma foto e ele vira uma entrada com data e semana
- [ ] Toco em "Mais tarde" e o card volta em 3 dias; em "Pular" e ele não volta
- [ ] Ditou um texto pelo microfone e o texto aparece editável no campo
- [ ] Gravo um áudio de 1 minuto e consigo ouvir na entrada
- [ ] No free, na 11ª entrada com áudio, vejo o paywall e nada se perde
- [ ] Marco uma entrada para o parceiro e ele a vê; as outras ele não vê
- [ ] Escrevo sem internet e o texto sobe sozinho depois
- [ ] Sem nenhuma entrada, vejo "Registre como foi descobrir a gravidez" e o botão
- [ ] Volto depois de 2 meses e marcos antigos ainda abertos aparecem como cards, no máximo 3 de cada vez, sem enxurrada de avisos
- [ ] Com o modo fé ligado, vejo o marco "Primeira oração pelo bebê" e a pergunta com o texto de fé

## Decisões em aberto
- Limite free de 10 entradas com áudio (reversível). Decide: Pietro
- Bloqueio por PIN fica fora da v1
- Texto final das perguntas de cada marco (revisão editorial). Decide: Pietro
