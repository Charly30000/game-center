# Game Center

Un centro de juegos para casa: una o varias televisiones comparten la partida y cada jugador utiliza su móvil. Incluye Bingo de 90 bolas, completamente jugable y con servidor autoritativo.

## Arrancar

Necesitas Docker Desktop con contenedores Linux, o Docker Engine con Compose en Linux. Ejecutar desde una terminal del ordenador anfitrión.

**Windows:**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start.ps1
```

**Linux:**

```sh
sh ./scripts/start.sh
```

Los scripts detectan la dirección LAN del anfitrión y ejecutan `docker compose up -d --build`. En Linux se utiliza `ip` (iproute2), sin necesidad de permisos de administrador para consultar la red. No instalan herramientas ni cambian las variables de entorno del sistema. El parámetro de política de Windows solo se aplica al proceso que ejecuta el script local. Los servidores y sus dependencias siguen dentro de Docker.

Abre **http://localhost:3000**. El Game Center muestra un **QR grande y la URL de red debajo**, fijos a la izquierda y separados del catálogo por una línea en pantallas amplias. Solo las tarjetas tienen scroll; en móvil aparece primero el QR y después el listado, con scroll normal de la página. Los móviles pueden entrar al centro escaneándolo o escribiéndola. La dirección se configura con `GAMECENTER_URL` en `compose.yaml`; por defecto los scripts pasan la IP detectada con el puerto 3000, incluso al abrir desde `localhost`. Puedes sustituirla por una URL fija completa con su puerto público. Todos deben estar en la misma red doméstica. Si Windows bloquea el acceso desde otros dispositivos, configura manualmente la autorización del puerto 3000 en tu red privada. Véase [conexión por QR](docs/connection.md).

Solo arranca el centro. Al pulsar **Jugar**, este crea el contenedor independiente `gamecenter-bingo`, espera a que esté preparado y abre el juego. Entradas simultáneas reutilizan el mismo contenedor. Tras 24 horas sin conexiones se retira; la comprobación se hace cada minuto. No se expone ningún puerto del bingo al anfitrión.

1. En la televisión entra en Bingo → **Televisión**.
2. En cada móvil entra en Bingo → **Jugador** para escoger nombre y avatar. Si la partida ya está iniciada, elige un nombre para recuperarlo. Una sesión válida entra automáticamente.
3. Configura entre 1 y 5 cartones (3 por defecto), el modo visual y confirma el inicio en la televisión.
4. Marca los números iluminados de todos tus cartones y pulsa **Continuar**. El bombo espera a los jugadores conectados.
5. El primer cartón completo gana. Los empates en la misma bola se resuelven juntos. La televisión permite revancha conservando las victorias o **Volver a selección**, que reinicia la sesión para todos. Solo desde el selector TV/Jugador se sale al centro.

## Documentación

Para generar la arquitectura inicial de otro videojuego, usar **`npm run game:create`** dentro de Docker: [asistente y plantilla](docs/new-game.md#generar-la-base-con-el-asistente). Pregunta por salas y avatares, crea la entrada del catálogo y deja preparados TV/Jugador, perfiles, espera y reglas compartidas. La mecánica específica se implementa después.

- [Arquitectura, Docker y cómo añadir juegos](docs/architecture.md).
- [Crear un juego: decisiones iniciales, pantallas y requisitos técnicos](docs/new-game.md).
- [Operación, comandos y diagnóstico](docs/operations.md).
- [QR de acceso y detección de la dirección LAN](docs/connection.md).
- [Navegación con mandos de televisión](docs/remote-controls.md).
- [Bingo: reglas, estados, recuperación y decisiones](games/bingo/README.md).
- [Bingo: interfaz, sesión automática y orientación](games/bingo/docs/interface.md).
- [Bingo: protocolo WebSocket](games/bingo/docs/protocol.md).
- [Bingo: recursos y diseño](games/bingo/art/README.md).
- [Verificaciones ejecutadas](docs/verification.md).
- [Instrucciones para futuros cambios](AGENTS.md).

## Pruebas dentro de Docker

```powershell
docker compose build
docker run --rm gamecenter-runtime:local npm test
```

Las pruebas de navegador usan otra imagen para que Chromium no forme parte del servidor. Consulta [operación](docs/operations.md) antes de ejecutarlas: crean y cancelan partidas y deben utilizar una instancia de prueba.

## Datos e instalación en el móvil

El catálogo de [10.000 cartones únicos](games/bingo/data/tickets.json) está en el servidor. Cada cliente recibe exclusivamente sus cartones. La partida y las victorias se guardan en memoria; sobreviven a desconexiones de los navegadores, pero **se pierden al reiniciar o retirar el contenedor del bingo**. No se utiliza SQLite en este juego.

El botón **Instalar aplicación** utiliza las funciones PWA del navegador. La instalación y el service worker requieren **HTTPS** o `localhost`: acceder por una IP de la red con HTTP permite jugar, pero habitualmente no instalar la aplicación. En iPhone se utiliza Compartir → Añadir a la pantalla de inicio cuando el navegador lo permite. La aplicación instalada sigue necesitando conexión con el servidor para jugar.

El centro accede al socket de Docker para gestionar los juegos. Ese acceso tiene privilegios sobre Docker; esta configuración está destinada a una red doméstica de confianza. Los juegos no reciben el socket y funcionan sin privilegios, con sistema de archivos de solo lectura y límites de memoria/CPU. No publiques el puerto 3000 directamente en Internet sin añadir autenticación y proteger la administración de contenedores.

## Licencia

Salvo los componentes de terceros identificados con otra licencia, todo el contenido propio de este proyecto se distribuye bajo la [licencia Apache 2.0](LICENSE): código fuente, scripts, pruebas, documentación, datos, diseños, imágenes e ilustraciones, modelos 3D, escenas de Blender, materiales, texturas, rigs y animaciones. Esto incluye tanto los archivos fuente editables (por ejemplo, `.blend`) como sus versiones exportadas o generadas (por ejemplo, `.glb`, `.png`, `.webp` y `.svg`).

La licencia se aplica a los derechos que correspondan al titular del proyecto; no implica una garantía de exclusividad ni crea derechos de autor donde la legislación no los reconozca. Las dependencias, tipografías y demás recursos de terceros conservan sus respectivas licencias y avisos de atribución, que no quedan sustituidos por Apache 2.0.
