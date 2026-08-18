Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = "Stop"

$crop = "C:\Users\laccava\Documents\Gelada\_work\crop"
$out = "C:\Users\laccava\Documents\Gelada\assets"
New-Item -ItemType Directory -Force $out | Out-Null

# name = output slug, src = cropped screenshot, big = wide variant width,
# trim = strip Instagram's carousel counter (top-right) and mute badge
# (bottom-right) that are burnt into these particular frames.
$picks = @(
    @{ src = "IMG_2970"; name = "hero-drink";      big = 1500; trim = $false }
    @{ src = "IMG_2974"; name = "venue-neon";      big = 1500; trim = $true }
    @{ src = "IMG_2975"; name = "adega-wall";      big = 1500; trim = $true }
    @{ src = "IMG_2996"; name = "pizza-artesanale"; big = 1500; trim = $false }

    @{ src = "IMG_2969"; name = "bolinho-pulled";  big = 900; trim = $false }
    @{ src = "IMG_2971"; name = "bolinho-queijo";  big = 900; trim = $false }
    @{ src = "IMG_2972"; name = "pizza-basilico";  big = 900; trim = $false }
    @{ src = "IMG_2977"; name = "panuozzo-parma";  big = 900; trim = $true }
    @{ src = "IMG_2985"; name = "panuozzo-spritz"; big = 900; trim = $false }
    @{ src = "IMG_2986"; name = "crostini";        big = 900; trim = $true }
    @{ src = "IMG_2993"; name = "bolinho-cesta";   big = 900; trim = $true }
    @{ src = "IMG_2994"; name = "fritas";          big = 900; trim = $false }
    @{ src = "IMG_2997"; name = "pizza-fatia";     big = 900; trim = $false }
    @{ src = "IMG_2998"; name = "pizza-corte";     big = 900; trim = $false }
    @{ src = "IMG_2999"; name = "negroni";         big = 900; trim = $false }
    @{ src = "IMG_3004"; name = "bolinho-plated";  big = 900; trim = $true }
    @{ src = "IMG_3005"; name = "drinks-fila";     big = 900; trim = $false }
    @{ src = "IMG_3006"; name = "moscow-mule";     big = 900; trim = $false }
    @{ src = "IMG_3007"; name = "drinks-dupla";    big = 900; trim = $false }
    @{ src = "IMG_3009"; name = "caipirinhas";     big = 900; trim = $false }
    @{ src = "IMG_2978"; name = "pizza-mao";       big = 900; trim = $true }

    @{ src = "IMG_2976"; name = "logo-lightbox";   big = 900; trim = $true }
    @{ src = "IMG_2981"; name = "dj";              big = 900; trim = $true }
    @{ src = "IMG_3003"; name = "casal-bar";       big = 900; trim = $true }
    @{ src = "IMG_2973"; name = "fundador";        big = 900; trim = $true }
    @{ src = "IMG_2988"; name = "massa";           big = 900; trim = $true }
    @{ src = "IMG_2987"; name = "forno";           big = 900; trim = $true }
)

$enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$qp = New-Object System.Drawing.Imaging.EncoderParameters 1
$qp.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 74

$log = New-Object System.Collections.ArrayList

foreach ($p in $picks) {
    $srcPath = "$crop\$($p.src).png"
    if (-not (Test-Path $srcPath)) { [void]$log.Add("MISSING $($p.src)"); continue }
    $im = [System.Drawing.Image]::FromFile($srcPath)

    $sx = 0; $sy = 0; $sw = $im.Width; $sh = $im.Height
    if ($p.trim) {
        # 9% clears the carousel counter (top-right) and the mute badge
        # (bottom-right) on every frame in this set; 5.5% left a sliver.
        $sy = [int]($im.Height * 0.09)
        $sh = [int]($im.Height * 0.82)
    }

    foreach ($w in @($p.big, [int]($p.big / 1.8))) {
        $h = [int][math]::Round($w * $sh / $sw)
        $bmp = New-Object System.Drawing.Bitmap $w, $h
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.DrawImage($im, (New-Object System.Drawing.Rectangle 0, 0, $w, $h), $sx, $sy, $sw, $sh, [System.Drawing.GraphicsUnit]::Pixel)
        $g.Dispose()
        $suffix = if ($w -eq $p.big) { "lg" } else { "sm" }
        $bmp.Save("$out\$($p.name)-$suffix.jpg", $enc, $qp)
        $bmp.Dispose()
    }
    $im.Dispose()
    [void]$log.Add("$($p.name)  $sw x $sh")
}

$total = (Get-ChildItem "$out\*.jpg" | Measure-Object Length -Sum).Sum
[void]$log.Add(("--- {0} files, {1:N1} MB total" -f (Get-ChildItem "$out\*.jpg").Count, ($total / 1MB)))
$log -join "`n"
