function usableIPv4(value) {
  if (typeof value !== 'string' || !/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) return false;
  const parts=value.split('.').map(Number);
  return parts.every(part=>part>=0&&part<=255)&&parts[0]>0&&parts[0]<224&&parts[0]!==127&&!(parts[0]===169&&parts[1]===254);
}

function shareableHostname(value) {
  const host=value.toLowerCase();
  if (host==='localhost'||host.endsWith('.localhost')||host.endsWith('.internal')||host==='[::1]'||host==='[::]'||host==='0.0.0.0') return false;
  if (/^\d+(\.\d+){3}$/.test(host)) return usableIPv4(host);
  if (host.startsWith('[')) return !host.startsWith('[fe80:');
  return host.includes('.')&&!host.endsWith('.docker');
}

// La IP procede del anfitrión, nunca de las interfaces del contenedor.
export function connectionUrl(pageUrl,network={}) {
  const url=new URL(pageUrl);
  if (!['http:','https:'].includes(url.protocol)||url.username||url.password) return null;
  const addresses=Array.isArray(network?.addresses)?network.addresses.filter(usableIPv4):[];
  const address=addresses.includes(url.hostname)?url.hostname:addresses[0];
  // Conservar el origen HTTPS accesible evita romper su certificado.
  if (address&&!(url.protocol==='https:'&&shareableHostname(url.hostname))) url.hostname=address;
  else if (!shareableHostname(url.hostname)) return null;
  url.pathname='/';url.search='';url.hash='';
  return url.href;
}
