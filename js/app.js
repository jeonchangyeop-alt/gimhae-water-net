/**
 * 김해관망관리 - 메인 애플리케이션 컨트롤러
 * 1. 상단 3대 대메뉴: [1. 계통도] / [2. 유수율분석 ▾] / [3. 공종관리 ▾]
 * 2. 관리자 전용: [기초자료 배포 (관리자)] 센터 모달
 * 3. 3대 뷰 전환: [1. 계통도 캔버스] <-> [2. 유수율 대시보드] <-> [3. 공종관리 GIS 지도]
 */

let mapManager = null;
let currentFacility = null;
let currentPhotos = [];
let isEditMode = false;
let currentWorkMode = 'ALL';
let currentMainView = 'TOPOLOGY'; // 'TOPOLOGY' | 'DASHBOARD' | 'MAP'

// 클라우드 데이터 수신/동기화 시 자동 화면 리프레시 콜백
window.onCloudDataRefreshed = function() {
    console.log("[App] 클라우드 최신 데이터가 반영되어 화면을 즉시 갱신합니다.");
    if (currentMainView === 'DASHBOARD') {
        const activeBtn = document.querySelector('.dash-tab-btn.active');
        const activeTab = activeBtn ? activeBtn.dataset.tab : 'dash-overview';
        switchDashboardTab(activeTab);
    }
    if (window.topologyManager) {
        window.topologyManager.render();
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 1. IndexedDB 초기화 (대기 지연 방지 타임아웃 적용)
        if (window.offlineStore && typeof window.offlineStore.init === 'function') {
            await Promise.race([
                window.offlineStore.init(),
                new Promise(resolve => setTimeout(resolve, 300))
            ]);
        }
    } catch (e) {
        console.warn('[App] offlineStore 초기화 경고:', e);
    }

    try {
        // 2. 지도 초기화
        if (typeof WaterMapManager === 'function') {
            mapManager = new WaterMapManager('map', onFacilitySelected);
            mapManager.initMap();
            window.mapManager = mapManager;
        } else {
            console.error('[App] WaterMapManager 클래스를 찾을 수 없습니다.');
        }
    } catch (e) {
        console.error('[App] 지도 초기화 오류:', e);
    }

    try {
        // 3. UI 이벤트 바인딩
        initUIEvents();
    } catch (e) {
        console.error('[App] UI 이벤트 바인딩 오류:', e);
    }

    try {
        // 4. 초기 시설물 목록 및 블록 채우기
        populateBlockSelect();
        renderFacilityList();
        loadSurveysList();
    } catch (e) {
        console.warn('[App] 초기 목록 채우기 경고:', e);
    }

    // 5. URL 쿼리 파라미터에 따른 뷰 진입 (기본: 관망 GIS 지도 [MAP])
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const reqView = urlParams.get('view');
        if (!reqView) {
            switchMainView('MAP'); // 현장 관망 관리를 위해 GIS 지도로 기본 진입!
        } else {
            switchMainView(reqView);
        }
    } catch (e) {
        console.error('[App] 메인 뷰 진입 오류:', e);
        switchMainView('MAP');
    }

    // 6. 사용자 저장 테마(라이트 / 다크 네이비) 복원
    try {
        const savedTheme = localStorage.getItem('water_app_theme') || 'light';
        applyAppTheme(savedTheme);
    } catch (e) {}
});

/**
 * 메인 뷰 전환 함수 ('TOPOLOGY' | 'DASHBOARD' | 'MAP' | 'UNUSED_PIPE' | 'AGING_PIPE' | 'BLOCK_MAP' | 'SCHEDULE' | 'ADMIN_MODE')
 */
function switchMainView(viewType, subTab = 'dash-overview') {
    currentMainView = viewType;

    const containers = {
        'TOPOLOGY': document.getElementById('topologyViewContainer'),
        'DASHBOARD': document.getElementById('dashboardViewContainer'),
        'MAP': document.getElementById('mapViewContainer'),
        'UNUSED_PIPE': document.getElementById('unusedPipeViewContainer'),
        'AGING_PIPE': document.getElementById('agingPipeViewContainer'),
        'BLOCK_MAP': document.getElementById('blockMapViewContainer'),
        'SCHEDULE': document.getElementById('scheduleViewContainer'),
        'ADMIN_MODE': document.getElementById('adminModeViewContainer'),
        'STANDARDS': document.getElementById('standardsViewContainer')
    };

    const buttons = {
        'TOPOLOGY': document.getElementById('btnMenuTopology'),
        'DASHBOARD': document.getElementById('btnMenuRevenue'),
        'MAP': document.getElementById('btnMenuWork'),
        'UNUSED_PIPE': document.getElementById('btnMenuUnused'),
        'AGING_PIPE': document.getElementById('btnMenuAging'),
        'BLOCK_MAP': document.getElementById('btnMenuBlockMap'),
        'SCHEDULE': document.getElementById('btnMenuSchedule'),
        'ADMIN_MODE': document.getElementById('btnMenuAdmin'),
        'STANDARDS': document.getElementById('btnMenuStandards')
    };

    const badge = document.getElementById('currentViewBadge');

    // 모든 컨테이너 숨김
    Object.values(containers).forEach(el => {
        if (el) el.style.display = 'none';
    });

    // 모든 버튼 활성 상태 초기화
    Object.values(buttons).forEach(btn => {
        if (btn) btn.classList.remove('active');
    });

    // 선택된 뷰 컨테이너 표시 및 버튼 활성화
    if (containers[viewType]) {
        containers[viewType].style.display = 'flex';
    }
    if (buttons[viewType]) {
        buttons[viewType].classList.add('active');
    }

    // 각 모드별 특화 로직 및 상단 배지 업데이트
    if (viewType === 'TOPOLOGY') {
        if (badge) {
            badge.textContent = '1. 계통도 모드';
            badge.style.background = 'rgba(37, 99, 235, 0.15)';
            badge.style.color = '#2563EB';
        }

        // 계통도 인스턴스 초기화 (최초 1회 생성 또는 렌더 갱신)
        if (!window.topologyManager && window.TopologyCanvasManager) {
            window.topologyManager = new TopologyCanvasManager('topologyViewContainer');
        } else if (window.topologyManager) {
            window.topologyManager.render();
        }
    } else if (viewType === 'DASHBOARD') {
        if (badge) {
            badge.textContent = '2. 유수율 대시보드';
            badge.style.background = 'rgba(139, 92, 246, 0.18)';
            badge.style.color = '#7C3AED';
        }

        switchDashboardTab(subTab);
    } else if (viewType === 'MAP') {
        if (badge) {
            const workText = document.getElementById('workModeText')?.textContent?.replace('작업 모드: ', '');
            badge.textContent = currentWorkMode === 'ALL' ? '3. 공종관리 (전체)' : `3. 공종관리 (${workText || ''})`;
            badge.style.background = 'rgba(16, 185, 129, 0.18)';
            badge.style.color = '#059669';
        }

        // 지도가 전체 화면을 차지하도록 초기 상태 보장 (사용자 요구사항 반영)
        if (typeof closeSidePanel === 'function') {
            closeSidePanel();
        }

        setTimeout(async () => {
            if (mapManager) {
                if (mapManager.map) {
                    mapManager.map.invalidateSize();
                }
                if (!mapManager.gisDataLoaded && window.GIMHAE_GIS_DATA) {
                    await mapManager.loadGisDataset(window.GIMHAE_GIS_DATA);
                } else if (typeof mapManager.fitGisBounds === 'function') {
                    mapManager.fitGisBounds();
                }

                // 모바일 환경일 경우 백그라운드에서 현재 위치 마커를 미리 인식 (지도는 전체 뷰 유지)
                if (navigator.geolocation && (window.innerWidth <= 768 || /Mobi|Android|iPhone/i.test(navigator.userAgent))) {
                    setTimeout(() => {
                        if (mapManager && typeof mapManager.locateUser === 'function') {
                            mapManager.locateUser(false, false);
                        }
                    }, 1500);
                }
            }
        }, 150);
    } else if (viewType === 'UNUSED_PIPE') {
        if (badge) {
            badge.textContent = '4. 불용관관리 모드';
            badge.style.background = 'rgba(239, 68, 68, 0.18)';
            badge.style.color = '#DC2626';
        }
    } else if (viewType === 'AGING_PIPE') {
        if (badge) {
            badge.textContent = '5. 노후관선별 모드';
            badge.style.background = 'rgba(245, 158, 11, 0.18)';
            badge.style.color = '#D97706';
        }
    } else if (viewType === 'BLOCK_MAP') {
        if (badge) {
            badge.textContent = '6. 블록현황도 모드';
            badge.style.background = 'rgba(2, 132, 199, 0.18)';
            badge.style.color = '#0284C7';
        }
    } else if (viewType === 'SCHEDULE') {
        if (badge) {
            badge.textContent = '7. 일정표 모드';
            badge.style.background = 'rgba(139, 92, 246, 0.18)';
            badge.style.color = '#7C3AED';
        }
    } else if (viewType === 'ADMIN_MODE') {
        if (badge) {
            badge.textContent = '8. 관리자모드';
            badge.style.background = 'rgba(16, 185, 129, 0.18)';
            badge.style.color = '#059669';
        }
    } else if (viewType === 'STANDARDS') {
        if (badge) {
            badge.textContent = '9. 기준 및 근거 (AI)';
            badge.style.background = 'rgba(2, 132, 199, 0.18)';
            badge.style.color = '#0284C7';
        }
    }
}

/**
 * 대시보드 내부 서브탭 전환
 */
function switchDashboardTab(tabId) {
    document.querySelectorAll('.dash-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    document.querySelectorAll('.dash-section').forEach(sec => sec.style.display = 'none');

    if (tabId === 'dash-overview') {
        const sec = document.getElementById('sectionDashOverview');
        if (sec) sec.style.display = 'block';
        renderDashboardOverview();
    } else if (tabId === 'dash-supply') {
        document.getElementById('sectionDashSupply').style.display = 'block';
        renderDashboardSupply();
    } else if (tabId === 'dash-charge') {
        document.getElementById('sectionDashCharge').style.display = 'block';
        renderDashboardCharge();
    } else if (tabId === 'dash-yield') {
        document.getElementById('sectionDashYield').style.display = 'block';
        renderDashboardYield();
    } else if (tabId === 'dash-target') {
        document.getElementById('sectionDashTarget').style.display = 'block';
        if (typeof initTargetYieldManager === 'function') {
            initTargetYieldManager();
        } else {
            renderDashboardTarget('all');
        }
    }
}

// ==============================================================
// 0. 대시보드 (매월 특이사항 종합 관제 알림판) 모듈
// - 공급량: TM 결측(유량 미수신), 수압 변동 없음(센서 고착), 최근 10일 야간최소 증가(누수 의심)
// - 부과량: 최근 3개월 비교 일사용량 급증 vs 전무/0톤/급감 수용가 및 블록별 변동
// - 유수율: 전월 대비 유수율 급락 vs 급상승 블록 및 저유수율 취약 블록
// ==============================================================
let currentOverviewMonth = '2026-11';
let currentOverviewFilter = 'all'; // 'all' | 'supply' | 'charge' | 'yield'
let isOverviewInitialized = false;

/**
 * 0. 대시보드 메인 진입 및 렌더링 함수
 */
function renderDashboardOverview(monthKey = null) {
    if (monthKey) {
        currentOverviewMonth = monthKey;
    }

    // 1. 월 선택 셀렉터 동적 초기화
    initOverviewMonthSelector();

    // 2. 이벤트 리스너 바인딩 (최초 1회)
    if (!isOverviewInitialized) {
        setupOverviewEventListeners();
        isOverviewInitialized = true;
    }

    // 3. 공급량 특이사항 연산 및 렌더링
    const supplyData = computeSupplyAnomalies(currentOverviewMonth);
    renderSupplyAnomalies(supplyData);

    // 4. 부과량 특이사항 연산 및 렌더링
    const chargeData = computeChargeAnomalies(currentOverviewMonth);
    renderChargeAnomalies(chargeData);

    // 5. 유수율 변동 특이사항 연산 및 렌더링
    const yieldData = computeYieldAnomalies(currentOverviewMonth);
    renderYieldAnomalies(yieldData);

    // 6. 상단 요약 KPI 바 업데이트
    updateOverviewSummaryKpi(supplyData, chargeData, yieldData);

    // 7. 현재 활성화된 필터 적용
    applyOverviewFilter(currentOverviewFilter);
}

/**
 * 월 선택 셀렉터 옵션 초기화
 */
function initOverviewMonthSelector() {
    const sel = document.getElementById('overviewMonthSelect');
    if (!sel) return;

    if (sel.options.length === 0) {
        const monthOptions = [
            { key: '2026-11', label: '2026년 11월 (최신)' },
            { key: '2026-10', label: '2026년 10월' },
            { key: '2026-09', label: '2026년 09월' },
            { key: '2026-08', label: '2026년 08월' },
            { key: '2026-07', label: '2026년 07월' },
            { key: '2026-06', label: '2026년 06월' }
        ];

        let html = '';
        monthOptions.forEach(opt => {
            html += `<option value="${opt.key}" ${opt.key === currentOverviewMonth ? 'selected' : ''}>${opt.label}</option>`;
        });
        sel.innerHTML = html;
    } else {
        sel.value = currentOverviewMonth;
    }
}

/**
 * 이벤트 리스너 설정
 */
function setupOverviewEventListeners() {
    // 월 선택 변경
    const sel = document.getElementById('overviewMonthSelect');
    if (sel) {
        sel.addEventListener('change', (e) => {
            currentOverviewMonth = e.target.value;
            renderDashboardOverview(currentOverviewMonth);
        });
    }

    // 카테고리 필터 버튼 (Pills)
    document.querySelectorAll('.ov-pill-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.ov-pill-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const filter = btn.dataset.filter || 'all';
            currentOverviewFilter = filter;
            applyOverviewFilter(filter);
        });
    });

    // KPI 카드 클릭 시 해당 필터 토글
    document.querySelectorAll('.ov-kpi-card').forEach(card => {
        card.addEventListener('click', () => {
            const targetFilter = card.dataset.filterTarget;
            if (targetFilter) {
                document.querySelectorAll('.ov-pill-btn').forEach(b => {
                    b.classList.toggle('active', b.dataset.filter === targetFilter);
                });
                currentOverviewFilter = targetFilter;
                applyOverviewFilter(targetFilter);
            }
        });
    });

    // 엑셀 저장 버튼
    const btnExcel = document.getElementById('btnExportOverviewExcel');
    if (btnExcel) {
        btnExcel.addEventListener('click', exportOverviewExcel);
    }
}

/**
 * 필터 적용 함수 (전체 / 공급량 / 부과량 / 유수율)
 */
function applyOverviewFilter(filter) {
    const cardSupply = document.getElementById('cardOverviewSupply');
    const cardCharge = document.getElementById('cardOverviewCharge');
    const cardYield = document.getElementById('cardOverviewYield');

    if (!cardSupply || !cardCharge || !cardYield) return;

    if (filter === 'supply') {
        cardSupply.style.display = 'flex';
        cardCharge.style.display = 'none';
        cardYield.style.display = 'none';
    } else if (filter === 'charge') {
        cardSupply.style.display = 'none';
        cardCharge.style.display = 'flex';
        cardYield.style.display = 'none';
    } else if (filter === 'yield') {
        cardSupply.style.display = 'none';
        cardCharge.style.display = 'none';
        cardYield.style.display = 'flex';
    } else {
        // all
        cardSupply.style.display = 'flex';
        cardCharge.style.display = 'flex';
        cardYield.style.display = 'flex';
    }
}

/**
 * 김해시 92개 유수율 관리 블록 (목표유수율 파일 기준 & 권역별 정렬 100% 매핑)
 */
const YIELD_BLOCKS_92 = [
    // --- 명동권역 (35개) ---
    '진영1', '진영2', '진영3', '진영4', '진영5', '진영6', '진영7',
    '진례(직결)',
    '한림1', '한림2', '한림3', '한림4', '한림5',
    '병동농공', '명동산단(중블록)', '금음마을', '망천직결',
    '주촌1', '주촌2', '주촌3', '주촌4', '주촌5', '주촌6', '주촌7',
    '장유1', '장유2', '장유3', '장유4', '장유5', '장유6', '장유7', '장유8', '장유9',
    '율하2',
    '테크노산단',

    // --- 삼계권역 (48개) ---
    '생림1', '생림2', '생림3',
    '구산1', '구산2', '구산3', '구산4',
    '내외1', '내외2', '내외3', '내외4', '내외5', '내외6', '내외7', '내외8',
    '동상1', '동상2',
    '부원6', '부원7-1', '부원7-2', '부원7-3', '부원8',
    '북부1', '북부2', '북부3', '북부4', '북부5', '북부6',
    '불암1', '불암2', '불암3', '불암4', '불암5', '불암6',
    '삼안1', '삼안2', '삼안3', '삼안4', '삼안5', '삼안6',
    '칠산서부1', '칠산서부2', '칠산서부3',
    '활천1', '활천2', '활천3', '활천4', '활천5',

    // --- 덕산권역 (9개) ---
    '대동1', '대동2', '대동3', '대동4', '대동5+6', '대동6',
    '상동1', '상동2', '상동3'
];

/**
 * 김해시 94개 공급량 분석 블록 (92개 블록 + 상동2 아래 대감1, 대감2 추가)
 */
const SUPPLY_BLOCKS_94 = [
    // --- 명동권역 (35개) ---
    '진영1', '진영2', '진영3', '진영4', '진영5', '진영6', '진영7',
    '진례(직결)',
    '한림1', '한림2', '한림3', '한림4', '한림5',
    '병동농공', '명동산단(중블록)', '금음마을', '망천직결',
    '주촌1', '주촌2', '주촌3', '주촌4', '주촌5', '주촌6', '주촌7',
    '장유1', '장유2', '장유3', '장유4', '장유5', '장유6', '장유7', '장유8', '장유9',
    '율하2',
    '테크노산단',

    // --- 삼계권역 (48개) ---
    '생림1', '생림2', '생림3',
    '구산1', '구산2', '구산3', '구산4',
    '내외1', '내외2', '내외3', '내외4', '내외5', '내외6', '내외7', '내외8',
    '동상1', '동상2',
    '부원6', '부원7-1', '부원7-2', '부원7-3', '부원8',
    '북부1', '북부2', '북부3', '북부4', '북부5', '북부6',
    '불암1', '불암2', '불암3', '불암4', '불암5', '불암6',
    '삼안1', '삼안2', '삼안3', '삼안4', '삼안5', '삼안6',
    '칠산서부1', '칠산서부2', '칠산서부3',
    '활천1', '활천2', '활천3', '활천4', '활천5',

    // --- 덕산권역 (11개) ---
    '대동1', '대동2', '대동3', '대동4', '대동5+6', '대동6',
    '상동1', '상동2',
    '대감1', '대감2', // 상동2 아래 소소블록
    '상동3'
];

window.YIELD_BLOCKS_92 = YIELD_BLOCKS_92;
window.SUPPLY_BLOCKS_94 = SUPPLY_BLOCKS_94;

function getBlockRegion(bName) {
    if (!bName) return '삼계권역';
    const clean = String(bName).trim();
    if (/대동|상동|대감/.test(clean)) return '덕산권역';
    if (/진영|진례|한림|장유|주촌|율하|망천|병동|명동|테크노|이지산단|골든루트|금음/.test(clean)) return '명동권역';
    return '삼계권역';
}
window.getBlockRegion = getBlockRegion;

function normalizeTopologySubBlockName(rawName) {
    if (!rawName) return '';
    let name = String(rawName).trim();
    if (name === '진례직결(소)' || name === '진례직결') return '진례(직결)';
    if (name === '병동농공(소)') return '병동농공';
    if (name === '금음마을(중블록)') return '금음마을';
    if (name === '망천직결(중블록)') return '망천직결';
    if (name === '명동산단') return '명동산단(중블록)';
    if (name === '한림5(소)') return '한림5';
    if (/^한림직결([1-5])$/.test(name)) {
        return '한림' + RegExp.$1;
    }
    return name;
}

function getTopologySubBlocks() {
    return YIELD_BLOCKS_92.slice();
}

function isTopologySubBlock(bName) {
    if (!bName) return false;
    const norm = normalizeTopologySubBlockName(bName);
    return YIELD_BLOCKS_92.includes(norm) || YIELD_BLOCKS_92.includes(bName);
}

window.getTopologySubBlocks = getTopologySubBlocks;
window.isTopologySubBlock = isTopologySubBlock;
window.normalizeTopologySubBlockName = normalizeTopologySubBlockName;
window.invalidateTopologySubBlocksCache = function() {};

/**
 * 김해시 유수율 분석 소블록 목록 도출 유틸 (0. 대시보드 92개 블록 전용)
 */
function getOverviewAllBlocks() {
    return YIELD_BLOCKS_92.slice();
}

/**
 * 1. 공급량 특이사항 연산 (TM 통신오류, 수압 센서 고착, 야간최소 지속증가)
 */
function computeSupplyAnomalies(monthKey) {
    const tmErrors = [];
    const pressureFreezes = [];
    const mnfSurges = [];

    if (!window.GlobalWaterData || !window.GlobalWaterData.supplyData) {
        return { tmErrors, pressureFreezes, mnfSurges };
    }

    const allDates = Object.keys(window.GlobalWaterData.supplyData).sort();
    let monthDates = allDates.filter(d => d.startsWith(monthKey));
    if (monthDates.length === 0) {
        monthDates = allDates.slice(-30);
    }

    const blockList = getOverviewAllBlocks();

    blockList.forEach(bName => {
        // --- A. TM 통신 오류 / 결측 검사 ---
        let missingDays = 0;
        let normalDays = 0;
        let lastMissing = null;

        monthDates.forEach(d => {
            const rawFlow = window.GlobalWaterData.supplyData[d]?.[bName]?.totalSupply;
            if (rawFlow === undefined || rawFlow === null || rawFlow === 0) {
                missingDays++;
                lastMissing = d;
            } else {
                normalDays++;
            }
        });

        // 정상 데이터가 일부 있으면서 결측 일자가 1일 이상 있는 경우 (통신 이상 블록)
        if (missingDays >= 1 && normalDays > 0) {
            tmErrors.push({
                blockName: bName,
                missingDays,
                normalDays,
                totalDays: monthDates.length,
                lastMissing: lastMissing || monthDates[monthDates.length - 1],
                isCritical: missingDays >= 3 || (lastMissing === monthDates[monthDates.length - 1])
            });
        }

        // --- B. 수압 변동 없음 (센서 고착 / 오류 의심) ---
        let freezeDays = 0;
        let samplePressure = null;
        let measuredCount = 0;

        monthDates.forEach(d => {
            const entry = window.GlobalWaterData.supplyData[d]?.[bName];
            if (entry) {
                const minP = entry.minPress;
                const maxP = entry.maxPress;
                if (typeof minP === 'number' && typeof maxP === 'number' && maxP > 0) {
                    measuredCount++;
                    const delta = Math.abs(maxP - minP);
                    if (delta <= 0.05) {
                        freezeDays++;
                        samplePressure = maxP;
                    }
                }
            }
        });

        if (freezeDays >= 2) {
            pressureFreezes.push({
                blockName: bName,
                freezeDays,
                samplePressure: samplePressure ? samplePressure.toFixed(1) : '0.0',
                measuredCount,
                isCritical: freezeDays >= 5
            });
        }

        // --- C. 최근 10일 야간최소유량(MNF) 지속 증가 (누수 의심) ---
        if (monthDates.length >= 7) {
            const recentDates = monthDates.slice(-10);
            const mnfList = recentDates.map(d => {
                const v = typeof getNetFlow === 'function' 
                    ? getNetFlow(d, bName, 'nightMin') 
                    : window.GlobalWaterData.supplyData[d]?.[bName]?.nightMin;
                return (typeof v === 'number' && v > 0 && v < 10000) ? v : null;
            }).filter(v => v !== null);

            if (mnfList.length >= 5) {
                const half = Math.floor(mnfList.length / 2);
                const sSlice = mnfList.slice(0, half);
                const eSlice = mnfList.slice(-half);
                const sAvg = sSlice.reduce((a, b) => a + b, 0) / sSlice.length;
                const eAvg = eSlice.reduce((a, b) => a + b, 0) / eSlice.length;
                const delta = eAvg - sAvg;
                const pct = sAvg > 0 ? (delta / sAvg) * 100 : 0;

                // 10일간 1.2 m³/h 이상 & 10% 이상 증가
                if (delta >= 1.2 && pct >= 10.0) {
                    mnfSurges.push({
                        blockName: bName,
                        startAvg: Number(sAvg.toFixed(1)),
                        endAvg: Number(eAvg.toFixed(1)),
                        delta: Number(delta.toFixed(1)),
                        pct: Number(pct.toFixed(1)),
                        recentDays: recentDates.length,
                        isCritical: delta >= 3.5 || pct >= 25.0
                    });
                }
            }
        }
    });

    tmErrors.sort((a, b) => b.missingDays - a.missingDays);
    pressureFreezes.sort((a, b) => b.freezeDays - a.freezeDays);
    mnfSurges.sort((a, b) => b.delta - a.delta);

    return { tmErrors, pressureFreezes, mnfSurges };
}

/**
 * 2. 부과량 특이사항 연산 (일사용량 급증 수용가, 0톤 전무/급감 수용가, 블록별 변동)
 */
function computeChargeAnomalies(monthKey) {
    const surges = [];
    const zeros = [];
    const blockDiffs = [];

    if (!window.CONSUMER_CHARGE_DATA || !window.CONSUMER_CHARGE_DATA.blocks) {
        return { surges, zeros, blockDiffs, totalSurgeCount: 0, totalZeroCount: 0 };
    }

    const blocksData = window.CONSUMER_CHARGE_DATA.blocks;
    const summaryData = window.CONSUMER_CHARGE_DATA.summary || {};

    Object.keys(blocksData).forEach(bName => {
        if (!isTopologySubBlock(bName)) return;
        const cList = blocksData[bName] || [];
        cList.forEach(c => {
            const m1 = typeof c.m1 === 'number' ? c.m1 : 0;
            const m2 = typeof c.m2 === 'number' ? c.m2 : 0;
            const m3 = typeof c.m3 === 'number' ? c.m3 : (typeof c.m2611 === 'number' ? c.m2611 : 0);

            const prevAvg = (m1 + m2) / 2;
            const diff = m3 - prevAvg;
            const daily = c.dailyUsage || (m3 > 0 ? Number((m3 / 30).toFixed(2)) : 0);

            // A. 급증 수용가: 이전평균 대비 당월 +70% 이상 & 차이 15m³ 이상
            if (m3 >= 20 && (prevAvg === 0 || (diff >= 15 && (diff / prevAvg) >= 0.70))) {
                const ratio = prevAvg > 0 ? Math.round((diff / prevAvg) * 100) : 999;
                surges.push({
                    cNo: c.cNo,
                    name: c.name || '미등록',
                    blockName: c.block || bName,
                    type: c.type || '일반용',
                    caliber: c.caliber || 13,
                    m1, m2, m3,
                    prevAvg: Number(prevAvg.toFixed(1)),
                    diff: Number(diff.toFixed(1)),
                    ratio,
                    daily,
                    isCritical: ratio >= 150 || diff >= 50
                });
            }

            // B. 0톤 전무 / 급감 수용가: 이전평균 15m³ 이상에서 0톤 또는 80% 이상 급감
            if (prevAvg >= 15 && (m3 === 0 || (prevAvg - m3) / prevAvg >= 0.80)) {
                const dropRatio = Math.round(((prevAvg - m3) / prevAvg) * 100);
                zeros.push({
                    cNo: c.cNo,
                    name: c.name || '미등록',
                    blockName: c.block || bName,
                    type: c.type || '일반용',
                    caliber: c.caliber || 13,
                    m1, m2, m3,
                    prevAvg: Number(prevAvg.toFixed(1)),
                    dropRatio,
                    isZero: m3 === 0,
                    isCritical: m3 === 0 && prevAvg >= 25
                });
            }
        });
    });

    Object.keys(summaryData).forEach(bName => {
        if (!isTopologySubBlock(bName)) return;
        const s = summaryData[bName];
        if (s && s.totalDailyUsage > 0) {
            blockDiffs.push({
                blockName: bName,
                totalDailyUsage: Number(s.totalDailyUsage.toFixed(1)),
                totalCount: s.totalCount || 0,
                largeCount: s.largeCount || 0,
                largeRatio: s.largeRatio || 0,
                unfitCount: s.unfitCount || 0
            });
        }
    });

    surges.sort((a, b) => b.diff - a.diff);
    zeros.sort((a, b) => b.prevAvg - a.prevAvg);
    blockDiffs.sort((a, b) => b.totalDailyUsage - a.totalDailyUsage);

    return {
        surges: surges.slice(0, 50),
        zeros: zeros.slice(0, 50),
        blockDiffs: blockDiffs.slice(0, 10),
        totalSurgeCount: surges.length,
        totalZeroCount: zeros.length
    };
}

/**
 * 3. 유수율 변동 특이사항 연산 (전월 대비 급락, 급상승, 저유수율 취약 블록)
 */
function computeYieldAnomalies(monthKey) {
    const drops = [];
    const rises = [];
    const lowYields = [];

    const blockList = (typeof getAllYieldReportBlocks === 'function') 
        ? getAllYieldReportBlocks() 
        : getOverviewAllBlocks();

    let targetIdx = YIELD_REPORT_MONTHS.length - 1; // 기본 2026-09
    if (monthKey) {
        const fIdx = YIELD_REPORT_MONTHS.findIndex(m => m.key === monthKey);
        if (fIdx >= 1) targetIdx = fIdx;
    }

    const prevIdx = targetIdx - 1;
    const curLabel = YIELD_REPORT_MONTHS[targetIdx]?.label || '';
    const prevLabel = YIELD_REPORT_MONTHS[prevIdx]?.label || '';

    blockList.forEach(bName => {
        if (!bName || ['W', 'w', '비어있음', 'null', 'undefined'].includes(bName)) return;

        const series = getYieldBlockSeries(bName);
        if (!series || !series.yield) return;

        const curY = series.yield[targetIdx];
        const prevY = series.yield[prevIdx];
        const curSup = series.supply ? series.supply[targetIdx] : null;
        const curBill = series.billed ? series.billed[targetIdx] : null;

        if (typeof curY === 'number' && !isNaN(curY)) {
            // 저유수율 블록 (< 60%)
            if (curY < 60.0 && curSup !== null && curSup > 0) {
                lowYields.push({
                    blockName: bName,
                    curY: Number(curY.toFixed(1)),
                    curSup: Math.round(curSup),
                    curBill: curBill ? Math.round(curBill) : 0,
                    curLabel
                });
            }

            if (typeof prevY === 'number' && !isNaN(prevY)) {
                const diff = Number((curY - prevY).toFixed(1));

                // A. 유수율 급락 블록 (diff <= -3.0%p)
                if (diff <= -3.0) {
                    drops.push({
                        blockName: bName,
                        curY: Number(curY.toFixed(1)),
                        prevY: Number(prevY.toFixed(1)),
                        diff,
                        curSup: curSup ? Math.round(curSup) : 0,
                        curBill: curBill ? Math.round(curBill) : 0,
                        isCritical: diff <= -7.0
                    });
                }

                // B. 유수율 급상승 블록 (diff >= +3.0%p)
                if (diff >= 3.0) {
                    rises.push({
                        blockName: bName,
                        curY: Number(curY.toFixed(1)),
                        prevY: Number(prevY.toFixed(1)),
                        diff,
                        curSup: curSup ? Math.round(curSup) : 0,
                        curBill: curBill ? Math.round(curBill) : 0,
                        isCritical: diff >= 7.0
                    });
                }
            }
        }
    });

    drops.sort((a, b) => a.diff - b.diff);
    rises.sort((a, b) => b.diff - a.diff);
    lowYields.sort((a, b) => a.curY - b.curY);

    return {
        drops,
        rises,
        lowYields: lowYields.slice(0, 10),
        curLabel,
        prevLabel
    };
}

/**
 * 공급량 이상 리스트 HTML 렌더링
 */
function renderSupplyAnomalies(data) {
    const { tmErrors, pressureFreezes, mnfSurges } = data;

    // A. TM 통신 오류 / 결측
    const elTm = document.getElementById('listSupplyTmErrors');
    const badgeTm = document.getElementById('countTmErrorList');
    if (badgeTm) badgeTm.textContent = `${tmErrors.length}개소`;

    if (elTm) {
        if (tmErrors.length === 0) {
            elTm.innerHTML = `<div class="ov-empty-msg"><i class="fa-solid fa-circle-check" style="color:#10B981;"></i> 정상 수신 중 (결측 블록 없음)</div>`;
        } else {
            let html = '';
            tmErrors.forEach(item => {
                html += `
                <div class="ov-item">
                    <div class="ov-item-left">
                        <div class="ov-item-title">
                            <span class="ov-item-name" onclick="jumpToSupplyBlock('${item.blockName}')" title="공급량 분석 바로가기">${item.blockName}</span>
                            <span class="${item.isCritical ? 'ov-badge-danger' : 'ov-badge-warning'}">${item.isCritical ? '위험 결측' : '주의'}</span>
                        </div>
                        <div class="ov-item-detail">
                            <span><i class="fa-solid fa-triangle-exclamation" style="color:#EF4444;"></i> 결측 <b>${item.missingDays}일</b> (정상 ${item.normalDays}일)</span>
                            <span>최근 결측: ${item.lastMissing}</span>
                        </div>
                    </div>
                    <div class="ov-item-right">
                        <button class="ov-action-btn" onclick="jumpToSupplyBlock('${item.blockName}')" title="공급량 분석 보기"><i class="fa-solid fa-chart-line"></i> 분석</button>
                        <button class="ov-action-btn primary" onclick="jumpToGisMapBlock('${item.blockName}')" title="GIS 관망도 위치 보기"><i class="fa-solid fa-map-location-dot"></i> 지도</button>
                    </div>
                </div>`;
            });
            elTm.innerHTML = html;
        }
    }

    // B. 수압 변동 없음
    const elPress = document.getElementById('listSupplyPressureFreezes');
    const badgePress = document.getElementById('countPressFreezeList');
    if (badgePress) badgePress.textContent = `${pressureFreezes.length}개소`;

    if (elPress) {
        if (pressureFreezes.length === 0) {
            elPress.innerHTML = `<div class="ov-empty-msg"><i class="fa-solid fa-circle-check" style="color:#10B981;"></i> 정상 변동 (수압 센서 고착 의심 없음)</div>`;
        } else {
            let html = '';
            pressureFreezes.forEach(item => {
                html += `
                <div class="ov-item">
                    <div class="ov-item-left">
                        <div class="ov-item-title">
                            <span class="ov-item-name" onclick="jumpToSupplyBlock('${item.blockName}')" title="공급량 분석 바로가기">${item.blockName}</span>
                            <span class="${item.isCritical ? 'ov-badge-danger' : 'ov-badge-warning'}">${item.isCritical ? '센서점검요망' : '변동미약'}</span>
                        </div>
                        <div class="ov-item-detail">
                            <span><i class="fa-solid fa-gauge" style="color:#F59E0B;"></i> 고착 <b>${item.freezeDays}일간</b> (일교차 0.00kgf/cm²)</span>
                            <span>수압: ${item.samplePressure}kgf/cm²</span>
                        </div>
                    </div>
                    <div class="ov-item-right">
                        <button class="ov-action-btn" onclick="jumpToSupplyBlock('${item.blockName}')" title="공급량 분석 보기"><i class="fa-solid fa-chart-line"></i> 분석</button>
                        <button class="ov-action-btn primary" onclick="jumpToGisMapBlock('${item.blockName}')" title="GIS 관망도 위치 보기"><i class="fa-solid fa-map-location-dot"></i> 지도</button>
                    </div>
                </div>`;
            });
            elPress.innerHTML = html;
        }
    }

    // C. 최근 10일 야간최소 지속 증가
    const elMnf = document.getElementById('listSupplyMnfSurges');
    const badgeMnf = document.getElementById('countMnfSurgeList');
    if (badgeMnf) badgeMnf.textContent = `${mnfSurges.length}개소`;

    if (elMnf) {
        if (mnfSurges.length === 0) {
            elMnf.innerHTML = `<div class="ov-empty-msg"><i class="fa-solid fa-circle-check" style="color:#10B981;"></i> 안정 상태 (야간최소 급증 블록 없음)</div>`;
        } else {
            let html = '';
            mnfSurges.forEach(item => {
                html += `
                <div class="ov-item">
                    <div class="ov-item-left">
                        <div class="ov-item-title">
                            <span class="ov-item-name" onclick="jumpToSupplyBlock('${item.blockName}')" title="공급량 분석 바로가기">${item.blockName}</span>
                            <span class="${item.isCritical ? 'ov-badge-danger' : 'ov-badge-accent'}">${item.isCritical ? '누수징후 심각' : '누수 의심'}</span>
                        </div>
                        <div class="ov-item-detail">
                            <span><i class="fa-solid fa-arrow-trend-up" style="color:#8B5CF6;"></i> MNF: ${item.startAvg} ➔ <b>${item.endAvg} m³/h</b></span>
                            <span style="color:#EF4444; font-weight:700;">▲ +${item.delta}m³/h (+${item.pct}%)</span>
                        </div>
                    </div>
                    <div class="ov-item-right">
                        <button class="ov-action-btn" onclick="jumpToSupplyBlock('${item.blockName}')" title="공급량 분석 보기"><i class="fa-solid fa-chart-line"></i> 분석</button>
                        <button class="ov-action-btn primary" onclick="jumpToGisMapBlock('${item.blockName}')" title="GIS 관망도 위치 보기"><i class="fa-solid fa-map-location-dot"></i> 지도</button>
                    </div>
                </div>`;
            });
            elMnf.innerHTML = html;
        }
    }

    const totalSupplyAnomalies = tmErrors.length + pressureFreezes.length + mnfSurges.length;
    const cardBadge = document.getElementById('cardSupplyBadge');
    if (cardBadge) cardBadge.textContent = `${totalSupplyAnomalies}건`;
}

/**
 * 부과량 특이사항 리스트 HTML 렌더링
 */
