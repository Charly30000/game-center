# Verificación

## Reducción de música solo al cantar números — 9 de noviembre de 2026

Pasan las 12 pruebas de coordinación de audio y música. Una regresión comprueba que bombo, recogida, estrellas e invitación a continuar no reducen el fondo; solo la reproducción de `number-*` activa la reducción, que se retira al finalizar el audio. La revisión de Chromium con Web Audio real también confirma volumen 0,25 durante el bombo y 0,05 durante el número cantado, conservando controles y tamaños. Las pausas en resultados, al silenciar o salir se mantienen.

## Ajuste de audibilidad — 9 de noviembre de 2026

Se eleva la ganancia de la música de 0,05 a 0,25 (aproximadamente +14 dB), manteniendo la pista y el control independiente. Durante voz o efectos se reduce a 0,05; se conserva la recuperación suave. Las dos pruebas de música verifican los nuevos niveles, el bucle continuo, la reanudación y las cancelaciones. No se cambia el volumen de las locuciones ni de los efectos.

## Música ambiental menos repetitiva — 9 de noviembre de 2026

Se sustituye el MP3 por **Contemplation**, de Joth (CC0), sin modificar los controles ni la voz. La pista nueva dura aproximadamente 120,059 segundos, frente a los 19,383 segundos anteriores. Pasan las dos pruebas de música y la revisión de Chromium con reproducción y decodificación reales, prioridad de voces, activación independiente, parada en resultados y cinco tamaños de pantalla.

La comparación de señal decodificada a 24 kHz dio RMS 0,2542 para la anterior y 0,03558 para la nueva; con las ganancias respectivas 0,075 y 0,05, el RMS de salida estimado baja de 0,01907 a 0,001779. Es una medida eléctrica aproximada, no una medida LUFS ni una garantía de comodidad subjetiva en todos los altavoces. Se conserva la reducción adicional durante las locuciones, ahora a 0,008. Las pruebas se ejecutaron en contenedores limitados a una CPU y 512 MB, sin usar partidas reales. Informes temporales en `artifacts/music/`.

## Música independiente de TV — 9 de noviembre de 2026

Pasan las 13 pruebas específicas de audio, música y GLB. La ampliación verifica un único bucle, volumen reducido durante primer plano, control independiente, reanudación desde la posición anterior, ausencia de descarga estando inactivo y cancelación de una reproducción pendiente después de salir.

`tests/browser/music.mjs` pasó con Chromium y Web Audio reales en Docker: decodifica el MP3 (19,383 s), inicia un único bucle de TV, reduce el volumen al anunciar un número, permite desactivar música y seguir anunciando números, reactiva el bucle y lo detiene al mostrar resultados. El control se oculta en jugador. Se comprobaron ambos botones de al menos 44×44 píxeles dentro de pantalla en 1280×720, 667×375, 568×320, 390×844 y 320×568. Informe y captura en `artifacts/music/`. La música añade un canal de fondo al canal de primer plano; la reducción de volumen da prioridad a la voz. No se ha realizado una escucha en equipos físicos.

## Sustitución de la fanfarria — 9 de noviembre de 2026

Se sustituye exclusivamente la victoria por `victory-fanfare.wav`, conversión de **Hyper-Ultra-Fanfare** de Zane Little Music (CC0), de aproximadamente 6,125 segundos. Se retiran el original y el WAV de `jingles_PIZZI07`; la locución y el sonido de derrota conservan sus archivos y hashes.

Pasan las once pruebas específicas de audio y GLB, incluidos manifiestos, victoria, derrota, empates, espectadores, interrupciones y fanfarria única. Una revisión focalizada con Chromium y Web Audio reales reproduce la locución completa (1,576 s), la fanfarria completa (6,125 s) y su selección para el móvil ganador. Se comprueba un máximo de una fuente simultánea y ninguna petición al sonido anterior. El informe temporal está en `artifacts/victory-audio-validation.json`; no se modifican partidas reales ni se realiza una escucha en altavoces físicos.

La conversión inicial del WAV original agotó el límite de memoria por expandir los bytes a arrays JSON. Se corrigió la preparación para transferir base64 y se completó con un contenedor de una CPU y 512 MB. El original se convierte a mono a 24 kHz y 16 bits, sin recortar la composición. Créditos y fuente en [audio](audio.md).

