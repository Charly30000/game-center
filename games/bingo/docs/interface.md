# Interfaz y comportamiento de Bingo

Este documento recoge las decisiones específicas del juego. Debe actualizarse junto con el código y prevalece sobre descripciones antiguas de pruebas. No trasladar estas reglas al AGENTS.md general.

## Diseños y recursos conservados

- La portada del catálogo utiliza el diseño original **BIN / GO!**, la bola 90 y la ilustración original del presentador. La composición se adapta como una unidad y mantiene la zona blanca del título independiente.
- El selector TV/Jugador conserva los motivos originales: presentador con bombo para TV y cartón inclinado con números para Jugador. No introducir avatares u otras ilustraciones en sustitución de estos motivos.
- Conservar el resto de imágenes y diseños salvo petición expresa. Los cambios de tamaño deben ajustar su distribución y proporciones, no rediseñar la pantalla.

## Entrada y recuperación de sesión

La credencial de jugador se guarda en `localStorage` bajo `bingo.token`. El modo Televisión no se persiste.

1. Al abrir o recargar, si existe una credencial se solicita `hello` con `role: player` y el token.
2. Si el servidor reconoce la sesión, se entra automáticamente en el perfil pendiente, la espera, los cartones o los resultados, según su estado. No se obliga a elegir de nuevo un jugador válido.
3. Si no hay credencial o el servidor responde `SESSION_EXPIRED`, se muestra TV/Jugador. Se descarta exclusivamente la credencial inválida, sin crear otro jugador automáticamente.
4. Al pulsar **Jugador en el lobby**, se recupera la credencial válida si la hay; en caso contrario se abre directamente el formulario original de nombre y personaje.
5. Al pulsar **Jugador con la partida iniciada**, se abre la pantalla independiente con todos los nombres recuperables. Elegir uno solicita su sesión; si aún está conectado, se muestra confirmación antes de invalidar su pantalla anterior.

Volver al selector o al centro no borra una credencial válida. Una pérdida de red en la misma página reutiliza la identidad en memoria. Un reset, una cancelación o un reinicio del servidor puede invalidar la sesión; esa invalidez se detecta al validarla. Si otro dispositivo recupera al jugador, `revoked` detiene la reconexión anterior y retira su token. La limpieza compara credenciales para no borrar una nueva sesión guardada por otra pestaña.

El servidor es siempre la autoridad: el token no permite enviar cartones, marcas o ganadores arbitrarios. Las televisiones pueden coexistir y controlan las mismas opciones.

## Orientación automática del móvil

En el móvil se solicita **vertical (`portrait`) durante la preparación** y **horizontal (`landscape`) al comenzar la partida** para los jugadores participantes. La recuperación automática de una sesión solicita la orientación correspondiente a su fase: una partida iniciada se recupera en horizontal. Al cambiar de orientación se libera el bloqueo anterior y se invalidan los reintentos pendientes, evitando que una petición vertical antigua vuelva a bloquear el juego.

`public/orientation.js` utiliza `screen.orientation.lock`. Si el navegador exige pantalla completa, intenta activarla y vuelve a solicitar el bloqueo. No se reintenta al tocar cualquier parte de la pantalla. Fuera de pantalla completa, el jugador dispone del botón **Volver a pantalla completa**, que la solicita desde la pulsación y aplica la orientación actual. Salir voluntariamente no provoca una entrada inmediata de nuevo. En cabeceras estrechas el botón ocupa el espacio del título y el indicador de conexión; durante una desconexión se conserva el aviso de reconexión.

El bloqueo depende de la API y de las restricciones del navegador: pantalla completa necesita activación del usuario y algunos navegadores no permiten bloquear la orientación. Si se rechaza, se continúa jugando y la interfaz conserva su adaptación a vertical y horizontal. No rotar la página mediante CSS. Los televisores no reciben peticiones automáticas de orientación.

