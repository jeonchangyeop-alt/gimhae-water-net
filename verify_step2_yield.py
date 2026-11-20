import json
import re
from datetime import datetime, timedelta

# 1. Load water_manager latest state
with open('data/water_manager_latest_state.json', encoding='utf-8') as f:
    wm = json.load(f)

# 2. Load 0. 김해관망관리 verifiedYieldData.js
with open('js/verifiedYieldData.js', encoding='utf-8') as f:
    js_text = f.read()

start_idx = js_text.find('{')
end_idx = js_text.rfind('}') + 1
verified_yield = json.loads(js_text[start_idx:end_idx])

# 18 months definition (2025.04 ~ 2026.09)
YIELD_REPORT_MONTHS = [
    { 'key': '2025-04', 'label': '25년 4월' },
    { 'key': '2025-05', 'label': '25년 5월' },
    { 'key': '2025-06', 'label': '25년 6월' },
    { 'key': '2025-07', 'label': '25년 7월' },
    { 'key': '2025-08', 'label': '25년 8월' },
    { 'key': '2025-09', 'label': '25년 9월' },
    { 'key': '2025-10', 'label': '25년 10월' },
    { 'key': '2025-11', 'label': '25년 11월' },
    { 'key': '2025-12', 'label': '25년 12월' },
    { 'key': '2026-01', 'label': '26년 1월' },
    { 'key': '2026-02', 'label': '26년 2월' },
    { 'key': '2026-03', 'label': '26년 3월' },
    { 'key': '2026-04', 'label': '26년 4월' },
    { 'key': '2026-05', 'label': '26년 5월' },
    { 'key': '2026-06', 'label': '26년 6월' },
    { 'key': '2026-07', 'label': '26년 7월' },
    { 'key': '2026-08', 'label': '26년 8월' },
    { 'key': '2026-09', 'label': '26년 9월' }
]

supplyData = wm.get('supplyData', {})
chargeData = wm.get('chargeData', {})
supplyDeps = wm.get('supplyDeps', {})
chargeDeps = wm.get('chargeDeps', {})

# Net flow logic 100% same as water_manager.js
def get_net_flow(date_key, block_name, field='totalSupply', include_all=True, mode='net', memo=None):
    if memo is None: memo = {}
    ck = (date_key, block_name, field, include_all, mode)
    if ck in memo: return memo[ck]

    day_data = supplyData.get(date_key, {})
    block_data = day_data.get(block_name, {})
    origin_val = block_data.get(field)
    children = supplyDeps.get(block_name, [])

    if field in ['minPress', 'maxPress']:
        memo[ck] = origin_val
        return origin_val

    total_val = origin_val if isinstance(origin_val, (int, float)) else 0.0
    has_valid = isinstance(origin_val, (int, float))

    if children:
        for child in children:
            child_name = child if isinstance(child, str) else child.get('name')
            child_type = 'subtract' if isinstance(child, str) else child.get('type', 'subtract')

            if child_type == 'include' and include_all:
                child_val = get_net_flow(date_key, child_name, field, include_all, 'source', memo)
                if isinstance(child_val, (int, float)):
                    has_valid = True
                    total_val += child_val
            elif child_type == 'subtract' and mode == 'net':
                child_val = get_net_flow(date_key, child_name, field, include_all, 'source', memo)
                if isinstance(child_val, (int, float)):
                    has_valid = True
                    total_val -= child_val

    if not has_valid:
        memo[ck] = None
        return None

    res = round(total_val, 1) if field == 'nightMin' else total_val
    memo[ck] = res
    return res

def get_effective_charge(month_key, block_name, visited=None):
    if visited is None: visited = set()
    if block_name in visited: return 0.0, 0.0
    visited.add(block_name)

    month_data = chargeData.get(month_key, {})
    orig = month_data.get(block_name, 0.0)
    if isinstance(orig, dict):
        total_usage = orig.get('usage', 0.0) or 0.0
        total_avg = orig.get('avg', 0.0) or 0.0
    elif isinstance(orig, (int, float)):
        total_usage = float(orig)
        total_avg = float(orig) / 30.0
    else:
        total_usage = 0.0
        total_avg = 0.0

    children = chargeDeps.get(block_name, [])
    for child in children:
        c_name = child if isinstance(child, str) else child.get('name')
        if c_name:
            u, a = get_effective_charge(month_key, c_name, visited)
            total_usage += u
            total_avg += a

    return total_usage, total_avg

# Compute 18 months for all 131 blocks using water_manager logic
print("Computing 18-month series using WaterManager logic for 131 blocks...")
wm_computed_series = {}

all_blocks = sorted(list(set(wm.get('blocks', []))))
memo = {}

