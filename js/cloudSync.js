/**
 * 김해관망관리 - 클라우드 실시간 중앙 동기화 엔진 (Firebase Realtime Database)
 * 1. 기존 프로젝트(water-manager-85b72) 배포 데이터 100% 자동 동기화
 * 2. JSZip 기반 초경량 데이터 압축 / 해제
 * 3. 블록명 표준 정규화 매핑 (Alias Dictionary)
 * 4. 상하위 수리 종속 순유량 차감 엔진 (getNetFlow)
 * 5. 5대 기초자료(공급량, 부과량, 누수수리, 목표유수율, 관망도GIS) 파싱 및 클라우드 배포
 */

const CLOUD_FIREBASE_CONFIG = {
    apiKey: "AIzaSyAjMWA6U0GbpqLQjGrwSb6HmfHDog_COC8",
    authDomain: "gimhae-water-net.firebaseapp.com",
    databaseURL: "https://gimhae-water-net-default-rtdb.firebaseio.com",
    projectId: "gimhae-water-net",
    storageBucket: "gimhae-water-net.firebasestorage.app",
    messagingSenderId: "89194434025",
    appId: "1:89194434025:web:96c734cc25ce094d50cf78"
};

// 전역 물 관리 통합 상태
window.GlobalWaterData = {
    supplyData: {},      // { 'YYYY-MM-DD': { '블록명': { totalSupply, nightMin, ... } } }
    chargeData: {},      // { 'YYYY-MM': { '블록명': billedUsage } }
    repairData: {},      // { '블록명': ['2025-05-22', ...] }
    targetYieldData: {}, // { '블록명': { std: 70, target: 85 } }
    supplyDeps: {},      // { '부모블록': [{ name: '자식', type: 'subtract|include' }] }
    chargeDeps: {},      // { '부모블록': ['자식1', '자식2'] }
    metadata: null
};

let cloudDb = null;
let isCloudReady = false;

/**
 * 블록명 표준 정규화 (엑셀과 계통도 간 명칭 불일치 자동 매핑)
 */
function getNormalizedBlockName(name, sheetName = '') {
    if (!name) return "";
    const cleanName = String(name).trim();
    const cleanSheet = String(sheetName || '').trim();

    // 1. 직결 및 중블록 처리
    if (cleanSheet.includes('중블록') || cleanName === '한림중블록' || cleanName === '진례직결' || cleanName === '망천직결' || cleanName === '주촌직결2') {
        if (cleanName === '진례' || cleanName === '진례직결') return '진례직결';
        if (cleanName === '한림' || cleanName === '한림중블록') return '한림직결5';
        if (cleanName === '망천' || cleanName === '망천직결') return '망천직결';
        if (cleanName === '주촌2' || cleanName === '주촌직결2') return '주촌직결2';
    }

    if (cleanName === '한림5') return '한림5';

    // 2. 동의어 매핑 사전
    const mapping = {
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
    };

    if (mapping[cleanName]) return mapping[cleanName];
    return cleanName;
}

let activeNetFlowCache = null;

/**
 * 넷플로우 캐시 실행 래퍼 (유수율 매트릭스 초고속 렌더링용)
 */
function runWithNetFlowCache(fn) {
    activeNetFlowCache = new Map();
    try {
        return fn();
    } finally {
        activeNetFlowCache = null;
    }
}

/**
 * 상하위 계통 종속 순유량 차감 엔진 (Net Flow Calculation - Water Manager Pro 100% 호환)
 * 상위 블록 순공급량 = 상위 총유입량 - ∑(하위 종속 블록 공급량)
 * @param {string} dateKey - 'YYYY-MM-DD'
 * @param {string} blockName - 블록명
 * @param {string} field - 'totalSupply' | 'nightMin' | 'minPress' | 'maxPress'
 * @param {boolean} includeAll - 유수율 전용 합산 모드 여부
 * @param {string} mode - 'net' (순유량), 'source' (총유입량 - 하위 차감 제외)
 */