## Anuncio y resultados personales — 9 de noviembre de 2026

Pasan **48 pruebas automatizadas** en Docker. La TV reproduce «¡Bingo! ¡Enhorabuena!» con ritmo más vivo y luego la fanfarria; los móviles participantes reciben victoria o derrota según `winners`. Se comprueban empates, espectadores, ausencia de repeticiones, nueva partida, cancelación de la fanfarria pendiente y fin sin ganadores (sin falso anuncio de bingo). El sonido de Continuar se descarta si su confirmación llega después del resultado, para no cortar la victoria. El GLB real articula la locución durante `Celebrate` sin detener su bucle.

La revisión de Chromium con Web Audio y WebGL pasó con los **101 WAV** actuales (nueve efectos y 92 locuciones): locución de bingo seguida de una única fanfarria en TV, victoria y derrota diferenciadas en móvil, modo estático y cabecera en cinco tamaños. Los sonidos nuevos mantienen las licencias y procedencias descritas en [audio](audio.md). No se ha realizado una escucha en altavoces físicos de TV o móvil; la expresividad de la voz sintetizada puede diferir de una interpretación humana.

## Audio y sincronización — 9 de noviembre de 2026

Actualización posterior: se ha retirado el bip previo al anuncio (`glass_001`), tanto de reproducción como de precarga y recursos. `ShowBall` inicia directamente la locución a los 0,25 segundos. Pasan las ocho pruebas específicas de audio y del GLB con el inventario actualizado: ocho efectos y 91 locuciones (99 WAV). La revisión inicial descrita a continuación incluía todavía ese bip.

Pasan **45 pruebas automatizadas** dentro de la imagen Docker actualizada. La ampliación comprueba exclusión entre voz y efectos, separación TV/móvil, marcas confirmadas, efectos recibidos desordenados, cancelación de descargas tardías, silencio, desconexión, pestaña oculta, modo estático, fanfarria única y los hashes de los 100 WAV. Un ensayo con el GLB real verifica que la mandíbula sigue la voz, descansa sin ella, mantiene la pose hasta terminar y cede inmediatamente a un nuevo turno.

`tests/browser/audio.mjs` pasó con Web Audio y WebGL reales en Chromium dentro de Docker, con estados y WebSocket simulados. Decodificó los nueve efectos y las 91 locuciones; comprobó la secuencia `bombo → recogida → presentación → número 28 → estrellas → invitación`, el anuncio del 90 en modo estático, la fanfarria única y el silencio. Registró distintas aperturas de mandíbula durante la reproducción. En móvil, pulsar una casilla, cambiar de cartón y Continuar produjo únicamente sus tres respuestas locales. El altavoz y la cabecera caben en 1280×720, 667×375, 568×320, 390×844 y 320×568; se corrigió un recorte de medio píxel en horizontal.

La revisión adicional `presenter.mjs --layout-only` pasó en 1280×720, 960×540, 800×480, 667×375, 568×320, 360×640 y 320×568 con las 90 bolas. Se inspeccionaron capturas de TV y móvil. Mediante MCP de Blender se consultaron los nueve clips de la fuente aprobada y sus intervalos, sin guardar ni cambiar el modelo. Los artefactos temporales están en `artifacts/audio/`.

La revisión utilizó un único navegador limitado a una CPU y 768 MB, con pasarela interna sin puertos públicos ni partidas reales. No equivale a escuchar el resultado en altavoces de una TV física, probar Safari/iOS o medir sincronización fonética exacta. Las locuciones locales evitan depender de voces instaladas o de Internet; la articulación combina visemas aproximados y energía real del WAV. Véanse [audio y licencias](audio.md).

## Entorno y aislamiento

Pruebas desde Windows con Docker Desktop y contenedores Linux. No se instalaron dependencias ni se cambiaron variables del sistema en Windows. La revisión de interfaz utiliza un Bingo independiente y una pasarela de pruebas sin acceso al socket Docker, expuestos en el puerto 3002. Las pruebas con estados inyectados solo modifican su propio navegador. Los servicios de otros proyectos no se modifican.

## Reglas, contenedores y geometría

33 pruebas automatizadas comprueban:

