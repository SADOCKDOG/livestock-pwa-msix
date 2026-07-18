# Copia bajo demanda desde LIVESTOCK-MANAGER (repo Android/Play) a este proyecto.
# NO se ejecuta automáticamente en ningún build/CI: es manual, para traer mejoras
# de UI/lógica cuando el usuario lo decida. Revisa siempre "git diff" antes de commitear.
#
# Uso: pwsh scripts/sync-from-source.ps1 [-SourcePath "C:\Users\yo\repo\LIVESTOCK-MANAGER"]

param(
    [string]$SourcePath = "..\LIVESTOCK-MANAGER"
)

$root = Split-Path -Parent $PSScriptRoot
$source = Resolve-Path (Join-Path $root $SourcePath) -ErrorAction Stop

Write-Host "Sincronizando desde $source ..."

# css/, js/ (excepto mode-config.js, que es propio de este proyecto), icons/, manual/
Copy-Item (Join-Path $source "css") -Destination $root -Recurse -Force

$jsDst = Join-Path $root "js"
$jsSrc = Join-Path $source "js"
Get-ChildItem $jsSrc -File | Where-Object { $_.Name -ne "mode-config.js" -and $_.Name -ne "mode-config.free.js" -and $_.Name -ne "mode-config.premium.js" } | ForEach-Object {
    Copy-Item $_.FullName -Destination $jsDst -Force
}

Copy-Item (Join-Path $source "icons") -Destination $root -Recurse -Force
Copy-Item (Join-Path $source "manual") -Destination $root -Recurse -Force
Copy-Item (Join-Path $source "sw.js") -Destination $root -Force
Copy-Item (Join-Path $source "index.html") -Destination $root -Force

Write-Host "Listo. Revisa 'git diff' antes de commitear."
Write-Host "Nota: index.html y sw.js se sobrescriben tal cual; si habias hecho ajustes propios (ej. quitar <script src='capacitor.js'>), vuelve a aplicarlos."