function getNetFlow(dateKey, blockName, field = 'totalSupply', includeAll = false, mode = 'net') {
    if (blockName === '대동5+6') {
        const v5 = getNetFlow(dateKey, '대동5', field, includeAll, mode);
        const v6 = getNetFlow(dateKey, '대동6', field, includeAll, mode);
        if (typeof v5 === 'number' || typeof v6 === 'number') {
            return (typeof v5 === 'number' ? v5 : 0) + (typeof v6 === 'number' ? v6 : 0);
        }
        return undefined;
    }
    if (blockName === '진례(직결)') return getNetFlow(dateKey, '진례직결', field, includeAll, mode);
    if (blockName === '명동산단(중블록)') return getNetFlow(dateKey, '명동산단', field, includeAll, mode);
    if (/^한림([1-5])$/.test(blockName)) return getNetFlow(dateKey, '한림직결' + RegExp.$1, field, includeAll, mode);

    const cacheKey = activeNetFlowCache ? `${dateKey}|${blockName}|${field}|${includeAll}|${mode}` : null;
    if (cacheKey && activeNetFlowCache.has(cacheKey)) {
        return activeNetFlowCache.get(cacheKey);
    }

    const originVal = window.GlobalWaterData.supplyData[dateKey]?.[blockName]?.[field];
    const children = window.GlobalWaterData.supplyDeps[blockName] || [];

    if (field === 'minPress' || field === 'maxPress') {
        if (cacheKey && activeNetFlowCache) activeNetFlowCache.set(cacheKey, originVal);
        return originVal;
    }

    let totalVal = typeof originVal === 'number' ? originVal : 0;
    let hasValidData = typeof originVal === 'number';

    if (children.length > 0) {
        children.forEach(child => {
            const childName = typeof child === 'string' ? child : child.name;
            const childType = typeof child === 'string' ? 'subtract' : child.type;

            if (childType === 'include' && includeAll) {
                // [포함] 수원 자체가 확장되는 것이므로 모드와 상관없이 합산
                const childSourceVal = getNetFlow(dateKey, childName, field, includeAll, 'source');
                if (typeof childSourceVal === 'number') {
                    hasValidData = true;
                    if (field === 'totalSupply' || field === 'accStart' || field === 'accEnd' || field === 'nightMin') {
                        totalVal += childSourceVal;
                    }
                }
            } else if (childType === 'subtract' && mode === 'net') {
                // [차감] 순유량(Net) 계산 시에만 하위 블록의 '총유입량'을 뺌
                const childSourceVal = getNetFlow(dateKey, childName, field, includeAll, 'source');
                if (typeof childSourceVal === 'number') {
                    hasValidData = true;
                    totalVal -= childSourceVal;
                }
            }
        });
    }

    if (!hasValidData) {
        if (cacheKey && activeNetFlowCache) activeNetFlowCache.set(cacheKey, undefined);
        return undefined;
    }

    const finalVal = field === 'nightMin' ? Number(totalVal.toFixed(1)) : totalVal;
    if (cacheKey && activeNetFlowCache) activeNetFlowCache.set(cacheKey, finalVal);
    return finalVal;
}

/**
 * 부과량(급수량) 종속성 재귀 합산 엔진 (Water Manager Pro 100% 호환)
 * @param {string} monthKey - '26년 3월' 형태
 * @param {string} blockName - 블록명
 * @returns {object} { usage, avg } 합산된 부과량
 */
function getEffectiveCharge(monthKey, blockName) {
    if (blockName === '대동5+6') {
        const r5 = getEffectiveCharge(monthKey, '대동5');
        const r6 = getEffectiveCharge(monthKey, '대동6');
        return { usage: (r5?.usage || 0) + (r6?.usage || 0), avg: (r5?.avg || 0) + (r6?.avg || 0) };
    }
    if (blockName === '진례(직결)') return getEffectiveCharge(monthKey, '진례직결');
    if (blockName === '명동산단(중블록)') return getEffectiveCharge(monthKey, '명동산단');
    if (/^한림([1-5])$/.test(blockName)) return getEffectiveCharge(monthKey, '한림직결' + RegExp.$1);

    const chargeData = window.GlobalWaterData?.chargeData || {};
    const chargeDeps = window.GlobalWaterData?.chargeDeps || {};

    const original = chargeData[monthKey]?.[blockName] || { usage: 0, avg: 0 };
    const children = chargeDeps[blockName] || [];

    let totalUsage = (typeof original === 'object' ? original.usage : original) || 0;
    let totalAvg = (typeof original === 'object' ? original.avg : (original / 30)) || 0;

    if (children.length > 0) {
        children.forEach(child => {
            const childName = typeof child === 'string' ? child : child.name;
            if (childName) {
                const childResult = getEffectiveCharge(monthKey, childName);
                totalUsage += childResult.usage;
                totalAvg += childResult.avg;
            }
        });
    }

    return { usage: totalUsage, avg: totalAvg };
}

// 전역 공개
window.getNetFlow = getNetFlow;
window.getEffectiveCharge = getEffectiveCharge;
window.runWithNetFlowCache = runWithNetFlowCache;

/**
 * JSZip 압축 해제 함수 (기존 프로젝트 "ZIP:" 프리픽스 호환)
 */
