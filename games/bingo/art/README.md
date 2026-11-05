# Recursos visuales

## Dirección artística

Juegos de sobremesa contemporáneos: papel cálido, terracota, verde petróleo, mostaza, formas redondeadas y personaje azul. Los cartones se adaptaron expresamente a un estilo **tradicional modernizado**: rectángulo horizontal 3×9, borde doble, números de imprenta, tramado en huecos y marcas perforadas. El color no es la única indicación: pestañas, contadores y etiquetas accesibles identifican cada cartón.

## Origen y preparación

`source/avatars.png`, `source/presenter.png` y `source/tickets.png` son imágenes creadas con la herramienta de generación de imágenes durante el desarrollo. El atlas contiene veinte personajes familiares, animales y robots en una matriz de 5×4.

`scripts/prepare-assets.mjs`, ejecutado en la construcción de Docker:

1. Corta el atlas en el servidor/build en veinte WebP de 160×160.
2. Reduce el presentador estático a 840 píxeles de ancho.
3. Recorta cinco texturas de papel de la ilustración inicial. Se conservan como material artístico opcional; el diseño final utiliza marcos SVG tradicionales para garantizar que las casillas coincidan en cualquier pantalla.
4. Escribe cinco imágenes base de cartón, casillas vacías/numéricas/perforadas rectangulares, flecha doble reversible, bola sin número y tablero en SVG.
5. Escribe el sprite numérico exacto 1–90 en SVG. Se conserva como material opcional. El cartón actual usa texto Space Mono para mantener proporciones y legibilidad en cualquier tamaño.
6. Prepara iconos PNG para la PWA y el catálogo de cartones si falta.

Los originales permanecen fuera de `public/` y no se sirven al navegador. Las imágenes SVG de flechas, tablero, bolas y cartones se construyen por código porque son geometrías y texto que requieren alineación exacta. El atlas y el personaje sí son imágenes generativas. No se usa una imagen generativa para dibujar números: podría introducir errores de lectura.

La portada del catálogo conserva la composición original BIN / GO!, la bola 90 y el presentador original. El selector de dispositivo utiliza el mismo presentador y el cartón inclinado original. No sustituir estas imágenes ni introducir otros motivos sin una petición expresa. Los avatares conservan proporción 1:1, incluidos la lista de recuperación y el perfil en móvil vertical.

El modelo 3D está en `public/presenter-model.js`; `public/presenter.js` gestiona cámara, luces, sombras, texturas y renderizado. Incluye cuerpo y extremidades articuladas, silla con respaldo, mesa de madera, pedestal y ejes metálicos, manivela, bandeja y bolas numeradas. La pose de espera respira, parpadea y mueve suavemente cabeza y manos. Se comprueba con pruebas geométricas que el cuerpo queda detrás de la mesa y que las bolas no salen del bombo. Se puede sustituir por un modelo glTF manteniendo las funciones `mountPresenter(element)`, `update(phase, drawEndsAt)` y `dispose()`.

El personaje conserva una cara sencilla, material azul mate y brazos redondeados. Cada mano es una sola esfera, sin dedos ni pulgares.

## Fuentes

Fredoka para interfaz y bolas; Space Mono para rótulos del cartón y una serif de imprenta en el sprite. Se incluyen las fuentes de interfaz mediante paquetes npm y se sirven desde Docker sin Google Fonts ni CDN. Se conservan los archivos de licencia de sus paquetes dentro de la imagen. La personalización actual es gráfica y numérica; no se ha diseñado una fuente tipográfica original completa.
