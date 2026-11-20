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
    
    $lat_deg = [Math]::Round($lat * 180.0 / [Math]::PI, 5)
    $lon_deg = [Math]::Round($lon * 180.0 / [Math]::PI, 5)
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
    $enc = [System.Text.Encoding]::GetEncoding(949)
    while ($cur -lt ($hLen - 1)) {
        if ($dbfBytes[$cur] -eq 0x0D) { break }
        $fname = $enc.GetString($dbfBytes, $cur, 11).Trim([char]0).Trim().Replace('\','').Replace('"','').Replace("`r",'').Replace("`n",'')
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
$sw.WriteLine("/** Kimhae GIS Dataset WGS84 - 8 SHP Layers 100% Full Dataset */")
$sw.Write("window.GIMHAE_GIS_DATA = {")

# 1. Blocks (103)
Write-Host "Converting 1. 블록경계 (전수 103개)..."
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
        $val = $enc949.GetString($blkDbf, $rStart, $fInfo.Length).Trim([char]0).Trim().Replace('\','').Replace('"','').Replace("`r",'').Replace("`n",'')
        if ($val) { $bName = $val }
    }
    if ($stype -eq 5) {
        $numParts = [System.BitConverter]::ToInt32($blkShp, $offset + 44)
        $numPoints = [System.BitConverter]::ToInt32($blkShp, $offset + 48)
        $ptsStart = $offset + 52 + ($numParts * 4)
        $step = 1
        if ($numPoints -gt 300) { $step = 2 }
        $pts = New-Object System.Collections.Generic.List[string]
        for ($p = 0; $p -lt $numPoints; $p += $step) {
            $px = [System.BitConverter]::ToDouble($blkShp, $ptsStart + ($p * 16))
            $py = [System.BitConverter]::ToDouble($blkShp, $ptsStart + ($p * 16) + 8)
            $wgs = Convert-TM $px $py
            if ($wgs) { $pts.Add("[$($wgs[0]),$($wgs[1])]") }
        }
        if ($pts.Count -ge 3) {
            if (-not $first) { $sw.Write(',') }
            $first = $false
            $sw.Write("{`"id`":`"BLK-$($idx+1)`",`"name`":`"$bName`",`"coordinates`":[$( [string]::Join(',', $pts) )]}")
        }
    }
    $offset += 8 + $recLenBytes
    $idx++
}
$sw.Write('],')
Write-Host "Blocks done: $idx"

# 2. Reservoirs (44)
Write-Host "Converting 2. 정수장배수지 (전수 44개)..."
$resShp = [System.IO.File]::ReadAllBytes("$base\정수장배수지.shp")
$resDbf = [System.IO.File]::ReadAllBytes("$base\정수장배수지.dbf")
$rHdrLen = [System.BitConverter]::ToInt16($resDbf, 8)
$rRecLen = [System.BitConverter]::ToInt16($resDbf, 10)
$rNumRec = [System.BitConverter]::ToInt32($resDbf, 4)
$fSrv = Get-FieldInfo $resDbf "SRV_NAM"
$fPur = Get-FieldInfo $resDbf "PUR_NAM"
$fHwl = Get-FieldInfo $resDbf "HGH_WAL"
$fLwl = Get-FieldInfo $resDbf "LOW_WAL"
$fVol = Get-FieldInfo $resDbf "SRV_VOL"

$sw.WriteLine(); $sw.Write('"reservoirs": [')
$offset = 100
$idx = 0
$first = $true
while ($offset -lt $resShp.Length -and $idx -lt $rNumRec) {
    $recLenWords = [System.BitConverter]::ToInt32(@($resShp[$offset+7], $resShp[$offset+6], $resShp[$offset+5], $resShp[$offset+4]), 0)
    $recLenBytes = $recLenWords * 2
    $stype = [System.BitConverter]::ToInt32($resShp, $offset + 8)
    $rName = "정수·배수지 " + ($idx + 1)
    $hwl = 0; $lwl = 0; $vol = 0
    if ($fSrv) {
        $val = $enc949.GetString($resDbf, $rHdrLen + $idx * $rRecLen + 1 + $fSrv.Offset, $fSrv.Length).Trim([char]0).Trim().Replace('\','').Replace('"','').Replace("`r",'').Replace("`n",'')
        if ($val) { $rName = $val }
    }
    if ($fPur -and $rName -match "정수·배수지") {
        $val = $enc949.GetString($resDbf, $rHdrLen + $idx * $rRecLen + 1 + $fPur.Offset, $fPur.Length).Trim([char]0).Trim().Replace('\','').Replace('"','').Replace("`r",'').Replace("`n",'')
        if ($val) { $rName = $val }
    }
    if ($fHwl) {
        $val = $enc949.GetString($resDbf, $rHdrLen + $idx * $rRecLen + 1 + $fHwl.Offset, $fHwl.Length).Trim([char]0).Trim()
        [double]::TryParse($val, [ref]$hwl) | Out-Null
    }
    if ($fLwl) {
        $val = $enc949.GetString($resDbf, $rHdrLen + $idx * $rRecLen + 1 + $fLwl.Offset, $fLwl.Length).Trim([char]0).Trim()
        [double]::TryParse($val, [ref]$lwl) | Out-Null
    }
    if ($fVol) {
        $val = $enc949.GetString($resDbf, $rHdrLen + $idx * $rRecLen + 1 + $fVol.Offset, $fVol.Length).Trim([char]0).Trim()
        [double]::TryParse($val, [ref]$vol) | Out-Null
    }
    if ($stype -eq 1) {
        $px = [System.BitConverter]::ToDouble($resShp, $offset + 12)
        $py = [System.BitConverter]::ToDouble($resShp, $offset + 20)
        $wgs = Convert-TM $px $py
        if ($wgs) {
            if (-not $first) { $sw.Write(',') }
            $first = $false
            $sw.Write("{`"id`":`"RES-$($idx+1)`",`"name`":`"$rName`",`"hwl`":$hwl,`"lwl`":$lwl,`"vol`":$vol,`"lat`":$($wgs[0]),`"lng`":$($wgs[1]),`"facilityType`":`"RESERVOIR`"}")
        }
    }
    $offset += 8 + $recLenBytes
    $idx++
}
$sw.Write('],')
Write-Host "Reservoirs done: $idx"

# 3. Boosters (63)
Write-Host "Converting 3. 가압장 (전수 63개)..."
$bstShp = [System.IO.File]::ReadAllBytes("$base\가압장.shp")
$bstDbf = [System.IO.File]::ReadAllBytes("$base\가압장.dbf")
$bHdrLen = [System.BitConverter]::ToInt16($bstDbf, 8)
$bRecLen = [System.BitConverter]::ToInt16($bstDbf, 10)
$bNumRec = [System.BitConverter]::ToInt32($bstDbf, 4)
$fPrs = Get-FieldInfo $bstDbf "PRS_NAM"
$fHsl = Get-FieldInfo $bstDbf "PRS_HSL"
$fSaf = Get-FieldInfo $bstDbf "PRS_SAF"
$fCnt = Get-FieldInfo $bstDbf "PRS_CNT"

$sw.WriteLine(); $sw.Write('"boosters": [')
$offset = 100
$idx = 0
$first = $true
while ($offset -lt $bstShp.Length -and $idx -lt $bNumRec) {
    $recLenWords = [System.BitConverter]::ToInt32(@($bstShp[$offset+7], $bstShp[$offset+6], $bstShp[$offset+5], $bstShp[$offset+4]), 0)
    $recLenBytes = $recLenWords * 2
    $stype = [System.BitConverter]::ToInt32($bstShp, $offset + 8)
    $pName = "가압장 " + ($idx + 1)
    $head = 0; $saf = 0; $cnt = 0
    if ($fPrs) {
        $val = $enc949.GetString($bstDbf, $bHdrLen + $idx * $bRecLen + 1 + $fPrs.Offset, $fPrs.Length).Trim([char]0).Trim().Replace('\','').Replace('"','').Replace("`r",'').Replace("`n",'')
        if ($val) { $pName = $val }
    }
    if ($fHsl) {
        $val = $enc949.GetString($bstDbf, $bHdrLen + $idx * $bRecLen + 1 + $fHsl.Offset, $fHsl.Length).Trim([char]0).Trim()
        [double]::TryParse($val, [ref]$head) | Out-Null
    }
    if ($fSaf) {
        $val = $enc949.GetString($bstDbf, $bHdrLen + $idx * $bRecLen + 1 + $fSaf.Offset, $fSaf.Length).Trim([char]0).Trim()
        [double]::TryParse($val, [ref]$saf) | Out-Null
    }
    if ($fCnt) {
        $val = $enc949.GetString($bstDbf, $bHdrLen + $idx * $bRecLen + 1 + $fCnt.Offset, $fCnt.Length).Trim([char]0).Trim()
        [double]::TryParse($val, [ref]$cnt) | Out-Null
    }
    if ($stype -eq 1) {
        $px = [System.BitConverter]::ToDouble($bstShp, $offset + 12)
        $py = [System.BitConverter]::ToDouble($bstShp, $offset + 20)
        $wgs = Convert-TM $px $py
        if ($wgs) {
            if (-not $first) { $sw.Write(',') }
            $first = $false
            $sw.Write("{`"id`":`"BST-$($idx+1)`",`"name`":`"$pName`",`"head`":$head,`"saf`":$saf,`"cnt`":$cnt,`"lat`":$($wgs[0]),`"lng`":$($wgs[1]),`"facilityType`":`"BOOSTER`"}")
        }
    }
    $offset += 8 + $recLenBytes
    $idx++
}
$sw.Write('],')
Write-Host "Boosters done: $idx"

# 4. Flow meters (326)
Write-Host "Converting 4. 구역유량계 (전수 326개)..."
$flwShp = [System.IO.File]::ReadAllBytes("$base\유량계.shp")
$flwDbf = [System.IO.File]::ReadAllBytes("$base\유량계.dbf")
$fHdrLen = [System.BitConverter]::ToInt16($flwDbf, 8)
$fRecLen = [System.BitConverter]::ToInt16($flwDbf, 10)
$fNumRec = [System.BitConverter]::ToInt32($flwDbf, 4)
$fBlk = Get-FieldInfo $flwDbf "FLW_NAM"
if (-not $fBlk) { $fBlk = Get-FieldInfo $flwDbf "PRC_NAM" }

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
        $val = $enc949.GetString($flwDbf, $fHdrLen + $idx * $fRecLen + 1 + $fBlk.Offset, $fBlk.Length).Trim([char]0).Trim().Replace('\','').Replace('"','').Replace("`r",'').Replace("`n",'')
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

# 5, 6, 7. Pipe layers - 100% full dataset, streaming output
function Convert-FullPipes($shpPath, $dbfPath, $jsonKey, $prefix) {
    Write-Host "Converting $jsonKey (전수 100% 변환)..."
    $pShp = [System.IO.File]::ReadAllBytes($shpPath)
    $pDbf = [System.IO.File]::ReadAllBytes($dbfPath)
    $pHdrLen = [System.BitConverter]::ToInt16($pDbf, 8)
    $pRecLen = [System.BitConverter]::ToInt16($pDbf, 10)
    $pNumRec = [System.BitConverter]::ToInt32($pDbf, 4)
    $fDip = Get-FieldInfo $pDbf "STD_DIP"
    $fMop = Get-FieldInfo $pDbf "MOP_CDE"
    $fLen = Get-FieldInfo $pDbf "BYC_LEN"
    
    $sw.Write("`n  `"$jsonKey`": [")
    $offset = 100
    $idx = 0
    $outCount = 0
    $first = $true
    
    while ($offset -lt $pShp.Length -and $idx -lt $pNumRec) {
        $recLenWords = [System.BitConverter]::ToInt32(@($pShp[$offset+7], $pShp[$offset+6], $pShp[$offset+5], $pShp[$offset+4]), 0)
        $recLenBytes = $recLenWords * 2
        $stype = [System.BitConverter]::ToInt32($pShp, $offset + 8)
        
        if ($stype -eq 3) {
            $numPoints = [System.BitConverter]::ToInt32($pShp, $offset + 48)
            $ptsStart = $offset + 52 + 4
            $dia = 100
            if ($fDip) {
                $dStr = $enc949.GetString($pDbf, $pHdrLen + $idx * $pRecLen + 1 + $fDip.Offset, $fDip.Length).Trim([char]0).Trim()
                $dVal = 0.0
                if ([double]::TryParse($dStr, [System.Globalization.NumberStyles]::Any, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$dVal) -and $dVal -gt 0) { $dia = [int][Math]::Round($dVal) }
            }
            $mat = "DIP"
            if ($fMop) {
                $mStr = $enc949.GetString($pDbf, $pHdrLen + $idx * $pRecLen + 1 + $fMop.Offset, $fMop.Length).Trim([char]0).Trim().Replace('\','').Replace('"','').Replace("`r",'').Replace("`n",'')
                if ($mStr) { $mat = $mStr }
            }
            $pipeLen = 0.0
            if ($fLen) {
                $lStr = $enc949.GetString($pDbf, $pHdrLen + $idx * $pRecLen + 1 + $fLen.Offset, $fLen.Length).Trim([char]0).Trim()
                $lVal = 0.0
                if ([double]::TryParse($lStr, [ref]$lVal)) { $pipeLen = [Math]::Round($lVal, 1) }
            }
            
            # Read and filter points
            $pts = New-Object System.Collections.Generic.List[string]
            for ($p = 0; $p -lt $numPoints; $p++) {
                $px = [System.BitConverter]::ToDouble($pShp, $ptsStart + ($p * 16))
                $py = [System.BitConverter]::ToDouble($pShp, $ptsStart + ($p * 16) + 8)
                $wgs = Convert-TM $px $py
                if ($wgs) {
                    $pts.Add("[$($wgs[0]),$($wgs[1])]")
                }
            }
            if ($pts.Count -ge 2) {
                if (-not $first) { $sw.Write(',') }
                $first = $false
                $sw.Write("{`"id`":`"$prefix-$($idx+1)`",`"dia`":$dia,`"mat`":`"$mat`",`"len`":$pipeLen,`"coordinates`":[$( [string]::Join(',', $pts) )]}")
                $outCount++
            }
        }
        $offset += 8 + $recLenBytes
        $idx++
    }
    $sw.Write('],')
    Write-Host "$jsonKey done: $outCount features (전체 $idx 개 중)"
}

# 5. 상수관로 (LM) 전수 변환 (40,256개)
Convert-FullPipes "$base\상수관로(LM).shp" "$base\상수관로(LM).dbf" "pipesLm" "LM"

# 6. 상수관로 (LM2) 전수 변환 (33,457개)
Convert-FullPipes "$base\상수관로(LM2).shp" "$base\상수관로(LM2).dbf" "pipesLm2" "LM2"

# 7. 급수관로 전수 변환 (48,147개)
Convert-FullPipes "$base\급수관로.shp" "$base\급수관로.dbf" "servicePipes" "SP"

# 8. 밸브류 전수 변환 (31,652개)
Write-Host "Converting 8. 밸브류 (전수 31,652개)..."
$vlvShp = [System.IO.File]::ReadAllBytes("$base\밸브류.shp")
$vlvDbf = [System.IO.File]::ReadAllBytes("$base\밸브류.dbf")
$vHdrLen = [System.BitConverter]::ToInt16($vlvDbf, 8)
$vRecLen = [System.BitConverter]::ToInt16($vlvDbf, 10)
$vNumRec = [System.BitConverter]::ToInt32($vlvDbf, 4)
$fDip = Get-FieldInfo $vlvDbf "STD_DIP"
$fStd = Get-FieldInfo $vlvDbf "VAL_STD"
$fTro = Get-FieldInfo $vlvDbf "TRO_CNT"
$fFtr = Get-FieldInfo $vlvDbf "FTR_CDE"

$sw.WriteLine(); $sw.Write('"valves": [')
$offset = 100
$idx = 0
$vCount = 0
$first = $true
while ($offset -lt $vlvShp.Length -and $idx -lt $vNumRec) {
    $recLenWords = [System.BitConverter]::ToInt32(@($vlvShp[$offset+7], $vlvShp[$offset+6], $vlvShp[$offset+5], $vlvShp[$offset+4]), 0)
    $recLenBytes = $recLenWords * 2
    $stype = [System.BitConverter]::ToInt32($vlvShp, $offset + 8)
    if ($stype -eq 1) {
        $ftr = "SA200"
        if ($fFtr) {
            $ftrStr = $enc949.GetString($vlvDbf, $vHdrLen + $idx * $vRecLen + 1 + $fFtr.Offset, $fFtr.Length).Trim([char]0).Trim()
            if ($ftrStr) { $ftr = $ftrStr }
        }
        $vCat = switch ($ftr) {
            'SA200' { '제수변' }
            'SA201' { '제수변' }
            'SA202' { '역지변' }
            'SA203' { '공기변' }
            'SA204' { '감압변' }
            'SA205' { '이토변' }
            'SA220' { '밸브기타' }
            'SA910' { '제수변(원형)' }
            'SA119' { '소화전' }
            default { '제수변' }
        }
        $dia = 100
        if ($fDip) {
            $dStr = $enc949.GetString($vlvDbf, $vHdrLen + $idx * $vRecLen + 1 + $fDip.Offset, $fDip.Length).Trim([char]0).Trim()
            $dVal = 0.0
            if ([double]::TryParse($dStr, [System.Globalization.NumberStyles]::Any, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$dVal) -and $dVal -gt 0) { $dia = [int][Math]::Round($dVal) }
        }
        $vName = $vCat + " D" + $dia
        if ($fStd) {
            $sStr = $enc949.GetString($vlvDbf, $vHdrLen + $idx * $vRecLen + 1 + $fStd.Offset, $fStd.Length).Trim([char]0).Trim().Replace('\','').Replace('"','').Replace("`r",'').Replace("`n",'')
            if ($sStr) { $vName = $sStr }
        }
        $turn = 0
        if ($fTro) {
            $tStr = $enc949.GetString($vlvDbf, $vHdrLen + $idx * $vRecLen + 1 + $fTro.Offset, $fTro.Length).Trim([char]0).Trim()
            $tVal = 0
            if ([int]::TryParse($tStr, [ref]$tVal)) { $turn = $tVal }
        }
        $px = [System.BitConverter]::ToDouble($vlvShp, $offset + 12)
        $py = [System.BitConverter]::ToDouble($vlvShp, $offset + 20)
        $wgs = Convert-TM $px $py
        if ($wgs) {
            if (-not $first) { $sw.Write(',') }
            $first = $false
            $sw.Write("{`"id`":`"VLV-$($idx+1)`",`"cde`":`"$ftr`",`"cat`":`"$vCat`",`"name`":`"$vName`",`"dia`":$dia,`"turn`":$turn,`"lat`":$($wgs[0]),`"lng`":$($wgs[1]),`"facilityType`":`"VALVE`"}")
            $vCount++
        }
    }
    $offset += 8 + $recLenBytes
    $idx++
}
$sw.Write(']')
Write-Host "Valves done: $vCount (전체 $idx 개 중)"

# 9. 부과량자료 (수용가 위치 55,699개)
$bilShpPath = "$base\부과량자료.shp"
$bilDbfPath = "$base\부과량자료.dbf"
if (Test-Path $bilShpPath) {
    Write-Host "Converting 9. 부과량자료 (수용가 위치)..."
    $bilShp = [System.IO.File]::ReadAllBytes($bilShpPath)
    $bilDbf = [System.IO.File]::ReadAllBytes($bilDbfPath)
    $bHdrLen = [System.BitConverter]::ToInt16($bilDbf, 8)
    $bRecLen = [System.BitConverter]::ToInt16($bilDbf, 10)
    $bNumRec = [System.BitConverter]::ToInt32($bilDbf, 4)

    $fAddr = Get-FieldInfo $bilDbf "추가주소"
    $fCat = Get-FieldInfo $bilDbf "업종"
    $fDia = Get-FieldInfo $bilDbf "구경"
    $fName = Get-FieldInfo $bilDbf "수용가명"
    $fMno = Get-FieldInfo $bilDbf "계량기번호"
    $fOldAddr = Get-FieldInfo $bilDbf "구주소"
    $fCno = Get-FieldInfo $bilDbf "수용가번호"
    $fBlk = Get-FieldInfo $bilDbf "소블록"
    $fUse = Get-FieldInfo $bilDbf "26.01"
    $fDay = Get-FieldInfo $bilDbf "일평균"
    $fCls = Get-FieldInfo $bilDbf "폐전유무"

    $sw.WriteLine(); $sw.Write(',"billingConsumers": [')
    $offset = 100
    $idx = 0
    $bCount = 0
    $first = $true
    while ($offset -lt $bilShp.Length -and $idx -lt $bNumRec) {
        $recLenWords = [System.BitConverter]::ToInt32(@($bilShp[$offset+7], $bilShp[$offset+6], $bilShp[$offset+5], $bilShp[$offset+4]), 0)
        $recLenBytes = $recLenWords * 2
        $stype = [System.BitConverter]::ToInt32($bilShp, $offset + 8)
        if ($stype -eq 1) {
            $recStart = $bHdrLen + $idx * $bRecLen + 1
            $name = if ($fName) { $enc949.GetString($bilDbf, $recStart + $fName.Offset, $fName.Length).Trim([char]0).Trim().Replace('\','').Replace('"','').Replace("`r",'').Replace("`n",'') } else { '' }
            $cno = if ($fCno) { $enc949.GetString($bilDbf, $recStart + $fCno.Offset, $fCno.Length).Trim([char]0).Trim() } else { '' }
            $mno = if ($fMno) { $enc949.GetString($bilDbf, $recStart + $fMno.Offset, $fMno.Length).Trim([char]0).Trim() } else { '' }
            $blk = if ($fBlk) { $enc949.GetString($bilDbf, $recStart + $fBlk.Offset, $fBlk.Length).Trim([char]0).Trim() } else { '' }
            $addr = if ($fAddr) { $enc949.GetString($bilDbf, $recStart + $fAddr.Offset, $fAddr.Length).Trim([char]0).Trim().Replace('\','').Replace('"','').Replace("`r",'').Replace("`n",'') } else { '' }
            $oldAddr = if ($fOldAddr) { $enc949.GetString($bilDbf, $recStart + $fOldAddr.Offset, $fOldAddr.Length).Trim([char]0).Trim().Replace('\','').Replace('"','').Replace("`r",'').Replace("`n",'') } else { '' }
            $cat = if ($fCat) { $enc949.GetString($bilDbf, $recStart + $fCat.Offset, $fCat.Length).Trim([char]0).Trim() } else { '' }
            $cls = if ($fCls) { $enc949.GetString($bilDbf, $recStart + $fCls.Offset, $fCls.Length).Trim([char]0).Trim() } else { '' }
            
            $dia = 13
            if ($fDia) {
                $dStr = $enc949.GetString($bilDbf, $recStart + $fDia.Offset, $fDia.Length).Trim([char]0).Trim()
                $dVal = 0.0
                if ([double]::TryParse($dStr, [System.Globalization.NumberStyles]::Any, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$dVal) -and $dVal -gt 0) { $dia = [int][Math]::Round($dVal) }
            }
            $use = 0.0
            if ($fUse) {
                $uStr = $enc949.GetString($bilDbf, $recStart + $fUse.Offset, $fUse.Length).Trim([char]0).Trim()
                $uVal = 0.0
                if ([double]::TryParse($uStr, [ref]$uVal)) { $use = [Math]::Round($uVal, 1) }
            }
            $day = 0.0
            if ($fDay) {
                $dyStr = $enc949.GetString($bilDbf, $recStart + $fDay.Offset, $fDay.Length).Trim([char]0).Trim()
                $dyVal = 0.0
                if ([double]::TryParse($dyStr, [ref]$dyVal)) { $day = [Math]::Round($dyVal, 1) }
            }

            $px = [System.BitConverter]::ToDouble($bilShp, $offset + 12)
            $py = [System.BitConverter]::ToDouble($bilShp, $offset + 20)
            $wgs = Convert-TM $px $py
            if ($wgs) {
                if (-not $first) { $sw.Write(',') }
                $first = $false
                $sw.Write("{`"id`":`"BIL-$($idx+1)`",`"name`":`"$name`",`"cno`":`"$cno`",`"mno`":`"$mno`",`"blk`":`"$blk`",`"addr`":`"$addr`",`"oaddr`":`"$oldAddr`",`"cat`":`"$cat`",`"dia`":$dia,`"use`":$use,`"day`":$day,`"cls`":`"$cls`",`"lat`":$($wgs[0]),`"lng`":$($wgs[1])}")
                $bCount++
            }
        }
        $offset += 8 + $recLenBytes
        $idx++
    }
    $sw.Write(']')
    Write-Host "Billing consumers done: $bCount (전체 $idx 개 중)"
}

$sw.WriteLine(); $sw.Write('};')
$sw.Flush()
$sw.Close()
Write-Host "Done! Generated $outFile with size $((Get-Item $outFile).Length) bytes"