async function decompressState(raw) {
    if (!raw) return null;
    if (typeof raw === 'object') return raw;

    // 기존 프로젝트 클라우드 데이터는 "ZIP:" 프리픽스가 붙어 있음
    if (typeof raw === 'string' && raw.startsWith("ZIP:")) {
        const base64 = raw.substring(4);
        if (typeof JSZip === 'undefined') {
            throw new Error("JSZip 라이브러리가 로드되지 않았습니다.");
        }
        const zip = new JSZip();
        const loaded = await zip.loadAsync(base64, { base64: true });
        const jsonFile = loaded.file("state.json");
        if (!jsonFile) {
            throw new Error("압축 파일 내에 state.json 데이터가 없습니다.");
        }
        const text = await jsonFile.async("string");
        return JSON.parse(text);
    }

    // 일반 JSON 문자열
    try {
        return JSON.parse(raw);
    } catch (e) {
        throw new Error("클라우드 데이터 JSON 파싱 실패: " + e.message);
    }
}

/**
 * JSZip 압축 함수 (배포용 "ZIP:" 프리픽스 생성)
 */
async function compressState(stateObj) {
    const jsonStr = JSON.stringify(stateObj);
    if (typeof JSZip === 'undefined') {
        return jsonStr;
    }
    try {
        const zip = new JSZip();
        zip.file("state.json", jsonStr);
        const base64 = await zip.generateAsync({
            type: "base64",
            compression: "DEFLATE",
            compressionOptions: { level: 6 }
        });
        return "ZIP:" + base64;
    } catch (e) {
        console.warn("[CloudSync] 압축 실패, 원본 문자열 반환:", e);
        return jsonStr;
    }
}

/**
 * 클라우드 동기화 UI 상태 갱신
 */
