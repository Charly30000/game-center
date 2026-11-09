#!/bin/sh
set -eu

case "${1-}" in
  '') prepare_only=false ;;
  --prepare-only) prepare_only=true ;;
  *) printf 'Uso: sh scripts/start.sh [--prepare-only]\n' >&2; exit 2 ;;
esac
if [ "$#" -gt 1 ]; then printf 'Demasiados argumentos.\n' >&2; exit 2; fi
command -v ip >/dev/null 2>&1 || { printf 'Se necesita el comando ip (iproute2) para leer la red del anfitrion.\n' >&2; exit 1; }

project_root=$(cd "$(dirname "$0")/.." && pwd -P)
interfaces=$(ip -o -4 route show default | awk '
  { metric=0; device=""; for(i=1;i<=NF;i++){if($i=="dev")device=$(i+1);if($i=="metric")metric=$(i+1)}
    if(device!="")printf "%010d %s\n",metric,device }
' | sort -n | awk '!seen[$2]++{print $2}')
addresses=$(
  for interface in $interfaces; do
    case "$interface" in lo|docker*|br-*|veth*|virbr*|vboxnet*|vmnet*|tun*|tap*|wg*|tailscale*|zt*) continue ;; esac
    case "$interface" in *[!a-zA-Z0-9_.:-]*) continue ;; esac
    ip -o -4 addr show dev "$interface" scope global | awk '
      { split($4,prefix,"/"); count=split(prefix[1],octet,"."); valid=(count==4);
        for(i=1;i<=count;i++)if(octet[i]!~/^[0-9]+$/||octet[i]>255)valid=0;
        if(valid&&octet[1]>0&&octet[1]<224&&octet[1]!=127&&!(octet[1]==169&&octet[2]==254))print prefix[1] }
    '
  done | awk '!seen[$0]++'
)
detected_url=''
if [ -z "$addresses" ]; then
  printf 'No se ha detectado una direccion LAN. Configura GAMECENTER_URL en compose.yaml para mostrar el QR al entrar por localhost.\n' >&2
else
  address=$(printf '%s\n' "$addresses" | head -n 1)
  detected_url="http://$address:3000"
  printf 'URL de red detectada: %s\n' "$detected_url"
fi
if [ "$prepare_only" = true ]; then exit 0; fi
GAMECENTER_DETECTED_URL="$detected_url" docker compose --project-directory "$project_root" up -d --build
