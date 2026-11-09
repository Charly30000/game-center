# Crear un juego nuevo

Esta guía define la base obligatoria de los nuevos juegos del Game Center. Leerla antes de crear un juego. El arranque debe ofrecer una experiencia equivalente a la de Bingo: TV compartida, dispositivos de jugador, preparación y reglas sincronizadas, con todas las decisiones en el servidor. Las mecánicas, diseños y recursos pertenecen a cada juego.

Consultar también [arquitectura](architecture.md), [operación](operations.md) y [mandos de TV](remote-controls.md). Bingo sirve de referencia de comportamiento: [interfaz y sesiones](../games/bingo/docs/interface.md) y [protocolo](../games/bingo/docs/protocol.md). No convertir sus reglas particulares en requisitos de otros juegos.

## Generar la base con el asistente

El comando del paquete es **`npm run game:create`**. Copia la plantilla de `templates/game/`, crea `games/<id>/` y registra el nuevo juego en `server/games.json`. No importa sistemas de otro juego, no sobrescribe un destino existente y no inicia ni reinicia servicios. No crea un videojuego completo: genera la arquitectura y un flujo demostrativo para añadir después sus mecánicas.

Ejecutar desde la raíz, dentro de Docker. Reconstruir primero la imagen si todavía no contiene el generador: `docker compose build`.

**Windows (PowerShell):**

```powershell
docker run --rm -it --network none --mount "type=bind,source=$((Get-Location).Path),target=/workspace" --workdir /workspace gamecenter-runtime:local npm run game:create
```

**Linux:**

```sh
docker run --rm -it --network none --user "$(id -u):$(id -g)" --mount "type=bind,source=$(pwd),target=/workspace" --workdir /workspace gamecenter-runtime:local npm run game:create
```

En Linux, usar el usuario del anfitrión evita archivos propiedad de root. El asistente solo requiere módulos incorporados de Node; no instala paquetes ni necesita Internet o socket Docker. El montaje concede escritura únicamente al proyecto. Para inspeccionar opciones: añadir `-- --help` al comando del paquete.

Pregunta por nombre, identificador, salas, avatares, límites de jugadores y orientación del móvil. **Salas y avatares nunca se deducen:** en ejecución no interactiva son obligatorios. Las salas de esta plantilla son públicas en la LAN, sin contraseña, con nombre y código visible de seis caracteres, máximo 24, cierre desde TV en lobby y retirada tras 24 horas vacías. Si se necesitan permisos privados, contraseñas o persistencia, hay que acordarlos e implementarlos antes de publicar. **Los nombres son siempre únicos en todo el videojuego, también entre salas**; no se pregunta ni se ofrece una opción para permitir duplicados.

Ejemplo no interactivo, con la misma envoltura Docker anterior:

```text
npm run game:create -- --id mi-juego --name "Mi juego" --rooms yes --avatars own --min-players 2 --max-players 12 --orientation landscape
```

- `--avatars own`: crea ocho avatares geométricos SVG provisionales, además de portada, icono y símbolos TV/Jugador propios. Sustituirlos después por la identidad artística del juego.
- `--avatars bingo` (u otro ID): declara autorización para copiar los archivos de `games/<origen>/public/assets/avatars/` a la nueva carpeta. Solo copia imágenes normales, no enlaces ni los demás recursos del juego de origen. Revisar las licencias y adaptar posteriormente el diseño.
- `--rooms no`: sala única; no aparece la pantalla de salas. Con `yes`, aparece antes del selector de dispositivo.
- `--dry-run`: valida decisiones y muestra los archivos sin escribir ni registrar nada. No omite las decisiones obligatorias.

Cada pregunta se valida antes de continuar y se repite mediante un `do…while` si la respuesta es inválida. La orientación muestra **1. Horizontal (landscape)** y **2. Vertical (portrait)**; pulsar Enter elige horizontal. Los avatares muestran **0. Crear propios** y los juegos registrados por su número y nombre; seleccionar un juego autoriza copiar sus avatares. Los parámetros no interactivos conservan sus valores textuales y también admiten esos números; un parámetro inválido termina inmediatamente con su error, sin crear archivos.

