$ports = @(3000, 3004)

foreach ($port in $ports) {
  try {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -First 1 -Property OwningProcess
    if ($null -ne $conn) {
      Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    }
  } catch {
    # Ignore failures to keep dev flow smooth.
  }
}