- Catálogo de 10.000 cartones válidos y únicos, reparto sin repetidos para hasta 40 jugadores con cinco cartones, validación de nombres y privacidad.
- Barrera de turnos, números pendientes, jugadores desconectados, recuperación, invalidación de credenciales, empates y revancha.
- Reinicio desde resultados: todas las conexiones, incluidas varias televisiones, reciben estado de visitante, sin jugadores ni partida anterior.
- Arranque concurrente y exclusión mutua entre arranque y retirada por inactividad.
- Códigos de mando y navegación direccional.
- Preparación vertical, cambio a horizontal liberando el bloqueo anterior, descarte de peticiones antiguas, recuperación explícita de pantalla completa y funcionamiento si el navegador rechaza las API.
- El GLB real contiene nueve clips nuevos, 45 huesos y 19 mallas con pesos normalizados; las manos tienen orientación anatómica, el agarre sigue la manivela con menos de 1 mm de error entre claves, se mueven las 18 bolas dentro de la jaula, se asientan sin saltar al parar, se prueban los 90 números y las transiciones de partida, incluida la elevación y desaparición con estrellas de `DropBall`.
- La extracción programa cinco segundos y publica el mismo reloj para todas las pantallas. La articulación visual distingue vocales y cierres labiales para los 90 números en español.

La caducidad de 24 horas se comprueba adelantando el reloj con un adaptador Docker simulado; no se ha esperado un día real.

## Visualización en Chromium

Se comprueban dimensiones del documento, posiciones de controles y textos, recortes, altura de la imagen de portada y tamaño mínimo de números y nombres. Se incluyen nombres de 40 caracteres.

| Vista | Tamaños comprobados |
| --- | --- |
| Catálogo | 320×568, 360×640, 390×844, 568×320, 667×375, 844×390, 1280×720 |
| TV, con 40 jugadores | 1920×1080, 1280×720, 960×540, 800×600, 360×640 |
| Jugador, con cinco cartones | 320×568, 360×640, 390×844, 568×320, 667×375, 844×390, 1024×600 |

Se recorren selector, lista independiente de jugadores, perfil, espera, extracción, marcado y resultados. Las listas largas de jugadores conservan sus tarjetas y se verifica que el scroll automático avanza. No hay scroll de página; el desplazamiento de esas tarjetas está limitado a su región.

El selector de cartones se comprueba además con **uno, dos, tres, cuatro y cinco cartones** en 320×568, 360×640, 390×844, 568×320, 667×375, 844×390, 960×551 y 1024×600. Se comprueba que todos los botones caben simultáneamente, miden al menos 44×44 píxeles, sus etiquetas y contadores no se cortan y el selector no desborda ni se desplaza. Se pulsa cada cartón y se comprueba su selección, además de probar flechas y Enter. Las capturas `ticket-selector-*.png` recogen estas distribuciones.

Se revisan capturas en `artifacts/`: catálogo en varios tamaños, 40 tarjetas de jugadores, cartón vertical/horizontal, TV estática, TV 3D y resultados. Las imágenes de portada no invaden la zona blanca del título. Los cartones conservan proporciones y los números se representan como texto sin deformaciones.

## Teclado, avatares y pantalla completa

`tests/browser/mobile-interaction.mjs` comprueba en Chromium móvil que los cambios de altura visible y los estados del servidor conservan el mismo input y el nombre escrito sin llamar a `focus()`. Cubre tanto cerrar el teclado retirando el foco como cerrarlo manteniendo el input activo. Seleccionar un avatar retira el foco sin reconstruir el formulario. Las cuatro distribuciones 320×568, 390×844, 568×320 y 844×390 conservan personajes cuadrados y separaciones fijas, sin desbordar la página ni la cabecera.

La prueba verifica la petición horizontal al comenzar una partida, el orden pantalla completa/orientación desde el botón, su aparición al salir y su permanencia cuando el navegador rechaza la solicitud. El teclado nativo y las API de orientación/pantalla completa se simulan para poder comprobar sus eventos y rechazos de forma reproducible; esto no sustituye una prueba en un teléfono físico. La sesión recuperada durante una partida solicita horizontal también en la prueba de conexiones reales.

## Flujo real con navegadores

La prueba con conexiones reales cubre:

