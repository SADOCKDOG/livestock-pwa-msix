# Copia los archivos estáticos de la raíz a docs/ (carpeta que sirve GitHub Pages).
# No depende de Capacitor, Node ni ningún bundler: es una copia directa.

$root = Split-Path -Parent $PSScriptRoot
$docs = Join-Path $root "docs"

if (Test-Path $docs) {
    Remove-Item $docs -Recurse -Force
}
New-Item -ItemType Directory -Path $docs | Out-Null

$items = @("index.html", "manifest.webmanifest", "sw.js", "css", "js", "icons", "manual")
foreach ($item in $items) {
    $src = Join-Path $root $item
    if (Test-Path $src) {
        Copy-Item $src -Destination $docs -Recurse
    }
}

Write-Host "Build completado en $docs"
