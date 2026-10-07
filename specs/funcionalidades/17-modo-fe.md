# Modo fé (católico)

## Problema
Para muitas gestantes católicas, a fé é parte central da gravidez e os apps não acolhem isso.

## Escopo desta versão
- Chave "Modo fé" no onboarding e em Ajustes, que liga e desliga sem perda de dados
- Oração da semana (40) no card da home e na tela da semana
- Biblioteca de fé: orações fixas, intercessores (santos e devoções) e texto de bênção
- Marcos de diário com perguntas de fé
- Santo(a) do nome (spec 15)
- Lista de preparação para o batismo depois do nascimento, com um lembrete
- Link para o Verbum

## Fora de escopo
- Terço guiado com áudio
- Liturgia diária (fica no Verbum, por link)
- Comunidade de oração e intenções compartilhadas
- Outras confissões religiosas
- Agendar sacramentos com paróquias
- Calendário litúrgico dentro do calendário do app

## Telas
1. Onboarding: pergunta "Quer incluir conteúdo de fé católica?" com Sim, Não e Decidir depois (sem opção pré-selecionada)
2. Home: card "Oração da semana" quando ligado
3. Biblioteca de fé: abas Orações, Intercessores, Bênção; leitura com fonte ajustável (16 a 28 px); favoritar; compartilhar
4. Batismo: checklist (usa as listas do plano de parto)
5. Ajustes: chave do modo fé e "Receber a oração da semana no push" (desligado)

## Modelo de dados
```
profiles.faith_mode bool              -- fundação; padrão false
faith_prayers
  id, slug text unique
  kind text not null    -- weekly | fixed | intercessor | blessing
  title text, body text (<=1200)
  week smallint null    -- 1..40 para weekly
  saint_name text null, saint_day text null     -- 'MM-DD'
  source_label text not null
  reviewed_by text not null, reviewed_on date not null
  position int, status text default 'draft'
-- batismo reutiliza birth_checklist_items com list='baptism' (spec 10)
```
Orações e intercessores de lançamento (textos a redigir e revisar): Oração da gestante, Consagração do bebê a Nossa Senhora, Oração antes do parto, Ação de graças depois do parto, Ave-Maria, Magnificat, Nossa Senhora do Bom Parto, São Gerardo Majella (patrono das gestantes, 16/10), Santa Gianna Beretta Molla (28/04), São José (19/03), texto de bênção (aviso: "Texto de oração. A bênção litúrgica é dada pelo sacerdote.").

Itens de `baptism` (criados no registro do nascimento com o modo ligado): Conversar com a paróquia, Escolher os padrinhos, Definir a data, Confirmar com a paróquia os documentos exigidos, Roupa e vela de batismo, Convidar a família.

## Regras de negócio
- RN-01 `faith_mode` começa em `false`. No onboarding não há opção pré-selecionada; "Decidir depois" mantém `false`.
- RN-02 Ligar mostra o card da oração da semana (posição 3 em todos os trimestres) e a seção "Fé" no menu. Desligar oculta tudo na hora e preserva favoritos e entradas.
- RN-03 Oração da semana = `faith_prayers` com `kind='weekly'` e `week = min(ga_week, 40)`. Lançar com as 40 orações revisadas.
- RN-04 Orações fixas e intercessores ficam na biblioteca com busca, favoritos e modo leitura.
- RN-05 Todo texto tem `source_label` e revisão (`reviewed_by`, `reviewed_on`) por pessoa de formação católica.
- RN-06 Diário (spec 06): com o modo ligado, marcos usam `prompt_text_faith` quando existir e o marco `first_prayer` aparece.
- RN-07 Ao registrar o nascimento com o modo ligado, cria os 6 itens de `baptism`. Push único `faith_baptism_nudge` aos 14 dias do nascimento às 10:00: "Quando pensar no batismo?".
- RN-08 O push semanal da oração só existe se a usuária ligar em Ajustes, e vai embutido no `week_turn`.
- RN-09 Card "Leia o Evangelho do dia no Verbum" na biblioteca, com link e UTM; o Verbum é um app separado e não compartilha conta.
- RN-10 Religião é dado pessoal sensível: nenhum evento do modo fé vai ao GA4 nem leva `user_id`. Métricas só em `anon_counters` (dia, chave, contagem): `faith_on`, `faith_off`, `prayer_viewed`, `library_opened`, `verbum_link_tapped`.
- RN-11 Cache offline de todas as orações.
- RN-12 Tudo é gratuito.

## Eventos
Sem eventos de analytics de terceiros. Contadores anônimos listados em RN-10.

## Critérios de aceite
- [ ] No onboarding vejo a pergunta de fé sem nenhuma resposta marcada
- [ ] Ligo o modo e a home mostra a oração da semana atual
- [ ] Desligo e tudo some; ligo de novo e meus favoritos estão lá
- [ ] Na biblioteca leio uma oração com fonte grande e a favorito
- [ ] Vejo o aviso de que a bênção litúrgica é dada pelo sacerdote
- [ ] Com o modo ligado, o diário oferece "Primeira oração pelo bebê"
- [ ] Registro o nascimento e a lista de batismo aparece; 14 dias depois recebo o lembrete
- [ ] Sem internet, leio as orações
- [ ] Recém-ligado o modo, a biblioteca nunca está vazia
- [ ] Volto depois de meses e a oração mostrada é a da semana atual (ou a 40, se passou)
- [ ] Nenhuma requisição ao GA4 contém dado do modo fé

## Decisões em aberto
- Tradução bíblica usada nos textos (reaproveitar a base do Verbum). Decide: Pietro
- Quem revisa as orações (padre ou teólogo). Decide: Pietro
- Se haverá também a oração do pai (parceiro) na v2
