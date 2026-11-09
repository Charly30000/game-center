# Presentador de Bingo en Blender

La única fuente editable es [bingo_character_relaxed_hands.blend](../art/blender/v8/bingo_character_relaxed_hands.blend), revisión aprobada v8. El juego y la herramienta de desarrollo cargan [bingo_character_animated.glb](../public/assets/models/bingo_character_animated.glb). Las versiones de trabajo anteriores se han retirado; el archivo actual contiene geometría, materiales, rig, acciones horneadas y biblioteca de bolas completos, sin necesitar otras entregas.

## Modelo y estructura

El anfitrión anciano sigue las dos referencias del usuario: «Hoja de diseño del anfitrión de bingo» y «Presentador de bingo con jaula dorada». Tiene chaleco rojo, camisa blanca, pajarita, gafas, bigote, pelo gris y manos articuladas. El bombo dorado está a la izquierda del público y se acciona con la mano derecha. Las ilustraciones artísticas 2D del catálogo, selector y modo estático representan al mismo anfitrión.

El rig `BingoCharacter_Rig` tiene 45 huesos y 19 mallas con pesos normalizados. Incluye dos huesos por dedo, mandíbula, parpadeo, cejas y mirada. Gafas, pelo, botones y uñas siguen sus segmentos. Los clips están horneados a 30 FPS: el GLB no depende de Python, restricciones IK ni controladores de Blender durante el juego.

Cada acción tiene una pista NLA del mismo nombre. `SpinDrum` contiene los huesos del personaje; `DrumSpin` contiene el rotor y las traslaciones independientes de las 18 bolas interiores. Se reproducen con la misma fase, sin duplicar canales. El soporte del bombo permanece fijo.

## Coreografía y sincronización

| Clip | Duración | Reproducción | Movimiento |
| --- | --- | --- | --- |
| `Idle` | 4,5 s | Bucle | Respiración, cambio de apoyo, mirada, asentimiento y gesto de presentación |
| `SpinDrum` | 5 s | Bucle | Preparación, agarre, vuelta coordinada de la manivela, torso y mano libre |
| `DrumSpin` | 5 s | Bucle | Giro de jaula y manivela, con bolas de movimiento independiente |
| `PickBall` | 2,6 s | Una vez | Inclinación hacia la bandeja, agarre a los 1,3 s y recogida hacia el pecho |
| `ShowBall` | 3 s | Una vez | Elevación, presentación hacia el público y descenso hacia el pecho |
| `DropBall` | 1,4 s | Una vez | Liberación a los 0,4 s, ascenso de 16 cm, brillo y desaparición con nueve estrellas |
| `Celebrate` | 3 s | Bucle | Preparación, salto, aterrizaje amortiguado y gesto de alegría |
| `Wave` | 2,5 s | Bucle | Elevación de la mano libre, tres oscilaciones y retorno |
| `Talk` | 3,2 s | Una vez | Inspiración, invitación, énfasis, movimiento de cabeza y boca |

El servidor envía `drawDurationMs` y `drawEndsAt`: la extracción dura cinco segundos también con los efectos desactivados. Durante el marcado se encadena `PickBall → ShowBall → DropBall → Talk → Idle`, sin bloquear a los jugadores. Cambiar de turno interrumpe la cadena pendiente y retira la bola anterior; las actualizaciones del mismo turno no reinician el gesto.

En resultados, `Celebrate` continúa en bucle hasta abandonar esa pantalla o empezar otra partida. Los cuatro bucles corporales tienen poses coincidentes al principio y al final. Los pies permanecen apoyados salvo durante el salto.

`bingo-speech.js` convierte los 90 números a texto español y genera visemas. En el juego, `bingo-audio.js` reproduce las locuciones locales y entrega la articulación al personaje según el reloj y la energía del WAV; la boca descansa en silencios y no habla sin voz. «¡Bingo! ¡Enhorabuena!» también articula durante `Celebrate`, manteniendo su bucle corporal; al terminar la voz suena la fanfarria. Los contactos de recogida y el destello siguen el tiempo real de los clips. La pose de presentación puede mantenerse hasta terminar una frase, sin retrasar un nuevo turno. La vista de revisión sin audio conserva la articulación visual de demostración. Véase [audio y sincronización](audio.md).

## Brazo, manivela y manos

La posición del personaje deja la muñeca por delante del hombro durante toda la vuelta. El codo conserva el sentido de flexión y queda bajo el hombro; el antebrazo acompaña la orientación de la mano. El agarre permanece transversal al eje del mango: el mango gira bajo la mano mientras esta bascula con el codo, sin transmitirle una vuelta axial completa. Al recoger la bola, el torso se inclina hacia la bandeja y la trayectoria empieza a volver hacia el cuerpo antes de incorporarse.

