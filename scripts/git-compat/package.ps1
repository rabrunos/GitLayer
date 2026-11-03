[CmdletBinding(DefaultParameterSetName='Create')]
param(
  [Parameter(Mandatory=$true,ParameterSetName='Create')][string]$Source,
  [Parameter(Mandatory=$true,ParameterSetName='Create')][string]$Destination,
  [Parameter(Mandatory=$true)][string]$CheckDirectory,
  [Parameter(Mandatory=$true,ParameterSetName='Validate')][string]$ArchiveToCheck
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

# Extended paths are an I/O representation only. ZIP names and safety checks
# retain ordinary canonical absolute paths; no global policy/config is changed.
function Get-ExtendedPath([string]$Path) {
  if ($Path.StartsWith('\\?\')) { return $Path }
  $full = [IO.Path]::GetFullPath($Path)
  if ($full.StartsWith('\\')) { return '\\?\UNC\' + $full.Substring(2) }
  return '\\?\' + $full
}

function Assert-NewPath([string]$Path) {
  try {
    [void][IO.File]::GetAttributes((Get-ExtendedPath $Path))
  } catch {
    $failure = $_.Exception.GetBaseException()
    if ($failure -is [IO.FileNotFoundException] -or $failure -is [IO.DirectoryNotFoundException]) { return }
    throw
  }
  throw 'Packaging destinations must be new'
}

# PKWARE APPNOTE 4.4.17.1: relative names, no drive/leading slash, '/' only.
# Reject Windows aliases too: ADS, case collisions, dot/empty segments and
# trailing spaces/dots must not turn distinct records into one output path.
function Assert-PortableEntryName([string]$Name) {
  if ([string]::IsNullOrEmpty($Name) -or $Name.Contains('\') -or $Name.Contains('//') -or $Name.StartsWith('/') -or
      [IO.Path]::IsPathRooted($Name) -or $Name.Contains(':') -or $Name -match '[\x00-\x1f<>"|?*]') {
    throw 'Unsafe output ZIP entry name'
  }
  foreach ($part in $Name.TrimEnd('/').Split('/')) {
    if ($part -eq '' -or $part -eq '.' -or $part -eq '..' -or $part.EndsWith('.') -or $part.EndsWith(' ') -or
        $part -match '^(?i:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)') {
      throw 'Unsafe output ZIP path segment'
    }
  }
}

function Get-PortableSourceEntries([string]$Root) {
  $Root = Get-ExtendedPath $Root
  if (-not [IO.Directory]::Exists($Root)) { throw 'Source must be an existing directory' }
  if (([IO.File]::GetAttributes($Root) -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Unsafe source reparse point' }
  $prefix = $Root.TrimEnd([char[]]'\/') + [IO.Path]::DirectorySeparatorChar
  $pending = [Collections.Generic.Stack[string]]::new()
  $pending.Push($Root)
  $entries = [Collections.Generic.List[object]]::new()
  $seen = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  while ($pending.Count -gt 0) {
    foreach ($item in [IO.Directory]::EnumerateFileSystemEntries($pending.Pop())) {
      $attributes = [IO.File]::GetAttributes($item)
      if (($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Unsafe source reparse point' }
      $directory = ($attributes -band [IO.FileAttributes]::Directory) -ne 0
      $name = $item.Substring($prefix.Length).Replace('\','/')
      if ($directory) { $name += '/' }
      Assert-PortableEntryName $name
      if (-not $seen.Add($name.TrimEnd('/'))) { throw 'Duplicate portable source path' }
      $entries.Add([pscustomobject]@{ Path=$item; Name=$name; Directory=$directory })
      if ($directory) { $pending.Push($item) }
    }
  }
  return ,$entries
}

function Write-PortableArchive([string]$OutputPath, $Entries) {
  # Do not use ZipFile.CreateFromDirectory: .NET Framework on Windows can
  # persist '\' in FullName. Encode each canonical name explicitly instead.
  $stream = [IO.File]::Open((Get-ExtendedPath $OutputPath),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  $archive = $null
  try {
    # The default encoder marks non-ASCII names with the standard UTF-8 flag.
    # A custom UTF8Encoding instance on this .NET Framework did not set it.
    $archive = [IO.Compression.ZipArchive]::new($stream,[IO.Compression.ZipArchiveMode]::Create,$false)
    foreach ($item in $Entries) {
      $entry = $archive.CreateEntry($item.Name,[IO.Compression.CompressionLevel]::Optimal)
      if ($item.Directory) { $entry.ExternalAttributes = 0x10; continue }
      if (([IO.File]::GetAttributes($item.Path) -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Unsafe source reparse point' }
      $inputStream = [IO.File]::Open($item.Path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
      $outputStream = $entry.Open()
      try { $inputStream.CopyTo($outputStream) } finally { $outputStream.Dispose(); $inputStream.Dispose() }
    }
  } finally { if ($null -ne $archive) { $archive.Dispose() }; $stream.Dispose() }
}

function Expand-PortableArchive([string]$InputPath,[string]$OutputPath) {
  Assert-NewPath $OutputPath
  $prefix = $OutputPath.TrimEnd([char[]]'\/') + [IO.Path]::DirectorySeparatorChar
  $archive = [IO.Compression.ZipFile]::OpenRead((Get-ExtendedPath $InputPath))
  try {
    $seen = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    $files = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    $plan = [Collections.Generic.List[object]]::new()
    foreach ($entry in $archive.Entries) {
      Assert-PortableEntryName $entry.FullName
      $unixType = ($entry.ExternalAttributes -shr 16) -band 0xF000
      if ($unixType -eq 0xA000 -or ($entry.ExternalAttributes -band [int][IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw 'Unsafe output ZIP symlink or reparse point'
      }
      # Windows/.NET understands '/' natively. There is no receiving-side
      # backslash repair: the stored name itself must already be portable.
      $target = [IO.Path]::GetFullPath([IO.Path]::Combine($OutputPath,$entry.FullName)).TrimEnd([char[]]'\/')
      if (-not $target.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase) -or -not $seen.Add($target)) {
        throw 'Invalid or duplicate output ZIP paths'
      }
      $directory = $entry.FullName.EndsWith('/')
      if (-not $directory) { [void]$files.Add($target) }
      $plan.Add([pscustomobject]@{ Entry=$entry; Target=$target; Directory=$directory })
    }
    foreach ($item in $plan) {
      $parent = [IO.Path]::GetDirectoryName($item.Target)
      while ($parent.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase)) {
        if ($files.Contains($parent)) { throw 'Invalid ZIP file/directory parent conflict' }
        $parent = [IO.Path]::GetDirectoryName($parent)
      }
    }
    # Validate every record before creating even the fresh extraction root.
    [IO.Directory]::CreateDirectory((Get-ExtendedPath $OutputPath)) | Out-Null
    foreach ($item in $plan) {
      if ($item.Directory) { [IO.Directory]::CreateDirectory((Get-ExtendedPath $item.Target)) | Out-Null; continue }
      [IO.Directory]::CreateDirectory((Get-ExtendedPath ([IO.Path]::GetDirectoryName($item.Target)))) | Out-Null
      $inputStream = $item.Entry.Open()
      $outputStream = [IO.File]::Open((Get-ExtendedPath $item.Target),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write)
      try { $inputStream.CopyTo($outputStream) } finally { $outputStream.Dispose(); $inputStream.Dispose() }
    }
  } finally { $archive.Dispose() }
}

$checkPath = [IO.Path]::GetFullPath($CheckDirectory)
Assert-NewPath $checkPath
if ($PSCmdlet.ParameterSetName -eq 'Validate') {
  Expand-PortableArchive ([IO.Path]::GetFullPath($ArchiveToCheck)) $checkPath
  Write-Output ('ZIP_VALIDATED_AND_REOPENED=' + [IO.Path]::GetFullPath($ArchiveToCheck))
} else {
  $sourcePath = [IO.Path]::GetFullPath($Source)
  $destinationPath = [IO.Path]::GetFullPath($Destination)
  Assert-NewPath $destinationPath
  $sourcePrefix = $sourcePath.TrimEnd([char[]]'\/') + [IO.Path]::DirectorySeparatorChar
  if ($destinationPath.StartsWith($sourcePrefix,[StringComparison]::OrdinalIgnoreCase) -or $checkPath.StartsWith($sourcePrefix,[StringComparison]::OrdinalIgnoreCase)) {
    throw 'Invalid ZIP destinations inside source directory'
  }
  $entries = Get-PortableSourceEntries $sourcePath
  Write-PortableArchive $destinationPath $entries
  Expand-PortableArchive $destinationPath $checkPath
  Write-Output ('ZIP_CREATED_AND_REOPENED=' + $destinationPath)
}
