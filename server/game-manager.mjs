import { setTimeout as delay } from 'node:timers/promises';
import { DockerEngine } from './docker.mjs';
import { findGame } from './catalog.mjs';

export class GameManager {
  constructor({ docker = new DockerEngine(process.env.DOCKER_SOCKET), image = process.env.GAME_IMAGE || 'gamecenter-runtime:local', network = process.env.GAME_NETWORK || 'gamecenter-internal', idleMs = Number(process.env.GAME_IDLE_MS || 86400000), namespace = process.env.GAME_NAMESPACE || 'gamecenter' } = {}) {
    this.docker = docker; this.image = image; this.network = network; this.idleMs = idleMs;
    if (!/^[a-z][a-z0-9-]{0,40}$/.test(namespace)) throw new Error('Nombre de instancia inválido.');
    this.namespace = namespace; this.owner = `${namespace}-local`;
    this.runtimes = new Map();
  }

  async recover() {
    const filters = encodeURIComponent(JSON.stringify({ label: [`app.gamecenter.owner=${this.owner}`] }));
    const containers = await this.docker.request('GET', `/containers/json?all=true&filters=${filters}`);
    for (const container of containers) {
      const id = container.Labels['app.gamecenter.game'];
      if (!findGame(id)) continue;
      this.runtimes.set(id, { id, name: `${this.namespace}-${id}`, clients: 0, lastEmptyAt: Date.now(), promise: null });
    }
  }

  async launch(id) {
    const game = findGame(id);
    if (!game) throw new Error('Juego no disponible.');
    let runtime = this.runtimes.get(id);
    if (runtime?.retirement) { await runtime.retirement; return this.launch(id); }
    if (!runtime) {
      runtime = { id, name: `${this.namespace}-${id}`, clients: 0, lastEmptyAt: Date.now(), promise: null };
      this.runtimes.set(id, runtime);
    }
    // Una única promesa impide crear contenedores duplicados ante entradas simultáneas.
    runtime.launches = (runtime.launches || 0) + 1;
    try { if (!runtime.promise) {
      runtime.promise = this.ensureContainer(game, runtime).catch(error => { runtime.promise = null; throw error; });
    }
    await runtime.promise;
    runtime.lastEmptyAt = Date.now();
    return { ...runtime, origin: `http://${runtime.name}:${game.port}`, socket: `ws://${runtime.name}:${game.port}/socket` };
    } finally { runtime.launches--; }
  }

  async ensureContainer(game, runtime) {
    let existing;
    try { existing = await this.docker.request('GET', `/containers/${runtime.name}/json`); }
    catch (error) { if (error.status !== 404) throw error; }
    if (existing && existing.Config.Labels?.['app.gamecenter.owner'] !== this.owner) throw new Error('Ya existe un contenedor ajeno con este nombre.');
    if (!existing) {
      await this.docker.request('POST', `/containers/create?name=${runtime.name}`, {
        Image: this.image, Cmd: game.command, User: 'node', WorkingDir: '/app',
        Env: [`PORT=${game.port}`, 'NODE_ENV=production'],
        Labels: { 'app.gamecenter.owner': this.owner, 'app.gamecenter.game': game.id },
        HostConfig: { NetworkMode: this.network, Memory: 268435456, NanoCpus: 1000000000,
          ReadonlyRootfs: true, CapDrop: ['ALL'], SecurityOpt: ['no-new-privileges:true'],
          RestartPolicy: { Name: 'no' }, LogConfig: { Type: 'json-file', Config: { 'max-size': '5m', 'max-file': '2' } } },
        NetworkingConfig: { EndpointsConfig: { [this.network]: { Aliases: [runtime.name] } } },
      });
    }
    if (!existing?.State.Running) await this.docker.request('POST', `/containers/${runtime.name}/start`);
    const deadline = Date.now() + 25000;
    while (Date.now() < deadline) {
      try {
        const response = await fetch(`http://${runtime.name}:${game.port}/health`, { signal: AbortSignal.timeout(1200) });
        if (response.ok) return;
      } catch { /* El contenedor todavía está arrancando. */ }
      await delay(300);
    }
    throw new Error('El juego no ha terminado de arrancar. Vuelve a intentarlo.');
  }

  connected(id) { const runtime = this.runtimes.get(id); if (runtime) runtime.clients++; }
  disconnected(id) { const runtime = this.runtimes.get(id); if (runtime) { runtime.clients = Math.max(0, runtime.clients - 1); if (!runtime.clients) runtime.lastEmptyAt = Date.now(); } }
  invalidate(id) { const runtime = this.runtimes.get(id); if (runtime) runtime.promise = null; }

  async collectIdle(now = Date.now()) {
    for (const [id, runtime] of this.runtimes) {
      if (runtime.clients || runtime.launches || runtime.retirement || now - runtime.lastEmptyAt < this.idleMs) continue;
      runtime.retirement = (async () => { try {
        // Solo contenedores propios, nunca servicios ajenos ni el centro.
        const info = await this.docker.request('GET', `/containers/${runtime.name}/json`);
        if (info.Config.Labels?.['app.gamecenter.owner'] !== this.owner) return;
        if (info.State.Running) await this.docker.request('POST', `/containers/${runtime.name}/stop?t=5`);
        await this.docker.request('DELETE', `/containers/${runtime.name}`);
        this.runtimes.delete(id);
      } catch (error) {
        if (error.status === 404) this.runtimes.delete(id);
        else console.error('No se pudo retirar el juego:', error.message);
      } finally { runtime.retirement = null; } })();
      await runtime.retirement;
    }
  }
}
