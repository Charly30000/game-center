# Sonido del Bingo

El audio pertenece exclusivamente a `games/bingo/`. No se importa desde el centro ni desde otros juegos. El servidor sigue decidiendo números, acciones y ritmo; ninguna locución retrasa la partida.

## Reparto entre pantallas

| Pantalla | Sonidos |
| --- | --- |
| TV | Agitación del bombo durante la extracción, contacto al recoger la bola, anuncio en español del número real, desaparición con estrellas y «¡Bingo! ¡Enhorabuena!» seguido de fanfarria. |
| Jugador | Cambio de avatar o cartón, confirmación del perfil, ficha al marcar un número aceptado por el servidor, Continuar, error y sonido personal de victoria o derrota. |

Los móviles no pronuncian números ni el bingo ni reproducen el bombo. Al finalizar, cada participante reproduce victoria si su identificador está en `state.winners`, incluyendo empates, y derrota si no lo está. Los espectadores que no participaron no reciben un sonido de derrota. El resultado siempre procede del servidor. La TV pronuncia «¡Bingo! ¡Enhorabuena!» con un ritmo más vivo y después reproduce la fanfarria, sin superponer ambos audios. Cada pantalla utiliza un solo efecto a la vez; la locución de TV tiene prioridad y corta los efectos. La música de fondo dispone de un canal independiente y exclusivo de TV. Las marcas repetidas no repiten el sonido. La celebración y el resultado personal suenan una sola vez por partida e identidad aunque `Celebrate` siga en bucle, lleguen fotografías repetidas o se reconecte. La invitación «Marca tus números y pulsa continuar» se pronuncia una vez por partida, al llegar a `Talk`.

La victoria utiliza `victory-fanfare.wav`: **Hyper-Ultra-Fanfare**, de Zane Little Music (CC0), un efecto de victoria enérgico de aproximadamente 6,125 segundos. Se reproduce completo y una sola vez; puede interrumpirse al empezar otra partida o silenciar. La derrota conserva `jingles_PIZZI03.wav`. La locución «¡Bingo! ¡Enhorabuena!» no cambia.

El botón de altavoz silencia únicamente ese dispositivo. En una habitación con varias TV se pueden silenciar las pantallas secundarias: el audio no elige automáticamente una TV principal. El silencio se conserva durante esa visita, sin guardar el rol ni cambiar reglas compartidas. La reproducción requiere una interacción: elegir TV/Jugador, pulsar una tecla del mando o activar el altavoz. Si el navegador bloquea el audio, el juego permanece utilizable y el botón permite volver a intentarlo.

## Música tranquila de TV

La TV reproduce **Contemplation**, de Joth (CC0), como `background-calm.mp3`: una pieza ambiental de aproximadamente 120,059 segundos y 2,4 MB, descrita por su autor como ambiente sin melodía protagonista. Sustituye el bucle corto anterior para reducir la repetición en partidas largas. Su botón **♫** activa o desactiva solo la música; las voces y efectos siguen funcionando. El altavoz conserva su función de silencio general e incluye también la música. Ambas decisiones son locales a esa visita, sin guardar el rol de TV ni modificar reglas de la sala.

`bingo-music.js` comparte el `AudioContext` del Bingo, mantiene un solo bucle entre turnos y reanuda su posición al volver a activarlo. El volumen normal es 0,25; únicamente durante la reproducción efectiva de una locución `number-*` baja suavemente a 0,05 y después vuelve a subir con una recuperación gradual (constante de tiempo de 0,6 segundos). La carga del archivo, el bombo, la recogida, las estrellas y la invitación a continuar no reducen la música. La ganancia normal se elevó desde 0,05 porque esta pista ambiental resultaba prácticamente imperceptible. En resultados se detiene para dejar sitio a «¡Bingo!» y a la fanfarria. Se pausa también al salir, ocultar la pestaña, perder conexión o silenciar todo. Los móviles no descargan ni reproducen la pista y no muestran su control. No se contacta con servicios externos durante el juego.

La pista MP3 original se conserva sin transformación, renombrada dentro de los recursos de Bingo. Su procedencia y SHA-256 están en [LICENSE-music.txt](../public/assets/audio/LICENSE-music.txt); se registra separadamente de los manifiestos de efectos y locuciones, que siguen describiendo 101 WAV.

Salir de la sesión, revocarla, perder conexión, ocultar la pestaña o cambiar de turno detiene sonidos y locuciones pendientes. Volver a una pestaña no repite números ya anunciados. La extracción puede reanudarse por el tiempo restante publicado por el servidor. Los fallos de descarga o decodificación no bloquean la partida.

## Sincronización con el personaje

`bingo-audio.js` coordina la reproducción mediante Web Audio. `presenter.js` entrega el reloj real de los clips del GLB; el controlador no programa una segunda secuencia paralela:

