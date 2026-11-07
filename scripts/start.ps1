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
$runtimeDirectory = Join-Path $projectRoot 'runtime'
New-Item -ItemType Directory -Force -Path $runtimeDirectory | Out-Null
$target = Join-Path $runtimeDirectory 'host-network.json'
$temporary = Join-Path $runtimeDirectory 'host-network.json.tmp'
$metadata = [ordered]@{ addresses = $addresses; detectedAt = [DateTime]::UtcNow.ToString('o') }
[IO.File]::WriteAllText($temporary, ($metadata | ConvertTo-Json -Depth 3), [Text.UTF8Encoding]::new($false))
Move-Item -LiteralPath $temporary -Destination $target -Force
if (-not $addresses.Count) { throw 'No se ha encontrado una conexión Ethernet o Wi-Fi con una dirección IPv4 y puerta de enlace. Conecta el ordenador a la red local y vuelve a ejecutar este script.' }
Write-Host "Dirección de red detectada: $($addresses[0])"
if ($PrepareOnly) { return }
docker compose --project-directory $projectRoot up -d --build
if ($LASTEXITCODE -ne 0) { throw 'Docker no ha podido iniciar el Game Center.' }