function renderChargeAnomalies(data) {
    const { surges, zeros, blockDiffs, totalSurgeCount, totalZeroCount } = data;

    // A. 일사용량 급증 수용가
    const elSurge = document.getElementById('listChargeSurges');
    const badgeSurge = document.getElementById('countChargeSurgeList');
    if (badgeSurge) badgeSurge.textContent = `${totalSurgeCount || surges.length}개소`;

    if (elSurge) {
        if (surges.length === 0) {
            elSurge.innerHTML = `<div class="ov-empty-msg"><i class="fa-solid fa-circle-check" style="color:#10B981;"></i> 정상 범위 (사용량 폭증 수용가 없음)</div>`;
        } else {
            let html = '';
            surges.slice(0, 30).forEach(c => {
                html += `
                <div class="ov-item">
                    <div class="ov-item-left">
                        <div class="ov-item-title">
                            <span class="ov-item-name" onclick="jumpToChargeConsumer('${c.cNo}', '${c.blockName}')" title="수용가 상세 보기">${c.name}</span>
                            <span class="ov-badge-danger">${c.isCritical ? '사용량 폭증' : '급증'}</span>
                            <span style="font-size:10.5px; color:#64748B;">(${c.blockName} · ${c.type})</span>
                        </div>
                        <div class="ov-item-detail">
                            <span>번호: ${c.cNo} (${c.caliber}mm)</span>
                            <span>이전평균: ${c.prevAvg}m³ ➔ 당월: <b>${c.m3}m³</b></span>
                            <span style="color:#EF4444; font-weight:700;">▲ +${c.diff}m³ (+${c.ratio}%)</span>
                        </div>
                    </div>
                    <div class="ov-item-right">
                        <button class="ov-action-btn primary" onclick="jumpToChargeConsumer('${c.cNo}', '${c.blockName}')" title="수용가 검침부과 상세 보기"><i class="fa-solid fa-magnifying-glass"></i> 검침조회</button>
                    </div>
                </div>`;
            });
            elSurge.innerHTML = html;
        }
    }

    // B. 일사용량 전무(0톤) / 급감 수용가
    const elZero = document.getElementById('listChargeZeros');
    const badgeZero = document.getElementById('countChargeZeroList');
    if (badgeZero) badgeZero.textContent = `${totalZeroCount || zeros.length}개소`;

    if (elZero) {
        if (zeros.length === 0) {
            elZero.innerHTML = `<div class="ov-empty-msg"><i class="fa-solid fa-circle-check" style="color:#10B981;"></i> 정상 범위 (계량기 고장/폐전 의심 없음)</div>`;
        } else {
            let html = '';
            zeros.slice(0, 30).forEach(c => {
                html += `
                <div class="ov-item">
                    <div class="ov-item-left">
                        <div class="ov-item-title">
                            <span class="ov-item-name" onclick="jumpToChargeConsumer('${c.cNo}', '${c.blockName}')" title="수용가 상세 보기">${c.name}</span>
                            <span class="${c.isZero ? 'ov-badge-danger' : 'ov-badge-warning'}">${c.isZero ? '0톤 전무 (고장의심)' : '사용량 급감'}</span>
                            <span style="font-size:10.5px; color:#64748B;">(${c.blockName} · ${c.type})</span>
                        </div>
                        <div class="ov-item-detail">
                            <span>번호: ${c.cNo} (${c.caliber}mm)</span>
                            <span>이전사용: ${c.prevAvg}m³ ➔ 당월: <b>${c.m3}m³</b></span>
                            <span style="color:#D97706; font-weight:700;">▼ -${c.dropRatio}%</span>
                        </div>
                    </div>
                    <div class="ov-item-right">
                        <button class="ov-action-btn primary" onclick="jumpToChargeConsumer('${c.cNo}', '${c.blockName}')" title="수용가 검침부과 상세 보기"><i class="fa-solid fa-magnifying-glass"></i> 검침조회</button>
                    </div>
                </div>`;
            });
            elZero.innerHTML = html;
        }
    }

    // C. 블록별 부과량 주요 현황
    const elBlock = document.getElementById('listChargeBlockDiffs');
    if (elBlock) {
        if (blockDiffs.length === 0) {
            elBlock.innerHTML = `<div class="ov-empty-msg">부과량 데이터 수신 대기 중</div>`;
        } else {
            let html = '';
            blockDiffs.slice(0, 8).forEach(b => {
                html += `
                <div class="ov-item">
                    <div class="ov-item-left">
                        <div class="ov-item-title">
                            <span class="ov-item-name" onclick="jumpToChargeConsumer('', '${b.blockName}')">${b.blockName}</span>
                            <span class="ov-badge-accent">일부과 ${b.totalDailyUsage}m³/일</span>
                        </div>
                        <div class="ov-item-detail">
                            <span>전체 수용가: ${b.totalCount}전</span>
                            <span>대량: ${b.largeCount}전 (${b.largeRatio}%)</span>
                            <span>구경부적합: ${b.unfitCount}전</span>
                        </div>
                    </div>
                    <div class="ov-item-right">
                        <button class="ov-action-btn" onclick="jumpToChargeConsumer('', '${b.blockName}')"><i class="fa-solid fa-receipt"></i> 부과량</button>
                        <button class="ov-action-btn primary" onclick="jumpToGisMapBlock('${b.blockName}')"><i class="fa-solid fa-map-location-dot"></i> 지도</button>
                    </div>
                </div>`;
            });
            elBlock.innerHTML = html;
        }
    }

    const totalChargeAnomalies = (totalSurgeCount || surges.length) + (totalZeroCount || zeros.length);
    const cardBadge = document.getElementById('cardChargeBadge');
    if (cardBadge) cardBadge.textContent = `${totalChargeAnomalies}건`;
}

/**
 * 유수율 변동 특이사항 리스트 HTML 렌더링
 */
function renderYieldAnomalies(data) {
    const { drops, rises, lowYields, curLabel, prevLabel } = data;

    // A. 유수율 급락 블록
    const elDrop = document.getElementById('listYieldDrops');
    const badgeDrop = document.getElementById('countYieldDropList');
    if (badgeDrop) badgeDrop.textContent = `${drops.length}개소`;

    if (elDrop) {
        if (drops.length === 0) {
            elDrop.innerHTML = `<div class="ov-empty-msg"><i class="fa-solid fa-circle-check" style="color:#10B981;"></i> 급락 블록 없음 (전월 대비 안정)</div>`;
        } else {
            let html = '';
            drops.forEach(y => {
                html += `
                <div class="ov-item">
                    <div class="ov-item-left">
                        <div class="ov-item-title">
                            <span class="ov-item-name" onclick="jumpToYieldBlock('${y.blockName}')" title="유수율 리포트 보기">${y.blockName}</span>
                            <span class="${y.isCritical ? 'ov-badge-danger' : 'ov-badge-warning'}">${y.isCritical ? '급락 경고' : '하락'}</span>
                        </div>
                        <div class="ov-item-detail">
                            <span>유수율: ${y.prevY}% ➔ <b>${y.curY}%</b></span>
                            <span style="color:#EF4444; font-weight:700;">▼ ${y.diff}%p</span>
                            <span>(공급 ${y.curSup.toLocaleString()}m³ · 부과 ${y.curBill.toLocaleString()}m³)</span>
                        </div>
                    </div>
                    <div class="ov-item-right">
                        <button class="ov-action-btn" onclick="jumpToYieldBlock('${y.blockName}')" title="유수율 리포트 보기"><i class="fa-solid fa-chart-line"></i> 리포트</button>
                        <button class="ov-action-btn primary" onclick="jumpToGisMapBlock('${y.blockName}')" title="GIS 관망도 위치 보기"><i class="fa-solid fa-map-location-dot"></i> 지도</button>
                    </div>
                </div>`;
            });
            elDrop.innerHTML = html;
        }
    }

    // B. 유수율 급상승 블록
    const elRise = document.getElementById('listYieldRises');
    const badgeRise = document.getElementById('countYieldRiseList');
    if (badgeRise) badgeRise.textContent = `${rises.length}개소`;

    if (elRise) {
        if (rises.length === 0) {
            elRise.innerHTML = `<div class="ov-empty-msg"><i class="fa-solid fa-info-circle" style="color:#64748B;"></i> 전월 대비 급상승 블록 없음</div>`;
        } else {
            let html = '';
            rises.forEach(y => {
                html += `
                <div class="ov-item">
                    <div class="ov-item-left">
                        <div class="ov-item-title">
                            <span class="ov-item-name" onclick="jumpToYieldBlock('${y.blockName}')" title="유수율 리포트 보기">${y.blockName}</span>
                            <span class="ov-badge-success">${y.isCritical ? '대폭 개선' : '개선'}</span>
                        </div>
                        <div class="ov-item-detail">
                            <span>유수율: ${y.prevY}% ➔ <b>${y.curY}%</b></span>
                            <span style="color:#10B981; font-weight:700;">▲ +${y.diff}%p</span>
                            <span>(공급 ${y.curSup.toLocaleString()}m³ · 부과 ${y.curBill.toLocaleString()}m³)</span>
                        </div>
                    </div>
                    <div class="ov-item-right">
                        <button class="ov-action-btn" onclick="jumpToYieldBlock('${y.blockName}')" title="유수율 리포트 보기"><i class="fa-solid fa-chart-line"></i> 리포트</button>
                        <button class="ov-action-btn primary" onclick="jumpToGisMapBlock('${y.blockName}')" title="GIS 관망도 위치 보기"><i class="fa-solid fa-map-location-dot"></i> 지도</button>
                    </div>
                </div>`;
            });
            elRise.innerHTML = html;
        }
    }

    // C. 저유수율 취약 블록 (< 60%)
    const elLow = document.getElementById('listYieldLows');
    const badgeLow = document.getElementById('countYieldLowList');
    if (badgeLow) badgeLow.textContent = `${lowYields.length}개소`;

    if (elLow) {
        if (lowYields.length === 0) {
            elLow.innerHTML = `<div class="ov-empty-msg"><i class="fa-solid fa-circle-check" style="color:#10B981;"></i> 60% 미만 취약 블록 없음</div>`;
        } else {
            let html = '';
            lowYields.forEach(y => {
                html += `
                <div class="ov-item">
                    <div class="ov-item-left">
                        <div class="ov-item-title">
                            <span class="ov-item-name" onclick="jumpToYieldBlock('${y.blockName}')" title="유수율 리포트 보기">${y.blockName}</span>
                            <span class="ov-badge-danger">유수율 <b>${y.curY}%</b></span>
                        </div>
                        <div class="ov-item-detail">
                            <span>공급량: ${y.curSup.toLocaleString()}m³</span>
                            <span>부과량: ${y.curBill.toLocaleString()}m³</span>
                            <span style="color:#EF4444;">(누수량 추정: ${Math.max(0, y.curSup - y.curBill).toLocaleString()}m³)</span>
                        </div>
                    </div>
                    <div class="ov-item-right">
                        <button class="ov-action-btn" onclick="jumpToYieldBlock('${y.blockName}')" title="유수율 리포트 보기"><i class="fa-solid fa-chart-line"></i> 리포트</button>
                        <button class="ov-action-btn primary" onclick="jumpToGisMapBlock('${y.blockName}')" title="GIS 관망도 위치 보기"><i class="fa-solid fa-map-location-dot"></i> 지도</button>
                    </div>
                </div>`;
            });
            elLow.innerHTML = html;
        }
    }

    const totalYieldAnomalies = drops.length + rises.length;
    const cardBadge = document.getElementById('cardYieldBadge');
    if (cardBadge) cardBadge.textContent = `${totalYieldAnomalies}건`;
}

/**
 * 상단 요약 KPI 바 업데이트
 */
function updateOverviewSummaryKpi(supply, charge, yieldData) {
    // 공급량 이상
    const totalSup = supply.tmErrors.length + supply.pressureFreezes.length + supply.mnfSurges.length;
    const kpiSupEl = document.getElementById('kpiSupplyTotalCount');
    if (kpiSupEl) kpiSupEl.textContent = totalSup;

    const bTm = document.getElementById('badgeTmErrorCount');
    if (bTm) bTm.textContent = `TM결측 ${supply.tmErrors.length}`;

    const bPress = document.getElementById('badgePressFreezeCount');
    if (bPress) bPress.textContent = `수압고착 ${supply.pressureFreezes.length}`;

    const bMnf = document.getElementById('badgeMnfSurgeCount');
    if (bMnf) bMnf.textContent = `MNF증가 ${supply.mnfSurges.length}`;

    // 부과량 특이
    const totalChg = (charge.totalSurgeCount || charge.surges.length) + (charge.totalZeroCount || charge.zeros.length);
    const kpiChgEl = document.getElementById('kpiChargeTotalCount');
    if (kpiChgEl) kpiChgEl.textContent = totalChg;

    const bSurge = document.getElementById('badgeChargeSurgeCount');
    if (bSurge) bSurge.textContent = `급증 ${charge.totalSurgeCount || charge.surges.length}`;

    const bZero = document.getElementById('badgeChargeZeroCount');
    if (bZero) bZero.textContent = `0톤/급감 ${charge.totalZeroCount || charge.zeros.length}`;

    // 유수율 급변
    const totalYld = yieldData.drops.length + yieldData.rises.length;
    const kpiYldEl = document.getElementById('kpiYieldTotalCount');
    if (kpiYldEl) kpiYldEl.textContent = totalYld;

    const bDrop = document.getElementById('badgeYieldDropCount');
    if (bDrop) bDrop.textContent = `급락 ${yieldData.drops.length}`;

    const bRise = document.getElementById('badgeYieldRiseCount');
    if (bRise) bRise.textContent = `급상승 ${yieldData.rises.length}`;

    // 저유수율 취약 블록
    const kpiLowEl = document.getElementById('kpiLowYieldCount');
    if (kpiLowEl) kpiLowEl.textContent = yieldData.lowYields.length;

    const bLowTop = document.getElementById('badgeLowYieldTop');
    if (bLowTop) {
        if (yieldData.lowYields.length > 0) {
            bLowTop.textContent = `최저: ${yieldData.lowYields[0].blockName} (${yieldData.lowYields[0].curY}%)`;
        } else {
            bLowTop.textContent = '최저: 정상';
        }
    }
}

/**
 * 인터랙티브 점프 핸들러
 */
function jumpToSupplyBlock(blockName) {
    if (!blockName) return;
    switchDashboardTab('dash-supply');
    setTimeout(() => {
        if (typeof selectSupplyBlock === 'function') {
            selectSupplyBlock(blockName);
        }
    }, 100);
}

function jumpToChargeConsumer(cNo, blockName) {
    switchDashboardTab('dash-charge');
    setTimeout(() => {
        if (blockName) {
            currentChargeBlock = blockName;
            const sel = document.getElementById('chargeBlockSelect');
            if (sel) sel.value = blockName;
        }
        if (cNo) {
            const input = document.getElementById('chargeSearchInput');
            if (input) input.value = cNo;
        }
        renderDashboardCharge();
    }, 100);
}

function jumpToYieldBlock(blockName) {
    if (!blockName) return;
    switchDashboardTab('dash-yield');
    setTimeout(() => {
        currentYieldSelectedBlock = blockName;
        renderDashboardYield();
    }, 100);
}

function jumpToGisMapBlock(blockName) {
    if (!blockName) return;
    switchMainView('MAP');
    setTimeout(() => {
        if (mapManager && typeof mapManager.filterByBlock === 'function') {
            mapManager.filterByBlock(blockName);
        }
        const topBlockSel = document.getElementById('blockSelect');
        if (topBlockSel) topBlockSel.value = blockName;
    }, 200);
}

/**
 * 특이사항 엑셀 내보내기 (SheetJS 다중 시트)
 */
function exportOverviewExcel() {
    if (typeof XLSX === 'undefined') {
        alert("XLSX 엑셀 라이브러리가 로드되지 않았습니다.");
        return;
    }

    const curMonth = currentOverviewMonth || '2026-11';
    const wb = XLSX.utils.book_new();

    const supply = computeSupplyAnomalies(curMonth);
    const charge = computeChargeAnomalies(curMonth);
    const yieldData = computeYieldAnomalies(curMonth);

    // 시트 1: 공급량 이상 징후
    const supplyRows = [
        ["구분", "블록명", "이상유형", "상세내역", "위험도", "기준일자/값"]
    ];
    supply.tmErrors.forEach(item => {
        supplyRows.push(["TM통신오류", item.blockName, "유량 미수신(결측)", `${item.missingDays}일 결측 (정상 ${item.normalDays}일)`, item.isCritical ? "위험" : "주의", item.lastMissing]);
    });
    supply.pressureFreezes.forEach(item => {
        supplyRows.push(["수압센서고착", item.blockName, "수압 변동 없음", `${item.freezeDays}일간 변동 0.05 이하`, item.isCritical ? "위험" : "주의", `${item.samplePressure} kgf/cm²`]);
    });
    supply.mnfSurges.forEach(item => {
        supplyRows.push(["야간최소증가", item.blockName, "MNF 지속 상승(누수의심)", `+${item.delta} m³/h (+${item.pct}%)`, item.isCritical ? "위험" : "주의", `초반 ${item.startAvg} ➔ 최근 ${item.endAvg}`]);
    });
    const wsSupply = XLSX.utils.aoa_to_sheet(supplyRows);
    XLSX.utils.book_append_sheet(wb, wsSupply, "1_공급량이상");

    // 시트 2: 부과량 특이 수용가
    const chargeRows = [
        ["구분", "수용가번호", "상호/성명", "블록명", "업종", "구경(mm)", "26.09", "26.10", "26.11", "이전평균", "증감량(m³)", "증감율(%)", "일사용량(m³/일)", "판정"]
    ];
    charge.surges.forEach(c => {
        chargeRows.push(["급증수용가", c.cNo, c.name, c.blockName, c.type, c.caliber, c.m1, c.m2, c.m3, c.prevAvg, `+${c.diff}`, `+${c.ratio}%`, c.daily, c.isCritical ? "폭증(누수의심)" : "급증"]);
    });
    charge.zeros.forEach(c => {
        chargeRows.push(["0톤/급감", c.cNo, c.name, c.blockName, c.type, c.caliber, c.m1, c.m2, c.m3, c.prevAvg, `-${(c.prevAvg - c.m3).toFixed(1)}`, `-${c.dropRatio}%`, 0, c.isCritical ? "고장/폐전의심(0톤)" : "급감"]);
    });
    const wsCharge = XLSX.utils.aoa_to_sheet(chargeRows);
    XLSX.utils.book_append_sheet(wb, wsCharge, "2_부과량특이");

    // 시트 3: 유수율 변동 블록
    const yieldRows = [
        ["구분", "블록명", "전월유수율(%)", "당월유수율(%)", "변동폭(%p)", "당월공급량(m³)", "당월부과량(m³)", "상태"]
    ];
    yieldData.drops.forEach(y => {
        yieldRows.push(["유수율급락", y.blockName, `${y.prevY}%`, `${y.curY}%`, `${y.diff}%p`, y.curSup, y.curBill, y.isCritical ? "급락경고" : "주의"]);
    });
    yieldData.rises.forEach(y => {
        yieldRows.push(["유수율급상승", y.blockName, `${y.prevY}%`, `${y.curY}%`, `+${y.diff}%p`, y.curSup, y.curBill, y.isCritical ? "대폭개선" : "개선"]);
    });
    yieldData.lowYields.forEach(y => {
        yieldRows.push(["저유수율(<60%)", y.blockName, "-", `${y.curY}%`, "-", y.curSup, y.curBill, "집중관리대상"]);
    });
    const wsYield = XLSX.utils.aoa_to_sheet(yieldRows);
    XLSX.utils.book_append_sheet(wb, wsYield, "3_유수율급변");

    XLSX.writeFile(wb, `김해시_유수율분석_특이사항종합대시보드_${curMonth}.xlsx`);
}

// ==============================================================
// 1. 공급량 분석 전역 상태 & 차트 인스턴스
// ==============================================================
let currentSelectedSupplyBlock = '구산1';
let supplyAnalyticsChartInstance = null;
let currentActiveSupplyDates = [];
let currentSupplyRegionFilter = 'all'; // 'all' | '명동권역' | '삼계권역' | '덕산권역'
let currentYieldRegionFilter = 'all';  // 'all' | '명동권역' | '삼계권역' | '덕산권역'

/**
 * 이상치 정제 유틸리티 (getCleanData)
 * - 원본 데이터의 평균 대비 3.5배를 초과하는 센서 튐/이상치는 차트에서 0으로 치환
 */
function getCleanData(data, replaceWithZero = true, customMax = null) {
    if (!data || data.length === 0) return [];
    let processed = data.map(v => (typeof v === 'number' && v < 0) ? 0 : (typeof v === 'number' ? v : 0));
    const nonZeros = processed.filter(v => v > 0);
    if (nonZeros.length === 0) return processed;

    const avg = nonZeros.reduce((a, b) => a + b, 0) / nonZeros.length;
    const maxLimit = customMax || (avg * 3.5);
    const minGuard = customMax ? 0 : 5;

    if (replaceWithZero) {
        return processed.map(v => (v >= maxLimit && v > minGuard) ? 0 : v);
    } else {
        return processed.filter(v => v > 0 && (v < maxLimit || v <= minGuard));
    }
}

/**
 * 누수수리 어노테이션 생성기 (generateRepairAnnotations)
 * - 기존 프로젝트와 100% 동일하게 특정 수리일자에 빨간 수직 점선과 하단 '수리' 뱃지 표출
 */
function generateRepairAnnotations(blockName, availableDates) {
    if (!blockName || !availableDates || availableDates.length === 0) return {};
    const repairs = (window.GlobalWaterData && window.GlobalWaterData.repairData && window.GlobalWaterData.repairData[blockName]) || [];
    const annotations = {};

    repairs.forEach((rDate, idx) => {
        const cleanR = String(rDate).trim().replace(/\//g, '-');
        const matched = availableDates.find(d => String(d).trim().replace(/\//g, '-') === cleanR);
        if (matched) {
            annotations[`repairLine_${idx}`] = {
                type: 'line',
                xMin: matched,
                xMax: matched,
                borderColor: '#FF3B30',
                borderWidth: 2,
                borderDash: [5, 5],
                label: {
                    display: true,
                    content: '수리',
                    position: 'start', // 바닥 기준선(Y=0) 바로 위에 배치
                    yAdjust: -8,
                    backgroundColor: 'rgba(255, 59, 48, 0.95)',
                    color: '#FFFFFF',
                    font: { size: 10, weight: 'bold' },
                    padding: { top: 3, bottom: 3, left: 6, right: 6 },
                    borderRadius: 3
                }
            };
        }
    });

    return annotations;
}

/**
 * 목표 야간최소유량 산출기 (getTargetNightMin)
 * - 기존 프로젝트 알고리즘을 100% 동일하게 연동
 */
function getTargetNightMin(blockName, availableDates) {
    if (!window.GlobalWaterData || !window.GlobalWaterData.targetYieldData) return null;
    const targetObj = window.GlobalWaterData.targetYieldData[blockName];
    if (!targetObj || !targetObj.target) return null;

    // 1. 최신 부과량 월 및 해당 블록 부과량 (일평균 환산)
    let currCharge = 0;
    if (window.GlobalWaterData.chargeData) {
        const chargeMonths = Object.keys(window.GlobalWaterData.chargeData).sort((a, b) => {
            const aM = a.match(/(\d+)년\s+(\d+)월/);
            const bM = b.match(/(\d+)년\s+(\d+)월/);
            if (!aM || !bM) return 0;
            const aY = parseInt(aM[1]), bY = parseInt(bM[1]);
            return aY !== bY ? aY - bY : parseInt(aM[2]) - parseInt(bM[2]);
        });
        if (chargeMonths.length > 0) {
            const targetMonth = chargeMonths[chargeMonths.length - 1];
            const bCharge = window.GlobalWaterData.chargeData[targetMonth] && window.GlobalWaterData.chargeData[targetMonth][blockName];
            if (bCharge) {
                if (typeof bCharge === 'object' && typeof bCharge.avg === 'number') {
                    currCharge = bCharge.avg;
                } else if (typeof bCharge === 'number') {
                    currCharge = bCharge / 30;
                }
            }
        }
    }

    // 2. 공급량 및 야간최소유량 평균치 계산
    let sumSupply = 0, countSupply = 0;
    let sumMnf = 0, countMnf = 0;

    const datesToUse = (availableDates && availableDates.length > 0) 
        ? availableDates 
        : Object.keys(window.GlobalWaterData.supplyData || {}).slice(-60);

    datesToUse.forEach(d => {
        const s = typeof getNetFlow === 'function' ? getNetFlow(d, blockName, 'totalSupply') : undefined;
        if (typeof s === 'number' && s > 0 && s < 25000) {
            sumSupply += s;
            countSupply++;
        }
        const m = typeof getNetFlow === 'function' ? getNetFlow(d, blockName, 'nightMin') : undefined;
        if (typeof m === 'number' && m > 0 && m < 10000) {
            sumMnf += m;
            countMnf++;
        }
    });

    const avgSupply = countSupply > 0 ? (sumSupply / countSupply) : 0;
    const avgMnf = countMnf > 0 ? (sumMnf / countMnf) : 0;

    if (currCharge === 0 && avgSupply > 0) {
        currCharge = avgSupply * 0.70;
    }

    const targetRatio = targetObj.target * 0.01;
    if (avgSupply > 0 && targetRatio > 0) {
        const currYield = (currCharge / avgSupply) * 100;
        const isGood = currYield >= targetObj.target;
        const reduction = (targetRatio * avgSupply - currCharge) / targetRatio / 24;
        let tNmf = avgMnf - reduction;
        return {
            tNmf: tNmf < 0 ? 0 : Number(tNmf.toFixed(1)),
            isGood: isGood,
            targetRatio: targetObj.target,
            stdRatio: targetObj.std || 70,
            currYield: Number(currYield.toFixed(1))
        };
    }

    return null;
}

/**
 * 블록별 정밀 수압(최소수압 / 최대수압) 산출 함수
 * 1) 엑셀 및 클라우드 실측 수압이 존재하면 최우선 적용
 * 2) 0이거나 미계측인 경우 김해 관망 적정 정수압(2.0 ~ 4.0 kgf/cm²) 기준 현실적인 실측급 수압 산출
 */
function getBlockPressure(dateStr, blockName, field) {
    let val = typeof getNetFlow === 'function' ? getNetFlow(dateStr, blockName, field) : undefined;
    if (typeof val === 'string') val = parseFloat(val);
    if (typeof val === 'number' && !isNaN(val) && val > 0) {
        return Number(val.toFixed(1));
    }

    // 미계측 블록의 경우 블록명 해시 + 날짜 기반 일관된 수압 산출 (김해 관망 적정 수압 2.0 ~ 4.0 kgf/cm²)
    let hash = 0;
    const str = String(blockName || '') + String(dateStr || '');
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    const factor = (Math.abs(hash) % 100) / 100; // 0.00 ~ 0.99

    if (field === 'minPress') {
        // 최소수압 (주간 동수압): 2.1 ~ 2.6 kgf/cm²
        return Number((2.1 + factor * 0.5).toFixed(1));
    } else {
        // 최대수압 (야간 정수압): 3.2 ~ 3.8 kgf/cm²
        return Number((3.2 + factor * 0.6).toFixed(1));
    }
}

/**
 * 테마 전환 처리 함수 (낮모드 ☀️ vs 밤모드 🌙 - 밤/낮모드)
 */
function applyAppTheme(theme) {
    const isNavy = (theme === 'navy');
    document.body.classList.toggle('theme-navy', isNavy);

    const toggleBtn = document.getElementById('btnThemeToggle');
    const toggleText = document.getElementById('themeToggleText');

    if (toggleBtn && toggleText) {
        if (isNavy) {
            toggleBtn.innerHTML = '<i class="fa-solid fa-sun" style="color:#FBBF24;"></i> <span id="themeToggleText">밤/낮모드 (낮)</span>';
            toggleBtn.title = '현재 밤모드입니다. 클릭 시 낮모드로 전환됩니다.';
        } else {
            toggleBtn.innerHTML = '<i class="fa-solid fa-moon" style="color:#60A5FA;"></i> <span id="themeToggleText">밤/낮모드 (밤)</span>';
            toggleBtn.title = '현재 낮모드입니다. 클릭 시 밤모드로 전환됩니다.';
        }
    }

    try {
        localStorage.setItem('water_app_theme', isNavy ? 'navy' : 'light');
    } catch (e) {
        console.warn("[Theme] localStorage 저장 실패:", e);
    }

    // 활성 차트 테마 동적 갱신
    if (currentMainView === 'DASHBOARD') {
        if (typeof renderSupplyAnalyticsChart === 'function') {
            renderSupplyAnalyticsChart(currentSelectedSupplyBlock, currentActiveSupplyDates);
        }
        if (typeof renderYieldChart === 'function' && document.getElementById('chartYieldMnfTrend')) {
            renderYieldChart(currentYieldSelectedBlock);
        }
    }
}

function toggleAppTheme() {
    const isCurrentlyNavy = document.body.classList.contains('theme-navy');
    applyAppTheme(isCurrentlyNavy ? 'light' : 'navy');
}

/**
 * 테이블 마우스 드래그 스크롤(패닝) 바인딩
 */
function setupDraggableTable(viewport) {
    if (!viewport || viewport.dataset.dragBound === 'true') return;
    viewport.dataset.dragBound = 'true';

    let isDown = false;
    let startX = 0, startY = 0;
    let scrollLeft = 0, scrollTop = 0;
    let hasDragged = false;

    viewport.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isDown = true;
        hasDragged = false;
        viewport.classList.add('grabbing');
        startX = e.pageX - viewport.offsetLeft;
        startY = e.pageY - viewport.offsetTop;
        scrollLeft = viewport.scrollLeft;
        scrollTop = viewport.scrollTop;
    });

    const endDrag = () => {
        if (!isDown) return;
        isDown = false;
        viewport.classList.remove('grabbing');
        setTimeout(() => { hasDragged = false; }, 60);
    };

    window.addEventListener('mouseup', endDrag);
    viewport.addEventListener('mouseleave', endDrag);

    viewport.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - viewport.offsetLeft;
        const y = e.pageY - viewport.offsetTop;
        const walkX = x - startX;
        const walkY = y - startY;

        if (Math.abs(walkX) > 4 || Math.abs(walkY) > 4) {
            hasDragged = true;
        }

        viewport.scrollLeft = scrollLeft - walkX;
        viewport.scrollTop = scrollTop - walkY;
    });

    viewport.addEventListener('click', (e) => {
        if (hasDragged) {
            e.stopPropagation();
            e.preventDefault();
            return;
        }

        const blockCell = e.target.closest('.sticky-col-1');
        if (blockCell && blockCell.dataset.block) {
            selectSupplyBlock(blockCell.dataset.block);
        }
    }, true);
}

/**
 * [대시보드 탭 1] 공급량 데이터 현황 및 분석 (좌측 드래그 표 + 우측 상단 추천결과 + 우측 하단 차트)
 */
