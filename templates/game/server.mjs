import { readFile } from 'node:fs/promises';
import { createGameServer } from './transport/server.mjs';
const config = JSON.parse(await readFile(new URL('./game.json',import.meta.url),'utf8'));
createGameServer(config).listen(Number(process.env.PORT || config.port),'0.0.0.0');
