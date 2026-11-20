import urllib.request
import json
import base64
import zipfile
import io
import os

print("1. Fetching payload from water-manager-85b72...")
url = 'https://water-manager-85b72-default-rtdb.firebaseio.com/waterManager/payload.json'
req = urllib.request.urlopen(url, timeout=30)
raw = json.loads(req.read().decode('utf-8'))

if raw.startswith('ZIP:'):
    b64_data = raw[4:]
    zip_bytes = base64.b64decode(b64_data)
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        print("Zip contents:", zf.namelist())
        with zf.open('state.json') as f:
            wm_state = json.load(f)
else:
    wm_state = json.loads(raw)

print("WaterManager state keys:", list(wm_state.keys()))
print("WM blocks count:", len(wm_state.get('blocks', [])))
print("WM supplyData days:", len(wm_state.get('supplyData', {})))
print("WM chargeData months:", list(wm_state.get('chargeData', {}).keys()))

# Save as data/water_manager_latest_state.json for backup/inspection
with open('data/water_manager_latest_state.json', 'w', encoding='utf-8') as f:
    json.dump(wm_state, f, ensure_ascii=False)
print("Saved data/water_manager_latest_state.json")

# 2. Load 0. 김해관망관리 local state (data/firebase_state.json)
with open('data/firebase_state.json', encoding='utf-8-sig') as f:
    local_state = json.load(f)

print("\nLocal state keys:", list(local_state.keys()))
print("Local blocks count:", len(local_state.get('blocks', [])))
print("Local supplyData days:", len(local_state.get('supplyData', {})))
print("Local chargeData months:", list(local_state.get('chargeData', {}).keys()))
