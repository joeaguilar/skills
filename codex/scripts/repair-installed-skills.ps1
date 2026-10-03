# Replace existing repository-managed skill copies with Windows junctions.
# Unique local skills and the product-owned .system directory are preserved.
[CmdletBinding()]
param(
    [switch]$Apply,
    [string]$Source = (Join-Path $PSScriptRoot '..\skills'),
    [string]$CodexHome = $(if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' })
)

$ErrorActionPreference = 'Stop'
$sourceRoot = (Resolve-Path -LiteralPath $Source).Path
$installedRoot = (Resolve-Path -LiteralPath (Join-Path $CodexHome 'skills')).Path
if ((Get-Item -LiteralPath $installedRoot -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
    throw 'The installed skills root must be a real directory before repairing individual skills.'
}
if ($sourceRoot -eq $installedRoot) { throw 'Source and installed roots must differ.' }
$backupRoot = Join-Path $CodexHome ('skill-backups\repair-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
$changed = 0

foreach ($sourceSkill in Get-ChildItem -LiteralPath $sourceRoot -Directory) {
    if ($sourceSkill.Name.StartsWith('.') -or -not (Test-Path -LiteralPath (Join-Path $sourceSkill.FullName 'SKILL.md'))) { continue }
    $installedPath = [IO.Path]::GetFullPath((Join-Path $installedRoot $sourceSkill.Name))
    if ([IO.Path]::GetDirectoryName($installedPath) -ne $installedRoot) { throw "Target escaped installed root: $installedPath" }
    $installed = Get-Item -LiteralPath $installedPath -Force -ErrorAction SilentlyContinue
    if ($null -eq $installed) { continue }
    if (-not $installed.PSIsContainer) { throw "Installed skill is not a directory: $installedPath" }
    if ($installed.Attributes -band [IO.FileAttributes]::ReparsePoint) {
        if ($installed.Target -and [IO.Path]::GetFullPath($installed.Target) -eq $sourceSkill.FullName) {
            Write-Output "CURRENT $($sourceSkill.Name) (already linked)"
            continue
        }
        throw "Unexpected existing link; inspect before replacing: $installedPath"
    }

    $backupPath = [IO.Path]::GetFullPath((Join-Path $backupRoot $sourceSkill.Name))
    if ([IO.Path]::GetDirectoryName($backupPath) -ne [IO.Path]::GetFullPath($backupRoot)) { throw "Backup escaped backup root: $backupPath" }
    Write-Output "LINK $installedPath -> $($sourceSkill.FullName)"
    Write-Output "  Backup: $backupPath"
    if ($Apply) {
        New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
        Move-Item -LiteralPath $installedPath -Destination $backupPath
        try {
            New-Item -ItemType Junction -Path $installedPath -Target $sourceSkill.FullName | Out-Null
        } catch {
            if (-not (Test-Path -LiteralPath $installedPath)) {
                Move-Item -LiteralPath $backupPath -Destination $installedPath
            }
            throw
        }
    }
    $changed++
}

if ($Apply) { Write-Output "Repaired $changed skill(s). Backups: $backupRoot" }
else { Write-Output "Dry run: $changed skill(s). Pass -Apply to back up and link these directories." }
