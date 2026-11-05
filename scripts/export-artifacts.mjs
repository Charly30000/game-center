import { cp, mkdir } from 'node:fs/promises';
// Se ejecuta exclusivamente en un contenedor temporal con /export enlazado al proyecto.
await mkdir('/export/games/bingo/data', { recursive: true });
await cp('/app/games/bingo/data/tickets.json', '/export/games/bingo/data/tickets.json');
await cp('/app/games/bingo/public/assets', '/export/games/bingo/public/assets', { recursive: true });
await cp('/app/public/assets', '/export/public/assets', { recursive: true });
await cp('/app/package-lock.json', '/export/package-lock.json');
console.log('Catálogo JSON, recursos optimizados y lockfile copiados al proyecto.');
