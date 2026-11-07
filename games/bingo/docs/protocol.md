# Protocolo WebSocket

El navegador utiliza `/ws/bingo`, en el mismo origen que la página. Game Center lo conecta a `ws://gamecenter-bingo:3001/socket` por la red interna. No hay sondeo HTTP para la partida.

## Mensajes del cliente

```json
{"type":"hello","requestId":"1","payload":{"role":"player"}}
```

`requestId` permite asociar respuestas. `payload` debe ser un objeto. Cada conexión debe identificarse en 10 segundos. Límite: 8 KB por mensaje y 35 mensajes por segundo. La compresión está desactivada para reducir memoria.

| type | payload | Restricción |
| --- | --- | --- |
| `hello` | `role: guest / tv / player`, opcional `token` o `claimPlayerId` y `force` | Recuperar un usuario activo exige `force: true` tras confirmación en UI |
| `profile` | `name` (3–40 caracteres después de normalizar y aplicar `.trim()`), `avatar` (0–19) | Jugador en lobby |
| `settings` | `cardsPerPlayer` (1–5), `effects` (boolean) | TV en lobby |
| `start` | Objeto vacío | TV, al menos un confirmado online |
| `mark` | `roundId`, `turn`, `card` (índice), `number` | Jugador participante en fase marking; número del cartón que ya salió |
| `continue` | `roundId`, `turn` | Sin números pendientes en ningún cartón |
| `cancel` | Objeto vacío | TV, partida iniciada; borra todo |
| `restart` | Objeto vacío | TV en resultados; revancha directa |
| `reset` | Objeto vacío | TV en resultados; borra la sesión y convierte todas las conexiones, incluidas las TV, en visitantes del selector |

`roundId` y `turn` evitan aplicar acciones retrasadas a otra bola o partida. `mark` repetido es idempotente para sus marcas; marcar un número deja al jugador pendiente de Continuar. No se aceptan ganadores, cartones ni números extraídos enviados por clientes.

## Mensajes del servidor

- `state`: fotografía personalizada después de una acción o cambio de conexión. Incluye fase, reglas, bolas públicas, participantes y ganadores; `drawDurationMs` indica la duración de extracción (5.000 ms) y `drawEndsAt` su fin autoritativo, o `null` fuera de extracción. `me` contiene exclusivamente los cartones y marcas del receptor; para televisión/visitantes es `null`. Nunca se envían tokens ajenos.
- `ack`: `requestId` y `result`. Un `hello` de jugador devuelve `token` y `playerId`.
- `error`: `requestId`, `message`, `code` y, si procede, `details`. Códigos: `SESSION_EXPIRED`, `CONFIRM_TAKEOVER`, `GAME_STARTED`, `STALE_TURN`, `NOT_CONNECTED`, `INVALID_ACTION` e `INTERNAL`.
- `revoked`: el jugador se ha recuperado en otro dispositivo; detener reconexiones automáticas y cerrar esa pantalla de juego.

Se utilizan fotografías pequeñas en lugar de parches para simplificar la recuperación y evitar estados incompletos. Cada jugador recibe como máximo cinco cartones; el catálogo completo nunca se transmite. La contrapresión desconecta a clientes que acumulen más de 1 MB de envío pendiente.

El cliente reconecta con espera exponencial hasta 12 segundos más una variación aleatoria. No reenvía automáticamente acciones, para evitar marcas o confirmaciones aplicadas a otro turno. Los ping/pong del servidor verifican transporte; el estado de partida siempre procede del dominio.

El token de jugador se conserva localmente y se valida con `hello` al abrir o recargar. Una credencial válida recupera automáticamente al jugador; `SESSION_EXPIRED` la descarta y deja al usuario en TV/Jugador. El modo TV no se persiste. Sin sesión válida, Jugador crea un perfil directamente en el lobby y abre la lista de recuperación si la partida ya está iniciada. Elegir un nombre solicita `hello` con `claimPlayerId`. El historial es un estado de interfaz y no concede permisos de TV ni de jugador por sí mismo. Véase [interfaz y sesiones](interface.md).
