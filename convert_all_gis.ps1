param()
$ErrorActionPreference = "Stop"

function Convert-TM($x, $y) {
    if ([double]::IsNaN($x) -or [double]::IsInfinity($x) -or [double]::IsNaN($y) -or [double]::IsInfinity($y) -or
        $x -lt 50000 -or $x -gt 450000 -or $y -lt 100000 -or $y -gt 700000) {
        return $null
    }
    $a = 6378137.0
    $f = 1.0 / 298.257222101
    $b = $a * (1.0 - $f)
    $e2 = ($a*$a - $b*$b) / ($a*$a)
    $ep2 = ($a*$a - $b*$b) / ($b*$b)
    
    $lat0 = 38.0 * [Math]::PI / 180.0
    $lon0 = 129.0 * [Math]::PI / 180.0
    $x0 = 200000.0
    $y0 = 600000.0
    $k0 = 1.0
    
    $x_adj = $x - $x0
    $y_adj = $y - $y0
    
    $e4 = $e2 * $e2
    $e6 = $e4 * $e2
    $m0 = $a * ((1.0 - $e2/4.0 - 3.0*$e4/64.0 - 5.0*$e6/256.0)*$lat0 - (3.0*$e2/8.0 + 3.0*$e4/32.0 + 45.0*$e6/1024.0)*[Math]::Sin(2*$lat0) + (15.0*$e4/256.0 + 45.0*$e6/1024.0)*[Math]::Sin(4*$lat0) - (35.0*$e6/3072.0)*[Math]::Sin(6*$lat0))
    
    $m = $m0 + $y_adj / $k0
    $mu = $m / ($a * (1.0 - $e2/4.0 - 3.0*$e4/64.0 - 5.0*$e6/256.0))
    $e1 = (1.0 - [Math]::Sqrt(1.0 - $e2)) / (1.0 + [Math]::Sqrt(1.0 - $e2))
    
    $phi1 = $mu + (3.0*$e1/2.0 - 27.0*[Math]::Pow($e1,3)/32.0)*[Math]::Sin(2*$mu) + (21.0*[Math]::Pow($e1,2)/16.0 - 55.0*[Math]::Pow($e1,4)/32.0)*[Math]::Sin(4*$mu) + (151.0*[Math]::Pow($e1,3)/96.0)*[Math]::Sin(6*$mu) + (1097.0*[Math]::Pow($e1,4)/512.0)*[Math]::Sin(8*$mu)
    
    $sin_phi1 = [Math]::Sin($phi1)
    $cos_phi1 = [Math]::Cos($phi1)
    $tan_phi1 = [Math]::Tan($phi1)
    
    $c1 = $ep2 * $cos_phi1 * $cos_phi1
    $t1 = $tan_phi1 * $tan_phi1
    $n1 = $a / [Math]::Sqrt(1.0 - $e2 * $sin_phi1 * $sin_phi1)
    $r1 = $a * (1.0 - $e2) / [Math]::Pow(1.0 - $e2 * $sin_phi1 * $sin_phi1, 1.5)
    $d = $x_adj / ($n1 * $k0)
    
    $lat = $phi1 - ($n1 * $tan_phi1 / $r1) * ($d*$d/2.0 - (5.0 + 3.0*$t1 + 10.0*$c1 - 4.0*$c1*$c1 - 9.0*$ep2)*[Math]::Pow($d,4)/24.0 + (61.0 + 90.0*$t1 + 298.0*$c1 + 45.0*$t1*$t1 - 252.0*$ep2 - 3.0*$c1*$c1)*[Math]::Pow($d,6)/720.0)
    $lon = $lon0 + ($d - (1.0 + 2.0*$t1 + $c1)*[Math]::Pow($d,3)/6.0 + (5.0 - 2.0*$c1 + 28.0*$t1 - 3.0*$c1*$c1 + 8.0*$ep2 + 24.0*$t1*$t1)*[Math]::Pow($d,5)/120.0) / $cos_phi1
    
    $lat_deg = [Math]::Round($lat * 180.0 / [Math]::PI, 6)
    $lon_deg = [Math]::Round($lon * 180.0 / [Math]::PI, 6)
    if ([double]::IsNaN($lat_deg) -or [double]::IsInfinity($lat_deg) -or
        [double]::IsNaN($lon_deg) -or [double]::IsInfinity($lon_deg) -or
        $lat_deg -lt 34.5 -or $lat_deg -gt 36.0 -or $lon_deg -lt 128.0 -or $lon_deg -gt 129.6) {
        return $null
    }
    return @($lat_deg, $lon_deg)
}

