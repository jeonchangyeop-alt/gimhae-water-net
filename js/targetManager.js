/**
 * Kimhae Water Network Management - 4. 목표유수율 관리 모듈 (Target Yield Management)
 * 연동 엔진: "1. 유량 및 유수율 관리(수정작업)" 100% 검증 공식 & K-water 표준 가이드라인
 */

(function () {
    // 18개월 분석 기간 키 목록 (25년 4월 ~ 26년 9월)
    const TARGET_MONTH_KEYS = [
        "25년 4월", "25년 5월", "25년 6월", "25년 7월", "25년 8월", "25년 9월",
        "25년 10월", "25년 11월", "25년 12월", "26년 1월", "26년 2월", "26년 3월",
        "26년 4월", "26년 5월", "26년 6월", "26년 7월", "26년 8월", "26년 9월"
    ];

    // 현재 모듈 내부 상태
    let currentTargetMonthIdx = 17; // 26년 9월 (기본 최신)
    let currentSystemFilter = 'all'; // 'all' | '삼계권역' | '덕산권역' | '명동권역'
    let currentStatusFilter = 'all'; // 'all' | 'achieved' | 'unachieved'
    let currentSearchKeyword = '';
    let currentActiveSidebarSys = '삼계권역';
    let currentSelectedTargetBlock = null;

    /**
     * 블록별 공급권역(정수장 계통) 매핑
     * 첨부 PDF 도면 및 topologyData.js 기준 100% 일치
     */
    function getBlockSystemName(blockName) {
        if (!blockName) return '삼계권역';
        const clean = String(blockName).trim();
        if (/대동|상동|대감/.test(clean)) return '덕산권역';
        if (/진영|진례|한림|장유|주촌|율하|망천|병동|명동|테크노|이지산단|골든루트|금음/.test(clean)) return '명동권역';
        return '삼계권역';
    }

    /**
     * 목표유수율 모듈 초기화
     */
    function initTargetYieldManager() {
        const selectMonth = document.getElementById('targetMonthSelect');
        if (selectMonth && selectMonth.options.length === 0) {
            TARGET_MONTH_KEYS.forEach((m, idx) => {
                const opt = document.createElement('option');
                opt.value = idx;
                opt.textContent = idx === TARGET_MONTH_KEYS.length - 1 ? `${m} (최신)` : m;
                if (idx === currentTargetMonthIdx) opt.selected = true;
                selectMonth.appendChild(opt);
            });

            selectMonth.addEventListener('change', (e) => {
                currentTargetMonthIdx = parseInt(e.target.value, 10);
                updateTargetYieldDashboard();
            });
        }

        // 계통 필터 버튼 바인딩 (좌측 표)
        const sysBtns = document.querySelectorAll('#targetSystemFilters .target-filter-pill');
        sysBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                sysBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentSystemFilter = btn.dataset.sys;
                updateTargetYieldDashboard(false); // 재계산 없이 필터링만 적용
            });
        });

        // 상태 필터 버튼 바인딩 (좌측 표)
        const statusBtns = document.querySelectorAll('#targetStatusFilters .target-filter-pill');
        statusBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                statusBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentStatusFilter = btn.dataset.status;
                updateTargetYieldDashboard(false);
            });
        });

        // 검색창 바인딩
        const searchInput = document.getElementById('targetSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                currentSearchKeyword = e.target.value.trim().toLowerCase();
                updateTargetYieldDashboard(false);
            });
        }

        // 우측 권역 탭 바인딩
        const rightSysTabs = document.querySelectorAll('#tpcSystemTabs .tpc-tab-btn');
        rightSysTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                rightSysTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentActiveSidebarSys = tab.dataset.targetSys;
                renderRightSystemPriorityCard();
            });
        });

        // 엑셀 내보내기 버튼 바인딩
        const btnExport = document.getElementById('btnExportTargetExcel');
        if (btnExport) {
            btnExport.addEventListener('click', exportTargetResultsToExcel);
        }

        // 드래그 스크롤 바인딩
        const viewport = document.getElementById('targetTableViewport');
        if (viewport && typeof setupDraggableTable === 'function') {
            setupDraggableTable(viewport);
        }

        // 최초 분석 실행
        updateTargetYieldDashboard(true);
    }

    // 캐시된 분석 전체 데이터셋
    let analyzedBlockList = [];

    /**
     * 전체 블록 목표유수율 & 절감량 연산
     */
    function calculateTargetMetrics(monthIdx) {
        const standards = window.TARGET_YIELD_STANDARDS || {};
        const verifiedData = window.VERIFIED_YIELD_DATA || {};
        const blockKeys = typeof window.YIELD_BLOCKS_92 !== 'undefined' 
            ? window.YIELD_BLOCKS_92 
            : Object.keys(standards);

        const results = [];

        blockKeys.forEach(bName => {
            const stdItem = standards[bName] || {};
            const stdYield = stdItem.std;
            const targetYield = stdItem.target;
            const system = getBlockSystemName(bName);

            // verifiedYieldData 매핑
            let vData = verifiedData[bName];
            if (!vData && bName === '한림5') vData = verifiedData['한림직결5'];
            if (!vData && bName === '진례(직결)') vData = verifiedData['진례직결'];
            if (!vData && bName === '명동산단(중블록)') vData = verifiedData['명동산단'];

            let currSupply = 0, currBilled = 0, currYield = 0, currMnf = 0, recentMnf = 0;

            if (vData) {
                if (vData.supply && vData.supply[monthIdx] !== null && vData.supply[monthIdx] !== undefined) {
                    currSupply = Number(vData.supply[monthIdx]);
                }
                if (vData.billed && vData.billed[monthIdx] !== null && vData.billed[monthIdx] !== undefined) {
                    currBilled = Number(vData.billed[monthIdx]);
                }
                if (vData.yield && vData.yield[monthIdx] !== null && vData.yield[monthIdx] !== undefined) {
                    currYield = Number(vData.yield[monthIdx]);
                }
                if (vData.mnf && vData.mnf[monthIdx] !== null && vData.mnf[monthIdx] !== undefined) {
                    currMnf = Number(vData.mnf[monthIdx]);
                }

                // 최근 야간최소유량 산출 (최근 1~2개월 유효 평균)
                recentMnf = currMnf;
                if (monthIdx > 0 && vData.mnf && vData.mnf[monthIdx - 1]) {
                    recentMnf = Math.round(((currMnf + Number(vData.mnf[monthIdx - 1])) / 2) * 10) / 10;
                }
            }

            // [핵심 엔진 공식] 목표 절감량 및 목표 야간최소유량 산출
            const targetRatio = typeof targetYield === 'number' ? targetYield * 0.01 : 0;
            let reduction = 0;
            let targetMnf = currMnf;

            if (currSupply > 0 && targetRatio > 0) {
                reduction = (targetRatio * currSupply - currBilled) / targetRatio / 24.0;
                if (reduction < 0) reduction = 0;
                targetMnf = Math.max(0, currMnf - reduction);
            }

            const isAchieved = (typeof targetYield === 'number' && currYield >= targetYield && currYield > 0);

            results.push({
                blockName: bName,
                system: system,
                stdYield: stdYield,
                targetYield: targetYield,
                currSupply: currSupply,
                currBilled: currBilled,
                currYield: currYield,
                currMnf: currMnf,
                recentMnf: recentMnf,
                reduction: Math.round(reduction * 10) / 10,
                targetMnf: Math.round(targetMnf * 10) / 10,
                isAchieved: isAchieved
            });
        });

        return results;
    }

    /**
     * 대시보드 갱신
     */
    function updateTargetYieldDashboard(recompute = true) {
        if (recompute || analyzedBlockList.length === 0) {
            analyzedBlockList = calculateTargetMetrics(currentTargetMonthIdx);
        }

        // 1. KPI 지표 및 뱃지 카운트 갱신
        const totalCount = analyzedBlockList.length;
        const achievedCount = analyzedBlockList.filter(b => b.isAchieved).length;
        const unachievedCount = totalCount - achievedCount;
        const achievedRate = totalCount > 0 ? ((achievedCount / totalCount) * 100).toFixed(1) : 0;
        const unachievedRate = totalCount > 0 ? ((unachievedCount / totalCount) * 100).toFixed(1) : 0;

        // 총 목표 누수절감 잠재량 합산
        const totalReduction = analyzedBlockList.reduce((sum, b) => sum + (b.reduction || 0), 0);
        const dailyReductionM3 = Math.round(totalReduction * 24);
        // 연간 절감액 환산 (수돗물 생산원가 980원/m³ 기준)
        const annualWon = dailyReductionM3 * 365 * 980;
        const annualBillion = (annualWon / 100000000).toFixed(1);

        // 상단 필터 뱃지 수치 갱신
        const bAll = document.getElementById('tBadgeAll');
        const bAch = document.getElementById('tBadgeAchieved');
        const bUnach = document.getElementById('tBadgeUnachieved');
        if (bAll) bAll.textContent = totalCount;
        if (bAch) bAch.textContent = achievedCount;
        if (bUnach) bUnach.textContent = unachievedCount;

        // 우측 핵심 KPI 카드 4개 갱신
        const elTotal = document.getElementById('tkpiTotalBlocks');
        const elAch = document.getElementById('tkpiAchievedBlocks');
        const elAchRate = document.getElementById('tkpiAchievedRate');
        const elUnach = document.getElementById('tkpiUnachievedBlocks');
        const elUnachRate = document.getElementById('tkpiUnachievedRate');
        const elTotRed = document.getElementById('tkpiTotalReduction');
        const elBenefit = document.getElementById('tkpiFinancialBenefit');

        if (elTotal) elTotal.innerHTML = `${totalCount} <span class="tkpi-unit">개소</span>`;
        if (elAch) elAch.innerHTML = `${achievedCount} <span class="tkpi-unit">개소</span>`;
        if (elAchRate) elAchRate.textContent = `달성률 ${achievedRate}%`;
        if (elUnach) elUnach.innerHTML = `${unachievedCount} <span class="tkpi-unit">개소</span>`;
        if (elUnachRate) elUnachRate.textContent = `미달률 ${unachievedRate}% (집중관리)`;
        if (elTotRed) elTotRed.innerHTML = `${totalReduction.toFixed(1)} <span class="tkpi-unit">m³/h</span>`;
        if (elBenefit) elBenefit.textContent = `일 ${dailyReductionM3.toLocaleString()}m³ 감축 (연 약 ${annualBillion}억원 절감)`;

        // 2. 좌측 테이블 렌더링
        renderTargetLeftTable();

        // 3. 우측 권역별 우선순위 및 추천 결과 렌더링
        renderRightSystemPriorityCard();
        renderRightTop5Ranking();
        renderRightEngineeringGuide();
    }

    /**
     * 좌측 테이블 렌더링
     */
    function renderTargetLeftTable() {
        const tbody = document.getElementById('targetTableBody');
        const countBadge = document.getElementById('targetTableCountBadge');
        if (!tbody) return;

        tbody.innerHTML = '';

        // 필터링 적용
        let filtered = analyzedBlockList.filter(item => {
            if (currentSystemFilter !== 'all' && item.system !== currentSystemFilter) return false;
            if (currentStatusFilter === 'achieved' && !item.isAchieved) return false;
            if (currentStatusFilter === 'unachieved' && item.isAchieved) return false;
            if (currentSearchKeyword) {
                return item.blockName.toLowerCase().includes(currentSearchKeyword) ||
                       item.system.toLowerCase().includes(currentSearchKeyword);
            }
            return true;
        });

        if (countBadge) {
            countBadge.textContent = `조회: ${filtered.length}개 블록 / 전체 ${analyzedBlockList.length}개`;
        }

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="13" style="text-align:center; padding: 40px; color:#94A3B8;">
                        <i class="fa-solid fa-filter-circle-xmark" style="font-size:24px; margin-bottom:8px; display:block;"></i>
                        선택한 조건에 해당하는 블록이 없습니다.
                    </td>
                </tr>
            `;
            return;
        }

        filtered.forEach((item, idx) => {
            const tr = document.createElement('tr');
            tr.dataset.block = item.blockName;
            if (currentSelectedTargetBlock === item.blockName) {
                tr.classList.add('active-target-row');
            }

            // 계통 뱃지 색상
            let sysBadgeClass = 'badge-sys-samgye';
            if (item.system.includes('덕산')) sysBadgeClass = 'badge-sys-deoksan';
            if (item.system.includes('명동')) sysBadgeClass = 'badge-sys-myeongdong';

            // 현재 유수율 색상
            const yieldColor = item.currYield === 0 ? '#94A3B8' : (item.isAchieved ? '#10B981' : '#F59E0B');
            const statusHtml = item.currYield === 0
                ? `<span class="target-status-badge badge-nodata">자료 없음</span>`
                : (item.isAchieved
                    ? `<span class="target-status-badge badge-achieved"><i class="fa-solid fa-check"></i> 달성</span>`
                    : `<span class="target-status-badge badge-unachieved"><i class="fa-solid fa-triangle-exclamation"></i> 미달성</span>`);

            const stdStr = typeof item.stdYield === 'number' ? (item.stdYield > 0 ? item.stdYield.toFixed(1) + '%' : '-') : (item.stdYield || '-');
            const targetStr = typeof item.targetYield === 'number' ? (item.targetYield > 0 ? item.targetYield.toFixed(1) + '%' : '-') : (item.targetYield || '-');

            tr.innerHTML = `
                <td style="text-align:center; color:#64748B; font-weight:600;">${idx + 1}</td>
                <td class="col-sticky-block"><strong>${item.blockName}</strong></td>
                <td style="text-align:center;"><span class="target-sys-pill ${sysBadgeClass}">${item.system.replace('계통', '').replace('권역', '')}</span></td>
                <td style="text-align:right;">${stdStr}</td>
                <td style="text-align:right; font-weight:800; color:${yieldColor};">${item.currYield > 0 ? item.currYield.toFixed(1) + '%' : '-'}</td>
                <td style="text-align:right; font-weight:700; color:#2563EB;">${targetStr}</td>
                <td style="text-align:right; color:#334155;">${item.currSupply > 0 ? item.currSupply.toLocaleString() : '-'}</td>
                <td style="text-align:right; color:#334155;">${item.currBilled > 0 ? item.currBilled.toLocaleString() : '-'}</td>
                <td style="text-align:right; color:#64748B;">${item.currMnf > 0 ? item.currMnf.toFixed(1) : '-'}</td>
                <td style="text-align:right; color:#475569;">${item.recentMnf > 0 ? item.recentMnf.toFixed(1) : '-'}</td>
                <td class="col-highlight-orange" style="text-align:right; font-weight:800; color:${item.reduction > 0 ? '#EA580C' : '#94A3B8'};">
                    ${item.reduction > 0 ? '+' + item.reduction.toFixed(1) : '0.0'}
                </td>
                <td class="col-highlight-green" style="text-align:right; font-weight:800; color:#059669;">
                    ${item.targetMnf > 0 ? item.targetMnf.toFixed(1) : '0.0'}
                </td>
                <td style="text-align:center;">${statusHtml}</td>
            `;

            tr.addEventListener('click', () => {
                document.querySelectorAll('#targetTableBody tr').forEach(r => r.classList.remove('active-target-row'));
                tr.classList.add('active-target-row');
                currentSelectedTargetBlock = item.blockName;
                onTargetRowSelect(item);
            });

            tbody.appendChild(tr);
        });
    }

    /**
     * 특정 블록 클릭 시 우측 패널 연동 및 상세 포커스
     */
    function onTargetRowSelect(item) {
        // 해당 블록의 계통 탭으로 자동 이동
        if (item.system && item.system !== currentActiveSidebarSys) {
            currentActiveSidebarSys = item.system;
            const rightSysTabs = document.querySelectorAll('#tpcSystemTabs .tpc-tab-btn');
            rightSysTabs.forEach(tab => {
                tab.classList.toggle('active', tab.dataset.targetSys === currentActiveSidebarSys);
            });
            renderRightSystemPriorityCard();
        }
    }

    /**
     * 우측 권역별 우선순위 카드 렌더링 (삼계 / 덕산 / 명동)
     */
    function renderRightSystemPriorityCard() {
        const summaryBar = document.getElementById('tpcSystemSummaryBar');
        const listContainer = document.getElementById('tpcSystemPriorityList');
        if (!summaryBar || !listContainer) return;

        const sysBlocks = analyzedBlockList.filter(b => b.system === currentActiveSidebarSys);
        const sysTotal = sysBlocks.length;
        const sysAchieved = sysBlocks.filter(b => b.isAchieved).length;
        const sysUnachieved = sysTotal - sysAchieved;
        const sysRedSum = sysBlocks.reduce((sum, b) => sum + (b.reduction || 0), 0);
        const sysAvgYield = sysTotal > 0 ? (sysBlocks.reduce((sum, b) => sum + (b.currYield || 0), 0) / sysTotal).toFixed(1) : 0;

        summaryBar.innerHTML = `
            <div class="tss-item">
                <span class="tss-label">권역 블록수</span>
                <span class="tss-val">${sysTotal}개소</span>
            </div>
            <div class="tss-item">
                <span class="tss-label">평균 유수율</span>
                <span class="tss-val text-primary">${sysAvgYield}%</span>
            </div>
            <div class="tss-item">
                <span class="tss-label">미달성 블록</span>
                <span class="tss-val text-warning">${sysUnachieved}개소</span>
            </div>
            <div class="tss-item">
                <span class="tss-label">권역 절감 잠재량</span>
                <span class="tss-val text-danger">+${sysRedSum.toFixed(1)} m³/h</span>
            </div>
        `;

        // 미달성 블록 중 목표절감량(reduction)이 가장 큰 순(관리가 시급한 순) 정렬
        const unachievedSorted = sysBlocks
            .filter(b => !b.isAchieved && b.reduction > 0)
            .sort((a, b) => b.reduction - a.reduction);

        if (unachievedSorted.length === 0) {
            listContainer.innerHTML = `
                <div style="text-align:center; padding: 30px; color:#10B981; font-weight:700;">
                    <i class="fa-solid fa-circle-check" style="font-size:32px; margin-bottom:8px; display:block;"></i>
                    축하합니다! ${currentActiveSidebarSys}의 모든 블록이 목표 유수율을 달성하였습니다.
                </div>
            `;
            return;
        }

        // Top 3~4 블록 카드 생성
        const topList = unachievedSorted.slice(0, 4);
        listContainer.innerHTML = topList.map((item, idx) => {
            const gap = (item.targetYield - item.currYield).toFixed(1);
            const lossM3Month = Math.round(item.reduction * 24 * 30);
            const lossWonMonth = Math.round((lossM3Month * 980) / 10000); // 만원 단위

            // 맞춤형 현장 조치 권고사항
            let actionText = "야간 밸브 차단 스텝테스트 및 집중 누수음청 탐사 우선 투입 권고";
            if (item.currMnf > 60) {
                actionText = "대구경 분기구간 감압밸브(PRV) 2차 수압 하향 조절 및 대형관 탐사 긴급 필요";
            } else if (item.currYield < 50) {
                actionText = "유량계 불감수량 확인 및 노후 배급수관로 정밀 노면음청 탐사 최우선 시행";
            }

            return `
                <div class="tpc-block-item ${idx === 0 ? 'rank-1' : ''}">
                    <div class="tbi-header">
                        <div class="tbi-title">
                            <span class="tbi-rank-badge rank-${idx + 1}">${idx + 1}순위</span>
                            <strong>${item.blockName}</strong>
                            <span class="tbi-gap-pill">목표 격차: <b>▲${gap}%p</b></span>
                        </div>
                        <div class="tbi-reduction-box">
                            <span class="tbi-red-label">필요 절감량</span>
                            <span class="tbi-red-val">+${item.reduction.toFixed(1)} <small>m³/h</small></span>
                        </div>
                    </div>

                    <!-- 유수율 진행 바 -->
                    <div class="tbi-progress-wrapper">
                        <div class="tbi-prog-labels">
                            <span>현재: <b>${item.currYield.toFixed(1)}%</b></span>
                            <span>목표: <b>${item.targetYield.toFixed(1)}%</b></span>
                        </div>
                        <div class="tbi-prog-track">
                            <div class="tbi-prog-bar" style="width: ${Math.min(100, (item.currYield / item.targetYield) * 100)}%;"></div>
                        </div>
                    </div>

                    <!-- MNF 지표 & 손실액 -->
                    <div class="tbi-stats-row">
                        <div>현재 야간최소: <b>${item.currMnf.toFixed(1)} m³/h</b></div>
                        <div>도달 목표 MNF: <b style="color:#059669;">${item.targetMnf.toFixed(1)} m³/h</b></div>
                        <div>월 손실액: <b style="color:#DC2626;">약 ${lossWonMonth.toLocaleString()}만원</b></div>
                    </div>

                    <!-- 조치 권고사항 -->
                    <div class="tbi-action-box">
                        <i class="fa-solid fa-bullhorn" style="color:#2563EB;"></i>
                        <span>${actionText}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * 우측 김해시 전체 긴급 관리 랭킹 TOP 5 렌더링
     */
    function renderRightTop5Ranking() {
        const top5Container = document.getElementById('targetTop5List');
        if (!top5Container) return;

        // 김해시 전체 미달성 블록 중 목표절감량이 가장 큰 순 정렬
        const overallTop5 = analyzedBlockList
            .filter(b => !b.isAchieved && b.reduction > 0)
            .sort((a, b) => b.reduction - a.reduction)
            .slice(0, 5);

        if (overallTop5.length === 0) {
            top5Container.innerHTML = `<div style="text-align:center; padding:20px; color:#64748B;">미달성 블록이 없습니다.</div>`;
            return;
        }

        top5Container.innerHTML = overallTop5.map((item, idx) => {
            const gap = (item.targetYield - item.currYield).toFixed(1);
            return `
                <div class="tt5-item">
                    <div class="tt5-rank">${idx + 1}</div>
                    <div class="tt5-info">
                        <div class="tt5-name-row">
                            <strong>${item.blockName}</strong>
                            <span class="tt5-sys">${item.system.replace('계통', '')}</span>
                            <span class="tt5-yield">현재 ${item.currYield.toFixed(1)}% ➔ 목표 ${item.targetYield.toFixed(1)}% (▲${gap}%p)</span>
                        </div>
                        <div class="tt5-bar-box">
                            <div class="tt5-bar" style="width: ${Math.min(100, (item.currYield / item.targetYield) * 100)}%;"></div>
                        </div>
                    </div>
                    <div class="tt5-val-box">
                        <span class="tt5-red-val">+${item.reduction.toFixed(1)}</span>
                        <span class="tt5-unit">m³/h 절감</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * 우측 하단 엔지니어링 종합 권고사항 & 로드맵 렌더링
     */
    function renderRightEngineeringGuide() {
        const guideContainer = document.getElementById('targetEngineeringGuide');
        if (!guideContainer) return;

        const currentMonthName = TARGET_MONTH_KEYS[currentTargetMonthIdx] || '26년 9월';

        guideContainer.innerHTML = `
            <div class="teg-step-list">
                <div class="teg-step-item">
                    <div class="teg-step-badge">1단계</div>
                    <div class="teg-step-content">
                        <strong>상위 우선순위 블록 집중 누수탐사 인력 긴급 배정</strong>
                        <p>${currentActiveSidebarSys} 및 전체 랭킹 1~3위 블록을 대상으로 야간 스텝테스트(02:00~04:00)를 실시하여 누수 의심 관로를 500m 이내로 압축 격리합니다.</p>
                    </div>
                </div>
                <div class="teg-step-item">
                    <div class="teg-step-badge">2단계</div>
                    <div class="teg-step-content">
                        <strong>야간 고수압 발생 블록 PRV 감압 최적화 (목표 MNF 도달)</strong>
                        <p>목표 야간최소유량(Target MNF) 달성을 위해 야간 유량 급증 블록의 감압밸브를 0.5~1.0 kgf/cm² 하향 설정하여 잔존 누수량을 선제 감축합니다.</p>
                    </div>
                </div>
                <div class="teg-step-item">
                    <div class="teg-step-badge">3단계</div>
                    <div class="teg-step-content">
                        <strong>대구경 수용가 계량기 정밀 검침 및 불용관 폐쇄 연계</strong>
                        <p>기준유수율 대비 편차가 심한 블록의 불용관(폐구경 20~50mm) 인입 밸브를 차단하고, 수용가 계량기 불감수량을 즉시 정비하여 부과량을 양성화합니다.</p>
                    </div>
                </div>
            </div>
            <div class="teg-footer-note">
                <i class="fa-solid fa-circle-exclamation"></i> 기준일자: <strong>${currentMonthName}</strong> 데이터 연동 기준 | 산출 엔진: Water Manager Pro 공식 엔진
            </div>
        `;
    }

    /**
     * 분석 결과 엑셀 내보내기 (CSV 다운로드 - Excel 한글 UTF-8 BOM 완벽 지원)
     */
    function exportTargetResultsToExcel() {
        if (!analyzedBlockList || analyzedBlockList.length === 0) {
            alert("내보낼 분석 데이터가 없습니다.");
            return;
        }

        const monthName = TARGET_MONTH_KEYS[currentTargetMonthIdx] || '최신';
        const filename = `김해시_목표유수율관리_분석결과_${monthName}.csv`;

        const headers = [
            "순번", "블록명", "공급계통", "기준유수율(%)", "현재유수율(%)", "목표유수율(%)",
            "일공급량(m3/일)", "일부과량(m3/일)", "야간최소(기준,m3/h)", "야간최소(최근,m3/h)",
            "목표절감량(m3/h)", "목표야간최소(m3/h)", "달성유무"
        ];

        const rows = analyzedBlockList.map((item, idx) => [
            idx + 1,
            `"${item.blockName}"`,
            `"${item.system}"`,
            item.stdYield > 0 ? item.stdYield.toFixed(1) : "-",
            item.currYield > 0 ? item.currYield.toFixed(1) : "-",
            item.targetYield.toFixed(1),
            item.currSupply,
            item.currBilled,
            item.currMnf > 0 ? item.currMnf.toFixed(1) : "-",
            item.recentMnf > 0 ? item.recentMnf.toFixed(1) : "-",
            item.reduction > 0 ? item.reduction.toFixed(1) : "0.0",
            item.targetMnf > 0 ? item.targetMnf.toFixed(1) : "0.0",
            item.isAchieved ? "달성" : "미달성"
        ]);

        const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // 전역 노출
    window.initTargetYieldManager = initTargetYieldManager;
    window.updateTargetYieldDashboard = updateTargetYieldDashboard;
    window.exportTargetResultsToExcel = exportTargetResultsToExcel;

    // 문서 로드 완료 시 바인딩
    document.addEventListener('DOMContentLoaded', () => {
        // dash-target 탭 선택 시 초기화 및 렌더링
        const tabBtn = document.querySelector('.dash-tab-btn[data-tab="dash-target"]');
        if (tabBtn) {
            tabBtn.addEventListener('click', () => {
                setTimeout(() => {
                    initTargetYieldManager();
                }, 50);
            });
        }
    });
})();
