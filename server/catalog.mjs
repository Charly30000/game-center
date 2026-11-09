// Registro explícito: nunca convertir identificadores del navegador en rutas o comandos.
import { readFileSync } from 'node:fs';
import { registeredGames } from './catalog-registry.mjs';
export const games = Object.freeze(registeredGames(JSON.parse(readFileSync(new URL('./games.json',import.meta.url),'utf8'))));
export const findGame = id => games.find(game => game.id === id);
