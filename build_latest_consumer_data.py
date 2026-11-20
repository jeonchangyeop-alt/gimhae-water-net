import openpyxl
import os
import json
import datetime

excel_dir = r'D:\데이터복구26.03.08\0. 김해과업\1. 김해시 상수도관망 전문유지관리 용역\3. 유량 및 유수율\2. 블록부과량'
f_2609 = os.path.join(excel_dir, '부과량자료(2609).xlsx')
f_2610 = os.path.join(excel_dir, '부과량자료(2610).xlsx')
f_2611 = os.path.join(excel_dir, '부과량자료(2611).xlsx')

def normalize_block(name):
    if not name:
        return ''
    clean = str(name).strip()
    mapping = {
        '진례': '진례직결',
        '진례직결': '진례직결',
        '한림': '한림직결5',
        '한림중블록': '한림직결5',
        '한림1': '한림직결1',
        '한림2': '한림직결2',
        '한림3': '한림직결3',
        '한림4': '한림직결4',
        '망천': '망천직결',
        '망천직결': '망천직결',
        '주촌2': '주촌직결2',
        '주촌직결2': '주촌직결2'
    }
    return mapping.get(clean, clean)

def evaluate_caliber(caliber, daily_usage):
    try:
        cal = int(caliber)
    except:
        cal = 13
    
    du = round(float(daily_usage), 2)
    
    if cal == 13:
        if du > 10.0:
            return 'undersized', '과소구경', '과소구경 (상향 권고: 25mm)', 25
        elif du > 4.5:
            return 'undersized', '과소구경', '과소구경 (상향 권고: 20mm)', 20
        else:
            return 'optimal', '적정', '적정 (13mm)', 13
    elif cal == 20:
        if du < 0.25:
            return 'oversized', '과대구경', '과대구경 (하향 권고: 15mm)', 15
        elif du > 20.0:
            return 'undersized', '과소구경', '과소구경 (상향 권고: 32mm)', 32
        elif du > 12.0:
            return 'undersized', '과소구경', '과소구경 (상향 권고: 25mm)', 25
        else:
            return 'optimal', '적정', '적정 (20mm)', 20
    elif cal == 25:
        if du < 1.5:
            return 'oversized', '과대구경', '과대구경 (하향 권고: 15mm)', 15
        elif du > 40.0:
            return 'undersized', '과소구경', '과소구경 (상향 권고: 50mm)', 50
        elif du > 25.0:
            return 'undersized', '과소구경', '과소구경 (상향 권고: 40mm)', 40
        else:
            return 'optimal', '적정', '적정 (25mm)', 25
    elif cal == 32:
        if du < 1.5:
            return 'oversized', '과대구경', '과대구경 (하향 권고: 15mm)', 15
        else:
            return 'optimal', '적정', '적정 (32mm)', 32
    elif cal == 40:
        if du < 2.5:
            return 'oversized', '과대구경', '과대구경 (하향 권고: 20mm)', 20
        elif du < 5.0:
            return 'oversized', '과대구경', '과대구경 (하향 권고: 25mm)', 25
        elif du > 50.0:
            return 'undersized', '과소구경', '과소구경 (상향 권고: 50mm)', 50
        else:
            return 'optimal', '적정', '적정 (40mm)', 40
    elif cal == 50:
        if du < 2.5:
            return 'oversized', '과대구경', '과대구경 (하향 권고: 20mm)', 20
        elif du < 6.0:
            return 'oversized', '과대구경', '과대구경 (하향 권고: 25mm)', 25
        elif du < 12.0:
            return 'oversized', '과대구경', '과대구경 (하향 권고: 32mm)', 32
        elif du > 120.0:
            return 'undersized', '과소구경', '과소구경 (상향 권고: 75mm)', 75
        else:
            return 'optimal', '적정', '적정 (50mm)', 50
    elif cal == 75:
        if du < 6.0:
            return 'oversized', '과대구경', '과대구경 (하향 권고: 25mm)', 25
        elif du < 15.0:
            return 'oversized', '과대구경', '과대구경 (하향 권고: 40mm)', 40
        elif du < 30.0:
            return 'oversized', '과대구경', '과대구경 (하향 권고: 50mm)', 50
        else:
            return 'optimal', '적정', '적정 (75mm)', 75
    elif cal == 100:
        if du < 6.0:
            return 'oversized', '과대구경', '과대구경 (하향 권고: 40mm)', 40
        elif du < 30.0:
            return 'oversized', '과대구경', '과대구경 (하향 권고: 50mm)', 50
        elif du < 50.0:
            return 'oversized', '과대구경', '과대구경 (하향 권고: 75mm)', 75
        else:
            return 'optimal', '적정', '적정 (100mm)', 100
    elif cal >= 150:
        if du < 50.0:
            return 'oversized', '과대구경', '과대구경 (하향 권고: 75mm)', 75
        else:
            return 'optimal', '적정', f'적정 ({cal}mm)', cal
    else:
        return 'optimal', '적정', f'적정 ({cal}mm)', cal

print("Loading 2026.09...")
wb9 = openpyxl.load_workbook(f_2609, read_only=True)
ws9 = wb9['Sheet1']
usage9 = {}
for i, r in enumerate(ws9.iter_rows(values_only=True)):
    if i == 0: continue
    cno = str(r[1]).strip() if r[1] is not None else ''
    if not cno: continue
    u = r[10]
    usage9[cno] = float(u) if isinstance(u, (int, float)) else 0.0

