# Operación

Todos los comandos siguientes se lanzan desde la raíz del proyecto. Las instalaciones y las pruebas se realizan dentro de Docker, sin instalar Node, fuentes, Sharp o Chromium en el anfitrión.

Para preparar otro videojuego, usar el [asistente `npm run game:create`](new-game.md#generar-la-base-con-el-asistente). La guía contiene las variantes Docker para Windows/Linux, las decisiones obligatorias y el modo de simulación. El asistente escribe los archivos y el registro del proyecto; no despliega ni reinicia servicios.

## Uso diario

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start.ps1
docker compose ps
docker compose logs --tail 100
docker ps --filter label=app.gamecenter.owner=gamecenter-local
```

La dirección local es `http://localhost:3000`. Los demás dispositivos usan la IP o el nombre accesible del ordenador en la LAN. La red Docker es `gamecenter-internal`; solo el centro publica `3000:3000`.

En Linux, el comando equivalente es `sh ./scripts/start.sh`, con `ip` (iproute2) y Docker Compose disponibles. El script de arranque detecta la dirección IPv4 del anfitrión antes de iniciar Compose, para mostrar el QR y la URL correctos incluso al entrar por localhost. Para actualizar solo esa dirección, usar el mismo comando con `-PrepareOnly` en Windows o `--prepare-only` en Linux y recargar la página. No cambia variables del sistema ni instala herramientas en Windows. Detalles y límites en [conexión por QR](connection.md).

Al actualizar código, reconstruir cambia la imagen del centro. Un bingo ya iniciado conserva su contenedor e imagen para no interrumpir una partida; para actualizarlo también, termina primero esa partida y retira su contenedor con el comando de apagado de juegos. El siguiente acceso lo creará con la imagen nueva.

## Apagar el proyecto completo

Estos comandos terminan partidas y eliminan el estado en memoria. Ejecútalos solo cuando queráis dejar de jugar:

```powershell
docker compose exec center node scripts/stop-games.mjs
docker compose down
```

`stop-games.mjs` filtra únicamente la etiqueta de propietario de esta instancia. Nunca elimina los contenedores de otros proyectos. Los juegos dinámicos no son servicios de Compose, por eso se retiran antes de eliminar la red.

## Pruebas de dominio

```powershell
docker compose build
docker run --rm gamecenter-runtime:local npm test
```

No requieren un centro levantado ni acceso al socket de Docker. Comprueban el catálogo, reglas, privacidad, barreras de turno, recuperación y ciclo de vida con un adaptador Docker simulado.

## Pruebas de los juegos

Las pruebas de navegador, partidas completas y preparación de recursos se documentan dentro de cada juego: [Bingo](../games/bingo/docs/operations.md).

## Configuración del contenedor

| Variable | Valor predeterminado | Función |
| --- | --- | --- |
| `PORT` | 3000 en centro, 3001 en Bingo | Puerto interno |
| `GAME_IMAGE` | `gamecenter-runtime:local` | Imagen fija de los juegos |
| `GAME_NETWORK` | `gamecenter-internal` | Red interna compartida |
| `GAME_IDLE_MS` | 86400000 | 24 horas sin conexiones |
| `GAME_GC_INTERVAL_MS` | 60000 | Frecuencia del recolector, mínimo 250 ms |
| `GAME_NAMESPACE` | `gamecenter` | Prefijo de contenedores y propietario; útil para instancias separadas |
| `DOCKER_SOCKET` | `/var/run/docker.sock` | Socket disponible solo en el centro |


Se configuran en Compose o en un contenedor; no es necesario modificar variables del sistema operativo principal.

## Diagnóstico

- **El catálogo abre pero no el juego:** consultar los logs del centro y comprobar que Docker Desktop utiliza contenedores Linux y que existe la imagen `gamecenter-runtime:local`.
- **El móvil no abre la página:** usar la IP del ordenador, la misma Wi-Fi y revisar manualmente las reglas de red privada del anfitrión. No se modifican automáticamente.
- **La televisión va lenta:** desactivar los efectos antes de iniciar; se conserva una imagen estática sin descargar Three.js.
- **Sesiones y recuperación:** consultar la documentación del juego; [Bingo: sesiones](../games/bingo/docs/interface.md).
- **No aparece instalar:** con IP local sobre HTTP normalmente no se cumple el contexto seguro. Configurar HTTPS mediante un proxy y certificado de confianza en los dispositivos. La partida funciona en HTTP; instalar la PWA es una capacidad adicional del navegador.
- **Reinició el contenedor del juego:** el estado estaba en memoria, así que la partida anterior no se puede recuperar. No existe una promesa de persistencia ante fallos del servidor.
- **Televisores antiguos:** se necesitan módulos JavaScript, WebSocket y CSS Grid. Si el navegador integrado es demasiado antiguo, utilizar un dispositivo conectado a la TV con navegador actualizado.
