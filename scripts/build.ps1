$root = Split-Path -Parent $PSScriptRoot
$docs = Join-Path $root "docs"

if (Test-Path $docs) {
    Remove-Item $docs -Recurse -Force
}
New-Item -ItemType Directory -Path $docs | Out-Null

$items = @("screenshots", "index.html", "manifest.webmanifest", "sw.js", "privacy-policy.html", "css", "js", "icons", "manual")
foreach ($item in $items) {
    $src = Join-Path $root $item
    if (Test-Path $src) {
        Copy-Item $src -Destination $docs -Recurse
    }
}

# Excluir los archivos de configuración de modo (no se usan en runtime)
$toExclude = @("mode-config-con-pago.js", "mode-config-sin-pago.js")
foreach ($file in $toExclude) {
    $path = Join-Path $docs $file
    if (Test-Path $path) {
        Remove-Item $path -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "Build completado en $docs"

# El bloque que antes copiaba el .msixbundle queda comentadointencionalmente.