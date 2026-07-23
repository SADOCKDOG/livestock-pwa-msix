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

# Copiar archivos raíz de js/ (excepto configuraciones de modo)
Get-ChildItem $jsSrc -File | Where-Object { $_.Name -notmatch "mode-config" } | ForEach-Object {
    Copy-Item $_.FullName -Destination $jsDst -Force
}

# Copiar subcarpetas de js/ (views, services, wizards, etc)
$subfolders = @("services", "views")
foreach ($folder in $subfolders) {
    $srcPath = Join-Path $jsSrc $folder
    if (Test-Path $srcPath) {
        Copy-Item $srcPath -Destination $jsDst -Recurse -Force
    }
}

Copy-Item (Join-Path $source "icons") -Destination $root -Recurse -Force
Copy-Item (Join-Path $source "manual") -Destination $root -Recurse -Force
Copy-Item (Join-Path $source "sw.js") -Destination $root -Force
Copy-Item (Join-Path $source "index.html") -Destination $root -Force

Write-Host "Listo. Revisa 'git diff' antes de commitear."
Write-Host "Nota: index.html y sw.js se sobrescriben tal cual; si habias hecho ajustes propios (ej. quitar <script src='capacitor.js'>), vuelve a aplicarlos."
