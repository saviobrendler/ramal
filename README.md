# Ramal — trens do Rio de Janeiro

**[Acessar o Ramal](https://ramal-l9ye.onrender.com/)** · projeto independente, sem vínculo com a operadora dos trens nem com o Governo do Estado.

Próximos trens por estação, rotas com baldeação, horários oficiais publicados pela operadora, mapa com posição estimada dos trens e avisos feitos pelos próprios passageiros. Funciona no navegador do celular e pode ser instalado como app.

Site para acompanhar os trens metropolitanos do Rio de Janeiro: próximas chegadas por estação, ramais, grade de horários e planejador de viagem com baldeações.

## Rodar

```
npm install
npm start
```

Abra http://localhost:5173. Sem GTFS importado nem tempo real, o site roda em **modo demonstração** (dados aproximados e atrasos simulados).

## Horários oficiais (GTFS)

1. Baixe o GTFS e descompacte numa pasta.
2. Importe:
   ```
   node tools/import-gtfs.js caminho/da/pasta --source="Nome da fonte"
   ```
   Isso gera `gtfs-data.js`. O site passa a usar os ramais, estações e viagens do GTFS automaticamente.

Por padrão só entram rotas ferroviárias (`route_type=2`); use `--route-type=all` se o feed classificar diferente. Plataformas são agrupadas pela `parent_station`. Os tipos de dia (útil/sábado/domingo) vêm do `calendar.txt`.

Para apagar a importação e voltar à demonstração, apague `gtfs-data.js`.

## Tempo real

O `server.js` consulta a fonte a cada 30 s e entrega `/api/realtime` ao site. Configure por variável de ambiente ou argumento:

```
node server.js --rt-url=https://exemplo/tripupdates.pb --rt-format=gtfs-rt --rt-source="Nome"
```

| Opção | Uso |
|---|---|
| `RT_URL` / `--rt-url` | URL (ou arquivo local) do feed |
| `RT_FORMAT` | `gtfs-rt` (TripUpdates protobuf) ou `json` |
| `RT_HEADERS` | cabeçalhos extras em JSON, ex. chave de API |
| `RT_SOURCE` | nome exibido no site |
| `RT_INTERVAL` | segundos entre consultas (padrão 30) |

Formato `json`: `{"delays": {"<trip_id>": <segundos>}}` ou `[{"trip_id": "...", "delay": <segundos>}]`.

Os `trip_id` do feed precisam ser os mesmos do GTFS importado. Se a fonte parar de responder por mais de 5 min, o site volta a mostrar o horário programado.

## Testar sem dados oficiais

```
node tools/make-sample-gtfs.js
node tools/import-gtfs.js sample-gtfs --source="GTFS de teste"
node server.js --rt-url=sample-realtime.json --rt-format=json --rt-source="feed de teste"
```

Gera um GTFS e um feed de tempo real **de teste** a partir dos dados de demonstração. Não são dados reais. Apague `gtfs-data.js` depois.

## Relatos dos passageiros

Os passageiros relatam pelo app: trem passou (mede atraso), lotação, trem parado, ar-condicionado, melhor vagão para sair/baldear e acessibilidade da estação (elevador, escada rolante, rampa, vão). Isso alimenta:

- **Lotação prevista** nos cartões de trem e nas rotas (média dos relatos por ramal, sentido e faixa de 30 min; por estação quando há 3+ relatos).
- **Vagão certo** por estação e sentido, e dica de vagão no passo a passo da rota.
- **Acessibilidade** por estação (maioria dos últimos 7 relatos; empate = o mais recente).
- **Alerta de trem parado** quando 2 pessoas em redes diferentes (ou 3 dispositivos) relatam no mesmo ramal em 30 min.
- **Pontualidade** por ramal (aba Avisos): % de trens até 5 min de atraso, atraso médio, pior horário.

Os relatos ficam em um banco SQLite, `data/community.db` (mude com `COMMUNITY_FILE` ou `--community-file`). Se existir o antigo `data/community.json`, ele é importado uma vez e renomeado para `.migrado`. Não há login: cada navegador gera um id anônimo, e o servidor limita a 40 relatos por hora por dispositivo. Relatos feitos sem internet ficam na fila e são enviados quando a conexão volta.

Para testar com dados falsos:

```
npm run seed-test
node server.js --community-file=data/community-teste.db
```

## Avisos de segurança

- **Avisos manuais:** copie `alerts.example.json` para `alerts.json` e edite (obras, paralisações). O arquivo é relido sozinho.
- **Tiroteios (Fogo Cruzado):** cadastre-se em https://api.fogocruzado.org.br/sign-up e defina `FOGO_CRUZADO_EMAIL` e `FOGO_CRUZADO_PASSWORD`. O servidor consulta a API a cada 5 min e avisa sobre ocorrências das últimas 3 h a até 1 km de uma estação. As coordenadas das estações vêm de `stations-geo.json` (gere com `node tools/fetch-station-coords.js`, dados do OpenStreetMap; 9 estações faltam e podem ser completadas à mão). A integração ainda não foi testada com credenciais reais.

## Offline (PWA)

O site pode ser instalado como app (`manifest.webmanifest`) e funciona sem internet: horários, planejador e ramais ficam em cache (`sw.js`), e a última resposta de avisos/estação é reaproveitada. Ao publicar uma versão nova, mude `?v=` no `index.html` e `VERSION` no `sw.js`.

## Dados oficiais publicados pela TrensRJ

`node tools/fetch-trensrj.js` lê as páginas públicas das 104 estações em trensrj.com.br (o robots.txt libera; uma página por vez, com pausa) e gera `oficial-data.js` (usado pelo site) e `data/trensrj-oficial.json`. Para cada estação o app passa a mostrar:

- ramais que atendem a estação e horário de funcionamento (dias úteis, sábado, domingo);
- **primeiro e último trem por destino e tipo de dia**, como publicados pela operadora;
- serviços listados (elevador, banheiro, caixa eletrônico, Wi-Fi, bicicletário).

Limites do que a operadora publica:

- **Não há grade trem a trem pública.** Os horários entre o primeiro e o último trem são estimados (intervalos aproximados). O app avisa isso na tela.
- **Elevador:** a lista oficial mostra só se a estação tem. Não diz se está funcionando, então isso continua sendo informado pelos passageiros.
- **Escada rolante:** nenhuma estação aparece com esse serviço na lista oficial.
- **Vagão certo:** não há dado público. Só os passageiros podem informar.
- Nomes da rede de demonstração foram alinhados aos oficiais (ex.: "Mangueira" → "Mangueira/Jamelão"). Estações que não existem no site (Encantado, Magno, Engenheiro Belford) foram retiradas. Das 104 estações oficiais, 87 estão na rede desenhada no app; as demais aparecem só nos dados brutos.
- Mangueira/Jamelão e Mocidade Padre Miguel não têm horários publicados.
- O planejador de viagem do site da operadora usa uma API interna, que não foi usada aqui.

## Moderação

Defina ADMIN_TOKEN (segredo longo) e a moderação fica ligada. Todas as chamadas exigem Authorization: Bearer <token>:

- GET /api/admin/reports?limit=100: relatos mais recentes, com id e dispositivo.
- POST /api/admin/hide com {"id": 123}: oculta um relato das estatísticas.
- POST /api/admin/block com {"dev": "...", "reason": "..."}: apaga os relatos do dispositivo e recusa novos envios.
- POST /api/admin/unblock com {"dev": "..."}.

Sem ADMIN_TOKEN, esses endpoints respondem 404.

## Testes e atualização

- 
pm test: 15 testes dos relatos (validação, votos, limite, moderação, alertas, persistência e migração).
- 
pm run update-data: baixa de novo as estações e horários oficiais. Rode uma vez por semana.
- 
pm run seed-test: cria dados falsos num banco separado, para ver as telas cheias.

## Publicação no Render (grátis)

O arquivo `render.yaml` e o `Dockerfile` já estão prontos. Passo a passo:

1. Crie uma conta gratuita em github.com e um repositório **privado** chamado `ramal`. Envie os arquivos desta pasta (sem `node_modules` e sem `data/`; o `.gitignore` já cuida disso).
2. Crie uma conta em render.com, conecte o GitHub e escolha **New > Blueprint**, apontando para o repositório. O Render lê o `render.yaml` e cria o serviço `ramal`.
3. Depois do primeiro deploy, abra o serviço, vá em **Environment** e copie o valor de `ADMIN_TOKEN` (gerado automaticamente). Ele é a senha da moderação.
4. O endereço fica como `https://ramal.onrender.com` (ou outro nome livre). Teste `/api/health` e abra o site no celular.

Limites do plano gratuito, que você precisa saber:

- **Relatos somem:** o disco é temporário. Ao reiniciar ou reimplantar, o banco de relatos é apagado. Horários, estações e avisos oficiais continuam, porque vêm dos arquivos do projeto.
- **Demora ao acordar:** sem acessos por cerca de 15 minutos, o serviço "dorme", e a primeira abertura leva uns 30 segundos.
- **Domínio:** o endereço `onrender.com` é grátis. Para um domínio próprio, confira se o plano gratuito aceita; um `.com.br` custa cerca de R$ 40 por ano.

Para ter relatos persistentes, troque para o plano pago com disco (`disk` no `render.yaml`) ou para outro serviço com volume.

Teste local com o Docker, se você tiver o Docker instalado:

    docker build -t ramal .
    docker run -p 5173:5173 -e ADMIN_TOKEN=troque-este-segredo ramal
Um pedido formal à operadora por grade horária e dados abertos está em [docs/pedido-grade-horaria.md](docs/pedido-grade-horaria.md), pronto para enviar.
## Situação das fontes (outubro de 2026)

- Não há GTFS público dos trens metropolitanos do Rio. O GTFS da Prefeitura (dados.mobilidade.rio) cobre ônibus e BRT, não trens.
- Não há API pública de posição/atraso dos trens.
- A operação passou da SuperVia para a nova concessionária em 29/05/2026. Os dados oficiais precisam ser pedidos à operadora ou à Secretaria de Estado de Transportes.

## Arquivos

- `data.js`: ramais de demonstração; troca pelos do GTFS quando existir `gtfs-data.js`
- `schedule.js`: viagens, posição dos trens, painel de chegadas, rotas (Connection Scan) e aplicação do tempo real
- `app.js`, `community.js`, `index.html`, `styles.css`: interface
- `sw.js`, `manifest.webmanifest`, `icons/`: app instalável e modo offline
- `server.js`: site + API (`/api/realtime`, `/api/overview`, `/api/station`, `/api/punctuality`, `POST /api/reports`)
- `server/community.js`: relatos, validação e estatísticas · `server/safety.js`: avisos manuais e Fogo Cruzado
- `tools/import-gtfs.js`: importador GTFS · `tools/make-sample-gtfs.js`: GTFS de teste
- `tools/seed-test-reports.js`: relatos de teste · `tools/fetch-station-coords.js`: coordenadas · `tools/make-icons.js`: ícones
