# Conexión al Game Center por QR

La portada del centro incluye un QR vectorial en blanco y negro y, justo debajo, su URL completa como enlace y texto seleccionable. El código abre la raíz del Game Center, sin rutas de juegos ni credenciales. Los dispositivos deben poder acceder al puerto publicado del ordenador y estar en la misma red doméstica.

## Dirección del anfitrión

Dentro de Docker Desktop, las interfaces del contenedor y `host.docker.internal` pertenecen a su red virtual y no identifican necesariamente la dirección LAN que necesita un teléfono. Por eso no se toma como dirección de acceso el resultado de consultar las interfaces desde el contenedor. Véase [la documentación de red de Docker Desktop](https://docs.docker.com/desktop/features/networking/networking-how-tos/).

Ejecutar los scripts desde una terminal del anfitrión, no dentro del contenedor del centro.

En Windows, iniciar desde la raíz del proyecto con:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start.ps1
```

`scripts/start.ps1` consulta las interfaces mediante las API de red de .NET. Selecciona Ethernet/Wi-Fi activas con puerta de enlace IPv4, excluye loopback, direcciones de enlace y adaptadores virtuales, Docker, WSL o VPN. Prioriza Ethernet y después Wi-Fi. Pasa `http://<ip-detectada>:3000` a Compose mediante `GAMECENTER_DETECTED_URL`, solo para el proceso hijo y sin modificar variables persistentes del sistema ni crear archivos de red.

En Linux:

```sh
sh ./scripts/start.sh
```

Requiere Docker Compose e `ip` (iproute2). Ordena las rutas predeterminadas por métrica y descarta interfaces conocidas de Docker, virtualización y VPN. Pasa la URL del mismo modo, sin escribir archivos ni instalar herramientas.

## URL configurable en Compose

El centro recibe `GAMECENTER_URL` y la publica en `GET /api/connection`, con caché desactivada. El navegador consulta esa API para generar el QR y su enlace. Ya no se utiliza `runtime/host-network.json` ni un volumen de conexión.

La configuración predeterminada de `compose.yaml` utiliza la URL indicada en el entorno de Compose o, en su ausencia, la detectada por el script:

```yaml
environment:
  GAMECENTER_URL: "${GAMECENTER_URL:-${GAMECENTER_DETECTED_URL:-}}"
```

Para utilizar una IP fija, sustituir esa línea directamente en `compose.yaml`:

```yaml
  GAMECENTER_URL: "http://192.168.1.50:3000"
```

También admite un dominio con HTTPS y su puerto público. La URL configurada tiene prioridad sobre la dirección usada para abrir la página. El QR apunta a su raíz, sin rutas, consultas, fragmentos ni credenciales. Si la URL es inválida o apunta a localhost, no se muestra un QR engañoso. Sin configuración se puede compartir una entrada directa por IP LAN o dominio accesible; entrar por localhost requiere la URL configurada o detectada.

La detección genera una URL HTTP con el puerto publicado predeterminado `3000`. Si se cambia el puerto publicado o se utiliza HTTPS, configurar la URL completa correspondiente. Con varias interfaces se utiliza la primera según la prioridad del script; para elegir otra, fijar la URL.

Si cambia la IP o la configuración, volver a ejecutar el script de arranque y recargar el centro. Compose puede recrear el contenedor del centro para aplicar su nueva variable; los contenedores de juegos existentes permanecen independientes. No basta con recargar la página, porque la variable se recibe al crear el contenedor.

`-PrepareOnly` en Windows y `--prepare-only` en Linux solo muestran la URL detectada: no escriben archivos, no actualizan el centro ni ejecutan Docker. Se mantienen para consultar la detección sin arrancar servicios. Si no se encuentra IP, se muestra un aviso y el arranque normal permite usar la URL fija de Compose.

El parámetro `-ExecutionPolicy Bypass` se limita al proceso del script propio; no cambia directivas persistentes. Los scripts no instalan herramientas ni alteran la red del anfitrión.

## Generación y tamaño

La biblioteca local [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) se fija en `package-lock.json` y se prepara desde Docker como módulo local. El navegador genera un SVG con corrección M, negro sobre blanco y cuatro módulos de margen blanco. No se usan servicios QR externos ni se envía la dirección a terceros.

La zona del QR mide entre 224 y 360 píxeles CSS según la pantalla. En pantallas amplias permanece a la izquierda, con una línea vertical de separación; la página y la columna del QR no se desplazan y solo el catálogo tiene scroll propio. En pantallas de hasta 850 píxeles de ancho se utiliza un listado vertical: primero el QR, después la cabecera y las tarjetas, con scroll normal de página. El QR siempre es cuadrado y su imagen se escala como vector.

## Verificación

`tests/connection-url.test.mjs` cubre la URL configurada, su prioridad, puertos públicos, HTTPS, direcciones inválidas, ausencia de localhost y el SVG con su margen. Las pruebas actualizadas quedan pendientes de ejecución tras este cambio.

`tests/browser/connection.mjs` abre la página como localhost con una red simulada, comprueba que URL y QR son visibles y utiliza el lector independiente `jsQR` sobre los píxeles renderizados. Verifica que el resultado coincide exactamente con el texto del enlace en 1920×1080, 1280×720, 960×540, 800×480, 667×375, 568×320, 390×844 y 320×568. Incluye cambio de IP y ausencia de un QR de localhost cuando falta una dirección válida. Añade un catálogo largo para comprobar que el QR no se mueve al desplazar las tarjetas en escritorio y que en móvil está antes del listado y utiliza scroll normal. La verificación histórica del script Linux con interfaces simuladas corresponde al transporte anterior mediante archivo; el nuevo paso de la URL por entorno queda pendiente de ejecución, al igual que las pruebas de navegador actualizadas. No se ha probado sobre un anfitrión Linux físico.

```powershell
docker build -f tests/browser/Dockerfile -t gamecenter-browser-tests:local .
New-Item -ItemType Directory -Force artifacts
docker run --rm --network gamecenter-internal --cpus=1 --memory=512m --shm-size=128m --mount "type=bind,source=$((Get-Location).Path)\artifacts,target=/artifacts" gamecenter-browser-tests:local node connection.mjs
```

El centro debe estar activo. La prueba solo consulta el catálogo y los recursos públicos; no inicia ni modifica partidas. Sus capturas e informe quedan en `artifacts/connection/`. La decodificación y los tamaños se comprueban en Chromium; no se garantiza una distancia de escaneo para todas las cámaras y televisores físicos.
