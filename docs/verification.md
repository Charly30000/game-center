# Verificación del proyecto

Las comprobaciones generales del centro cubren construcción Docker, publicación del puerto, aislamiento de juegos, arranque bajo demanda y retirada por inactividad. Se ejecutan dentro de contenedores, sin instalar herramientas en el anfitrión ni cambiar sus variables de entorno.

## Plantilla y comando de creación — 9 de noviembre de 2026

La imagen pasa **61 pruebas automatizadas**. Se comprobó también `npm run game:create` con `--dry-run` y todas las decisiones explícitas, sin escribir ningún juego real. El diálogo se prueba con respuestas inválidas consecutivas, repregunta inmediata, orientación 1/2 y selección de juegos por número. Se verifica la numeración creciente desde Bingo (1), el orden aunque el JSON esté desordenado y el rechazo uniforme de números, identificadores y puertos duplicados.

Las pruebas de `tests/game-scaffold.test.mjs` crean proyectos temporales: validan decisiones obligatorias, simulación sin escritura, rechazo de IDs/rutas inválidos y destinos existentes, registro y puerto, estructura completa, avatares copiados sin dependencia del origen, nombres simultáneos y unicidad obligatoria entre todas las salas incluso tras desconectar al propietario, privacidad, dos TV, aislamiento, sesiones y reset. Comprueban salud y WebSocket reales, deduplicación de solicitudes, CLI no interactivo y ejecución de los tests que recibe un juego de un solo jugador. Un bloqueo existente se respeta.

`tests/browser/scaffold-server.mjs` genera dos juegos únicamente en `/tmp` y sirve una pasarela de pruebas sin socket Docker ni puertos públicos. `tests/browser/scaffold.mjs` utiliza un solo Chromium con contextos independientes: portada propia del catálogo, dos TV, nombre recortado y duplicados, reglas compartidas, inicio, recuperación y toma de sesión, credencial conservada al volver al selector, TV no persistida, salas aisladas y retorno coordinado desde resultados. Comprueba la interfaz en 1920×1080, 1280×720, 667×375, 568×320, 390×844 y 320×568. Artefactos temporales en `artifacts/scaffold/`.

Tras unificar el catálogo se volvió a ejecutar esta revisión sin errores: las tarjetas siguen el orden 1/2/3 y todas cargan su portada propia. La portada autónoma de Bingo conserva BIN / GO!, la ilustración y las fuentes incrustadas; se comprobó su carga en los seis tamaños y se revisaron visualmente las capturas de 1280×720 y 320×568.

Las pruebas no crean juegos en el catálogo real y no reinician servicios existentes. La plantilla es una base de entrada y preparación: no certifica mecánicas futuras ni compatibilidad con cada TV física. Los juegos generados mantienen su propia documentación de verificaciones pendientes.

La revisión adicional conecta 40 jugadores mediante WebSocket, comprueba el desplazamiento automático de sus tarjetas al retirar el puntero y permite vaciar el lobby desde TV. El registro único real `server/games.json` contiene solo Bingo, con número 1; los juegos de prueba se crean exclusivamente en proyectos temporales.

La verificación de reglas, sesiones, interfaz y recursos propios de cada juego se mantiene en su documentación:

- [Bingo: pruebas y límites de verificación](../games/bingo/docs/verification.md).

Consultar [operación](operations.md) para los comandos generales y el README de cada juego para su ejecución y validación específicas.

La conexión por QR se cubre con pruebas de selección de dirección y puerto, y decodificación independiente del QR renderizado en ocho tamaños. Se comprueban la entrada por localhost, cambio de IP y ausencia de una dirección compartible. Con un catálogo largo se verifica que el QR queda fijo a la izquierda mientras solo se desplazan las tarjetas en escritorio, y que en móvil aparece al principio del listado con scroll normal. El arranque Linux se verifica en un contenedor con interfaces y Docker simulados, sin iniciar servicios reales. Véanse [detalle y ejecución](connection.md#verificación). La revisión inicial del QR se realizó con una batería de 37 pruebas; las pruebas de cámara física y distancia de lectura no se han ejecutado.