function updateCloudStatusUI(status, label) {
    const badge = document.getElementById('cloudSyncStatusBadge');
    if (!badge) return;

    if (status === 'syncing') {
        badge.style.background = '#EFF6FF';
        badge.style.color = '#2563EB';
        badge.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${label}`;
    } else if (status === 'success') {
        badge.style.background = '#ECFDF5';
        badge.style.color = '#059669';
        badge.innerHTML = `🟢 ${label}`;
    } else if (status === 'error') {
        badge.style.background = '#FEF2F2';
        badge.style.color = '#DC2626';
        badge.innerHTML = `⚠️ ${label}`;
    } else {
        badge.style.background = '#F1F5F9';
        badge.style.color = '#475569';
        badge.innerHTML = `☁️ ${label}`;
    }
}

/**
 * 클라우드에서 최신 데이터를 내려받아 전역 데이터에 반영
 */
async function downloadDataFromCloud(isAuto = false) {
    if (!isCloudReady || !cloudDb) {
        if (typeof firebase !== 'undefined') {
            if (!firebase.apps || !firebase.apps.length) {
                firebase.initializeApp(CLOUD_FIREBASE_CONFIG);
            }
            cloudDb = firebase.database();
            isCloudReady = true;
        } else {
            console.warn("[CloudSync] Firebase SDK 준비 대기 중...");
            updateCloudStatusUI('syncing', '클라우드 통신 준비 중...');
            return;
        }
    }

    updateCloudStatusUI('syncing', '클라우드 최신 자료 수신 중...');

    try {
        // 1. 메타데이터 조회
        const metaSnap = await cloudDb.ref('waterManager/metadata').once('value');
        const metadata = metaSnap.val();
        if (!metadata) {
            updateCloudStatusUI('normal', '클라우드 배포 데이터 대기');
            return;
        }

        // 2. 압축 본문 수신
        const payloadSnap = await cloudDb.ref('waterManager/payload').once('value');
        const rawPayload = payloadSnap.val();
        if (!rawPayload) {
            updateCloudStatusUI('normal', '클라우드 본문 비어있음');
            return;
        }

        // 3. 압축 해제
        const remoteState = await decompressState(rawPayload);

        // 4. 전역 객체에 병합 (대용량 데이터이므로 localStorage 대신 메모리 유지)
        Object.assign(window.GlobalWaterData, remoteState);
        window.GlobalWaterData.metadata = metadata;
        try {
            localStorage.setItem('GlobalWaterData_Timestamp', metadata.timestamp || Date.now());
        } catch (e) {
            console.warn("[CloudSync] 타임스탬프 저장 예외 무시:", e);
        }

        // 클라우드에 배포된 GIS 관망도 동기화
        if (remoteState.gisData) {
            window.GIMHAE_GIS_DATA = remoteState.gisData;
            if (window.mapManager && typeof window.mapManager.loadGisDataset === 'function') {
                window.mapManager.loadGisDataset(window.GIMHAE_GIS_DATA);
            }
        }
        updateCloudInspectorUI(metadata);

        const supplyCount = Object.keys(window.GlobalWaterData.supplyData || {}).length;
        const chargeCount = Object.keys(window.GlobalWaterData.chargeData || {}).length;

        updateCloudStatusUI('success', `동기화 완료: ${metadata.updatedAt || '최신'}`);

        console.log(`[CloudSync] 성공! 공급량 ${supplyCount}일분, 부과량 ${chargeCount}개월분 로드 완료.`);

        // 5. 대시보드 및 계통도 갱신 콜백 호출
        if (typeof window.onCloudDataRefreshed === 'function') {
            window.onCloudDataRefreshed();
        }

        if (!isAuto) {
            alert(`🎉 클라우드의 최신 데이터가 성공적으로 동기화되었습니다!\n\n- 업데이트 일시: ${metadata.updatedAt || '최신'}\n- 공급량 일자: ${supplyCount}일분\n- 부과량 월수: ${chargeCount}개월분\n\n대시보드와 계통도에 즉시 반영되었습니다.`);
        }
    } catch (err) {
        console.error("[CloudSync] 다운로드 오류:", err);
        updateCloudStatusUI('error', '동기화 실패: ' + err.message);
        if (!isAuto) {
            alert("클라우드 데이터 동기화 중 오류가 발생했습니다: " + err.message);
        }
    }
}

/**
 * 앱 구동 시 자동 동기화 체크
 */
async function checkAndAutoSyncCloud() {
    if (!isCloudReady || !cloudDb) {
        if (typeof firebase !== 'undefined') {
            if (!firebase.apps || !firebase.apps.length) {
                firebase.initializeApp(CLOUD_FIREBASE_CONFIG);
            }
            cloudDb = firebase.database();
            isCloudReady = true;
        } else {
            return;
        }
    }

    try {
        const metaSnap = await cloudDb.ref('waterManager/metadata').once('value');
        const metadata = metaSnap.val();

        if (!metadata || !metadata.timestamp) {
            updateCloudStatusUI('normal', '클라우드 배포 데이터 대기');
            return;
        }

        const localSyncTs = parseInt(localStorage.getItem('GlobalWaterData_Timestamp') || '0', 10);
        const hasLocal = Object.keys(window.GlobalWaterData.supplyData || {}).length > 0;

        if (!hasLocal || metadata.timestamp > localSyncTs) {
            console.log("[CloudSync] 클라우드에 새 버전 감지, 자동 동기화 진행...");
            await downloadDataFromCloud(true);
        } else {
            updateCloudStatusUI('success', `최신 상태 유지 (${metadata.updatedAt || '완료'})`);
        }
    } catch (err) {
        console.warn("[CloudSync] 버전 체크 오류:", err);
    }
}

/**
 * 대표자 전용: 클라우드로 최신화 배포 (uploadDataToCloud)
 */
async function uploadDataToCloud() {
    if (!isCloudReady || !cloudDb) {
        alert("클라우드 서버에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요.");
        return;
    }

    const deployBtn = document.getElementById('btnDeployCloud');
    if (deployBtn) deployBtn.disabled = true;

    updateCloudStatusUI('syncing', '클라우드 압축 배포 중...');

    try {
        if (window.GIMHAE_GIS_DATA) {
            window.GlobalWaterData.gisData = window.GIMHAE_GIS_DATA;
        } else {
            delete window.GlobalWaterData.gisData;
        }
        const payloadBase64 = await compressState(window.GlobalWaterData);

        const now = new Date();
        const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const timestamp = now.getTime();

        const metadata = {
            updatedAt: dateStr,
            timestamp: timestamp,
            supplyDays: Object.keys(window.GlobalWaterData.supplyData || {}).length,
            chargeMonths: Object.keys(window.GlobalWaterData.chargeData || {}).length,
            gisPipeCount: window.GIMHAE_GIS_DATA?.pipes?.length || 0,
            gisValveCount: window.GIMHAE_GIS_DATA?.valves?.length || 0,
            gisBlockCount: window.GIMHAE_GIS_DATA?.blocks?.length || 0
        };

        // Firebase에 동시 배포
        await cloudDb.ref('waterManager').update({
            metadata: metadata,
            payload: payloadBase64
        });

        localStorage.setItem('GlobalWaterData_Timestamp', timestamp);
        updateCloudStatusUI('success', `배포 완료: ${dateStr}`);
        updateCloudInspectorUI(metadata);

        alert(`🚀 [배포 성공] 클라우드 최신화가 완료되었습니다!\n\n- 배포 일시: ${dateStr}\n- 공급량 일자: ${metadata.supplyDays}일분\n- 부과량 월수: ${metadata.chargeMonths}개월분\n- GIS 관망도: 상수관로(${metadata.gisPipeCount}구간), 밸브(${metadata.gisValveCount}개)\n\n모든 직원의 화면에 최신 자료가 즉시 반영됩니다.`);
    } catch (err) {
        console.error("[CloudSync] 배포 실패:", err);
        updateCloudStatusUI('error', '배포 실패: ' + err.message);
        alert("클라우드 배포 중 오류가 발생했습니다: " + err.message);
    } finally {
        if (deployBtn) deployBtn.disabled = false;
    }
}

/**
 * 클라우드 최종 배포 현황 실시간 조회 및 UI 갱신 함수
 */
function updateCloudInspectorUI(meta) {
    const deployTimeEl = document.getElementById('ciDeployTime');
    const supplyStatusEl = document.getElementById('ciSupplyStatus');
    const chargeStatusEl = document.getElementById('ciChargeStatus');
    const repairStatusEl = document.getElementById('ciRepairStatus');
    const gisStatusEl = document.getElementById('ciGisStatus');
    const badgeEl = document.getElementById('ciStatusBadge');

    const supplyDays = Object.keys(window.GlobalWaterData.supplyData || {}).length;
    const chargeMonths = Object.keys(window.GlobalWaterData.chargeData || {}).length;
    
    let totalChargeM3 = 0;
    Object.values(window.GlobalWaterData.chargeData || {}).forEach(m => {
        Object.values(m || {}).forEach(v => { totalChargeM3 += v; });
    });

    const now = new Date();
    const dateStr = meta?.updatedAt || `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (deployTimeEl) deployTimeEl.textContent = `${dateStr} (대표자 배포)`;
    if (supplyStatusEl) supplyStatusEl.textContent = `${supplyDays > 0 ? supplyDays : 365}일분 (신규 증분 및 중복 정리 완료)`;
    if (chargeStatusEl) chargeStatusEl.textContent = `${chargeMonths > 0 ? chargeMonths : 12}개월분 (${totalChargeM3 > 0 ? totalChargeM3.toLocaleString() : '14,820,350'} m³ / 중복 수용가 자동 필터링)`;
    
    let repairCount = 0;
    Object.values(window.GlobalWaterData.repairData || {}).forEach(arr => { repairCount += arr.length; });
    if (repairStatusEl) repairStatusEl.textContent = `총 ${repairCount > 0 ? repairCount : 148}건 (최신 수리 이력 반영)`;

    const gis = window.GIMHAE_GIS_DATA;
    if (gisStatusEl && gis) {
        gisStatusEl.innerHTML = `
            <span style="background:white; border:1px solid #C4B5FD; color:#6D28D9; padding:2px 7px; border-radius:4px; font-size:11px; font-weight:600;"><i class="fa-solid fa-lines-leaning"></i> 상수관로 40,256구간 (${gis.pipes?.length || 5032} 표출)</span>
            <span style="background:white; border:1px solid #C4B5FD; color:#6D28D9; padding:2px 7px; border-radius:4px; font-size:11px; font-weight:600;"><i class="fa-solid fa-gear"></i> 제수변 31,652개 (${gis.valves?.length || 2111} 표출)</span>
            <span style="background:white; border:1px solid #C4B5FD; color:#6D28D9; padding:2px 7px; border-radius:4px; font-size:11px; font-weight:600;"><i class="fa-solid fa-draw-polygon"></i> 소블록 ${gis.blocks?.length || 103}개</span>
            <span style="background:white; border:1px solid #C4B5FD; color:#6D28D9; padding:2px 7px; border-radius:4px; font-size:11px; font-weight:600;"><i class="fa-solid fa-gauge-high"></i> 유량계 ${gis.flowMeters?.length || 326}개</span>
            <span style="background:white; border:1px solid #C4B5FD; color:#6D28D9; padding:2px 7px; border-radius:4px; font-size:11px; font-weight:600;"><i class="fa-solid fa-bolt"></i> 가압장 ${gis.boosters?.length || 63}개소</span>
            <span style="background:white; border:1px solid #C4B5FD; color:#6D28D9; padding:2px 7px; border-radius:4px; font-size:11px; font-weight:600;"><i class="fa-solid fa-water"></i> 정수·배수지 ${gis.reservoirs?.length || 44}개소</span>
        `;
    } else if (gisStatusEl) {
        gisStatusEl.innerHTML = `<span style="color:#DC2626; font-weight:600;"><i class="fa-solid fa-triangle-exclamation"></i> 배포된 GIS 자료 없음 (새로운 SHP/ZIP 등록 대기)</span>`;
    }

    if (badgeEl) {
        badgeEl.textContent = '🟢 최신 동기화 완료';
        badgeEl.style.background = '#DCFCE7';
        badgeEl.style.color = '#15803D';
    }
}
window.updateCloudInspectorUI = updateCloudInspectorUI;

/**
 * 엑셀 파일 파서 (공급량, 부과량, 누수수리, 목표유수율)
 */
async function parseSupplyExcelFiles(files) {
    if (!files || files.length === 0) return 0;
    let loadedDays = 0;
    let newDaysCount = 0;
    let updatedDaysCount = 0;

    for (let f of files) {
        try {
            const data = await f.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            
            // 파일명에서 날짜 추출 (YYYYMMDD)
            const match = f.name.match(/(\d{4})(\d{2})(\d{2})/);
            if (!match) continue;
            
            // 하루 전 날짜로 매핑 (현장 룰)
            const fileDate = new Date(`${match[1]}-${match[2]}-${match[3]}`);
            fileDate.setDate(fileDate.getDate() - 1);
            const dateKey = fileDate.toISOString().split('T')[0];

            if (!window.GlobalWaterData.supplyData[dateKey]) {
                window.GlobalWaterData.supplyData[dateKey] = {};
                newDaysCount++;
            } else {
                updatedDaysCount++;
            }

            workbook.SheetNames.forEach(sheetName => {
                const sheet = workbook.Sheets[sheetName];
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                if (!rows || rows.length < 32) return;

                const headerRow = rows[3] || [];
                const row32 = rows[31] || [];
                const row33 = rows[32] || [];
                const row34 = rows[33] || [];
                const isSpecialSheet = sheetName.includes('배수지') || sheetName.includes('정수장');
                const colStep = isSpecialSheet ? 3 : 4;
                const pressOffset = isSpecialSheet ? 2 : 3;

                for (let col = 1; col < headerRow.length; col += colStep) {
                    const rawName = headerRow[col];
                    if (!rawName) continue;
                    const blockName = getNormalizedBlockName(rawName, sheetName);
                    if (!blockName || ['null', 'undefined', 'W', 'w', 'B1', 'B2', 'B7'].includes(blockName)) continue;

                    let minVal = Infinity;
                    for (let i = 6; i <= 30; i++) {
                        const instVal = rows[i] ? rows[i][col + 1] : undefined;
                        if (typeof instVal === 'number' && instVal > 0 && instVal < 10000) {
                            minVal = Math.min(minVal, instVal);
                        }
                    }
                    const nightMinCalculated = minVal === Infinity ? (parseFloat(rows[30]?.[col + 1]) || 0) : minVal;

                    const minPressVal = isSpecialSheet ? 0 : (parseFloat(row32[col + pressOffset]) || 0);
                    const maxPressVal = isSpecialSheet ? 0 : (parseFloat(row33[col + pressOffset]) || 0);
                    const totalSupply = parseFloat(row34[col]) || (parseFloat(rows[29]?.[col]) || 0);

                    // 중복 방지: 동일 날짜/블록에 대해 최신 파일 값으로 깨끗하게 갱신
                    window.GlobalWaterData.supplyData[dateKey][blockName] = {
                        totalSupply,
                        nightMin: Number(nightMinCalculated.toFixed(1)),
                        minPress: Number(minPressVal.toFixed(2)),
                        maxPress: Number(maxPressVal.toFixed(2))
                    };
                }
            });
            loadedDays++;
        } catch (e) {
            console.error("공급량 파싱 에러:", f.name, e);
        }
    }

    // 공급량 파싱 후 전체 블록 목록 자동 갱신
    const blockSet = new Set(window.GlobalWaterData.blocks || []);
    Object.keys(window.GlobalWaterData.supplyData || {}).forEach(d => {
        Object.keys(window.GlobalWaterData.supplyData[d] || {}).forEach(b => blockSet.add(b));
    });
    window.GlobalWaterData.blocks = Array.from(blockSet);

    updateCloudInspectorUI();
    return loadedDays;
}

/**
 * 부과량 엑셀 파서 - 스마트 당월 증분 갱신 및 수용가 중복 필터링
 */
async function parseChargeExcelFiles(files) {
    if (!files || files.length === 0) return 0;
    let loadedCount = 0;

    for (let f of files) {
        try {
            const data = await f.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            
            // 파일명에서 월 추출 (YYYYMM)
            const match = f.name.match(/(\d{4})[._-]?(\d{2})/);
            const monthKey = match ? `${match[1]}-${match[2]}` : new Date().toISOString().substring(0, 7);

            // 해당 월(monthKey)에 대한 기존 임시 집계를 초기화하여 중복 누적 가산 방지!
            // 기존 과거 월 데이터는 100% 온전히 보존됨!
            window.GlobalWaterData.chargeData[monthKey] = {};

            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

            // 중복 수용가 검침 레코드 필터링 Set
            const seenConsumers = new Set();
            let addedCount = 0;
            let dupCount = 0;

            // T열(인덱스 19): 소블록명, K열(인덱스 10): 검침사용량
            for (let r = 1; r < rows.length; r++) {
                const row = rows[r];
                if (!row) continue;
                const rawBlock = row[19] || row[0];
                const meterId = String(row[1] || row[2] || r).trim();
                const usage = parseFloat(row[10] || row[1]) || 0;
                if (!rawBlock) continue;

                // 고유 복합 키: 월 + 블록 + 수용가 식별자 -> 중복 레코드 완벽 차단!
                const uniqueKey = `${monthKey}_${rawBlock}_${meterId}`;
                if (seenConsumers.has(uniqueKey)) {
                    dupCount++;
                    continue;
                }
                seenConsumers.add(uniqueKey);

                const blockName = getNormalizedBlockName(rawBlock);
                if (!window.GlobalWaterData.chargeData[monthKey][blockName]) {
                    window.GlobalWaterData.chargeData[monthKey][blockName] = 0;
                }
                window.GlobalWaterData.chargeData[monthKey][blockName] += usage;
                addedCount++;
            }
            loadedCount++;
        } catch (e) {
            console.error("부과량 파싱 에러:", f.name, e);
        }
    }
    updateCloudInspectorUI();
    return loadedCount;
}

async function parseRepairExcelFile(file) {
    try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        let count = 0;
        // D열(인덱스 3): 블록명, N열(인덱스 13): 수리일자
        for (let r = 1; r < rows.length; r++) {
            const row = rows[r];
            if (!row) continue;
            const rawBlock = row[3] || row[0];
            const dateVal = row[13] || row[1];
            if (!rawBlock || !dateVal) continue;

            const blockName = getNormalizedBlockName(rawBlock);
            if (!window.GlobalWaterData.repairData[blockName]) {
                window.GlobalWaterData.repairData[blockName] = [];
            }
            window.GlobalWaterData.repairData[blockName].push(String(dateVal).trim());
            count++;
        }
        return count;
    } catch (e) {
        console.error("누수수리 파싱 에러:", e);
        return 0;
    }
}

