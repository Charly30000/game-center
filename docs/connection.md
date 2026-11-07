# Conexión al Game Center por QR

La portada del centro incluye un QR vectorial en blanco y negro y, justo debajo, su URL completa como enlace y texto seleccionable. El código abre la raíz del Game Center, sin rutas de juegos ni credenciales. Los dispositivos deben poder acceder al puerto publicado del ordenador y estar en la misma red doméstica.

## Dirección del anfitrión

Dentro de Docker Desktop, las interfaces del contenedor y `host.docker.internal` pertenecen a su red virtual y no identifican necesariamente la dirección LAN que necesita un teléfono. Por eso no se toma como dirección de acceso el resultado de consultar las interfaces desde el contenedor. Véase [la documentación de red de Docker Desktop](https://docs.docker.com/desktop/features/networking/networking-how-tos/).

Ejecutar los scripts desde una terminal del anfitrión, no dentro del contenedor del centro.

En Windows, iniciar desde la raíz del proyecto con:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start.ps1
```

`scripts/start.ps1` consulta las interfaces mediante las API de red de .NET, sin WMI, instalaciones ni cambios en el sistema. Selecciona interfaces Ethernet/Wi-Fi activas con puerta de enlace IPv4; excluye loopback, direcciones automáticas de enlace y adaptadores identificados como virtuales, Docker, WSL o VPN. Prioriza Ethernet y después Wi-Fi. Guarda las direcciones en `runtime/host-network.json`, un archivo generado e ignorado por Git y por la construcción Docker, y arranca Compose.

En Linux se conserva el mismo flujo y formato de datos:

```sh
sh ./scripts/start.sh
```

Requiere Docker con el complemento Compose y el comando `ip` de iproute2 ya disponible. El script consulta rutas predeterminadas e interfaces IPv4 del anfitrión, ordena las rutas por su métrica y descarta interfaces conocidas de Docker, virtualización y VPN, además de loopback y direcciones de enlace. Escribe el mismo `runtime/host-network.json` mediante un archivo temporal y ejecuta Compose desde la raíz del proyecto. No instala paquetes, modifica la red ni mantiene procesos auxiliares. Se invoca con `sh` para no depender del permiso ejecutable; `.gitattributes` conserva finales LF. El script Windows permanece disponible.

Compose monta `runtime/` en `/app/public/connection/` con solo lectura. La página consulta el archivo al cargar. El puerto procede de la URL de entrada: no se sustituye por el puerto interno del contenedor. Si se ha accedido mediante una IP que coincide con otra interfaz detectada, se conserva esa interfaz. Un origen HTTPS accesible conserva su origen para no romper su certificado.

Al entrar por `localhost`, loopback o un nombre interno de Docker, se utiliza la IP detectada del anfitrión. Si no está disponible, no se muestra un QR engañoso que apunte a localhost. Una entrada directa por una dirección LAN también permite compartir esa URL sin datos de detección.

Si el ordenador cambia de Wi-Fi o de dirección, actualizar los datos y recargar el centro:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start.ps1 -PrepareOnly
```

En Linux:

```sh
sh ./scripts/start.sh --prepare-only
```

Este modo solo actualiza el archivo; no inicia, detiene ni reinicia contenedores. El montaje debe haberse creado al arrancar con el Compose actualizado. La detección se hace en cada arranque o actualización explícita, sin procesos permanentes en el anfitrión ni sondeos continuos. En ordenadores con varias redes, la dirección elegida debe pertenecer a una red accesible para los participantes.

El parámetro `-ExecutionPolicy Bypass` se limita al proceso que ejecuta el script propio; no utiliza `Set-ExecutionPolicy` ni altera una directiva persistente. Si una directiva administrada impide ejecutarlo, respetar esa política y consultar al administrador.

## Generación y tamaño

La biblioteca local [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) se fija en `package-lock.json` y se prepara desde Docker como módulo local. El navegador genera un SVG con corrección M, negro sobre blanco y cuatro módulos de margen blanco. No se usan servicios QR externos ni se envía la dirección a terceros.

La zona del QR mide entre 224 y 360 píxeles CSS según la pantalla. En pantallas amplias permanece a la izquierda, con una línea vertical de separación; la página y la columna del QR no se desplazan y solo el catálogo tiene scroll propio. En pantallas de hasta 850 píxeles de ancho se utiliza un listado vertical: primero el QR, después la cabecera y las tarjetas, con scroll normal de página. El QR siempre es cuadrado y su imagen se escala como vector.

## Verificación

`tests/connection-url.test.mjs` comprueba localhost, IPv4/IPv6 de loopback, nombres internos, direcciones inválidas, puerto publicado, varias interfaces, cambio de dirección, HTTPS y generación del SVG con su margen.

`tests/browser/connection.mjs` abre la página como localhost con una red simulada, comprueba que URL y QR son visibles y utiliza el lector independiente `jsQR` sobre los píxeles renderizados. Verifica que el resultado coincide exactamente con el texto del enlace en 1920×1080, 1280×720, 960×540, 800×480, 667×375, 568×320, 390×844 y 320×568. Incluye cambio de IP y ausencia de un QR de localhost cuando falta una dirección válida. Añade un catálogo largo para comprobar que el QR no se mueve al desplazar las tarjetas en escritorio y que en móvil está antes del listado y utiliza scroll normal. El script Linux se ha comprobado en un contenedor Linux con rutas e interfaces simuladas: prioridad de rutas, exclusión de adaptadores virtuales, modo de preparación sin arrancar Docker, red vacía y paso de argumentos a Compose. No se ha probado sobre un anfitrión Linux físico.

```powershell
docker build -f tests/browser/Dockerfile -t gamecenter-browser-tests:local .
New-Item -ItemType Directory -Force artifacts
docker run --rm --network gamecenter-internal --cpus=1 --memory=512m --shm-size=128m --mount "type=bind,source=$((Get-Location).Path)\artifacts,target=/artifacts" gamecenter-browser-tests:local node connection.mjs
```

El centro debe estar activo. La prueba solo consulta el catálogo y los recursos públicos; no inicia ni modifica partidas. Sus capturas e informe quedan en `artifacts/connection/`. La decodificación y los tamaños se comprueban en Chromium; no se garantiza una distancia de escaneo para todas las cámaras y televisores físicos.
