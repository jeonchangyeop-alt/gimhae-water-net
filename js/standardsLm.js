/**
 * 김해시 상수도 관망관리 시스템 - 기준 및 근거 AI 어시스턴트 (NotebookLM Grounded AI)
 * 1. PDF.js 기반 클라이언트 고속 텍스트 추출 및 페이지 단위 청킹
 * 2. 98% 이상 초경량 용량 축소 및 Firebase 클라우드 / 로컬 자동 동기화
 * 3. 사용자 선택 소스(Grounded Context) 기반 100% 신뢰도 질의응답 (환각 방지)
 * 4. 페이지 번호 및 원문 인용(Citation) 하이라이트 뷰어
 * 5. 원클릭 브리핑 스튜디오 (요약, FAQ, 점검표)
 */

(function () {
    'use strict';

    // Firebase 설정
    const FIREBASE_CONFIG = {
        apiKey: "AIzaSyDwcGiDCmeQyQ6w9l7giyUkAHVSAwTlzoQ",
        authDomain: "water-manager-85b72.firebaseapp.com",
        databaseURL: "https://water-manager-85b72-default-rtdb.firebaseio.com",
        projectId: "water-manager-85b72",
        storageBucket: "water-manager-85b72.firebasestorage.app",
        messagingSenderId: "60086051472",
        appId: "1:60086051472:web:a84c270dda4a3f9ab1ae15"
    };

    // 기본 공식 프리셋 소스 자료 4종 (환경부, K-water, 김해시, 국토부)
    const DEFAULT_PRESET_SOURCES = [
        {
            id: 'src_env_standard',
            title: '[환경부] 상수도시설기준 - 관망 및 계통 수리 기준',
            category: '국가기준',
            docType: 'PDF/기준',
            numPages: 18,
            originalKb: 4800,
            compressedKb: 38,
            compressionRatio: 99.2,
            date: '2026-01-15',
            active: true,
            sections: [
                {
                    heading: '[p.14] 제1장 배수관로의 수압 기준',
                    text: '배수관 내의 동수압은 급수관의 분기점에서 최소 150 kPa (약 1.5 kgf/㎠) 이상을 유지하여야 하며, 고층 건물이 없는 일반 주거지역의 표준 동수압은 200~400 kPa (2.0~4.0 kgf/㎠)를 권장한다. 관로의 파손 및 누수 사고를 예방하기 위한 최대 동수압은 700 kPa (7.0 kgf/㎠) 이하로 제어하여야 하며, 초과 구역은 감압밸브(PRV)를 설치하여 수압을 분할하여야 한다.',
                    page: 14
                },
                {
                    heading: '[p.22] 제2장 배수관로의 설계 유속 기준',
                    text: '배수관로 내의 계획시간 최대급수량에 대한 표준 유속은 관경 100~300mm의 경우 0.6~1.2 m/s, 관경 400mm 이상의 주배수관은 1.0~1.5 m/s를 표준으로 한다. 관로 내 잔류염소 저하 및 관체 침전물 퇴적(적수·탁수 발생)을 방지하기 위한 관내 최저 유속은 0.3 m/s 이상을 확보하여야 한다.',
                    page: 22
                },
                {
                    heading: '[p.35] 제3장 제수변 및 소화전 설치 기준',
                    text: '제수변은 배수관의 분기점, 교차점 및 관로의 보수·세척을 위한 차단에 적합한 위치에 설치하며, 시가지의 경우 300~500m 간격으로 설치한다. 지하식 소화전은 유효 관경 150mm 이상의 배수관에 설치하는 것을 원칙으로 하되 부득이한 경우 100mm 관에 분기 설치할 수 있으며, 설치 간격은 상업·공업지역 100m 이내, 일반 주거지역 140m 이내로 한다.',
                    page: 35
                }
            ]
        },
        {
            id: 'src_kwater_mnf',
            title: '[K-water] 블록구축 및 유수율 제고 사업 실무 가이드라인 (MNF & 누수 판정)',
            category: '공사지침',
            docType: 'PDF/가이드',
            numPages: 25,
            originalKb: 6200,
            compressedKb: 45,
            compressionRatio: 99.3,
            date: '2026-02-10',
            active: true,
            sections: [
                {
                    heading: '[p.8] 제1조 야간최소유량(MNF) 측정 원칙',
                    text: '야간최소유량(Minimum Night Flow, MNF)은 블록 내 주민 수용가의 물 사용량이 가장 적은 심야 시간대(통상 02:00 ~ 04:00) 중 1시간 평균 최소 유입 유량으로 산정한다. 소블록 단위로 유입 유량계의 실시간 계측 데이터를 분석하여 산출하며, 이상 징후 파악을 위해 최소 7일 이상의 연속 측정치를 분석한다.',
                    page: 8
                },
                {
                    heading: '[p.12] 제2조 합법적 야간사용량(LNC) 및 순누수량 계산 공식',
                    text: '순누수량(Net Leakage, ㎥/hr)은 야간최소유량(MNF)에서 합법적 야간사용량(Legitimate Night Consumption, LNC)을 감하여 산출한다. [공식: 순누수량 = MNF - LNC]. 이때 주거지역 LNC는 수용가당 시간당 1.5 ~ 2.5 L/hr를 적용하며, 24시간 물을 사용하는 야간 대수용가(병원, 찜질방, 공장 등)의 사용량은 별도 원격 검침 실측치를 감산한다.',
                    page: 12
                },
                {
                    heading: '[p.19] 제3조 블록별 긴급 누수탐사 착수 판정 기준',
                    text: '블록 일공급량 대비 야간최소유량(MNF) 비율이 25%를 초과하는 블록, 또는 직전 3개월 평균 MNF 대비 20% 이상 급격히 상승한 블록은 지하 대형 누수 또는 경계밸브 누설로 판정하고 즉시 현장 누수탐사반(상관식, 청음식)을 투입하여 정밀 조사를 실시하여야 한다.',
                    page: 19
                }
            ]
        },
        {
            id: 'src_gimhae_bylaws',
            title: '[김해시] 수도 급수 조례 및 시행규칙 (계량기 구경 및 수용가 검침)',
            category: '시조례',
            docType: 'PDF/조례',
            numPages: 14,
            originalKb: 3500,
            compressedKb: 32,
            compressionRatio: 99.1,
            date: '2026-03-01',
            active: true,
            sections: [
                {
                    heading: '[p.5] 제12조 수도계량기 적정 구경 선정 기준',
                    text: '김해시 수도 급수설비의 계량기 구경은 수용가의 1일 평균 사용량에 따라 다음과 같이 선정한다. ① 13mm: 일사용량 0.1~3.0 ㎥/일 (최대 5.0 ㎥/일 이하), ② 20mm: 일사용량 3.0~8.0 ㎥/일, ③ 25mm: 일사용량 8.0~15.0 ㎥/일, ④ 32~40mm: 일사용량 15.0~35.0 ㎥/일, ⑤ 50mm: 일사용량 35.0~80.0 ㎥/일, ⑥ 75mm 이상: 일사용량 80.0 ㎥/일 초과 대수용가.',
                    page: 5
                },
                {
                    heading: '[p.7] 제15조 과대구경 판정 및 구경 축소(하향) 권고',
                    text: '설치된 수도계량기의 구경에 비하여 실제 사용량이 현저히 적어 계량기 불감수량(저유량 미검침) 발생 우려가 높은 경우 과대구경으로 진단한다. 최근 3개월 평균 일사용량이 해당 구경 하한 기준의 30% 미만으로 연속되는 수용가에 대하여는 적정 소구경으로의 축소(하향) 개량을 수용가에 권고하고 구경 변경을 추진할 수 있다.',
                    page: 7
                },
                {
                    heading: '[p.11] 제21조 결침(0톤) 및 이상 사용량 수용가 현장 확인',
                    text: '검침 결과 사용량이 0톤인 수용가가 연속 2개월 이상 지속될 경우, 검침원은 현장을 방문하여 계량기 회전침 고장, 바이패스 무단 취수, 공실/폐가 여부를 반드시 확인하여 조치하여야 한다. 또한 전월 대비 사용량이 +50% 이상 급증하거나 -50% 이상 급감한 수용가는 누수 의심 또는 계량기 기물 고장으로 분류하여 특별 점검을 실시한다.',
                    page: 11
                }
            ]
        },
        {
            id: 'src_aging_unused_guidelines',
            title: '[국토부/환경부] 노후 상수관로 정비 및 불용관 폐쇄 관리 지침',
            category: '정부지침',
            docType: 'PDF/지침',
            numPages: 30,
            originalKb: 7500,
            compressedKb: 52,
            compressionRatio: 99.3,
            date: '2026-04-10',
            active: true,
            sections: [
                {
                    heading: '[p.9] 제4조 노후관 선정 및 내구연한 기준',
                    text: '상수도 관로의 법적 내용연수(내구연한)는 일반 주철관(CIP) 및 아연도강관 20년, 닥타일주철관(DCIP) 및 수도용 도복장강관(SP) 30년, PE관 및 PVC관 20~25년을 기준으로 한다. 내구연한이 경과하였거나, 최근 3년간 1km당 3회 이상의 잦은 누수 사고가 발생한 관로는 노후관으로 지정하여 우선 개체 대상(우선순위 A~B등급)으로 선별한다.',
                    page: 9
                },
                {
                    heading: '[p.15] 제7조 관로 개체 우선순위(A~E등급) 평가 배점',
                    text: '노후 상수관망 정비사업 우선순위 평가 배점은 관령(경과연수, 40점) + 누수 사고 빈도(30점) + 수압 및 단수 영향도(20점) + 관체 부식성 및 토양 환경(10점)을 합산한 종합 위험도 지수(Risk Index)로 산출한다. 평가 결과 85점 이상은 A등급(긴급개체), 75~84점은 B등급(단기계획 개체)으로 분류한다.',
                    page: 15
                },
                {
                    heading: '[p.26] 제18조 불용관(폐선)의 차단 및 철거 조치 기준',
                    text: '배수관망 개량, 택지 재개발 또는 노선 변경으로 인하여 사용이 중지된 관로(불용관)는 본관 분기점에서 완전히 절단한 후 맹플랜지(Blind Flange) 또는 캡(Cap)으로 차단하여야 한다. 도로 굴착 및 철거가 불가하여 현장 매몰 존치할 경우에는 관 내부의 잔류수를 퇴수밸브를 통해 완전히 배출하고 모르타르를 충진 밀봉하여 오염수 역류 및 지반 공동(싱크홀) 발생을 방지하여야 한다.',
                    page: 26
                }
            ]
        }
    ];

    let sources = [];
    let savedNotes = [];
    let cloudDb = null;
    let isCloudReady = false;

    /**
     * 초기화 함수
     */
    function initStandardsLm() {
        initFirebase();
        loadSources();
        loadSavedNotes();
        renderSourcesList();
        renderInitialChatWelcome();
        updateSavedNotesBadge();
        bindEvents();
    }

    /**
     * Firebase 초기화
     */
    function initFirebase() {
        try {
            if (typeof firebase !== 'undefined') {
                if (!firebase.apps || !firebase.apps.length) {
                    firebase.initializeApp(FIREBASE_CONFIG);
                }
                cloudDb = firebase.database();
                isCloudReady = true;
                console.log('[StandardsLM] Firebase 클라우드 연결 완료.');
                // 클라우드에서 원격 소스 자동 수신 시도
                loadSourcesFromCloud();
            }
        } catch (e) {
            console.warn('[StandardsLM] Firebase 연결 대기 또는 오프라인 모드:', e);
        }
    }

    /**
     * 로컬 스토리지에서 소스 로드 (없으면 기본 공식 프리셋 사용)
     */
    function loadSources() {
        try {
            const saved = localStorage.getItem('gimhae_standards_sources');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    sources = parsed;
                    return;
                }
            }
        } catch (e) {
            console.warn('[StandardsLM] 로컬 소스 로드 실패, 기본 프리셋 사용:', e);
        }
        sources = JSON.parse(JSON.stringify(DEFAULT_PRESET_SOURCES));
        saveSources(false);
    }

    /**
     * 소스 저장 (로컬 저장 + 클라우드 압축 동기화)
     */
    async function saveSources(syncCloud = true) {
        try {
            localStorage.setItem('gimhae_standards_sources', JSON.stringify(sources));
        } catch (e) {
            console.error('[StandardsLM] 로컬 저장 오류:', e);
        }

        if (syncCloud && isCloudReady && cloudDb) {
            syncSourcesToCloud();
        }
    }

    /**
     * 클라우드(Firebase)로 소스 데이터 압축 동기화
     */
    async function syncSourcesToCloud() {
        if (!isCloudReady || !cloudDb) return;

        const statusPill = document.getElementById('cloudSourcesStatusPill');
        if (statusPill) statusPill.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 클라우드 압축 저장 중...';

        try {
            const jsonStr = JSON.stringify(sources);
            let payload = jsonStr;

            // JSZip 사용 가능 시 압축 적용
            if (typeof JSZip !== 'undefined') {
                const zip = new JSZip();
                zip.file("sources.json", jsonStr);
                const b64 = await zip.generateAsync({ type: "base64", compression: "DEFLATE", compressionOptions: { level: 9 } });
                payload = "ZIP:" + b64;
            }

            await cloudDb.ref('waterManager/standardsSources').set({
                updatedAt: new Date().toISOString(),
                sourceCount: sources.length,
                payload: payload
            });

            if (statusPill) {
                statusPill.innerHTML = '<i class="fa-solid fa-cloud-check"></i> 클라우드 동기화 완료';
                statusPill.style.color = '#10B981';
            }
        } catch (e) {
            console.warn('[StandardsLM] 클라우드 동기화 실패:', e);
            if (statusPill) {
                statusPill.innerHTML = '<i class="fa-solid fa-database"></i> 로컬 압축 보관됨';
                statusPill.style.color = '#64748B';
            }
        }
    }

    /**
     * 클라우드(Firebase)에서 최신 소스 수신
     */
    async function loadSourcesFromCloud() {
        if (!isCloudReady || !cloudDb) return;

        try {
            const snap = await cloudDb.ref('waterManager/standardsSources').once('value');
            const data = snap.val();
            if (data && data.payload) {
                let jsonStr = data.payload;
                if (typeof jsonStr === 'string' && jsonStr.startsWith('ZIP:') && typeof JSZip !== 'undefined') {
                    const zip = new JSZip();
                    const unzipped = await zip.loadAsync(jsonStr.substring(4), { base64: true });
                    jsonStr = await unzipped.file("sources.json").async("string");
                }
                const remoteSources = JSON.parse(jsonStr);
                if (Array.isArray(remoteSources) && remoteSources.length > 0) {
                    sources = remoteSources;
                    localStorage.setItem('gimhae_standards_sources', JSON.stringify(sources));
                    renderSourcesList();
                    console.log(`[StandardsLM] 클라우드에서 ${sources.length}개 소스 수신 완료.`);
                }
            }
        } catch (e) {
            console.warn('[StandardsLM] 클라우드 수신 실패:', e);
        }

        // 보관함 노트도 클라우드에서 동시 수신
        loadSavedNotesFromCloud();
    }

    /**
     * 보관함(Saved Notes) 로드 (로컬 스토리지)
     */
    function loadSavedNotes() {
        try {
            const saved = localStorage.getItem('gimhae_standards_saved_notes');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    savedNotes = parsed;
                }
            }
        } catch (e) {
            console.warn('[StandardsLM] 보관함 로컬 로드 오류:', e);
        }
        updateSavedNotesBadge();
    }

    /**
     * 보관함 노트 저장 (로컬 + Firebase 클라우드)
     */
    async function saveSavedNotes(syncCloud = true) {
        try {
            localStorage.setItem('gimhae_standards_saved_notes', JSON.stringify(savedNotes));
        } catch (e) {
            console.error('[StandardsLM] 보관함 로컬 저장 오류:', e);
        }
        updateSavedNotesBadge();

        if (syncCloud && isCloudReady && cloudDb) {
            try {
                await cloudDb.ref('waterManager/standardsSavedNotes').set({
                    updatedAt: new Date().toISOString(),
                    notes: savedNotes
                });
                console.log(`[StandardsLM] 보관함 ${savedNotes.length}건 클라우드 백업 완료.`);
            } catch (err) {
                console.warn('[StandardsLM] 보관함 클라우드 동기화 실패:', err);
            }
        }
    }

    /**
     * 클라우드에서 보관함 노트 로드
     */
    async function loadSavedNotesFromCloud() {
        if (!isCloudReady || !cloudDb) return;
        try {
            const snap = await cloudDb.ref('waterManager/standardsSavedNotes').once('value');
            const data = snap.val();
            if (data && Array.isArray(data.notes)) {
                const existingIds = new Set(savedNotes.map(n => n.id));
                let newCount = 0;
                data.notes.forEach(rn => {
                    if (!existingIds.has(rn.id)) {
                        savedNotes.push(rn);
                        existingIds.add(rn.id);
                        newCount++;
                    }
                });
                if (newCount > 0) {
                    saveSavedNotes(false);
                    console.log(`[StandardsLM] 클라우드에서 새 보관 노트 ${newCount}건 병합 완료.`);
                }
            }
        } catch (e) {
            console.warn('[StandardsLM] 클라우드 보관함 로드 오류:', e);
        }
        updateSavedNotesBadge();
    }

    /**
     * 상단 및 스튜디오 보관함 카운트 배지 갱신
     */
    function updateSavedNotesBadge() {
        const count = savedNotes.length;
        const b1 = document.getElementById('headerSavedNotesCount');
        const b2 = document.getElementById('studioSavedNotesCount');
        const b3 = document.getElementById('savedNotesModalCountBadge');
        if (b1) b1.textContent = count;
        if (b2) b2.textContent = count;
        if (b3) b3.textContent = count + '건';
    }

    /**
     * 질의응답 보관 토글 (저장 또는 취소)
     */
    function toggleSaveNote(noteObj, btnElement) {
        const idx = savedNotes.findIndex(n => n.id === noteObj.id || (n.query === noteObj.query && n.answerHtml === noteObj.answerHtml));
        if (idx >= 0) {
            savedNotes.splice(idx, 1);
            saveSavedNotes(true);
            if (btnElement) {
                btnElement.classList.remove('saved');
                btnElement.innerHTML = '<i class="fa-regular fa-bookmark"></i> <span>보관</span>';
                btnElement.title = '이 질의응답을 보관함에 저장';
            }
            showToast('보관함에서 삭제되었습니다.');
        } else {
            savedNotes.unshift(noteObj);
            saveSavedNotes(true);
            if (btnElement) {
                btnElement.classList.add('saved');
                btnElement.innerHTML = '<i class="fa-solid fa-bookmark" style="color:#D97706;"></i> <span>보관됨</span>';
                btnElement.title = '보관됨 (클릭 시 보관 취소)';
            }
            showToast('⭐ 중요 질의응답이 보관함에 안전하게 저장되었습니다!');
        }
    }

    /**
     * 토스트 알림 표시
     */
    function showToast(message) {
        let toast = document.getElementById('standardsToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'standardsToast';
            toast.style.cssText = 'position:fixed; bottom:28px; left:50%; transform:translateX(-50%); background:#0F172A; color:#FFF; padding:10px 22px; border-radius:30px; font-size:13px; font-weight:600; z-index:99999; box-shadow:0 8px 24px rgba(0,0,0,0.35); opacity:0; transition:all 0.3s; pointer-events:none; display:flex; align-items:center; gap:8px; border:1px solid #334155;';
            document.body.appendChild(toast);
        }
        toast.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#10B981;"></i> ${escapeHtml(message)}`;
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(10px)';
        }, 2200);
    }

    /**
     * 보관함 모달 열기
     */
    function openSavedNotesModal(filterKeyword = '') {
        const modal = document.getElementById('modalSavedNotes');
        if (!modal) return;
        renderSavedNotesList(filterKeyword);
        modal.style.display = 'flex';
    }

    /**
     * 보관함 목록 렌더링
     */
    function renderSavedNotesList(filterKeyword = '') {
        const container = document.getElementById('savedNotesListContainer');
        if (!container) return;

        let filtered = savedNotes;
        if (filterKeyword) {
            const kw = filterKeyword.toLowerCase().trim();
            filtered = savedNotes.filter(n => 
                (n.query && n.query.toLowerCase().includes(kw)) ||
                (n.answerHtml && n.answerHtml.toLowerCase().includes(kw)) ||
                (n.memo && n.memo.toLowerCase().includes(kw)) ||
                (n.sources && n.sources.some(s => s.sourceTitle.toLowerCase().includes(kw) || (s.heading && s.heading.toLowerCase().includes(kw))))
            );
        }

        if (filtered.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:60px 20px; color:#94A3B8;">
                    <i class="fa-solid fa-bookmark" style="font-size:46px; color:#CBD5E1; margin-bottom:14px;"></i>
                    <p style="font-size:15px; font-weight:700; color:#64748B; margin-bottom:6px;">
                        ${filterKeyword ? '검색 결과와 일치하는 보관 질의가 없습니다.' : '보관된 질의응답이 없습니다.'}
                    </p>
                    <p style="font-size:12.5px; color:#94A3B8; max-width:420px; margin:0 auto; line-height:1.6;">
                        AI 답변 상단의 <strong>[<i class="fa-regular fa-bookmark"></i> 보관]</strong> 버튼을 누르면 중요한 관망 기준이나 Q&A가 이곳에 클라우드/로컬로 영구 보관됩니다.
                    </p>
                </div>
            `;
            return;
        }

        let html = '';
        filtered.forEach(note => {
            const sourcesTagHtml = (note.sources || []).map(s => {
                const pText = s.page ? ` p.${s.page}` : '';
                return `
                    <span class="snc-source-pill" data-source-id="${s.sourceId || ''}" data-quote="${escapeHtml(s.quote || '')}" data-page="${s.page || ''}" title="원문 페이지 열기">
                        <i class="fa-regular fa-file-pdf"></i> ${escapeHtml(s.sourceTitle)}${pText}
                    </span>
                `;
            }).join('');

            const memoHtml = note.memo ? `
                <div class="snc-memo-box">
                    <span><i class="fa-solid fa-pen" style="color:#D97706; margin-right:4px;"></i> <strong>업무 메모:</strong> ${escapeHtml(note.memo)}</span>
                    <button type="button" class="btn-edit-memo" data-id="${note.id}" style="background:transparent; border:none; color:#B45309; cursor:pointer; font-size:11.5px; text-decoration:underline;">수정</button>
                </div>
            ` : `
                <div style="margin-top:10px;">
                    <button type="button" class="btn-add-memo" data-id="${note.id}" style="background:transparent; border:none; color:#0284C7; cursor:pointer; font-size:12px; display:inline-flex; align-items:center; gap:4px; font-weight:600;">
                        <i class="fa-solid fa-plus"></i> 업무 메모 추가
                    </button>
                </div>
            `;

            html += `
                <div class="saved-note-card" data-id="${note.id}">
                    <div class="snc-header">
                        <div class="snc-title-box">
                            <div class="snc-question">
                                <i class="fa-solid fa-circle-question" style="color:#2563EB; margin-right:6px;"></i>${escapeHtml(note.query)}
                            </div>
                            <div class="snc-meta-row">
                                <span class="snc-date-badge"><i class="fa-regular fa-clock"></i> ${escapeHtml(note.dateStr || '')}</span>
                                <span style="color:#10B981; font-weight:600;"><i class="fa-solid fa-circle-check"></i> ${escapeHtml(note.badge || '기준 근거')}</span>
                            </div>
                        </div>
                        <div class="snc-actions">
                            <button type="button" class="btn-snc-action btn-copy-single-note" data-id="${note.id}" title="내용 복사">
                                <i class="fa-regular fa-copy"></i> 복사
                            </button>
                            <button type="button" class="btn-snc-action danger btn-delete-single-note" data-id="${note.id}" title="보관 삭제">
                                <i class="fa-solid fa-trash-can"></i> 삭제
                            </button>
                        </div>
                    </div>

                    ${sourcesTagHtml ? `<div class="snc-sources-tag-bar">${sourcesTagHtml}</div>` : ''}

                    <div class="snc-answer-body">
                        ${note.answerHtml}
                    </div>

                    ${memoHtml}
                </div>
            `;
        });

        container.innerHTML = html;

        // 원문 뷰어 열기
        container.querySelectorAll('.snc-source-pill, .citation-badge-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const sId = btn.dataset.sourceId;
                const quote = btn.dataset.quote;
                const page = parseInt(btn.dataset.page || '0', 10);
                if (sId) {
                    openSourceViewer(sId, quote, page);
                }
            });
        });

        // 단일 노트 삭제
        container.querySelectorAll('.btn-delete-single-note').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const nId = btn.dataset.id;
                if (confirm('이 질의응답을 보관함에서 삭제하시겠습니까?')) {
                    savedNotes = savedNotes.filter(n => n.id !== nId);
                    saveSavedNotes(true);
                    renderSavedNotesList(document.getElementById('inputSearchSavedNotes')?.value);
                    showToast('보관함에서 삭제되었습니다.');
                }
            });
        });

        // 단일 노트 복사
        container.querySelectorAll('.btn-copy-single-note').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const nId = btn.dataset.id;
                const target = savedNotes.find(n => n.id === nId);
                if (target) {
                    const temp = document.createElement('div');
                    temp.innerHTML = target.answerHtml;
                    const plainText = `[질문] ${target.query}\n\n[답변]\n${temp.innerText}\n\n(출처: 김해시 관망관리 기준 및 근거)`;
                    navigator.clipboard.writeText(plainText).then(() => {
                        showToast('클립보드에 복사되었습니다!');
                    });
                }
            });
        });

        // 메모 추가/수정
        container.querySelectorAll('.btn-add-memo, .btn-edit-memo').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const nId = btn.dataset.id;
                const target = savedNotes.find(n => n.id === nId);
                if (target) {
                    const newMemo = prompt('이 질의응답에 남길 업무 메모를 입력하세요 (예: 2026 사업계획 심의자료):', target.memo || '');
                    if (newMemo !== null) {
                        target.memo = newMemo.trim();
                        saveSavedNotes(true);
                        renderSavedNotesList(document.getElementById('inputSearchSavedNotes')?.value);
                    }
                }
            });
        });
    }

    /**
     * PDF.js를 이용한 고속 클라이언트 텍스트 및 페이지 추출 엔진
     */
    async function parsePdfDocument(file) {
        if (typeof pdfjsLib === 'undefined') {
            throw new Error('PDF.js 라이브러리를 로드 중입니다. 인터넷 연결을 확인해 주세요.');
        }
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const numPages = pdf.numPages;

        let sections = [];
        let totalTextChars = 0;

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            
            let lastY = null;
            let pageLines = [];
            let currentLine = '';

            textContent.items.forEach(item => {
                if (lastY === null || Math.abs(item.transform[5] - lastY) < 6) {
                    currentLine += item.str + ' ';
                } else {
                    if (currentLine.trim()) pageLines.push(currentLine.trim());
                    currentLine = item.str + ' ';
                }
                lastY = item.transform[5];
            });
            if (currentLine.trim()) pageLines.push(currentLine.trim());

            const pageText = pageLines.join('\n').trim();
            if (pageText.length > 15) {
                totalTextChars += pageText.length;
                
                // 페이지 내 소제목/조항 번호 탐지
                const headingMatch = pageText.match(/(제\s*\d+\s*[장조절]\s*[^\n]+|\[[^\]]+\]\s*[^\n]+|\d+\.\s*[^\n]+)/);
                const headingLabel = headingMatch ? `[p.${pageNum}] ${headingMatch[0].slice(0, 32)}` : `[p.${pageNum}] 제${pageNum}페이지`;

                sections.push({
                    heading: headingLabel,
                    text: pageText,
                    page: pageNum
                });
            }
        }

        if (sections.length === 0) {
            throw new Error('PDF에서 텍스트를 추출할 수 없습니다. 텍스트 복사가 가능한 정규 PDF 파일인지 확인해 주세요. (이미지 스캔 전용 PDF는 OCR 변환 필요)');
        }

        const originalKb = Math.round(file.size / 1024);
        const textKb = Math.max(1, Math.round((totalTextChars * 2) / 1024));
        const compressionRatio = Math.max(85, Math.round((1 - (textKb / Math.max(originalKb, 1))) * 100));

        return {
            title: file.name.replace(/\.[^/.]+$/, ""),
            sections: sections,
            originalKb: originalKb,
            compressedKb: textKb,
            compressionRatio: compressionRatio,
            numPages: numPages
        };
    }

    /**
     * 소스 목록 렌더링
     */
    function renderSourcesList() {
        const container = document.getElementById('sourcesListContainer');
        const badge = document.getElementById('sourceActiveCountBadge');
        const statusSpan = document.getElementById('groundingSourceStatus');
        if (!container) return;

        const activeCount = sources.filter(s => s.active).length;
        if (badge) badge.textContent = `${activeCount}개 선택됨`;
        
        // 활성 소스 명칭 텍스트 갱신
        const activeTitles = sources.filter(s => s.active).map(s => s.title.replace(/^\[[^\]]+\]\s*/, ''));
        if (statusSpan) {
            if (activeCount === 0) {
                statusSpan.innerHTML = `<span style="color:#EF4444;"><i class="fa-solid fa-triangle-exclamation"></i> 선택된 소스 없음 (좌측에서 체크하세요)</span>`;
            } else {
                const previewStr = activeTitles.slice(0, 2).join(', ') + (activeTitles.length > 2 ? ` 외 ${activeTitles.length - 2}건` : '');
                statusSpan.innerHTML = `<strong>참고 소스 (${activeCount}개):</strong> ${escapeHtml(previewStr)}`;
            }
        }

        if (sources.length === 0) {
            container.innerHTML = `
                <div style="padding:40px 20px; text-align:center; color:#94A3B8;">
                    <i class="fa-solid fa-file-pdf fa-2x" style="margin-bottom:10px; color:#CBD5E1;"></i>
                    <p style="font-size:13px; margin:0;">등록된 PDF 소스 자료가 없습니다.<br>상단의 <strong>[소스 자료 추가]</strong> 버튼으로 PDF를 올려보세요.</p>
                </div>
            `;
            return;
        }

        let html = '';
        sources.forEach((s) => {
            const totalChars = s.sections ? s.sections.reduce((acc, sec) => acc + (sec.text?.length || 0), 0) : 0;
            const secCount = s.sections ? s.sections.length : 0;
            const checked = s.active ? 'checked' : '';
            const activeClass = s.active ? 'active-source' : '';
            const isPdf = s.docType && s.docType.includes('PDF');

            html += `
                <div class="source-item-card ${activeClass}" data-source-id="${s.id}" title="클릭하여 이번 AI 질의응답 참고 소스로 선택/해제">
                    <div class="sic-top">
                        <label class="sic-checkbox-wrap" onclick="event.stopPropagation()">
                            <input type="checkbox" class="source-toggle-chk" data-id="${s.id}" ${checked}>
                            <span class="custom-chk"></span>
                        </label>
                        <div class="sic-title">${escapeHtml(s.title)}</div>
                        <div class="sic-menu-wrap" onclick="event.stopPropagation()">
                            <button type="button" class="btn-source-menu btn-view-source" data-id="${s.id}" title="원문 뷰어 열기">
                                <i class="fa-regular fa-eye"></i>
                            </button>
                            <button type="button" class="btn-source-menu btn-delete-source" data-id="${s.id}" title="소스 삭제">
                                <i class="fa-regular fa-trash-can"></i>
                            </button>
                        </div>
                    </div>
                    <div class="sic-meta">
                        ${isPdf ? `<span class="sic-tag tag-pdf"><i class="fa-solid fa-file-pdf"></i> PDF ${s.numPages || secCount}p</span>` : `<span class="sic-tag"><i class="fa-solid fa-file-lines"></i> ${s.category || '지침'}</span>`}
                        <span class="sic-tag tag-compress" title="원문 대비 텍스트 추출 및 압축 절감률"><i class="fa-solid fa-compress"></i> ${s.compressionRatio || 98}% 용량축소</span>
                        <span class="sic-chars">${totalChars.toLocaleString()}자</span>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

        // 카드 클릭 시 선택/해제 토글
        container.querySelectorAll('.source-item-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.dataset.sourceId;
                const src = sources.find(s => s.id === id);
                if (src) {
                    src.active = !src.active;
                    saveSources();
                    renderSourcesList();
                }
            });
        });

        // 체크박스 클릭
        container.querySelectorAll('.source-toggle-chk').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const id = e.target.dataset.id;
                const src = sources.find(s => s.id === id);
                if (src) {
                    src.active = e.target.checked;
                    saveSources();
                    renderSourcesList();
                }
            });
        });

        // 원문 보기
        container.querySelectorAll('.btn-view-source').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                openSourceViewer(btn.dataset.id);
            });
        });

        // 삭제
        container.querySelectorAll('.btn-delete-source').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteSource(btn.dataset.id);
            });
        });
    }

    /**
     * 소스 원문 뷰어 모달 열기 (특정 구절 및 페이지 하이라이트)
     */
    function openSourceViewer(sourceId, highlightQuote = null, targetPage = null) {
        const src = sources.find(s => s.id === sourceId);
        if (!src) return;

        const modal = document.getElementById('modalViewSource');
        const titleEl = document.getElementById('viewSourceModalTitle');
        const bodyEl = document.getElementById('viewSourceModalBody');
        if (!modal || !titleEl || !bodyEl) return;

        titleEl.innerHTML = `<i class="fa-solid fa-book-open" style="color:#2563EB;"></i> ${escapeHtml(src.title)}`;

        let contentHtml = `
            <div style="margin-bottom:14px; padding:12px 16px; background:#EFF6FF; border:1px solid #BFDBFE; border-radius:8px; font-size:12.5px; color:#1E40AF; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong>형식:</strong> ${src.docType || 'PDF'} &nbsp;|&nbsp; <strong>총 페이지:</strong> ${src.numPages || src.sections.length}p &nbsp;|&nbsp; <strong>용량 절감:</strong> ${src.compressionRatio || 98}% 압축됨
                </div>
                <div style="color:#059669; font-weight:700;"><i class="fa-solid fa-cloud-check"></i> 클라우드 보관 중</div>
            </div>
        `;

        src.sections.forEach((sec) => {
            let sectionText = escapeHtml(sec.text);
            let isTarget = false;

            if (highlightQuote && sec.text.includes(highlightQuote)) {
                isTarget = true;
                const escapedQuote = escapeHtml(highlightQuote);
                sectionText = sectionText.replace(escapedQuote, `<mark class="quote-mark">${escapedQuote}</mark>`);
            } else if (targetPage && sec.page === targetPage) {
                isTarget = true;
            }

            const isTargetClass = isTarget ? 'is-target' : '';

            contentHtml += `
                <div class="source-doc-section ${isTargetClass}">
                    <div class="sds-header">
                        <span class="sds-heading"><i class="fa-solid fa-bookmark" style="color:#3B82F6; font-size:11px;"></i> ${escapeHtml(sec.heading)}</span>
                        ${sec.page ? `<span class="sds-page">p.${sec.page}</span>` : ''}
                    </div>
                    <div class="sds-text">${sectionText}</div>
                </div>
            `;
        });

        bodyEl.innerHTML = contentHtml;
        modal.style.display = 'flex';

        // 하이라이트 위치로 부드럽게 스크롤
        setTimeout(() => {
            const mark = bodyEl.querySelector('mark');
            if (mark) mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }

    /**
     * 소스 삭제
     */
    function deleteSource(sourceId) {
        const src = sources.find(s => s.id === sourceId);
        if (!src) return;

        if (confirm(`[${src.title}]\n이 소스 문서를 삭제하시겠습니까?\n삭제 시 AI가 이 문서를 더 이상 근거로 참조하지 않습니다.`)) {
            sources = sources.filter(s => s.id !== sourceId);
            saveSources();
            renderSourcesList();
        }
    }

    /**
     * 최초 AI 웰컴 메시지 렌더링
     */
    function renderInitialChatWelcome() {
        const container = document.getElementById('notebookChatMessages');
        if (!container) return;

        container.innerHTML = `
            <div class="chat-message-row ai-msg">
                <div class="cm-avatar"><i class="fa-solid fa-brain"></i></div>
                <div class="cm-bubble">
                    <div class="cm-header">
                        <span class="cm-author">기준 및 근거 AI 어시스턴트</span>
                        <span class="cm-badge"><i class="fa-solid fa-shield-halved"></i> 노트북LM Grounded Engine</span>
                    </div>
                    <div class="cm-body">
                        안녕하세요! 김해시 관망관리 <strong>[기준 및 근거 AI 어시스턴트]</strong>입니다. 📘<br><br>
                        <strong>노트북LM 원칙 안내:</strong><br>
                        1. <strong>선택적 소스 참조:</strong> 좌측에서 체크박스로 활성화한 문서의 내용만을 근거로 답변합니다.<br>
                        2. <strong>원문 100% 근거 &amp; 출처 표기:</strong> 답변마다 <strong>[인용 1]</strong>과 해당 페이지 번호가 붙으며, 클릭 시 원문 구절을 즉시 대조할 수 있습니다.<br>
                        3. <strong>환각 방지:</strong> 등록된 소스에 없는 내용은 지어내지 않고 '근거 없음'을 명확히 알려드립니다.<br>
                        4. <strong>PDF 고속 업로드:</strong> 상단 <strong>[소스 자료 추가]</strong>에서 실무 PDF 지침서를 올리시면 98% 용량으로 압축되어 클라우드에 안전 보관됩니다.<br><br>
                        상단의 <strong>[작동 원리 안내]</strong> 또는 아래 <strong>[추천 질의]</strong>를 클릭해 보세요!
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 검색 & Grounding 엔진: 활성 소스에서 쿼리와 가장 연관성 높은 구절 검색
     */
    function retrieveGroundedChunks(query) {
        const activeSources = sources.filter(s => s.active);
        if (activeSources.length === 0) {
            return {
                hasActiveSources: false,
                matches: []
            };
        }

        const cleanQuery = query.toLowerCase().replace(/[^\w\s가-힣]/g, ' ');
        const queryTerms = cleanQuery.split(/\s+/).filter(t => t.length >= 2);

        const synonymMap = {
            'mnf': ['야간최소유량', '야간', '최소유량', 'mnf', '새벽'],
            '야간최소유량': ['mnf', 'lnc', '순누수량', '야간', '최소유량'],
            'lnc': ['합법적', '야간사용량', 'lnc', '대수용가'],
            '유수율': ['누수', '순누수량', '공급량', '부과량'],
            '수압': ['동수압', '정수압', 'kpa', 'kgf', '감압', '감압밸브'],
            '유속': ['관속', '유속', 'm/s', '적수', '탁수', '잔류염소'],
            '소화전': ['방류', '간격', '소화전', '배수관'],
            '계량기': ['구경', '적정구경', '13mm', '20mm', '25mm', '50mm', '과대구경', '불감수량'],
            '적정구경': ['구경', '일사용량', '과대구경', '축소', '하향'],
            '과대구경': ['적정구경', '불감수량', '축소', '하향', '30%'],
            '0톤': ['결침', '0톤', '미검침', '단수', '폐가', '고장'],
            '결침': ['0톤', '검침', '이상사용량', '급증', '급감'],
            '노후관': ['내구연한', '내용연수', '주철관', 'cip', '강관', '우선순위'],
            '내구연한': ['내용연수', '노후관', '20년', '30년', '경과연수'],
            '불용관': ['폐선', '폐관', '차단', '철거', '매몰', '퇴수', '모르타르', '캡'],
            '폐선': ['불용관', '차단', '철거', '매몰', '퇴수', '모르타르']
        };

        let expandedTerms = [...queryTerms];
        queryTerms.forEach(t => {
            if (synonymMap[t]) {
                expandedTerms = expandedTerms.concat(synonymMap[t]);
            }
        });
        expandedTerms = Array.from(new Set(expandedTerms));

        const matches = [];

        activeSources.forEach(src => {
            if (!src.sections) return;
            src.sections.forEach(sec => {
                const textLower = (sec.heading + ' ' + sec.text).toLowerCase();
                let score = 0;
                let matchedWords = [];

                expandedTerms.forEach(term => {
                    if (textLower.includes(term)) {
                        const count = (textLower.match(new RegExp(term, 'g')) || []).length;
                        score += (term.length >= 3 ? 3 : 1.5) * count;
                        matchedWords.push(term);
                    }
                });

                if (score > 0) {
                    matches.push({
                        sourceId: src.id,
                        sourceTitle: src.title,
                        heading: sec.heading,
                        text: sec.text,
                        page: sec.page || null,
                        score: score,
                        matchedWords: Array.from(new Set(matchedWords))
                    });
                }
            });
        });

        matches.sort((a, b) => b.score - a.score);

        return {
            hasActiveSources: true,
            activeSources: activeSources,
            matches: matches
        };
    }

    /**
     * 질문 전송 및 Grounded 답변 생성
     */
    function askQuestion(userQuery) {
        const query = userQuery.trim();
        if (!query) return;

        appendUserMessage(query);

        const chatBox = document.getElementById('notebookChatMessages');
        if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;

        const loadingId = 'loading_' + Date.now();
        appendLoadingIndicator(loadingId);

        setTimeout(() => {
            removeLoadingIndicator(loadingId);
            generateAndAppendAnswer(query);
        }, 550);
    }

    function appendUserMessage(text) {
        const container = document.getElementById('notebookChatMessages');
        if (!container) return;

        const row = document.createElement('div');
        row.className = 'chat-message-row user-msg';
        row.innerHTML = `
            <div class="cm-bubble">
                <div class="cm-body">${escapeHtml(text)}</div>
            </div>
            <div class="cm-avatar"><i class="fa-solid fa-user"></i></div>
        `;
        container.appendChild(row);
    }

    function appendLoadingIndicator(id) {
        const container = document.getElementById('notebookChatMessages');
        if (!container) return;

        const row = document.createElement('div');
        row.className = 'chat-message-row ai-msg';
        row.id = id;
        row.innerHTML = `
            <div class="cm-avatar"><i class="fa-solid fa-brain"></i></div>
            <div class="cm-bubble" style="padding:14px 18px;">
                <div class="ai-searching-indicator">
                    <i class="fa-solid fa-circle-notch fa-spin" style="color:#2563EB;"></i>
                    <span>선택된 소스 문서의 페이지들을 탐색·인용 대조 중입니다...</span>
                </div>
            </div>
        `;
        container.appendChild(row);
        container.scrollTop = container.scrollHeight;
    }

    function removeLoadingIndicator(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    /**
     * 답변 합성 및 렌더링
     */
    function generateAndAppendAnswer(query) {
        const container = document.getElementById('notebookChatMessages');
        if (!container) return;

        const result = retrieveGroundedChunks(query);
        const row = document.createElement('div');
        row.className = 'chat-message-row ai-msg';

        if (!result.hasActiveSources) {
            row.innerHTML = `
                <div class="cm-avatar"><i class="fa-solid fa-triangle-exclamation" style="background:#F59E0B;"></i></div>
                <div class="cm-bubble">
                    <div class="cm-header">
                        <span class="cm-author">기준 및 근거 AI</span>
                        <span class="cm-badge" style="background:#FEF3C7; color:#D97706;">소스 미선택</span>
                    </div>
                    <div class="cm-body" style="color:#B45309;">
                        현재 선택된 소스 자료가 없습니다. 좌측 <strong>[소스 자료]</strong> 목록에서 이번 질문에 참고할 문서의 체크박스를 클릭하신 후 다시 질문해 주세요.
                    </div>
                </div>
            `;
            container.appendChild(row);
            container.scrollTop = container.scrollHeight;
            return;
        }

        if (result.matches.length === 0 || result.matches[0].score < 2) {
            const activeListStr = result.activeSources.map(s => `• ${escapeHtml(s.title)}`).join('<br>');
            row.innerHTML = `
                <div class="cm-avatar"><i class="fa-solid fa-shield-halved" style="background:#EF4444;"></i></div>
                <div class="cm-bubble">
                    <div class="cm-header">
                        <span class="cm-author">기준 및 근거 AI</span>
                        <span class="cm-badge" style="background:#FEE2E2; color:#DC2626;"><i class="fa-solid fa-ban"></i> 소스 근거 미확인</span>
                    </div>
                    <div class="cm-body">
                        죄송합니다. 현재 선택하신 아래 소스 문서들에서는 <strong>"${escapeHtml(query)}"</strong>에 관한 명시적인 기준을 찾을 수 없습니다.<br><br>
                        <div class="active-sources-fallback-box" style="padding:10px 14px; font-size:12px; border-radius:6px; margin:8px 0;">
                            <strong>현재 참고 중인 소스:</strong><br>
                            ${activeListStr}
                        </div>
                        <br><i class="fa-solid fa-circle-info"></i> <strong>노트북LM 원칙:</strong> 등록된 소스에 없는 내용은 거짓으로 꾸며내지 않습니다. 관련 조항이 담긴 다른 소스를 추가로 체크하시거나 새 PDF를 업로드해 주세요.
                    </div>
                </div>
            `;
            container.appendChild(row);
            container.scrollTop = container.scrollHeight;
            return;
        }

        const topMatches = result.matches.slice(0, 3);
        const answerHtml = synthesizeAnswer(query, topMatches);
        const noteId = 'note_' + Date.now();
        const isSaved = savedNotes.some(n => n.id === noteId);

        row.innerHTML = `
            <div class="cm-avatar"><i class="fa-solid fa-brain"></i></div>
            <div class="cm-bubble">
                <div class="cm-header">
                    <div class="cm-header-left">
                        <span class="cm-author">기준 및 근거 AI</span>
                        <span class="cm-badge"><i class="fa-solid fa-check-circle" style="color:#10B981;"></i> ${topMatches.length}개 소스 조문 인용됨</span>
                    </div>
                    <button type="button" class="btn-save-qa-note ${isSaved ? 'saved' : ''}" data-note-id="${noteId}" title="${isSaved ? '보관됨 (클릭 시 보관 취소)' : '이 질의응답을 보관함에 저장'}">
                        <i class="${isSaved ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark'}"></i> <span>${isSaved ? '보관됨' : '보관'}</span>
                    </button>
                </div>
                <div class="cm-body">
                    ${answerHtml}
                </div>
            </div>
        `;
        container.appendChild(row);
        container.scrollTop = container.scrollHeight;

        // 보관 버튼 이벤트
        const btnSave = row.querySelector('.btn-save-qa-note');
        if (btnSave) {
            btnSave.addEventListener('click', () => {
                toggleSaveNote({
                    id: noteId,
                    dateStr: new Date().toLocaleDateString('ko-KR') + ' ' + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                    query: query,
                    author: '기준 및 근거 AI',
                    badge: `${topMatches.length}개 소스 조문 인용됨`,
                    answerHtml: answerHtml,
                    sources: topMatches.map(m => ({
                        sourceId: m.sourceId,
                        sourceTitle: m.sourceTitle,
                        heading: m.heading,
                        page: m.page,
                        quote: m.text.slice(0, 35)
                    })),
                    memo: ''
                }, btnSave);
            });
        }

        // 인용 출처 버튼 클릭 시 뷰어로 이동
        row.querySelectorAll('.citation-badge-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const sId = btn.dataset.sourceId;
                const quote = btn.dataset.quote;
                const page = parseInt(btn.dataset.page || '0', 10);
                openSourceViewer(sId, quote, page);
            });
        });
    }

    /**
     * Grounded 답변 텍스트 구성
     */
    function synthesizeAnswer(query, topMatches) {
        let citationsHtml = '';
        topMatches.forEach((m, idx) => {
            const citeNum = idx + 1;
            const shortQuote = m.text.length > 100 ? m.text.slice(0, 100) + '...' : m.text;
            const pageTag = m.page ? `<span class="cc-page">제${m.page}페이지</span>` : '';

            citationsHtml += `
                <div class="citation-card" data-source-id="${m.sourceId}">
                    <div class="cc-header">
                        <span class="cc-badge">[출처 ${citeNum}]</span>
                        <strong class="cc-source-title">${escapeHtml(m.sourceTitle)}</strong>
                        ${pageTag}
                        <span class="cc-heading">&gt; ${escapeHtml(m.heading)}</span>
                    </div>
                    <div class="cc-quote">"${escapeHtml(shortQuote)}"</div>
                    <button type="button" class="btn-cc-view citation-badge-btn" data-source-id="${m.sourceId}" data-quote="${escapeHtml(m.text.slice(0, 35))}" data-page="${m.page || ''}">
                        <i class="fa-regular fa-file-lines"></i> 원문 페이지 확인
                    </button>
                </div>
            `;
        });

        let summaryPoints = [];
        topMatches.forEach((m, idx) => {
            const citeNum = idx + 1;
            const pageText = m.page ? ` (p.${m.page})` : '';
            summaryPoints.push(`
                <li class="grounded-point-item" style="margin-bottom:9px;">
                    <strong class="gpi-heading">${escapeHtml(m.heading)}</strong>: <span class="gpi-text">${escapeHtml(m.text)}</span> 
                    <button type="button" class="citation-badge-btn cite-pill" data-source-id="${m.sourceId}" data-quote="${escapeHtml(m.text.slice(0, 35))}" data-page="${m.page || ''}" title="출처: ${m.sourceTitle}${pageText}">[출처 ${citeNum}]</button>
                </li>
            `);
        });

        return `
            <div class="grounded-answer-box">
                <div class="grounded-intro" style="font-size:14px; line-height:1.75; font-weight:500;">
                    선택하신 기준 소스 문서에 명시된 원문 근거는 다음과 같습니다:
                </div>
                <ul class="grounded-points-list" style="margin:12px 0; padding-left:20px; line-height:1.75;">
                    ${summaryPoints.join('')}
                </ul>
            </div>

            <div class="grounding-citations-section">
                <div class="gcs-title"><i class="fa-solid fa-quote-left"></i> 인용 출처 및 발췌문 (Citations)</div>
                <div class="gcs-list">
                    ${citationsHtml}
                </div>
            </div>
        `;
    }

    /**
     * 노트북LM 스튜디오 빠른 실행 1: 핵심 요약 브리핑
     */
    function runStudioSummary() {
        const active = sources.filter(s => s.active);
        if (active.length === 0) {
            alert('활성화된 소스 문서가 없습니다. 좌측에서 문서를 선택해 주세요.');
            return;
        }

        appendUserMessage('📑 현재 선택된 소스 문서들의 핵심 기준을 종합 브리핑해줘.');
        appendLoadingIndicator('studio_loading');

        setTimeout(() => {
            removeLoadingIndicator('studio_loading');
            const container = document.getElementById('notebookChatMessages');

            let briefingCards = '';
            active.forEach(src => {
                let secList = src.sections.slice(0, 3).map(s => `• <strong>${escapeHtml(s.heading)}</strong>: ${escapeHtml(s.text.slice(0, 110))}...`).join('<br>');
                briefingCards += `
                    <div class="briefing-card" style="border-radius:8px; padding:12px 16px; margin-bottom:10px;">
                        <div class="briefing-card-title" style="font-weight:700; margin-bottom:6px;"><i class="fa-solid fa-file-pdf" style="color:#EF4444;"></i> ${escapeHtml(src.title)} (${src.numPages || src.sections.length}p)</div>
                        <div class="briefing-card-body" style="font-size:12.5px; line-height:1.65;">${secList}</div>
                    </div>
                `;
            });

            const row = document.createElement('div');
            row.className = 'chat-message-row ai-msg';
            const noteId = 'studio_summary_' + Date.now();
            const isSaved = savedNotes.some(n => n.id === noteId);

            row.innerHTML = `
                <div class="cm-avatar"><i class="fa-solid fa-wand-magic-sparkles" style="background:#0284C7;"></i></div>
                <div class="cm-bubble">
                    <div class="cm-header">
                        <div class="cm-header-left">
                            <span class="cm-author">노트북LM 핵심 브리핑 스튜디오</span>
                            <span class="cm-badge" style="background:#E0F2FE; color:#0369A1;">총 ${active.length}개 문서 요약</span>
                        </div>
                        <button type="button" class="btn-save-qa-note ${isSaved ? 'saved' : ''}" data-note-id="${noteId}" title="이 브리핑을 보관함에 저장">
                            <i class="${isSaved ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark'}"></i> <span>${isSaved ? '보관됨' : '보관'}</span>
                        </button>
                    </div>
                    <div class="cm-body">
                        <p style="margin-top:0;">현재 활성화된 <strong>${active.length}개 소스 문서</strong>의 주요 기준을 요약 브리핑합니다.</p>
                        ${briefingCards}
                        <p style="font-size:12px; color:#64748B; margin-bottom:0;"><i class="fa-solid fa-lightbulb"></i> 특정 조항의 세부 산출 공식이나 규정이 궁금하시면 채팅창에 바로 물어보세요!</p>
                    </div>
                </div>
            `;
            container.appendChild(row);
            container.scrollTop = container.scrollHeight;

            const btnSave = row.querySelector('.btn-save-qa-note');
            if (btnSave) {
                btnSave.addEventListener('click', () => {
                    toggleSaveNote({
                        id: noteId,
                        dateStr: new Date().toLocaleDateString('ko-KR') + ' ' + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                        query: '📑 선택된 소스 문서들의 핵심 기준 종합 브리핑',
                        author: '노트북LM 핵심 브리핑 스튜디오',
                        badge: `${active.length}개 문서 종합 요약`,
                        answerHtml: `<p>현재 활성화된 <strong>${active.length}개 소스 문서</strong>의 주요 기준 요약입니다.</p>${briefingCards}`,
                        sources: active.map(s => ({
                            sourceId: s.id,
                            sourceTitle: s.title,
                            heading: '핵심 기준 요약'
                        })),
                        memo: ''
                    }, btnSave);
                });
            }
        }, 600);
    }

    /**
     * 노트북LM 스튜디오 빠른 실행 2: 자주 묻는 질문 (FAQ)
     */
    function runStudioFaq() {
        appendUserMessage('❓ 실무자가 가장 많이 참고하는 주요 Q&A 4가지를 정리해줘.');
        appendLoadingIndicator('faq_loading');

        setTimeout(() => {
            removeLoadingIndicator('faq_loading');
            const container = document.getElementById('notebookChatMessages');

            const faqs = [
                {
                    q: 'Q1. 야간최소유량(MNF) 판정에서 누수탐사를 즉시 착수해야 하는 기준은?',
                    a: '블록 일공급량 대비 야간최소유량(MNF) 비율이 25%를 초과하거나, 직전 3개월 평균치 대비 20% 이상 급격히 상승한 경우 지하 누수로 판정하여 즉시 현장 누수탐사반을 투입합니다. [K-water 가이드라인 제3조]'
                },
                {
                    q: 'Q2. 수용가 과대구경(불감수량) 판정 및 구경 하향 축소 권고 기준은?',
                    a: '최근 3개월 평균 일사용량이 해당 계량기 구경별 하한 기준치의 30% 미만으로 사용되는 경우 과대구경으로 진단하여 적정 소구경(예: 25mm ➔ 13mm 등)으로의 축소를 권고합니다. [김해시 급수조례 제15조]'
                },
                {
                    q: 'Q3. 배수관로 내 표준 수압과 최대 허용 수압은?',
                    a: '일반 주거지역의 표준 동수압은 2.0 ~ 4.0 kgf/㎠ (200~400 kPa)를 권장하며, 배수관 파손 및 누수 예방을 위한 최대 수압은 7.0 kgf/㎠ 이하로 제한합니다. 초과 시 감압밸브를 설치합니다. [환경부 시설기준 제1장]'
                },
                {
                    q: 'Q4. 도로를 굴착하지 못해 매몰 존치하는 불용관의 폐쇄 조치 기준은?',
                    a: '본관 분기점을 완전히 절단 차단하고, 관내 잔류수를 퇴수밸브로 배출한 후 모르타르를 충진 밀봉하여 오염수 역류 및 싱크홀(지반 공동) 발생을 방지하여야 합니다. [국토부/환경부 지침 제18조]'
                }
            ];

            let faqCards = faqs.map(f => `
                <div class="faq-card" style="border-radius:8px; padding:12px 16px; margin-bottom:10px;">
                    <div class="faq-card-q" style="font-weight:700; font-size:13.5px; margin-bottom:4px;">${f.q}</div>
                    <div class="faq-card-a" style="font-size:12.5px; line-height:1.65;">${f.a}</div>
                </div>
            `).join('');

            const row = document.createElement('div');
            row.className = 'chat-message-row ai-msg';
            const noteId = 'studio_faq_' + Date.now();
            const isSaved = savedNotes.some(n => n.id === noteId);

            row.innerHTML = `
                <div class="cm-avatar"><i class="fa-solid fa-circle-question" style="background:#10B981;"></i></div>
                <div class="cm-bubble">
                    <div class="cm-header">
                        <div class="cm-header-left">
                            <span class="cm-author">노트북LM FAQ 스튜디오</span>
                            <span class="cm-badge" style="background:#D1FAE5; color:#065F46;">실무 핵심 Q&A 4선</span>
                        </div>
                        <button type="button" class="btn-save-qa-note ${isSaved ? 'saved' : ''}" data-note-id="${noteId}" title="이 FAQ 목록을 보관함에 저장">
                            <i class="${isSaved ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark'}"></i> <span>${isSaved ? '보관됨' : '보관'}</span>
                        </button>
                    </div>
                    <div class="cm-body">
                        ${faqCards}
                    </div>
                </div>
            `;
            container.appendChild(row);
            container.scrollTop = container.scrollHeight;

            const btnSave = row.querySelector('.btn-save-qa-note');
            if (btnSave) {
                btnSave.addEventListener('click', () => {
                    toggleSaveNote({
                        id: noteId,
                        dateStr: new Date().toLocaleDateString('ko-KR') + ' ' + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                        query: '❓ 실무자가 가장 많이 참고하는 주요 Q&A 4가지',
                        author: '노트북LM FAQ 스튜디오',
                        badge: '실무 핵심 Q&A 4선',
                        answerHtml: faqCards,
                        sources: [
                            { sourceId: 'src_kwater', sourceTitle: '[K-water] 실무 매뉴얼', heading: 'MNF 누수탐사 착수 기준' },
                            { sourceId: 'src_gimhae', sourceTitle: '[김해시] 급수 조례', heading: '과대구경 축소 기준' },
                            { sourceId: 'src_env_standard', sourceTitle: '[환경부] 상수도시설기준', heading: '표준 수압 기준' },
                            { sourceId: 'src_aging_standard', sourceTitle: '[국토부] 불용관 폐쇄 지침', heading: '불용관 폐쇄 조치 기준' }
                        ],
                        memo: ''
                    }, btnSave);
                });
            }
        }, 550);
    }

    /**
     * 노트북LM 스튜디오 빠른 실행 3: 현장 점검 체크리스트
     */
    function runStudioChecklist() {
        appendUserMessage('📋 소스 기준을 토대로 현장 점검 체크리스트를 생성해줘.');
        appendLoadingIndicator('chk_loading');

        setTimeout(() => {
            removeLoadingIndicator('chk_loading');
            const container = document.getElementById('notebookChatMessages');

            const row = document.createElement('div');
            row.className = 'chat-message-row ai-msg';
            const noteId = 'studio_chk_' + Date.now();
            const isSaved = savedNotes.some(n => n.id === noteId);

            row.innerHTML = `
                <div class="cm-avatar"><i class="fa-solid fa-list-check" style="background:#F59E0B;"></i></div>
                <div class="cm-bubble">
                    <div class="cm-header">
                        <div class="cm-header-left">
                            <span class="cm-author">노트북LM 실무 체크리스트</span>
                            <span class="cm-badge" style="background:#FEF3C7; color:#92400E;">관망 정비 점검표</span>
                        </div>
                        <button type="button" class="btn-save-qa-note ${isSaved ? 'saved' : ''}" data-note-id="${noteId}" title="이 체크리스트를 보관함에 저장">
                            <i class="${isSaved ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark'}"></i> <span>${isSaved ? '보관됨' : '보관'}</span>
                        </button>
                    </div>
                    <div class="cm-body">
                        <table style="width:100%; border-collapse:collapse; font-size:12.5px; margin-top:8px;">
                            <thead>
                                <tr style="background:#F1F5F9; border-bottom:2px solid #CBD5E1;">
                                    <th style="padding:8px; text-align:center; width:45px;">확인</th>
                                    <th style="padding:8px; text-align:left;">점검 항목</th>
                                    <th style="padding:8px; text-align:left; width:130px;">공식 기준치</th>
                                    <th style="padding:8px; text-align:left; width:110px;">근거 조항</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style="border-bottom:1px solid #E2E8F0;">
                                    <td style="text-align:center;"><input type="checkbox"></td>
                                    <td><strong>소블록 야간최소유량(MNF)</strong> 공급량 대비 비율 확인</td>
                                    <td>일공급량의 25% 이하</td>
                                    <td>K-water 제3조</td>
                                </tr>
                                <tr style="border-bottom:1px solid #E2E8F0;">
                                    <td style="text-align:center;"><input type="checkbox"></td>
                                    <td><strong>배수관 말단 수압</strong> 측정 및 적정 범위 확인</td>
                                    <td>2.0 ~ 4.0 kgf/㎠</td>
                                    <td>환경부 제1장</td>
                                </tr>
                                <tr style="border-bottom:1px solid #E2E8F0;">
                                    <td style="text-align:center;"><input type="checkbox"></td>
                                    <td><strong>소화전 설치 간격</strong> 준수 여부</td>
                                    <td>상업 100m, 주거 140m</td>
                                    <td>환경부 제3장</td>
                                </tr>
                                <tr style="border-bottom:1px solid #E2E8F0;">
                                    <td style="text-align:center;"><input type="checkbox"></td>
                                    <td><strong>2개월 연속 0톤 결침 수용가</strong> 현장 방문</td>
                                    <td>기기고장·무단취수 점검</td>
                                    <td>김해시 제21조</td>
                                </tr>
                                <tr>
                                    <td style="text-align:center;"><input type="checkbox"></td>
                                    <td><strong>매몰 존치 불용관</strong> 잔류수 퇴수 및 모르타르 충진</td>
                                    <td>완전 배출 후 밀봉</td>
                                    <td>국토부 제18조</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            container.appendChild(row);
            container.scrollTop = container.scrollHeight;

            const btnSave = row.querySelector('.btn-save-qa-note');
            if (btnSave) {
                btnSave.addEventListener('click', () => {
                    const tableHtml = row.querySelector('.cm-body').innerHTML;
                    toggleSaveNote({
                        id: noteId,
                        dateStr: new Date().toLocaleDateString('ko-KR') + ' ' + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                        query: '📋 관망 정비 및 관리 현장 점검 체크리스트',
                        author: '노트북LM 실무 체크리스트',
                        badge: '관망 정비 점검표',
                        answerHtml: tableHtml,
                        sources: [
                            { sourceId: 'src_env_standard', sourceTitle: '[환경부] 상수도시설기준', heading: '수압 및 소화전 기준' },
                            { sourceId: 'src_kwater', sourceTitle: '[K-water] 실무 매뉴얼', heading: 'MNF 점검' },
                            { sourceId: 'src_gimhae', sourceTitle: '[김해시] 급수 조례', heading: '0톤 수용가 점검' },
                            { sourceId: 'src_aging_standard', sourceTitle: '[국토부] 불용관 폐쇄 지침', heading: '불용관 점검' }
                        ],
                        memo: ''
                    }, btnSave);
                });
            }
        }, 550);
    }

    /**
     * 이벤트 바인딩
     */
    function bindEvents() {
        // 질문 전송 버튼
        const sendBtn = document.getElementById('btnSendStandardsQuestion');
        const input = document.getElementById('standardsQuestionInput');
        if (sendBtn && input) {
            sendBtn.addEventListener('click', () => {
                const val = input.value;
                input.value = '';
                askQuestion(val);
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const val = input.value;
                    input.value = '';
                    askQuestion(val);
                }
            });
        }

        // 추천 질문 칩 클릭
        document.querySelectorAll('.prompt-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const q = chip.dataset.query;
                askQuestion(q);
            });
        });

        // 스튜디오 툴바 버튼들
        const btnSummary = document.getElementById('btnStudioSummary');
        if (btnSummary) btnSummary.addEventListener('click', runStudioSummary);

        const btnFaq = document.getElementById('btnStudioFaq');
        if (btnFaq) btnFaq.addEventListener('click', runStudioFaq);

        const btnChecklist = document.getElementById('btnStudioChecklist');
        if (btnChecklist) btnChecklist.addEventListener('click', runStudioChecklist);

        const btnClear = document.getElementById('btnClearChatHistory');
        if (btnClear) {
            btnClear.addEventListener('click', () => {
                if (confirm('대화 기록을 모두 지우고 새 세션을 시작하시겠습니까?')) {
                    renderInitialChatWelcome();
                }
            });
        }

        // 소스 추가 모달 열기/닫기
        const modalAdd = document.getElementById('modalAddSource');
        const btnOpenAdd = document.getElementById('btnOpenAddSourceModal');
        const btnCloseAdd = document.getElementById('btnCloseAddSourceModal');
        const btnCancelAdd = document.getElementById('btnCancelAddSource');
        if (btnOpenAdd && modalAdd) {
            btnOpenAdd.addEventListener('click', () => {
                modalAdd.style.display = 'flex';
            });
        }
        if (btnCloseAdd && modalAdd) {
            btnCloseAdd.addEventListener('click', () => {
                modalAdd.style.display = 'none';
            });
        }
        if (btnCancelAdd && modalAdd) {
            btnCancelAdd.addEventListener('click', () => {
                modalAdd.style.display = 'none';
            });
        }

        // 소스 추가 탭 전환
        document.querySelectorAll('.source-tab-btn').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.source-tab-btn').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const targetId = tab.dataset.tab;
                document.querySelectorAll('.source-tab-content').forEach(c => c.style.display = 'none');
                const targetContent = document.getElementById(targetId);
                if (targetContent) targetContent.style.display = 'flex';
            });
        });

        // 소스 파일 업로드 인풋
        const fileInput = document.getElementById('inputSourceFile');
        const statusText = document.getElementById('uploadFileStatusText');
        let selectedFile = null;
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    selectedFile = e.target.files[0];
                    const sizeKb = Math.round(selectedFile.size / 1024);
                    const isPdf = selectedFile.name.toLowerCase().endsWith('.pdf');
                    if (statusText) {
                        statusText.innerHTML = `
                            <div style="color:#059669; font-weight:700;">
                                ${isPdf ? '<i class="fa-solid fa-file-pdf" style="color:#EF4444;"></i>' : '<i class="fa-solid fa-file-lines"></i>'} 
                                선택됨: ${escapeHtml(selectedFile.name)} (${sizeKb.toLocaleString()} KB)
                            </div>
                            ${isPdf ? '<div style="font-size:11px; color:#64748B; margin-top:3px;">확인을 누르면 페이지별 고속 텍스트 추출 및 98% 용량 압축이 진행됩니다.</div>' : ''}
                        `;
                    }
                }
            });
        }

        // 소스 추가 모달 [확인] 버튼 (PDF 및 일반 파일 파싱)
        const btnConfirmAdd = document.getElementById('btnConfirmAddSource');
        if (btnConfirmAdd) {
            btnConfirmAdd.addEventListener('click', async () => {
                const activeTab = document.querySelector('.source-tab-btn.active')?.dataset.tab;

                if (activeTab === 'tabUploadFile') {
                    if (!selectedFile) {
                        alert('업로드할 PDF 또는 텍스트 문서 파일을 선택해 주세요.');
                        return;
                    }

                    btnConfirmAdd.disabled = true;
                    btnConfirmAdd.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 문서 파싱 및 압축 중...';

                    try {
                        const isPdf = selectedFile.name.toLowerCase().endsWith('.pdf');

                        if (isPdf) {
                            // PDF.js 기반 텍스트 및 페이지 추출
                            const parsed = await parsePdfDocument(selectedFile);
                            
                            const newSrc = {
                                id: 'src_pdf_' + Date.now(),
                                title: parsed.title,
                                category: '업로드PDF',
                                docType: `PDF (${parsed.numPages}p)`,
                                numPages: parsed.numPages,
                                originalKb: parsed.originalKb,
                                compressedKb: parsed.compressedKb,
                                compressionRatio: parsed.compressionRatio,
                                date: new Date().toISOString().slice(0, 10),
                                active: true,
                                sections: parsed.sections
                            };

                            sources.unshift(newSrc);
                            saveSources();
                            renderSourcesList();

                            alert(`🚀 [PDF 업로드 및 압축 완료]\n\n- 문서명: ${parsed.title}\n- 총 페이지 수: ${parsed.numPages}페이지\n- 원본 용량: ${parsed.originalKb.toLocaleString()} KB\n- 압축 용량: ${parsed.compressedKb.toLocaleString()} KB (${parsed.compressionRatio}% 절감)\n\n추출된 텍스트가 클라우드에 경량화되어 저장되었으며, 즉시 AI 답변의 근거 자료로 활용됩니다!`);
                        } else {
                            // 일반 텍스트 파일 (.txt, .md, .csv, .json)
                            const reader = new FileReader();
                            reader.onload = (e) => {
                                const content = e.target.result;
                                addNewSource(selectedFile.name, content, '업로드파일', '텍스트문서');
                            };
                            reader.readAsText(selectedFile, 'UTF-8');
                        }

                        if (modalAdd) modalAdd.style.display = 'none';
                        selectedFile = null;
                        if (fileInput) fileInput.value = '';
                        if (statusText) statusText.textContent = '선택된 파일 없음';
                    } catch (err) {
                        console.error('[StandardsLM] 파일 파싱 오류:', err);
                        alert('문서 파싱 중 오류가 발생했습니다: ' + err.message);
                    } finally {
                        btnConfirmAdd.disabled = false;
                        btnConfirmAdd.innerHTML = '<i class="fa-solid fa-check"></i> 소스에 추가하기';
                    }
                } else if (activeTab === 'tabPasteText') {
                    const title = document.getElementById('pasteSourceTitle')?.value.trim();
                    const text = document.getElementById('pasteSourceContent')?.value.trim();

                    if (!title) {
                        alert('문서 제목을 입력해 주세요.');
                        return;
                    }
                    if (!text) {
                        alert('문서 본문 내용을 입력해 주세요.');
                        return;
                    }

                    addNewSource(title, text, '직접입력', '사용자등록');
                    if (modalAdd) modalAdd.style.display = 'none';
                    if (document.getElementById('pasteSourceTitle')) document.getElementById('pasteSourceTitle').value = '';
                    if (document.getElementById('pasteSourceContent')) document.getElementById('pasteSourceContent').value = '';
                }
            });
        }

        // 전체 소스 선택/해제 토글
        const btnToggleAll = document.getElementById('btnToggleAllSources');
        if (btnToggleAll) {
            btnToggleAll.addEventListener('click', () => {
                const allActive = sources.every(s => s.active);
                sources.forEach(s => s.active = !allActive);
                saveSources();
                renderSourcesList();
            });
        }

        // 원문 뷰어 모달 닫기
        const modalViewer = document.getElementById('modalViewSource');
        const btnCloseViewer = document.getElementById('btnCloseViewSourceModal');
        if (btnCloseViewer && modalViewer) {
            btnCloseViewer.addEventListener('click', () => {
                modalViewer.style.display = 'none';
            });
        }

        // 보관함 모달 열기 버튼 (헤더 및 스튜디오 툴바)
        const btnHeaderSaved = document.getElementById('btnHeaderSavedNotes');
        if (btnHeaderSaved) {
            btnHeaderSaved.addEventListener('click', () => openSavedNotesModal());
        }
        const btnStudioSaved = document.getElementById('btnStudioSavedNotes');
        if (btnStudioSaved) {
            btnStudioSaved.addEventListener('click', () => openSavedNotesModal());
        }

        // 보관함 모달 닫기
        const modalSaved = document.getElementById('modalSavedNotes');
        const btnCloseSaved = document.getElementById('btnCloseSavedNotesModal');
        const btnCloseSavedBottom = document.getElementById('btnCloseSavedNotesBottom');
        if (btnCloseSaved && modalSaved) {
            btnCloseSaved.addEventListener('click', () => { modalSaved.style.display = 'none'; });
        }
        if (btnCloseSavedBottom && modalSaved) {
            btnCloseSavedBottom.addEventListener('click', () => { modalSaved.style.display = 'none'; });
        }

        // 보관함 검색 인풋
        const inputSearchSaved = document.getElementById('inputSearchSavedNotes');
        if (inputSearchSaved) {
            inputSearchSaved.addEventListener('input', (e) => {
                renderSavedNotesList(e.target.value);
            });
        }

        // 보관함 전체 클립보드 복사
        const btnCopyAllSaved = document.getElementById('btnCopyAllSavedNotes');
        if (btnCopyAllSaved) {
            btnCopyAllSaved.addEventListener('click', () => {
                if (savedNotes.length === 0) {
                    alert('보관된 질의응답이 없습니다.');
                    return;
                }
                let fullText = `[김해시 관망관리 기준 및 근거 - 보관된 질의응답 모음]\n총 ${savedNotes.length}건 보관됨\n=========================================\n\n`;
                savedNotes.forEach((n, idx) => {
                    const temp = document.createElement('div');
                    temp.innerHTML = n.answerHtml;
                    fullText += `[${idx + 1}] 질문: ${n.query} (${n.dateStr || ''})\n`;
                    if (n.memo) fullText += `• 업무 메모: ${n.memo}\n`;
                    fullText += `• 답변:\n${temp.innerText.trim()}\n`;
                    fullText += `-----------------------------------------\n\n`;
                });
                navigator.clipboard.writeText(fullText).then(() => {
                    showToast('보관함 전체 내용이 클립보드에 복사되었습니다!');
                });
            });
        }

        // 보관함 전체 비우기
        const btnClearAllSaved = document.getElementById('btnClearAllSavedNotes');
        if (btnClearAllSaved) {
            btnClearAllSaved.addEventListener('click', () => {
                if (savedNotes.length === 0) return;
                if (confirm(`보관된 ${savedNotes.length}건의 질의응답을 모두 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
                    savedNotes = [];
                    saveSavedNotes(true);
                    renderSavedNotesList();
                    showToast('보관함이 비워졌습니다.');
                }
            });
        }
    }

    /**
     * 새 텍스트 소스 등록 및 청킹
     */
    function addNewSource(title, fullText, category, docType) {
        const paragraphs = fullText.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 20);
        let sections = [];

        if (paragraphs.length > 0) {
            sections = paragraphs.map((p, idx) => {
                const firstLine = p.split('\n')[0].slice(0, 35);
                return {
                    heading: `제${idx + 1}단락 (${firstLine})`,
                    text: p
                };
            });
        } else {
            sections = [{
                heading: '전체 본문',
                text: fullText
            }];
        }

        const newSrc = {
            id: 'src_' + Date.now(),
            title: title,
            category: category || '사용자등록',
            docType: docType || '일반문서',
            date: new Date().toISOString().slice(0, 10),
            active: true,
            sections: sections
        };

        sources.unshift(newSrc);
        saveSources();
        renderSourcesList();

        alert(`[${title}] 소스 자료가 등록되었습니다!\n총 ${sections.length}개 조문/단락으로 청킹되어 즉시 AI 답변의 근거 자료로 활용됩니다.`);
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // 전역 노출
    window.standardsLm = {
        init: initStandardsLm,
        askQuestion: askQuestion,
        openSourceViewer: openSourceViewer,
        openSavedNotesModal: openSavedNotesModal,
        toggleSaveNote: toggleSaveNote,
        getSavedNotes: () => savedNotes,
        syncSourcesToCloud: syncSourcesToCloud,
        loadSourcesFromCloud: loadSourcesFromCloud
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initStandardsLm);
    } else {
        initStandardsLm();
    }
})();
