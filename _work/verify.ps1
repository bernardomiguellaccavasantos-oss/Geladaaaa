Add-Type -AssemblyName System.Drawing
$files = Get-ChildItem "C:\Users\laccava\Documents\Gelada\assets\*-sm.jpg" | Sort-Object Name
$cols = 6; $cw = 250; $chh = 340
$rows = [math]::Ceiling($files.Count / $cols)
$sheet = New-Object System.Drawing.Bitmap ($cols * $cw), ($rows * $chh)
$g = [System.Drawing.Graphics]::FromImage($sheet)
$g.Clear([System.Drawing.Color]::FromArgb(18, 18, 18))
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$font = New-Object System.Drawing.Font "Consolas", 15, ([System.Drawing.FontStyle]::Bold)
for ($i = 0; $i -lt $files.Count; $i++) {
    $im = [System.Drawing.Image]::FromFile($files[$i].FullName)
    $cx = ($i % $cols) * $cw; $cy = [math]::Floor($i / $cols) * $chh
    $g.DrawImage($im, (New-Object System.Drawing.Rectangle $cx, $cy, $cw, ($chh - 22)))
    $g.DrawString($files[$i].BaseName.Replace("-sm", ""), $font, [System.Drawing.Brushes]::White, ($cx + 4), ($cy + $chh - 21))
    $im.Dispose()
}
$g.Dispose()
$sheet.Save("C:\Users\laccava\Documents\Gelada\_work\assets.jpg", [System.Drawing.Imaging.ImageFormat]::Jpeg)
$sheet.Dispose()
"ok $($files.Count)"