Todos los juegos, incluido Bingo, siguen el mismo registro y validación. `number` establece el orden del catálogo: **Bingo es el 1** y cada alta recibe el mayor número existente más uno (2, 3…). Los números existentes no se recalculan ni se alteran por ordenar el JSON; no renombrar carpetas ni rutas. El puerto se asigna buscando el primero disponible desde 3001; con Bingo en 3001, el siguiente será 3002. El comando del servidor siempre es `node games/<id>/server.mjs`.

Incluye dominio, transporte WebSocket, configuración pública, perfiles sin duplicados, espera con tarjetas, reglas desde varias TV, recuperación y toma de sesión, navegación, control de pantalla completa, orientación opcional y documentación del juego. Las reglas iniciales `rounds` (1–20) y la finalización desde TV permiten probar el flujo; **no implementan turnos, azar, puntuaciones ni ganadores**.

Después de generar:

1. Revisar las decisiones en el README del juego y completar su mecánica en el dominio.
2. Ejecutar las pruebas en Docker. `npm test` descubre también los tests de cada `games/<id>/tests/`; no hay que editar el comando por juego.
3. Reconstruir la imagen para incluir sus archivos. El catálogo se lee al arrancar el centro: recrearlo requiere autorización y debe planificarse conforme a [operación](operations.md). El asistente no lo hace automáticamente.
4. Completar las comprobaciones de esta guía, especialmente salas, recuperación, mandos y tamaños. Registrar lo realmente verificado en los documentos del nuevo juego.
5. Actualizar la sección **Juegos disponibles** del [README principal](../README.md) en el mismo cambio que incorpora el juego. Mantener una lista numerada sencilla con el nombre y un enlace al README de cada juego, siguiendo el orden de `number` de `server/games.json`. Incluir solo juegos disponibles, sin anunciar los que estén pendientes de implementar; actualizar también la lista si se retira o cambia de nombre alguno.

Si aparece `.game-create.lock`, hay una creación en curso. No borrarlo mientras siga ejecutándose; tras una interrupción, comprobar primero que terminó el asistente. La escritura se prepara en una carpeta temporal y el registro se sustituye de forma atómica; un fallo revierte los archivos nuevos de esa ejecución, sin sobrescribir juegos existentes.

## 1. Acordar las decisiones iniciales

Hay dos consultas obligatorias al usuario antes de implementar las partes dependientes. Si ya las ha respondido explícitamente en el encargo o en la conversación, registrar esa decisión; nunca inferirla por parecerse a otro juego.

1. **¿Habrá una única partida compartida o un sistema de salas?** No copiar automáticamente la sala única de Bingo. Si habrá salas, su pantalla de selección o creación estará **justo antes de elegir Televisión/Jugador**. Concretar cómo se crean, identifican, encuentran y cierran, sus límites y si necesitan código de acceso. Todas las pantallas deben mostrar claramente la sala en la que están.
2. **¿Se quieren avatares de jugador nuevos o reutilizar los de algún juego concreto?** Preguntarlo siempre que no exista una respuesta explícita. No reutilizarlos por defecto. Si se autoriza, copiar los recursos necesarios a la carpeta del nuevo juego; no enlazarlos ni servirlos desde el juego de origen. La autorización para avatares no autoriza copiar portada, personajes, sonidos, fondos o diseño.

Concretar además los límites de jugadores, las reglas configurables, las condiciones de inicio y final, la entrada de participantes una vez iniciada la partida y si el estado debe sobrevivir a un reinicio. Definir la orientación del móvil durante preparación y juego. Documentar las respuestas en el README y los documentos del juego antes de consolidar esos comportamientos.

## 2. Crear una estructura independiente

Usar un identificador estable y una carpeta propia:

```text
games/<id>/
  README.md
  server.mjs
  domain/       # Estado, reglas y validaciones del servidor
  public/       # Pantallas y recursos optimizados que recibe el navegador
  data/         # Datos privados y, si procede, SQLite
  art/          # Originales y procedencia de los recursos visuales
  tests/        # Pruebas del juego
  docs/         # Interfaz, protocolo, operación y decisiones
```

