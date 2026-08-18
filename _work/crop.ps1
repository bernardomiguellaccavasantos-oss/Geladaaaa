Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = "Stop"

$src = "C:\Users\laccava\Documents\Gelada\Fotos\Fotos"
$out = "C:\Users\laccava\Documents\Gelada\_work\crop"
$sheetDir = "C:\Users\laccava\Documents\Gelada\_work"
New-Item -ItemType Directory -Force $out | Out-Null

# Instagram's dark chrome is exactly #000000 and its icons/text never reach the
# screen edges, so a row is "chrome" when the outer 40px on both sides are pure
# black. The media pane always covers the vertical centre of the screenshot, so
# seed there and grow outwards until we hit a sustained run of chrome rows.
# Growing from a seed beats thresholding on variance, which mistook the caption
# text below the photo for more photo.

$PANE_TOP = 500  # measured: first media row on every screenshot in this set
$FOOT = 2350     # inside this post's footer, above the next post's preview
$EDGE = 20       # IG pads its chrome ~28px in; the media pane is full-bleed
$DARK = 24.0     # IG's chrome fill is RGB(20,20,20), not pure black

$report = New-Object System.Collections.ArrayList
$crops = New-Object System.Collections.ArrayList

foreach ($f in (Get-ChildItem "$src\*.PNG" | Sort-Object Name)) {
    $bmp = [System.Drawing.Image]::FromFile($f.FullName)
    $w = $bmp.Width; $h = $bmp.Height

    $rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
    $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $stride = $data.Stride
    $bytes = New-Object byte[] ($stride * $h)
    [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
    $bmp.UnlockBits($data)

    $xs = New-Object System.Collections.ArrayList
    for ($x = 0; $x -lt $EDGE; $x += 4) { [void]$xs.Add($x) }
    for ($x = $w - $EDGE; $x -lt $w; $x += 4) { [void]$xs.Add($x) }

    $edgeMax = New-Object 'double[]' $h
    for ($y = 0; $y -lt $h; $y++) {
        $base = $y * $stride
        $max = 0.0
        foreach ($x in $xs) {
            $i = $base + $x * 3
            $lum = 0.114 * $bytes[$i] + 0.587 * $bytes[$i + 1] + 0.299 * $bytes[$i + 2]
            if ($lum -gt $max) { $max = $lum }
        }
        $edgeMax[$y] = $max
    }

    # The post header is a fixed-height component, so the media pane always starts
    # at the same y. Only its height varies (IG allows 1.91:1 / 1:1 / 4:5 / 3:4).
    # Scanning *down* for the top fails on photos with a dark upper edge, so pin
    # the top and find the bottom by scanning up from inside the footer chrome —
    # the caption and action icons never reach the screen edges, so everything
    # below the pane reads as chrome.
    $top = $PANE_TOP
    $bottom = $PANE_TOP + 1572
    for ($y = $FOOT; $y -gt ($top + 400); $y--) {
        if ($edgeMax[$y] -gt $DARK) { $bottom = $y + 1; break }
    }

    $ch = $bottom - $top
    [void]$report.Add(("{0}`ttop={1}`tbot={2}`th={3}`tw/h={4:N3}" -f $f.BaseName, $top, $bottom, $ch, ($w / $ch)))

    $crop = New-Object System.Drawing.Bitmap $w, $ch
    $g = [System.Drawing.Graphics]::FromImage($crop)
    $g.DrawImage($bmp, (New-Object System.Drawing.Rectangle 0, 0, $w, $ch), (New-Object System.Drawing.Rectangle 0, $top, $w, $ch), [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()
    $crop.Save("$out\$($f.BaseName).png", [System.Drawing.Imaging.ImageFormat]::Png)
    $crop.Dispose()
    $bmp.Dispose()
    [void]$crops.Add("$out\$($f.BaseName).png")
}

# --- contact sheets so the whole library can be reviewed in two passes ---
$cols = 5; $rows = 4; $cw = 300; $chh = 400
$font = New-Object System.Drawing.Font "Consolas", 22, ([System.Drawing.FontStyle]::Bold)
for ($s = 0; $s -lt 2; $s++) {
    $sheet = New-Object System.Drawing.Bitmap ($cols * $cw), ($rows * $chh)
    $sg = [System.Drawing.Graphics]::FromImage($sheet)
    $sg.Clear([System.Drawing.Color]::FromArgb(20, 20, 20))
    $sg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    for ($i = 0; $i -lt 20; $i++) {
        $idx = $s * 20 + $i
        if ($idx -ge $crops.Count) { break }
        $im = [System.Drawing.Image]::FromFile($crops[$idx])
        $cx = ($i % $cols) * $cw
        $cy = [math]::Floor($i / $cols) * $chh
        $sg.DrawImage($im, (New-Object System.Drawing.Rectangle $cx, $cy, $cw, ($chh - 28)))
        $label = [System.IO.Path]::GetFileNameWithoutExtension($crops[$idx]).Replace("IMG_", "")
        $sg.DrawString($label, $font, [System.Drawing.Brushes]::White, ($cx + 6), ($cy + $chh - 27))
        $im.Dispose()
    }
    $sg.Dispose()
    $sheet.Save("$sheetDir\sheet$($s + 1).jpg", [System.Drawing.Imaging.ImageFormat]::Jpeg)
    $sheet.Dispose()
}

$report -join "`n"