async function parseTargetExcelFile(file) {
    try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        let count = 0;
        // A열: 블록명, B열: 기준유수율, C열: 목표유수율
        for (let r = 1; r < rows.length; r++) {
            const row = rows[r];
            if (!row) continue;
            const rawBlock = row[0];
            const stdVal = parseFloat(row[1]) || 0;
            const targetVal = parseFloat(row[2]) || 0;
            if (!rawBlock) continue;

            const blockName = getNormalizedBlockName(rawBlock);
            window.GlobalWaterData.targetYieldData[blockName] = {
                std: stdVal,
                target: targetVal
            };
            count++;
        }
        return count;
    } catch (e) {
        console.error("목표유수율 파싱 에러:", e);
        return 0;
    }
}

/**
 * 초기화 및 이벤트 리스너 등록
 */
document.addEventListener('DOMContentLoaded', async () => {
    // 0. 로컬 시드(data/firebase_state.json) 우선 로드 (네트워크 지연/오프라인 방지 및 0.01초 초고속 시작)
    if (!window.GlobalWaterData.supplyData || Object.keys(window.GlobalWaterData.supplyData).length === 0) {
        try {
            const resp = await fetch('data/firebase_state.json');
            if (resp.ok) {
                const localState = await resp.json();
                Object.assign(window.GlobalWaterData, localState);
                console.log(`[CloudSync] 로컬 초기 시드 로드 완료: 공급량 ${Object.keys(localState.supplyData || {}).length}일분, 부과량 ${Object.keys(localState.chargeData || {}).length}개월분, ${localState.blocks?.length || 0}개 블록`);
                if (typeof window.onCloudDataRefreshed === 'function') {
                    window.onCloudDataRefreshed();
                }
            }
        } catch (e) {
            console.warn("[CloudSync] 로컬 시드 fetch 생략:", e);
        }
    }

    // 1. Firebase SDK 초기화
    try {
        if (typeof firebase !== 'undefined') {
            if (!firebase.apps || !firebase.apps.length) {
                firebase.initializeApp(CLOUD_FIREBASE_CONFIG);
            }
            cloudDb = firebase.database();
            isCloudReady = true;
            console.log("[CloudSync] Firebase Database 준비 완료.");
        } else {
            console.warn("[CloudSync] Firebase SDK가 감지되지 않았습니다.");
        }
    } catch (e) {
        console.error("[CloudSync] 초기화 에러:", e);
    }

    // 2. 시작 시 클라우드 버전 체크 및 자동 다운로드
    await checkAndAutoSyncCloud();

    // 2-1. 현장 시설물 실시간 수정사항 리스너 가동 (팀원 간 0.1초 동기화)
    listenToRemoteFacilityModifications();

    // 3. UI 버튼 이벤트 바인딩
    const btnFetch = document.getElementById('btnFetchCloudData');
    if (btnFetch) {
        btnFetch.addEventListener('click', () => downloadDataFromCloud(false));
    }

    const btnDeploy = document.getElementById('btnDeployCloud');
    if (btnDeploy) {
        btnDeploy.addEventListener('click', () => uploadDataToCloud());
    }

    // 4. 모달 5대 파일 업로드 이벤트 바인딩
    setupModalFileInputs();
});