- `SpinDrum`: agitación durante `drawDurationMs`, con final en `drawEndsAt`.
- `PickBall`: contacto a los 1,3 segundos, cuando la bola pasa de la bandeja a la mano.
- `ShowBall`: a los 0,25 segundos comienza directamente «El número …», sin bip previo.
- `DropBall`: efecto a los 0,9 segundos, junto al destello de desaparición.
- `Talk`: invitación a los 0,3 segundos, únicamente la primera vez de cada partida.
- Resultados: se interrumpe la locución anterior; la TV anuncia el bingo y al terminar suena la fanfarria. Los móviles participantes reproducen su resultado personal. Cambiar de partida cancela también la fanfarria que estuviera esperando a la voz.

La voz consta de 92 WAV locales: los números 1–90, la invitación y el anuncio de bingo. No utiliza `speechSynthesis`, voces instaladas, micrófono, servicios de voz ni descargas externas durante el juego. Se descarga únicamente la locución necesaria. Los efectos se preparan según el rol; el móvil no necesita las locuciones ni los efectos del bombo. Las fanfarrias de victoria y derrota se cargan cuando corresponde el resultado.

La mandíbula combina los visemas españoles de `bingo-speech.js` con la energía de ventanas de 25 ms del WAV que se está reproduciendo. El reloj procede de `AudioContext.currentTime`: la boca descansa durante carga, silencios y al terminar. El anuncio de bingo también articula durante `Celebrate`, sin detener su bucle corporal. La correspondencia fonética es aproximada, no un alineamiento fonema a fonema. Si una frase de presentación termina después del gesto, se mantiene su pose final; un nuevo estado del servidor interrumpe ambos inmediatamente. La herramienta de revisión sin audio conserva la articulación visual de demostración.

Sin efectos 3D, con movimiento reducido o si falla la carga de WebGL, la TV sigue anunciando el número con la ilustración estática. Audio y animaciones son ajustes independientes.

## Recursos, licencias y mantenimiento

Los [créditos y licencias](../public/assets/audio/CREDITS.md) identifican cada sonido descargado, su autor y la página original. Los efectos de Kenney y la fanfarria de Zane Little Music conservan CC0; no se sustituyen sus avisos por Apache. Las locuciones preparadas para el proyecto se distribuyen bajo Apache 2.0. Los manifiestos de [efectos](../public/assets/audio/manifest.json) y [voz](../public/assets/audio/voice/manifest.json) conservan hashes SHA-256, duraciones y medidas de señal. Los originales OGG y WAV seleccionados están en `art/audio/`; el juego utiliza WAV mono PCM de 16 bits, compatibles con los navegadores móviles sin codecs adicionales.

La voz se preparó con Piper `2023.11.14-2` y `es_ES-davefx-medium`. La [ficha original](../art/audio/VOICE-MODEL-CARD.txt) identifica el conjunto de grabaciones como CC0; el repositorio de voces indica MIT. El modelo y Piper se descargan solo como herramientas temporales en `artifacts/audio-downloads/`, fuera de Git y del contexto Docker. No se incorporan al servidor ni se ejecutan en Windows.

- Modelo: `https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/davefx/medium/es_ES-davefx-medium.onnx` y su configuración `.onnx.json`.
- SHA-256 del modelo usado: `6658b03b1a6c316ee4c265a9896abc1393353c2d9e1bca7d66c2c442e222a917`.
- Herramienta: `https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz`.
- SHA-256 del archivo de herramienta usado: `a50cb45f355b7af1f6d758c1b360717877ba0a398cc8cbe6d2a7a3a26e225992`.

`art/audio/voice-lines.mjs` produce las 92 entradas JSON de Piper, con texto español y destino `/output/voice/`. Para regenerar los números y la invitación, ejecutar Piper dentro de un contenedor temporal con `--json-input --length_scale 1.05 --sentence_silence 0.12`, montando los WAV de salida en `/output`. Para preparar únicamente la locución festiva, ejecutar `voice-lines.mjs --bingo-only` y utilizar Piper con `--length_scale 0.88 --noise_scale 0.8 --sentence_silence 0.08`. La síntesis tiene variación: al regenerar se deben revisar y actualizar los hashes. Después ejecutar `node games/bingo/art/audio/audit.mjs` dentro de Docker: valida los 92 WAV y actualiza su manifiesto.

`tests/browser/prepare-bingo-audio.mjs` convierte los originales OGG y WAV seleccionados a WAV mono a 24 kHz con `OfflineAudioContext`. Utiliza transferencia base64 para no expandir los archivos a grandes arrays JSON durante la conversión. Se ejecuta en la imagen de pruebas, montando `games/bingo/art/audio` en `/input` y `games/bingo/public/assets/audio` en `/output`. Solo se conservan los originales utilizados. El juego no realiza esta conversión en cada arranque.

Referencias: [Casino Audio](https://kenney.nl/assets/casino-audio), [Interface Sounds](https://kenney.nl/assets/interface-sounds), [Music Jingles](https://kenney.nl/assets/music-jingles), [voz davefx](https://huggingface.co/rhasspy/piper-voices/blob/main/es/es_ES/davefx/medium/MODEL_CARD) y [reproducción y activación del usuario](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices).