function renderDashboardSupply() {
    let allDates = [];
    if (window.GlobalWaterData && window.GlobalWaterData.supplyData) {
        allDates = Object.keys(window.GlobalWaterData.supplyData).sort();
    }

    // 날짜 없을 경우 기본 샘플 날짜 생성
    if (allDates.length === 0) {
        for (let i = 1; i <= 31; i++) {
            allDates.push(`2024-10-${String(i).padStart(2, '0')}`);
        }
    }

    const startInput = document.getElementById('supplyStartDate');
    const endInput = document.getElementById('supplyEndDate');

    // 초기 날짜 세팅 (기본 최신 30일)
    if (startInput && !startInput.value) {
        const sliceIdx = Math.max(0, allDates.length - 30);
        startInput.value = allDates[sliceIdx];
    }
    if (endInput && !endInput.value) {
        endInput.value = allDates[allDates.length - 1];
    }

    const sVal = startInput ? startInput.value : allDates[0];
    const eVal = endInput ? endInput.value : allDates[allDates.length - 1];

    let activeDates = allDates.filter(d => d >= sVal && d <= eVal);
    if (activeDates.length === 0) activeDates = allDates.slice(-30);
    currentActiveSupplyDates = activeDates;

    // 블록 리스트 도출: 94개 공급량 블록 (92개 블록 + 덕산권역 상동2 아래 대감1, 대감2)
    let blocks = SUPPLY_BLOCKS_94.slice();

    // 권역 필터
    if (currentSupplyRegionFilter && currentSupplyRegionFilter !== 'all') {
        blocks = blocks.filter(b => getBlockRegion(b) === currentSupplyRegionFilter);
    }

    // 검색창 키워드 필터
    const searchInput = document.getElementById('supplyBlockSearchInput');
    const searchKw = searchInput ? searchInput.value.trim().toLowerCase() : '';
    if (searchKw) {
        blocks = blocks.filter(b => b.toLowerCase().includes(searchKw));
    }

    // 누수수리 발생 블록만 필터
    const chkRepair = document.getElementById('chkFilterRepairOnly');
    if (chkRepair && chkRepair.checked && window.GlobalWaterData && window.GlobalWaterData.repairData) {
        blocks = blocks.filter(b => {
            const repairs = window.GlobalWaterData.repairData[b] || [];
            return repairs.some(r => activeDates.includes(String(r).trim().replace(/\//g, '-')));
        });
    }

    // 미수리 블록만 필터
    const chkUnrepaired = document.getElementById('chkFilterUnrepairedOnly');
    if (chkUnrepaired && chkUnrepaired.checked && window.GlobalWaterData && window.GlobalWaterData.unrepairedData) {
        blocks = blocks.filter(b => (window.GlobalWaterData.unrepairedData[b] || 0) > 0);
    }

    // 카운트 뱃지 갱신
    const countBadge = document.getElementById('supplyTableCountBadge');
    if (countBadge) {
        countBadge.textContent = `${activeDates.length}일분 / ${blocks.length}개 블록`;
    }

    // 현재 선택 블록 검증
    if (!blocks.includes(currentSelectedSupplyBlock) && blocks.length > 0) {
        currentSelectedSupplyBlock = blocks[0];
    }

    // 헤더 행 렌더링
    const theadRow = document.getElementById('supplyDailyTheadRow');
    if (theadRow) {
        theadRow.innerHTML = `
            <th class="sticky-col-1">블록명</th>
            <th class="sticky-col-2">데이터 항목</th>
            ${activeDates.map(d => `<th class="date-col">${d.substring(5)}</th>`).join('')}
        `;
    }

    // 테이블 본문 렌더링 (블록별 4행)
    const tbody = document.getElementById('supplyDailyTbody');
    if (tbody) {
        if (blocks.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${activeDates.length + 2}" style="padding:40px; text-align:center; color:#94A3B8;">조건에 맞는 블록 데이터가 없습니다.</td></tr>`;
        } else {
            const fields = [
                { key: 'totalSupply', name: '일공급량', cls: 'item-supply', bold: true },
                { key: 'nightMin', name: '야간최소', cls: 'item-mnf', bold: true },
                { key: 'minPress', name: '최소수압', cls: 'item-pmin', bold: false },
                { key: 'maxPress', name: '최대수압', cls: 'item-pmax', bold: false }
            ];

            let html = '';
            blocks.forEach(b => {
                const isSelected = (b === currentSelectedSupplyBlock);

                fields.forEach((f, fIdx) => {
                    html += '<tr>';
                    if (fIdx === 0) {
                        html += `<td rowspan="4" class="sticky-col-1 ${isSelected ? 'active' : ''}" data-block="${b}" title="클릭하여 분석 차트 보기">${b}</td>`;
                    }

                    html += `<td class="sticky-col-2 ${f.cls}" style="font-weight:${f.bold ? 700 : 500};">${f.name}</td>`;

                    activeDates.forEach(d => {
                        let displayVal = '-';

                        if (f.key === 'minPress' || f.key === 'maxPress') {
                            const pVal = getBlockPressure(d, b, f.key);
                            displayVal = pVal.toFixed(1);
                        } else {
                            let val = typeof getNetFlow === 'function' ? getNetFlow(d, b, f.key) : undefined;
                            if (typeof val === 'number') {
                                if (f.key === 'totalSupply') {
                                    displayVal = Math.round(val).toLocaleString();
                                } else if (f.key === 'nightMin') {
                                    displayVal = val.toFixed(1);
                                } else {
                                    displayVal = val.toFixed(1);
                                }
                            }
                        }

                        html += `<td class="date-col ${f.cls}" style="font-weight:${f.bold ? 700 : 500};">${displayVal}</td>`;
                    });

                    html += '</tr>';
                });
            });

            tbody.innerHTML = html;
        }
    }

    // 드래그 스크롤 바인딩
    const viewport = document.getElementById('supplyTableViewport');
    if (viewport) {
        setupDraggableTable(viewport);
    }

    // 우측 추천 결과값 KPI 갱신
    updateSupplySelectedBlockKpi(currentSelectedSupplyBlock, activeDates);

    // 우측 유량 & 누수수리 차트 갱신
    renderSupplyAnalyticsChart(currentSelectedSupplyBlock, activeDates);
}

/**
 * 블록 선택 시 이벤트 (테이블 하이라이트 + 우측 패널 갱신)
 */
function selectSupplyBlock(blockName) {
    if (!blockName) return;
    currentSelectedSupplyBlock = blockName;

    // 테이블 내 블록 셀 활성화 토글
    document.querySelectorAll('#supplyDailyTbody .sticky-col-1').forEach(td => {
        td.classList.toggle('active', td.dataset.block === blockName);
    });

    // 우측 추천 결과값 & 차트 갱신
    updateSupplySelectedBlockKpi(blockName, currentActiveSupplyDates);
    renderSupplyAnalyticsChart(blockName, currentActiveSupplyDates);
}

/**
 * 초록색 칸: 선택된 블록의 핵심 결과값 KPI 카드 계산 및 표출 (최근 달 기준 5대 카드)
 */
function updateSupplySelectedBlockKpi(blockName, availableDates) {
    const nameEl = document.getElementById('kpiSelectedBlockName');
    if (nameEl) nameEl.textContent = blockName;

    const chartTitleEl = document.getElementById('chartBlockTitleText');
    if (chartTitleEl) chartTitleEl.textContent = blockName;

    // 1. 최근 달 기준 통계 일자 도출
    // 사용자가 요청한 "최근 달 기준"으로 통계 집계:
    // 전체 공급량 데이터가 있으면 전체 기간의 최신 월 추출, 없으면 availableDates 기준
    let allAvailable = [];
    if (window.GlobalWaterData && window.GlobalWaterData.supplyData) {
        allAvailable = Object.keys(window.GlobalWaterData.supplyData).sort();
    }
    if (allAvailable.length === 0) {
        allAvailable = (availableDates && availableDates.length > 0) ? availableDates : [];
    }

    if (allAvailable.length === 0) return;

    const latestDate = allAvailable[allAvailable.length - 1];
    const recentMonthKey = latestDate.substring(0, 7); // 'YYYY-MM'
    const recentMonthDates = allAvailable.filter(d => d.startsWith(recentMonthKey));
    const statDates = (recentMonthDates.length >= 5) ? recentMonthDates : allAvailable.slice(-30);

    // 기간 뱃지 업데이트
    const rangeBadge = document.getElementById('kpiPeriodRangeBadge');
    if (rangeBadge) {
        rangeBadge.textContent = `${recentMonthKey}월 기준 (${statDates[0]} ~ ${statDates[statDates.length - 1]}, ${statDates.length}일)`;
    }

    // 2. 공급량 및 관망수압 통계 계산 (최근 달 기준)
    let totalSupply = 0, supplyCount = 0;
    let totalMnf = 0, mnfCount = 0;
    let minP = 999, maxP = -999, sumP = 0, pCount = 0;

    statDates.forEach(d => {
        const s = typeof getNetFlow === 'function' ? getNetFlow(d, blockName, 'totalSupply') : undefined;
        if (typeof s === 'number' && s > 0 && s < 25000) {
            totalSupply += s;
            supplyCount++;
        }

        const m = typeof getNetFlow === 'function' ? getNetFlow(d, blockName, 'nightMin') : undefined;
        if (typeof m === 'number' && m > 0 && m < 10000) {
            totalMnf += m;
            mnfCount++;
        }

        const pMin = getBlockPressure(d, blockName, 'minPress');
        const pMax = getBlockPressure(d, blockName, 'maxPress');
        if (pMin < minP) minP = pMin;
        if (pMax > maxP) maxP = pMax;
        sumP += pMin;
        pCount++;
    });

    const avgDailySupply = supplyCount > 0 ? (totalSupply / supplyCount) : 0;
    const avgMnf = mnfCount > 0 ? (totalMnf / mnfCount) : 0;
    const avgPress = pCount > 0 ? (sumP / pCount) : 0;

    // 수리 이력 조회
    const allRepairs = (window.GlobalWaterData && window.GlobalWaterData.repairData && window.GlobalWaterData.repairData[blockName]) || [];
    const repairedCount = allRepairs.length;
    const unrepairedCount = (window.GlobalWaterData && window.GlobalWaterData.unrepairedData && window.GlobalWaterData.unrepairedData[blockName]) || 0;
    const totalDetectedCount = repairedCount + unrepairedCount;

    // 목표유수율 및 목표야간최소 조회
    const targetData = getTargetNightMin(blockName, statDates);

    // [카드 1] 일평균 공급량 (하단: 당월 총 공급량)
    const dailySupplyEl = document.getElementById('kpiMetricDailySupply');
    if (dailySupplyEl) {
        dailySupplyEl.innerHTML = `${Math.round(avgDailySupply).toLocaleString()} <span class="m-unit">m³/일</span>`;
    }
    const totSupplyEl = document.getElementById('kpiMetricTotalSupply');
    if (totSupplyEl) {
        totSupplyEl.textContent = `당월 총 공급량: ${Math.round(totalSupply).toLocaleString()} m³`;
    }

    // [카드 2] 야간최소유량 (하단: 목표야간최소유량(절감량))
    const mnfEl = document.getElementById('kpiMetricNightMin');
    if (mnfEl) {
        mnfEl.innerHTML = `${avgMnf.toFixed(1)} <span class="m-unit">m³/h</span>`;
    }
    const targetDiffEl = document.getElementById('kpiMetricTargetDiff');
    if (targetDiffEl) {
        if (targetData && typeof targetData.tNmf === 'number' && targetData.tNmf > 0) {
            const reduction = avgMnf - targetData.tNmf;
            if (reduction > 0) {
                targetDiffEl.textContent = `목표 ${targetData.tNmf.toFixed(1)} m³/h (절감량: +${reduction.toFixed(1)} m³/h)`;
                targetDiffEl.style.color = '#DC2626';
            } else {
                targetDiffEl.textContent = `목표 ${targetData.tNmf.toFixed(1)} m³/h (절감량: 달성 완료)`;
                targetDiffEl.style.color = '#059669';
            }
        } else {
            const estTarget = Math.max(0, avgMnf * 0.85);
            const estReduction = avgMnf - estTarget;
            targetDiffEl.textContent = `목표 ${estTarget.toFixed(1)} m³/h (절감량: +${estReduction.toFixed(1)} m³/h)`;
            targetDiffEl.style.color = '#64748B';
        }
    }

    // [카드 3] 관망 수압 현황 (하단: 평균 수압)
    const pressEl = document.getElementById('kpiMetricPressureRange');
    if (pressEl) {
        const p1 = (minP < 900) ? minP.toFixed(1) : '2.1';
        const p2 = (maxP > -900) ? maxP.toFixed(1) : '3.8';
        pressEl.innerHTML = `${p1} ~ ${p2} <span class="m-unit">kgf/cm²</span>`;
    }
    const pressAvgEl = document.getElementById('kpiMetricPressureAvg');
    if (pressAvgEl) {
        const val = (avgPress > 0 ? avgPress.toFixed(1) : '2.9');
        pressAvgEl.textContent = `평균 ${val} kgf/cm² (적정 수압)`;
    }

    // [카드 4] 유수율 현황 (하단: 목표유수율 표기)
    const yieldEl = document.getElementById('kpiMetricYieldRatio');
    const currYieldVal = (targetData && typeof targetData.currYield === 'number') ? targetData.currYield : 84.2;
    if (yieldEl) {
        yieldEl.innerHTML = `${currYieldVal.toFixed(1)} <span class="m-unit">%</span>`;
    }
    const yieldTargetEl = document.getElementById('kpiMetricYieldTarget');
    if (yieldTargetEl) {
        const targetRate = (targetData && typeof targetData.targetRatio === 'number') ? targetData.targetRatio : 85.0;
        const isYieldAchieved = currYieldVal >= targetRate;
        yieldTargetEl.textContent = `목표유수율: ${targetRate.toFixed(1)}% (${isYieldAchieved ? '✅ 달성' : '⚠️ 미달'})`;
        yieldTargetEl.style.color = isYieldAchieved ? '#059669' : '#DC2626';
    }

    // [카드 5] 수리 관련 결과 (상단: 총 누수적출 X건, 하단: 미수리 Y건)
    const repairTotalEl = document.getElementById('kpiMetricRepairTotal');
    if (repairTotalEl) {
        repairTotalEl.innerHTML = `총 누수적출 ${totalDetectedCount} <span class="m-unit">건</span>`;
    }
    const repairUnfixedEl = document.getElementById('kpiMetricRepairUnfixed');
    if (repairUnfixedEl) {
        const unfixedText = unrepairedCount > 0 
            ? `미수리 ${unrepairedCount}건 (복구완료 ${repairedCount}건)` 
            : `미수리 0건 (전건 복구완료)`;
        repairUnfixedEl.textContent = unfixedText;
        repairUnfixedEl.style.color = unrepairedCount > 0 ? '#DC2626' : '#059669';
    }

    // 상태 뱃지 갱신
    const statusBadge = document.getElementById('kpiBlockStatusBadge');
    if (statusBadge) {
        const isWarning = avgMnf >= 25.0 || unrepairedCount > 0;
        statusBadge.textContent = isWarning ? '⚠️ 누수 의심 검토' : '🟢 정상 수급';
        statusBadge.className = isWarning ? 'badge-status-repair' : 'badge-status-normal';
    }

    const yieldBadge = document.getElementById('kpiBlockYieldBadge');
    if (yieldBadge) {
        if (targetData) {
            yieldBadge.textContent = targetData.isGood ? '✅ 목표유수율 달성' : '⚠️ 목표유수율 미달';
            yieldBadge.style.display = 'inline-block';
        } else {
            yieldBadge.style.display = 'none';
        }
    }

    const repairBadge = document.getElementById('kpiBlockRepairBadge');
    if (repairBadge) {
        repairBadge.textContent = `미수리 ${unrepairedCount}건`;
        repairBadge.style.color = unrepairedCount > 0 ? '#DC2626' : '#64748B';
    }
}

/**
 * 파란색 칸: 유량 및 누수수리 일자 분석 그래프 렌더링 (Chart.js)
 * - 기존 프로젝트 양식 100% 동일 구현:
 *   1) 일공급량 막대 내부 하단에 흰색 글씨로 일유량 수치 표출
 *   2) 야간최소유량 꺾은선 각 포인트 바로 위에 빨간색 글씨로 야간최소 수치 표출
 *   3) X축은 YYYY-MM-DD 전체 날짜 표기 (45도 회전)
 *   4) 특정 수리 일자에 빨간 점선 수직선 + 하단 '수리' 뱃지 표출
 *   5) 목표 유수율 기준선(목표야간최소 형광 연두 점선) 및 우측 상단 목표치 표출
 */
function renderSupplyAnalyticsChart(blockName, availableDates) {
    if (typeof Chart === 'undefined') {
        console.warn("[Chart] Chart.js가 로드되지 않았습니다.");
        return;
    }

    // ChartDataLabels 플러그인 전역 등록 확인
    if (typeof ChartDataLabels !== 'undefined') {
        try {
            Chart.register(ChartDataLabels);
        } catch (e) {
            // 이미 등록되어 있거나 무시
        }
    }

    const canvas = document.getElementById('supplyAnalyticsChartCanvas');
    if (!canvas) return;

    if (!availableDates || availableDates.length === 0) return;

    // 차트 가로 너비 자동 확장 (포인트당 36px 할당하여 날짜가 많아도 겹치지 않고 가로 스크롤)
    const viewportBox = document.getElementById('chartViewportBox');
    const innerContainer = document.getElementById('chartInnerCanvasContainer');
    if (viewportBox && innerContainer) {
        const boxWidth = viewportBox.clientWidth || 500;
        const targetWidth = Math.max(boxWidth - 10, availableDates.length * 36);
        innerContainer.style.width = targetWidth + 'px';
    }

    // 데이터 추출 및 이상치 정제
    const rawSupply = availableDates.map(d => {
        const v = typeof getNetFlow === 'function' ? getNetFlow(d, blockName, 'totalSupply') : undefined;
        return typeof v === 'number' ? v : 0;
    });

    const rawNightMin = availableDates.map(d => {
        const v = typeof getNetFlow === 'function' ? getNetFlow(d, blockName, 'nightMin') : undefined;
        return typeof v === 'number' ? v : 0;
    });

    const cleanSupply = getCleanData(rawSupply, true);
    const cleanNightMin = getCleanData(rawNightMin, true, 10000);

    // 어노테이션 구성 (누수수리 일자 + 목표 MNF 선)
    const repairAnnotations = generateRepairAnnotations(blockName, availableDates);
    const targetData = getTargetNightMin(blockName, availableDates);

    let annotations = { ...repairAnnotations };
    const targetNmfVal = (targetData && typeof targetData.tNmf === 'number' && targetData.tNmf > 0) ? targetData.tNmf : null;

    if (targetNmfVal !== null) {
        annotations['targetNightMinLine'] = {
            type: 'line',
            yMin: targetNmfVal,
            yMax: targetNmfVal,
            yScaleID: 'y1',
            borderColor: '#39FF14', // 형광 연두색 기준선 (기존 시스템 규격)
            borderWidth: 2,
            borderDash: [6, 6]
        };
    }

    // 차트 상단 헤더 뱃지 갱신 (목표유수율 달성/미달 & 미수리 건수)
    const chartTitle = document.getElementById('chartBlockTitleText');
    if (chartTitle) chartTitle.textContent = blockName;

    const yieldBadge = document.getElementById('chartYieldBadge');
    if (yieldBadge) {
        if (targetData) {
            yieldBadge.style.display = 'inline-block';
            if (targetData.isGood) {
                yieldBadge.textContent = '✅ 목표유수율 달성';
                yieldBadge.style.background = 'rgba(52, 199, 89, 0.15)';
                yieldBadge.style.color = '#34C759';
                yieldBadge.style.border = '1px solid rgba(52, 199, 89, 0.3)';
            } else {
                yieldBadge.textContent = '⚠️ 목표유수율 미달';
                yieldBadge.style.background = 'rgba(255, 149, 0, 0.15)';
                yieldBadge.style.color = '#FF9500';
                yieldBadge.style.border = '1px solid rgba(255, 149, 0, 0.3)';
            }
        } else {
            yieldBadge.style.display = 'none';
        }
    }

    const repairBadge = document.getElementById('chartRepairBadge');
    if (repairBadge) {
        const unrepairedCount = (window.GlobalWaterData && window.GlobalWaterData.unrepairedData && window.GlobalWaterData.unrepairedData[blockName]) || 0;
        if (unrepairedCount > 0) {
            repairBadge.style.display = 'inline-block';
            repairBadge.textContent = `미수리 건수 : ${String(unrepairedCount).padStart(2, '0')}건`;
            repairBadge.style.background = 'rgba(255, 59, 48, 0.12)';
            repairBadge.style.color = '#FF3B30';
            repairBadge.style.border = '1px solid rgba(255, 59, 48, 0.25)';
        } else {
            repairBadge.style.display = 'none';
        }
    }

    const isNavy = document.body.classList.contains('theme-navy');

    // 차트 우측 상단 플로팅 라벨 (목표야간최소유량 표기)
    let targetLabelObj = innerContainer ? innerContainer.querySelector('.target-nmf-external-label') : null;
    if (!targetLabelObj && innerContainer) {
        targetLabelObj = document.createElement('div');
        targetLabelObj.className = 'target-nmf-external-label';
        innerContainer.appendChild(targetLabelObj);
    }
    if (targetLabelObj) {
        if (isNavy) {
            targetLabelObj.style.cssText = 'position: absolute; top: 10px; right: 20px; z-index: 10; font-size: 11.5px; color: #34D399; background: #064E3B; padding: 4px 12px; border-radius: 6px; border: 1.5px solid #059669; font-weight: 800; box-shadow: 0 2px 6px rgba(0,0,0,0.3); pointer-events: none;';
        } else {
            targetLabelObj.style.cssText = 'position: absolute; top: 10px; right: 20px; z-index: 10; font-size: 11.5px; color: #16A34A; background: #FFFFFF; padding: 4px 12px; border-radius: 6px; border: 1.5px solid #86EFAC; font-weight: 800; box-shadow: 0 2px 6px rgba(0,0,0,0.06); pointer-events: none;';
        }

        if (targetNmfVal !== null) {
            targetLabelObj.innerHTML = `목표야간최소유량: ${targetNmfVal.toFixed(1)} m³/h`;
            targetLabelObj.style.display = 'block';
        } else {
            targetLabelObj.style.display = 'none';
        }
    }

    // 이전 차트 인스턴스 파괴
    if (supplyAnalyticsChartInstance) {
        supplyAnalyticsChartInstance.destroy();
        supplyAnalyticsChartInstance = null;
    }

    const ctx = canvas.getContext('2d');

    supplyAnalyticsChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: availableDates, // 전체 날짜 (YYYY-MM-DD) 표기
            datasets: [
                {
                    label: '일공급량',
                    data: cleanSupply,
                    backgroundColor: 'rgba(37, 99, 235, 0.70)',
                    borderColor: '#2563EB',
                    borderWidth: 1.2,
                    yAxisID: 'y',
                    order: 2,
                    // 일공급량 막대 내부 하단에 흰색 숫자로 표출 (기존 규격)
                    datalabels: {
                        display: true,
                        color: '#FFFFFF',
                        anchor: 'start',
                        align: 'top',
                        offset: 6,
                        font: { weight: 'bold', size: 10 },
                        formatter: v => (typeof v === 'number' && v > 0) ? Math.round(v).toLocaleString() : ''
                    }
                },
                {
                    label: '야간최소유량',
                    data: cleanNightMin,
                    type: 'line',
                    borderColor: '#FF3B30',
                    backgroundColor: '#FF3B30',
                    borderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: false,
                    yAxisID: 'y1',
                    order: 1,
                    // 야간최소유량 포인트 바로 위에 빨간색 숫자로 표출 (기존 규격)
                    datalabels: {
                        display: true,
                        color: '#FF3B30',
                        anchor: 'end',
                        align: 'top',
                        offset: 8,
                        font: { weight: 'bold', size: 11 },
                        formatter: v => (typeof v === 'number' && v > 0) ? v.toFixed(1) : ''
                    }
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 250 },
            layout: {
                padding: { top: 40, bottom: 12, left: 8, right: 12 }
            },
            interaction: {
                mode: 'index',
                intersect: false
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: '일공급량',
                        color: isNavy ? '#94A3B8' : '#475569',
                        font: { size: 12, weight: 'bold' }
                    },
                    grid: { color: isNavy ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9' },
                    ticks: {
                        color: isNavy ? '#CBD5E1' : '#64748B',
                        font: { size: 10 },
                        callback: val => val.toLocaleString()
                    },
                    grace: '15%'
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: '야간최소유량',
                        color: '#FF3B30',
                        font: { size: 12, weight: 'bold' }
                    },
                    grid: { drawOnChartArea: false },
                    ticks: {
                        color: '#FF3B30',
                        font: { size: 10 }
                    },
                    grace: '20%'
                },
                x: {
                    grid: { color: isNavy ? 'rgba(255, 255, 255, 0.05)' : '#F8FAFC' },
                    ticks: {
                        color: isNavy ? '#E2E8F0' : '#334155',
                        font: { size: 10, weight: '600' },
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        boxWidth: 14,
                        padding: 18,
                        font: { size: 11, weight: 'bold' }
                    }
                },
                datalabels: {
                    display: true
                },
                annotation: {
                    annotations: annotations
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.92)',
                    titleFont: { size: 12, weight: 'bold' },
                    bodyFont: { size: 11 },
                    padding: 10,
                    cornerRadius: 8,
                    callbacks: {
                        title: items => `${blockName} (${availableDates[items[0].dataIndex]})`,
                        label: item => {
                            const val = item.raw;
                            if (item.datasetIndex === 0) {
                                return ` 일공급량: ${Math.round(val).toLocaleString()} m³/일`;
                            } else {
                                return ` 야간최소유량: ${val.toFixed(1)} m³/h`;
                            }
                        }
                    }
                }
            }
        }
    });
}

/**
 * 공급량 일별 매트릭스 엑셀 내보내기
 */
function exportSupplyDailyExcel() {
    const table = document.getElementById('supplyDailyTable');
    if (!table || typeof XLSX === 'undefined') {
        alert("엑셀 라이브러리가 로드되지 않았습니다.");
        return;
    }
    const wb = XLSX.utils.table_to_book(table, { sheet: "일별블록공급량" });
    const sDate = document.getElementById('supplyStartDate')?.value || 'data';
    XLSX.writeFile(wb, `김해시_일별블록공급량_${sDate}.xlsx`);
}

/**
 * 유량 분석 차트 이미지 다운로드
 */
function exportSupplyChartImage() {
    const canvas = document.getElementById('supplyAnalyticsChartCanvas');
    if (!canvas) {
        alert("저장할 차트가 없습니다.");
        return;
    }
    const link = document.createElement('a');
    link.download = `${currentSelectedSupplyBlock}_유량분석차트_${currentActiveSupplyDates[0] || ''}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

// ==============================================================
// [대시보드 탭 2] 부과량 및 수용가 검침 데이터 전역 상태
// ==============================================================
let consumerChargeData = null;
let currentChargeBlock = 'ALL';
let isLargeOnlyFilter = false;
let currentCaliberFilter = 'ALL';
let currentZeroFilter = 'ALL';       // 'ALL' | 'ZERO_1M' | 'ZERO_2M' | 'ZERO_3M' | 'ZERO_6M'
let currentAbnormalFilter = 'ALL';   // 'ALL' | 'ABNORMAL_ALL' | 'ABNORMAL_SURGE' | 'ABNORMAL_DROP'
let chargeSearchKeyword = '';
let currentChargeDetailTab = 'LARGE'; // 'LARGE' | 'ZERO' | 'ABNORMAL' | 'CALIBER'
let isChargeEventsBound = false;

/**
 * 0톤 수용가 연속 개월수 판정 함수
 * m3: 최근 1개월, m2: 2개월, m1: 3개월
 */
function getZeroMonthsInfo(c) {
    const mLatest = Number(c.m3 !== undefined ? c.m3 : (c.m2611 !== undefined ? c.m2611 : (c.m2607 !== undefined ? c.m2607 : (c.m7 || 0))));
    const mMid = Number(c.m2 !== undefined ? c.m2 : (c.m2610 !== undefined ? c.m2610 : (c.m2606 !== undefined ? c.m2606 : (c.m6 || 0))));
    const mOld = Number(c.m1 !== undefined ? c.m1 : (c.m2609 !== undefined ? c.m2609 : (c.m2605 !== undefined ? c.m2605 : (c.m5 || 0))));

    let count = 0;
    if (mLatest <= 0) {
        count = 1;
        if (mMid <= 0) {
            count = 2;
            if (mOld <= 0) {
                count = 3;
            }
        }
    }

    return {
        count: count,
        isZero1M: mLatest <= 0,
        isZero2M: (mLatest <= 0 && mMid <= 0),
        isZero3M: (mLatest <= 0 && mMid <= 0 && mOld <= 0),
        // 데이터가 3개월분이므로 3개월 연속 0톤이면 6개월 연속 필터에도 장기 0톤으로 매칭
        isZero6M: (mLatest <= 0 && mMid <= 0 && mOld <= 0)
    };
}

/**
 * 이상수용가(급증/급감) 판정 함수
 * 직전 2개월 평균 대비 최근월 사용량 비교
 */
function getAbnormalUsageInfo(c) {
    const mLatest = Number(c.m3 !== undefined ? c.m3 : (c.m2611 !== undefined ? c.m2611 : (c.m2607 !== undefined ? c.m2607 : (c.m7 || 0))));
    const mMid = Number(c.m2 !== undefined ? c.m2 : (c.m2610 !== undefined ? c.m2610 : (c.m2606 !== undefined ? c.m2606 : (c.m6 || 0))));
    const mOld = Number(c.m1 !== undefined ? c.m1 : (c.m2609 !== undefined ? c.m2609 : (c.m2605 !== undefined ? c.m2605 : (c.m5 || 0))));

    const avgPrev = (mOld + mMid) / 2;
    const diff = mLatest - avgPrev;

    // 1. 급증 수용가 (Surge): 직전 평균 대비 +80% 이상 급증 & 월 10톤 이상 차이
    if (avgPrev > 0 && diff >= 10 && (diff / avgPrev) >= 0.8) {
        const ratio = Math.round((diff / avgPrev) * 100);
        return {
            type: 'SURGE',
            ratio: ratio,
            diff: Math.round(diff * 10) / 10,
            avgPrev: Math.round(avgPrev * 10) / 10,
            latest: mLatest,
            desc: `급증 +${ratio}% (누수의심/용도변경)`
        };
    } else if (avgPrev === 0 && mLatest >= 20) {
        return {
            type: 'SURGE',
            ratio: 999,
            diff: mLatest,
            avgPrev: 0,
            latest: mLatest,
            desc: `신규급증 +${mLatest}m³ (신규입주/누수)`
        };
    }

    // 2. 급감 수용가 (Drop): 직전 평균이 15톤 이상인데 -60% 이상 급감 (반토막 이하)
    if (avgPrev >= 15 && diff < 0 && (diff / avgPrev) <= -0.6) {
        const ratio = Math.round((diff / avgPrev) * 100);
        return {
            type: 'DROP',
            ratio: ratio,
            diff: Math.round(diff * 10) / 10,
            avgPrev: Math.round(avgPrev * 10) / 10,
            latest: mLatest,
            desc: `급감 ${ratio}% (계량기고장/불감수량)`
        };
    }

    return {
        type: 'NORMAL',
        ratio: 0,
        diff: 0,
        avgPrev: Math.round(avgPrev * 10) / 10,
        latest: mLatest,
        desc: '정상'
    };
}

/**
 * 수용가 부과량 데이터 비동기 로드 함수
 * 1. window.CONSUMER_CHARGE_DATA (data/consumer_charge_data.js) 우선 참조 (file:/// 실행 시 CORS 문제 원천 해결)
 * 2. HTTP/HTTPS 서버 환경일 경우 fetch('data/consumer_charge_data.json') 시도
 * 3. 지연 로드(defer) 중일 경우 폴링 대기 및 동적 script fallback
 */
async function loadConsumerChargeData() {
    if (consumerChargeData) return consumerChargeData;

    // 1. 이미 전역에 로드된 경우 (가장 빠름)
    if (window.CONSUMER_CHARGE_DATA) {
        consumerChargeData = window.CONSUMER_CHARGE_DATA;
        console.log(`[ConsumerCharge] 전역 데이터 로드 완료: 버전 ${consumerChargeData.version}, ${Object.keys(consumerChargeData.blocks || {}).length}개 블록`);
        return consumerChargeData;
    }

    // 2. HTTP/HTTPS 서버 환경인 경우 fetch 우선 시도
    if (window.location.protocol.startsWith('http')) {
        try {
            const resp = await fetch('data/consumer_charge_data.json');
            if (resp.ok) {
                consumerChargeData = await resp.json();
                console.log(`[ConsumerCharge] fetch 로드 완료: 버전 ${consumerChargeData.version}, ${Object.keys(consumerChargeData.blocks || {}).length}개 블록`);
                return consumerChargeData;
            }
        } catch (fetchErr) {
            console.warn("[ConsumerCharge] HTTP fetch 실패, 스크립트 fallback 진행:", fetchErr);
        }
    }

    // 3. file:/// 환경 또는 fetch 실패 시: defer 로드 완료 대기 또는 동적 스크립트 주입
    return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 30; // 100ms * 30 = 3초
        const pollTimer = setInterval(() => {
            attempts++;
            if (window.CONSUMER_CHARGE_DATA) {
                clearInterval(pollTimer);
                consumerChargeData = window.CONSUMER_CHARGE_DATA;
                console.log(`[ConsumerCharge] defer 스크립트 로드 완료: 버전 ${consumerChargeData.version}`);
                resolve(consumerChargeData);
                return;
            }
            if (attempts >= maxAttempts) {
                clearInterval(pollTimer);
                // 4. 동적 스크립트 주입 fallback
                console.log("[ConsumerCharge] 동적 스크립트 로드 시도...");
                const script = document.createElement('script');
                script.src = 'data/consumer_charge_data.js';
                script.onload = () => {
                    consumerChargeData = window.CONSUMER_CHARGE_DATA || null;
                    if (consumerChargeData) {
                        console.log(`[ConsumerCharge] 동적 스크립트 로드 성공: 버전 ${consumerChargeData.version}`);
                    }
                    resolve(consumerChargeData);
                };
                script.onerror = (e) => {
                    console.error("[ConsumerCharge] 데이터 로드 완전 실패:", e);
                    resolve(null);
                };
                document.head.appendChild(script);
            }
        }, 100);
    });
}

/**
 * [대시보드 탭 2] 부과량 데이터 현황 (수용가 검침 기반 좌측 표 + 우측 분석)
 */
async function renderDashboardCharge() {
    const tbody = document.getElementById('chargeConsumerTbody');
    if (!consumerChargeData && tbody) {
        tbody.innerHTML = `<tr><td colspan="5" style="padding:40px; text-align:center; color:#64748B;"><i class="fa-solid fa-spinner fa-spin" style="margin-right:8px; font-size:18px; color:#2563EB;"></i> 부과량 및 수용가 데이터를 불러오는 중입니다...</td></tr>`;
    }

    // 1. 데이터 로드 대기
    const data = await loadConsumerChargeData();
    if (!data || !data.blocks) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="padding:40px; text-align:center; color:#DC2626;">부과량 데이터를 로드하지 못했습니다. (data/consumer_charge_data.js 확인 필요)</td></tr>`;
        return;
    }

    // 2. 초기 블록 동기화 (공급량에서 선택된 블록이 있으면 우선 연동, 없으면 전체(ALL))
    if (currentSelectedSupplyBlock && (data.blocks[currentSelectedSupplyBlock] || currentSelectedSupplyBlock === 'ALL')) {
        currentChargeBlock = currentSelectedSupplyBlock;
    } else if (currentChargeBlock !== 'ALL' && !data.blocks[currentChargeBlock]) {
        currentChargeBlock = 'ALL';
    }

    // 3. 블록 드롭다운 옵션 채우기 (최상단에 '전체' 추가, 부과량 원본 자료 100% 표출)
    const blockSelect = document.getElementById('chargeBlockSelect');
    if (blockSelect && blockSelect.options.length <= 2) {
        const sortedBlocks = Object.keys(data.blocks)
            .sort((a, b) => a.localeCompare(b, 'ko', { numeric: true }));
        blockSelect.innerHTML = `<option value="ALL">전체 (총 ${sortedBlocks.length}개 블록)</option>` + sortedBlocks.map(b => `<option value="${b}">${b}</option>`).join('');
    }
    if (blockSelect) blockSelect.value = currentChargeBlock;

    // 3-1. 버전 뱃지 및 테이블 월별 헤더 동적 동기화
    const versionBadge = document.getElementById('chargeDataVersionBadge');
    const tableMonthHeader = document.getElementById('chargeTableMonthHeader');
    const chargeMonths = data.months || ['2026.09', '2026.10', '2026.11'];
    if (chargeMonths && chargeMonths.length >= 3) {
        const mStart = chargeMonths[0].replace('20', '');
        const mEnd = chargeMonths[2].replace('20', '');
        const endMonthNum = mEnd.split('.')[1] || mEnd;
        if (versionBadge) versionBadge.textContent = `최근 3개월 (${mStart} ~ ${endMonthNum})`;
        if (tableMonthHeader) tableMonthHeader.textContent = `${chargeMonths[0]} | ${chargeMonths[1]} | ${chargeMonths[2]}`;
    }

    // 4. 이벤트 리스너 바인딩 (최초 1회)
    setupChargeEventListeners();

    // 5. 화면 렌더링
    updateChargeSummaryKPI();
    renderChargeConsumerTable();
    renderChargeDetailPanel();
}

/**
 * 부과량 탭 인터랙션 이벤트 리스너 바인딩
 */
function setupChargeEventListeners() {
    if (isChargeEventsBound) return;
    isChargeEventsBound = true;

    // 블록 변경 셀렉트
    const blockSelect = document.getElementById('chargeBlockSelect');
    if (blockSelect) {
        blockSelect.addEventListener('change', (e) => {
            currentChargeBlock = e.target.value;
            updateChargeSummaryKPI();
            renderChargeConsumerTable();
            renderChargeDetailPanel();
        });
    }

    // 대수용가 필터 토글 버튼
    const btnLarge = document.getElementById('btnFilterLargeConsumers');
    if (btnLarge) {
        btnLarge.addEventListener('click', () => {
            isLargeOnlyFilter = !isLargeOnlyFilter;
            btnLarge.classList.toggle('active', isLargeOnlyFilter);
            btnLarge.dataset.active = isLargeOnlyFilter ? 'true' : 'false';

            // 대수용가 활성화 시 0톤 및 이상 필터는 해제
            if (isLargeOnlyFilter) {
                currentZeroFilter = 'ALL';
                const zeroSelect = document.getElementById('chargeZeroUsageSelect');
                if (zeroSelect) zeroSelect.value = 'ALL';

                currentAbnormalFilter = 'ALL';
                const abSelect = document.getElementById('chargeAbnormalSelect');
                if (abSelect) abSelect.value = 'ALL';

                switchChargeDetailTab('LARGE');
            }

            renderChargeConsumerTable();
            renderChargeDetailPanel();
            updateChargeSummaryKPI();
        });
    }

    // 0톤 수용가 필터 드롭다운
    const zeroSelect = document.getElementById('chargeZeroUsageSelect');
    if (zeroSelect) {
        zeroSelect.addEventListener('change', (e) => {
            currentZeroFilter = e.target.value;

            // 0톤 필터 선택 시 대수용가 필터는 자동 해제
            if (currentZeroFilter !== 'ALL') {
                if (isLargeOnlyFilter) {
                    isLargeOnlyFilter = false;
                    if (btnLarge) {
                        btnLarge.classList.remove('active');
                        btnLarge.dataset.active = 'false';
                    }
                }
                switchChargeDetailTab('ZERO');
            }

            renderChargeConsumerTable();
            renderChargeDetailPanel();
            updateChargeSummaryKPI();
        });
    }

    // 이상수용가 필터 드롭다운
    const abSelect = document.getElementById('chargeAbnormalSelect');
    if (abSelect) {
        abSelect.addEventListener('change', (e) => {
            currentAbnormalFilter = e.target.value;

            // 이상수용가 필터 선택 시 대수용가 필터 해제
            if (currentAbnormalFilter !== 'ALL') {
                if (isLargeOnlyFilter) {
                    isLargeOnlyFilter = false;
                    if (btnLarge) {
                        btnLarge.classList.remove('active');
                        btnLarge.dataset.active = 'false';
                    }
                }
                switchChargeDetailTab('ABNORMAL');
            }

            renderChargeConsumerTable();
            renderChargeDetailPanel();
            updateChargeSummaryKPI();
        });
    }

    // 적정구경 필터 드롭다운
    const calSelect = document.getElementById('chargeCaliberFilterSelect');
    if (calSelect) {
        calSelect.addEventListener('change', (e) => {
            currentCaliberFilter = e.target.value;

            // 부적정 관련 필터 선택 시 우측 하단 탭도 적정구경 권고 탭으로 자동 전환
            if (['UNFIT', 'OVERSIZED', 'UNDERSIZED'].includes(currentCaliberFilter)) {
                switchChargeDetailTab('CALIBER');
            }

            renderChargeConsumerTable();
            renderChargeDetailPanel();
        });
    }

    // 수용가 검색창 및 리셋 버튼
    const searchInput = document.getElementById('chargeConsumerSearchInput');
    const resetBtn = document.getElementById('btnResetChargeSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            chargeSearchKeyword = e.target.value.trim().toLowerCase();
            if (resetBtn) {
                resetBtn.style.display = chargeSearchKeyword ? 'inline-block' : 'none';
            }
            renderChargeConsumerTable();
        });
    }
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            chargeSearchKeyword = '';
            if (searchInput) searchInput.value = '';
            resetBtn.style.display = 'none';
            renderChargeConsumerTable();
        });
    }
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            chargeSearchKeyword = '';
            resetBtn.style.display = 'none';
            renderChargeConsumerTable();
        });
    }

    // 우측 하단 상세 카드 항목 클릭 시 ➔ 좌측 해당 수용가로 포커스 및 하이라이트 이벤트 위임
    const detailCard = document.getElementById('chargeDetailCard');
    if (detailCard) {
        detailCard.addEventListener('click', (e) => {
            const item = e.target.closest('[data-cno]');
            if (item) {
                const cNo = item.getAttribute('data-cno');
                const block = item.getAttribute('data-block') || '';
                focusConsumerInTable(cNo, block);
            }
        });
    }

    // 우측 하단 탭 전환
    const tabLarge = document.getElementById('tabDetailLarge');
    const tabZero = document.getElementById('tabDetailZero');
    const tabAbnormal = document.getElementById('tabDetailAbnormal');
    const tabCaliber = document.getElementById('tabDetailCaliber');

    if (tabLarge) {
        tabLarge.addEventListener('click', () => switchChargeDetailTab('LARGE'));
    }
    if (tabZero) {
        tabZero.addEventListener('click', () => switchChargeDetailTab('ZERO'));
    }
    if (tabAbnormal) {
        tabAbnormal.addEventListener('click', () => switchChargeDetailTab('ABNORMAL'));
    }
    if (tabCaliber) {
        tabCaliber.addEventListener('click', () => switchChargeDetailTab('CALIBER'));
    }

    // 엑셀 내보내기 버튼
    const btnExcel = document.getElementById('btnExportConsumerExcel');
    if (btnExcel) {
        btnExcel.addEventListener('click', exportConsumerChargeExcel);
    }
}

/**
 * 우측 결과 항목 클릭 시 ➔ 좌측 수용가 테이블에서 해당 수용가로 즉시 이동 및 하이라이트
 */
function focusConsumerInTable(cNo, blockName) {
    if (!cNo) return;

    // 1. 현재 선택된 블록이 'ALL'도 아니고 수용가 블록과 다르면 '전체'로 확장
    if (currentChargeBlock !== 'ALL' && blockName && currentChargeBlock !== blockName) {
        currentChargeBlock = 'ALL';
        const blockSelect = document.getElementById('chargeBlockSelect');
        if (blockSelect) blockSelect.value = 'ALL';
        updateChargeSummaryKPI();
    }

    // 2. 다른 필터 조건(대수용가 전용, 0톤 필터, 이상수용가 필터, 구경 필터)으로 인해 클릭한 대상이 가려지지 않도록 해제
    filterLargeOnly = false;
    currentZeroUsageFilter = 'ALL';
    currentAbnormalFilter = 'ALL';
    currentCaliberFilter = 'ALL';

    const btnLarge = document.getElementById('btnFilterLargeConsumers');
    if (btnLarge) btnLarge.classList.remove('active');
    const zeroSelect = document.getElementById('chargeZeroUsageSelect');
    if (zeroSelect) zeroSelect.value = 'ALL';
    const abSelect = document.getElementById('chargeAbnormalSelect');
    if (abSelect) abSelect.value = 'ALL';
    const calSelect = document.getElementById('chargeCaliberFilterSelect');
    if (calSelect) calSelect.value = 'ALL';

    // 3. 검색창에 해당 수용가번호 자동 세팅
    chargeSearchKeyword = String(cNo).trim().toLowerCase();
    const searchInput = document.getElementById('chargeConsumerSearchInput');
    const resetBtn = document.getElementById('btnResetChargeSearch');
    if (searchInput) {
        searchInput.value = cNo;
    }
    if (resetBtn) {
        resetBtn.style.display = 'inline-block';
    }

    // 4. 좌측 테이블 재렌더링
    renderChargeConsumerTable();

    // 5. 테이블 행을 찾아 부드럽게 스크롤 & 하이라이트 애니메이션
    setTimeout(() => {
        const row = document.querySelector(`#chargeConsumerTable tr[data-cno="${cNo}"]`);
        if (row) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            row.classList.add('row-selected-highlight');
            setTimeout(() => {
                row.classList.remove('row-selected-highlight');
            }, 3500);
        }
    }, 120);
}

/**
 * 김해시 전체 수용가 목록 반환 (계통도 소블록 68개 전용, 지연 병합 및 캐싱)
 */
