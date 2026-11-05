# Operación y pruebas de Bingo

Todos los comandos se ejecutan desde la raíz del proyecto. El servidor principal y las redes de Compose deben estar preparados.

## Prueba de una partida real

Necesita el centro levantado, la sala vacía y aproximadamente dos minutos. Utiliza clientes WebSocket reales y deja la sala vacía al finalizar. Si encuentra una partida ajena a sus jugadores de prueba, se detiene sin cancelarla.

```powershell
docker run --rm --network gamecenter-internal gamecenter-runtime:local node tests/integration.mjs
```

El contenedor de pruebas **no recibe el socket de Docker**. Accede al mismo HTTP y WebSocket que los navegadores. Las pruebas validan múltiples entradas concurrentes, dos TV, recuperación, invalidación de una conexión anterior, bingo, victorias y revancha.

## Prueba del navegador

La revisión se ejecuta con un bingo y una pasarela de pruebas en contenedores independientes, sin socket Docker. Requiere las redes creadas al arrancar Compose. El centro principal no se modifica. El puerto de revisión es 3002.

```powershell
docker compose build
docker build -f tests/browser/Dockerfile -t gamecenter-browser-tests:local .
docker run -d --name gamecenter-review-bingo --network gamecenter-internal --read-only --user node gamecenter-runtime:local node games/bingo/server.mjs
docker run -d --name gamecenter-review-ui --network gamecenter_access -p 3002:3000 --read-only --user node gamecenter-runtime:local node tests/browser/preview-server.mjs
docker network connect gamecenter-internal gamecenter-review-ui
New-Item -ItemType Directory -Force artifacts
docker run --rm --network gamecenter_access -e BASE_URL=http://host.docker.internal:3002 --mount "type=bind,source=$((Get-Location).Path)\artifacts,target=/artifacts" gamecenter-browser-tests:local node usability.mjs
docker run --rm --network gamecenter_access -e BASE_URL=http://host.docker.internal:3002 --mount "type=bind,source=$((Get-Location).Path)\artifacts,target=/artifacts" gamecenter-browser-tests:local node mobile-interaction.mjs
docker run --rm --network gamecenter_access -e BASE_URL=http://host.docker.internal:3002 -e FULL_GAME=true --mount "type=bind,source=$((Get-Location).Path)\artifacts,target=/artifacts" gamecenter-browser-tests:local
```

La prueba de tamaños utiliza estados inyectados exclusivamente en el navegador, con 40 jugadores y nombres de hasta 40 caracteres. Comprueba texto cortado, tarjetas, números legibles y contenido fuera de pantalla. Recorre de uno a cinco cartones en ocho tamaños, comprobando que todos los botones caben sin scroll y pueden seleccionarse por pulsación o con flechas y Enter. La prueba real reproduce Atrás y volver a entrar, selección de jugador, varias TV, cinco cartones, recuperación y recarga, modos estático y 3D. Con FULL_GAME=true termina una partida y comprueba el regreso simultáneo de todas las pantallas al selector; tarda varios minutos. Las capturas quedan en artifacts/, ignorado por Git.

Al terminar, retirar únicamente los dos contenedores de revisión:

```powershell
docker stop gamecenter-review-ui gamecenter-review-bingo
docker rm gamecenter-review-ui gamecenter-review-bingo
```

## Regenerar recursos o ampliar el catálogo

Las imágenes finales y el JSON están incluidos en el proyecto. La construcción vuelve a preparar las imágenes para hacerla reproducible. Si falta el JSON, crea por defecto 10.000 cartones.

Para generar otro catálogo sin tocar el actual, ejecutar en un contenedor desechable y copiar el resultado solo después de revisarlo:

```powershell
docker run --name gamecenter-catalog-export gamecenter-runtime:local node --input-type=module -e "import { writeFile } from 'node:fs/promises'; import { generateTickets } from './games/bingo/domain/tickets.mjs'; await writeFile('/tmp/tickets.json', JSON.stringify(generateTickets(50000)));"
docker cp gamecenter-catalog-export:/tmp/tickets.json ./games/bingo/data/tickets-next.json
docker rm gamecenter-catalog-export
```

`tickets-next.json` no se usa hasta reemplazar deliberadamente el catálogo principal. Los cartones nunca se regeneran durante una partida.


## Configuración del catálogo

TICKET_COUNT define el número de cartones que prepara la construcción si falta el catálogo. No afecta a una partida ya iniciada.