for block in all_blocks:
    is_special = ('배수지' in block) or ('정수장' in block)
    s_list = []
    b_list = []
    y_list = []
    m_list = []

    for m_cfg in YIELD_REPORT_MONTHS:
        label = m_cfg['label']
        mat = re.match(r'(\d+)년\s*(\d+)월', label)
        yy = int(mat.group(1))
        mm = int(mat.group(2))
        y4 = 2000 + yy

        # JS Date(year4, mm - 2, 16) is 0-indexed month, so actual calendar month is (mm - 1)月 16日 ~ (mm)月 15日
        if mm == 1:
            d_start = datetime(y4 - 1, 12, 16)
            d_end = datetime(y4, 1, 15)
        else:
            d_start = datetime(y4, mm - 1, 16)
            d_end = datetime(y4, mm, 15)

        date_array = []
        cur = d_start
        while cur <= d_end:
            date_array.append(cur.strftime('%Y-%m-%d'))
            cur += timedelta(days=1)

        # 1. Supply & MNF
        s_sum, s_count = 0.0, 0
        n_sum, n_count = 0.0, 0

        for d_str in date_array:
            val = get_net_flow(d_str, block, 'totalSupply', include_all=True, mode='net', memo=memo)
            if isinstance(val, (int, float)) and val > 0:
                if is_special or val < 20000:
                    s_sum += val
                    s_count += 1
            n_val = get_net_flow(d_str, block, 'nightMin', include_all=True, mode='net', memo=memo)
            if isinstance(n_val, (int, float)) and 0 < n_val < 10000:
                n_sum += n_val
                n_count += 1

        sup_val = round(s_sum / s_count) if s_count > 0 else None
        nmf_val = round(n_sum / n_count, 1) if n_count > 0 else None

        # 2. Billed
        usage_val, avg_val = get_effective_charge(label, block)
        bil_val = round(avg_val) if avg_val > 0 else None

        # 3. Yield
        if sup_val is not None and sup_val > 0 and bil_val is not None and bil_val > 0:
            yield_val = round((bil_val / sup_val) * 100.0, 1)
        else:
            yield_val = None

        s_list.append(sup_val)
        b_list.append(bil_val)
        y_list.append(yield_val)
        m_list.append(nmf_val)

    wm_computed_series[block] = {
        'supply': s_list,
        'billed': b_list,
        'yield': y_list,
        'mnf': m_list
    }

print("Comparing wm_computed_series vs verifiedYieldData.js for all 131 blocks...")

supply_matches = 0
supply_mismatches = 0
supply_diffs = []

billed_matches = 0
billed_mismatches = 0
billed_diffs = []

yield_matches = 0
yield_mismatches = 0
yield_diffs = []

total_points = len(all_blocks) * 18

for block in all_blocks:
    wm_b = wm_computed_series[block]
    vy_b = verified_yield.get(block, {})

    for idx, m_cfg in enumerate(YIELD_REPORT_MONTHS):
        m_label = m_cfg['label']

        ws = wm_b['supply'][idx]
        vs = vy_b.get('supply', [None]*18)[idx]
        if ws == vs or (ws is None and vs is None):
            supply_matches += 1
        elif ws is not None and vs is not None and abs(ws - vs) <= 1:
            supply_matches += 1 # rounding +-1
        else:
            supply_mismatches += 1
            if len(supply_diffs) < 20:
                supply_diffs.append((block, m_label, ws, vs))

        wb = wm_b['billed'][idx]
        vb = vy_b.get('billed', [None]*18)[idx]
        if wb == vb or (wb is None and vb is None):
            billed_matches += 1
        elif wb is not None and vb is not None and abs(wb - vb) <= 1:
            billed_matches += 1
        else:
            billed_mismatches += 1
            if len(billed_diffs) < 20:
                billed_diffs.append((block, m_label, wb, vb))

        wy = wm_b['yield'][idx]
        vy = vy_b.get('yield', [None]*18)[idx]
        if wy == vy or (wy is None and vy is None):
            yield_matches += 1
        elif wy is not None and vy is not None and abs(wy - vy) <= 0.1:
            yield_matches += 1 # rounding +-0.1%
        else:
            yield_mismatches += 1
            if len(yield_diffs) < 20:
                yield_diffs.append((block, m_label, wy, vy))

print("\n================== FULL COMPARISON RESULTS ==================")
print(f"Total Block-Month Pairs Evaluated: {total_points:,} (131 blocks x 18 months)")
print(f"1. Supply (공급량): Match={supply_matches:,} ({(supply_matches/total_points)*100:.2f}%), Mismatch={supply_mismatches:,}")
print(f"2. Billed (부과량): Match={billed_matches:,} ({(billed_matches/total_points)*100:.2f}%), Mismatch={billed_mismatches:,}")
print(f"3. Yield  (유수율): Match={yield_matches:,} ({(yield_matches/total_points)*100:.2f}%), Mismatch={yield_mismatches:,}")

if supply_diffs:
    print("\nSupply differences sample (up to 10):")
    for d in supply_diffs[:10]:
        print(f"  {d[0]} [{d[1]}]: WM={d[2]} vs Gimhae={d[3]}")

if billed_diffs:
    print("\nBilled differences sample (up to 10):")
    for d in billed_diffs[:10]:
        print(f"  {d[0]} [{d[1]}]: WM={d[2]} vs Gimhae={d[3]}")

if yield_diffs:
    print("\nYield differences sample (up to 10):")
    for d in yield_diffs[:10]:
        print(f"  {d[0]} [{d[1]}]: WM={d[2]}% vs Gimhae={d[3]}%")