Crear subcarpetas adicionales solo cuando sean necesarias. No crear bases de datos, renderizadores, fuentes gráficas ni infraestructura de salas que el juego no necesite.

**Un juego nunca importa sistemas específicos de otro juego.** Esto incluye dominio, transporte, gestión de participantes y sesiones, pantallas, estilos y recursos. Tampoco se admiten enlaces simbólicos, rutas HTTP ni lecturas de archivos que creen esa dependencia. Para aprovechar una solución de Bingo u otro juego, copiar únicamente lo necesario, adaptarlo y mantenerlo dentro del nuevo juego, con sus propias pruebas y documentación. No copiar informes históricos, capturas ni utilidades puntuales de depuración.

Se pueden utilizar las dependencias instaladas y la infraestructura general del centro, como el gestor Docker, la pasarela y las utilidades de `public/shared/`. Compartir infraestructura general no permite alojar sistemas de un juego dentro de otro. No extraer una dependencia común entre juegos por iniciativa propia para eludir este aislamiento.

## 3. Integrar Docker y el catálogo

- Todo se ejecuta desde Docker. El centro permanece activo; cada juego se ejecuta en su propio contenedor, iniciado bajo demanda. Varias entradas simultáneas deben reutilizar el mismo arranque.
- Implementar `GET /health` y WebSocket `/socket`, escuchando en `0.0.0.0` y el puerto interno configurado. Comprobar salud antes de anunciar que el juego está listo.
- Registrar identificador y metadatos en [server/games.json](../server/games.json), que valida y carga [server/catalog.mjs](../server/catalog.mjs). El generador lo hace automáticamente; los comandos y rutas se construyen en infraestructura a partir de identificadores validados. El navegador nunca decide comandos, imágenes Docker ni rutas del servidor.
- Integrar portada, accesibilidad y navegación del nuevo juego en el catálogo. Todos utilizan su propio `public/assets/cover.svg` mediante la misma tarjeta y sin condiciones por identificador. El generador crea una portada e icono provisionales; cada juego conserva su diseño independiente.
- Solo el centro publica un puerto al anfitrión; HTTP y WebSocket del juego pasan por su pasarela. Los juegos no reciben el socket Docker y usan límites de CPU y memoria.
- Mantener la retirada tras 24 horas sin uso. Las conexiones de TV, jugadores y visitantes cuentan como uso; una sala vacía no debe provocar que se retire un contenedor que todavía utiliza otra sala.
- Las salas, si existen, se aíslan dentro del estado del juego; no implican por defecto un contenedor por sala. Separar participantes, reglas, partidas, sesiones y difusión de mensajes por sala.
- Si se requiere persistencia, usar SQLite y almacenamiento exclusivo del juego. Declarar el volumen y sus permisos: no reutilizar datos de otro juego ni asumir escritura sobre el sistema de archivos de solo lectura del contenedor.

Los comandos y el ciclo de vida completos están en [arquitectura](architecture.md) y [operación](operations.md). No detener ni recrear servicios existentes sin autorización.

## 4. Implementar el flujo de entrada

```text
Centro de juegos → Carga del servidor → [Selección/creación de sala]
                                      → Televisión / Jugador
                                          ├─ TV: participantes y reglas
                                          └─ Jugador: nombre y avatar → Confirmar → Espera
                                      → Partida → Resultados
```

La selección de sala solo aparece si se ha acordado ese sistema. No deducir el papel por el tamaño de pantalla ni guardar Televisión/Jugador como una preferencia permanente. Una credencial de jugador válida puede recuperar su sesión automáticamente, conforme al flujo documentado y después de resolver inequívocamente el juego y, si procede, la sala. Una credencial ausente, caducada o inválida devuelve al flujo de entrada.

### Perfil del jugador y nombres únicos

