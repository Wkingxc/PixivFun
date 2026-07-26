$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$workspace = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $workspace 'app\assets\PixivFun.png'
$outputDirectory = Join-Path $workspace 'desktop\generated'
$outputPath = Join-Path $outputDirectory 'PixivFunIcon.png'

New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

$source = [System.Drawing.Image]::FromFile($sourcePath)
$canvas = New-Object System.Drawing.Bitmap 1024, 1024, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($canvas)

try {
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

  $scale = [Math]::Min(920 / $source.Width, 920 / $source.Height)
  $width = [Math]::Round($source.Width * $scale)
  $height = [Math]::Round($source.Height * $scale)
  $x = [Math]::Round((1024 - $width) / 2)
  $y = [Math]::Round((1024 - $height) / 2)

  $graphics.DrawImage($source, $x, $y, $width, $height)
  $canvas.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $graphics.Dispose()
  $canvas.Dispose()
  $source.Dispose()
}

Write-Output 'Desktop application icon generated.'
