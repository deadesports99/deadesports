<#
.SYNOPSIS
  One-click on/off for the reward modules (referral / daily bonus / tasks / earn hub).

.DESCRIPTION
  Edits the "features" block of the Player app's client_config.json — the file the
  Gradle build bakes into BuildConfig.FEATURE_*. Nothing else in the JSON is
  touched, and key order + 2-space indentation are preserved so git diffs stay one
  line per flip.

  The flag is a BUILD-TIME switch: an APK built while a module was off does not
  contain that screen at all. Rebuild (or pass -Build) after flipping.

.EXAMPLES
  tools\features.ps1                              # show current flags
  tools\features.ps1 -Feature referral -On        # turn referral on
  tools\features.ps1 -Feature daily_bonus -Off    # turn daily bonus off
  tools\features.ps1 -All -Off                    # kill every reward module
  tools\features.ps1 -All -On -Build              # flip all + build debug APK
  tools\features.ps1 -Feature tasks -On -Client clients\sample_client
#>
[CmdletBinding()]
param(
    [ValidateSet('referral', 'daily_bonus', 'tasks', 'earn_hub', 'rewards_push')]
    [string]$Feature,

    [switch]$On,

    [switch]$Off,

    [switch]$All,

    [string]$Client,

    [switch]$Build
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

function Get-ConfigPath {
    if ($Client) {
        $candidate = if (Test-Path (Join-Path $root $Client)) { Join-Path $root $Client } else { Join-Path $root "clients\$Client" }
        $p = Join-Path $candidate 'client_config.json'
        if (-not (Test-Path $p)) { throw "client_config.json not found for '$Client'" }
        return $p
    }
    return (Join-Path $root 'android\app-player\src\main\assets\client_config.json')
}

$configPath = Get-ConfigPath
Write-Host ""
Write-Host "  config: $configPath" -ForegroundColor DarkGray

$json = Get-Content -Raw -Encoding UTF8 $configPath
$data = $json | ConvertFrom-Json

# Order used everywhere (Gradle log, docs, this script).
$keys = @('referral', 'daily_bonus', 'tasks', 'earn_hub', 'rewards_push')

function Get-Flag($obj, [string]$key) {
    if ($obj.PSObject.Properties.Name -contains $key) { return [bool]$obj.$key }
    return $false
}

function Show-Flags($obj) {
    Write-Host ""
    Write-Host "  REWARD MODULES" -ForegroundColor Cyan
    foreach ($k in $keys) {
        $on = Get-Flag $obj $k
        $pretty = if ($on) { 'ON ' } else { 'OFF' }
        $color = if ($on) { 'Green' } else { 'DarkGray' }
        Write-Host ("    {0,-14} {1}" -f $k, $pretty) -ForegroundColor $color
    }
    $any = (Get-Flag $obj 'referral') -or (Get-Flag $obj 'daily_bonus') -or (Get-Flag $obj 'tasks')
    Write-Host ("    {0,-14} {1}" -f '=> hub live', $(if ($any -and (Get-Flag $obj 'earn_hub')) { 'YES (5th tab)' } else { 'NO (4 tabs)' })) -ForegroundColor Yellow
    Write-Host ""
}

if (-not ($data.PSObject.Properties.Name -contains 'features') -or $null -eq $data.features) {
    Add-Member -InputObject $data -MemberType NoteProperty -Name 'features' -Value ([pscustomobject]@{})
}
$features = $data.features
foreach ($k in $keys) {
    if (-not ($features.PSObject.Properties.Name -contains $k)) {
        Add-Member -InputObject $features -MemberType NoteProperty -Name $k -Value $false
    }
}

if ($Feature) {
    if ($On -eq $Off) { throw "Pass exactly one of -On or -Off." }
    $value = [bool]$On
    $features.$Feature = $value
    # Turning any money module on implies the hub; turning all off clears it.
    if ($value -and @('referral', 'daily_bonus', 'tasks') -contains $Feature) { $features.earn_hub = $true }
    if (-not $value -and @('referral', 'daily_bonus', 'tasks') -contains $Feature) {
        if (-not ((Get-Flag $features 'referral') -or (Get-Flag $features 'daily_bonus') -or (Get-Flag $features 'tasks'))) {
            $features.earn_hub = $false
        }
    }
    Write-Host "  set $Feature = $($value.ToString().ToUpper())" -ForegroundColor Green
}

if ($All) {
    if ($On -eq $Off) { throw "Pass -All with -On or -Off." }
    $value = [bool]$On
    foreach ($k in @('referral', 'daily_bonus', 'tasks', 'earn_hub')) { $features.$k = $value }
    Write-Host "  set ALL reward modules = $($value.ToString().ToUpper())" -ForegroundColor Green
}

if ($Feature -or $All) {
    # Surgical write: only the "features" block is rewritten, so the rest of the
    # file (key order, spacing, quotes) stays byte-identical and the git diff is
    # exactly the flipped lines.
    $blockLines = @()
    foreach ($k in $keys) {
        $v = if (Get-Flag $features $k) { 'true' } else { 'false' }
        $blockLines += ('    "{0}": {1}' -f $k, $v)
    }
    $block = "`"features`": {`n" + ($blockLines -join ",`n") + "`n  }"

    $pattern = '(?s)"features"\s*:\s*\{.*?\}'
    if ([regex]::IsMatch($json, $pattern)) {
        $updated = [regex]::Replace($json, $pattern, $block, 1)
    } else {
        $idx = $json.LastIndexOf('}')
        $body = $json.Substring(0, $idx).TrimEnd()
        if (-not $body.EndsWith(',')) { $body += ',' }
        $updated = $body + "`n  " + $block + "`n}`n"
    }

    # Refuse to save something the app could not parse.
    try { $null = $updated | ConvertFrom-Json } catch { throw "refusing to write invalid JSON: $_" }

    [System.IO.File]::WriteAllText($configPath, ($updated -replace "`r`n", "`n"), (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "  saved." -ForegroundColor Green
}

Show-Flags $features

if ($Build) {
    Write-Host "  building :app-player:assembleDebug ..." -ForegroundColor Cyan
    Push-Location (Join-Path $root 'android')
    try {
        & .\gradlew.bat :app-player:assembleDebug
        if ($LASTEXITCODE -ne 0) { throw "Gradle build failed ($LASTEXITCODE)" }
    } finally { Pop-Location }
    $apk = Join-Path $root 'android\app-player\build\outputs\apk\debug\app-player-debug.apk'
    if (Test-Path $apk) {
        Write-Host "  APK: $apk" -ForegroundColor Green
        Write-Host "  install: adb install -r `"$apk`"" -ForegroundColor DarkGray
    }
}
