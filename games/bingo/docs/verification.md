# Verificación

## Entorno y aislamiento

Pruebas desde Windows con Docker Desktop y contenedores Linux. No se instalaron dependencias ni se cambiaron variables del sistema en Windows. La revisión de interfaz utiliza un Bingo independiente y una pasarela de pruebas sin acceso al socket Docker, expuestos en el puerto 3002. Las pruebas con estados inyectados solo modifican su propio navegador. Los servicios de otros proyectos no se modifican.

## Reglas, contenedores y geometría

32 pruebas automatizadas comprueban:

- Catálogo de 10.000 cartones válidos y únicos, reparto sin repetidos para hasta 40 jugadores con cinco cartones, validación de nombres y privacidad.
- Barrera de turnos, números pendientes, jugadores desconectados, recuperación, invalidación de credenciales, empates y revancha.
- Reinicio desde resultados: todas las conexiones, incluidas varias televisiones, reciben estado de visitante, sin jugadores ni partida anterior.
- Arranque concurrente y exclusión mutua entre arranque y retirada por inactividad.
- Códigos de mando y navegación direccional.
- Preparación vertical, cambio a horizontal liberando el bloqueo anterior, descarte de peticiones antiguas, recuperación explícita de pantalla completa y funcionamiento si el navegador rechaza las API.
- El volumen del torso permanece detrás de la mesa durante extracción y espera. Silla, piernas, pies y manivela existen; las bolas permanecen dentro del bombo y la pose de espera cambia con el tiempo.

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

Se revisan capturas en `artifacts/`: catálogo en varios tamaños, 40 tarjetas de jugadores, cartón vertical/horizontal, TV estática, TV 3D y resultados. Las imágenes de portada no invaden la zona blanca del título. Los cartones conservan proporciones y los números se representan como texto sin deformación del sprite.

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

Los tamaños se emulan en Chromium; no se ha utilizado cada modelo físico de TV, mando o iPhone. Las teclas reservadas por el navegador o el sistema no pueden garantizarse desde una página web.

La instalación PWA necesita un contexto seguro según el navegador. Una IP LAN mediante HTTP permite jugar, pero no garantiza instalación. El estado de Bingo es deliberadamente volátil y no se conserva al reiniciar su contenedor. La animación de las bolas es una simulación visual acotada al bombo, sin un motor físico completo.