print(f"2026.09 loaded: {len(usage9)} consumers")

print("Loading 2026.10...")
wb10 = openpyxl.load_workbook(f_2610, read_only=True)
ws10 = wb10['Sheet1']
usage10 = {}
for i, r in enumerate(ws10.iter_rows(values_only=True)):
    if i == 0: continue
    cno = str(r[1]).strip() if r[1] is not None else ''
    if not cno: continue
    u = r[10]
    usage10[cno] = float(u) if isinstance(u, (int, float)) else 0.0

print(f"2026.10 loaded: {len(usage10)} consumers")

print("Loading 2026.11 (primary)...")
wb11 = openpyxl.load_workbook(f_2611, read_only=True)
ws11 = wb11['Sheet1']

consumers_by_block = {}
consumer_seen = set()

# 김해 소블록 매핑
for i, r in enumerate(ws11.iter_rows(values_only=True)):
    if i == 0: continue
    cno = str(r[1]).strip() if r[1] is not None else ''
    if not cno or cno in consumer_seen: continue
    consumer_seen.add(cno)

    name = str(r[2]).strip() if r[2] is not None else ''
    cal_raw = r[5]
    try:
        caliber = int(cal_raw)
    except:
        caliber = 13
    
    b_type = str(r[4]).strip() if r[4] is not None else '가정용'
    raw_block = str(r[19]).strip() if r[19] is not None else ''
    block = normalize_block(raw_block)
    if not block or block in ['null', 'undefined', 'W', 'w']:
        block = '미분류'

    m_nov = float(r[10]) if isinstance(r[10], (int, float)) else 0.0
    m_oct = usage10.get(cno, 0.0)
    m_sep = usage9.get(cno, 0.0)

    total3m = round(m_sep + m_oct + m_nov, 2)
    daily_usage = round(total3m / 92.0, 2)  # 9월 30일 + 10월 31일 + 11월 31일(또는 92일)

    is_large = (daily_usage >= 100.0 or caliber >= 75)
    eval_type, eval_status, eval_desc, rec_cal = evaluate_caliber(caliber, daily_usage)

    c_obj = {
        'cNo': cno,
        'name': name,
        'block': block,
        'caliber': caliber,
        'type': b_type,
        'm1': m_sep,
        'm2': m_oct,
        'm3': m_nov,
        # 호환성을 위한 키
        'm2609': m_sep,
        'm2610': m_oct,
        'm2611': m_nov,
        # 이전 5,6,7월 키를 읽는 오래된 코드와의 안전한 호환
        'm2605': m_sep,
        'm2606': m_oct,
        'm2607': m_nov,
        'dailyUsage': daily_usage,
        'total3m': total3m,
        'isLarge': is_large,
        'evalStatus': eval_status,
        'evalDesc': eval_desc,
        'evalType': eval_type,
        'recCaliber': rec_cal
    }

    if block not in consumers_by_block:
        consumers_by_block[block] = []
    consumers_by_block[block].append(c_obj)

print(f"Consumers processed: {len(consumer_seen)} across {len(consumers_by_block)} blocks")

# Generate summary
summary_by_block = {}
for block, c_list in consumers_by_block.items():
    total_count = len(c_list)
    total_daily = round(sum(c['dailyUsage'] for c in c_list), 1)
    large_list = [c for c in c_list if c['isLarge']]
    large_count = len(large_list)
    large_daily = round(sum(c['dailyUsage'] for c in large_list), 1)
    large_ratio = round((large_daily / total_daily * 100.0), 1) if total_daily > 0 else 0.0

    oversized = sum(1 for c in c_list if c['evalType'] == 'oversized')
    undersized = sum(1 for c in c_list if c['evalType'] == 'undersized')
    optimal = sum(1 for c in c_list if c['evalType'] == 'optimal')
    unfit = oversized + undersized

    summary_by_block[block] = {
        'totalCount': total_count,
        'totalDailyUsage': total_daily,
        'largeCount': large_count,
        'largeDailyUsage': large_daily,
        'largeRatio': large_ratio,
        'oversizedCount': oversized,
        'undersizedCount': undersized,
        'optimalCount': optimal,
        'unfitCount': unfit
    }

out_data = {
    'version': '2026.11',
    'months': ['2026.09', '2026.10', '2026.11'],
    'monthLabels': ['2026.09', '2026.10', '2026.11'],
    'generatedAt': '2026-11-20',
    'summary': summary_by_block,
    'blocks': consumers_by_block
}

print("Saving data/consumer_charge_data.json ...")
json_str = json.dumps(out_data, ensure_ascii=False)
with open('data/consumer_charge_data.json', 'w', encoding='utf-8') as f:
    f.write(json_str)

print("Saving data/consumer_charge_data.js ...")
with open('data/consumer_charge_data.js', 'w', encoding='utf-8') as f:
    f.write("window.CONSUMER_CHARGE_DATA = " + json_str + ";\n")

print(f"SUCCESS! Version: 2026.11, Total Consumers: {len(consumer_seen):,}, Blocks: {len(consumers_by_block)}")
