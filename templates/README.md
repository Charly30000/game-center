# Plantilla inicial de videojuegos

`game/` es el código fuente que copia `npm run game:create`. No es un juego registrado ni se importa en tiempo de ejecución. Cada copia vive exclusivamente en `games/<id>/` y puede evolucionar sin afectar a las demás.

La [guía de creación](../docs/new-game.md) explica el comando Docker, las decisiones obligatorias y los siguientes pasos. El asistente genera configuración, recursos SVG iniciales, documentación y pruebas, y añade una entrada explícita a `server/games.json`. No ejecuta servidores ni reinicia el centro.

La base ofrece salas públicas opcionales, TV/Jugador, perfiles, reserva de nombres, sesiones, reglas de ejemplo e inicio/resultados coordinados. **No incluye la mecánica específica de un videojuego.** `rounds` y `finish` son puntos iniciales que hay que adaptar y probar. No usar la plantilla como un juego final ni trasladar sistemas de Bingo como dependencias.
