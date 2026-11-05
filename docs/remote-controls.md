# Mandos de televisión

El catálogo y Bingo usan `public/shared/remote-navigation.js`. El control se basa en eventos de teclado estándar y funciona también con teclado USB y con el puntero del mando LG. No requiere detectar la marca para la navegación básica.

| Control | Comportamiento |
| --- | --- |
| Flechas | Mover el foco hacia el control más próximo alineado en esa dirección |
| OK / Enter | Activar una vez el control seleccionado; mantener pulsado no repite acciones de confirmación |
| Atrás / Escape | Cerrar la modal actual o volver a la pantalla anterior |

El foco se resalta con un borde verde y se conserva al regenerar los controles tras mensajes del servidor. No se navega a controles deshabilitados ni fuera de una modal abierta. Las flechas dentro de un campo de texto conservan su función de edición. Cuando se enfoca una tarjeta de selección dentro de una lista larga, la región se desplaza para mostrarla. El desplazamiento automático se pausa durante la interacción.

Las acciones concretas de Atrás y de cambio de pantalla pertenecen a cada juego; para Bingo, consultar [su documentación de interfaz](../games/bingo/docs/interface.md#navegación-y-salida).

## Códigos y fuentes

Samsung documenta que flechas, Enter y Back se reciben sin registrarlas mediante su API de teclas. Se admiten los códigos 37–40, 13 y **10009** para Atrás, además de los nombres de evento estándar. [Samsung: Remote Control](https://developer.samsung.com/smarttv/develop/guides/user-interaction/remote-control.html).

LG permite gestionar Atrás mediante History API o mediante el evento específico **461** en aplicaciones configuradas para ello. Bingo registra las pantallas reales en el historial y atiende `popstate`, además del evento de tecla cuando el navegador lo entrega. No reintroduce entradas durante la navegación hacia atrás ni bloquea el historial. El catálogo restablece el botón Jugar al volver desde la caché de navegación. No se utiliza la API de cierre de aplicaciones nativas ni se intenta cerrar el navegador. [LG: Back Button](https://webostv.developer.lge.com/develop/guides/back-button).

La aplicación se abre como web, no como paquete nativo Tizen/webOS. Por tanto, el navegador de cada televisión puede reservar teclas para su propia interfaz y no enviarlas a la página. Home, Exit o pulsaciones largas reservadas por el sistema no pueden garantizarse desde JavaScript. Las pruebas verifican los eventos y la navegación en Chromium; no sustituyen una prueba con cada mando y navegador físico.