Referencias: [Screen Orientation, W3C](https://www.w3.org/TR/screen-orientation/), [ScreenOrientation.lock, MDN](https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/lock) y [requestFullscreen y activación del usuario, MDN](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen#security).

## Proporciones y controles

Los avatares son cuadrados. En la lista de nombres se muestran a tamaño fijo de 64×64 con proporción 1:1. En la cuadrícula del perfil, `viewport.js` calcula un único lado a partir de las cinco columnas y cuatro filas; ancho y alto siempre coinciden. Las pistas de la cuadrícula miden ese mismo lado y mantienen una separación fija, sin repartir el espacio sobrante entre personajes al cerrar el teclado. No ajustar sus dimensiones por separado para rellenar una región.

Al confirmar el perfil se normaliza el nombre y se aplica `.trim()` antes de validar sus 3–40 caracteres; los espacios exteriores no cuentan y no se envían al servidor. El servidor repite siempre la validación y la comprobación de unicidad sobre el nombre normalizado. El formulario conserva sus nodos mientras se edita el mismo jugador. Los cambios de altura visible, teclado o estado de otros jugadores actualizan la distribución sin reconstruir el input ni reenfocarlo. El nombre solo recibe foco mediante una acción del usuario. Elegir un personaje retira el foco del input sin rehacer el formulario y conserva el nombre escrito.

El selector permite ver y pulsar todos los cartones sin desplazamiento. En móviles verticales utiliza una fila de botones numerados del mismo ancho, con el progreso debajo. En horizontal conserva el lateral con «Cartón» y su número cuando hay altura suficiente; si no caben todos, `viewport.js` reparte botones numerados en varias columnas según la altura disponible. Mantiene objetivos de pulsación de al menos 44×44 píxeles, colores, selección y aviso rojo de números pendientes. Los nombres accesibles siguen indicando el cartón y su progreso aunque se abrevie la etiqueta visual. El cartón de juego mantiene sus proporciones y su espacio vertical.

El documento y el selector de cartones no tienen scroll. Las listas de jugadores en TV mantienen tarjetas completas con desplazamiento automático, pausado al interactuar.

Los cartones mantienen su proporción y los números se calculan según el tamaño real de la casilla. El tablero de TV ajusta también su fuente y sus separaciones a las bolas: 10×9 normalmente, 15×6 en regiones muy bajas y anchas. La franja de jugadores se compacta y la bola actual se superpone en la esquina del escenario en TV con poco espacio. El marcado pendiente continúa con el parpadeo rojo y con la modal de Continuar cuando no sale ningún número propio.

## Presentador

La TV utiliza el anfitrión anciano de Blender con chaleco rojo, gafas, bigote y bombo dorado a la izquierda del público. La mano derecha opera la manivela y recoge la bola; las palmas descansan hacia el cuerpo y los dedos se flexionan hacia la palma. Las muñecas acompañan al antebrazo y tienen flexión limitada. Las bolas interiores tienen movimiento independiente del giro de la jaula. La actuación utiliza cuerpo completo, mirada y cejas, presentación, salto y desaparición de la bola con estrellas. El encuadre conserva personaje y bombo completos en un área inferior independiente; `presenter.css` reserva espacio arriba para el rótulo BINGO, que no se superpone con el aviso de bola en pantallas compactas. El decorado de teatro oscuro puede recortarse. El selector y la imagen estática muestran al mismo anfitrión de las animaciones. En resultados, la victoria continúa en bucle hasta abandonar esa pantalla o empezar otra partida. La extracción dura cinco segundos y las acciones no bloquean a los jugadores. Véase [presentador de Blender](blender-character.md).

Los ajustes del personaje no autorizan cambios de imágenes, portada, bombo o interfaz que no se hayan solicitado. El detalle de los recursos se mantiene en [arte](../art/README.md).

## Navegación y salida

Solo el selector TV/Jugador muestra salida al centro. Las demás pantallas regresan primero a esa selección. El historial del navegador registra pantallas reales y no se bloquea al volver atrás. En resultados, Volver a selección reinicia la sesión del servidor para todos los clientes; Otra partida conserva las victorias.

Las reglas de transporte están en [protocolo](protocol.md), los comandos del juego en [operación](operations.md) y los resultados de pruebas en [verificación](verification.md).
