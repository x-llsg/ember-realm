$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$projectDir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$version = (Get-Content -LiteralPath (Join-Path $projectDir 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json).version
$releaseDir = Join-Path $projectDir 'release'
$stageDir = Join-Path $releaseDir ('ember-realm-' + $version)
New-Item -ItemType Directory -Path (Join-Path $stageDir 'ember-realm') -Force | Out-Null
$compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) {
  $compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework/v4.0.30319/csc.exe'
}
if (-not (Test-Path -LiteralPath $compiler)) { throw 'The Windows .NET Framework C# compiler is required for the .exe launcher. The generated play.html works without it.' }
$exePath = Join-Path $stageDir '启动余烬之境.exe'
& $compiler /nologo /target:winexe /reference:System.Windows.Forms.dll (('/out:') + $exePath) (Join-Path $PSScriptRoot 'launcher.cs')
if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed' }
Copy-Item -LiteralPath (Join-Path $projectDir 'play.html') -Destination (Join-Path $stageDir 'ember-realm/play.html') -Force
Copy-Item -LiteralPath (Join-Path $projectDir 'LICENSE') -Destination (Join-Path $stageDir 'LICENSE.txt') -Force
$cmd = '@echo off' + [Environment]::NewLine + 'start "" "%~dp0ember-realm\play.html"' + [Environment]::NewLine + 'exit /b'
[System.IO.File]::WriteAllText((Join-Path $stageDir '启动余烬之境.cmd'),$cmd,[Text.Encoding]::ASCII)
$guide = '余烬之境 V' + $version + [Environment]::NewLine + '完整解压后双击启动程序，或打开 ember-realm/play.html。无需联网。' + [Environment]::NewLine + '更新前关闭旧页面，建议先在设置中导出手记备份。'
[System.IO.File]::WriteAllText((Join-Path $stageDir '游戏说明.txt'),$guide,[Text.UTF8Encoding]::new($true))
$entries = @('启动余烬之境.exe','启动余烬之境.cmd','游戏说明.txt','LICENSE.txt','ember-realm/play.html')
$archivePath = Join-Path $releaseDir ('ember-realm-V' + $version + '-windows-portable.zip')
$archiveStream = [System.IO.File]::Open($archivePath,[System.IO.FileMode]::Create)
$archive = [System.IO.Compression.ZipArchive]::new($archiveStream,[System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($entry in $entries) {
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,(Join-Path $stageDir $entry),$entry,[System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally { $archive.Dispose(); $archiveStream.Dispose() }
$verify = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
try {
  if ($verify.Entries.Count -ne $entries.Count) { throw 'Unexpected archive entry count' }
  foreach ($entry in $verify.Entries) {
    $inputStream = $entry.Open(); $sha = [Security.Cryptography.SHA256]::Create()
    try { $actual = [BitConverter]::ToString($sha.ComputeHash($inputStream)).Replace('-','') }
    finally { $inputStream.Dispose(); $sha.Dispose() }
    if ($actual -ne (Get-FileHash -LiteralPath (Join-Path $stageDir $entry.FullName) -Algorithm SHA256).Hash) { throw 'Archive contents differ from source' }
  }
} finally { $verify.Dispose() }
$hash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLower()
[System.IO.File]::WriteAllText((Join-Path $releaseDir 'SHA256SUMS.txt'),($hash + '  ' + [System.IO.Path]::GetFileName($archivePath) + [Environment]::NewLine),[Text.Encoding]::ASCII)
Write-Output $archivePath
