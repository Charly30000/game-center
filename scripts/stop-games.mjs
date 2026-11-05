import { DockerEngine } from '../server/docker.mjs';
const docker = new DockerEngine(process.env.DOCKER_SOCKET);
const owner = `${process.env.GAME_NAMESPACE || 'gamecenter'}-local`;
const filters = encodeURIComponent(JSON.stringify({ label: [`app.gamecenter.owner=${owner}`] }));
const containers = await docker.request('GET', `/containers/json?all=true&filters=${filters}`);
for (const container of containers) {
  if (container.State === 'running') await docker.request('POST', `/containers/${container.Id}/stop?t=5`);
  await docker.request('DELETE', `/containers/${container.Id}`);
  console.log(`Retirado ${container.Labels['app.gamecenter.game']}.`);
}
