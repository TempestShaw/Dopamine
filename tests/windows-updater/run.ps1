$ErrorActionPreference = "Stop"
$root = Resolve-Path "$PSScriptRoot/../.."
$work = Join-Path $env:RUNNER_TEMP "DopamineUpdaterSmoke"
$feed = Join-Path $work "feed"
$result = Join-Path $env:LOCALAPPDATA "DopamineUpdaterSmoke.txt"
Remove-Item $result -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $feed | Out-Null
foreach ($version in @("1.0.0", "2.0.0")) {
    $publish = Join-Path $work $version
    dotnet publish "$PSScriptRoot/UpdaterSmoke.csproj" -c Release -p:Version=$version -o $publish
    if ($LASTEXITCODE -ne 0) { throw "Smoke app build failed" }
    & "$root/DopamineWin/.tools/vpk.exe" pack --packId DopamineUpdaterSmoke --packVersion $version --packDir $publish --mainExe UpdaterSmoke.exe --outputDir $feed
    if ($LASTEXITCODE -ne 0) { throw "Smoke package failed" }
    if ($version -eq "2.0.0" -and -not (Get-ChildItem "$feed/*-delta.nupkg")) { throw "No delta package for 2.0.0" }
    if ($version -eq "1.0.0") {
        Copy-Item "$feed/*-Setup.exe" "$work/old-Setup.exe"
        Copy-Item "$feed/*-Portable.zip" "$work/old-Portable.zip"
    }
}
$server = Start-Process python -ArgumentList @("-m", "http.server", "43127", "--bind", "127.0.0.1", "--directory", $feed) -PassThru
try {
    # Both installation and portable packaging must use the production updater successfully.
    foreach ($kind in @("installed", "portable")) {
        Remove-Item $result -ErrorAction SilentlyContinue
        $target = Join-Path $work $kind
        if ($kind -eq "installed") {
            Start-Process "$work/old-Setup.exe" -ArgumentList @("--silent", "--installto", $target) -Wait
        } else {
            Expand-Archive "$work/old-Portable.zip" $target
        }
        $exe = Get-ChildItem $target -Recurse -Filter UpdaterSmoke.exe | Select-Object -First 1
        if (-not $exe) { throw "Missing smoke executable" }
        Start-Process $exe.FullName
        $deadline = (Get-Date).AddMinutes(3)
        while ((Get-Date) -lt $deadline) {
            if ((Test-Path $result) -and (Get-Content $result -Raw) -match "launched 2") { break }
            Start-Sleep -Milliseconds 500
        }
        $log = Get-Content $result -Raw
        Write-Output "$kind`: $log"
        if ($log -notmatch "launched 1" -or $log -notmatch "verified download" -or $log -notmatch "launched 2") {
            throw "$kind update did not download, replace and restart into version 2"
        }
    }
} finally {
    Stop-Process $server.Id -ErrorAction SilentlyContinue
}