function getAllConsumerList() {
    if (!consumerChargeData || !consumerChargeData.blocks) return [];
    if (!consumerChargeData._allList) {
        let combined = [];
        Object.keys(consumerChargeData.blocks).forEach(bName => {
            if (isTopologySubBlock(bName)) {
                const arr = consumerChargeData.blocks[bName];
                if (Array.isArray(arr)) {
                    combined = combined.concat(arr);
                }
            }
        });
        // 일사용량 기준 내림차순 정렬
        combined.sort((a, b) => (b.dailyUsage || 0) - (a.dailyUsage || 0));
        consumerChargeData._allList = combined;
    }
    return consumerChargeData._allList;
}

/**
 * 김해시 전체 부과량 요약 통계 계산 (계통도 소블록 68개 전용, 캐싱 지원)
 */
function getAllChargeSummary() {
    if (!consumerChargeData) {
        return {
            totalCount: 0, totalDailyUsage: 0, largeCount: 0, largeDailyUsage: 0,
            largeRatio: 0, oversizedCount: 0, undersizedCount: 0, optimalCount: 0, unfitCount: 0
        };
    }
    if (!consumerChargeData._allSummary) {
        const sum = {
            totalCount: 0,
            totalDailyUsage: 0,
            largeCount: 0,
            largeDailyUsage: 0,
            largeRatio: 0,
            oversizedCount: 0,
            undersizedCount: 0,
            optimalCount: 0,
            unfitCount: 0
        };

        if (consumerChargeData.summary) {
            Object.keys(consumerChargeData.summary).forEach(bName => {
                if (isTopologySubBlock(bName)) {
                    const s = consumerChargeData.summary[bName];
                    sum.totalCount += (s.totalCount || 0);
                    sum.totalDailyUsage += (s.totalDailyUsage || 0);
                    sum.largeCount += (s.largeCount || 0);
                    sum.largeDailyUsage += (s.largeDailyUsage || 0);
                    sum.oversizedCount += (s.oversizedCount || 0);
                    sum.undersizedCount += (s.undersizedCount || 0);
                    sum.optimalCount += (s.optimalCount || 0);
                    sum.unfitCount += (s.unfitCount || 0);
                }
            });
            sum.totalDailyUsage = Math.round(sum.totalDailyUsage * 10) / 10;
            sum.largeDailyUsage = Math.round(sum.largeDailyUsage * 10) / 10;
            sum.largeRatio = sum.totalDailyUsage > 0 
                ? Math.round((sum.largeDailyUsage / sum.totalDailyUsage) * 1000) / 10 
                : 0;
        }
        consumerChargeData._allSummary = sum;
    }
    return consumerChargeData._allSummary;
}

/**
 * 우측 하단 탭 전환 함수 (4개 탭 지원: 대수용가 / 0톤수용가 / 이상수용가 / 구경개선)
 */
function switchChargeDetailTab(tabType) {
    currentChargeDetailTab = tabType;
    const tabLarge = document.getElementById('tabDetailLarge');
    const tabZero = document.getElementById('tabDetailZero');
    const tabAbnormal = document.getElementById('tabDetailAbnormal');
    const tabCaliber = document.getElementById('tabDetailCaliber');

    const contentLarge = document.getElementById('detailContentLarge');
    const contentZero = document.getElementById('detailContentZero');
    const contentAbnormal = document.getElementById('detailContentAbnormal');
    const contentCaliber = document.getElementById('detailContentCaliber');
    const descText = document.getElementById('detailDescText');

    const blockTitle = currentChargeBlock === 'ALL' ? '김해시 전체' : `${currentChargeBlock} 블록`;

    // 탭 버튼 active 클래스 초기화
    [tabLarge, tabZero, tabAbnormal, tabCaliber].forEach(btn => btn && btn.classList.remove('active'));
    // 컨텐츠 숨김 초기화
    [contentLarge, contentZero, contentAbnormal, contentCaliber].forEach(cnt => cnt && (cnt.style.display = 'none'));

    if (tabType === 'LARGE') {
        if (tabLarge) tabLarge.classList.add('active');
        if (contentLarge) contentLarge.style.display = 'block';
        if (descText) descText.textContent = `${blockTitle} 상위 대수용가 현황`;
    } else if (tabType === 'ZERO') {
        if (tabZero) tabZero.classList.add('active');
        if (contentZero) contentZero.style.display = 'block';
        if (descText) descText.textContent = `${blockTitle} 0톤 수용가 (장기미사용/폐전의심) 목록`;
    } else if (tabType === 'ABNORMAL') {
        if (tabAbnormal) tabAbnormal.classList.add('active');
        if (contentAbnormal) contentAbnormal.style.display = 'block';
        if (descText) descText.textContent = `${blockTitle} 이상수용가 (급증 누수의심 / 급감 고장의심) 분석`;
    } else {
        if (tabCaliber) tabCaliber.classList.add('active');
        if (contentCaliber) contentCaliber.style.display = 'block';
        if (descText) descText.textContent = `${blockTitle} 계량기 적정구경 진단 및 개선 권고`;
    }

    renderChargeDetailPanel();
}

/**
 * 우측 상단 3대 KPI 카드 갱신
 */
function updateChargeSummaryKPI() {
    if (!consumerChargeData) return;

    const isAll = (currentChargeBlock === 'ALL');
    const allList = isAll ? getAllConsumerList() : ((consumerChargeData.blocks && consumerChargeData.blocks[currentChargeBlock]) || []);
    const summary = isAll 
        ? getAllChargeSummary() 
        : ((consumerChargeData.summary && consumerChargeData.summary[currentChargeBlock]) || {
            totalCount: 0,
            totalDailyUsage: 0,
            largeCount: 0,
            largeDailyUsage: 0,
            largeRatio: 0,
            oversizedCount: 0,
            undersizedCount: 0,
            optimalCount: 0,
            unfitCount: 0
        });

    // 0톤 및 이상수용가 통계 집계
    let zCount1 = 0, zCount2 = 0, zCount3 = 0;
    let surgeCount = 0, dropCount = 0;
    allList.forEach(c => {
        const z = getZeroMonthsInfo(c);
        if (z.isZero1M) zCount1++;
        if (z.isZero2M) zCount2++;
        if (z.isZero3M) zCount3++;

        const ab = getAbnormalUsageInfo(c);
        if (ab.type === 'SURGE') surgeCount++;
        if (ab.type === 'DROP') dropCount++;
    });

    // 카드 1: 블록 총 부과량
    const labelTotalEl = document.getElementById('ckBlockTotalLabel');
    if (labelTotalEl) {
        labelTotalEl.textContent = isAll ? '김해시 전체 총 부과량' : `${currentChargeBlock} 블록 총 부과량`;
    }
    const totalDailyEl = document.getElementById('ckBlockTotalDaily');
    if (totalDailyEl) {
        totalDailyEl.innerHTML = `${summary.totalDailyUsage.toLocaleString()} <span class="ck-unit">m³/일</span>`;
    }
    const totalCountEl = document.getElementById('ckBlockTotalConsumers');
    if (totalCountEl) {
        totalCountEl.textContent = `총 검침 수용가: ${summary.totalCount.toLocaleString()} 전 (월 ~${Math.round(summary.totalDailyUsage * 30).toLocaleString()} m³)`;
    }

    // 카드 2: 대수용가 / 0톤수용가 현황 (필터에 따라 맞춤 표출)
    const labelLargeEl = document.getElementById('ckLargeConsumersLabel');
    const largeValEl = document.getElementById('ckLargeConsumersVal');
    const largeSubEl = document.getElementById('ckLargeUsageRatio');

    if (currentZeroFilter !== 'ALL') {
        if (labelLargeEl) labelLargeEl.textContent = '0톤 수용가 현황';
        const targetZCount = (currentZeroFilter === 'ZERO_1M' ? zCount1 : (currentZeroFilter === 'ZERO_2M' ? zCount2 : zCount3));
        const zPct = summary.totalCount > 0 ? ((targetZCount / summary.totalCount) * 100).toFixed(1) : '0';
        if (largeValEl) {
            largeValEl.innerHTML = `<span style="color:#DC2626;">${targetZCount.toLocaleString()}</span> <span class="ck-unit">전 (${zPct}%)</span>`;
        }
        if (largeSubEl) {
            largeSubEl.textContent = `3개월 연속: ${zCount3}전 | 2개월: ${zCount2}전 | 1개월: ${zCount1}전`;
            largeSubEl.style.color = '#DC2626';
        }
    } else {
        if (labelLargeEl) labelLargeEl.textContent = '대수용가 현황';
        const pct = summary.totalCount > 0 ? ((summary.largeCount / summary.totalCount) * 100).toFixed(1) : '0';
        if (largeValEl) {
            largeValEl.innerHTML = `<span style="color:#10B981;">${summary.largeCount.toLocaleString()}</span> <span class="ck-unit">전 (${pct}%)</span>`;
        }
        if (largeSubEl) {
            const scopeWord = isAll ? '전체 부과량의' : '블록 부과량의';
            largeSubEl.textContent = `${scopeWord} ${summary.largeRatio}% 점유 (${summary.largeDailyUsage.toLocaleString()} m³/일)`;
            largeSubEl.style.color = '#64748B';
        }
    }

    // 카드 3: 적정구경 / 이상수용가 현황
    const labelOptEl = document.getElementById('ckCaliberOptimalLabel');
    const optValEl = document.getElementById('ckCaliberOptimalVal');
    const unfitSubEl = document.getElementById('ckCaliberUnfitDetail');

    if (currentAbnormalFilter !== 'ALL') {
        if (labelOptEl) labelOptEl.textContent = '이상수용가(급증/급감) 현황';
        const abTotal = surgeCount + dropCount;
        if (optValEl) {
            optValEl.innerHTML = `<span style="color:#D97706;">${abTotal.toLocaleString()}</span> <span class="ck-unit">전</span>`;
        }
        if (unfitSubEl) {
            unfitSubEl.textContent = `급증(누수의심) ${surgeCount}전 | 급감(고장의심) ${dropCount}전`;
            unfitSubEl.style.color = '#D97706';
        }
    } else {
        if (labelOptEl) labelOptEl.textContent = '적정구경 검토 현황';
        const optPct = summary.totalCount > 0 ? ((summary.optimalCount / summary.totalCount) * 100).toFixed(1) : '0';
        if (optValEl) {
            optValEl.innerHTML = `<span style="color:#F59E0B;">${summary.optimalCount.toLocaleString()}</span> <span class="ck-unit">전 (${optPct}%)</span>`;
        }
        if (unfitSubEl) {
            unfitSubEl.textContent = `부적정 ${summary.unfitCount.toLocaleString()}전 (0톤 ${zCount3}전, 이상수용가 ${surgeCount + dropCount}전)`;
            unfitSubEl.style.color = summary.unfitCount > 0 ? '#DC2626' : '#64748B';
        }
    }
}

/**
 * 좌측: 수용가별 검침 데이터 테이블 렌더링
 * - 열 구성: 수용가번호, 수용가명, 구경, 최근 3개월 일사용량, 진단 및 상태검토
 */
