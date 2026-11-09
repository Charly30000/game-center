[CmdletBinding()]
param([switch]$PrepareOnly)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$candidates = foreach ($adapter in [Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()) {
  if ($adapter.OperationalStatus -ne [Net.NetworkInformation.OperationalStatus]::Up) { continue }
  if ($adapter.NetworkInterfaceType -notin @([Net.NetworkInformation.NetworkInterfaceType]::Ethernet, [Net.NetworkInformation.NetworkInterfaceType]::Wireless80211)) { continue }
  if (($adapter.Name + ' ' + $adapter.Description) -match '(?i)docker|vethernet|wsl|hyper-v|virtualbox|vmware|loopback|\bvpn\b|\btap\b|\btun\b') { continue }
  $properties = $adapter.GetIPProperties()
  if (-not @($properties.GatewayAddresses | Where-Object { $_.Address.AddressFamily -eq [Net.Sockets.AddressFamily]::InterNetwork -and $_.Address.IPAddressToString -ne '0.0.0.0' }).Count) { continue }
  foreach ($unicast in $properties.UnicastAddresses) {
    $address = $unicast.Address
    if ($address.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork -or [Net.IPAddress]::IsLoopback($address)) { continue }
    $bytes = $address.GetAddressBytes()
    if ($bytes[0] -eq 0 -or $bytes[0] -ge 224 -or ($bytes[0] -eq 169 -and $bytes[1] -eq 254)) { continue }
    [PSCustomObject]@{ Address = $address.IPAddressToString; Wireless = $adapter.NetworkInterfaceType -eq [Net.NetworkInformation.NetworkInterfaceType]::Wireless80211; Name = $adapter.Name }
  }
}
$addresses = @($candidates | Sort-Object Wireless,Name,Address | Select-Object -ExpandProperty Address -Unique)
$detectedUrl = if ($addresses.Count) { "http://$($addresses[0]):3000" } else { '' }
if ($detectedUrl) { Write-Host "URL de red detectada: $detectedUrl" }
else { Write-Warning 'No se ha detectado una dirección LAN. Configura GAMECENTER_URL en compose.yaml para mostrar el QR al entrar por localhost.' }
if ($PrepareOnly) { return }
# Variable exclusiva del proceso actual y de Compose, restaurada al terminar.
$previousDetectedUrl = $env:GAMECENTER_DETECTED_URL
try {
  $env:GAMECENTER_DETECTED_URL = $detectedUrl
  docker compose --project-directory $projectRoot up -d --build
  if ($LASTEXITCODE -ne 0) { throw 'Docker no ha podido iniciar el Game Center.' }
} finally {
  $env:GAMECENTER_DETECTED_URL = $previousDetectedUrl
}
