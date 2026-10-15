=== Ramal — trens do Rio ===
Contributors: ramal
Tags: trens, rio de janeiro, horários, transporte
Requires at least: 5.8
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 0.5.0
License: GPLv2 or later

Próximos trens, horários, planejador de viagem, vagão certo e avisos dos trens do Rio de Janeiro.

== Descrição ==

O Ramal mostra as estações e os ramais dos trens da região metropolitana do Rio, o primeiro e o último trem publicados pela operadora, um planejador de viagem com baldeações e avisos feitos pelos próprios passageiros.

Use o shortcode `[ramal]` em qualquer página ou post. Opcional: `[ramal height="1000"]`.

O Ramal é um projeto independente, sem vínculo com a operadora dos trens nem com o Governo do Estado.

== Instalação ==

1. Envie o arquivo ramal.zip em Plugins > Adicionar novo > Enviar plugin, e ative.
2. Em Ajustes > Ramal, informe o endereço do servidor Ramal (opcional, mas necessário para relatos, lotação, vagão certo e avisos).
3. Coloque `[ramal]` numa página.

== Perguntas frequentes ==

= Por que preciso de um servidor à parte? =

Os relatos dos passageiros e os avisos ficam num servidor Node. O WordPress não executa esse servidor. Sem ele, o app mostra estações, ramais e horários oficiais, mas sem os recursos colaborativos.

= Os horários são oficiais? =

Estações, ramais, funcionamento e primeiro e último trem vêm do site da operadora. A grade trem a trem não é publicada, então os intervalos no meio são estimados, e o app avisa isso.

== Changelog ==

= 0.5.0 =
* Primeira versão para WordPress: shortcode [ramal], página de ajustes e integração com o servidor externo.
