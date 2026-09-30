$ErrorActionPreference = 'Stop'
$mapRoot = Join-Path (Split-Path $PSScriptRoot -Parent) 'egg-map'
$relativePaths = @('maps.json', 'features.json', 'marker-layers.json')
foreach ($folder in @('maps', 'clean-maps', 'marker-icons')) {
    $folderRoot = Join-Path $mapRoot $folder
    foreach ($item in (Get-ChildItem $folderRoot -Filter '*.webp' -Recurse -File | Sort-Object FullName)) {
        $relativePaths += $item.FullName.Substring($mapRoot.Length + 1).Replace('\', '/')
    }
}
$entries = @()
foreach ($relativePath in $relativePaths) {
    $localPath = Join-Path $mapRoot $relativePath
    $item = Get-Item $localPath
    $entries += [ordered]@{path=$relativePath;bytes=$item.Length;sha256=(Get-FileHash $localPath -Algorithm SHA256).Hash.ToLowerInvariant()}
}
$sha = [System.Security.Cryptography.SHA256]::Create()
$entryJson = ConvertTo-Json -InputObject $entries -Depth 6 -Compress
$version = ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($entryJson)))).Replace('-', '').ToLowerInvariant().Substring(0,24)
$result = [ordered]@{schema=1;version=$version;files=$entries}
$target = Join-Path $mapRoot 'database-version.json'
[IO.File]::WriteAllText($target, (ConvertTo-Json -InputObject $result -Depth 8), (New-Object Text.UTF8Encoding($false)))
Write-Host "Updated egg-map/database-version.json ($($entries.Count) files)"
