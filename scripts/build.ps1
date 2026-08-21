# Copia los archivos estáticos de la raíz a docs/ (carpeta que sirve GitHub Pages).
# No depende de Capacitor, Node ni ningún bundler: es una copia directa.

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

Write-Host "Build completado en $docs"

# El paquete MSIX no se copia aqui a proposito. docs/ es lo que publica GitHub
# Pages: dejar ahi el instalador de la version de pago lo pondria a descarga
# libre, sin pasar por la Store ni por la verificacion de licencia. El bundle
# se genera y se firma fuera (PWABuilder / makeappx) y se sube directamente a
# Partner Center.
