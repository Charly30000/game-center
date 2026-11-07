# Game Center

Un centro de juegos para casa: una o varias televisiones comparten la partida y cada jugador utiliza su móvil. Incluye Bingo de 90 bolas, completamente jugable y con servidor autoritativo.

## Arrancar

Necesitas Docker Desktop en modo de contenedores Linux. Desde esta carpeta:

```powershell
docker compose up -d --build
```

Abre **http://localhost:3000**. En la televisión y los móviles, utiliza **http://IP-DEL-ORDENADOR:3000**, estando todos en la misma Wi-Fi. `localhost` en el móvil apunta al propio móvil. Si Windows bloquea el acceso desde otros dispositivos, configura manualmente la autorización del puerto 3000 en tu red privada.

Solo arranca el centro. Al pulsar **Jugar**, este crea el contenedor independiente `gamecenter-bingo`, espera a que esté preparado y abre el juego. Entradas simultáneas reutilizan el mismo contenedor. Tras 24 horas sin conexiones se retira; la comprobación se hace cada minuto. No se expone ningún puerto del bingo al anfitrión.

1. En la televisión entra en Bingo → **Televisión**.
2. En cada móvil entra en Bingo → **Jugador** para escoger nombre y avatar. Si la partida ya está iniciada, elige un nombre para recuperarlo. Una sesión válida entra automáticamente.
3. Configura entre 1 y 5 cartones (3 por defecto), el modo visual y confirma el inicio en la televisión.
4. Marca los números iluminados de todos tus cartones y pulsa **Continuar**. El bombo espera a los jugadores conectados.
5. El primer cartón completo gana. Los empates en la misma bola se resuelven juntos. La televisión permite revancha conservando las victorias o **Volver a selección**, que reinicia la sesión para todos. Solo desde el selector TV/Jugador se sale al centro.

## Documentación

- [Arquitectura, Docker y cómo añadir juegos](docs/architecture.md).
- [Crear un juego: decisiones iniciales, pantallas y requisitos técnicos](docs/new-game.md).
- [Operación, comandos y diagnóstico](docs/operations.md).
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