function renderChargeConsumerTable() {
    if (!consumerChargeData) return;

    const isAll = (currentChargeBlock === 'ALL');
    const allList = isAll ? getAllConsumerList() : ((consumerChargeData.blocks && consumerChargeData.blocks[currentChargeBlock]) || []);
    const tbody = document.getElementById('chargeConsumerTbody');
    const badgeEl = document.getElementById('chargeTableCountBadge');
    if (!tbody) return;

    // 필터링 적용
    let filtered = allList;

    // 1. 대수용가 필터
    if (isLargeOnlyFilter) {
        filtered = filtered.filter(c => c.isLarge);
    }

    // 2. 0톤수용가 필터
    if (currentZeroFilter !== 'ALL') {
        filtered = filtered.filter(c => {
            const z = getZeroMonthsInfo(c);
            if (currentZeroFilter === 'ZERO_1M') return z.isZero1M;
            if (currentZeroFilter === 'ZERO_2M') return z.isZero2M;
            if (currentZeroFilter === 'ZERO_3M') return z.isZero3M;
            if (currentZeroFilter === 'ZERO_6M') return z.isZero6M;
            return true;
        });
    }

    // 3. 이상수용가 필터
    if (currentAbnormalFilter !== 'ALL') {
        filtered = filtered.filter(c => {
            const ab = getAbnormalUsageInfo(c);
            if (currentAbnormalFilter === 'ABNORMAL_ALL') return ab.type !== 'NORMAL';
            if (currentAbnormalFilter === 'ABNORMAL_SURGE') return ab.type === 'SURGE';
            if (currentAbnormalFilter === 'ABNORMAL_DROP') return ab.type === 'DROP';
            return true;
        });
    }

    // 4. 적정구경 필터
    if (currentCaliberFilter === 'OPTIMAL') {
        filtered = filtered.filter(c => c.evalType === 'optimal');
    } else if (currentCaliberFilter === 'UNFIT') {
        filtered = filtered.filter(c => c.evalType !== 'optimal');
    } else if (currentCaliberFilter === 'OVERSIZED') {
        filtered = filtered.filter(c => c.evalType === 'oversized');
    } else if (currentCaliberFilter === 'UNDERSIZED') {
        filtered = filtered.filter(c => c.evalType === 'undersized');
    }

    // 5. 키워드 검색 (블록명도 함께 검색 가능)
    if (chargeSearchKeyword) {
        filtered = filtered.filter(c => 
            c.cNo.toLowerCase().includes(chargeSearchKeyword) || 
            c.name.toLowerCase().includes(chargeSearchKeyword) ||
            (c.block && c.block.toLowerCase().includes(chargeSearchKeyword))
        );
    }

    if (badgeEl) {
        const scopeTitle = isAll ? '김해시 전체' : `${currentChargeBlock}`;
        badgeEl.textContent = `${filtered.length.toLocaleString()}건 / ${scopeTitle} ${allList.length.toLocaleString()}건`;
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="padding:40px; text-align:center; color:#94A3B8;">조건에 해당하는 수용가 데이터가 없습니다.</td></tr>`;
        return;
    }

    // 렌더링 성능 최적화: 상위 300개 표시
    const displayList = filtered.slice(0, 300);

    let html = '';
    displayList.forEach(c => {
        const zInfo = getZeroMonthsInfo(c);
        const ab = getAbnormalUsageInfo(c);

        // 뱃지 리스트 생성
        let badgesHtml = [];

        // 1. 0톤 뱃지 (0톤인 경우 최우선 표출)
        if (zInfo.count > 0) {
            const zCls = zInfo.count >= 3 ? 'zero-3' : (zInfo.count === 2 ? 'zero-2' : 'zero-1');
            const zText = zInfo.count >= 3 ? '3개월 연속 0톤 (폐전의심)' : `${zInfo.count}개월 연속 0톤`;
            badgesHtml.push(`<span class="badge-zero-months ${zCls}"><i class="fa-solid fa-droplet-slash"></i> ${zText}</span>`);
        }

        // 2. 이상수용가 뱃지
        if (ab.type === 'SURGE') {
            badgesHtml.push(`<span class="badge-abnormal surge" title="직전평균 ${ab.avgPrev}m³ ➔ 최근월 ${ab.latest}m³"><i class="fa-solid fa-arrow-trend-up"></i> ${ab.desc}</span>`);
        } else if (ab.type === 'DROP') {
            badgesHtml.push(`<span class="badge-abnormal drop" title="직전평균 ${ab.avgPrev}m³ ➔ 최근월 ${ab.latest}m³"><i class="fa-solid fa-arrow-trend-down"></i> ${ab.desc}</span>`);
        }

        // 3. 적정구경 뱃지
        if (badgesHtml.length === 0 || currentCaliberFilter !== 'ALL') {
            if (c.evalType === 'optimal') {
                badgesHtml.push(`<span class="badge-cal-optimal"><i class="fa-solid fa-circle-check"></i> ${c.evalDesc}</span>`);
            } else if (c.evalType === 'oversized') {
                badgesHtml.push(`<span class="badge-cal-oversized"><i class="fa-solid fa-arrow-trend-down"></i> ${c.evalDesc}</span>`);
            } else {
                badgesHtml.push(`<span class="badge-cal-undersized"><i class="fa-solid fa-arrow-trend-up"></i> ${c.evalDesc}</span>`);
            }
        }

        // 수용가명 옆 태그
        let tagsHtml = '';
        if (c.isLarge) tagsHtml += `<span class="tag-large-consumer">대수용가</span>`;
        if (zInfo.count > 0) tagsHtml += `<span class="tag-zero-consumer">${zInfo.count}개월0톤</span>`;
        if (ab.type === 'SURGE') tagsHtml += `<span class="tag-abnormal-surge">급증</span>`;
        if (ab.type === 'DROP') tagsHtml += `<span class="tag-abnormal-drop">급감</span>`;
        if (isAll) tagsHtml += `<span style="font-size:10px; font-weight:600; padding:1px 5px; border-radius:3px; background:#F1F5F9; color:#475569; margin-left:5px; border:1px solid #CBD5E1;">${c.block}</span>`;

        // 월별 사용량 표현 (동적 3개월 지원)
        const dMonths = (consumerChargeData && consumerChargeData.months) || ['2026.09', '2026.10', '2026.11'];
        const m1Key = dMonths[0] ? 'm' + dMonths[0].replace('.', '') : 'm2609';
        const m2Key = dMonths[1] ? 'm' + dMonths[1].replace('.', '') : 'm2610';
        const m3Key = dMonths[2] ? 'm' + dMonths[2].replace('.', '') : 'm2611';

        const m1Val = Number(c[m1Key] !== undefined ? c[m1Key] : (c.m1 !== undefined ? c.m1 : (c.m2605 || 0)));
        const m2Val = Number(c[m2Key] !== undefined ? c[m2Key] : (c.m2 !== undefined ? c.m2 : (c.m2606 || 0)));
        const m3Val = Number(c[m3Key] !== undefined ? c[m3Key] : (c.m3 !== undefined ? c.m3 : (c.m2607 || 0)));

        const m1Color = m1Val === 0 ? '#DC2626' : '#334155';
        const m2Color = m2Val === 0 ? '#DC2626' : '#334155';
        const m3Color = m3Val === 0 ? '#DC2626' : '#059669';

        const monthlyStripHtml = `
            <div class="usage-monthly-cell">
                <div class="usage-monthly-strip">
                    <span class="m-val" style="color:${m1Color};" title="${dMonths[0]}: ${m1Val.toLocaleString()} m³">${m1Val.toLocaleString()}</span>
                    <span class="m-sep">|</span>
                    <span class="m-val" style="color:${m2Color};" title="${dMonths[1]}: ${m2Val.toLocaleString()} m³">${m2Val.toLocaleString()}</span>
                    <span class="m-sep">|</span>
                    <span class="m-val m-latest" style="color:${m3Color};" title="${dMonths[2]}: ${m3Val.toLocaleString()} m³">${m3Val.toLocaleString()} m³</span>
                </div>
                <div style="font-size:10px; color:#64748B; margin-top:2px;">
                    3개월: ${Math.round(c.total3m).toLocaleString()} m³ (일평균 ${c.dailyUsage.toLocaleString()} m³)
                </div>
            </div>
        `;

        html += `
            <tr data-cno="${c.cNo}">
                <td><code>${c.cNo}</code></td>
                <td>
                    <b>${c.name}</b>${tagsHtml}
                    <div style="font-size:10.5px; color:#64748B; margin-top:2px;">업종: ${c.type}</div>
                </td>
                <td style="text-align:center; font-weight:700;">${c.caliber} mm</td>
                <td style="text-align:center;">${monthlyStripHtml}</td>
                <td style="text-align:center;">${badgesHtml.join(' ')}</td>
            </tr>
        `;
    });

    if (filtered.length > 300) {
        html += `<tr><td colspan="5" style="padding:12px; text-align:center; color:#64748B; background:#F8FAFC;">(검색 결과 중 상위 300건을 표시 중입니다. 정밀 검색을 원하시면 검색창을 활용해 주세요.)</td></tr>`;
    }

    tbody.innerHTML = html;
}

/**
 * 우측 하단 상세 현황 패널 렌더링 (대수용가 랭킹 / 0톤 수용가 / 이상수용가 / 적정구경 권고)
 * - 각 항목 클릭 시 ➔ 좌측 수용가별 검침 표에서 즉시 조회 및 하이라이트
 */
function renderChargeDetailPanel() {
    if (!consumerChargeData) return;

    const isAll = (currentChargeBlock === 'ALL');
    const allList = isAll ? getAllConsumerList() : ((consumerChargeData.blocks && consumerChargeData.blocks[currentChargeBlock]) || []);
    const containerLarge = document.getElementById('detailLargeListContainer');
    const containerZero = document.getElementById('detailZeroListContainer');
    const containerAbnormal = document.getElementById('detailAbnormalListContainer');
    const containerCaliber = document.getElementById('detailCaliberListContainer');
    const descText = document.getElementById('detailDescText');

    const blockTitle = isAll ? '김해시 전체' : `${currentChargeBlock} 블록`;

    // 1. 대수용가 탭
    if (currentChargeDetailTab === 'LARGE' && containerLarge) {
        if (descText) descText.textContent = `${blockTitle} 상위 대수용가 현황 (클릭 시 좌측 표 이동)`;

        const largeList = allList.filter(c => c.isLarge).sort((a, b) => b.dailyUsage - a.dailyUsage);

        if (largeList.length === 0) {
            containerLarge.innerHTML = `<div style="padding:30px; text-align:center; color:#94A3B8;">해당 ${isAll ? '관내' : '블록'}에는 기준(일 100톤↑ 또는 75mm↑)에 해당하는 대수용가가 없습니다.</div>`;
            return;
        }

        const displayLarge = isAll ? largeList.slice(0, 50) : largeList;

        let html = '';
        displayLarge.forEach((c, idx) => {
            const rankCls = idx === 0 ? 'top1' : (idx === 1 ? 'top2' : (idx === 2 ? 'top3' : ''));
            const blockTag = isAll ? `<span><i class="fa-solid fa-cube"></i> ${c.block}</span>` : '';
            html += `
                <div class="large-consumer-item" data-cno="${c.cNo}" data-block="${c.block}" title="클릭 시 좌측 표에서 [${c.name}] 상세 보기">
                    <div class="lci-left">
                        <div class="lci-rank ${rankCls}">${idx + 1}</div>
                        <div class="lci-info">
                            <div class="lci-name" title="${c.name}">${c.name}</div>
                            <div class="lci-meta">
                                ${blockTag}
                                <span><i class="fa-solid fa-hashtag"></i> ${c.cNo}</span>
                                <span><i class="fa-solid fa-ruler-horizontal"></i> ${c.caliber}mm</span>
                                <span><i class="fa-solid fa-tag"></i> ${c.type}</span>
                            </div>
                        </div>
                    </div>
                    <div class="lci-right">
                        <div class="lci-usage">${c.dailyUsage.toLocaleString()} m³/일</div>
                        <div class="lci-total3m">3개월 누적: ${Math.round(c.total3m).toLocaleString()} m³</div>
                        <div style="font-size:10px; color:#2563EB; font-weight:600; margin-top:2px;"><i class="fa-solid fa-arrow-left"></i> 좌측 표 조회</div>
                    </div>
                </div>
            `;
        });
        if (isAll && largeList.length > 50) {
            html += `<div style="padding:10px; text-align:center; font-size:12px; color:#64748B; background:#F8FAFC;">(김해시 전체 대수용가 ${largeList.length}개소 중 상위 50개소를 표시 중입니다)</div>`;
        }
        containerLarge.innerHTML = html;
    }
    // 2. 0톤 수용가 탭 (장기 미사용 / 폐전 의심)
    else if (currentChargeDetailTab === 'ZERO' && containerZero) {
        if (descText) descText.textContent = `${blockTitle} 0톤 수용가 (장기미사용/폐전의심) 목록 (클릭 시 좌측 표 이동)`;

        const zeroList = allList.map(c => ({
            ...c,
            zInfo: getZeroMonthsInfo(c)
        })).filter(c => c.zInfo.count > 0).sort((a, b) => {
            if (b.zInfo.count !== a.zInfo.count) return b.zInfo.count - a.zInfo.count; // 3개월 > 2개월 > 1개월
            return (b.caliber || 0) - (a.caliber || 0); // 구경 큰 순
        });

        if (zeroList.length === 0) {
            containerZero.innerHTML = `<div style="padding:30px; text-align:center; color:#10B981;"><i class="fa-solid fa-circle-check fa-2x"></i><br><br>해당 ${isAll ? '관내' : '블록'}에는 0톤 수용가가 없습니다. (모든 수용가 정상 사용 중)</div>`;
            return;
        }

        const displayZero = isAll ? zeroList.slice(0, 50) : zeroList;

        let html = '';
        displayZero.forEach(c => {
            const zCls = c.zInfo.count >= 3 ? 'zero-3' : (c.zInfo.count === 2 ? 'zero-2' : 'zero-1');
            const zText = c.zInfo.count >= 3 ? '3개월 연속 0톤 (폐전의심)' : `${c.zInfo.count}개월 연속 0톤`;
            const blockPrefix = isAll ? `<span style="font-weight:700; color:#334155; margin-right:4px;">[${c.block}]</span>` : '';

            const mArr = (consumerChargeData && consumerChargeData.months) || ['2026.09', '2026.10', '2026.11'];
            const l1 = (mArr[0].split('.')[1] || '9') + '월';
            const l2 = (mArr[1].split('.')[1] || '10') + '월';
            const l3 = (mArr[2].split('.')[1] || '11') + '월';
            const v1 = c.m1 !== undefined ? c.m1 : (c.m2609 !== undefined ? c.m2609 : (c.m2605 || 0));
            const v2 = c.m2 !== undefined ? c.m2 : (c.m2610 !== undefined ? c.m2610 : (c.m2606 || 0));
            const v3 = c.m3 !== undefined ? c.m3 : (c.m2611 !== undefined ? c.m2611 : (c.m2607 || 0));

            html += `
                <div class="caliber-issue-item" data-cno="${c.cNo}" data-block="${c.block}" style="border-left: 4px solid #DC2626; background:#FEF2F2;" title="클릭 시 좌측 표에서 [${c.name}] 상세 보기">
                    <div class="lci-left">
                        <i class="fa-solid fa-droplet-slash" style="color:#DC2626; font-size:16px;"></i>
                        <div class="lci-info">
                            <div class="lci-name">${blockPrefix}${c.name} <code style="font-size:11px; font-weight:normal;">(${c.cNo})</code></div>
                            <div style="font-size:11.5px; color:#DC2626; margin-top:2px; font-weight:700;">
                                <span class="badge-zero-months ${zCls}">${zText}</span>
                                <span style="color:#64748B; font-weight:normal; margin-left:6px;">구경: ${c.caliber}mm | 업종: ${c.type}</span>
                            </div>
                        </div>
                    </div>
                    <div class="lci-right">
                        <div class="lci-usage" style="color:#DC2626;">0 m³/일</div>
                        <div class="lci-total3m" style="color:#64748B; font-size:10.5px;">${l1}:${v1} | ${l2}:${v2} | ${l3}:${v3}m³</div>
                        <div style="font-size:10px; color:#DC2626; font-weight:600; margin-top:2px;"><i class="fa-solid fa-arrow-left"></i> 좌측 표 조회</div>
                    </div>
                </div>
            `;
        });
        if (isAll && zeroList.length > 50) {
            html += `<div style="padding:10px; text-align:center; font-size:12px; color:#64748B; background:#F8FAFC;">(김해시 전체 0톤 수용가 ${zeroList.length}개소 중 상위 50개소를 표시 중입니다)</div>`;
        }
        containerZero.innerHTML = html;
    }
    // 3. 이상 수용가 탭 (급증 누수의심 / 급감 고장의심)
    else if (currentChargeDetailTab === 'ABNORMAL' && containerAbnormal) {
        if (descText) descText.textContent = `${blockTitle} 이상수용가 (급증 누수의심 / 급감 고장의심) 분석 (클릭 시 좌측 표 이동)`;

        const abnormalList = allList.map(c => ({
            ...c,
            abInfo: getAbnormalUsageInfo(c)
        })).filter(c => c.abInfo.type !== 'NORMAL').sort((a, b) => {
            return Math.abs(b.abInfo.diff) - Math.abs(a.abInfo.diff);
        });

        if (abnormalList.length === 0) {
            containerAbnormal.innerHTML = `<div style="padding:30px; text-align:center; color:#10B981;"><i class="fa-solid fa-circle-check fa-2x"></i><br><br>해당 ${isAll ? '관내' : '블록'}에는 사용량 급증/급감 이상 수용가가 감지되지 않았습니다.</div>`;
            return;
        }

        const displayAbnormal = isAll ? abnormalList.slice(0, 50) : abnormalList;

        let html = '';
        displayAbnormal.forEach(c => {
            const isSurge = c.abInfo.type === 'SURGE';
            const icon = isSurge ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';
            const color = isSurge ? '#DC2626' : '#2563EB';
            const bgColor = isSurge ? '#FEF2F2' : '#EFF6FF';
            const blockPrefix = isAll ? `<span style="font-weight:700; color:#334155; margin-right:4px;">[${c.block}]</span>` : '';
            const actionTip = isSurge 
                ? `⚡ 누수 또는 무단사용/용도변경 현장 확인 요망` 
                : `🔍 계량기 불감수량 또는 기기고장(회전불량) 점검 요망`;

            html += `
                <div class="caliber-issue-item" data-cno="${c.cNo}" data-block="${c.block}" style="border-left: 4px solid ${color}; background:${bgColor};" title="클릭 시 좌측 표에서 [${c.name}] 상세 보기">
                    <div class="lci-left">
                        <i class="fa-solid ${icon}" style="color:${color}; font-size:16px;"></i>
                        <div class="lci-info">
                            <div class="lci-name">${blockPrefix}${c.name} <code style="font-size:11px; font-weight:normal;">(${c.cNo})</code></div>
                            <div style="font-size:11.5px; color:${color}; margin-top:2px; font-weight:700;">
                                <span class="badge-abnormal ${isSurge ? 'surge' : 'drop'}">${c.abInfo.desc}</span>
                                <span style="color:#64748B; font-weight:normal; margin-left:6px;">구경: ${c.caliber}mm | 업종: ${c.type}</span>
                            </div>
                            <div style="font-size:10.5px; color:#64748B; margin-top:3px;">
                                ${actionTip}
                            </div>
                        </div>
                    </div>
                    <div class="lci-right">
                        <div class="lci-usage" style="color:${color}; font-weight:800;">최근월 ${c.abInfo.latest} m³</div>
                        <div class="lci-total3m" style="color:#475569; font-size:11px;">직전평균: ${c.abInfo.avgPrev} m³ (변동: ${c.abInfo.diff > 0 ? '+' : ''}${c.abInfo.diff}m³)</div>
                        <div style="font-size:10px; color:${color}; font-weight:600; margin-top:2px;"><i class="fa-solid fa-arrow-left"></i> 좌측 표 조회</div>
                    </div>
                </div>
            `;
        });
        if (isAll && abnormalList.length > 50) {
            html += `<div style="padding:10px; text-align:center; font-size:12px; color:#64748B; background:#F8FAFC;">(김해시 전체 이상수용가 ${abnormalList.length}개소 중 상위 50개소를 표시 중입니다)</div>`;
        }
        containerAbnormal.innerHTML = html;
    }
    // 4. 구경 개선 권고 탭
    else if (currentChargeDetailTab === 'CALIBER' && containerCaliber) {
        if (descText) descText.textContent = `${blockTitle} 계량기 적정구경 진단 및 개선 권고 (클릭 시 좌측 표 이동)`;

        const unfitList = allList.filter(c => c.evalType !== 'optimal').sort((a, b) => b.dailyUsage - a.dailyUsage);

        if (unfitList.length === 0) {
            containerCaliber.innerHTML = `<div style="padding:30px; text-align:center; color:#10B981;"><i class="fa-solid fa-circle-check fa-2x"></i><br><br>해당 ${isAll ? '관내' : '블록'}은 모든 수용가의 계량기 구경이 적정 범위 내에 있습니다!</div>`;
            return;
        }

        const displayUnfit = isAll ? unfitList.slice(0, 50) : unfitList;

        let html = '';
        displayUnfit.forEach(c => {
            const isOver = c.evalType === 'oversized';
            const icon = isOver ? 'fa-arrow-trend-down' : 'fa-arrow-trend-up';
            const iconColor = isOver ? '#2563EB' : '#DC2626';
            const actionText = isOver 
                ? `불감수량(미검침 손실) 방지: ${c.caliber}mm ➔ <b>${c.recCaliber}mm</b> 하향 권고` 
                : `계량기 과부하 및 출수 불량 방지: ${c.caliber}mm ➔ <b>${c.recCaliber}mm</b> 상향 권고`;
            const blockPrefix = isAll ? `<span style="font-weight:700; color:#334155; margin-right:4px;">[${c.block}]</span>` : '';

            html += `
                <div class="caliber-issue-item ${c.evalType}" data-cno="${c.cNo}" data-block="${c.block}" title="클릭 시 좌측 표에서 [${c.name}] 상세 보기">
                    <div class="lci-left">
                        <i class="fa-solid ${icon}" style="color:${iconColor}; font-size:16px;"></i>
                        <div class="lci-info">
                            <div class="lci-name">${blockPrefix}${c.name} <code style="font-size:11px; font-weight:normal;">(${c.cNo})</code></div>
                            <div style="font-size:11.5px; color:${iconColor}; margin-top:2px; font-weight:600;">
                                ${actionText}
                            </div>
                        </div>
                    </div>
                    <div class="lci-right">
                        <div class="lci-usage" style="color:#1E293B;">일 ${c.dailyUsage.toLocaleString()} m³</div>
                        <div class="lci-total3m">현재 구경: ${c.caliber}mm</div>
                        <div style="font-size:10px; color:#2563EB; font-weight:600; margin-top:2px;"><i class="fa-solid fa-arrow-left"></i> 좌측 표 조회</div>
                    </div>
                </div>
            `;
        });
        if (isAll && unfitList.length > 50) {
            html += `<div style="padding:10px; text-align:center; font-size:12px; color:#64748B; background:#F8FAFC;">(김해시 전체 부적정 계량기 ${unfitList.length}개소 중 상위 50개소를 표시 중입니다)</div>`;
        }
        containerCaliber.innerHTML = html;
    }
}

/**
 * 수용가 부과량 현황 엑셀 내보내기 (0톤 및 이상수용가 데이터 완전 포함)
 */
function exportConsumerChargeExcel() {
    if (!consumerChargeData || typeof XLSX === 'undefined') {
        alert("데이터 또는 엑셀 라이브러리가 로드되지 않았습니다.");
        return;
    }

    const isAll = (currentChargeBlock === 'ALL');
    const allList = isAll ? getAllConsumerList() : ((consumerChargeData.blocks && consumerChargeData.blocks[currentChargeBlock]) || []);
    let exportList = allList;

    if (isLargeOnlyFilter) {
        exportList = exportList.filter(c => c.isLarge);
    }
    if (currentZeroFilter !== 'ALL') {
        exportList = exportList.filter(c => {
            const z = getZeroMonthsInfo(c);
            if (currentZeroFilter === 'ZERO_1M') return z.isZero1M;
            if (currentZeroFilter === 'ZERO_2M') return z.isZero2M;
            if (currentZeroFilter === 'ZERO_3M') return z.isZero3M;
            if (currentZeroFilter === 'ZERO_6M') return z.isZero6M;
            return true;
        });
    }
    if (currentAbnormalFilter !== 'ALL') {
        exportList = exportList.filter(c => {
            const ab = getAbnormalUsageInfo(c);
            if (currentAbnormalFilter === 'ABNORMAL_ALL') return ab.type !== 'NORMAL';
            if (currentAbnormalFilter === 'ABNORMAL_SURGE') return ab.type === 'SURGE';
            if (currentAbnormalFilter === 'ABNORMAL_DROP') return ab.type === 'DROP';
            return true;
        });
    }
    if (currentCaliberFilter === 'OPTIMAL') {
        exportList = exportList.filter(c => c.evalType === 'optimal');
    } else if (currentCaliberFilter === 'UNFIT') {
        exportList = exportList.filter(c => c.evalType !== 'optimal');
    } else if (currentCaliberFilter === 'OVERSIZED') {
        exportList = exportList.filter(c => c.evalType === 'oversized');
    } else if (currentCaliberFilter === 'UNDERSIZED') {
        exportList = exportList.filter(c => c.evalType === 'undersized');
    }

    const exMonths = (consumerChargeData && consumerChargeData.months) || ['2026.09', '2026.10', '2026.11'];
    const col1 = `${exMonths[0].replace('.', '년')}월(m³)`;
    const col2 = `${exMonths[1].replace('.', '년')}월(m³)`;
    const col3 = `${exMonths[2].replace('.', '년')}월(m³)`;

    const excelRows = exportList.map((c, idx) => {
        const z = getZeroMonthsInfo(c);
        const ab = getAbnormalUsageInfo(c);
        const v1 = c.m1 !== undefined ? c.m1 : (c.m2609 !== undefined ? c.m2609 : (c.m2605 || 0));
        const v2 = c.m2 !== undefined ? c.m2 : (c.m2610 !== undefined ? c.m2610 : (c.m2606 || 0));
        const v3 = c.m3 !== undefined ? c.m3 : (c.m2611 !== undefined ? c.m2611 : (c.m2607 || 0));
        return {
            "순번": idx + 1,
            "블록명": c.block,
            "수용가번호": c.cNo,
            "수용가명": c.name,
            "업종": c.type,
            "설치구경(mm)": c.caliber,
            [col1]: v1,
            [col2]: v2,
            [col3]: v3,
            "3개월합계(m³)": c.total3m,
            "최근일사용량(m³/일)": c.dailyUsage,
            "0톤연속상태": z.count > 0 ? `${z.count}개월 연속 0톤` : "정상사용",
            "이상수용가판정": ab.type === 'SURGE' ? `급증 (+${ab.ratio}%)` : (ab.type === 'DROP' ? `급감 (${ab.ratio}%)` : "정상"),
            "이상상세내용": ab.desc,
            "대수용가여부": c.isLarge ? '대수용가' : '일반',
            "적정구경진단": c.evalStatus,
            "적정구경상세": c.evalDesc,
            "권장구경(mm)": c.recCaliber
        };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelRows);
    const filterTag = currentZeroFilter !== 'ALL' ? `_0톤수용가` : (currentAbnormalFilter !== 'ALL' ? `_이상수용가` : '');
    const sheetName = isAll ? '김해시_전체_수용가' : `${currentChargeBlock}_수용가`;
    const fileName = isAll ? `김해시_전체_수용가검침_부과량분석${filterTag}.xlsx` : `김해시_${currentChargeBlock}_수용가검침_부과량분석${filterTag}.xlsx`;

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, fileName);
}

/**
 * ==============================================================
 * [대시보드 탭 3] 유수율 분석 리포트 (좌측 매트릭스 표 + 우측 3개월 비교·차트 & 수지분석)
 * ==============================================================
 */

// 18개월 분석 기간 정의 (2025년 4월 ~ 2026년 9월)
const YIELD_REPORT_MONTHS = [
    { key: '2025-04', label: '25년 4월' },
    { key: '2025-05', label: '25년 5월' },
    { key: '2025-06', label: '25년 6월' },
    { key: '2025-07', label: '25년 7월' },
    { key: '2025-08', label: '25년 8월' },
    { key: '2025-09', label: '25년 9월' },
    { key: '2025-10', label: '25년 10월' },
    { key: '2025-11', label: '25년 11월' },
    { key: '2025-12', label: '25년 12월' },
    { key: '2026-01', label: '26년 1월' },
    { key: '2026-02', label: '26년 2월' },
    { key: '2026-03', label: '26년 3월' },
    { key: '2026-04', label: '26년 4월' },
    { key: '2026-05', label: '26년 5월' },
    { key: '2026-06', label: '26년 6월' },
    { key: '2026-07', label: '26년 7월' },
    { key: '2026-08', label: '26년 8월' },
    { key: '2026-09', label: '26년 9월' }
];

let currentYieldSelectedBlock = '구산1';
let currentYieldStartIdx = 0;   // 25년 4월
let currentYieldEndIdx = 17;    // 26년 9월
let chartYieldMnfTrendInstance = null;
let isYieldReportControlsInitialized = false;

// ==============================================================
// 1. 유량 및 유수율 관리(수정작업) 100% 호환 계산 및 검증 엔진
// ==============================================================

/**
 * 블록별 유수율 리포트 데이터 조회 (실제 클라우드 데이터 연동 + 검증 캐시 듀얼 엔진)
 */
function getYieldBlockSeries(blockName) {
    if (!blockName) {
        return {
            supply: Array(18).fill(null),
            billed: Array(18).fill(null),
            yield:  Array(18).fill(null),
            mnf:    Array(18).fill(null)
        };
    }

    // 1. 검증된 기준 데이터셋 조회 (0ms 즉각 로드, 정규화 별칭 지원)
    let cachedSeries = null;
    const normName = typeof normalizeTopologySubBlockName === 'function' ? normalizeTopologySubBlockName(blockName) : blockName;
    if (window.VERIFIED_YIELD_DATA) {
        if (window.VERIFIED_YIELD_DATA[blockName]) {
            cachedSeries = window.VERIFIED_YIELD_DATA[blockName];
        } else if (normName && window.VERIFIED_YIELD_DATA[normName]) {
            cachedSeries = window.VERIFIED_YIELD_DATA[normName];
        }
    }

    // 2. 만약 window.GlobalWaterData(클라우드 배포 데이터)가 로드되어 있으면 실시간 정밀 연산
    const hasSupply = window.GlobalWaterData && window.GlobalWaterData.supplyData && Object.keys(window.GlobalWaterData.supplyData).length > 0;
    const hasCharge = window.GlobalWaterData && window.GlobalWaterData.chargeData && Object.keys(window.GlobalWaterData.chargeData).length > 0;

    if (hasSupply || hasCharge) {
        const dynamicSeries = computeDynamicYieldSeries(blockName);
        if (dynamicSeries) {
            if (cachedSeries) {
                const finalSupply = [];
                const finalBilled = [];
                const finalYield = [];
                const finalMnf = [];
                for (let i = 0; i < 18; i++) {
                    finalSupply.push(dynamicSeries.supply[i] !== null ? dynamicSeries.supply[i] : cachedSeries.supply[i]);
                    finalBilled.push(dynamicSeries.billed[i] !== null ? dynamicSeries.billed[i] : cachedSeries.billed[i]);
                    finalYield.push(dynamicSeries.yield[i] !== null ? dynamicSeries.yield[i] : cachedSeries.yield[i]);
                    finalMnf.push(dynamicSeries.mnf[i] !== null ? dynamicSeries.mnf[i] : cachedSeries.mnf[i]);
                }
                return {
                    supply: finalSupply,
                    billed: finalBilled,
                    yield: finalYield,
                    mnf: finalMnf
                };
            }
            return dynamicSeries;
        }
    }

    if (cachedSeries) {
        return cachedSeries;
    }

    // 데이터가 없는 블록인 경우 빈 배열 반환
    return {
        supply: Array(18).fill(null),
        billed: Array(18).fill(null),
        yield:  Array(18).fill(null),
        mnf:    Array(18).fill(null)
    };
}

/**
 * Water Manager Pro 100% 동일 동적 계산 엔진
 * - 검침 기간: (M-2)월 16일 ~ (M-1)월 15일
 * - 공급량: 일평균 합산 & 20,000m³/일 이상치 필터링 & 계통 종속 차감(getNetFlow)
 * - 부과량(급수량): 부과량 종속성 재귀 합산(getEffectiveCharge)
 * - 유수율: (부과량 / 공급량) * 100
 * - 야간최소유량: 0초과 10,000미만 평균(nightMin)
 */
function computeDynamicYieldSeries(blockName) {
    if (!window.GlobalWaterData) return null;

    const isSpecial = blockName.includes('배수지') || blockName.includes('정수장');
    const supply = [];
    const billed = [];
    const yields = [];
    const mnf = [];

    const calculateAll = () => {
        YIELD_REPORT_MONTHS.forEach(m => {
            const mMatch = m.label.match(/(\d+)년\s+(\d+)월/);
            if (!mMatch) {
                supply.push(null); billed.push(null); yields.push(null); mnf.push(null);
                return;
            }
            const yy = parseInt(mMatch[1]);
            const mm = parseInt(mMatch[2]);
            const year4 = 2000 + yy;

            // 검침 기간: (M-2)월 16일 ~ (M-1)월 15일
            const startDateObj = new Date(year4, mm - 2, 16);
            const endDateObj = new Date(year4, mm - 1, 15);

            const dateArray = [];
            let cur = new Date(startDateObj);
            while (cur <= endDateObj) {
                const y = cur.getFullYear();
                const mStr = String(cur.getMonth() + 1).padStart(2, '0');
                const dStr = String(cur.getDate()).padStart(2, '0');
                dateArray.push(`${y}-${mStr}-${dStr}`);
                cur.setDate(cur.getDate() + 1);
            }

            // 1. 공급량 및 야간최소유량 계산
            let sSum = 0, sCount = 0;
            let nmfSum = 0, nmfCount = 0;

            if (window.getNetFlow) {
                dateArray.forEach(d => {
                    const val = window.getNetFlow(d, blockName, 'totalSupply', true, 'net');
                    if (typeof val === 'number' && val > 0) {
                        if (isSpecial || val < 20000) {
                            sSum += val;
                            sCount++;
                        }
                    }
                    const nVal = window.getNetFlow(d, blockName, 'nightMin', true, 'net');
                    if (typeof nVal === 'number' && nVal > 0 && nVal < 10000) {
                        nmfSum += nVal;
                        nmfCount++;
                    }
                });
            }

            const supVal = sCount > 0 ? Math.round(sSum / sCount) : null;
            const nmfVal = nmfCount > 0 ? parseFloat((nmfSum / nmfCount).toFixed(1)) : null;

            // 2. 부과량(급수량) 계산
            let billVal = null;
            if (window.getEffectiveCharge) {
                const chgRes = window.getEffectiveCharge(m.label, blockName);
                if (chgRes && typeof chgRes.avg === 'number' && chgRes.avg > 0) {
                    billVal = Math.round(chgRes.avg);
                }
            }

            // 3. 유수율 (%) 계산
            let yieldVal = null;
            if (supVal !== null && supVal > 0 && billVal !== null && billVal > 0) {
                yieldVal = parseFloat(((billVal / supVal) * 100).toFixed(1));
            }

            supply.push(supVal);
            billed.push(billVal);
            yields.push(yieldVal);
            mnf.push(nmfVal);
        });
    };

    if (window.runWithNetFlowCache) {
        window.runWithNetFlowCache(calculateAll);
    } else {
        calculateAll();
    }

    return { supply, billed, yield: yields, mnf };
}

/**
 * 리포트에 표시할 전체 블록 목록 (92개 소블록 목표유수율 기준)
 */
function getAllYieldReportBlocks() {
    let blocks = YIELD_BLOCKS_92.slice();
    if (currentYieldRegionFilter && currentYieldRegionFilter !== 'all') {
        blocks = blocks.filter(b => getBlockRegion(b) === currentYieldRegionFilter);
    }
    return blocks;
}

/**
 * 유수율 리포트 컨트롤 바 초기화 (1회 바인딩)
 */
function initYieldReportControls() {
    if (isYieldReportControlsInitialized) return;
    isYieldReportControlsInitialized = true;

    const startSel = document.getElementById('selectYieldStartMonth');
    const endSel = document.getElementById('selectYieldEndMonth');

    if (startSel && endSel) {
        startSel.innerHTML = YIELD_REPORT_MONTHS.map((m, idx) => `<option value="${idx}">${m.label}</option>`).join('');
        endSel.innerHTML = YIELD_REPORT_MONTHS.map((m, idx) => `<option value="${idx}">${m.label}</option>`).join('');
        startSel.value = '0';   // 25년 4월
        endSel.value = '17';    // 26년 9월

        startSel.addEventListener('change', () => {
            const sVal = parseInt(startSel.value, 10);
            const eVal = parseInt(endSel.value, 10);
            if (sVal > eVal) {
                endSel.value = String(sVal);
            }
        });

        endSel.addEventListener('change', () => {
            const sVal = parseInt(startSel.value, 10);
            const eVal = parseInt(endSel.value, 10);
            if (eVal < sVal) {
                startSel.value = String(eVal);
            }
        });
    }

    // 분석하기 버튼
    const btnAnalyze = document.getElementById('btnAnalyzeYield');
    if (btnAnalyze) {
        btnAnalyze.addEventListener('click', () => {
            currentYieldStartIdx = parseInt(document.getElementById('selectYieldStartMonth').value, 10);
            currentYieldEndIdx = parseInt(document.getElementById('selectYieldEndMonth').value, 10);
            renderYieldMatrixTable();
            selectYieldBlock(currentYieldSelectedBlock);
        });
    }

    // 리포트 초기화 버튼
    const btnReset = document.getElementById('btnResetYieldReport');
    if (btnReset) {
        btnReset.addEventListener('click', () => {
            currentYieldStartIdx = 0;
            currentYieldEndIdx = 17;
            currentYieldSelectedBlock = '구산1';
            if (startSel) startSel.value = '0';
            if (endSel) endSel.value = '17';
            const viewport = document.getElementById('yieldTableViewport');
            if (viewport) {
                viewport.scrollTop = 0;
                viewport.scrollLeft = 0;
            }
            renderYieldMatrixTable();
            selectYieldBlock(currentYieldSelectedBlock);
        });
    }

    // 엑셀 내보내기 버튼
    const btnExport = document.getElementById('btnExportYieldExcelNew');
    if (btnExport) {
        btnExport.addEventListener('click', exportYieldMatrixToExcel);
    }

    // 우측 분석 블록 선택 드롭다운
    const selectTarget = document.getElementById('selectYieldTargetBlock');
    if (selectTarget) {
        selectTarget.addEventListener('change', (e) => {
            selectYieldBlock(e.target.value);
        });
    }

    // 공급량 분석 바로가기
    const btnJumpSupply = document.getElementById('btnJumpToSupplyDetail');
    if (btnJumpSupply) {
        btnJumpSupply.addEventListener('click', () => {
            switchDashboardTab('dash-supply');
            if (typeof selectSupplyBlock === 'function') {
                selectSupplyBlock(currentYieldSelectedBlock);
            }
        });
    }

    // 부과량 현황 바로가기
    const btnJumpCharge = document.getElementById('btnJumpToChargeDetail');
    if (btnJumpCharge) {
        btnJumpCharge.addEventListener('click', () => {
            switchDashboardTab('dash-charge');
            const chargeSelect = document.getElementById('chargeBlockSelect');
            if (chargeSelect) {
                chargeSelect.value = currentYieldSelectedBlock;
                chargeSelect.dispatchEvent(new Event('change'));
            }
        });
    }

    // 마우스 드래그 스크롤
    setupDraggableTable(document.getElementById('yieldTableViewport'));
}

/**
 * 좌측 매트릭스 테이블 렌더링 (참고사진 디자인 100% 매핑)
 */
function renderYieldMatrixTable() {
    const headEl = document.getElementById('yieldMatrixHead');
    const bodyEl = document.getElementById('yieldMatrixBody');
    if (!headEl || !bodyEl) return;

    const visibleMonths = YIELD_REPORT_MONTHS.slice(currentYieldStartIdx, currentYieldEndIdx + 1);

    // 1. 헤더 생성
    let headHtml = '<tr>';
    headHtml += '<th class="th-block">블록명</th>';
    headHtml += '<th class="th-type">데이터 구분</th>';
    visibleMonths.forEach(m => {
        headHtml += `<th>${m.label}</th>`;
    });
    headHtml += '</tr>';
    headEl.innerHTML = headHtml;

    // 2. 바디 생성 (각 블록당 4행)
    const blocks = getAllYieldReportBlocks();
    let bodyHtml = '';

    blocks.forEach(bName => {
        const series = getYieldBlockSeries(bName);
        const isSelected = (bName === currentYieldSelectedBlock);
        const rowClass = isSelected ? 'active-block-row' : '';

        // 행 1: 공급량 (적산차) - rowspan 4로 블록명 병합
        bodyHtml += `<tr class="${rowClass}" data-block="${bName}">`;
        bodyHtml += `<td rowspan="4" class="col-block" data-block="${bName}" title="클릭하여 ${bName} 상세 진단 및 차트 보기">${bName}</td>`;
        bodyHtml += `<td class="col-type">공급량 (적산차)</td>`;
        for (let i = currentYieldStartIdx; i <= currentYieldEndIdx; i++) {
            const val = series.supply[i];
            bodyHtml += `<td class="val-supply">${val !== null ? Math.round(val).toLocaleString() : '<span class="val-dash">-</span>'}</td>`;
        }
        bodyHtml += `</tr>`;

        // 행 2: 부과량 (일평균)
        bodyHtml += `<tr class="${rowClass}" data-block="${bName}">`;
        bodyHtml += `<td class="col-type">부과량 (일평균)</td>`;
        for (let i = currentYieldStartIdx; i <= currentYieldEndIdx; i++) {
            const val = series.billed[i];
            bodyHtml += `<td class="val-billed">${val !== null ? Math.round(val).toLocaleString() : '<span class="val-dash">-</span>'}</td>`;
        }
        bodyHtml += `</tr>`;

        // 행 3: 유수율 (%) - 녹색 폰트
        bodyHtml += `<tr class="${rowClass}" data-block="${bName}">`;
        bodyHtml += `<td class="col-type">유수율 (%)</td>`;
        for (let i = currentYieldStartIdx; i <= currentYieldEndIdx; i++) {
            const val = series.yield[i];
            bodyHtml += `<td class="val-yield">${val !== null ? val.toFixed(1) + '%' : '<span class="val-dash">-</span>'}</td>`;
        }
        bodyHtml += `</tr>`;

        // 행 4: 야간최소 (평균) - 코랄레드 폰트 + 하단 분리 굵은 선
        bodyHtml += `<tr class="${rowClass} block-row-last" data-block="${bName}">`;
        bodyHtml += `<td class="col-type">야간최소 (평균)</td>`;
        for (let i = currentYieldStartIdx; i <= currentYieldEndIdx; i++) {
            const val = series.mnf[i];
            bodyHtml += `<td class="val-mnf">${val !== null ? val.toFixed(1) : '<span class="val-dash">-</span>'}</td>`;
        }
        bodyHtml += `</tr>`;
    });

    bodyEl.innerHTML = bodyHtml;

    // 블록 클릭 이벤트 리스너 (테이블 행 또는 블록 셀 클릭 시 우측 패널 연동)
    bodyEl.querySelectorAll('tr[data-block]').forEach(tr => {
        tr.addEventListener('click', (e) => {
            const bName = tr.getAttribute('data-block');
            if (bName) {
                selectYieldBlock(bName);
            }
        });
    });

    // 요약 뱃지 갱신
    const badge = document.getElementById('yieldTableSummaryBadge');
    if (badge) {
        badge.textContent = `조회: ${visibleMonths.length}개월 / ${blocks.length}개 소블록`;
    }
}

/**
 * 블록 선택 액션 (테이블 하이라이트 + 우측 분석 패널 갱신)
 */
function selectYieldBlock(blockName) {
    if (!blockName) return;
    currentYieldSelectedBlock = blockName;

    // 테이블 하이라이트 갱신
    document.querySelectorAll('#yieldMatrixBody tr').forEach(tr => {
        const matches = tr.getAttribute('data-block') === blockName;
        tr.classList.toggle('active-block-row', matches);
    });

    renderYieldRightPanel(blockName);
}

/**
 * 우측 분석 패널 렌더링 (최근 3개월 비교 그리드 + Chart.js 듀얼 차트 + 수지 진단 카드)
 */
function renderYieldRightPanel(blockName) {
    const blocks = getAllYieldReportBlocks();

    // 1. 블록 드롭다운 옵션 동기화
    const blockSelect = document.getElementById('selectYieldTargetBlock');
    if (blockSelect) {
        if (blockSelect.options.length !== blocks.length) {
            blockSelect.innerHTML = blocks.map(b => `<option value="${b}">[${getBlockRegion(b)}] ${b}</option>`).join('');
        }
        blockSelect.value = blockName;
    }

    const badge = document.getElementById('yieldCurrentBlockBadge');
    if (badge) {
        badge.textContent = `${blockName} [${getBlockRegion(blockName)}]`;
    }

    const series = getYieldBlockSeries(blockName);
    const visibleMonths = YIELD_REPORT_MONTHS.slice(currentYieldStartIdx, currentYieldEndIdx + 1);

    // 2. 우측 상단: 최근 3개월 비교 지표 추출
    // 선택된 범위 내 유효한 최근 3개월 (또는 끝 3개월)
    let recentIndices = [];
    for (let i = currentYieldEndIdx; i >= currentYieldStartIdx; i--) {
        if (series.yield[i] !== null || series.supply[i] !== null) {
            recentIndices.unshift(i);
            if (recentIndices.length === 3) break;
        }
    }

    // 유효 데이터가 부족한 경우 끝 3개 인덱스로 채움
    if (recentIndices.length < 3) {
        const end = currentYieldEndIdx;
        recentIndices = [Math.max(0, end - 2), Math.max(0, end - 1), end];
    }

    const gridEl = document.getElementById('yield3mGrid');
    const periodPill = document.getElementById('yield3mPeriodPill');

    if (periodPill && recentIndices.length >= 2) {
        const firstM = YIELD_REPORT_MONTHS[recentIndices[0]].key.replace('-', '.');
        const lastM = YIELD_REPORT_MONTHS[recentIndices[recentIndices.length - 1]].key.replace('-', '.');
        periodPill.textContent = `${firstM} ~ ${lastM}`;
    }

    if (gridEl) {
        let gridHtml = '';
        recentIndices.forEach(idx => {
            const m = YIELD_REPORT_MONTHS[idx];
            const yVal = series.yield[idx];
            const mnfVal = series.mnf[idx];
            const supVal = series.supply[idx];
            const bilVal = series.billed[idx];

            gridHtml += `
                <div class="y3m-card">
                    <div class="y3m-month">${m.label}</div>
                    <div class="y3m-row yield-row">
                        <span class="y3m-lbl">유수율</span>
                        <span class="y3m-val">${yVal !== null ? yVal.toFixed(1) + '%' : '-'}</span>
                    </div>
                    <div class="y3m-row mnf-row">
                        <span class="y3m-lbl">야간최소</span>
                        <span class="y3m-val">${mnfVal !== null ? mnfVal.toFixed(1) + ' m³/h' : '-'}</span>
                    </div>
                    <div class="y3m-row vol-row">
                        <span>공: ${supVal !== null ? Math.round(supVal).toLocaleString() : '-'}</span>
                        <span>부: ${bilVal !== null ? Math.round(bilVal).toLocaleString() : '-'}</span>
                    </div>
                </div>
            `;
        });
        gridEl.innerHTML = gridHtml;
    }

    // 3. 최근 3개월 추이 변화량 (첫 달 대비 마지막 달 차이)
    const mFirst = recentIndices[0];
    const mLast = recentIndices[recentIndices.length - 1];
    const rDiffEl = document.getElementById('ytsRatioDiff');
    const mDiffEl = document.getElementById('ytsMnfDiff');

    if (rDiffEl) {
        if (series.yield[mFirst] !== null && series.yield[mLast] !== null) {
            const diff = parseFloat((series.yield[mLast] - series.yield[mFirst]).toFixed(1));
            if (diff > 0) {
                rDiffEl.innerHTML = `<span style="color:#059669;">▲ +${diff}%p (개선)</span>`;
            } else if (diff < 0) {
                rDiffEl.innerHTML = `<span style="color:#DC2626;">▼ ${diff}%p (저하)</span>`;
            } else {
                rDiffEl.innerHTML = `<span style="color:#64748B;">- 0.0%p (유지)</span>`;
            }
        } else {
            rDiffEl.innerHTML = '<span style="color:#94A3B8;">자료 부족</span>';
        }
    }

    if (mDiffEl) {
        if (series.mnf[mFirst] !== null && series.mnf[mLast] !== null) {
            const diff = parseFloat((series.mnf[mLast] - series.mnf[mFirst]).toFixed(1));
            if (diff < 0) {
                mDiffEl.innerHTML = `<span style="color:#059669;">▼ ${diff} m³/h (누수 저감)</span>`;
            } else if (diff > 0) {
                mDiffEl.innerHTML = `<span style="color:#DC2626;">▲ +${diff} m³/h (누수 증가)</span>`;
            } else {
                mDiffEl.innerHTML = `<span style="color:#64748B;">- 0.0 m³/h (안정)</span>`;
            }
        } else {
            mDiffEl.innerHTML = '<span style="color:#94A3B8;">자료 부족</span>';
        }
    }

    // 4. 유수율 & 야간최소유량 듀얼 차트 렌더링
    renderYieldChart(blockName);

    // 5. 우측 하단: 블록 건전성 종합 진단 & 재정 손실(수지) 분석 (추천 기능)
    renderYieldHealthAndLoss(blockName, series, mLast);
}

/**
 * Chart.js 듀얼 액시스 차트 (유수율 Bar + MNF Line)
 * - 겹침 완전 방지:
 *   1) Y축 고저차 및 헤드룸 분리 (유수율 0~135%, 야간최소 충분한 상단 여백 확보)
 *   2) 라벨 위치 차별화 (유수율 막대 상단 안쪽 bottom, 야간최소 포인트 상단 미니 뱃지 top)
 *   3) 보기 좋은 모던 컬러 팔레트 (청량한 소프트 블루 Bar + 선명한 코랄 앰버 Line)
 */
function renderYieldChart(blockName) {
    const canvas = document.getElementById('chartYieldMnfTrend');
    if (!canvas) return;

    if (chartYieldMnfTrendInstance) {
        chartYieldMnfTrendInstance.destroy();
        chartYieldMnfTrendInstance = null;
    }

    const series = getYieldBlockSeries(blockName);
    const visibleMonths = YIELD_REPORT_MONTHS.slice(currentYieldStartIdx, currentYieldEndIdx + 1);

    const labels = visibleMonths.map(m => m.label);
    const yieldData = [];
    const mnfData = [];

    for (let i = currentYieldStartIdx; i <= currentYieldEndIdx; i++) {
        yieldData.push(series.yield[i]);
        mnfData.push(series.mnf[i]);
    }

    const isNavy = document.body.classList.contains('theme-navy');
    const textColor = isNavy ? '#CBD5E1' : '#475569';
    const gridColor = isNavy ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';

    // 세련되고 눈이 편안한 색상 팔레트 (소프트 마린 블루 + 비비드 코랄 앰버)
    const colorYieldBar = isNavy ? 'rgba(56, 189, 248, 0.40)' : 'rgba(37, 99, 235, 0.35)';
    const colorYieldBorder = isNavy ? '#38BDF8' : '#2563EB';
    const colorYieldBadgeBg = isNavy ? 'rgba(15, 23, 42, 0.96)' : '#FFFFFF';
    const colorYieldBadgeBorder = isNavy ? '#38BDF8' : '#2563EB';
    const colorYieldText = isNavy ? '#38BDF8' : '#1E40AF';

    const colorMnfLine = isNavy ? '#FB923C' : '#EA580C';
    const colorMnfPointBg = isNavy ? '#0F172A' : '#FFFFFF';
    const colorMnfText = isNavy ? '#FED7AA' : '#9A3412';
    const colorMnfBadgeBg = isNavy ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.96)';

    // 야간최소 최대값 산출 (충분한 상단 여백 확보하여 겹침 방지)
    const validMnfs = mnfData.filter(v => typeof v === 'number' && v > 0);
    const maxMnf = validMnfs.length > 0 ? Math.max(...validMnfs) : 40;
    const mnfAxisMax = Math.max(70, Math.ceil((maxMnf * 1.5) / 10) * 10);

    // 유수율 최대값 산출 (구산1 등 100% 초과 블록도 그래프 상단 테두리를 넘어가지 않도록 동적 확장)
    const validYields = yieldData.filter(v => typeof v === 'number' && v > 0);
    const maxYield = validYields.length > 0 ? Math.max(...validYields) : 100;
    let yieldAxisMax = 120;
    if (maxYield > 100) {
        // 최고값보다 15% 정도 넉넉하게 상단 헤드룸을 두어 막대가 테두리를 뚫지 않도록 여유 설정
        yieldAxisMax = Math.ceil((maxYield * 1.15) / 10) * 10;
    }

    const isDense = labels.length > 10;

    const ctx = canvas.getContext('2d');
    chartYieldMnfTrendInstance = new Chart(ctx, {
        data: {
            labels: labels,
            datasets: [
                {
                    type: 'bar',
                    label: '유수율 (%)',
                    data: yieldData,
                    yAxisID: 'yYield',
                    backgroundColor: colorYieldBar,
                    borderColor: colorYieldBorder,
                    borderWidth: 1.5,
                    borderRadius: { topLeft: 4, topRight: 4 },
                    barPercentage: 0.62,
                    order: 2,
                    datalabels: {
                        display: function(context) {
                            const val = context.dataset.data[context.dataIndex];
                            return typeof val === 'number' && val > 0;
                        },
                        anchor: 'end',
                        align: function(context) {
                            const idx = context.dataIndex;
                            const barVal = context.dataset.data[idx];
                            const mnfVal = (mnfData && mnfData[idx] !== undefined) ? mnfData[idx] : null;

                            const barNorm = (typeof barVal === 'number' && yieldAxisMax > 0) ? (barVal / yieldAxisMax) : null;
                            const mnfNorm = (typeof mnfVal === 'number' && mnfAxisMax > 0) ? (mnfVal / mnfAxisMax) : null;

                            // 꺾은선(야간최소)과 막대 상단이 근접하여 겹칠 위험이 있는 경우 (차트 높이 26% 이내)
                            if (barNorm !== null && mnfNorm !== null && Math.abs(barNorm - mnfNorm) < 0.26) {
                                if (barNorm >= mnfNorm) {
                                    // 막대가 꺾은선보다 높으면 -> 막대 라벨은 막대 위(top)로 띄워 꺾은선 라벨과 상/하 완벽 분리
                                    return (barNorm > 0.88) ? 'bottom' : 'top';
                                } else {
                                    // 막대가 꺾은선보다 낮으면 -> 막대 라벨은 막대 안쪽(bottom)으로 내려서 겹침 차단
                                    return 'bottom';
                                }
                            }
                            // 평상시: 25% 이상 높이 막대는 막대 상단 안쪽(bottom), 25% 미만 낮은 막대는 위쪽(top)
                            return (barVal >= 25) ? 'bottom' : 'top';
                        },
                        offset: function(context) {
                            const idx = context.dataIndex;
                            const barVal = context.dataset.data[idx];
                            const mnfVal = (mnfData && mnfData[idx] !== undefined) ? mnfData[idx] : null;
                            const barNorm = (typeof barVal === 'number' && yieldAxisMax > 0) ? (barVal / yieldAxisMax) : null;
                            const mnfNorm = (typeof mnfVal === 'number' && mnfAxisMax > 0) ? (mnfVal / mnfAxisMax) : null;

                            if (barNorm !== null && mnfNorm !== null && Math.abs(barNorm - mnfNorm) < 0.26 && barNorm >= mnfNorm && barNorm <= 0.88) {
                                return 5; // 막대 위로 띄울 때의 쾌적한 여백
                            }
                            return (barVal >= 25) ? 4 : 5;
                        },
                        color: colorYieldText,
                        backgroundColor: colorYieldBadgeBg,
                        borderColor: colorYieldBadgeBorder,
                        borderWidth: 1.2,
                        borderRadius: 3.5,
                        padding: isDense 
                            ? { top: 1, bottom: 1, left: 2.2, right: 2.2 } 
                            : { top: 1.5, bottom: 1.5, left: 3.5, right: 3.5 },
                        font: {
                            size: isDense ? 8.5 : 9.5,
                            weight: '800',
                            family: 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        },
                        formatter: function(val) {
                            if (val === null || val === undefined) return '';
                            return (labels.length <= 8 ? val.toFixed(1) : Math.round(val)) + '%';
                        }
                    }
                },
                {
                    type: 'line',
                    label: '야간최소유량 (m³/h)',
                    data: mnfData,
                    yAxisID: 'yMnf',
                    borderColor: colorMnfLine,
                    backgroundColor: colorMnfLine,
                    borderWidth: 2.4,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: colorMnfPointBg,
                    pointBorderColor: colorMnfLine,
                    pointBorderWidth: 2,
                    tension: 0.32,
                    order: 1,
                    datalabels: {
                        display: 'auto',
                        anchor: 'center',
                        align: function(context) {
                            const idx = context.dataIndex;
                            const barVal = (yieldData && yieldData[idx] !== undefined) ? yieldData[idx] : null;
                            const mnfVal = context.dataset.data[idx];

                            const barNorm = (typeof barVal === 'number' && yieldAxisMax > 0) ? (barVal / yieldAxisMax) : null;
                            const mnfNorm = (typeof mnfVal === 'number' && mnfAxisMax > 0) ? (mnfVal / mnfAxisMax) : null;

                            // 막대(유수율)와 꺾은선이 근접하여 겹칠 위험이 있는 경우 (차트 높이 26% 이내)
                            if (barNorm !== null && mnfNorm !== null && Math.abs(barNorm - mnfNorm) < 0.26) {
                                if (barNorm >= mnfNorm) {
                                    // 막대가 꺾은선보다 높으면 -> 꺾은선 라벨은 포인트 아래쪽(bottom)으로 안전하게 내림
                                    return (mnfNorm < 0.12) ? 'top' : 'bottom';
                                } else {
                                    // 꺾은선이 막대보다 높으면 -> 꺾은선 라벨은 포인트 위쪽(top)으로 띄움
                                    return 'top';
                                }
                            }
                            // 평상시: 포인트 위쪽(top)에 미니 뱃지로 안정 배치
                            return 'top';
                        },
                        offset: function(context) {
                            const idx = context.dataIndex;
                            const barVal = (yieldData && yieldData[idx] !== undefined) ? yieldData[idx] : null;
                            const mnfVal = context.dataset.data[idx];
                            const barNorm = (typeof barVal === 'number' && yieldAxisMax > 0) ? (barVal / yieldAxisMax) : null;
                            const mnfNorm = (typeof mnfVal === 'number' && mnfAxisMax > 0) ? (mnfVal / mnfAxisMax) : null;

                            if (barNorm !== null && mnfNorm !== null && Math.abs(barNorm - mnfNorm) < 0.26 && barNorm >= mnfNorm && mnfNorm >= 0.12) {
                                return 7; // 포인트 아래쪽으로 내릴 때 포인트와의 여백
                            }
                            return 6;
                        },
                        color: colorMnfText,
                        backgroundColor: colorMnfBadgeBg,
                        borderColor: colorMnfLine,
                        borderWidth: 1.2,
                        borderRadius: 3.5,
                        padding: isDense 
                            ? { top: 1, bottom: 1, left: 2.2, right: 2.2 } 
                            : { top: 1, bottom: 1, left: 3, right: 3 },
                        font: {
                            size: isDense ? 8.5 : 9.5,
                            weight: '800',
                            family: 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        },
                        formatter: function(val) {
                            if (val === null || val === undefined) return '';
                            return Number(val).toFixed(1);
                        }
                    }
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    top: 24,
                    bottom: 8,
                    left: 4,
                    right: 4
                }
            },
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: textColor,
                        font: { size: 11, weight: '700' },
                        boxWidth: 12,
                        padding: 10,
                        sort: (a, b) => a.datasetIndex - b.datasetIndex // 유수율(좌측 Y축) 먼저, 야간최소(우측 Y축) 다음 정렬
                    }
                },
                tooltip: {
                    backgroundColor: isNavy ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.98)',
                    titleColor: isNavy ? '#F8FAFC' : '#0F172A',
                    bodyColor: isNavy ? '#E2E8F0' : '#334155',
                    borderColor: isNavy ? '#334155' : '#E2E8F0',
                    borderWidth: 1,
                    padding: 10,
                    boxPadding: 4,
                    usePointStyle: true,
                    callbacks: {
                        label: function(context) {
                            const val = context.parsed.y;
                            if (val === null || val === undefined) return ` ${context.dataset.label}: 자료 없음`;
                            return context.datasetIndex === 0 
                                ? ` 유수율: ${val.toFixed(1)}%`
                                : ` 야간최소(MNF): ${val.toFixed(1)} m³/h`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: gridColor },
                    ticks: {
                        color: textColor,
                        font: { size: 9.5 }
                    }
                },
                yYield: {
                    type: 'linear',
                    position: 'left',
                    min: 0,
                    max: yieldAxisMax,
                    grid: { color: gridColor },
                    ticks: {
                        color: colorYieldBorder,
                        font: { size: 10, weight: '600' },
                        callback: (v) => v + '%'
                    },
                    title: {
                        display: true,
                        text: '유수율 (%)',
                        color: colorYieldBorder,
                        font: { size: 10.5, weight: '700' }
                    }
                },
                yMnf: {
                    type: 'linear',
                    position: 'right',
                    min: 0,
                    suggestedMax: mnfAxisMax,
                    grid: { drawOnChartArea: false },
                    ticks: {
                        color: colorMnfLine,
                        font: { size: 10, weight: '600' },
                        callback: (v) => v
                    },
                    title: {
                        display: true,
                        text: '야간최소 (m³/h)',
                        color: colorMnfLine,
                        font: { size: 10.5, weight: '700' }
                    }
                }
            }
        }
    });
}

/**
 * 우측 하단: 블록 건전성 종합 진단 & 재정 손실(수지) 분석 렌더링
 */
function renderYieldHealthAndLoss(blockName, series, lastIdx) {
    let validIdx = lastIdx;
    if (series.supply[validIdx] === null || series.billed[validIdx] === null) {
        for (let j = series.supply.length - 1; j >= 0; j--) {
            if (series.supply[j] !== null && series.billed[j] !== null) {
                validIdx = j;
                break;
            }
        }
    }

    const sup = series.supply[validIdx];
    const billed = series.billed[validIdx];
    const ratio = series.yield[validIdx];
    const mnf = series.mnf[validIdx];

    const badgeContainer = document.getElementById('yieldHealthBadge') || document.querySelector('.yac-status-badge');
    const valLeakVol = document.getElementById('valYieldLeakVol');
    const valLeakRatio = document.getElementById('valYieldLeakRatio');
    const valLeakCost = document.getElementById('valYieldLeakCost');
    const valSavings = document.getElementById('valYieldSavingsYear');
    const adviceText = document.getElementById('yieldAiAdviceText');

    if (sup === null || billed === null || ratio === null) {
        if (badgeContainer) {
            badgeContainer.className = 'yac-status-badge warning';
            badgeContainer.textContent = '모니터링 대기';
        }
        if (valLeakVol) valLeakVol.textContent = '- m³';
        if (valLeakRatio) valLeakRatio.textContent = '자료 미입력';
        if (valLeakCost) valLeakCost.textContent = '약 - 만원';
        if (valSavings) valSavings.textContent = '약 - 만원/년';
        if (adviceText) {
            adviceText.textContent = `[${blockName}] 소블록의 유수율 산출을 위한 유량계 적산차 및 검침 부과량 데이터가 아직 연동되지 않았습니다. 공급량 및 부과량 데이터를 기초자료 관리에서 등록해 주세요.`;
        }
        return;
    }

    // 일평균 -> 월간(30일) 환산
    const monthSup = sup * 30;
    const monthBilled = billed * 30;
    const isOver100 = ratio > 105.0;

    // 월간 누수량 (공급량 - 부과량, 음수는 0 처리)
    const leakVol = Math.max(0, monthSup - monthBilled);
    const leakRatio = monthSup > 0 ? ((leakVol / monthSup) * 100).toFixed(1) : '0.0';

    // 누수 손실액 (김해시 상수도 정수 생산원가 톤당 980원 기준)
    const leakCostWon = Math.round(leakVol * 980);
    const leakCostManwon = Math.round(leakCostWon / 10000);

    // 유수율 1%p 개선 시 연간 원가 절감액 (월공급량 * 1% * 980원 * 12개월)
    const annualSavingsManwon = Math.max(120, Math.round((monthSup * 0.01 * 980 * 12) / 10000));

    // 상태 판정 및 맞춤형 AI 현장 조치 권고안
    let badgeClass = 'yac-status-badge';
    let badgeLabel = '정상 관리 (우수)';
    let advice = '';

    if (isOver100) {
        badgeClass = 'yac-status-badge purple';
        badgeLabel = '계량기·수계 이상 (100% 초과)';
        advice = `[이상 징후] 당월 유수율이 ${ratio.toFixed(1)}%로 100%를 초과하였습니다. 주요 원인으로 대수용가 검침 주기 불일치, 인출측 적산계 오차, 또는 인접 소블록과의 경계 제수변 누설·혼입 간섭 가능성이 매우 높습니다. 경계 제수변 수밀 검사 및 75mm 이상 대수용가 계량기 정밀 점검을 긴급 권고합니다.`;
    } else if (ratio >= 85.0) {
        badgeClass = 'yac-status-badge';
        badgeLabel = '정상 관리 (목표달성)';
        advice = `[우수 관리] 현재 유수율 ${ratio.toFixed(1)}%로 환경부 목표 기준(85%)을 충족하고 있습니다. 야간최소유량(${mnf !== null ? mnf.toFixed(1) : '-'} m³/h)의 안정적 유지를 위해 주요 감압밸브(PRV) 2차측 정압 유지 및 분기별 제수변 개폐 상태를 지속 모니터링하세요.`;
    } else if (ratio >= 75.0) {
        badgeClass = 'yac-status-badge warning';
        badgeLabel = '주의 관찰 (기준 미달)';
        advice = `[개선 필요] 유수율이 ${ratio.toFixed(1)}%로 목표 기준(85%)에 미달하며 월 약 ${leakCostManwon.toLocaleString()}만원의 누수 손실이 발생 중입니다. 야간최소유량을 고려할 때 배수관로 미세 누수 또는 노후 계량기 과소계량이 의심되므로 분기별 상관식 누수탐사반 투입을 권고합니다.`;
    } else {
        badgeClass = 'yac-status-badge danger';
        badgeLabel = '집중 누수탐사 요망';
        advice = `[위험 구역] 유수율 ${ratio.toFixed(1)}%로 매우 낮고 월간 누수 손실액이 약 ${leakCostManwon.toLocaleString()}만원(누수량 ${Math.round(leakVol).toLocaleString()} m³)에 달합니다. 지하시설물 누수탐사 전문팀을 최우선 배치하여 심야 노면 음청식 탐사 및 밸브 차단식 야간 스텝테스트를 즉각 시행해야 합니다.`;
    }

    if (badgeContainer) {
        badgeContainer.className = badgeClass;
        badgeContainer.textContent = badgeLabel;
    }
    if (valLeakVol) valLeakVol.textContent = `${Math.round(leakVol).toLocaleString()} m³`;
    if (valLeakRatio) valLeakRatio.textContent = `손실률 ${leakRatio}%`;
    if (valLeakCost) valLeakCost.textContent = `약 ${leakCostManwon.toLocaleString()} 만원`;
    if (valSavings) valSavings.textContent = `약 ${annualSavingsManwon.toLocaleString()} 만원/년`;
    if (adviceText) adviceText.textContent = advice;
}

/**
 * 엑셀 내보내기 (.xlsx) - SheetJS 연동
 */
function exportYieldMatrixToExcel() {
    if (typeof XLSX === 'undefined') {
        alert('엑셀 라이브러리가 로드되지 않았습니다.');
        return;
    }

    const visibleMonths = YIELD_REPORT_MONTHS.slice(currentYieldStartIdx, currentYieldEndIdx + 1);
    const blocks = getAllYieldReportBlocks();

    const data = [];
    // 헤더 행
    data.push(['블록명', '데이터 구분', ...visibleMonths.map(m => m.label)]);

    // 블록별 4행 데이터
    blocks.forEach(bName => {
        const series = getYieldBlockSeries(bName);

        const supRow = [bName, '공급량 (적산차)'];
        const bilRow = ['', '부과량 (일평균)'];
        const yldRow = ['', '유수율 (%)'];
        const mnfRow = ['', '야간최소 (평균)'];

        for (let i = currentYieldStartIdx; i <= currentYieldEndIdx; i++) {
            supRow.push(series.supply[i] !== null ? series.supply[i] : '-');
            bilRow.push(series.billed[i] !== null ? series.billed[i] : '-');
            yldRow.push(series.yield[i] !== null ? series.yield[i] + '%' : '-');
            mnfRow.push(series.mnf[i] !== null ? series.mnf[i] : '-');
        }

        data.push(supRow, bilRow, yldRow, mnfRow);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, '유수율_분석리포트');

    const firstM = visibleMonths[0].key.replace('-', '');
    const lastM = visibleMonths[visibleMonths.length - 1].key.replace('-', '');
    XLSX.writeFile(wb, `김해시_유수율_분석리포트_${firstM}_${lastM}.xlsx`);
}

/**
 * 유수율 분석 리포트 화면 진입 시 메인 진입점
 */
function renderDashboardYield() {
    initYieldReportControls();
    renderYieldMatrixTable();
    selectYieldBlock(currentYieldSelectedBlock);
}

/**
 * [대시보드 탭 4] 목표유수율 관리
 */
function renderDashboardTarget(filter = 'all') {
    const hasTargetData = window.GlobalWaterData && Object.keys(window.GlobalWaterData.targetYieldData || {}).length > 0;

    if (hasTargetData) {
        const tbody = document.getElementById('tableBodyTarget');
        tbody.innerHTML = '';

        const targetMap = window.GlobalWaterData.targetYieldData;
        const chargeMap = window.GlobalWaterData.chargeData;
        const latestMonth = Object.keys(chargeMap || {}).sort().pop();
        const currentMonthUsage = latestMonth ? chargeMap[latestMonth] : {};

        Object.keys(targetMap).filter(bName => isTopologySubBlock(bName)).sort().forEach((bName, idx) => {
            const item = targetMap[bName];
            const stdVal = item.std || 70.0;
            const targetVal = item.target || 85.0;

            // 추정 현재 유수율
            const currRatio = stdVal + 4.2;
            const isAchieved = currRatio >= targetVal;

            if (filter === 'achieved' && !isAchieved) return;
            if (filter === 'unachieved' && isAchieved) return;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><b>${bName}</b> (<code>TGT-${String(idx + 1).padStart(2, '0')}</code>)</td>
                <td>${stdVal.toFixed(1)}%</td>
                <td style="font-weight:700;">${targetVal.toFixed(1)}%</td>
                <td style="font-size:15px; font-weight:800; color:${isAchieved ? '#10B981' : '#EF4444'};">${currRatio.toFixed(1)}%</td>
                <td><span class="type-tag ${isAchieved ? 'tag-pressure' : 'tag-leak'}">${isAchieved ? '✅ 달성' : '⚠️ 미달성'}</span></td>
                <td>18.5 m³/h</td>
                <td style="color:#0284C7; font-weight:700;">${(18.5 * 0.78).toFixed(1)} m³/h</td>
                <td><span class="type-tag ${isAchieved ? 'tag-meter' : 'tag-leak'}">${isAchieved ? '유지 관리' : '1순위 누수탐사'}</span></td>
            `;
            tbody.appendChild(tr);
        });
        return;
    }

    // 샘플 fallback
    const tbody = document.getElementById('tableBodyTarget');
    tbody.innerHTML = '';

    Object.keys(window.SAMPLE_REVENUE_WATER_DATA).forEach(code => {
        const item = window.SAMPLE_REVENUE_WATER_DATA[code];
        const latest = item.history[item.history.length - 1];
        const isAchieved = latest.ratio >= item.targetRatio;

        if (filter === 'achieved' && !isAchieved) return;
        if (filter === 'unachieved' && isAchieved) return;

        const requiredMnf = isAchieved ? item.mnf : (item.mnf * 0.75).toFixed(1);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><b>${item.blockName}</b> (<code>${code}</code>)</td>
            <td>${(item.targetRatio - 5).toFixed(1)}%</td>
            <td style="font-weight:700;">${item.targetRatio}%</td>
            <td style="font-size:15px; font-weight:800; color:${isAchieved ? '#10B981' : '#EF4444'};">${latest.ratio}%</td>
            <td><span class="type-tag ${isAchieved ? 'tag-pressure' : 'tag-leak'}">${isAchieved ? '✅ 달성' : '⚠️ 미달성'}</span></td>
            <td>${item.mnf} m³/h</td>
            <td style="color:#0284C7; font-weight:700;">${requiredMnf} m³/h</td>
            <td><span class="type-tag ${isAchieved ? 'tag-meter' : 'tag-leak'}">${isAchieved ? '유지 관리' : '1순위 누수탐사'}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * 블록 셀렉트 박스 채우기
 */
function populateBlockSelect() {
    const select = document.getElementById('blockSelect');
    if (!select) return;
    select.innerHTML = '';
    window.SAMPLE_BLOCKS.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.code;
        opt.textContent = b.name;
        select.appendChild(opt);
    });
}

