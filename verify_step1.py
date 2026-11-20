import json
import re
import datetime

# 1. Load water_manager latest state (from 1. 유량 및 유수율 관리(수정작업))
with open('data/water_manager_latest_state.json', encoding='utf-8') as f:
    wm = json.load(f)

# 2. Load 0. 김해관망관리 local firebase_state.json
with open('data/firebase_state.json', encoding='utf-8-sig') as f:
    local_fb = json.load(f)

# 3. Load 0. 김해관망관리 verifiedYieldData.js
with open('js/verifiedYieldData.js', encoding='utf-8') as f:
    js_text = f.read()

# Parse verifiedYieldData.js
m = re.search(r'window\.VERIFIED_YIELD_DATA\s*=\s*(\{.*?\});', js_text, re.DOTALL)
if m:
    verified_yield = json.loads(m.group(1))
else:
    print("Failed to regex-parse verifiedYieldData.js directly, trying python dict eval")
    # fallback
    start_idx = js_text.find('{')
    end_idx = js_text.rfind('}') + 1
    verified_yield = json.loads(js_text[start_idx:end_idx])

print("VERIFIED_YIELD_DATA blocks:", len(verified_yield))

# Check blocks in WM vs local_fb vs verified_yield
wm_blocks = set(wm.get('blocks', []))
local_blocks = set(local_fb.get('blocks', []))
vy_blocks = set(verified_yield.keys())

print(f"WM blocks: {len(wm_blocks)}")
print(f"Local blocks: {len(local_blocks)}")
print(f"VerifiedYield blocks: {len(vy_blocks)}")

diff_blocks_wm_local = wm_blocks ^ local_blocks
diff_blocks_wm_vy = wm_blocks ^ vy_blocks
print(f"Blocks diff (WM vs Local FB): {diff_blocks_wm_local}")
print(f"Blocks diff (WM vs VerifiedYield): {diff_blocks_wm_vy}")

# 4. Compare supplyData dates & content
wm_supply_dates = set(wm.get('supplyData', {}).keys())
local_supply_dates = set(local_fb.get('supplyData', {}).keys())

common_supply_dates = wm_supply_dates & local_supply_dates
print(f"\nSupply dates: WM={len(wm_supply_dates)}, Local={len(local_supply_dates)}, Common={len(common_supply_dates)}")
only_wm_supply_dates = sorted(list(wm_supply_dates - local_supply_dates))
only_local_supply_dates = sorted(list(local_supply_dates - wm_supply_dates))
print(f"Dates only in WM ({len(only_wm_supply_dates)}): {only_wm_supply_dates[:10]}")
print(f"Dates only in Local ({len(only_local_supply_dates)}): {only_local_supply_dates[:10]}")

# Compare supply values on common dates
supply_match_count = 0
supply_mismatch_count = 0
supply_mismatches = []

for d in common_supply_dates:
    wm_day = wm['supplyData'][d]
    loc_day = local_fb['supplyData'][d]
    all_b = set(wm_day.keys()) | set(loc_day.keys())
    for b in all_b:
        wm_val = wm_day.get(b)
        loc_val = loc_day.get(b)
        if wm_val == loc_val:
            supply_match_count += 1
        else:
            supply_mismatch_count += 1
            if len(supply_mismatches) < 20:
                supply_mismatches.append((d, b, wm_val, loc_val))

print(f"Supply data comparison on common {len(common_supply_dates)} days:")
print(f"  Exact Match: {supply_match_count:,}")
print(f"  Mismatch: {supply_mismatch_count:,}")
if supply_mismatches:
    print("  Sample mismatches:")
    for sm in supply_mismatches[:5]:
        print(f"    Date {sm[0]}, Block {sm[1]}: WM={sm[2]} vs Local={sm[3]}")

# 5. Compare chargeData months & content
wm_charge_months = set(wm.get('chargeData', {}).keys())
local_charge_months = set(local_fb.get('chargeData', {}).keys())

common_charge_months = wm_charge_months & local_charge_months
print(f"\nCharge months: WM={len(wm_charge_months)}, Local={len(local_charge_months)}, Common={len(common_charge_months)}")
print(f"Charge months only in WM: {sorted(list(wm_charge_months - local_charge_months))}")

charge_match_count = 0
charge_mismatch_count = 0
charge_mismatches = []

for m in common_charge_months:
    wm_m = wm['chargeData'][m]
    loc_m = local_fb['chargeData'][m]
    all_b = set(wm_m.keys()) | set(loc_m.keys())
    for b in all_b:
        wm_val = wm_m.get(b)
        loc_val = loc_m.get(b)
        if wm_val == loc_val:
            charge_match_count += 1
        else:
            charge_mismatch_count += 1
            if len(charge_mismatches) < 20:
                charge_mismatches.append((m, b, wm_val, loc_val))

print(f"Charge data comparison on common {len(common_charge_months)} months:")
print(f"  Exact Match: {charge_match_count:,}")
print(f"  Mismatch: {charge_mismatch_count:,}")
if charge_mismatches:
    print("  Sample mismatches:")
    for cm in charge_mismatches[:5]:
        print(f"    Month {cm[0]}, Block {cm[1]}: WM={cm[2]} vs Local={cm[3]}")

