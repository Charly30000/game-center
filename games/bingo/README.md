# Bingo en familia

Una única sala con hasta 40 jugadores y varias televisiones. Juego de 90 bolas sin dinero ni premios reales. Todo el estado se decide en `domain/game.mjs`; los clientes solo solicitan acciones.

## Reglas de los cartones

Cada elemento de `data/tickets.json` es un array de **27 enteros**, en orden de lectura: primera fila de izquierda a derecha, segunda y tercera. `0` significa casilla vacía.

- 3 filas × 9 columnas, 15 números en total, exactamente 5 por fila.
- Cada columna tiene entre 1 y 3 números, ordenados de arriba abajo sin repetidos.
- Rangos por columna: **1–9, 10–19, 20–29, 30–39, 40–49, 50–59, 60–69, 70–79 y 80–90**.
- Cada cartón es único dentro del catálogo. Cada reparto mezcla el catálogo en el servidor y toma elementos distintos para todos los jugadores de la partida.
- El catálogo contiene 10.000 cartones válidos y reproducibles. No intenta enumerar el número descomunal de todas las combinaciones posibles; el generador permite hasta un millón por ejecución. No se necesitan tiras de seis cartones, ya que cada jugador puede recibir entre uno y cinco cartones independientes.

Reglas contrastadas con [Tombola: bingo de 90 bolas](https://www.tombola.co.uk/bingo-guides/how-to-play-bingo90), [Gala: distribución por columnas](https://bingo.galabingo.com/en/bingo/schedule/90-ball) y [Paddy Power: columnas no vacías](https://bingo.paddypower.com/c/90-ball-bingo). Esta variante familiar **solo premia bingo completo**; no adjudica línea ni dos líneas.

## Partida

`lobby → drawing → marking → drawing … → results`

En el lobby los jugadores entran como borradores. El avatar es aleatorio y puede repetirse; el nombre es obligatorio, normalizado, de 3 a 40 caracteres y único sin distinguir mayúsculas. La televisión ve una tarjeta pendiente hasta confirmar. Las reglas son compartidas por todas las televisiones. Se inicia con al menos un jugador confirmado y conectado, previa confirmación visual.

El servidor reparte los cartones y mezcla 90 bolas usando aleatoriedad criptográfica. Cada extracción dura cinco segundos; los cartones están bloqueados durante ese intervalo. Al revelar la bola se habilitan los números extraídos que faltan por marcar, incluso si pertenecen a turnos anteriores a una desconexión.

Solo se permite Continuar después de marcar todos los números extraídos presentes en todos los cartones propios. La televisión muestra las tarjetas de quienes siguen pendientes. Si no ha salido ningún número propio se puede continuar directamente.

El servidor espera a todos los participantes conectados. Los desconectados no bloquean. Si no queda ninguno conectado, se pausa en la bola actual hasta que alguien vuelva. Los jugadores confirmados que estaban desconectados al comenzar quedan como espectadores hasta la siguiente partida.

Se comprueba el bingo al cerrar la barrera del turno, de manera que todos los jugadores de la misma bola puedan terminar y empatar. Se requiere que los 15 números de al menos un cartón estén marcados. Cada ganador recibe una victoria. Un jugador desconectado no marca números automáticamente y podría perder una oportunidad durante su ausencia.

La revancha empieza directamente con los jugadores confirmados y conectados, nuevos cartones y las mismas reglas; conserva victorias. Cancelar requiere confirmación y borra jugadores, cartones, victorias y configuración. En resultados, **Volver a selección** ejecuta `reset` en el servidor: borra esa sesión y devuelve a todas las televisiones y jugadores al selector TV/Jugador. Solo ese selector ofrece salida al centro de juegos.

## Recuperación

Cada jugador recibe un token aleatorio de 256 bits que se conserva localmente y se valida en el servidor al abrir o recargar. Si sigue siendo válido, se entra automáticamente con sus datos. Sin sesión válida, Jugador abre el perfil directamente en el lobby; si la partida está iniciada, abre la pantalla de nombres para recuperarlo. Si el nombre elegido sigue conectado, se solicita confirmación antes de invalidar la pantalla anterior. El modo TV no se guarda. El comportamiento completo está en [interfaz y sesiones](docs/interface.md).

Es un mecanismo pensado para una familia en una LAN de confianza; no es autenticación de identidad. Las televisiones no tienen usuarios exclusivos. Reiniciar el contenedor pierde la partida y hace caducar los tokens; el navegador permite volver a elegir jugador.

## Pantallas y rendimiento

La televisión combina el tablero de 90 bolas con el anfitrión anciano modelado y animado en Blender. La distribución habitual 10×9 pasa a 15×6 cuando falta altura; los números se ajustan a su casilla. El bombo dorado está a la izquierda del público y el personaje utiliza su mano derecha para girarlo y mostrar el número del servidor. Las 18 bolas interiores se agitan y se asientan al parar. Los nueve clips siguen las fichas del usuario, con dedos relajados, pulgar independiente, giro natural de la manivela, teatro oscuro y victoria en bucle durante resultados. Three.js y el GLB se cargan únicamente en TV con efectos habilitados; el dibujo se limita a 30 FPS en acciones y 24 FPS en espera y se pausa con la página oculta. Véase [presentador de Blender: modelo, animaciones y escenario](docs/blender-character.md).

El modo estático muestra `presenter-static.webp`, una ilustración artística transparente del anfitrión actual y el bombo, y conserva los números actualizados por el servidor. No incluye GIF para respetar la desactivación de animaciones y ahorrar memoria. `prefers-reduced-motion` también evita importar el modelo. Si WebGL falla se conserva la imagen estática. El selector de TV y la portada del Game Center representan al mismo anfitrión; la portada mantiene BIN / GO! y la bola 90. Imagen y canvas dejan una franja superior libre para que el rótulo BINGO sea visible en todos los tamaños.

Los cartones conservan papel marfil, doble marco, tipografía de imprenta, casillas tramadas y perforación; los cinco colores distinguen las pestañas. Los números se representan con Space Mono y tamaño calculado a partir de la casilla, evitando deformaciones y conservando la legibilidad. Las bolas usan una fuente redondeada distinta de los cartones. Fredoka se sirve localmente; no se ha creado una familia tipográfica original completa.

La interfaz adapta vertical, horizontal y tamaños de TV. En el móvil del jugador se solicita orientación vertical durante la preparación y horizontal al comenzar o recuperar una partida iniciada. Fuera de pantalla completa aparece **Volver a pantalla completa**. El rechazo del navegador no bloquea la partida. Véanse [orientación y límites del navegador](docs/interface.md#orientación-automática-del-móvil). Se utiliza DOM adaptable para tableros y controles accesibles; solo el modelo 3D usa canvas, ajustado al tamaño de su contenedor.

Todas las pantallas utilizan la altura visible del navegador, sin scroll de página. `viewport.js` calcula el espacio del tablero, las proporciones del cartón y el tamaño de los números; `bingo.css` contiene una única distribución adaptable. Las listas largas conservan las tarjetas completas y usan scroll dentro de su propia región. En televisión se desplazan automáticamente y se pausan al interactuar; la lista de elección de jugador es manual para no mover el objetivo mientras se selecciona. El selector muestra todos los cartones sin scroll: una fila numerada en vertical y un lateral que se reparte en varias columnas cuando falta altura. Conserva colores, progreso y avisos de números pendientes, con botones de al menos 44×44 píxeles. No se ocultan controles desbordados para simular que caben.

Si una bola no está en ninguno de los cartones y no quedan números anteriores por marcar, aparece una modal «No ha salido tu número» con Continuar. Se muestra una vez por bola, no se repite por actualizaciones de otros jugadores. La confirmación utiliza la misma acción validada del servidor. Los cartones y casillas pendientes parpadean en rojo más visible; con movimiento reducido el aviso rojo permanece estático.

El catálogo y el bingo comparten navegación direccional por posición: flechas para mover el foco, OK para activar y Atrás para cerrar una modal o regresar. Atrás durante una partida pide confirmación para cambiar de pantalla; la cancelación es una acción independiente. El historial del navegador no se bloquea ni se reintroducen entradas al retroceder. Ver [compatibilidad de mandos](../../docs/remote-controls.md).

Ver [interfaz, sesiones y orientación](docs/interface.md), [protocolo](docs/protocol.md), [operación](docs/operations.md), [recursos](art/README.md), [presentador de Blender y controlador Three.js](docs/blender-character.md) y [pruebas](docs/verification.md).