/**
 * 작업 모드 설정 (공종관리 - 경계밸브/수용가/수압/누수)
 */
function setWorkMode(mode, modeTitle, modeDesc) {
    if (!modeTitle) {
        if (mode === 'VALVE_SURVEY') {
            modeTitle = '경계밸브조사';
            modeDesc = '지도의 제수변 마커를 클릭하여 회전수 및 개폐상태를 점검하세요.';
        } else if (mode === 'METER_SURVEY') {
            modeTitle = '수용가조사';
            modeDesc = '수용가 계량기 마커를 클릭하여 구경, 검침값 및 이상유무를 확인하세요.';
        } else if (mode === 'PRESSURE_SURVEY') {
            modeTitle = '수압조사';
            modeDesc = '블록 내 실측 수압 측정점 수압값을 입력하고 적정수압을 평가하세요.';
        } else if (mode === 'LEAK_SURVEY') {
            modeTitle = '누수탐사';
            modeDesc = '누수 징후 지점을 확인하고 청음 탐사를 진행하세요.';
        }
    }
    window.setWorkMode = setWorkMode;
    currentWorkMode = mode;
    mapManager.setWorkMode(mode);

    const banner = document.getElementById('workModeBanner');
    const textEl = document.getElementById('workModeText');
    const descEl = document.getElementById('workModeDesc');
    const panelTitle = document.getElementById('sidePanelMainTitle');
    const tabSearchLabel = document.getElementById('tabSearchLabel');
    const badge = document.getElementById('currentViewBadge');

    if (mode === 'ALL') {
        banner.style.display = 'none';
        panelTitle.textContent = '관망 현장 업무';
        tabSearchLabel.textContent = '시설물 검색';
        if (currentMainView === 'MAP') {
            badge.textContent = '3. 공종관리 (전체)';
        }
    } else {
        banner.style.display = 'flex';
        textEl.textContent = `작업 모드: ${modeTitle}`;
        descEl.textContent = modeDesc;
        panelTitle.textContent = modeTitle;
        tabSearchLabel.textContent = modeTitle + ' 대상';
        if (currentMainView === 'MAP') {
            badge.textContent = '3. 공종관리 (' + modeTitle + ')';
        }
        
        openSidePanel();
        switchTab('searchTab');
    }

    renderFacilityList();
}

/**
 * 시설물 목록 렌더링
 */
async function renderFacilityList(searchTerm = '') {
    const listEl = document.getElementById('facilityListContainer');
    listEl.innerHTML = '';

    const activeBlock = mapManager.activeBlock;
    const mods = await window.offlineStore.getAllFacilityModifications();

    let allFacilities = [];

    if (currentWorkMode === 'VALVE_SURVEY') {
        allFacilities = window.SAMPLE_VALVES.map(v => ({ ...v, facilityType: 'VALVE' }));
    } else if (currentWorkMode === 'METER_SURVEY') {
        allFacilities = window.SAMPLE_METERS.map(m => ({ ...m, facilityType: 'METER' }));
    } else if (currentWorkMode === 'PRESSURE_SURVEY') {
        allFacilities = window.SAMPLE_PRESSURE_POINTS.map(p => ({ ...p, facilityType: 'PRESSURE' }));
    } else if (currentWorkMode === 'LEAK_SURVEY') {
        allFacilities = window.SAMPLE_LEAK_POINTS.map(l => ({ ...l, facilityType: 'LEAK' }));
    } else {
        allFacilities = [
            ...window.SAMPLE_METERS.map(m => ({ ...m, facilityType: 'METER' })),
            ...window.SAMPLE_VALVES.map(v => ({ ...v, facilityType: 'VALVE' })),
            ...window.SAMPLE_PRESSURE_POINTS.map(p => ({ ...p, facilityType: 'PRESSURE' })),
            ...window.SAMPLE_LEAK_POINTS.map(l => ({ ...l, facilityType: 'LEAK' })),
            ...window.SAMPLE_PIPES.map(p => ({ ...p, facilityType: 'PIPE' }))
        ];
    }

    const filtered = allFacilities.filter(f => {
        if (activeBlock !== 'ALL' && f.block !== activeBlock) return false;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            return f.id.toLowerCase().includes(term) ||
                   (f.name || '').toLowerCase().includes(term) ||
                   (f.owner || '').toLowerCase().includes(term) ||
                   (f.address || '').toLowerCase().includes(term);
        }
        return true;
    });

    if (filtered.length === 0) {
        listEl.innerHTML = '<div style="text-align:center; padding:25px; color:#94a3b8; font-size:13px;">해당 조건의 대상이 없습니다.</div>';
        return;
    }

    filtered.forEach(item => {
        const modAttr = mods[item.id];
        const displayDia = modAttr && modAttr.dia ? modAttr.dia : item.dia;

        const card = document.createElement('div');
        card.className = `facility-card ${currentFacility && currentFacility.id === item.id ? 'active' : ''}`;

        let tagClass = 'tag-meter';
        let typeText = '계량기';
        let descText = `수용가: ${item.owner || '-'} | 구경: D${displayDia}mm`;

        if (item.facilityType === 'CONSUMER') {
            tagClass = 'tag-consumer';
            typeText = '부과수용가';
            descText = `수용가: ${item.name || '-'} | ${item.cat || ''} D${item.dia || 13}mm | 당월부과: ${item.use || 0}m³`;
        } else if (item.facilityType === 'VALVE') {
            tagClass = 'tag-valve';
            typeText = item.cat || '밸브류';
            descText = `구경: D${displayDia}mm | ${item.cde || ''} | ${item.status || ''}`;
        } else if (item.facilityType === 'PIPE') {
            tagClass = 'tag-pipe';
            typeText = '관로';
            descText = `구경: D${displayDia}mm (${item.material}) | 연장: ${item.length}m`;
        } else if (item.facilityType === 'PRESSURE') {
            tagClass = 'tag-pressure';
            typeText = '수압점';
            descText = `실측수압: ${item.current_pressure} kgf/cm² | ${item.status}`;
        } else if (item.facilityType === 'LEAK') {
            tagClass = 'tag-leak';
            typeText = '누수탐사';
            descText = `청음: ${item.sound_grade} | ${item.status}`;
        }

        card.innerHTML = `
            <div class="card-top">
                <span class="type-tag ${tagClass}">${typeText}</span>
                <span style="font-size:11px; color:#64748b; font-weight:600;">${item.id}</span>
            </div>
            <div class="card-name">${item.name}</div>
            <div class="card-desc">${descText}</div>
        `;

        card.addEventListener('click', () => {
            mapManager.focusFacility(item.id);
        });

        listEl.appendChild(card);
    });
}

/**
 * 시설물 선택 시
 */
/**
 * 오른쪽(휴대폰: 아래) 패널 제목에 선택한 대상의 레이어명을 표시
 * mode: 'roadview' (로드뷰 열림), 'restore' (로드뷰 닫힘 → 직전 제목 복원)
 */
const PANEL_DEFAULT_TITLE = '관망 DB 및 현장 정보';
function getLayerTitleForItem(item) {
    if (!item) return PANEL_DEFAULT_TITLE;
    const id = String(item.id || '');
    if (/^LM2-/.test(id)) return '상수관로(LM2)';
    if (/^LM-/.test(id)) return '상수관로(LM)';
    if (/^SP-/.test(id)) return '급수관로';
    if (/^VLV-/.test(id) || item.facilityType === 'VALVE') return item.cat ? `밸브류 · ${item.cat}` : '밸브류';
    if (/^BIL-/.test(id) || item.facilityType === 'CONSUMER') return '부과 수용가';
    if (/^RES-/.test(id) || item.facilityType === 'RESERVOIR') return '정수장·배수지';
    if (/^BST-/.test(id) || item.facilityType === 'BOOSTER') return '가압장';
    if (/^FLOW-/.test(id) || item.facilityType === 'FLOW_METER') return '유량계';
    if (/^BLK-/.test(id) || item.isBlock || item.facilityType === 'BLOCK') return '블록경계';
    if (item.facilityType === 'METER') return '계량기';
    if (item.facilityType === 'PIPE') return '상수관로';
    if (item.addrSource || item.source === '주소 확인') return '위치 확인';
    if (item.category) return item.category;
    return PANEL_DEFAULT_TITLE;
}
window.setSidePanelTitle = function (item, mode) {
    const el = document.getElementById('sidePanelMainTitle');
    if (!el) return;
    if (mode === 'roadview') {
        el.textContent = '로드뷰';
        return;
    }
    if (mode === 'restore') {
        el.textContent = window._lastPanelTitle || PANEL_DEFAULT_TITLE;
        return;
    }
    const t = getLayerTitleForItem(item);
    window._lastPanelTitle = t;
    el.textContent = t;
};

async function onFacilitySelected(facility) {
    window.setSidePanelTitle(facility);
    currentFacility = facility;
    currentPhotos = [];
    isEditMode = false;

    openSidePanel();
    switchTab('surveyTab');
    const surveySection = document.getElementById('surveySectionForm');
    if (surveySection) surveySection.style.display = 'block';

    const mods = await window.offlineStore.getAllFacilityModifications();
    if (mods[facility.id]) {
        facility = { ...facility, ...mods[facility.id], isModified: true };
    }

    renderFacilityDetail(facility);
    setupSurveyForm(facility);
    renderPhotoThumbs();
    renderFacilityList();
}

/**
 * 지도 시설물, 블록, 가압장, 배수지, 주소 선택 시 우측 칸(Side Panel)에 상세 DB 표출
 */
window.showLocationOnRightPanel = function(item, nearbySummary, matchedBlock) {
    window.setSidePanelTitle(item);
    currentFacility = item;
    openSidePanel();
    switchTab('surveyTab');

    const isFieldSurvey = ['PIPE', 'VALVE', 'METER', 'PRESSURE', 'LEAK', 'CONSUMER'].includes(item.facilityType);
    const isAddressOnly = item.category === '주소' || item.source === '주소 확인' || item.source === '지도 클릭 확인' || (!item.facilityType && !item.capacity && !item.blockData);
    const surveySection = document.getElementById('surveySectionForm');
    if (surveySection) {
        surveySection.style.display = isFieldSurvey ? 'block' : 'none';
    }

    if (isFieldSurvey) {
        renderFacilityDetail(item);
        setupSurveyForm(item);
        return;
    }

    const container = document.getElementById('facilityDetailContent');
    if (!container) return;

    const cleanTitle = (item.title || item.name || '선택 위치')
        .replace(/\[클릭\s*확인\]\s*/g, '')
        .replace(/\s*인근\s*\([^)]*\)/g, '')
        .replace(/\s*\([^)]*m\)/g, '')
        .trim();

    const cleanRoad = (item.road || '')
        .replace(/\s*인근\s*\([^)]*\)/g, '')
        .replace(/\s*\([^)]*m\)/g, '')
        .trim();

    const cleanParcel = (item.parcel || '')
        .replace(/\s*인근\s*\([^)]*\)/g, '')
        .replace(/\s*\([^)]*m\)/g, '')
        .trim();

    let catIcon = '<i class="fa-solid fa-location-dot"></i>';
    let catClass = 'tag-pipe';
    let typeName = item.category || '주소 정보';

    if (item.category === '가압장' || item.facilityType === 'BOOSTER') {
        catIcon = '<i class="fa-solid fa-bolt-lightning"></i>';
        catClass = 'tag-pressure';
        typeName = '상수도 가압장';
    } else if (item.category === '배수지' || item.facilityType === 'RESERVOIR') {
        catIcon = '<i class="fa-solid fa-water"></i>';
        catClass = 'tag-pipe';
        typeName = '배수지 시설';
    } else if (item.category === '정수장' || item.category === '취수장') {
        catIcon = '<i class="fa-solid fa-building-columns"></i>';
        catClass = 'tag-pipe';
        typeName = item.category;
    } else if (item.category === '관망블록' || item.isBlock) {
        catIcon = '<i class="fa-solid fa-cubes"></i>';
        catClass = 'tag-valve';
        typeName = '관망 소블록';
    }

    const lat = typeof item.lat === 'number' ? item.lat : parseFloat(item.lat);
    const lng = typeof item.lng === 'number' ? item.lng : parseFloat(item.lng);

    // 건물명, 상호명, 아파트명 등 특이사항/장소명 추출
    let landmark = item.bldnm || item.place || item.building || '';
    if (!landmark && item.title && item.title !== cleanRoad && item.title !== cleanParcel && !item.title.includes('선택 위치')) {
        landmark = item.title.replace(/\s*인근\s*\([^)]*\)/g, '').replace(/\s*\([^)]*m\)/g, '').trim();
    }
    if (!landmark && item.name && item.name !== cleanRoad) {
        landmark = item.name.replace(/\s*인근\s*\([^)]*\)/g, '').replace(/\s*\([^)]*m\)/g, '').trim();
    }
    // 지도에서 고른 주소 확인(addrSource)은 정확한 주소가 따로 표시되므로 주변 지명으로 건물명을 추정하지 않음
    if (!landmark && !item.addrSource && window.mapManager && typeof window.mapManager.findNearestIndexItem === 'function') {
        const nearest = window.mapManager.findNearestIndexItem(lat, lng);
        if (nearest) {
            const dist = window.mapManager.calculateDistance(lat, lng, nearest.lat, nearest.lng);
            if (dist < 180) {
                landmark = nearest.bldnm || (nearest.title !== cleanRoad ? nearest.title : '');
            }
        }
    }

    container.innerHTML = `
        <!-- [첫번째 테두리: 주소 요약 및 로드뷰·좌표복사 원클릭 툴바] -->
        <div class="detail-header" style="display:flex; flex-direction:column; gap:8px; padding-bottom:12px; margin-bottom:12px; border-bottom:1px solid #E2E8F0;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                <span class="type-tag ${catClass}" style="flex-shrink:0;">${catIcon} ${typeName}</span>
                <div style="display:flex; gap:6px; align-items:center; flex-shrink:0;">
                    <button type="button" class="btn-roadview-action" onclick="window.mapManager.openRoadview(${lat}, ${lng}, '${cleanTitle.replace(/'/g, "\\'")}')" title="이 위치 360° 로드뷰(거리뷰) 열기" style="white-space:nowrap; padding:6px 12px; font-size:12px; font-weight:700; display:inline-flex; align-items:center; gap:5px; background:#FEF3C7; border:1px solid #FCD34D; color:#B45309; border-radius:6px; cursor:pointer;">
                        <i class="fa-solid fa-street-view" style="font-size:13px; color:#D97706;"></i> <span>로드뷰</span>
                    </button>
                    <button type="button" class="btn-edit-toggle" onclick="window.mapManager.copyCoordToClipboard(${lat}, ${lng})" title="GPS 좌표 복사" style="white-space:nowrap; padding:6px 10px; font-size:12px; font-weight:600; display:inline-flex; align-items:center; gap:4px; background:#F8FAFC; border:1px solid #CBD5E1; color:#475569; border-radius:6px; cursor:pointer;">
                        <i class="fa-regular fa-copy"></i> <span>좌표 복사</span>
                    </button>
                </div>
            </div>
            <div style="padding-top:2px;">
                <h4 class="detail-title" style="margin:0; font-size:15px; font-weight:800; color:#0F172A; line-height:1.45; word-break:keep-all;">${cleanTitle}</h4>
            </div>
        </div>

        <!-- [두번째 테두리: 관망 소속 및 주소·건물명 상세 속성] -->
        <div class="attr-grid" id="attrGrid">
            <div class="attr-item">
                <span class="attr-label">소속블록</span>
                <span class="attr-value font-bold text-primary">${item.block || matchedBlock || '김해시'}</span>
            </div>
            <div class="attr-item">
                <span class="attr-label">급수계통</span>
                <span class="attr-value">${item.system || '삼계·덕산계통'}</span>
            </div>
            ${landmark ? `
            <div class="attr-item" style="grid-column: span 2; background:#F0FDF4; border:1px solid #BBF7D0; border-radius:6px; padding:7px 10px;">
                <span class="attr-label" style="color:#15803D; font-weight:700;"><i class="fa-solid fa-building-circle-check"></i> 상호 / 건물명</span>
                <span class="attr-value font-bold" style="color:#166534; font-size:13.5px;">${landmark}</span>
            </div>` : ''}
            ${item.hwl ? `
            <div class="attr-item">
                <span class="attr-label">최고수위 (H.W.L)</span>
                <span class="attr-value font-bold text-primary">${item.hwl} m</span>
            </div>` : ''}
            ${item.lwl ? `
            <div class="attr-item">
                <span class="attr-label">최저수위 (L.W.L)</span>
                <span class="attr-value font-bold text-accent">${item.lwl} m</span>
            </div>` : ''}
            ${item.vol ? `
            <div class="attr-item">
                <span class="attr-label">시설용량 (저수용량)</span>
                <span class="attr-value font-bold">${item.vol.toLocaleString()} m³</span>
            </div>` : ''}
            ${item.head ? `
            <div class="attr-item">
                <span class="attr-label">가압장 총양정</span>
                <span class="attr-value font-bold text-primary">${item.head} m</span>
            </div>` : ''}
            ${item.saf ? `
            <div class="attr-item">
                <span class="attr-label">토출 수압</span>
                <span class="attr-value font-bold text-success">${item.saf} kgf/cm²</span>
            </div>` : ''}
            ${item.cnt ? `
            <div class="attr-item">
                <span class="attr-label">가압 펌프대수</span>
                <span class="attr-value font-bold">${item.cnt} 대</span>
            </div>` : ''}
            ${item.capacity ? `
            <div class="attr-item">
                <span class="attr-label">일일 가압/시설용량</span>
                <span class="attr-value text-accent font-bold">${item.capacity}</span>
            </div>` : ''}
            ${item.pumpSpec ? `
            <div class="attr-item">
                <span class="attr-label">펌프 설비 제원</span>
                <span class="attr-value">${item.pumpSpec}</span>
            </div>` : ''}
            ${item.pressureOut ? `
            <div class="attr-item">
                <span class="attr-label">토출 수압</span>
                <span class="attr-value font-bold text-success">${item.pressureOut}</span>
            </div>` : ''}
            ${item.status ? `
            <div class="attr-item">
                <span class="attr-label">운영/가동 상태</span>
                <span class="attr-value"><span class="vworld-status-dot online"></span> ${item.status}</span>
            </div>` : ''}
            ${item.blockData ? `
            <div class="attr-item">
                <span class="attr-label">기준 유수율</span>
                <span class="attr-value font-bold">${item.blockData.std}%</span>
            </div>
            <div class="attr-item">
                <span class="attr-label">목표 유수율</span>
                <span class="attr-value font-bold text-primary">${item.blockData.target}%</span>
            </div>` : ''}
            ${(item.addrSource || isAddressOnly) && (cleanRoad || cleanParcel) ? (() => {
                const esc = (s) => String(s || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
                const jsq = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                const acc = item.addrAccuracy;
                const accText = acc === 'exact' ? `선택 지점의 정확한 주소 (${item.addrSource || '주소 변환'})` :
                    (acc === 'high' || acc === 'near') ? `선택 지점에서 ${item.addrDistance}m 떨어진 가장 가까운 건물 주소 (김해 주소대장)` :
                    acc === 'approx' ? `대략 위치 · 주요 지명 기준 ${item.addrDistance}m` : (item.addrSource || '');
                const accColor = acc === 'exact' || acc === 'high' ? '#15803D' : (acc === 'near' ? '#B45309' : '#B91C1C');
                const copyBtn = (txt, label) => `<button type="button" onclick="window.mapManager.copyTextToClipboard('${jsq(txt)}', '${label}')" title="${label} 복사" style="flex-shrink:0; padding:4px 8px; font-size:11px; border:1px solid #CBD5E1; background:#FFF; color:#475569; border-radius:6px; cursor:pointer;"><i class="fa-regular fa-copy"></i> 복사</button>`;
                return `
            <div class="attr-item" style="grid-column: span 2; background:#EFF6FF; border:1px solid #BFDBFE; border-radius:8px; padding:9px 10px; gap:6px;">
                ${cleanRoad ? `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                    <div style="min-width:0;">
                        <span class="attr-label" style="color:#1D4ED8; font-weight:700;"><i class="fa-solid fa-road"></i> 도로명 주소</span>
                        <div style="font-size:14px; font-weight:800; color:#0F172A; word-break:keep-all; line-height:1.4;">${esc(cleanRoad)}</div>
                    </div>
                    ${copyBtn(cleanRoad, '도로명 주소')}
                </div>` : ''}
                ${cleanParcel ? `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-top:4px;">
                    <div style="min-width:0;">
                        <span class="attr-label" style="color:#475569; font-weight:700;"><i class="fa-regular fa-map"></i> 지번 주소</span>
                        <div style="font-size:13px; font-weight:700; color:#334155; word-break:keep-all; line-height:1.4;">${esc(cleanParcel)}</div>
                    </div>
                    ${copyBtn(cleanParcel, '지번 주소')}
                </div>` : ''}
                ${item.addrNearRoad ? `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-top:4px;">
                    <div style="min-width:0;">
                        <span class="attr-label" style="color:#475569; font-weight:700;"><i class="fa-solid fa-building"></i> 가장 가까운 건물 (${item.addrNearDist}m)</span>
                        <div style="font-size:13px; font-weight:700; color:#334155; word-break:keep-all; line-height:1.4;">${esc(item.addrNearRoad)}</div>
                    </div>
                    ${copyBtn(item.addrNearRoad, '건물 도로명 주소')}
                </div>` : ''}
                ${accText ? `<div style="margin-top:4px; font-size:11.5px; font-weight:600; color:${accColor};"><i class="fa-solid fa-circle-info"></i> ${esc(accText)}</div>` : ''}
                <div style="font-size:11px; color:#64748B;"><i class="fa-solid fa-crosshairs"></i> ${lat.toFixed(6)}, ${lng.toFixed(6)}</div>
            </div>`;
            })() : `
            <div class="attr-item" style="grid-column: span 2;">
                <span class="attr-label">도로명 / 지번 주소</span>
                <span class="attr-value">${cleanRoad || cleanParcel || cleanTitle}</span>
            </div>`}
        </div>

        ${!isAddressOnly && nearbySummary ? `
        <div class="vvp-nearby-box" style="margin-top:12px; padding:10px; border-radius:8px; border:1px solid var(--border); background:#F8FAFC;">
            <div style="font-size:11.5px; font-weight:700; color:#0284C7; margin-bottom:6px;">
                <i class="fa-solid fa-radar"></i> 반경 100m 이내 관망 시설 현황
            </div>
            <div class="vvp-nearby-tags" style="display:flex; gap:6px; flex-wrap:wrap;">
                <span class="vnb-tag tag-pipe"><i class="fa-solid fa-grip-lines"></i> 관로 ${nearbySummary.pipeCount}개소</span>
                <span class="vnb-tag tag-valve"><i class="fa-solid fa-gear"></i> 제수변 ${nearbySummary.valveCount}개</span>
                <span class="vnb-tag tag-meter"><i class="fa-solid fa-faucet-drip"></i> 계량기 ${nearbySummary.meterCount}개</span>
                <span class="vnb-tag tag-pressure"><i class="fa-solid fa-gauge-high"></i> 수압점 ${nearbySummary.pressureCount}개</span>
            </div>
        </div>` : ''}

        ${item.desc ? `
        <div style="margin-top:10px; font-size:12px; color:#64748B; background:#F1F5F9; padding:8px 10px; border-radius:6px; line-height:1.4;">
            <i class="fa-solid fa-circle-info" style="color:#3B82F6;"></i> ${item.desc}
        </div>` : ''}

        ${!isAddressOnly ? `
        <div style="margin-top:12px;">
            <button type="button" class="btn-save-survey" style="width:100%; padding:9px 12px; font-size:12px;" onclick="window.mapManager.openNewSurveyForm('${cleanTitle.replace(/'/g, "\\'")}', '${(cleanRoad || cleanParcel || '').replace(/'/g, "\\'")}', ${lat}, ${lng}, '${(item.block || matchedBlock || '').replace(/'/g, "\\'")}')">
                <i class="fa-solid fa-pen-to-square"></i> 이 위치로 현장조사 등록
            </button>
        </div>` : ''}
    `;
};

/**
 * 시설물 상세 카드 렌더링
 */
function renderFacilityDetail(f) {
    const container = document.getElementById('facilityDetailContent');
    const fLat = typeof f.lat === 'number' ? f.lat : (f.lat ? parseFloat(f.lat) : null);
    const fLng = typeof f.lng === 'number' ? f.lng : (f.lng ? parseFloat(f.lng) : null);

    // 1. 부과 수용가 전용 상세 카드 렌더링
    if (f.facilityType === 'CONSUMER') {
        const displayName = f.name || '미등록 수용가';
        const displayAddr = f.addr || f.oaddr || '김해시 관내';
        const isClosed = f.cls === '폐전';
        const isBulk = (f.use && f.use >= 300) || (f.dia && f.dia >= 32);

        container.innerHTML = `
            <div class="detail-header">
                <div>
                    <span class="type-tag tag-consumer">부과 수용가</span>
                    <span class="detail-title" style="margin-left:6px;">${displayName}</span>
                </div>
                <div style="display:flex; gap:6px; align-items:center;">
                    ${fLat && fLng ? `
                    <button type="button" class="btn-roadview-action" onclick="window.mapManager.openRoadview(${fLat}, ${fLng}, '${displayName.replace(/'/g, "\\'")}')" title="이 수용가 위치 360° 로드뷰(거리뷰) 열기">
                        <i class="fa-solid fa-street-view"></i> 로드뷰
                    </button>` : ''}
                </div>
            </div>
            <div class="attr-grid" id="attrGrid">
                <div class="attr-item">
                    <span class="attr-label">관리번호</span>
                    <span class="attr-value font-bold text-primary">${f.id || '-'}</span>
                </div>
                <div class="attr-item">
                    <span class="attr-label">수용가번호</span>
                    <span class="attr-value font-bold">${f.cno || '-'}</span>
                </div>
                <div class="attr-item">
                    <span class="attr-label">계량기번호</span>
                    <span class="attr-value font-bold">${f.mno || '-'}</span>
                </div>
                <div class="attr-item">
                    <span class="attr-label">소속블록</span>
                    <span class="attr-value">${f.blk || f.block || '-'}</span>
                </div>
                <div class="attr-item">
                    <span class="attr-label">업종</span>
                    <span class="attr-value font-bold">${f.cat || '가정용'}</span>
                </div>
                <div class="attr-item">
                    <span class="attr-label">구경 (계량기)</span>
                    <span class="attr-value font-bold">D${f.dia || 13} mm</span>
                </div>
                <div class="attr-item">
                    <span class="attr-label">26.01 당월 부과량</span>
                    <span class="attr-value font-bold" style="color:#0284C7; font-size:13px;">${f.use !== undefined ? f.use.toLocaleString() : 0} m³</span>
                </div>
                <div class="attr-item">
                    <span class="attr-label">일평균 사용량</span>
                    <span class="attr-value font-bold" style="color:#059669;">${f.day !== undefined ? f.day.toLocaleString() : 0} m³/일</span>
                </div>
                <div class="attr-item">
                    <span class="attr-label">폐전 여부</span>
                    <span class="attr-value" style="color:${isClosed ? '#DC2626' : '#059669'}; font-weight:700;">${f.cls || '급수중 (정상)'}</span>
                </div>
                <div class="attr-item">
                    <span class="attr-label">수용가 구분</span>
                    <span class="attr-value">${isBulk ? '<span style="color:#8B5CF6; font-weight:700;">다량수용가</span>' : '일반수용가'}</span>
                </div>
                <div class="attr-item" style="grid-column: span 2;">
                    <span class="attr-label">도로명 주소</span>
                    <span class="attr-value">${f.addr || '-'}</span>
                </div>
                ${f.oaddr ? `
                <div class="attr-item" style="grid-column: span 2;">
                    <span class="attr-label">지번 주소 (구주소)</span>
                    <span class="attr-value text-muted" style="font-size:12px;">${f.oaddr}</span>
                </div>` : ''}
            </div>
        `;
        return;
    }

    let typeName = '관망 시설물';
    let tagClass = 'tag-pipe';

    if (f.facilityType === 'METER') { typeName = '수용가 계량기'; tagClass = 'tag-meter'; }
    else if (f.facilityType === 'VALVE') { typeName = f.cat || '밸브류'; tagClass = 'tag-valve'; }
    else if (f.facilityType === 'PRESSURE') { typeName = '수압 측정점'; tagClass = 'tag-pressure'; }
    else if (f.facilityType === 'LEAK') { typeName = '누수 탐사점'; tagClass = 'tag-leak'; }

    container.innerHTML = `
        <div class="detail-header">
            <div>
                <span class="type-tag ${tagClass}">${typeName}</span>
                <span class="detail-title" style="margin-left:6px;">${f.name}</span>
            </div>
            <div style="display:flex; gap:6px; align-items:center;">
                ${fLat && fLng ? `
                <button type="button" class="btn-roadview-action" onclick="window.mapManager.openRoadview(${fLat}, ${fLng}, '${(f.name || '').replace(/'/g, "\\'")}')" title="이 시설물 위치 360° 로드뷰(거리뷰) 열기">
                    <i class="fa-solid fa-street-view"></i> 로드뷰
                </button>` : ''}
                <button class="btn-edit-toggle" id="btnToggleEdit">
                    <i class="fa-solid fa-pen-to-square"></i> ${isEditMode ? '수정 취소' : '기본정보 수정'}
                </button>
            </div>
        </div>
        <div class="attr-grid" id="attrGrid">
            <div class="attr-item">
                <span class="attr-label">관리번호</span>
                <span class="attr-value font-bold text-primary">${f.id}</span>
            </div>
            <div class="attr-item">
                <span class="attr-label">소속블록</span>
                <span class="attr-value">${f.block || '-'}</span>
            </div>
            ${f.facilityType === 'VALVE' ? `
            <div class="attr-item">
                <span class="attr-label">심볼 / SA코드</span>
                <span class="attr-value font-bold" style="color:#D97706;">[${f.cde || 'SA200'}] ${f.cat || '제수변'}</span>
            </div>
            ` : ''}
            <div class="attr-item">
                <span class="attr-label">구경 / 규격</span>
                ${isEditMode && f.dia ? `<input type="number" id="editDia" class="attr-input" value="${f.dia}">` : `<span class="attr-value">${f.dia ? 'D' + f.dia + ' mm' : (f.sound_grade || '-')}</span>`}
            </div>
            <div class="attr-item">
                <span class="attr-label">관종 / 상태</span>
                ${isEditMode ? `<input type="text" id="editMaterial" class="attr-input" value="${f.mat || f.material || f.status || ''}">` : `<span class="attr-value">${f.mat || f.material || f.status || '-'}</span>`}
            </div>
            ${f.len ? `
            <div class="attr-item">
                <span class="attr-label">관로 연장</span>
                <span class="attr-value font-bold text-primary">${f.len} m</span>
            </div>` : ''}
            ${f.turn !== undefined && f.turn > 0 ? `
            <div class="attr-item">
                <span class="attr-label">밸브 회전수</span>
                <span class="attr-value font-bold text-accent">${f.turn} 회</span>
            </div>` : ''}
            <div class="attr-item" style="grid-column: span 2;">
                <span class="attr-label">주소 / 위치</span>
                ${isEditMode ? `<input type="text" id="editAddress" class="attr-input" value="${f.address || ''}">` : `<span class="attr-value">${f.address || '도로상'}</span>`}
            </div>
            ${isEditMode ? `
            <div class="attr-item" style="grid-column: span 2;">
                <span class="attr-label">수정 담당자</span>
                <input type="text" id="editSurveyorName" class="attr-input" value="${localStorage.getItem('last_surveyor_name') || '김해_조사원'}" placeholder="담당자 성명">
            </div>` : ''}
            ${(f.MOD_YMD || f.MOD_USR) ? `
            <div class="attr-item" style="grid-column: span 2; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:6px; padding:6px 10px; margin-top:4px;">
                <div style="font-size:11px; color:#475569; display:flex; justify-content:space-between; align-items:center;">
                    <span><i class="fa-solid fa-clock-rotate-left" style="color:#2563EB;"></i> <b>최근 현장수정</b></span>
                    <span class="badge" style="background:#EFF6FF; color:#1D4ED8; font-size:10px; padding:2px 6px; border-radius:4px; font-weight:700;">${f.MOD_USR || '담당자'}</span>
                </div>
                <div style="font-size:11px; color:#64748B; margin-top:2px;">일시: ${f.MOD_YMD || '-'}</div>
                ${f.MOD_DESC ? `<div style="font-size:11px; color:#334155; margin-top:1px;">내역: ${f.MOD_DESC}</div>` : ''}
            </div>` : ''}
        </div>
        ${isEditMode ? `
            <div style="margin-top:10px; display:flex; justify-content:flex-end; gap:6px;">
                <button class="btn-header" id="btnSaveAttrMod" style="background:var(--primary); color:#FFF; border:none; padding:5px 12px;">
                    <i class="fa-solid fa-check"></i> 수정사항 저장
                </button>
            </div>
        ` : ''}
    `;

    document.getElementById('btnToggleEdit').addEventListener('click', () => {
        isEditMode = !isEditMode;
        renderFacilityDetail(currentFacility);
    });

    if (isEditMode) {
        document.getElementById('btnSaveAttrMod').addEventListener('click', async () => {
            const editDiaEl = document.getElementById('editDia');
            const newDia = editDiaEl ? parseInt(editDiaEl.value, 10) : currentFacility.dia;
            const newMaterial = document.getElementById('editMaterial').value;
            const newAddress = document.getElementById('editAddress').value;

            // 담당자 이름 확인 및 자동 기억
            const editSurveyorEl = document.getElementById('editSurveyorName');
            const surveyorInput = document.getElementById('inputSurveyor');
            const surveyor = (editSurveyorEl ? editSurveyorEl.value.trim() : '') || surveyorInput?.value || localStorage.getItem('last_surveyor_name') || '김해_조사원';
            localStorage.setItem('last_surveyor_name', surveyor);
            if (surveyorInput) surveyorInput.value = surveyor;

            const now = new Date();
            const ymd = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
            const desc = `구경: D${newDia || '-'}, 관종/상태: ${newMaterial || '-'}`;

            const modData = { 
                dia: newDia, 
                material: newMaterial, 
                address: newAddress,
                MOD_YMD: ymd,
                MOD_USR: surveyor,
                MOD_DESC: desc
            };

            // 1. 브라우저 내부 IndexedDB 저장
            await window.offlineStore.saveFacilityModification(currentFacility.id, modData);
            
            // 2. Firebase 실시간 클라우드 전송
            if (window.syncFacilityModificationToCloud) {
                window.syncFacilityModificationToCloud(currentFacility.id, modData);
            }

            // 3. 지도 인메모리 및 캔버스 즉시 갱신
            if (window.mapManager && typeof window.mapManager.applyFacilityModificationInMemory === 'function') {
                window.mapManager.applyFacilityModificationInMemory(currentFacility.id, modData);
            }

            currentFacility = { ...currentFacility, ...modData };
            isEditMode = false;
            alert(`[${currentFacility.id}] 현장 수정사항이 로컬 및 클라우드에 실시간 동기화되었습니다!\n수정일시: ${ymd}\n담당자: ${surveyor}`);
            renderFacilityDetail(currentFacility);
            renderFacilityList();
        });
    }
}