- Pedir nombre obligatorio y avatar antes de confirmar. Como base, usar nombres de 3 a 40 caracteres, avatar aleatorio por defecto y posibilidad de cambiarlo. Los avatares pueden repetirse; los nombres de participantes distintos no.
- Normalizar los nombres y aplicar explícitamente `.trim()` para quitar espacios al principio y al final **antes** de validar la longitud y comprobar duplicados. El mínimo es **3 caracteres** y el máximo 40 sobre el nombre resultante: `" Ana "` se guarda como `"Ana"`; `" Al "` se rechaza. Hacerlo en el formulario y obligatoriamente en el servidor, aunque se envíen mensajes sin usar la interfaz. Espacios, mayúsculas/minúsculas y representación Unicode no deben permitir duplicados visualmente equivalentes. Escapar el texto al mostrarlo.
- La comprobación y la asignación deben ser atómicas: dos confirmaciones simultáneas no pueden conseguir el mismo nombre. Una validación exclusiva del navegador no es suficiente.
- Conservar la reserva del nombre de un jugador desconectado mientras exista su identidad. Volver con ese nombre debe recuperar a ese jugador, no crear otro participante igual.
- La unicidad es obligatoria en todo el videojuego, también entre salas, sin preguntar ni permitir un ámbito más reducido. La reserva se mantiene mientras exista la identidad, incluso desconectada. Documentar cuándo se elimina esa identidad; el estado en memoria no constituye un registro histórico tras borrar partidas o reiniciar el contenedor.

### Espera y reglas desde TV

- La TV muestra tarjetas con avatar, nombre y estado de conexión o preparación, actualizadas al instante. Representar a quienes todavía eligen perfil como pendientes, sin inventarles un nombre confirmado. El móvil muestra su tarjeta y que está esperando el inicio.
- Con muchos participantes, conservar tarjetas legibles y desplazamiento dentro de la lista; en TV puede ser automático, con pausa durante la interacción.
- Las reglas se configuran desde TV y se validan y almacenan en el servidor. Los jugadores no pueden alterarlas mediante mensajes fabricados. Explicar para qué sirve cada opción y fijar valores predeterminados propios del juego.
- Admitir varias TV simultáneas en la misma partida o sala. Todas ven los mismos participantes, opciones y estado; cualquier TV puede configurar e iniciar salvo que el usuario haya solicitado otro sistema de permisos. No invalidar una TV por conectar otra.
- Iniciar con confirmación y solo cuando se cumplan los requisitos del juego. Definir qué ocurre con perfiles pendientes y llegadas tardías. Bloquear los cambios de reglas que no tengan sentido durante una partida.

## 5. Mantener el servidor como autoridad

- El cliente solicita acciones; el servidor decide si son válidas y calcula fases, turnos, azar, reparto, puntuaciones, victorias y final. Ni la TV ni una animación gobiernan el avance real de la partida.
- Usar una conexión persistente, normalmente WebSocket, para distribuir cambios. No sustituirla por sondeos periódicos continuos.
- Diseñar mensajes identificables, validación de datos y permisos, errores comprensibles y respuesta a cada solicitud. Usar identificadores de partida/turno y proteger las acciones frente a duplicados y mensajes atrasados.
- Enviar a cada dispositivo solo lo que puede ver: estado público para TV y datos privados exclusivamente al jugador correspondiente. Nunca difundir tokens, manos, cartones u otra información oculta a los demás.
- Si hay temporizadores, enviar tiempos y plazos autoritativos del servidor. Los clientes los representan sin inventar relojes de partida independientes.
- Detectar desconexiones mediante latidos y gestionar reconexiones. Mostrar estados de conexión y errores sin perder datos de un formulario por redibujar toda la pantalla.
- Si una mecánica espera acciones de varios jugadores, la barrera de avance también pertenece al servidor. Los desconectados no bloquean indefinidamente; definir cómo se pausa, continúa o recupera la partida y qué ocurre si no queda ningún jugador conectado.

## 6. Recuperación, navegación y final