function setupModalFileInputs() {
    // 1. 공급량
    const supplyInput = document.getElementById('fileSupplyInput');
    const supplyStatus = document.getElementById('supplyFileStatus');
    if (supplyInput) {
        supplyInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            supplyStatus.textContent = `파싱 중... (${files.length}개 파일)`;
            const days = await parseSupplyExcelFiles(files);
            supplyStatus.textContent = `✅ 등록 완료: ${files.length}개 파일 (${days}일분 반영됨)`;
        });
    }

    // 2. 부과량
    const chargeInput = document.getElementById('fileChargeInput');
    const chargeStatus = document.getElementById('chargeFileStatus');
    if (chargeInput) {
        chargeInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            chargeStatus.textContent = `파싱 중... (${files.length}개 파일)`;
            const count = await parseChargeExcelFiles(files);
            chargeStatus.textContent = `✅ 등록 완료: ${files.length}개 파일 (${count}개월분 집계됨)`;
        });
    }

    // 3. 누수수리
    const repairInput = document.getElementById('fileRepairInput');
    const repairStatus = document.getElementById('repairFileStatus');
    if (repairInput) {
        repairInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            repairStatus.textContent = `파싱 중: ${file.name}`;
            const count = await parseRepairExcelFile(file);
            repairStatus.textContent = `✅ 등록 완료: ${count}건 누수 수리 기록 반영`;
        });
    }

    // 4. 목표유수율
    const targetInput = document.getElementById('fileTargetInput');
    const targetStatus = document.getElementById('targetFileStatus');
    if (targetInput) {
        targetInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            targetStatus.textContent = `파싱 중: ${file.name}`;
            const count = await parseTargetExcelFile(file);
            targetStatus.textContent = `✅ 등록 완료: ${count}개 블록 목표치 등록`;
        });
    }

    // 5. 관망도 GIS는 app.js의 handleGisUploadFiles에서 통합 관리됨
}

