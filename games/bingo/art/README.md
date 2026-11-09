# Recursos visuales

Los sonidos exclusivos del juego, sus originales, locuciones y licencias se describen en [audio del Bingo](../docs/audio.md) y en los [créditos](../public/assets/audio/CREDITS.md).

## Dirección artística

Juegos de sobremesa contemporáneos: papel cálido, terracota, verde petróleo, mostaza y formas redondeadas. El anfitrión es un señor mayor de chaleco y pajarita rojos, gafas redondas, bigote y pelo gris, junto a un bombo dorado. Las ilustraciones 2D y el modelo 3D representan al mismo personaje. Los cartones tienen un estilo tradicional modernizado: formato horizontal 3×9, borde doble, números de imprenta, tramado en huecos y marcas perforadas. Colores, pestañas, contadores y etiquetas accesibles identifican cada cartón.

## Fuentes y preparación

Los originales se guardan en `source/` y no se sirven al navegador:

- `avatars.png`: atlas generado de veinte personajes familiares, animales y robots en una matriz de 5×4.
- [presenter-static.png](source/presenter-static.png): ilustración artística de cuerpo completo del anfitrión y el bombo, con fondo transparente. Se utiliza en el selector de TV y como reserva de la partida y los resultados. [Prompt y procedencia](source/presenter-static.prompt.md).
- [presenter-cover.png](source/presenter-cover.png): ilustración del mismo anfitrión de medio cuerpo, con bombo y bola, para la portada del catálogo. [Prompts y procedencia](source/presenter-cover.prompt.md).

Las dos ilustraciones del anfitrión se han creado con la herramienta integrada de generación de imágenes, manteniendo identidad y acabado pictórico de gouache y lápiz. El modelo de Blender define al mismo personaje. Los números funcionales, cartones, flechas y textos se dibujan por código para garantizar su exactitud.

`scripts/prepare-assets.mjs`, ejecutado durante la construcción Docker:

1. Extrae veinte avatares WebP de 160×160.
2. Prepara `presenter-cover.webp` a 840 píxeles y `presenter-static.webp` a 840 píxeles con transparencia y márgenes.
3. Genera las casillas, flechas, bolas y tablero SVG que referencia la interfaz.
4. Prepara iconos PNG y el catálogo de cartones cuando falta.

La portada del Game Center mantiene BIN / GO!, el rótulo «PARA TODA LA FAMILIA» y la bola 90, compuestos en SVG sobre la nueva ilustración. La composición editable está en `source/cover.svg`; la preparación genera `public/assets/cover.svg` con ilustración y fuentes Fredoka incrustadas para que funcione como una imagen autónoma. El catálogo la carga igual que las portadas de los demás juegos, sin código específico de Bingo. El selector de TV utiliza al anfitrión actual; el selector de jugador conserva el cartón. Los avatares mantienen proporción 1:1. No se incluyen imágenes, generadores ni referencias del anfitrión anterior.

## Modelo y escena

La única fuente editable 3D es [bingo_character_relaxed_hands.blend](blender/v8/bingo_character_relaxed_hands.blend). Tiene 45 huesos, nueve clips y una biblioteca de bolas 1–90. El juego y la vista de revisión cargan `public/assets/models/bingo_character_animated.glb`.

`bingo-character.js` controla esqueleto, clips y bola numerada; `cage-balls.js` asienta las bolas al parar; `presenter.js` monta la escena y expone `update(state)` y `dispose()`. `presenter.css` reserva una franja independiente para el rótulo BINGO; imagen y canvas se encuadran en el espacio inferior, conservando el personaje y el bombo completos. El telón SVG aporta el decorado sin duplicar el rótulo. La [documentación del presentador](../docs/blender-character.md) reúne modelo, coreografía, escenario, integración y validaciones.

## Fuentes tipográficas

Fredoka para interfaz y bolas; Space Mono para cartones y una serif de imprenta en el sprite. Se sirven localmente desde Docker, sin CDN, con las licencias de sus paquetes. La personalización es gráfica y numérica; no se ha diseñado una tipografía original completa.

Las pruebas automatizadas viven en tests/; las fuentes editables y los validadores de Blender se conservan para mantenimiento. Capturas, vídeos temporales y copias .blend1 no forman parte del proyecto entregado. artifacts/ y art/blender/ quedan fuera del contexto de construcción Docker; la imagen del servidor utiliza el GLB exportado.