- Identificar al jugador mediante una credencial emitida y validada por el servidor, no solo por su nombre o avatar. Limitarla al juego y, cuando proceda, a su sala; separar también las claves de almacenamiento del navegador.
- Si no hay una sesión válida y la partida ya está en marcha, ofrecer la selección del jugador existente según la política de incorporación acordada. Si todavía aparece conectado, pedir confirmación mostrando avatar y nombre antes de tomar su identidad; invalidar la credencial y conexión anteriores y restaurar sus datos.
- La recuperación no debe duplicar al participante, liberar su nombre ni entregar datos de otra sala. La TV conserva su funcionamiento simultáneo e independiente de estas credenciales.
- Implementar Atrás del navegador y del mando con pantallas reales, sin bloquear el historial ni dejar imposible volver a entrar. Cerrar primero las modales y confirmar las acciones destructivas.
- Mantener la salida al centro en las pantallas de entrada: selector TV/Jugador o, si existe, entrada de salas. Durante preparación o partida, regresar primero a la pantalla apropiada mediante una acción explícita; no confundir cambiar de dispositivo con cancelar la partida de todos.
- Cancelar o reiniciar debe ser una acción validada del servidor, con confirmación cuando borre estado y actualización coordinada de todas las pantallas afectadas. En salas, no reiniciar otras partidas.
- Los resultados se calculan en el servidor. Definir revancha, victorias acumuladas y salida al selector; no dejar a clientes con una partida terminada como si siguiera activa. Cada juego decide su mecánica concreta.

## 7. Diseñar para TV y móvil

- Crear identidad visual, portada y recursos propios. Si existen ilustraciones 2D y personajes 3D, representar al mismo personaje en portada, selección, partida y reservas estáticas.
- Optimizar para televisores con poca memoria: preparar tamaños y recortes de imágenes durante la construcción, cargar solo lo necesario y evitar descargar un atlas grande para mostrar un icono.
- Si hay 3D o efectos costosos, ofrecer un modo ligero que no los importe ni los cargue. Respetar movimiento reducido, prever fallos de WebGL y pausar el renderizado en pestañas ocultas. El modo visual no modifica reglas ni bloquea la partida.
- Conservar nombres, iconos y textos legibles en varios tamaños. No deformar avatares ni ocultar contenido desbordado para simular que cabe. TV y la pantalla de juego horizontal deben mostrar sus controles y estado esencial de un vistazo, sin scroll de página; las listas largas usan regiones propias accesibles.
- Soportar toque, teclado y mandos: flechas, OK/Enter y Atrás, con foco visible y modales accesibles. Seguir [las reglas de mandos](remote-controls.md).
- Acordar la orientación según las fases y solicitarla desde acciones permitidas por el navegador. Tratar como opcionales las API de pantalla completa y bloqueo de orientación: si se rechazan, el juego debe seguir siendo utilizable. Ofrecer recuperar pantalla completa y no forzar repetidamente el teclado del móvil.
- El Game Center ya proporciona instalación PWA. Usar sus rutas y recursos locales; no prometer instalación, orientación forzada o teclas reservadas del sistema en todos los navegadores.

## 8. Validar y documentar antes de entregar

Comprobar, con pruebas adecuadas dentro de Docker:

- Entrada concurrente sin duplicar el contenedor y carga con estado de error recuperable.
- Configuración desde dos TV y varios móviles, nombres duplicados enviados simultáneamente y permisos de acciones.
- Participantes pendientes, confirmación, desconexión, recuperación y sustitución de una sesión activa sin pérdida de datos ni duplicados.
- Si hay salas, aislamiento de estado, mensajes y credenciales, nombres únicos en todo el videojuego y cancelación independiente.
- Inicio, jugabilidad mínima, resultados, revancha, reinicio coordinado, salida y nueva entrada con Atrás.
- Privacidad de datos, mensajes duplicados o atrasados y tiempos del servidor.
- Tamaños grandes y pequeños, vertical y horizontal, mandos, movimiento reducido y modo ligero cuando existan efectos.

El README del juego debe explicar cómo jugar y enlazar su documentación. Mantener en `games/<id>/docs/` las decisiones de interfaz, sesiones, reglas, protocolo, persistencia, operación y verificaciones realmente ejecutadas. Actualizar el catálogo y los enlaces generales pertinentes. Guardar capturas e informes temporales en `artifacts/`, fuera de Git y de la imagen del servidor; conservar las pruebas reutilizables. No publicar páginas de depuración dentro de `public/`.

Una entrega inicial debe completar al menos entrada, selección de papel, perfil, espera compartida, configuración de reglas e inicio autoritativo, con aislamiento y reconexión operativos. No afirmar que el juego completo está terminado si sus mecánicas o las verificaciones acordadas siguen pendientes.
