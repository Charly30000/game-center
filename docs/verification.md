# Verificación del proyecto

Las comprobaciones generales del centro cubren construcción Docker, publicación del puerto, aislamiento de juegos, arranque bajo demanda y retirada por inactividad. Se ejecutan dentro de contenedores, sin instalar herramientas en el anfitrión ni cambiar sus variables de entorno.

La verificación de reglas, sesiones, interfaz y recursos propios de cada juego se mantiene en su documentación:

- [Bingo: pruebas y límites de verificación](../games/bingo/docs/verification.md).

Consultar [operación](operations.md) para los comandos generales y el README de cada juego para su ejecución y validación específicas.

La conexión por QR se cubre con pruebas de selección de dirección y puerto, y decodificación independiente del QR renderizado en ocho tamaños. Se comprueban la entrada por localhost, cambio de IP y ausencia de una dirección compartible. Con un catálogo largo se verifica que el QR queda fijo a la izquierda mientras solo se desplazan las tarjetas en escritorio, y que en móvil aparece al principio del listado con scroll normal. El arranque Linux se verifica en un contenedor con interfaces y Docker simulados, sin iniciar servicios reales. Véanse [detalle y ejecución](connection.md#verificación). La batería automatizada completa pasa 37 pruebas; las pruebas de cámara física y distancia de lectura no se han ejecutado.