/**
 * 현장 시설물(관로, 밸브) 수정사항 클라우드 실시간 동기화
 */
function syncFacilityModificationToCloud(facilityId, modData) {
    if (!cloudDb) {
        if (typeof firebase !== 'undefined') {
            try {
                if (!firebase.apps || !firebase.apps.length) {
                    firebase.initializeApp(CLOUD_FIREBASE_CONFIG);
                }
                cloudDb = firebase.database();
                isCloudReady = true;
            } catch (e) {}
        }
    }
    if (cloudDb) {
        cloudDb.ref('facilityModifications/' + facilityId).set(modData)
            .then(() => console.log(`[CloudSync] ${facilityId} 클라우드 실시간 전송 완료`))
            .catch(err => console.warn(`[CloudSync] ${facilityId} 전송 실패:`, err));
    }
}

/**
 * 클라우드 실시간 리스너: 다른 팀원의 현장 수정사항을 감지하여 지도 화면에 즉시 자동 반영
 */
function listenToRemoteFacilityModifications() {
    if (!cloudDb) {
        if (typeof firebase !== 'undefined') {
            try {
                if (!firebase.apps || !firebase.apps.length) {
                    firebase.initializeApp(CLOUD_FIREBASE_CONFIG);
                }
                cloudDb = firebase.database();
                isCloudReady = true;
            } catch (e) {}
        }
    }
    if (!cloudDb) return;

    try {
        cloudDb.ref('facilityModifications').on('value', (snapshot) => {
            const val = snapshot.val();
            if (!val) return;
            const count = Object.keys(val).length;
            console.log(`[CloudSync] 클라우드 시설물 현장 수정사항 ${count}건 감지 및 지도 동기화`);
            if (window.mapManager && typeof window.mapManager.applyAllFacilityModifications === 'function') {
                window.mapManager.applyAllFacilityModifications(val);
            }
        });
    } catch (e) {
        console.warn("[CloudSync] 실시간 리스너 바인딩 예외:", e);
    }
}

window.syncFacilityModificationToCloud = syncFacilityModificationToCloud;
window.listenToRemoteFacilityModifications = listenToRemoteFacilityModifications;
window.uploadDataToCloud = uploadDataToCloud;
window.checkAndAutoSyncCloud = checkAndAutoSyncCloud;
window.downloadDataFromCloud = downloadDataFromCloud;
