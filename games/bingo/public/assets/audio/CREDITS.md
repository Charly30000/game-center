# Audio de Bingo

## Efectos de Kenney — CC0

Autor: Kenney / Kenney Vleugels, https://kenney.nl. Descargados de sus paquetes oficiales el 9 de noviembre de 2026. Los WAV son conversiones mono a 24 kHz y 16 bits de los OGG originales, sin alterar su duración. Conservan [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

| Paquete original | Archivos utilizados (OGG original → WAV) | Aviso original |
| --- | --- | --- |
| [Casino Audio 1.1](https://kenney.nl/assets/casino-audio) | `dice-shake-1`, `chip-lay-1`, `card-slide-1`, `card-place-1` | [LICENSE-casino.txt](LICENSE-casino.txt) |
| [Interface Sounds 1.0](https://kenney.nl/assets/interface-sounds) | `maximize_001`, `confirmation_001`, `error_001` | [LICENSE-interface.txt](LICENSE-interface.txt) |
| [Music Jingles](https://kenney.nl/assets/music-jingles) | `jingles_PIZZI03` (derrota), de Pizzicato jingles | [LICENSE-jingles.txt](LICENSE-jingles.txt) |

`manifest.json` incluye las huellas SHA-256 de los originales y de sus conversiones. Estos recursos de terceros mantienen CC0, independientemente de la licencia general del proyecto.

## Fanfarria de victoria — CC0

`victory-fanfare.wav` utiliza [Hyper-Ultra-Fanfare](https://opengameart.org/content/hyper-ultra-fanfare), de **Zane Little Music**, publicada en OpenGameArt el 8 de marzo de 2023 con licencia CC0. Descargada el 9 de noviembre de 2026 desde [sboe.wav](https://opengameart.org/sites/default/files/sboe.wav). Se conserva el original en `art/audio/victory-fanfare.wav`; la versión del juego es mono a 24 kHz y 16 bits, con la misma composición y duración de aproximadamente 6,125 segundos. [Aviso y procedencia](LICENSE-victory.txt). Sustituye el anterior sonido de victoria de Kenney; el sonido de derrota se conserva.

## Música de fondo — CC0

`background-calm.mp3` es [Contemplation](https://opengameart.org/content/contemplation-0), de **Joth**, publicada el 1 de julio de 2018 con licencia CC0 / dominio público. Descargada el 9 de noviembre de 2026 desde [Contemplation.mp3](https://opengameart.org/sites/default/files/Contemplation.mp3). Su autor la presenta como una pieza ambiental sin melodía protagonista. Se distribuye el MP3 original sin cambios de audio, renombrado para el juego; sustituye la música anterior. [Licencia, procedencia y SHA-256](LICENSE-music.txt).

## Locuciones locales

Los 90 números, la invitación y «¡Bingo! ¡Enhorabuena!» de `voice/` se han preparado para este proyecto con Piper y la voz española abierta `es_ES-davefx-medium`, y se distribuyen bajo la [licencia Apache 2.0 del proyecto](../../../../../LICENSE). No son grabaciones descargadas de un locutor contratado.

Procedencia: [modelo y ficha de davefx](https://huggingface.co/rhasspy/piper-voices/blob/main/es/es_ES/davefx/medium/MODEL_CARD), conjunto de grabaciones CC0 de [OHF Voice](https://github.com/OHF-Voice/voice-datasets); repositorio de voces identificado como MIT. La herramienta utilizada fue [Piper 2023.11.14-2](https://github.com/rhasspy/piper/releases/tag/2023.11.14-2), con licencia [MIT](https://github.com/rhasspy/piper/blob/2023.11.14-2/LICENSE.md). Ni el modelo ni el sintetizador se redistribuyen con el juego. Véanse [preparación y hashes de las herramientas](../../../docs/audio.md) y `voice/manifest.json`.
