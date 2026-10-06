# Foto semanal da barriga

## Problema
Ela quer registrar a barriga crescendo, mas esquece, e as fotos se perdem no rolo da câmera.

## Escopo desta versão
- Uma foto por semana gestacional
- Câmera dentro do app com silhueta fantasma da foto anterior e grade de enquadramento
- Grade de semanas com miniaturas e semanas vazias com "+"
- Substituir a foto da semana
- Timelapse dentro do app e exportação em vídeo
- Compartilhar uma foto individual
- Lembrete semanal e um reforço

## Fora de escopo
- Música e efeitos no vídeo
- Edição de foto (filtros, corte livre)
- Fotos extras na mesma semana
- Fotos do parceiro

## Telas
1. Barriga: grade de semanas (4 a 42), semana atual destacada
2. Câmera: pré-visualização, fantasma ajustável, grade 3x3, virar câmera, disparo
3. Confirmar: foto capturada, legenda opcional, "Usar esta" ou "Refazer"
4. Foto da semana: tela cheia, legenda, substituir, excluir, compartilhar
5. Timelapse: player, velocidade, "Exportar vídeo"

## Modelo de dados
```
belly_photos
  id, pregnancy_id fk, created_by fk
  gest_week smallint not null           -- 4..42, gravada e imutável
  taken_on date not null
  storage_path text not null
  width int, height int
  caption text null (<=100)
  created_at, updated_at
  unique (pregnancy_id, gest_week)
```
Preferências em `profiles.prefs jsonb`: `{belly_ghost_opacity: 0.35, belly_grid: true, belly_reminders: true}`.

## Regras de negócio
- RN-01 Uma foto por semana. Tirar outra na semana preenchida pergunta "Substituir a foto da semana N?". Confirmar apaga a antiga.
- RN-02 A semana da foto é `ga_week(hoje)`. Pela grade, ela pode adicionar foto de semana passada (câmera ou galeria) escolhendo a semana, até a atual. Semana futura não.
- RN-03 Câmera: `getUserMedia` com `facingMode: 'environment'` por padrão e botão para virar; proporção 3:4; grade 3x3 liga e desliga; fantasma com a última foto, opacidade 35% ajustável de 0 a 60%. Sem permissão de câmera ou sem suporte, usa `<input type="file" capture>` e a galeria.
- RN-04 Processamento: máximo 1600 px no maior lado, JPEG 0.85, EXIF removido, orientação aplicada (fundação RN-F10).
- RN-05 Lembrete: no dia da virada de semana gestacional, às 10:00 local, só se não há foto da semana. Se `week_turn` (spec 13) estiver ativo, o lembrete vai embutido nele (fundação RN-F07). Reforço 2 dias depois, às 19:00 (`belly_photo_nudge`), uma vez. Três semanas seguidas sem foto pausam os lembretes e mostram o card "Retomar as fotos?" só dentro do app.
- RN-06 Começa a lembrar a partir da semana 8. Foto antes disso é permitida, sem lembrete.
- RN-07 Timelapse disponível com 3 fotos ou mais, em ordem de semana, 0,4 s por foto (opções 0,2 / 0,4 / 0,8) com "Semana N" no canto.
- RN-08 Exportar vídeo no cliente (canvas + MediaRecorder), formato escolhido pelo primeiro tipo suportado entre `video/mp4;codecs=avc1`, `video/webm;codecs=vp9`, `video/webm`. Free: 720p com marca d'água "Ninho". Premium: 1080p sem marca. Sem formato suportado, mostra "Seu navegador não exporta vídeo. Use o player do app."
- RN-09 Compartilhar foto individual: PNG 1080x1350 com "Semana N", via Web Share API com arquivo; fallback para download. Sem nome do bebê.
- RN-10 Excluir foto pede confirmação e libera a semana.
- RN-11 Parceiro vê a grade só com a permissão `belly_photos` (padrão desligada, spec 12).
- RN-12 Mudar a DUM não altera `gest_week` das fotos já tiradas (a data de cada uma continua em `taken_on`).
- RN-13 Offline: a câmera funciona; a foto entra na fila e sobe depois.

## Eventos
`belly_photo_added {source, replaced, week}`, `belly_photo_deleted`, `belly_reminder_sent {variant}` (servidor), `belly_reminder_opened`, `belly_timelapse_played {photos}`, `belly_video_export_started {tier}`, `belly_video_exported {tier, ok}`, `belly_photo_shared`, `paywall_shown {feature:'belly_video', trigger:'hd_export'}`.

## Critérios de aceite
- [ ] Abro a câmera na semana 22, vejo a silhueta da semana 21, tiro a foto e ela aparece na grade
- [ ] Tiro outra foto na mesma semana e o app pergunta se quero substituir
- [ ] Recebo o lembrete no dia da virada de semana, só se ainda não tirei a foto
- [ ] Com 3 fotos ou mais, assisto ao timelapse e exporto um vídeo com marca d'água no free
- [ ] No premium, o vídeo sai em 1080p sem marca
- [ ] Nego a permissão da câmera e consigo mandar a foto da galeria
- [ ] Sem internet, tiro a foto e ela sobe sozinha depois
- [ ] Sem nenhuma foto, vejo a grade vazia com "Tire a foto da semana N"
- [ ] Volto depois de 2 meses e a grade mostra as semanas puladas vazias, com opção de adicionar foto antiga sem cobrança
- [ ] O arquivo salvo não contém localização (EXIF removido)

## Decisões em aberto
- Fotos extras na mesma semana ficam fora da v1 (uma por semana simplifica grade e vídeo)
- Música no vídeo fica para depois por causa de licenciamento. Decide: Pietro