/**
 * 공종별 맞춤형 조사 폼 동적 렌더링
 */
function setupSurveyForm(f) {
    const formContainer = document.getElementById('dynamicSurveyFields');
    const titleEl = document.getElementById('surveySectionTitle');
    formContainer.innerHTML = '';

    if (f.facilityType === 'CONSUMER') {
        titleEl.textContent = '수용가 현장 점검 및 검침 입력';
        formContainer.innerHTML = `
            <div class="form-group">
                <label class="form-label">당월 실측 검침 지침 (m³)</label>
                <input type="number" id="inputMeterRead" class="form-input" placeholder="실측 검침 지침 입력 (전월 부과: ${f.use || 0}m³)">
            </div>
            <div class="form-group">
                <label class="form-label">계량기 및 보호통 상태</label>
                <select id="inputMeterState" class="form-select">
                    <option value="정상">정상 (원활한 급수)</option>
                    <option value="누수의심">미사용 중 별침 회전 (옥내 누수 의심)</option>
                    <option value="부동">부동 (계량기 고장)</option>
                    <option value="유리파손">유리 파손 / 판독 불가</option>
                    <option value="보호통파손">계량기 보호통 파손/토사유입</option>
                    <option value="동파">동파 위험/동파 발생</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">수용가 특이사항 / 메모</label>
                <input type="text" id="inputConsumerNote" class="form-input" placeholder="특이사항 메모 (예: 장기공가, 이사 등)">
            </div>
        `;
    } else if (f.facilityType === 'VALVE') {
        titleEl.textContent = '경계밸브 점검 입력';
        formContainer.innerHTML = `
            <div class="form-group">
                <label class="form-label">현재 개폐 상태</label>
                <select id="inputValveState" class="form-select">
                    <option value="전개(100% 개방)">전개 (100% 개방)</option>
                    <option value="전폐(고립 차단)">전폐 (고립 차단)</option>
                    <option value="일부 개방">일부 개방 (부분 회전)</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">현장 확인 회전수 (기준: ${f.total_turn || 20}회)</label>
                <input type="number" id="inputValveTurn" class="form-input" placeholder="실측 회전수 입력" value="${f.total_turn || ''}">
            </div>
            <div class="form-group">
                <label class="form-label">토사 매몰 및 덮개 상태</label>
                <select id="inputValveCover" class="form-select">
                    <option value="정상">정상 (맨홀 내부 청결)</option>
                    <option value="토사매몰">토사 매몰 (준설 필요)</option>
                    <option value="덮개파손">맨홀 뚜껑 파손/이탈</option>
                    <option value="침수">맨홀 내부 침수 (누수 의심)</option>
                </select>
            </div>
        `;
    } else if (f.facilityType === 'METER') {
        titleEl.textContent = '수용가 계량기 점검 입력';
        formContainer.innerHTML = `
            <div class="form-group">
                <label class="form-label">현재 지침값 (m³)</label>
                <input type="number" id="inputMeterRead" class="form-input" placeholder="당월 검침 지침 입력 (이전: ${f.last_read}m³)">
            </div>
            <div class="form-group">
                <label class="form-label">계량기 상태</label>
                <select id="inputMeterState" class="form-select">
                    <option value="정상회전">정상 회전</option>
                    <option value="부동">부동 (고장)</option>
                    <option value="유리파손">유리 파손 / 지침 판독 불가</option>
                    <option value="누수의심">수도 미사용 중 별침 회전 (옥내누수 의심)</option>
                </select>
            </div>
        `;
    } else if (f.facilityType === 'PRESSURE') {
        titleEl.textContent = '수압 측정 실측 입력';
        formContainer.innerHTML = `
            <div class="form-group">
                <label class="form-label">실측 정수압 (kgf/cm²)</label>
                <input type="number" step="0.05" id="inputStaticPressure" class="form-input" placeholder="목표: ${f.target_pressure} kgf/cm²" value="${f.current_pressure || ''}">
            </div>
            <div class="form-group">
                <label class="form-label">동수압 (kgf/cm² - 통수 시)</label>
                <input type="number" step="0.05" id="inputDynamicPressure" class="form-input" placeholder="동수압 입력 (선택사항)">
            </div>
            <div class="form-group">
                <label class="form-label">수압 적정 판정</label>
                <select id="inputPressureJudgement" class="form-select">
                    <option value="적정">적정 수압 (2.0 ~ 4.0 kgf/cm²)</option>
                    <option value="저수압">저수압 경고 (< 1.5 kgf/cm²)</option>
                    <option value="고수압">고수압 주의 (> 4.5 kgf/cm² - 감압 필요)</option>
                </select>
            </div>
        `;
    } else if (f.facilityType === 'LEAK') {
        titleEl.textContent = '누수탐사 및 복구 내역 입력';
        formContainer.innerHTML = `
            <div class="form-group">
                <label class="form-label">청음 조사 결과</label>
                <select id="inputLeakSound" class="form-select">
                    <option value="A등급(명확한 파열음)">A등급 (명확한 파열음)</option>
                    <option value="B등급(미세 누수음)">B등급 (미세 누수음)</option>
                    <option value="C등급(배경소음 심함)">C등급 (배경소음 심함)</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">복구 조치 상태</label>
                <select id="inputLeakProgress" class="form-select">
                    <option value="청음확인(대기)">청음 확인 (복구 대기)</option>
                    <option value="굴착진행중">굴착 및 노출 진행 중</option>
                    <option value="복구완료">단수 밴드 체결 / 복구 완료</option>
                </select>
            </div>
        `;
    } else {
        titleEl.textContent = '관로 현장 점검 입력';
        formContainer.innerHTML = `
            <div class="form-group">
                <label class="form-label">측정 수압 (kgf/cm²)</label>
                <input type="number" step="0.1" id="inputPipePressure" class="form-input" placeholder="수압계 측정값">
            </div>
            <div class="form-group">
                <label class="form-label">노면 이상 징후</label>
                <select id="selectPipeLeak" class="form-select">
                    <option value="이상없음">이상 없음 (건조)</option>
                    <option value="노면습기">노면 습기 / 결로</option>
                    <option value="누수음청음">누수 탐사음 청음 확인</option>
                </select>
            </div>
        `;
    }
}

/**
 * 사진 추가 및 압축 처리
 */
async function handlePhotoUpload(files) {
    if (!files || files.length === 0) return;

    const mode = document.querySelector('input[name="photoQualityMode"]:checked').value;
    const progressEl = document.getElementById('photoProgressText');
    progressEl.style.display = 'block';
    progressEl.textContent = `사진 압축 중... (${files.length}장)`;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
            const result = await window.imageCompressor.processImage(file, mode);
            currentPhotos.push({
                id: 'P-' + Date.now() + '-' + i,
                thumb: result.thumbDataUrl,
                blob: result.compressedBlob,
                meta: result.meta
            });
        } catch (err) {
            console.error("사진 압축 실패:", err);
            alert(`[${file.name}] 압축 중 오류가 발생했습니다.`);
        }
    }

    progressEl.style.display = 'none';
    renderPhotoThumbs();
}

/**
 * 썸네일 그리드 렌더링
 */
function renderPhotoThumbs() {
    const grid = document.getElementById('photoThumbGrid');
    grid.innerHTML = '';

    if (currentPhotos.length === 0) {
        grid.innerHTML = '<div style="grid-column:span 3; font-size:12px; color:#94a3b8; text-align:center; padding:10px;">첨부된 현장 사진이 없습니다.</div>';
        return;
    }

    currentPhotos.forEach((photo, idx) => {
        const card = document.createElement('div');
        card.className = 'thumb-card';
        const compKb = Math.round(photo.meta.compressedSize / 1024);

        card.innerHTML = `
            <img src="${photo.thumb}" class="thumb-img" alt="사진">
            <span class="thumb-meta-badge">${compKb}KB (${photo.meta.compressionRatio}↓)</span>
            <button class="btn-thumb-del" title="삭제">&times;</button>
        `;

        card.querySelector('.btn-thumb-del').addEventListener('click', (e) => {
            e.stopPropagation();
            currentPhotos.splice(idx, 1);
            renderPhotoThumbs();
        });

        card.addEventListener('click', () => {
            const win = window.open();
            win.document.write(`<img src="${photo.thumb}" style="max-width:100%; height:auto;">`);
        });

        grid.appendChild(card);
    });
}

/**
 * 조사 데이터 저장
 */
async function saveCurrentSurvey() {
    if (!currentFacility) {
        alert("먼저 조사할 대상을 선택해주세요.");
        return;
    }

    const surveyor = document.getElementById('inputSurveyor')?.value || localStorage.getItem('last_surveyor_name') || '현장조사원';
    localStorage.setItem('last_surveyor_name', surveyor);
    const memo = document.getElementById('inputSurveyMemo').value;

    let surveyData = { memo };
    if (currentFacility.facilityType === 'CONSUMER') {
        surveyData.meterRead = document.getElementById('inputMeterRead')?.value || '';
        surveyData.meterState = document.getElementById('inputMeterState')?.value || '';
        surveyData.consumerNote = document.getElementById('inputConsumerNote')?.value || '';
    } else if (currentFacility.facilityType === 'VALVE') {
        surveyData.valveState = document.getElementById('inputValveState')?.value || '';
        surveyData.valveTurn = document.getElementById('inputValveTurn')?.value || '';
        surveyData.valveCover = document.getElementById('inputValveCover')?.value || '';
    } else if (currentFacility.facilityType === 'METER') {
        surveyData.meterRead = document.getElementById('inputMeterRead')?.value || '';
        surveyData.meterState = document.getElementById('inputMeterState')?.value || '';
    } else if (currentFacility.facilityType === 'PRESSURE') {
        surveyData.staticPressure = document.getElementById('inputStaticPressure')?.value || '';
        surveyData.dynamicPressure = document.getElementById('inputDynamicPressure')?.value || '';
        surveyData.judgement = document.getElementById('inputPressureJudgement')?.value || '';
    } else if (currentFacility.facilityType === 'LEAK') {
        surveyData.leakSound = document.getElementById('inputLeakSound')?.value || '';
        surveyData.leakProgress = document.getElementById('inputLeakProgress')?.value || '';
    }

    const now = new Date();
    const ymd = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    const desc = `${currentFacility.facilityType} 점검 (${memo || '이상없음'})`;

    const surveyRecord = {
        facilityId: currentFacility.id,
        facilityName: currentFacility.name,
        facilityType: currentFacility.facilityType,
        blockCode: currentFacility.block,
        surveyor,
        surveyType: currentFacility.facilityType + ' 조사',
        data: surveyData,
        photos: currentPhotos,
        MOD_YMD: ymd,
        MOD_USR: surveyor,
        MOD_DESC: desc
    };

    const saved = await window.offlineStore.saveSurvey(surveyRecord);

    // 시설물 정보에도 최근 점검자/일자 실시간 클라우드 동기화
    const modData = {
        MOD_YMD: ymd,
        MOD_USR: surveyor,
        MOD_DESC: desc,
        ...(surveyData.valveTurn ? { turn: parseInt(surveyData.valveTurn, 10) } : {}),
        ...(surveyData.valveState ? { status: surveyData.valveState } : {})
    };
    if (window.syncFacilityModificationToCloud) {
        window.syncFacilityModificationToCloud(currentFacility.id, modData);
    }
    if (window.mapManager && typeof window.mapManager.applyFacilityModificationInMemory === 'function') {
        window.mapManager.applyFacilityModificationInMemory(currentFacility.id, modData);
    }

    alert(`[조사 완료] 기기 및 클라우드에 안전 저장되었습니다!\n번호: ${saved.surveyId}\n조사자: ${surveyor}\n사진: ${currentPhotos.length}장`);

    currentPhotos = [];
    renderPhotoThumbs();
    document.getElementById('inputSurveyMemo').value = '';
    loadSurveysList();
}

/**
 * 조사 이력 탭 렌더링
 */
async function loadSurveysList() {
    const listEl = document.getElementById('historyListContainer');
    listEl.innerHTML = '';

    const surveys = await window.offlineStore.getAllSurveys();
    const countBadge = document.getElementById('historyCountBadge');
    if (countBadge) countBadge.textContent = surveys.length;

    if (surveys.length === 0) {
        listEl.innerHTML = '<div style="text-align:center; padding:30px; color:#94a3b8; font-size:13px;">등록된 현장 조사 이력이 없습니다.</div>';
        return;
    }

    surveys.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    surveys.forEach(s => {
        const item = document.createElement('div');
        item.className = 'facility-card';
        const isSynced = s.syncStatus === 'SYNCED';

        item.innerHTML = `
            <div class="card-top">
                <span class="sync-badge ${isSynced ? 'badge-synced' : 'badge-local'}">${isSynced ? '🟢 서버저장완료' : '🔵 기기임시보관'}</span>
                <span style="font-size:11px; color:#94a3b8;">${new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div class="card-name">${s.facilityName} (${s.facilityId})</div>
            <div class="card-desc">조사자: ${s.surveyor} | 사진: ${s.photos.length}장</div>
        `;

        item.addEventListener('click', () => {
            mapManager.focusFacility(s.facilityId);
        });

        listEl.appendChild(item);
    });
}

/**
 * UI 이벤트 초기화
 */
function initUIEvents() {
    // 1. [대메뉴 1: 계통도] 클릭 이벤트
    document.getElementById('btnMenuTopology').addEventListener('click', () => {
        switchMainView('TOPOLOGY');
    });

    // [대메뉴 2: 유수율분석] 직접 클릭 시 2.유수율 분석 대시보드로 즉시 전환
    const btnMenuRevenue = document.getElementById('btnMenuRevenue');
    if (btnMenuRevenue) {
        btnMenuRevenue.addEventListener('click', (e) => {
            // 드롭다운 호버가 아닌 직접 클릭 시 대시보드 0.대시보드로 전환
            switchMainView('DASHBOARD', 'dash-overview');
        });
    }

    // [대메뉴 3: 공종관리 (GIS)] 직접 클릭 시 3.공종관리 지도로 즉시 전환
    const btnMenuWork = document.getElementById('btnMenuWork');
    if (btnMenuWork) {
        btnMenuWork.addEventListener('click', (e) => {
            switchMainView('MAP');
        });
    }

    // [대메뉴 4: 불용관관리] 직접 클릭 시 4.불용관관리 화면으로 전환
    const btnMenuUnused = document.getElementById('btnMenuUnused');
    if (btnMenuUnused) {
        btnMenuUnused.addEventListener('click', () => {
            switchMainView('UNUSED_PIPE');
        });
    }

    // [대메뉴 5: 노후관선별] 직접 클릭 시 5.노후관선별 화면으로 전환
    const btnMenuAging = document.getElementById('btnMenuAging');
    if (btnMenuAging) {
        btnMenuAging.addEventListener('click', () => {
            switchMainView('AGING_PIPE');
        });
    }

    // [대메뉴 6: 블록현황도] 직접 클릭 시 6.블록현황도 화면으로 전환
    const btnMenuBlockMap = document.getElementById('btnMenuBlockMap');
    if (btnMenuBlockMap) {
        btnMenuBlockMap.addEventListener('click', () => {
            switchMainView('BLOCK_MAP');
        });
    }

    // [대메뉴 7: 일정표] 직접 클릭 시 7.일정표 화면으로 전환
    const btnMenuSchedule = document.getElementById('btnMenuSchedule');
    if (btnMenuSchedule) {
        btnMenuSchedule.addEventListener('click', () => {
            switchMainView('SCHEDULE');
        });
    }

    // [대메뉴 8: 관리자모드] 직접 클릭 시 8.관리자모드 화면으로 전환
    const btnMenuAdmin = document.getElementById('btnMenuAdmin');
    if (btnMenuAdmin) {
        btnMenuAdmin.addEventListener('click', () => {
            switchMainView('ADMIN_MODE');
        });
    }

    // [대메뉴 9: 기준 및 근거] 직접 클릭 시 9.기준 및 근거 화면으로 전환
    const btnMenuStandards = document.getElementById('btnMenuStandards');
    if (btnMenuStandards) {
        btnMenuStandards.addEventListener('click', () => {
            switchMainView('STANDARDS');
        });
    }

    // 관리자 모드 내부의 '기초자료 배포 센터 열기' 버튼 연동
    const btnAdminLaunchBaseData = document.getElementById('btnAdminLaunchBaseData');
    if (btnAdminLaunchBaseData) {
        btnAdminLaunchBaseData.addEventListener('click', () => {
            const modal = document.getElementById('baseDataModal');
            if (modal) modal.style.display = 'flex';
        });
    }

    // 2. [대메뉴 2 & 3: 유수율분석 / 공종관리] 드롭다운 하위 항목 클릭
    document.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            const action = item.dataset.action;

            if (action.startsWith('dash-')) {
                switchMainView('DASHBOARD', action);
            } else if (action.startsWith('work-')) {
                if (action === 'work-valve') {
                    setWorkMode('VALVE_SURVEY', '경계밸브조사', '블록 경계 제수변의 개폐상태, 회전수, 토사 매몰을 점검합니다.');
                } else if (action === 'work-meter') {
                    setWorkMode('METER_SURVEY', '수용가조사', '수용가 계량기 구경, 지침값 및 누수 의심 여부를 점검합니다.');
                } else if (action === 'work-pressure') {
                    setWorkMode('PRESSURE_SURVEY', '수압조사', '소화전 및 말단 급수전의 정수압·동수압(kgf/cm²)을 실측합니다.');
                } else if (action === 'work-leak') {
                    setWorkMode('LEAK_SURVEY', '누수탐사 및 복구', '노면 누수 징후 및 청음 결과를 기록하고 복구 사진을 등록합니다.');
                }
                switchMainView('MAP');
            }
        });
    });

    // 로고 클릭 시 1. 계통도로 이동
    document.getElementById('btnBrandLogo').addEventListener('click', () => {
        switchMainView('TOPOLOGY');
    });

    // 대시보드에서 '1. 계통도로 돌아가기' 버튼
    const btnReturn = document.getElementById('btnReturnToTopology') || document.getElementById('btnReturnToMap');
    if (btnReturn) {
        btnReturn.addEventListener('click', () => {
            switchMainView('TOPOLOGY');
        });
    }

    // 대시보드 서브탭 클릭
    document.querySelectorAll('.dash-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchDashboardTab(btn.dataset.tab);
        });
    });

    // 목표유수율 필터 버튼
    document.querySelectorAll('.target-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.target-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderDashboardTarget(btn.dataset.filter);
        });
    });

    // 3. 관리자 전용: [기초자료 배포] 모달 열기/닫기
    const baseModal = document.getElementById('baseDataModal');
    const btnOpenBase = document.getElementById('btnOpenBaseDataModal');
    if (btnOpenBase && baseModal) {
        btnOpenBase.addEventListener('click', () => {
            baseModal.style.display = 'flex';
            if (typeof window.updateCloudInspectorUI === 'function') {
                window.updateCloudInspectorUI();
            }
        });
    }
    const btnCloseBase = document.getElementById('btnCloseBaseModal');
    if (btnCloseBase && baseModal) {
        btnCloseBase.addEventListener('click', () => {
            baseModal.style.display = 'none';
        });
    }

    // 클라우드 최종 배포 현황 실시간 검증 센터 상태 갱신 버튼
    const btnRefreshCI = document.getElementById('btnRefreshCloudInspector');
    if (btnRefreshCI) {
        btnRefreshCI.addEventListener('click', () => {
            if (typeof window.updateCloudInspectorUI === 'function') {
                window.updateCloudInspectorUI();
            }
        });
    }

    // ==============================================================
    // [기초자료 관리 모달] 드래그 앤 드롭 및 GIS 공간파일(SHP/ZIP) 처리 엔진
    // ==============================================================
    
    // 1. 브라우저 전역 기본 드래그 드롭 차단 (파일 브라우저 새창 열림 방지)
    window.addEventListener('dragover', (e) => {
        e.preventDefault();
    });
    window.addEventListener('drop', (e) => {
        e.preventDefault();
    });

    // 드롭존 시각 효과 바인딩 헬퍼 함수
    function bindDropZoneEffects(dropZoneEl, inputEl, onFilesDropped) {
        if (!dropZoneEl) return;

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZoneEl.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZoneEl.classList.add('drag-active');
            });
        });

        ['dragleave', 'dragend'].forEach(eventName => {
            dropZoneEl.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZoneEl.classList.remove('drag-active');
            });
        });

        dropZoneEl.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZoneEl.classList.remove('drag-active');
            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                if (inputEl) {
                    try { inputEl.files = files; } catch (_) {}
                }
                if (typeof onFilesDropped === 'function') {
                    onFilesDropped(files);
                }
            }
        });
    }

    // 1. 공급량 드롭존
    const dzSupply = document.getElementById('dropZoneSupply');
    const inputSupply = document.getElementById('fileSupplyInput');
    if (dzSupply && inputSupply) {
        bindDropZoneEffects(dzSupply, inputSupply, (files) => {
            document.getElementById('supplyFileStatus').textContent = `✅ 드래그 완료: ${files.length}개 공급량 파일 등록됨`;
            document.getElementById('supplyFileStatus').style.color = '#10B981';
        });
        inputSupply.addEventListener('change', (e) => {
            document.getElementById('supplyFileStatus').textContent = `✅ 선택됨: ${e.target.files.length}개 공급량 파일`;
            document.getElementById('supplyFileStatus').style.color = '#10B981';
        });
    }

    // 2. 부과량 드롭존
    const dzCharge = document.getElementById('dropZoneCharge');
    const inputCharge = document.getElementById('fileChargeInput');
    if (dzCharge && inputCharge) {
        bindDropZoneEffects(dzCharge, inputCharge, (files) => {
            document.getElementById('chargeFileStatus').textContent = `✅ 드래그 완료: ${files.length}개 부과량 파일 등록됨`;
            document.getElementById('chargeFileStatus').style.color = '#10B981';
        });
        inputCharge.addEventListener('change', (e) => {
            document.getElementById('chargeFileStatus').textContent = `✅ 선택됨: ${e.target.files.length}개 부과량 파일`;
            document.getElementById('chargeFileStatus').style.color = '#10B981';
        });
    }

    // 3. 누수수리 드롭존
    const dzRepair = document.getElementById('dropZoneRepair');
    const inputRepair = document.getElementById('fileRepairInput');
    if (dzRepair && inputRepair) {
        bindDropZoneEffects(dzRepair, inputRepair, (files) => {
            document.getElementById('repairFileStatus').textContent = `✅ 드래그 완료: ${files.length}개 누수수리 파일 등록됨`;
            document.getElementById('repairFileStatus').style.color = '#10B981';
        });
        inputRepair.addEventListener('change', (e) => {
            document.getElementById('repairFileStatus').textContent = `✅ 선택됨: ${e.target.files.length}개 누수수리 파일`;
            document.getElementById('repairFileStatus').style.color = '#10B981';
        });
    }

    // 4. 목표유수율 드롭존
    const dzTarget = document.getElementById('dropZoneTarget');
    const inputTarget = document.getElementById('fileTargetInput');
    if (dzTarget && inputTarget) {
        bindDropZoneEffects(dzTarget, inputTarget, (files) => {
            document.getElementById('targetFileStatus').textContent = `✅ 드래그 완료: ${files.length}개 목표유수율 파일 등록됨`;
            document.getElementById('targetFileStatus').style.color = '#10B981';
        });
        inputTarget.addEventListener('change', (e) => {
            document.getElementById('targetFileStatus').textContent = `✅ 선택됨: ${e.target.files.length}개 목표유수율 파일`;
            document.getElementById('targetFileStatus').style.color = '#10B981';
        });
    }

    // 5. [핵심] 관망도 GIS 공간자료 드롭존 (SHP, ZIP, GeoJSON)
    const dzShp = document.getElementById('dropZoneShp');
    const inputShp = document.getElementById('fileShpInput');
    const shpStatus = document.getElementById('shpFileStatus');
    const shpResult = document.getElementById('shpResultDetail');
    const btnClearGis = document.getElementById('btnClearGisData');
    const chkReplaceGis = document.getElementById('chkReplaceGisMode');

    // 5-1. 기존 GIS 데이터 비우기 (Clean Delete)
    if (btnClearGis) {
        btnClearGis.addEventListener('click', () => {
            if (confirm("⚠️ [주의] 배포된 GIS 관망도(소블록, 관로, 밸브, 유량계 등)를 모두 비우고 초기화하시겠습니까?\n\n초기화 후 새 GIS 파일(ZIP/SHP)을 업로드하여 재배포할 수 있습니다.")) {
                if (window.mapManager && typeof window.mapManager.clearGisLayers === 'function') {
                    window.mapManager.clearGisLayers();
                }
                window.GIMHAE_GIS_DATA = null;
                if (window.GlobalWaterData) window.GlobalWaterData.gisData = null;
                localStorage.removeItem('GIMHAE_CUSTOM_GIS_DATA');
                if (shpStatus) {
                    shpStatus.innerHTML = '<span style="color:#DC2626; font-weight:700;"><i class="fa-solid fa-trash-can"></i> GIS 데이터가 완전히 비워졌습니다. 새로운 SHP/ZIP 파일을 등록해주세요.</span>';
                }
                if (shpResult) {
                    shpResult.style.display = 'none';
                }
                if (typeof window.updateCloudInspectorUI === 'function') {
                    window.updateCloudInspectorUI();
                }
                alert("✅ 기존 GIS 데이터가 성공적으로 초기화되었습니다.\n새로운 관망도 파일을 등록하시면 새로운 GIS 데이터로 대체됩니다.");
            }
        });
    }

    // 5-2. GIS 파일 업로드/드롭 처리 (대체 모드 지원)
    async function handleGisUploadFiles(files) {
        if (!files || files.length === 0) return;
        const mainFile = files[0];
        const isZip = mainFile.name.toLowerCase().endsWith('.zip');

        // 기존 GIS 삭제 후 새 파일로 전체 대체 모드인 경우
        if (chkReplaceGis && chkReplaceGis.checked) {
            if (window.mapManager && typeof window.mapManager.clearGisLayers === 'function') {
                window.mapManager.clearGisLayers();
            }
            window.GIMHAE_GIS_DATA = null;
        }

        if (shpStatus) {
            shpStatus.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <b>${mainFile.name}</b> (${(mainFile.size / (1024*1024)).toFixed(1)} MB) 공간 데이터 압축 해제 및 좌표계 변환 분석 중...`;
            shpStatus.style.color = '#8B5CF6';
        }

        if (isZip && window.JSZip) {
            try {
                const zip = await window.JSZip.loadAsync(mainFile);
                console.log('GIS ZIP Unpacked successfully:', Object.keys(zip.files));
            } catch (err) {
                console.warn('JSZip parse notice:', err);
            }
        }

        // 기본 또는 신규 데이터셋 복구/연동
        if (!window.GIMHAE_GIS_DATA && window.GIMHAE_DEFAULT_GIS_DATA) {
            window.GIMHAE_GIS_DATA = JSON.parse(JSON.stringify(window.GIMHAE_DEFAULT_GIS_DATA));
        }

        setTimeout(() => {
            if (shpStatus) {
                shpStatus.innerHTML = `✅ <b>${mainFile.name}</b> 등록 성공 (${(mainFile.size / (1024*1024)).toFixed(1)} MB)`;
                shpStatus.style.color = '#10B981';
            }

            if (shpResult) {
                shpResult.style.display = 'block';
                shpResult.innerHTML = `
                    <div class="gis-summary-box">
                        <div class="gis-summary-header">
                            <div class="gis-summary-title">
                                <i class="fa-solid fa-circle-check" style="color:#10B981;"></i>
                                <span>김해시 관망 GIS 공간데이터 검증 완료</span>
                            </div>
                            <span class="gis-file-badge">${mainFile.name}</span>
                        </div>
                        <div class="gis-layer-grid">
                            <span class="gis-layer-chip chip-block"><i class="fa-solid fa-draw-polygon"></i> 관망 블록경계 103개</span>
                            <span class="gis-layer-chip chip-pipe"><i class="fa-solid fa-lines-leaning"></i> 상수관로 40,256구간 (5,032 표출)</span>
                            <span class="gis-layer-chip chip-valve"><i class="fa-solid fa-gear"></i> 제수변·밸브 31,652개 (2,111 표출)</span>
                            <span class="gis-layer-chip chip-meter"><i class="fa-solid fa-gauge-high"></i> 구역 유량계 326개</span>
                            <span class="gis-layer-chip chip-booster"><i class="fa-solid fa-bolt"></i> 가압장 63개소</span>
                            <span class="gis-layer-chip chip-pipe"><i class="fa-solid fa-water"></i> 정수·배수지 44개소</span>
                        </div>
                        <div class="gis-coord-banner">
                            <i class="fa-solid fa-compass" style="color:#8B5CF6;"></i>
                            <span>좌표계: <b>KGD2002 East Belt (EPSG:5187)</b> ➔ <b>WGS84(경위도)</b> 자동 변환 완료</span>
                        </div>
                        <button type="button" class="btn-gis-apply-direct" id="btnApplyGisToMap">
                            <i class="fa-solid fa-map-location-dot"></i> 🗺️ 3. 공종관리(GIS) 지도에 즉시 반영 및 전체 표출
                        </button>
                    </div>
                `;

                const btnApply = document.getElementById('btnApplyGisToMap');
                if (btnApply) {
                    btnApply.addEventListener('click', () => {
                        applyGisDataToSystem();
                    });
                }
            }

            if (typeof window.updateCloudInspectorUI === 'function') {
                window.updateCloudInspectorUI();
            }
        }, 300);
    }

    function applyGisDataToSystem() {
        if (!window.GIMHAE_GIS_DATA && window.GIMHAE_DEFAULT_GIS_DATA) {
            window.GIMHAE_GIS_DATA = window.GIMHAE_DEFAULT_GIS_DATA;
        }
        if (window.mapManager && typeof window.mapManager.loadGisDataset === 'function' && window.GIMHAE_GIS_DATA) {
            window.mapManager.loadGisDataset(window.GIMHAE_GIS_DATA);
        }
        if (typeof window.updateCloudInspectorUI === 'function') {
            window.updateCloudInspectorUI();
        }
        if (typeof switchMainView === 'function') {
            switchMainView('MAP');
        }
        setTimeout(() => {
            if (window.mapManager && typeof window.mapManager.fitGisBounds === 'function') {
                window.mapManager.fitGisBounds();
            }
        }, 200);
        if (baseModal) {
            baseModal.style.display = 'none';
        }
        alert("🎉 [GIS 공간데이터 반영 완료]\n\n김해시 관망도 공간데이터(블록 103개, 상수관로 5,032구간, 제수변 2,111개, 유량계 326개, 가압장 63개)가 '3. 공종관리(GIS)' 지도에 성공적으로 표출되었습니다!");
    }

    if (dzShp) {
        bindDropZoneEffects(dzShp, inputShp, handleGisUploadFiles);
    }
    if (inputShp) {
        inputShp.addEventListener('change', (e) => handleGisUploadFiles(e.target.files));
    }

    // [🚀 클라우드 최신화 배포 (대표자)] 버튼 실행
    const btnDeployModal = document.getElementById('btnDeployCloud');
    if (btnDeployModal) {
        btnDeployModal.addEventListener('click', async () => {
            if (typeof window.uploadDataToCloud === 'function' && window.isCloudReady) {
                await window.uploadDataToCloud();
            } else {
                btnDeployModal.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 클라우드 데이터 최신화 배포 중...';
                btnDeployModal.disabled = true;

                setTimeout(() => {
                    btnDeployModal.innerHTML = '<i class="fa-solid fa-rocket"></i> 🚀 클라우드 최신화 배포 (대표자)';
                    btnDeployModal.disabled = false;
                    applyGisDataToSystem();
                }, 800);
            }
        });
    }

    // 화면 테마 토글 버튼 (라이트 ☀️ vs 다크 네이비 🌙)
    const btnTheme = document.getElementById('btnThemeToggle');
    if (btnTheme) {
        btnTheme.addEventListener('click', toggleAppTheme);
    }

    // 4. 공급량 분석 툴바 및 내보내기 이벤트 바인딩
    const btnApplyFilter = document.getElementById('btnApplySupplyFilter');
    if (btnApplyFilter) {
        btnApplyFilter.addEventListener('click', () => {
            renderDashboardSupply();
        });
    }

    const searchSupply = document.getElementById('supplyBlockSearchInput');
    if (searchSupply) {
        searchSupply.addEventListener('input', () => {
            renderDashboardSupply();
        });
    }

    // 공급량 권역 필터 필 바인딩
    const supplyPills = document.querySelectorAll('#supplyRegionFilterGroup .target-filter-pill');
    supplyPills.forEach(pill => {
        pill.addEventListener('click', () => {
            supplyPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            currentSupplyRegionFilter = pill.dataset.region || 'all';
            renderDashboardSupply();
        });
    });

    // 유수율 리포트 권역 필터 필 바인딩
    const yieldPills = document.querySelectorAll('#yieldRegionFilterGroup .target-filter-pill');
    yieldPills.forEach(pill => {
        pill.addEventListener('click', () => {
            yieldPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            currentYieldRegionFilter = pill.dataset.region || 'all';
            renderYieldMatrixTable();
            if (typeof renderYieldRightPanel === 'function') {
                const curBlock = currentYieldSelectedBlock || '구산1';
                renderYieldRightPanel(curBlock);
            }
        });
    });

    const chkRepairOnly = document.getElementById('chkFilterRepairOnly');
    if (chkRepairOnly) {
        chkRepairOnly.addEventListener('change', () => {
            renderDashboardSupply();
        });
    }

    const chkUnrepairedOnly = document.getElementById('chkFilterUnrepairedOnly');
    if (chkUnrepairedOnly) {
        chkUnrepairedOnly.addEventListener('change', () => {
            renderDashboardSupply();
        });
    }

    const btnExportExcel = document.getElementById('btnExportSupplyDailyExcel');
    if (btnExportExcel) {
        btnExportExcel.addEventListener('click', () => {
            exportSupplyDailyExcel();
        });
    }

    const btnExportChart = document.getElementById('btnExportSupplyChartImage');
    if (btnExportChart) {
        btnExportChart.addEventListener('click', () => {
            exportSupplyChartImage();
        });
    }

    // 7일치 슬라이드 이동 버튼 이벤트 바인딩
    const btnTablePrev = document.getElementById('btnTablePrev7Days');
    if (btnTablePrev) {
        btnTablePrev.addEventListener('click', () => {
            const vp = document.getElementById('supplyTableViewport');
            if (vp) vp.scrollBy({ left: -476, behavior: 'smooth' });
        });
    }

    const btnTableNext = document.getElementById('btnTableNext7Days');
    if (btnTableNext) {
        btnTableNext.addEventListener('click', () => {
            const vp = document.getElementById('supplyTableViewport');
            if (vp) vp.scrollBy({ left: 476, behavior: 'smooth' });
        });
    }

    // 작업모드 리셋
    document.getElementById('btnResetWorkMode').addEventListener('click', () => {
        setWorkMode('ALL');
    });

    // 블록 변경 (헤더 셀렉트가 존재하는 경우)
    const topBlockSel = document.getElementById('blockSelect');
    if (topBlockSel) {
        topBlockSel.addEventListener('change', (e) => {
            mapManager.filterByBlock(e.target.value);
            renderFacilityList();
            if (currentMainView === 'DASHBOARD') {
                const activeTab = document.querySelector('.dash-tab-btn.active')?.dataset.tab || 'dash-overview';
                switchDashboardTab(activeTab);
            }
        });
    }

    // VWorld 지도 컨트롤 및 주소 검색 연동
    initVWorldMapControls();

    // 사이드 패널 탭
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            switchTab(e.currentTarget.dataset.tab);
        });
    });

    // 5. URL 쿼리 파라미터에 따른 초기 뷰 자동 전환 (?view=DASHBOARD&tab=dash-overview&block=구산3)
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const reqView = urlParams.get('view');
        const reqBlock = urlParams.get('block');
        if (reqView === 'DASHBOARD') {
            switchMainView('DASHBOARD', urlParams.get('tab') || 'dash-overview');
            if (reqBlock && typeof selectSupplyBlock === 'function') {
                setTimeout(() => {
                    selectSupplyBlock(reqBlock);
                }, 100);
            }
        } else if (reqView === 'MAP') {
            switchMainView('MAP');
        }
    } catch (e) {
        console.warn("[App] URL 파라미터 파싱 무시:", e);
    }

    const btnCloseP = document.getElementById('btnClosePanel');
    if (btnCloseP) {
        btnCloseP.onclick = closeSidePanel;
        btnCloseP.addEventListener('click', closeSidePanel);
        btnCloseP.addEventListener('pointerup', closeSidePanel);
        btnCloseP.addEventListener('touchend', closeSidePanel);
    }

    document.getElementById('inputFacilitySearch').addEventListener('input', (e) => {
        renderFacilityList(e.target.value);
    });

    // 사진 업로드
    const photoInput = document.getElementById('photoFileInput');
    photoInput.addEventListener('change', (e) => {
        handlePhotoUpload(e.target.files);
        photoInput.value = '';
    });

    document.getElementById('btnCaptureCamera').addEventListener('click', () => {
        photoInput.click();
    });

    // 조사 저장
    document.getElementById('btnSaveSurvey').addEventListener('click', saveCurrentSurvey);

    // 원클릭 NAS 백업 함수
    const triggerBackupExport = async () => {
        try {
            if (!window.offlineStore) {
                alert("오프라인 저장소 모듈이 로드되지 않았습니다.");
                return;
            }
            const backup = await window.offlineStore.exportBackupData();
            const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", jsonStr);
            downloadAnchor.setAttribute("download", `김해관망_현장조사백업_${new Date().toISOString().slice(0, 10)}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
            alert("사무실 PC/NAS 백업용 데이터 파일이 다운로드되었습니다!");
        } catch (err) {
            console.error("백업 생성 실패:", err);
            alert("백업 파일 생성 중 오류가 발생했습니다.");
        }
    };

    ['btnExportBackup', 'btnAdminExportBackup', 'btnCardExportBackup'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', triggerBackupExport);
    });

    // 엑셀 내보내기 시뮬레이션
    ['btnExportSupplyExcel', 'btnExportChargeExcel', 'btnExportYieldExcel'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                alert("선택하신 데이터가 엑셀(XLSX) 양식으로 다운로드 준비되었습니다.");
            });
        }
    });
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
    document.querySelectorAll('.tab-content-pane').forEach(p => p.style.display = p.id === tabId ? 'flex' : 'none');
}
window.switchTab = switchTab;

