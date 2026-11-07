import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import sharp from 'sharp';
import { generateTickets } from '../games/bingo/domain/tickets.mjs';

const root = new URL('../', import.meta.url);
const game = new URL('games/bingo/', root);
const assets = new URL('public/assets/', game);
await Promise.all([mkdir(new URL('avatars/', assets), { recursive: true }), mkdir(new URL('data/', game), { recursive: true }), mkdir(new URL('public/assets/', root), { recursive: true })]);
await mkdir(new URL('public/shared/vendor/', root), { recursive: true });
await writeFile(new URL('public/shared/vendor/qrcode.mjs', root), await readFile(new URL('node_modules/qrcode-generator/dist/qrcode.mjs', root)));

// Los originales no son públicos. Solo se sirven los recortes WebP individuales.
const avatarSource = await readFile(new URL('art/source/avatars.png', game));
const avatarMeta = await sharp(avatarSource).metadata();
for (let index = 0; index < 20; index++) {
  const col = index % 5, row = Math.floor(index / 5);
  const left = Math.round(col * avatarMeta.width / 5), top = Math.round(row * avatarMeta.height / 4);
  const width = Math.round((col + 1) * avatarMeta.width / 5) - left, height = Math.round((row + 1) * avatarMeta.height / 4) - top;
  await writeFile(new URL(`avatars/${index}.webp`, assets), await sharp(avatarSource).extract({ left, top, width, height }).resize(160, 160, { fit: 'cover' }).webp({ quality: 78 }).toBuffer());
}
await writeFile(new URL('presenter-cover.webp', assets), await sharp(await readFile(new URL('art/source/presenter-cover.png', game))).trim({ threshold: 5 }).resize({ width: 840 }).webp({ quality: 86, alphaQuality: 100 }).toBuffer());
await writeFile(new URL('presenter-static.webp', assets), await sharp(await readFile(new URL('art/source/presenter-static.png', game))).trim({ threshold: 5 }).resize({ width: 840 - 56 }).extend({ top: 28, bottom: 28, left: 28, right: 28, background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 86, alphaQuality: 100 }).toBuffer());
const svg = (width, height, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">${body}</svg>`;
const writeSvg = (name, width, height, body) => writeFile(new URL(name, assets), svg(width, height, body));
await writeSvg('arrow.svg', 48, 48, '<path d="m10 27 14-12 14 12M10 37l14-12 14 12" fill="none" stroke="#166b62" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>');
await writeSvg('ball.svg', 100, 100, '<defs><radialGradient id="g" cx="35%" cy="25%"><stop stop-color="#fff9dd"/><stop offset=".65" stop-color="#f4c95e"/><stop offset="1" stop-color="#d99c30"/></radialGradient></defs><circle cx="50" cy="50" r="46" fill="url(#g)"/><circle cx="50" cy="50" r="31" fill="#fffcf2" stroke="#c48c2b" stroke-width="1"/>');
await writeSvg('board.svg', 1000, 900, '<defs><pattern id="p" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r=".8" fill="#fff" opacity=".12"/></pattern></defs><rect width="1000" height="900" rx="24" fill="#166b62"/><rect width="1000" height="900" fill="url(#p)"/><rect x="8" y="8" width="984" height="884" rx="18" fill="none" stroke="#e2c47a" stroke-width="2"/>');
await writeSvg('cell-empty.svg', 96, 68, '<defs><pattern id="p" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0v9" stroke="#a9997a" stroke-width="1" opacity=".4"/></pattern></defs><path fill="#e9e1d1" d="M0 0h96v68H0z"/><path fill="url(#p)" d="M0 0h96v68H0z"/>');
await writeSvg('cell-number.svg', 96, 68, '<path fill="#fffbed" d="M0 0h96v68H0z"/><path d="M0 67h96" stroke="#d6c9ae"/>');
await writeSvg('cell-punched.svg', 96, 68, '<defs><radialGradient id="g"><stop offset=".62" stop-color="#655e50"/><stop offset=".7" stop-color="#9b8d74"/><stop offset=".78" stop-color="#fcf5e6"/><stop offset="1" stop-color="#d7c7aa"/></radialGradient></defs><path fill="#fffbed" d="M0 0h96v68H0z"/><path d="m48 12 5 4 7-1 1 6 6 4-3 7 2 6-6 3-3 7-6-2-6 4-4-5-7-1v-7l-4-5 4-5v-7l7-1z" fill="url(#g)"/>');
const icon = await readFile(new URL('public/icon.svg', root));
for (const size of [192, 512]) await writeFile(new URL(`public/assets/icon-${size}.png`, root), await sharp(icon).resize(size, size).png().toBuffer());
const dataPath = new URL('data/tickets.json', game);
try { await access(dataPath); } catch {
  const count = Number(process.env.TICKET_COUNT || 10000);
  await writeFile(dataPath, '[\n' + generateTickets(count).map(ticket => '  ' + JSON.stringify(ticket)).join(',\n') + '\n]\n');
}
console.log('Recursos preparados: 20 avatares, ilustraciones del anfitrión, recursos del tablero y catálogo de cartones.');
