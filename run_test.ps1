$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$url = "file:///" + ($PWD.Path.Replace('\', '/').Replace(' ', '%20')) + "/test_leaflet_poly.html"
$arg = @('--headless=new', '--disable-gpu', '--virtual-time-budget=3000', '--dump-dom', $url)
Start-Process -FilePath $chrome -ArgumentList $arg -RedirectStandardOutput 'test_out.txt' -Wait
Get-Content 'test_out.txt'
