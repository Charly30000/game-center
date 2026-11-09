# Instrucciones del proyecto

- Responder siempre en español.
- Se permiten comandos necesarios para el proyecto siempre que no modifiquen el sistema operativo anfitrión ni sus variables de entorno. No detener ni reiniciar procesos existentes sin permiso. No ejecutar Flutter ni formateadores.
- Crear, editar y eliminar archivos del proyecto directamente, sin pedir al usuario que lo haga.
- Limitar cada cambio a lo solicitado. Conservar diseños, imágenes, navegación y comportamientos que no se haya pedido modificar. No sustituir recursos visuales por iniciativa propia.
- Mantener una arquitectura limpia, mantenible y escalable, separando dominio, transporte, infraestructura e interfaz.
- Todo el sistema se ejecuta en Docker. El centro permanece activo y cada juego utiliza un contenedor independiente, iniciado bajo demanda y retirado tras 24 horas sin uso. Solo se publica el puerto del centro.
- Cada juego vive en `games/<id>/`, con sus recursos, datos, pruebas y documentación. No mezclar datos de juegos. Si hace falta persistencia, utilizar SQLite y almacenamiento exclusivo por juego.
- Antes de crear un juego nuevo, leer y seguir [la guía de creación de juegos](docs/new-game.md). Consultar obligatoriamente si habrá salas y si se autoriza reutilizar avatares de otro juego; no asumir ninguna de esas decisiones.
- Crear la base con `npm run game:create` y la plantilla de `templates/game/`, siguiendo la ejecución en Docker de la guía. Registrar explícitamente las decisiones del asistente; la plantilla no sustituye la implementación ni las pruebas de la mecánica del nuevo juego.
- Todos los juegos siguen el registro `server/games.json`, ordenado por `number`: Bingo es el 1 y las nuevas altas reciben números crecientes. No introducir excepciones de registro o presentación por identificador de juego; cada uno aporta sus recursos propios.
- No importar sistemas específicos ni recursos desde otro juego. Si se reutiliza una solución o se autoriza reutilizar avatares, copiar lo necesario a las carpetas del nuevo juego y mantenerlo independiente; solo la infraestructura general del centro puede compartirse directamente.
- Mantener decisiones de partida en el servidor y utilizar conexiones persistentes para sincronizar las pantallas. Optimizar los recursos para móviles y televisores.
- Los nombres de jugadores deben ser únicos en todo el videojuego, también entre salas, tras normalizar y aplicar `.trim()`. Esta regla no se pregunta ni se ofrece como opción configurable.
- Este archivo contiene únicamente instrucciones generales. Antes de modificar un juego, leer su README y su carpeta `docs/`; sus reglas, aspectos técnicos y decisiones de diseño deben documentarse allí, nunca en este AGENTS.md.
- Mantener la documentación actualizada en el mismo cambio que modifica el comportamiento. Documentar lo general en `docs/` y lo específico en la carpeta del juego; enlazar el documento pertinente y evitar instrucciones duplicadas o contradictorias.
- Validar los cambios con pruebas adecuadas, incluidos tamaños de pantalla cuando afecten a la interfaz. No afirmar verificaciones que no se hayan ejecutado.