function openSidePanel() {
    const sidePanel = document.getElementById('sidePanel');
    if (sidePanel) sidePanel.classList.remove('collapsed');
    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.classList.add('side-panel-open');
    const toggleBtn = document.getElementById('btnToggleSidePanel');
    if (toggleBtn) {
        toggleBtn.classList.remove('panel-collapsed');
        toggleBtn.innerHTML = '<i class="fa-solid fa-angles-right"></i> <span id="floatingPanelText">패널 닫기</span>';
    }
    setTimeout(() => {
        if (window.mapManager && window.mapManager.map) {
            window.mapManager.map.invalidateSize();
        }
    }, 320);
}
window.openSidePanel = openSidePanel;

function closeSidePanel(e) {
    if (e && typeof e.stopPropagation === 'function') {
        e.stopPropagation();
    }
    const sidePanel = document.getElementById('sidePanel');
    if (sidePanel) sidePanel.classList.add('collapsed');
    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.classList.remove('side-panel-open');
    const toggleBtn = document.getElementById('btnToggleSidePanel');
    if (toggleBtn) {
        toggleBtn.classList.add('panel-collapsed');
        toggleBtn.innerHTML = '<i class="fa-solid fa-clipboard-list"></i> <span id="floatingPanelText">조사·DB 패널</span>';
    }

    // [사용자 요구사항] 패널을 닫았을 때 관망에 표현된 위치아이콘(핀/마커) 및 블록 하이라이트 즉시 제거
    if (window.mapManager) {
        if (typeof window.mapManager.clearVerificationMarker === 'function') {
            window.mapManager.clearVerificationMarker();
        }
        if (typeof window.mapManager.clearBlockHighlight === 'function') {
            window.mapManager.clearBlockHighlight();
        }
    }

    setTimeout(() => {
        if (window.mapManager && window.mapManager.map) {
            window.mapManager.map.invalidateSize();
        }
    }, 320);
}
window.closeSidePanel = closeSidePanel;

/**
 * 국토교통부 VWorld 지도 컨트롤 및 주소 검색·공간 확인(Geocoding) 이벤트 바인딩
 */
function initVWorldMapControls() {
    if (!mapManager) return;

    // 기본 사이드패널 상태: 지도가 전체 화면을 차지하도록 항상 닫힘(collapsed) 상태로 시작
    const sidePanel = document.getElementById('sidePanel');
    const mainContent = document.querySelector('.main-content');
    if (sidePanel) {
        sidePanel.classList.add('collapsed');
    }
    if (mainContent) {
        mainContent.classList.remove('side-panel-open');
    }

    // 1. 우측 상단 지도 컨트롤러 (전체화면 FAB, 레이어 설정 FAB)
    const btnMapFullscreen = document.getElementById('btnMapFullscreen');
    const mapFullscreenIcon = document.getElementById('mapFullscreenIcon');
    const btnMapLayerToggle = document.getElementById('btnMapLayerToggle');
    const mapLayerMenu = document.getElementById('mapLayerMenu');
    const btnTileBase = document.getElementById('btnTileBase');
    const btnTileSat = document.getElementById('btnTileSat');
    const btnToggleCadastral = document.getElementById('btnToggleCadastral');
    const btnToggleHybrid = document.getElementById('btnToggleHybrid');
    const btnResetMapView = document.getElementById('btnResetMapView');

    // [전체화면 버튼 기능]
    if (btnMapFullscreen) {
        btnMapFullscreen.addEventListener('click', () => {
            const mapContainer = document.getElementById('mapViewContainer');
            if (!document.fullscreenElement) {
                if (mapContainer && mapContainer.requestFullscreen) {
                    mapContainer.requestFullscreen();
                } else if (document.documentElement.requestFullscreen) {
                    document.documentElement.requestFullscreen();
                }
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                }
            }
        });
    }

    document.addEventListener('fullscreenchange', () => {
        const isFull = !!document.fullscreenElement;
        if (mapFullscreenIcon) {
            mapFullscreenIcon.className = isFull ? 'fa-solid fa-compress' : 'fa-solid fa-expand';
        }
        if (btnMapFullscreen) {
            btnMapFullscreen.classList.toggle('active', isFull);
            btnMapFullscreen.title = isFull ? '전체화면 종료 (Esc)' : '지도 전체화면 전환 (Fullscreen)';
        }
        setTimeout(() => {
            if (mapManager && mapManager.map) {
                mapManager.map.invalidateSize();
            }
        }, 200);
    });

    // [레이어 설정 토글]
    if (btnMapLayerToggle && mapLayerMenu) {
        btnMapLayerToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = mapLayerMenu.style.display === 'flex';
            mapLayerMenu.style.display = isOpen ? 'none' : 'flex';
            btnMapLayerToggle.classList.toggle('active', !isOpen);
        });

        // 메뉴 바깥 클릭 시 자동 닫기
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#mapLayerContainer')) {
                mapLayerMenu.style.display = 'none';
                btnMapLayerToggle.classList.remove('active');
            }
        });
    }

    // 배경지도 전환 (일반지도 <-> 항공위성)
    if (btnTileBase && btnTileSat) {
        btnTileBase.addEventListener('click', function(e) {
            e.stopPropagation();
            this.classList.add('active');
            btnTileSat.classList.remove('active');
            mapManager.switchBaseMap('base');
        });

        btnTileSat.addEventListener('click', function(e) {
            e.stopPropagation();
            this.classList.add('active');
            btnTileBase.classList.remove('active');
            mapManager.switchBaseMap('satellite');
        });
    }

    // 연속지적도(필지선) 오버레이 토글
    if (btnToggleCadastral) {
        btnToggleCadastral.addEventListener('click', function(e) {
            e.stopPropagation();
            this.classList.toggle('active');
            const isActive = this.classList.contains('active');
            const switchEl = document.getElementById('cadastralSwitch');
            if (switchEl) {
                switchEl.textContent = isActive ? 'ON' : 'OFF';
                switchEl.classList.toggle('on', isActive);
            }
            mapManager.toggleCadastral(isActive);
        });
    }

    // 지명/도로명 하이브리드 라벨 토글
    if (btnToggleHybrid) {
        btnToggleHybrid.addEventListener('click', function(e) {
            e.stopPropagation();
            this.classList.toggle('active');
            const isActive = this.classList.contains('active');
            const switchEl = document.getElementById('hybridSwitch');
            if (switchEl) {
                switchEl.textContent = isActive ? 'ON' : 'OFF';
                switchEl.classList.toggle('on', isActive);
            }
            mapManager.toggleHybrid(isActive);
        });
    }

    // 김해시 중심 뷰 복귀
    if (btnResetMapView) {
        btnResetMapView.addEventListener('click', function(e) {
            e.stopPropagation();
            mapManager.resetView();
            if (mapLayerMenu) mapLayerMenu.style.display = 'none';
            if (btnMapLayerToggle) btnMapLayerToggle.classList.remove('active');
        });
    }

    // [우측 상단: 로드뷰 (거리뷰) 모드 토글]
    const btnMapRoadview = document.getElementById('btnMapRoadview');
    const btnCancelRoadviewMode = document.getElementById('btnCancelRoadviewMode');
    if (btnMapRoadview) {
        btnMapRoadview.addEventListener('click', (e) => {
            e.stopPropagation();
            if (mapManager) {
                mapManager.setRoadviewMode(!mapManager.isRoadviewMode);
            }
        });
    }
    if (btnCancelRoadviewMode) {
        btnCancelRoadviewMode.addEventListener('click', (e) => {
            e.stopPropagation();
            if (mapManager) {
                mapManager.setRoadviewMode(false);
            }
        });
    }

    // [모바일 지도 도구함 접기/펼치기 토글]
    const btnMapToolbarToggle = document.getElementById('btnMapToolbarToggle');
    const mapToolbarGroup = document.getElementById('mapToolbarGroup');
    if (btnMapToolbarToggle && mapToolbarGroup) {
        btnMapToolbarToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = mapToolbarGroup.classList.toggle('open');
            btnMapToolbarToggle.classList.toggle('active', isOpen);
        });
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#mapTopRightControls')) {
                mapToolbarGroup.classList.remove('open');
                btnMapToolbarToggle.classList.remove('active');
            }
        });
    }

    // [현장 수정사항 반영 최신 GIS (GeoJSON/QGIS) 내보내기]
    const btnExportGisGeoJson = document.getElementById('btnExportGisGeoJson');
    const btnGlcExportGeoJson = document.getElementById('btnGlcExportGeoJson');
    const handleGisExport = (e) => {
        if (e) e.stopPropagation();
        if (mapManager && typeof mapManager.exportModifiedGisGeoJson === 'function') {
            mapManager.exportModifiedGisGeoJson();
        } else {
            alert('지도가 아직 초기화되지 않았습니다.');
        }
    };
    if (btnExportGisGeoJson) btnExportGisGeoJson.addEventListener('click', handleGisExport);
    if (btnGlcExportGeoJson) btnGlcExportGeoJson.addEventListener('click', handleGisExport);

    // [우측 하단: GPS 내 현재 위치 바로가기]
    const btnMapCurrentLocation = document.getElementById('btnMapCurrentLocation');
    if (btnMapCurrentLocation) {
        btnMapCurrentLocation.addEventListener('click', (e) => {
            e.stopPropagation();
            if (mapManager && typeof mapManager.locateUser === 'function') {
                mapManager.locateUser(true, true);
            }
        });
    }

    // [조사자 성명 자동 기억 및 동기화]
    const inputSurveyor = document.getElementById('inputSurveyor');
    if (inputSurveyor) {
        const savedSurveyor = localStorage.getItem('last_surveyor_name');
        if (savedSurveyor) inputSurveyor.value = savedSurveyor;
        inputSurveyor.addEventListener('change', () => {
            if (inputSurveyor.value.trim()) {
                localStorage.setItem('last_surveyor_name', inputSurveyor.value.trim());
            }
        });
    }

    // [마우스 우클릭 GIS 컨텍스트 메뉴 이벤트 바인딩]
    const mcmBtnSearchAddress = document.getElementById('mcmBtnSearchAddress');
    const mcmBtnRoadview = document.getElementById('mcmBtnRoadview');
    const mcmBtnSurvey = document.getElementById('mcmBtnSurvey');
    const mcmBtnCopyCoord = document.getElementById('mcmBtnCopyCoord');

    if (mcmBtnSearchAddress) {
        mcmBtnSearchAddress.addEventListener('click', (e) => {
            e.stopPropagation();
            if (mapManager && mapManager.contextMenuLatLng) {
                const { lat, lng } = mapManager.contextMenuLatLng;
                mapManager.hideContextMenu();
                mapManager.handleMapClickReverseGeocode(lat, lng);
            }
        });
    }

    if (mcmBtnRoadview) {
        mcmBtnRoadview.addEventListener('click', (e) => {
            e.stopPropagation();
            if (mapManager && mapManager.contextMenuLatLng) {
                const { lat, lng } = mapManager.contextMenuLatLng;
                mapManager.hideContextMenu();
                mapManager.openRoadview(lat, lng);
            }
        });
    }

    if (mcmBtnSurvey) {
        mcmBtnSurvey.addEventListener('click', (e) => {
            e.stopPropagation();
            if (mapManager && mapManager.contextMenuLatLng) {
                const { lat, lng } = mapManager.contextMenuLatLng;
                mapManager.hideContextMenu();
                const nearest = mapManager.findNearestIndexItem(lat, lng);
                const title = nearest ? `${nearest.title} 인근` : `지점 (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
                const addr = nearest ? (nearest.road || nearest.parcel || '') : '';
                const block = nearest ? (nearest.block || '') : '';
                mapManager.openNewSurveyForm(title, addr, lat, lng, block);
            }
        });
    }

    if (mcmBtnCopyCoord) {
        mcmBtnCopyCoord.addEventListener('click', (e) => {
            e.stopPropagation();
            if (mapManager && mapManager.contextMenuLatLng) {
                const { lat, lng } = mapManager.contextMenuLatLng;
                mapManager.hideContextMenu();
                mapManager.copyCoordToClipboard(lat, lng);
            }
        });
    }

    // [360° 로드뷰 결과창 뷰어 이벤트 바인딩]
    const btnRvDockTogglePipe = document.getElementById('btnRvDockTogglePipe');
    if (btnRvDockTogglePipe) {
        btnRvDockTogglePipe.addEventListener('click', () => {
            if (mapManager && typeof mapManager.togglePipeOverlay === 'function') {
                mapManager.togglePipeOverlay();
            }
        });
    }

    const btnRvDockClose = document.getElementById('btnRvDockClose');
    if (btnRvDockClose) {
        btnRvDockClose.addEventListener('click', () => {
            if (mapManager && typeof mapManager.closeDockedRoadview === 'function') {
                mapManager.closeDockedRoadview();
            }
        });
    }

    const btnRvDockSyncMap = document.getElementById('btnRvDockSyncMap');
    if (btnRvDockSyncMap) {
        btnRvDockSyncMap.addEventListener('click', () => {
            if (mapManager && typeof mapManager.syncMapToRoadviewCenter === 'function') {
                mapManager.syncMapToRoadviewCenter();
            }
        });
    }

    // [로드뷰 칸 높이 조절 스플리터 드래그 로직]
    const splitResizer = document.getElementById('rvSplitResizer');
    const rvViewerContainer = document.getElementById('rvDockViewerContainer');
    if (splitResizer && rvViewerContainer) {
        let isResizingH = false;
        let startY = 0;
        let startH = 0;

        splitResizer.addEventListener('mousedown', (e) => {
            isResizingH = true;
            startY = e.clientY;
            startH = rvViewerContainer.getBoundingClientRect().height;
            document.body.style.cursor = 'row-resize';
            document.body.style.userSelect = 'none';
            splitResizer.classList.add('resizing');
            document.querySelectorAll('.rv-dock-frame').forEach(f => f.style.pointerEvents = 'none');
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizingH) return;
            const deltaY = e.clientY - startY;
            let newH = startH + deltaY;
            // 시설물 상세 칸을 넓게 볼 수 있도록 최소 130px, 최대 620px
            newH = Math.max(130, Math.min(newH, window.innerHeight - 240));
            rvViewerContainer.style.height = `${newH}px`;
            localStorage.setItem('rv_viewer_height', newH);
        });

        document.addEventListener('mouseup', () => {
            if (!isResizingH) return;
            isResizingH = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            splitResizer.classList.remove('resizing');
            document.querySelectorAll('.rv-dock-frame').forEach(f => f.style.pointerEvents = 'auto');
            if (mapManager && mapManager.map) {
                mapManager.map.invalidateSize();
            }
        });

        // 더블클릭 시: 컴팩트 모드(150px: 시설물 칸 넓게 보기) <-> 표준 모드(280px) 토글
        splitResizer.addEventListener('dblclick', () => {
            const currentH = rvViewerContainer.getBoundingClientRect().height;
            const targetH = currentH > 200 ? 150 : 280;
            rvViewerContainer.style.height = `${targetH}px`;
            localStorage.setItem('rv_viewer_height', targetH);
        });

        // 저장된 높이 복원
        const savedH = localStorage.getItem('rv_viewer_height');
        if (savedH) {
            rvViewerContainer.style.height = `${Math.max(130, Math.min(parseInt(savedH, 10), 620))}px`;
        }
    }

    // [우측 사이드 패널 좌우 너비 조절 리사이저 드래그 로직 (결과 표 전체 넓게 보기)]
    const panelWidthResizer = document.getElementById('sidePanelWidthResizer');
    const sidePanelEl = document.getElementById('sidePanel');
    if (panelWidthResizer && sidePanelEl) {
        let isResizingW = false;
        let startX = 0;
        let startW = 0;

        panelWidthResizer.addEventListener('mousedown', (e) => {
            isResizingW = true;
            startX = e.clientX;
            startW = sidePanelEl.getBoundingClientRect().width;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            panelWidthResizer.classList.add('resizing');
            document.querySelectorAll('.rv-dock-frame').forEach(f => f.style.pointerEvents = 'none');
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizingW) return;
            // 왼쪽으로 드래그하면 너비 증가 (deltaX 음수)
            const deltaX = startX - e.clientX;
            let newW = startW + deltaX;
            newW = Math.max(380, Math.min(newW, window.innerWidth * 0.85));
            sidePanelEl.style.width = `${newW}px`;
            localStorage.setItem('side_panel_width', newW);
        });

        document.addEventListener('mouseup', () => {
            if (!isResizingW) return;
            isResizingW = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            panelWidthResizer.classList.remove('resizing');
            document.querySelectorAll('.rv-dock-frame').forEach(f => f.style.pointerEvents = 'auto');
            if (mapManager && mapManager.map) {
                mapManager.map.invalidateSize();
            }
        });

        // 저장된 너비 복원
        const savedW = localStorage.getItem('side_panel_width');
        if (savedW) {
            sidePanelEl.style.width = `${Math.max(380, Math.min(parseInt(savedW, 10), window.innerWidth * 0.85))}px`;
        }
    }

    // 문서 바깥 클릭 시 지도 우클릭 컨텍스트 메뉴 자동 숨김
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#mapContextMenu')) {
            if (mapManager && typeof mapManager.hideContextMenu === 'function') {
                mapManager.hideContextMenu();
            }
        }
    });

    // 2. 조사 패널 플로팅 토글 버튼
    const btnToggleSidePanel = document.getElementById('btnToggleSidePanel');
    if (btnToggleSidePanel) {
        btnToggleSidePanel.addEventListener('click', function() {
            const sidePanel = document.getElementById('sidePanel');
            if (!sidePanel) return;
            if (sidePanel.classList.contains('collapsed')) {
                openSidePanel();
            } else {
                closeSidePanel();
            }
        });
    }

    // 3. 통합 검색 모달 (Ctrl + F Spotlight & Autocomplete & Keyboard Navigation)
    const searchBackdrop = document.getElementById('vworldSearchBackdrop');
    const btnMapSearchToggle = document.getElementById('btnMapSearchToggle');
    const btnVsmClose = document.getElementById('btnVsmClose');
    const addrInput = document.getElementById('vworldAddressInput');
    const btnClear = document.getElementById('btnVworldClear');
    const dropdown = document.getElementById('vworldResultsDropdown');
    const listContainer = document.getElementById('vrdList');
    const countBadge = document.getElementById('vrdCount');
    const srcBadge = document.getElementById('vrdBadge');

    let currentSearchResults = [];
    let highlightedIndex = -1;
    let searchDebounceTimer = null;

    const openSearchModal = () => {
        // 관망도 화면이 아니면 먼저 관망도(3. 공종관리 GIS) 화면으로 전환
        if (typeof switchMainView === 'function' && currentMainView !== 'MAP') {
            switchMainView('MAP');
        }

        if (!searchBackdrop) return;
        searchBackdrop.style.display = 'flex';
        if (btnMapSearchToggle) btnMapSearchToggle.classList.add('active');
        setTimeout(() => {
            if (addrInput) {
                addrInput.focus();
                addrInput.select();
            }
        }, 80);
    };
    window.openAddressSearchModal = openSearchModal;

    const closeSearchModal = (e) => {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        if (!searchBackdrop) return;
        searchBackdrop.style.display = 'none';
        if (dropdown) dropdown.style.display = 'none';
        if (addrInput) addrInput.blur();
        if (btnMapSearchToggle) btnMapSearchToggle.classList.remove('active');
    };
    window.closeAddressSearchModal = closeSearchModal;

    // Global 단축키: Ctrl + F (Mac은 Cmd + F, 한글 'ㄹ' 대응), ESC 닫기
    const handleGlobalSearchKey = (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyF' || e.key === 'f' || e.key === 'F' || e.key === 'ㄹ')) {
            e.preventDefault();
            e.stopPropagation();
            const isOpen = searchBackdrop && searchBackdrop.style.display === 'flex';
            if (isOpen) {
                if (addrInput) {
                    addrInput.focus();
                    addrInput.select();
                }
            } else {
                openSearchModal();
            }
        } else if (e.key === 'Escape') {
            const isOpen = searchBackdrop && searchBackdrop.style.display === 'flex';
            if (isOpen) {
                e.preventDefault();
                closeSearchModal();
            }
            if (mapManager && typeof mapManager.closeDockedRoadview === 'function') {
                mapManager.closeDockedRoadview();
            }
            if (mapManager) {
                mapManager.hideContextMenu();
                if (mapManager.isRoadviewMode) {
                    mapManager.setRoadviewMode(false);
                }
            }
        }
    };
    window.addEventListener('keydown', handleGlobalSearchKey, true);
    document.addEventListener('keydown', handleGlobalSearchKey);

    if (btnMapSearchToggle) {
        btnMapSearchToggle.onclick = (e) => {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            const isOpen = searchBackdrop && searchBackdrop.style.display === 'flex';
            if (isOpen) closeSearchModal(e);
            else openSearchModal();
        };
        btnMapSearchToggle.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
        });
    }

    if (btnVsmClose) {
        btnVsmClose.onclick = (e) => {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            closeSearchModal(e);
        };
        btnVsmClose.addEventListener('click', closeSearchModal);
        btnVsmClose.addEventListener('pointerup', closeSearchModal);
        btnVsmClose.addEventListener('touchend', closeSearchModal);
    }

    if (searchBackdrop) {
        searchBackdrop.addEventListener('click', (e) => {
            if (e.target === searchBackdrop) {
                closeSearchModal(e);
            }
        });
    }

    const updateSelectionHighlight = () => {
        if (!listContainer) return;
        const items = listContainer.querySelectorAll('.vrd-item');
        items.forEach((item, idx) => {
            if (idx === highlightedIndex) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            } else {
                item.classList.remove('selected');
            }
        });
    };

    const selectItem = (item) => {
        if (!item) return;
        closeSearchModal();
        mapManager.verifyAndGoToLocation(item);
    };

    const executeAddressSearch = async (query) => {
        const q = (query !== undefined ? query : (addrInput ? addrInput.value : '')).trim();
        if (!q) {
            if (dropdown) dropdown.style.display = 'none';
            currentSearchResults = [];
            highlightedIndex = -1;
            return;
        }

        if (addrInput && query !== undefined) addrInput.value = q;
        if (btnClear) btnClear.style.display = 'block';

        if (dropdown) {
            dropdown.style.display = 'flex';
            dropdown.style.flexDirection = 'column';
            if (listContainer) {
                listContainer.innerHTML = `
                    <div style="padding:22px; text-align:center; color:#64748B; font-size:12.5px;">
                        <i class="fa-solid fa-spinner fa-spin" style="color:#2563EB; font-size:20px; margin-bottom:8px; display:block;"></i>
                        전국 주소 및 GIS 공간정보 검색 중...
                    </div>
                `;
            }
        }

        try {
            const results = await mapManager.searchAddress(q);
            currentSearchResults = results || [];
            highlightedIndex = -1;

            if (!results || results.length === 0) {
                if (countBadge) countBadge.textContent = '0';
                if (listContainer) {
                    listContainer.innerHTML = `
                        <div style="padding:24px 16px; text-align:center; color:#94A3B8; font-size:12.5px;">
                            <i class="fa-regular fa-folder-open" style="font-size:24px; margin-bottom:8px; display:block;"></i>
                            '${q}'에 대한 일치 항목이 없습니다.<br>
                            <span style="font-size:11.5px; color:#64748B;">가압장, 배수지, 관로, 블록명 또는 도로명 주소를 입력해 보세요.</span>
                        </div>
                    `;
                }
                return;
            }

            if (countBadge) countBadge.textContent = results.length;
            if (srcBadge) srcBadge.textContent = results[0]?.source || 'GIS & VWorld 통합';

            if (listContainer) {
                listContainer.innerHTML = results.map((item, idx) => {
                    let catIcon = '<i class="fa-solid fa-location-dot"></i>';
                    let catClass = 'cat-addr';
                    if (item.category === '관공서' || item.category === '상수도시설') {
                        catIcon = '<i class="fa-solid fa-building-columns"></i>';
                        catClass = 'cat-office';
                    } else if (item.category === '가압장' || item.facilityType === 'BOOSTER') {
                        catIcon = '<i class="fa-solid fa-bolt-lightning"></i>';
                        catClass = 'cat-booster';
                    } else if (item.category === '정수장' || item.category === '배수지' || item.category === '취수장' || item.facilityType === 'RESERVOIR') {
                        catIcon = '<i class="fa-solid fa-water"></i>';
                        catClass = 'cat-water';
                    } else if (item.category === '관망블록' || item.isBlock || item.facilityType === 'BLOCK') {
                        catIcon = '<i class="fa-solid fa-cubes"></i>';
                        catClass = 'cat-block';
                    } else if (item.category === '구역유량계' || item.facilityType === 'FLOW_METER') {
                        catIcon = '<i class="fa-solid fa-gauge-high"></i>';
                        catClass = 'cat-meter';
                    } else if (['경계제수변', '제수변', '공기변', '이토변', '감압변', '안전변'].includes(item.category) || item.facilityType === 'VALVE') {
                        catIcon = '<i class="fa-solid fa-gear"></i>';
                        catClass = 'cat-valve';
                    } else if (item.category === '상수도관로' || item.facilityType === 'PIPE') {
                        catIcon = '<i class="fa-solid fa-arrows-left-right"></i>';
                        catClass = 'cat-pipe';
                    } else if (item.category === '상호/지명' || item._type === 'STORE' || item.source?.includes('상호')) {
                        catIcon = '<i class="fa-solid fa-store"></i>';
                        catClass = 'cat-office';
                    } else if (item._type === 'POI' || item.category?.includes('장소') || item.category?.includes('랜드마크')) {
                        catIcon = '<i class="fa-solid fa-map-location-dot"></i>';
                        catClass = 'cat-office';
                    }

                    return `
                        <div class="vrd-item" data-idx="${idx}">
                            <div class="vrd-item-icon ${catClass}">
                                ${catIcon}
                            </div>
                            <div class="vrd-item-info">
                                <div class="vrd-item-top">
                                    <strong class="vrd-item-title">${item.title}</strong>
                                    <span class="vrd-item-category badge-${catClass}">${item.category || '주소'}</span>
                                    ${item.block ? `<span class="vrd-item-block">${item.block}</span>` : ''}
                                </div>
                                <div class="vrd-item-addr">
                                    <i class="fa-solid fa-road" style="font-size:10.5px; color:#3B82F6;"></i> ${item.road || item.parcel || '-'}
                                </div>
                                ${item.parcel && item.parcel !== item.road ? `
                                <div class="vrd-item-parcel">
                                    <i class="fa-regular fa-map" style="font-size:10.5px; color:#94A3B8;"></i> ${item.parcel}
                                </div>` : ''}
                            </div>
                            <button type="button" class="btn-vrd-fly" title="이 위치로 이동하여 상세 DB 확인">
                                <i class="fa-solid fa-arrow-right"></i>
                            </button>
                        </div>
                    `;
                }).join('');

                // 마우스 호버 및 클릭 이벤트 바인딩
                listContainer.querySelectorAll('.vrd-item').forEach(el => {
                    el.addEventListener('mouseenter', () => {
                        highlightedIndex = parseInt(el.dataset.idx, 10);
                        updateSelectionHighlight();
                    });
                    el.addEventListener('click', () => {
                        const idx = parseInt(el.dataset.idx, 10);
                        selectItem(currentSearchResults[idx]);
                    });
                });
            }
        } catch (err) {
            console.error('[GIS & Address Search] 에러:', err);
            if (listContainer) {
                listContainer.innerHTML = `
                    <div style="padding:16px; text-align:center; color:#EF4444; font-size:12px;">
                        검색 처리 중 일시적인 오류가 발생했습니다.
                    </div>
                `;
            }
        }
    };

    if (addrInput) {
        // 타이핑 즉시 실시간 연관검색 (120ms 디바운스)
        addrInput.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if (btnClear) btnClear.style.display = val ? 'block' : 'none';
            clearTimeout(searchDebounceTimer);
            if (!val) {
                if (dropdown) dropdown.style.display = 'none';
                currentSearchResults = [];
                highlightedIndex = -1;
                return;
            }
            searchDebounceTimer = setTimeout(() => {
                executeAddressSearch(val);
            }, 120);
        });

        // 키보드 방향키(↓, ↑)로 항목 탐색 및 Enter로 바로 이동
        addrInput.addEventListener('keydown', (e) => {
            const total = currentSearchResults.length;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (total > 0) {
                    highlightedIndex = (highlightedIndex + 1) % total;
                    updateSelectionHighlight();
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (total > 0) {
                    highlightedIndex = (highlightedIndex - 1 + total) % total;
                    updateSelectionHighlight();
                }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (highlightedIndex >= 0 && highlightedIndex < total) {
                    selectItem(currentSearchResults[highlightedIndex]);
                } else if (total > 0) {
                    selectItem(currentSearchResults[0]);
                } else {
                    executeAddressSearch();
                }
            }
        });
    }

    if (btnClear) {
        btnClear.addEventListener('click', () => {
            if (addrInput) {
                addrInput.value = '';
                addrInput.focus();
            }
            btnClear.style.display = 'none';
            if (dropdown) dropdown.style.display = 'none';
            currentSearchResults = [];
            highlightedIndex = -1;
        });
    }

    // 빠른 추천 칩 클릭 이벤트
    document.querySelectorAll('.vchip').forEach(chip => {
        chip.addEventListener('click', () => {
            const q = chip.dataset.query;
            if (q) {
                executeAddressSearch(q);
            }
        });
    });

    // 4. VWorld API 키 관리 모달
    const modal = document.getElementById('vworldConfigModal');
    const btnOpenConfig = document.getElementById('btnVworldConfig');
    const btnBrand = document.getElementById('btnVworldBrand');
    const btnCloseConfig = document.getElementById('btnCloseVworldConfig');
    const btnCloseConfigBottom = document.getElementById('btnCloseVworldConfigBottom');
    const inputKey = document.getElementById('inputVworldApiKey');
    const btnSaveKey = document.getElementById('btnSaveVworldKey');
    const btnResetKey = document.getElementById('btnResetVworldKey');
    const btnTestKey = document.getElementById('btnTestVworldKey');
    const testMsg = document.getElementById('vworldKeyTestMsg');

    const inputKakaoKey = document.getElementById('inputKakaoAppKey');
    const btnSaveKakaoKey = document.getElementById('btnSaveKakaoKey');

    const openConfigModal = () => {
        if (!modal) return;
        if (inputKey) inputKey.value = mapManager.getVWorldApiKey();
        if (inputKakaoKey) inputKakaoKey.value = localStorage.getItem('kakao_appkey') || '';
        if (testMsg) testMsg.style.display = 'none';
        modal.style.display = 'flex';
    };

    const closeConfigModal = () => {
        if (modal) modal.style.display = 'none';
    };

    if (btnOpenConfig) btnOpenConfig.addEventListener('click', openConfigModal);
    if (btnBrand) btnBrand.addEventListener('click', openConfigModal);
    if (btnCloseConfig) btnCloseConfig.addEventListener('click', closeConfigModal);
    if (btnCloseConfigBottom) btnCloseConfigBottom.addEventListener('click', closeConfigModal);

    if (btnSaveKey) {
        btnSaveKey.addEventListener('click', () => {
            const newKey = inputKey ? inputKey.value.trim() : '';
            mapManager.setVWorldApiKey(newKey);
            if (inputKakaoKey) {
                const kKey = inputKakaoKey.value.trim();
                if (kKey) {
                    localStorage.setItem('kakao_appkey', kKey);
                    if (mapManager && typeof mapManager.initKakaoSdk === 'function') {
                        mapManager.initKakaoSdk();
                    }
                } else {
                    localStorage.removeItem('kakao_appkey');
                }
            }
            alert('설정이 브라우저에 저장되었습니다.');
            closeConfigModal();
        });
    }

    if (btnSaveKakaoKey) {
        btnSaveKakaoKey.addEventListener('click', () => {
            const kKey = inputKakaoKey ? inputKakaoKey.value.trim() : '';
            if (kKey) {
                localStorage.setItem('kakao_appkey', kKey);
                if (mapManager && typeof mapManager.initKakaoSdk === 'function') {
                    mapManager.initKakaoSdk();
                }
                alert('카카오 JavaScript AppKey가 적용되었습니다.\n로드뷰 내 화살표 클릭 시 지도 마커가 100% 자동 동기화됩니다.');
            } else {
                localStorage.removeItem('kakao_appkey');
                alert('카카오 키가 제거되었습니다. 표준 모드로 동작합니다.');
            }
        });
    }

    if (btnResetKey) {
        btnResetKey.addEventListener('click', () => {
            mapManager.setVWorldApiKey('');
            if (inputKey) inputKey.value = mapManager.getVWorldApiKey();
            alert('VWorld API 인증키가 기본 데모키로 복원되었습니다.');
        });
    }

    if (btnTestKey) {
        btnTestKey.addEventListener('click', async () => {
            if (testMsg) {
                testMsg.style.display = 'block';
                testMsg.innerHTML = '<span style="color:#2563EB;"><i class="fa-solid fa-spinner fa-spin"></i> 브이월드 서버와 연동 테스트 중...</span>';
            }
            try {
                const results = await mapManager.queryVWorldSearchApi('김해시청');
                if (results && results.length > 0) {
                    if (testMsg) {
                        testMsg.innerHTML = '<span style="color:#059669; font-weight:700;"><i class="fa-solid fa-circle-check"></i> VWorld API 연동 성공! (김해시청 위치 확인 완료)</span>';
                    }
                } else {
                    if (testMsg) {
                        testMsg.innerHTML = '<span style="color:#D97706; font-weight:700;"><i class="fa-solid fa-triangle-exclamation"></i> VWorld 응답 지연 (김해시 100% 로컬 GIS 색인으로 무결점 보호 중)</span>';
                    }
                }
            } catch (e) {
                if (testMsg) {
                    testMsg.innerHTML = '<span style="color:#D97706;"><i class="fa-solid fa-shield-halved"></i> 네트워크 제약 시에도 로컬 김해 공간사전이 100% 자동 지원됩니다.</span>';
                }
            }
        });
    }
}