1. Abrir Bingo, pulsar Atrás del navegador, volver a entrar y elegir TV de nuevo.
2. Conectar dos TV y un móvil; elegir Jugador y abrir directamente el perfil mientras la partida está en el lobby.
3. Compartir las reglas, repartir cinco cartones y probar el modo estático.
4. Recuperar un jugador activo desde la lista, invalidar la pantalla anterior y entrar automáticamente al recargar con la credencial válida. Una credencial caducada se descarta y deja al usuario en el selector. Volver al centro conserva una sesión válida y permite entrar automáticamente de nuevo.
5. Cancelar, crear una nueva partida en 3D y verificar mediante dos capturas que el modelo tiene animación de espera.
6. En la revisión anterior se completó una partida de **85 turnos mediante la interfaz**, con ganador, resultados y vuelta simultánea al selector. Los cambios actuales no modifican las reglas del servidor; esta revisión repite el flujo corto, la sesión automática y las comprobaciones de tamaños.
7. Entrar otra vez en el lobby vacío, salir al centro y volver a abrir Bingo.

Tras aplicar la versión se repitió el flujo corto contra el puerto principal 3000: arranque real del contenedor de Bingo, Atrás y nueva entrada, selección de jugador, recuperación y modos estático/3D. El centro permaneció activo durante la actualización.

En una verificación anterior, la prueba de protocolo también completó una partida real de 85 turnos con ocho entradas concurrentes y dos jugadores. Las pruebas actuales de navegador y geometría cubren las nuevas regresiones de navegación y presentación.

## Límites

La revisión aprobada v8 comprueba la postura frente a la manivela, el sentido de flexión del codo, la orientación del agarre, las muñecas y la cascada de dedos relajados. Se validan todos los fotogramas del modelo y las medias claves del GLB mediante GLTFLoader y Three.js. Pasan las 33 pruebas; se conservan encuadre completo, bolas independientes y victoria continua tras cinco ciclos. Los informes actuales se describen en [presentador de Blender](blender-character.md).

`tests/browser/presenter.mjs` permite revisar las 90 bolas simultáneamente, midiendo cada número dentro de su casilla, en 1280×720, 960×540, 800×480, 667×375, 568×320, 360×640 y 320×568. Espera al ajuste de altura visible después de redimensionar antes de medir. `--layout-only` aísla esa comprobación sin cargar WebGL. La revisión completa incluye `DropBall`, `Talk`, decorado oscuro y otro ciclo de victoria; utiliza estados simulados y no modifica partidas reales. Las comprobaciones anteriores de tamaños no equivalen a una nueva grabación WebGL completa con cada cambio del modelo. Las capturas e informes de las versiones retiradas ya no forman parte del proyecto.

Los tamaños se emulan en Chromium; no se ha utilizado cada modelo físico de TV, mando o iPhone. Las teclas reservadas por el navegador o el sistema no pueden garantizarse desde una página web.

La instalación PWA necesita un contexto seguro según el navegador. Una IP LAN mediante HTTP permite jugar, pero no garantiza instalación. El estado de Bingo es deliberadamente volátil y no se conserva al reiniciar su contenedor. La animación de las bolas es una simulación visual acotada al bombo, sin un motor físico completo.

## Identidad del anfitrión y rótulo del escenario

La portada con el nuevo anfitrión conserva BIN / GO! y la bola 90; el selector utiliza la ilustración del mismo señor que aparece en el modelo 3D. Se revisan catálogo, selector y partida de TV en 1280×720, 960×540, 800×480, 667×375, 568×320, 360×640 y 320×568. En el catálogo se comprueba que la ilustración y la parte blanca de la tarjeta mantienen sus áreas; en el selector se comprueban proporciones y ausencia de desbordamiento.

`tests/browser/presenter.mjs --layout-only` comprueba en los siete tamaños las 90 bolas, ausencia de scroll de TV, las cinco letras de BINGO dentro de su rótulo y su separación de la imagen, el canvas y el aviso de bola. La revisión visual adicional utiliza una imagen WebGL real a 1280×720 y comprueba que su tamaño coincide con el área inferior reservada. Son tamaños emulados; no se han medido FPS en televisores físicos. Los artefactos temporales de revisión se guardan en `artifacts/`, fuera del commit y de Docker, y pueden eliminarse después de inspeccionarlos.
