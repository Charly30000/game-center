import http from 'node:http';

export class DockerEngine {
  constructor(socketPath = '/var/run/docker.sock') { this.socketPath = socketPath; }

  request(method, path, data) {
    return new Promise((resolve, reject) => {
      const body = data === undefined ? undefined : JSON.stringify(data);
      const request = http.request({ socketPath: this.socketPath, path, method,
        headers: body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {} }, response => {
        let result = '';
        response.setEncoding('utf8');
        response.on('data', chunk => { result += chunk; });
        response.on('end', () => {
          let value;
          try { value = result ? JSON.parse(result) : null; } catch { value = result; }
          if (response.statusCode >= 400) {
            const error = new Error(value?.message || `Docker: HTTP ${response.statusCode}`);
            error.status = response.statusCode;
            reject(error);
          } else resolve(value);
        });
      });
      request.setTimeout(15000, () => request.destroy(new Error('Docker no responde.')));
      request.on('error', reject);
      request.end(body);
    });
  }
}