function Get-FieldInfo($dbfBytes, $tName) {
    $hLen = [System.BitConverter]::ToInt16($dbfBytes, 8)
    $cur = 32
    $fOffset = 0
    while ($cur -lt ($hLen - 1)) {
        if ($dbfBytes[$cur] -eq 0x0D) { break }
        $fname = [System.Text.Encoding]::ASCII.GetString($dbfBytes, $cur, 11).Trim([char]0).Trim().Replace('\','').Replace('"','').Replace("",'').Replace("
",'')
        $flen = $dbfBytes[$cur + 16]
        if ($fname -eq $tName) {
            return @{ Offset = $fOffset; Length = $flen }
        }
        $fOffset += $flen
        $cur += 32
    }
    return $null
}

$enc949 = [System.Text.Encoding]::GetEncoding(949)
$base = "data\gimhae_gis_extracted\김해(gis)"
$outFile = "data\gimhae_gis_dataset.js"
$sw = New-Object System.IO.StreamWriter($outFile, $false, [System.Text.Encoding]::UTF8)
$sw.WriteLine("/** Kimhae GIS Dataset WGS84 - 8 SHP Layers */")
$sw.Write("window.GIMHAE_GIS_DATA = {")

# 1. Blocks (103)
Write-Host "Converting 1. 블록경계..."
$blkShp = [System.IO.File]::ReadAllBytes("$base\블록경계.shp")
$blkDbf = [System.IO.File]::ReadAllBytes("$base\블록경계.dbf")
$bHdrLen = [System.BitConverter]::ToInt16($blkDbf, 8)
$bRecLen = [System.BitConverter]::ToInt16($blkDbf, 10)
$bNumRec = [System.BitConverter]::ToInt32($blkDbf, 4)
$fInfo = Get-FieldInfo $blkDbf "BLOCK_NM"

$sw.WriteLine(); $sw.Write('"blocks": [')
$offset = 100
$idx = 0
$first = $true
while ($offset -lt $blkShp.Length -and $idx -lt $bNumRec) {
    $recLenWords = [System.BitConverter]::ToInt32(@($blkShp[$offset+7], $blkShp[$offset+6], $blkShp[$offset+5], $blkShp[$offset+4]), 0)
    $recLenBytes = $recLenWords * 2
    $stype = [System.BitConverter]::ToInt32($blkShp, $offset + 8)
    $bName = "Block " + ($idx + 1)
    if ($fInfo) {
        $rStart = $bHdrLen + $idx * $bRecLen + 1 + $fInfo.Offset
        $val = $enc949.GetString($blkDbf, $rStart, $fInfo.Length).Trim([char]0).Trim().Replace('\','').Replace('"','').Replace("",'').Replace("
",'')
        if ($val) { $bName = $val }
    }
    if ($stype -eq 5) {
        $numParts = [System.BitConverter]::ToInt32($blkShp, $offset + 44)
        $numPoints = [System.BitConverter]::ToInt32($blkShp, $offset + 48)
        $ptsStart = $offset + 52 + ($numParts * 4)
        $step = 1
        if ($numPoints -gt 300) { $step = 3 }
        $cArr = @()
        for ($p = 0; $p -lt $numPoints; $p += $step) {
            $px = [System.BitConverter]::ToDouble($blkShp, $ptsStart + ($p * 16))
            $py = [System.BitConverter]::ToDouble($blkShp, $ptsStart + ($p * 16) + 8)
            $wgs = Convert-TM $px $py
            if ($wgs) { $cArr += "[$($wgs[0]),$($wgs[1])]" }
        }
        if ($cArr.Count -ge 3) {
            if (-not $first) { $sw.Write(',') }
            $first = $false
            $sw.Write("{`"id`":`"BLK-$($idx+1)`",`"name`":`"$bName`",`"coordinates`":[$($cArr -join ',')]}")
        }
    }
    $offset += 8 + $recLenBytes
    $idx++
}
$sw.Write('],')
Write-Host "Blocks done: $idx"

# 2. Reservoirs (정수장배수지 - 44)
Write-Host "Converting 2. 정수장배수지..."
$resShp = [System.IO.File]::ReadAllBytes("$base\정수장배수지.shp")
$resDbf = [System.IO.File]::ReadAllBytes("$base\정수장배수지.dbf")
$rHdrLen = [System.BitConverter]::ToInt16($resDbf, 8)
$rRecLen = [System.BitConverter]::ToInt16($resDbf, 10)
$rNumRec = [System.BitConverter]::ToInt32($resDbf, 4)
$fSrv = Get-FieldInfo $resDbf "SRV_NAM"
$fPur = Get-FieldInfo $resDbf "PUR_NAM"

$sw.WriteLine(); $sw.Write('"reservoirs": [')
$offset = 100
$idx = 0
$first = $true
while ($offset -lt $resShp.Length -and $idx -lt $rNumRec) {
    $recLenWords = [System.BitConverter]::ToInt32(@($resShp[$offset+7], $resShp[$offset+6], $resShp[$offset+5], $resShp[$offset+4]), 0)
    $recLenBytes = $recLenWords * 2
    $stype = [System.BitConverter]::ToInt32($resShp, $offset + 8)
    $rName = "정수·배수지 " + ($idx + 1)
    if ($fSrv) {
        $rStart = $rHdrLen + $idx * $rRecLen + 1 + $fSrv.Offset
        $val = $enc949.GetString($resDbf, $rStart, $fSrv.Length).Trim([char]0).Trim().Replace('\','').Replace('"','').Replace("",'').Replace("
",'')
        if ($val) { $rName = $val }
    }
    if ($stype -eq 1) {
        $px = [System.BitConverter]::ToDouble($resShp, $offset + 12)
        $py = [System.BitConverter]::ToDouble($resShp, $offset + 20)
        $wgs = Convert-TM $px $py
        if ($wgs) {
            if (-not $first) { $sw.Write(',') }
            $first = $false
            $sw.Write("{`"id`":`"RES-$($idx+1)`",`"name`":`"$rName`",`"lat`":$($wgs[0]),`"lng`":$($wgs[1]),`"facilityType`":`"RESERVOIR`"}")
        }
    }
    $offset += 8 + $recLenBytes
    $idx++
}
$sw.Write('],')
Write-Host "Reservoirs done: $idx"

# 3. Boosters (가압장 - 63)
Write-Host "Converting 3. 가압장..."
$bstShp = [System.IO.File]::ReadAllBytes("$base\가압장.shp")
$bstDbf = [System.IO.File]::ReadAllBytes("$base\가압장.dbf")
$bHdrLen = [System.BitConverter]::ToInt16($bstDbf, 8)
$bRecLen = [System.BitConverter]::ToInt16($bstDbf, 10)
$bNumRec = [System.BitConverter]::ToInt32($bstDbf, 4)
$fPrs = Get-FieldInfo $bstDbf "PRS_NAM"

$sw.WriteLine(); $sw.Write('"boosters": [')
$offset = 100
$idx = 0
$first = $true
while ($offset -lt $bstShp.Length -and $idx -lt $bNumRec) {
    $recLenWords = [System.BitConverter]::ToInt32(@($bstShp[$offset+7], $bstShp[$offset+6], $bstShp[$offset+5], $bstShp[$offset+4]), 0)
    $recLenBytes = $recLenWords * 2
    $stype = [System.BitConverter]::ToInt32($bstShp, $offset + 8)
    $pName = "가압장 " + ($idx + 1)
    if ($fPrs) {
        $rStart = $bHdrLen + $idx * $bRecLen + 1 + $fPrs.Offset
        $val = $enc949.GetString($bstDbf, $rStart, $fPrs.Length).Trim([char]0).Trim().Replace('\','').Replace('"','').Replace("",'').Replace("
",'')
        if ($val) { $pName = $val }
    }
    if ($stype -eq 1) {
        $px = [System.BitConverter]::ToDouble($bstShp, $offset + 12)
        $py = [System.BitConverter]::ToDouble($bstShp, $offset + 20)
        $wgs = Convert-TM $px $py
        if ($wgs) {
            if (-not $first) { $sw.Write(',') }
            $first = $false
            $sw.Write("{`"id`":`"BST-$($idx+1)`",`"name`":`"$pName`",`"lat`":$($wgs[0]),`"lng`":$($wgs[1]),`"facilityType`":`"BOOSTER`"}")
        }
    }
    $offset += 8 + $recLenBytes
    $idx++
}
$sw.Write('],')
Write-Host "Boosters done: $idx"

# 4. FlowMeters (유량계 - 326)
Write-Host "Converting 4. 유량계..."
$flwShp = [System.IO.File]::ReadAllBytes("$base\유량계.shp")
$flwDbf = [System.IO.File]::ReadAllBytes("$base\유량계.dbf")
$fHdrLen = [System.BitConverter]::ToInt16($flwDbf, 8)
$fRecLen = [System.BitConverter]::ToInt16($flwDbf, 10)
$fNumRec = [System.BitConverter]::ToInt32($flwDbf, 4)
$fBlk = Get-FieldInfo $flwDbf "BLOCK_NM"
$fPrc = Get-FieldInfo $flwDbf "PRC_NAM"

$sw.WriteLine(); $sw.Write('"flowMeters": [')
$offset = 100
$idx = 0
$first = $true
while ($offset -lt $flwShp.Length -and $idx -lt $fNumRec) {
    $recLenWords = [System.BitConverter]::ToInt32(@($flwShp[$offset+7], $flwShp[$offset+6], $flwShp[$offset+5], $flwShp[$offset+4]), 0)
    $recLenBytes = $recLenWords * 2
    $stype = [System.BitConverter]::ToInt32($flwShp, $offset + 8)
    $fName = "유량계 " + ($idx + 1)
    if ($fBlk) {
        $rStart = $fHdrLen + $idx * $fRecLen + 1 + $fBlk.Offset
        $val = $enc949.GetString($flwDbf, $rStart, $fBlk.Length).Trim([char]0).Trim().Replace('\','').Replace('"','').Replace("",'').Replace("
",'')
        if ($val) { $fName = $val }
    }
    if ($stype -eq 1) {
        $px = [System.BitConverter]::ToDouble($flwShp, $offset + 12)
        $py = [System.BitConverter]::ToDouble($flwShp, $offset + 20)
        $wgs = Convert-TM $px $py
        if ($wgs) {
            if (-not $first) { $sw.Write(',') }
            $first = $false
            $sw.Write("{`"id`":`"FLOW-$($idx+1)`",`"name`":`"$fName`",`"lat`":$($wgs[0]),`"lng`":$($wgs[1]),`"facilityType`":`"FLOW_METER`"}")
        }
    }
    $offset += 8 + $recLenBytes
    $idx++
}
$sw.Write('],')
Write-Host "FlowMeters done: $idx"

# Helper for Polyline layers
function Convert-PipeLayer($shpPath, $dbfPath, $jsonKey, $sampleInterval, $prefix) {
    Write-Host "Converting $jsonKey (sample 1/$sampleInterval)..."
    $pShp = [System.IO.File]::ReadAllBytes($shpPath)
    $pDbf = [System.IO.File]::ReadAllBytes($dbfPath)
    $pHdrLen = [System.BitConverter]::ToInt16($pDbf, 8)
    $pRecLen = [System.BitConverter]::ToInt16($pDbf, 10)
    $pNumRec = [System.BitConverter]::ToInt32($pDbf, 4)
    $fDip = Get-FieldInfo $pDbf "STD_DIP"
    $fMop = Get-FieldInfo $pDbf "MOP_CDE"
    
    $sw.Write("`n  `"$jsonKey`": [")
    $offset = 100
    $idx = 0
    $outCount = 0
    $first = $true
    while ($offset -lt $pShp.Length -and $idx -lt $pNumRec) {
        $recLenWords = [System.BitConverter]::ToInt32(@($pShp[$offset+7], $pShp[$offset+6], $pShp[$offset+5], $pShp[$offset+4]), 0)
        $recLenBytes = $recLenWords * 2
        $stype = [System.BitConverter]::ToInt32($pShp, $offset + 8)
        
        if ($stype -eq 3 -and ($idx % $sampleInterval -eq 0)) {
            $numPoints = [System.BitConverter]::ToInt32($pShp, $offset + 48)
            $ptsStart = $offset + 52 + 4
            $dia = 150
            if ($fDip) {
                $rStart = $pHdrLen + $idx * $pRecLen + 1 + $fDip.Offset
                $dStr = $enc949.GetString($pDbf, $rStart, $fDip.Length).Trim([char]0).Trim().Replace('\','').Replace('"','').Replace("",'').Replace("
",'')
                $dVal = 0
                if ([int]::TryParse($dStr, [ref]$dVal) -and $dVal -gt 0) { $dia = $dVal }
            }
            $mat = "DIP"
            if ($fMop) {
                $rStart = $pHdrLen + $idx * $pRecLen + 1 + $fMop.Offset
                $mStr = $enc949.GetString($pDbf, $rStart, $fMop.Length).Trim([char]0).Trim().Replace('\','').Replace('"','').Replace("",'').Replace("
",'')
                if ($mStr) { $mat = $mStr }
            }
            $cArr = @()
            for ($p = 0; $p -lt $numPoints; $p++) {
                $px = [System.BitConverter]::ToDouble($pShp, $ptsStart + ($p * 16))
                $py = [System.BitConverter]::ToDouble($pShp, $ptsStart + ($p * 16) + 8)
                $wgs = Convert-TM $px $py
                if ($wgs) {
                    $cArr += "[$($wgs[0]),$($wgs[1])]"
                }
            }
            if ($cArr.Count -ge 2) {
                if (-not $first) { $sw.Write(',') }
                $first = $false
                $sw.Write("{`"id`":`"$prefix-$($idx+1)`",`"name`":`"$prefix $($idx+1)`",`"dia`":$dia,`"material`":`"$mat`",`"coordinates`":[$($cArr -join ',')]}")
                $outCount++
            }
        }
        $offset += 8 + $recLenBytes
        $idx++
    }
    $sw.Write('],')
    Write-Host "$jsonKey done: $outCount features (from $idx total)"
}

# 5. 상수관로 (LM)
Convert-PipeLayer "$base\상수관로(LM).shp" "$base\상수관로(LM).dbf" "pipesLm" 4 "LM"

# 6. 상수관로 (LM2)
Convert-PipeLayer "$base\상수관로(LM2).shp" "$base\상수관로(LM2).dbf" "pipesLm2" 4 "LM2"

# 7. 급수관로
Convert-PipeLayer "$base\급수관로.shp" "$base\급수관로.dbf" "servicePipes" 5 "SP"

# 8. 밸브류 (31652)
Write-Host "Converting 8. 밸브류..."
$vlvShp = [System.IO.File]::ReadAllBytes("$base\밸브류.shp")
$vlvDbf = [System.IO.File]::ReadAllBytes("$base\밸브류.dbf")
$vHdrLen = [System.BitConverter]::ToInt16($vlvDbf, 8)
$vRecLen = [System.BitConverter]::ToInt16($vlvDbf, 10)
$vNumRec = [System.BitConverter]::ToInt32($vlvDbf, 4)
$fDip = Get-FieldInfo $vlvDbf "STD_DIP"
$fStd = Get-FieldInfo $vlvDbf "VAL_STD"

$sw.WriteLine(); $sw.Write('"valves": [')
$offset = 100
$idx = 0
$vCount = 0
$first = $true
$vSample = 6
while ($offset -lt $vlvShp.Length -and $idx -lt $vNumRec) {
    $recLenWords = [System.BitConverter]::ToInt32(@($vlvShp[$offset+7], $vlvShp[$offset+6], $vlvShp[$offset+5], $vlvShp[$offset+4]), 0)
    $recLenBytes = $recLenWords * 2
    $stype = [System.BitConverter]::ToInt32($vlvShp, $offset + 8)
    if ($stype -eq 1 -and ($idx % $vSample -eq 0)) {
        $dia = 100
        if ($fDip) {
            $rStart = $vHdrLen + $idx * $vRecLen + 1 + $fDip.Offset
            $dStr = $enc949.GetString($vlvDbf, $rStart, $fDip.Length).Trim([char]0).Trim().Replace('\','').Replace('"','').Replace("",'').Replace("
",'')
            $dVal = 0
            if ([int]::TryParse($dStr, [ref]$dVal) -and $dVal -gt 0) { $dia = $dVal }
        }
        $vName = "제수변 " + ($idx + 1)
        if ($fStd) {
            $rStart = $vHdrLen + $idx * $vRecLen + 1 + $fStd.Offset
            $sStr = $enc949.GetString($vlvDbf, $rStart, $fStd.Length).Trim([char]0).Trim().Replace('\','').Replace('"','').Replace("",'').Replace("
",'')
            if ($sStr) { $vName = $sStr }
        }
        $px = [System.BitConverter]::ToDouble($vlvShp, $offset + 12)
        $py = [System.BitConverter]::ToDouble($vlvShp, $offset + 20)
        $wgs = Convert-TM $px $py
        if ($wgs) {
            if (-not $first) { $sw.Write(',') }
            $first = $false
            $sw.Write("{`"id`":`"VLV-$($idx+1)`",`"name`":`"$vName`",`"dia`":$dia,`"lat`":$($wgs[0]),`"lng`":$($wgs[1]),`"facilityType`":`"VALVE`"}")
            $vCount++
        }
    }
    $offset += 8 + $recLenBytes
    $idx++
}
$sw.Write(']')
Write-Host "Valves done: $vCount (from $idx total)"

# Legacy compatibility for "pipes"
$sw.WriteLine(); $sw.Write('};')
$sw.Flush()
$sw.Close()
Write-Host "Done! Generated $outFile with size $((Get-Item $outFile).Length) bytes"