`hand_poses.py` define reposo, presentación, saludo, agarre, bola, énfasis y puño. En reposo, la flexión proximal aumenta aproximadamente de 18° a 30° del índice al meñique y la distal de 22° a 38°. Las puntas se curvan hacia la palma. El pulgar tiene flexión, aducción y oposición propias. Una variación leve desfasada entre dedos evita la inmovilidad y se atenúa al sujetar objetos; el puño se reserva para el acento de celebración.

Las mezclas usan una curva suave con velocidad nula en los extremos. `Talk` extiende gradualmente el índice; `PickBall` abre antes del contacto y cierra al recoger; `ShowBall` sostiene la bola y `DropBall` la libera progresivamente.

Referencias utilizadas para adaptar el movimiento al personaje:

- [Loughborough University: posición longitudinal de una manivela](https://www.lboro.ac.uk/research/phc/resources/research-outputs/horizontal-crank-position-hand-cycling/).
- [Kouwijzer y colaboradores: cinemática de hombro y tórax](https://pmc.ncbi.nlm.nih.gov/articles/PMC6850573/).
- [OSHA: brazo, manos y muñecas](https://www.osha.gov/etools/electrical-contractors/supplemental-information/solutions/tasks-hand).
- [CURRENT Diagnosis & Treatment Rheumatology, lámina 1](https://accessmedicine.mhmedical.com/Content.aspx?bookid=506&sectionid=42584966): cascada de reposo con flexión creciente hacia el meñique.
- [Mason, Gomez y Ebner: Hand Synergies During Reach-to-Grasp](https://journals.physiology.org/doi/full/10.1152/jn.2001.86.6.2896): evolución de la forma de la mano durante el alcance.
- [Kivell: Form, function and evolution of the human hand](https://onlinelibrary.wiley.com/doi/full/10.1002/ajpa.24667): oposición del pulgar.

Los ángulos y umbrales son decisiones para un rig caricaturesco de dos huesos por dedo, no una evaluación ergonómica ni una reproducción clínica de todas las articulaciones humanas.

## Bolas y controlador de Three.js

`BingoBallLibrary` contiene los prototipos `BingoBallTemplate_001` a `090`, con el número en `userData.number`. Comparten la esfera y cada número es una malla adaptada a su superficie: no necesitan texturas ni fuentes externas. La biblioteca permanece oculta; el controlador clona el prototipo solicitado a escala unitaria.

`BallSocket` sigue `Hand_R`; `BallPickupPoint` está en la bandeja y `DropBallSocket` define el arco de liberación. El controlador mantiene el número orientado hacia el público. La bola y las estrellas usan materiales propios que se liberan al terminar; las bolas del bombo se asientan cuando este para.

`presenter.js` monta la escena y expone `update(state)` y `dispose()`. `bingo-character.js` carga el GLB, controla el esqueleto y ofrece `playBingoAnimation`, `showBingoBall`, `removeBingoBall`, `stopAnimations`, `setDrumAngle`, `update` y `dispose`. `fade` controla el fundido; `restart:true` reinicia una acción y `after:false` desactiva su continuación automática. El HTML resuelve Three.js y sus complementos con el importmap local.

```js
import { loadBingoCharacter } from '/games/bingo/bingo-character.js';

const presenter = await loadBingoCharacter({scene, camera});
presenter.showBingoBall(28, {at:'pickup'});
presenter.playBingoAnimation('PickBall');
// En el bucle de dibujo:
presenter.update(deltaSeconds);
// Al desmontar:
presenter.dispose();
```

La herramienta de desarrollo está en `tests/browser/fixtures/bingo-character-preview.html` y su módulo asociado. La pasarela de pruebas la sirve en `/review/bingo-character/`; utiliza el mismo GLB para revisar los nueve clips y la cadena de recogida y presentación. No forma parte de la carpeta pública del juego ni se sirve desde el centro habitual.

## Encuadre, escenario y rendimiento

`presenter-framing.js` usa la envolvente animada `presentation_bounds` del personaje y el bombo para ajustar una cámara ortográfica. El decorado exterior puede recortarse. `presenter.css` reserva el 26% superior para el rótulo BINGO, separado de la imagen y del canvas; la envolvente completa del anfitrión y el bombo se encuadra en el área inferior. La resolución y el aspecto de WebGL se calculan sobre ese área, tanto en el juego como en la vista de revisión. En pantallas compactas el rótulo se alinea a la derecha para no coincidir con el aviso de la bola. `presenter-stage.js` comparte tarima e iluminación entre el juego y la vista de revisión; el canvas transparente deja ver el [telón SVG](../public/assets/presenter-backdrop.svg) azul oscuro y burdeos.

La carga es diferida y exclusiva de TV con efectos habilitados. El dibujo se limita a 30 FPS durante acciones y 24 FPS en espera, con resolución de píxel limitada a 1,25 y pausa con la pestaña oculta. El modo estático, movimiento reducido o un fallo de WebGL muestra `presenter-static.webp`, una ilustración artística del mismo personaje y bombo sobre el telón existente. El tablero adapta las 90 bolas al espacio disponible sin scroll de página; véanse [interfaz](interface.md) y [verificación](verification.md).

## Editar, exportar y validar

Abrir el único `.blend` y trabajar en `Bingo_Character_TV_v8`. Para ver una acción, asignarla a `BingoCharacter_Rig` con la mezcla NLA desactivada. Para el giro, asignar también `DrumSpin` al rotor y a sus bolas, en el mismo fotograma. Las pistas NLA almacenan los clips para exportarlos por separado.

Los scripts de [art/blender/v8/](../art/blender/v8/) se ejecutan dentro del Blender abierto, sin lanzar otra instancia:

1. Editar directamente el archivo o ajustar `hand_poses.py` y ejecutar `update_hands.py` para hornear solo los dedos. Su informe compara el hash de todos los canales ajenos a los dedos antes y después.
2. Ejecutar `validate_hands.py`, `validate_expressive.py` y `validate_crank.py`.
3. Ejecutar `export_bingo.py` para sustituir el GLB público y `roundtrip_bingo.py` para reimportarlo, revisar sus clips y retirar los objetos temporales.
4. Guardar el `.blend`, actualizar la versión de caché en `bingo-character.js` cuando cambie el GLB y ejecutar `npm test` dentro de Docker según [operación](operations.md).

El exportador usa exclusivamente las colecciones del modelo actual: no construye geometría antigua ni necesita archivos de otras versiones. Exporta nueve clips, 45 huesos, 19 mallas deformables, 90 prototipos y ningún decorado o cámara de revisión.

Pasan las 33 pruebas de la revisión aprobada, incluidas las del GLB real con Three.js. Se comprueban pesos, continuidad entre claves, apoyos, contacto con la manivela, codos y muñecas, cascada de dedos, bolas, encuadre y victoria continua. El cambio máximo de dedos entre medias claves ronda 1,73° y el error interpolado de agarre es inferior a 0,4 mm.

Informes actuales: [animación](../art/blender/v8/animation-validation.json), [manivela](../art/blender/v8/crank-anatomy-validation.json), [manos](../art/blender/v8/hands-validation.json), [exportación](../art/blender/v8/glb-export-report.json), [reimportación](../art/blender/v8/glb-roundtrip-validation.json) y [Three.js](../art/blender/v8/three-validation.json).

Las capturas y vídeos temporales de inspección se retiran al terminar la revisión. Las fuentes editables, los validadores y sus informes actuales se conservan para mantenimiento. Las colisiones son muestreadas y no garantizan cualquier superficie durante todas las transiciones interrumpidas. No se han medido FPS en dispositivos físicos. Las comprobaciones anteriores de tamaños en Chromium no equivalen a repetir esa grabación completa con cada cambio del modelo.

## Imagen del modo estático

`art/source/presenter-static.png` es una ilustración artística 2D del mismo anfitrión, creada con la herramienta integrada de generación de imágenes y el modelo aprobado como referencia de identidad. Conserva cabeza calva, pelo gris lateral, gafas redondas, bigote, chaleco y pajarita rojos, camisa blanca y bombo dorado a la izquierda del público. Tiene acabado pictórico de gouache y lápiz, expresión cercana y fondo realmente transparente; no utiliza una captura del modelo 3D como imagen final.

El [prompt y la procedencia](../art/source/presenter-static.prompt.md) documentan la creación. `scripts/prepare-assets.mjs` recorta el margen transparente y genera `public/assets/presenter-static.webp` a 840 píxeles, incluidos 28 píxeles de separación a cada lado. El selector de TV usa esta ilustración, y la partida y los resultados la muestran cuando no hay canvas, también con movimiento reducido o fallo de WebGL. El Game Center utiliza `presenter-cover.webp`, ilustración complementaria del mismo señor, conservando el BIN / GO! y la bola 90 en SVG. No se conservan los recursos del anfitrión anterior. Para sustituirla, actualizar el PNG fuente y reconstruir Docker; cambiar su versión de caché en `views.js`.
