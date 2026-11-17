/**
 * 김해시 상수도 공급 계통도 대화형 캔버스 엔진 (Topology Canvas Engine)
 * 
 * 1. SVG 기반 사각 박스(Node) 및 연결선(Edge) 렌더링
 * 2. 상위 블록 드래그 시 하위 종속 블록 일괄 동반 이동 (Hierarchical Subtree Drag)
 * 3. 종속 블록 연결 (뒤로 넣고넣고 - Connect Edge)
 * 4. 검색창 실시간 타이핑 추천 & 키보드 방향키(ArrowDown, ArrowUp, Enter, Esc) 탐색
 * 5. 마우스 휠 조작 분리:
 *    - [Ctrl + 휠]: 축척 확대 / 축소 (Zoom towards cursor)
 *    - [그냥 휠]: 위 / 아래 스크롤 이동 (Vertical Pan)
 *    - [Shift + 휠]: 좌 / 우 스크롤 이동 (Horizontal Pan)
 * 6. 실행 취소 (Undo - Ctrl+Z) 및 다시 실행 (Redo - Ctrl+Y)
 */

class TopologyCanvasManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.currentRegion = 'myeongdong'; // 'myeongdong' | 'samgye' | 'deoksan'
        
        // 로컬스토리지에 저장된 사용자 편집본이 있으면 불러오기
        const saved = localStorage.getItem('KIMHAE_TOPOLOGY_CUSTOM_' + this.currentRegion);
        if (saved) {
            try {
                this.data = JSON.parse(saved);
            } catch (e) {
                this.data = JSON.parse(JSON.stringify(window.KIMHAE_TOPOLOGY_DATA[this.currentRegion]));
            }
        } else {
            this.data = JSON.parse(JSON.stringify(window.KIMHAE_TOPOLOGY_DATA[this.currentRegion]));
        }
        
        this.scale = 0.9;
        this.panX = 40;
        this.panY = 40;
        this.isPanning = false;
        this.startPan = { x: 0, y: 0 };

        this.selectedNode = null;
        this.draggedNode = null;
        this.dragOffset = { x: 0, y: 0 };
        this.preDragSnapshot = null; // 드래그 시작 시점 전체 스냅샷
        this.hasMovedDuringDrag = false;
        this.connectingSource = null; // 종속 연결선 잇기 모드

        // 하위 종속 블록 일괄 동반 이동 상태
        this.draggedSubtreeNodeIds = []; // 함께 이동할 하위 자손 노드 ID 목록
        this.dragStartPositions = {};    // 드래그 시작 시 각 노드의 초기 좌표 { id: {x, y} }

        // 검색창 키보드 탐색 상태
        this.searchSelectedIndex = -1;
        this.searchMatches = [];

        // 실행 취소(Undo) / 다시 실행(Redo) 스택 관리
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistory = 50;
        this.toastTimer = null;

        this.initDOM();
        this.bindEvents();
        this.render();
    }

    /**
     * DOM 툴바 및 SVG 뷰포트 초기화
     */
    initDOM() {
        this.container.innerHTML = `
            <!-- 상단 계통도 툴바 -->
            <div class="topo-toolbar">
                <div class="topo-tool-group">
                    <label class="topo-label"><i class="fa-solid fa-layer-group"></i> 권역:</label>
                    <select id="topoRegionSelect" class="topo-select">
                        <option value="myeongdong">명동권역 계통도 (진영/진례/한림/장유)</option>
                        <option value="samgye">삼계권역 계통도 (구산/내외/부원/북부/활천)</option>
                        <option value="deoksan">덕산권역 계통도 (대동/상동)</option>
                    </select>
                </div>

                <!-- 전체 블록 목록 드롭다운 (선택 시 해당 블록 위치로 이동) -->
                <div class="topo-tool-group">
                    <label class="topo-label"><i class="fa-solid fa-list-check"></i> 블록 선택:</label>
                    <select id="topoBlockSelect" class="topo-select" style="max-width:180px;">
                        <option value="">-- 블록 바로가기 --</option>
                    </select>
                </div>

                <!-- 실시간 타이핑 블록 검색 창 (연관 블록 추천 드롭다운 & 키보드 탐색) -->
                <div class="topo-search-wrap">
                    <i class="fa-solid fa-magnifying-glass topo-search-icon"></i>
                    <input type="text" id="topoSearchInput" class="topo-search-input" placeholder="블록 검색 (방향키/Enter로 선택)">
                    <div id="topoSearchResults" class="topo-search-dropdown" style="display:none;"></div>
                </div>

                <!-- 작업 도구 및 실행 취소/다시실행 버튼 그룹 -->
                <div class="topo-tool-group">
                    <button id="btnTopoUndo" class="topo-btn" title="실행 취소 (Ctrl+Z)" disabled style="opacity:0.45;">
                        <i class="fa-solid fa-rotate-left"></i> 취소
                    </button>
                    <button id="btnTopoRedo" class="topo-btn" title="다시 실행 (Ctrl+Y)" disabled style="opacity:0.45;">
                        <i class="fa-solid fa-rotate-right"></i> 다시
                    </button>

                    <button id="btnTopoAddNode" class="topo-btn primary" title="새로운 사각 블록 생성">
                        <i class="fa-solid fa-square-plus"></i> 사각 블록 추가
                    </button>
                    <button id="btnTopoConnectMode" class="topo-btn secondary" title="블록 뒤로 연결선 잇기">
                        <i class="fa-solid fa-link"></i> 종속 연결 모드
                    </button>
                    <button id="btnTopoResetZoom" class="topo-btn" title="화면 크기 맞춤">
                        <i class="fa-solid fa-arrows-to-dot"></i> 화면 맞춤
                    </button>
                    <button id="btnTopoSave" class="topo-btn success" title="수정된 계통도 브라우저 저장">
                        <i class="fa-solid fa-floppy-disk"></i> 계통도 저장
                    </button>
                </div>

                <!-- 휠 조작 안내 배지 -->
                <div class="topo-guide-badge" title="마우스 휠 조작 단축 안내">
                    <i class="fa-solid fa-mouse-pointer"></i> <span><b>상위 블록 드래그</b>: 하위 블록 함께 이동 | <b>Ctrl+휠</b>: 줌 | <b>휠</b>: 위아래 | <b>Ctrl+Z</b>: 취소</span>
                </div>
            </div>

            <!-- 계통도 SVG 캔버스 래퍼 -->
            <div id="topoViewport" class="topo-viewport">
                <svg id="topoSvg" class="topo-svg">
                    <defs>
                        <!-- 화살표 마커 (일반) -->
                        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                            <polygon points="0 0, 8 3, 0 6" fill="#64748B" />
                        </marker>
                        <!-- 화살표 마커 (선택/활성) -->
                        <marker id="arrowhead-active" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                            <polygon points="0 0, 8 3, 0 6" fill="#2563EB" />
                        </marker>
                    </defs>
                    <g id="topoScene"></g>
                </svg>
            </div>
        `;

        this.populateBlockDropdown();
    }

    /**
     * 블록 드롭다운 채우기
     */
    populateBlockDropdown() {
        const select = document.getElementById('topoBlockSelect');
        if (!select) return;

        select.innerHTML = '<option value="">-- 블록 바로가기 --</option>';

        const sortedNodes = [...this.data.nodes].sort((a, b) => {
            const order = { 'MAJOR': 1, 'MID': 2, 'SUB': 3, 'FACILITY': 4 };
            return (order[a.type] || 9) - (order[b.type] || 9) || a.label.localeCompare(b.label);
        });

        sortedNodes.forEach(n => {
            const opt = document.createElement('option');
            opt.value = n.id;
            const typeText = n.type === 'SUB' ? '소블록' : n.type === 'MID' ? '중블록' : n.type === 'MAJOR' ? '대블록' : '시설/수용가';
            opt.textContent = `[${typeText}] ${n.label}`;
            select.appendChild(opt);
        });
    }

    /**
     * 특정 상위 노드에 딸린 모든 하위 종속 자손 노드 ID 목록을 BFS로 탐색
     */
    getSubtreeNodeIds(startNodeId) {
        const descendantIds = new Set();
        const queue = [startNodeId];
        const visited = new Set([startNodeId]);

        // 인접 리스트 (from -> [to1, to2, ...])
        const adj = {};
        this.data.edges.forEach(e => {
            if (!adj[e.from]) adj[e.from] = [];
            adj[e.from].push(e.to);
        });

        while (queue.length > 0) {
            const curr = queue.shift();
            const children = adj[curr] || [];
            for (const childId of children) {
                if (!visited.has(childId)) {
                    visited.add(childId);
                    descendantIds.add(childId);
                    queue.push(childId);
                }
            }
        }

        return Array.from(descendantIds);
    }

    /**
     * 상태 변경 전 스냅샷 저장 (Undo Stack 보관)
     */
    pushHistory() {
        const currentJson = JSON.stringify(this.data);
        if (this.undoStack.length > 0 && this.undoStack[this.undoStack.length - 1] === currentJson) {
            return;
        }
        this.undoStack.push(currentJson);
        if (this.undoStack.length > this.maxHistory) {
            this.undoStack.shift();
        }
        this.redoStack = [];
        this.updateUndoRedoBtnState();
    }

    /**
     * 실행 취소 (Undo - Ctrl+Z)
     */
    undo() {
        if (this.undoStack.length === 0) {
            this.showToast("실행 취소할 이전 작업이 없습니다.");
            return;
        }
        this.redoStack.push(JSON.stringify(this.data));
        const prevState = JSON.parse(this.undoStack.pop());
        this.data = prevState;
        this.selectedNode = null;
        this.draggedSubtreeNodeIds = [];
        this.populateBlockDropdown();
        this.render();
        this.updateUndoRedoBtnState();
        this.showToast("↩️ 실행 취소 완료 (Ctrl+Z)");
    }

    /**
     * 다시 실행 (Redo - Ctrl+Y)
     */
    redo() {
        if (this.redoStack.length === 0) {
            this.showToast("다시 실행할 작업이 없습니다.");
            return;
        }
        this.undoStack.push(JSON.stringify(this.data));
        const nextState = JSON.parse(this.redoStack.pop());
        this.data = nextState;
        this.selectedNode = null;
        this.draggedSubtreeNodeIds = [];
        this.populateBlockDropdown();
        this.render();
        this.updateUndoRedoBtnState();
        this.showToast("↪️ 다시 실행 완료 (Ctrl+Y)");
    }

    /**
     * 취소 / 다시 실행 버튼 활성화 상태 동기화
     */
    updateUndoRedoBtnState() {
        const btnUndo = document.getElementById('btnTopoUndo');
        const btnRedo = document.getElementById('btnTopoRedo');
        if (btnUndo) {
            btnUndo.disabled = this.undoStack.length === 0;
            btnUndo.style.opacity = this.undoStack.length === 0 ? '0.45' : '1';
            btnUndo.style.cursor = this.undoStack.length === 0 ? 'not-allowed' : 'pointer';
        }
        if (btnRedo) {
            btnRedo.disabled = this.redoStack.length === 0;
            btnRedo.style.opacity = this.redoStack.length === 0 ? '0.45' : '1';
            btnRedo.style.cursor = this.redoStack.length === 0 ? 'not-allowed' : 'pointer';
        }
    }

    /**
     * 사용자 액션 토스트 알림 표시
     */
    showToast(message) {
        let toast = document.getElementById('topoToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'topoToast';
            toast.className = 'topo-toast';
            document.body.appendChild(toast);
        }
        toast.innerHTML = message;
        toast.classList.add('show');
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, 1800);
    }

    /**
     * 이벤트 바인딩 (휠, 키보드, 마우스 드래그, 검색창 탐색)
     */
    bindEvents() {
        const viewport = document.getElementById('topoViewport');
        const regionSelect = document.getElementById('topoRegionSelect');
        const blockSelect = document.getElementById('topoBlockSelect');
        const searchInput = document.getElementById('topoSearchInput');

        // 1. 권역 변경
        regionSelect.addEventListener('change', (e) => {
            this.switchRegion(e.target.value);
        });

        // 2. 블록 드롭다운 선택 시 해당 블록 포커스
        if (blockSelect) {
            blockSelect.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.focusNode(e.target.value);
                }
            });
        }

        // 3. 실시간 타이핑 블록 검색
        searchInput.addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });

        // 3-1. 검색창 키보드 방향키(ArrowDown, ArrowUp, Enter, Esc) 탐색
        searchInput.addEventListener('keydown', (e) => {
            const dropdown = document.getElementById('topoSearchResults');
            const isDropdownVisible = dropdown && dropdown.style.display !== 'none' && this.searchMatches && this.searchMatches.length > 0;

            if (!isDropdownVisible) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const nextIdx = (this.searchSelectedIndex + 1) % this.searchMatches.length;
                this.setSearchActiveIndex(nextIdx);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prevIdx = this.searchSelectedIndex <= 0 ? this.searchMatches.length - 1 : this.searchSelectedIndex - 1;
                this.setSearchActiveIndex(prevIdx);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (this.searchSelectedIndex >= 0 && this.searchSelectedIndex < this.searchMatches.length) {
                    const match = this.searchMatches[this.searchSelectedIndex];
                    this.selectSearchItem(match.id, match.regionKey);
                } else if (this.searchMatches.length > 0) {
                    // 미선택 상태에서 Enter 시 1순위 결과 바로 선택
                    const match = this.searchMatches[0];
                    this.selectSearchItem(match.id, match.regionKey);
                }
            } else if (e.key === 'Escape') {
                dropdown.style.display = 'none';
                this.searchSelectedIndex = -1;
            }
        });

        // 3-2. 검색창 바깥 클릭 시 드롭다운 닫기
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.topo-search-wrap')) {
                const dropdown = document.getElementById('topoSearchResults');
                if (dropdown) dropdown.style.display = 'none';
                this.searchSelectedIndex = -1;
            }
        });

        // 4. 마우스 팬(Pan) 이동 시작
        viewport.addEventListener('mousedown', (e) => {
            if (e.target.closest('.topo-node-item')) return; // 노드 클릭 시 팬 제외
            this.isPanning = true;
            this.startPan = { x: e.clientX - this.panX, y: e.clientY - this.panY };
            viewport.style.cursor = 'grabbing';
        });

        // 5. 마우스 이동 (팬 이동 또는 상위+하위 노드 동반 드래그)
        window.addEventListener('mousemove', (e) => {
            if (this.isPanning) {
                this.panX = e.clientX - this.startPan.x;
                this.panY = e.clientY - this.startPan.y;
                this.updateTransform();
            } else if (this.draggedNode) {
                const rect = viewport.getBoundingClientRect();
                const mouseX = (e.clientX - rect.left - this.panX) / this.scale;
                const mouseY = (e.clientY - rect.top - this.panY) / this.scale;
                
                const newX = Math.round(mouseX - this.dragOffset.x);
                const newY = Math.round(mouseY - this.dragOffset.y);

                const initPos = this.dragStartPositions[this.draggedNode.id];
                const dx = initPos ? (newX - initPos.x) : (newX - this.draggedNode.x);
                const dy = initPos ? (newY - initPos.y) : (newY - this.draggedNode.y);

                // 1. 메인 드래그 대상 상위 노드 이동
                this.draggedNode.x = newX;
                this.draggedNode.y = newY;

                // 2. 그 하위에 딸린 모든 종속 노드들도 동일한 변위(dx, dy)만큼 동반 이동!
                if (this.draggedSubtreeNodeIds && this.draggedSubtreeNodeIds.length > 0) {
                    this.draggedSubtreeNodeIds.forEach(childId => {
                        const childNode = this.data.nodes.find(n => n.id === childId);
                        const childInit = this.dragStartPositions[childId];
                        if (childNode && childInit) {
                            childNode.x = Math.round(childInit.x + dx);
                            childNode.y = Math.round(childInit.y + dy);
                        }
                    });
                }

                this.hasMovedDuringDrag = true;
                this.render();
            }
        });

        // 6. 마우스 뗌 (드래그 종료 및 Undo 스택 기록)
        window.addEventListener('mouseup', () => {
            if (this.draggedNode && this.hasMovedDuringDrag && this.preDragSnapshot) {
                const currentJson = JSON.stringify(this.data);
                if (currentJson !== this.preDragSnapshot) {
                    this.undoStack.push(this.preDragSnapshot);
                    if (this.undoStack.length > this.maxHistory) {
                        this.undoStack.shift();
                    }
                    this.redoStack = [];
                    this.updateUndoRedoBtnState();

                    // 하위 노드 동반 이동 완료 안내 토스트
                    if (this.draggedSubtreeNodeIds && this.draggedSubtreeNodeIds.length > 0) {
                        this.showToast(`[${this.draggedNode.label}] 및 하위 ${this.draggedSubtreeNodeIds.length}개 블록 함께 이동 완료`);
                    }
                }
            }
            this.isPanning = false;
            this.draggedNode = null;
            this.draggedSubtreeNodeIds = [];
            this.dragStartPositions = {};
            this.preDragSnapshot = null;
            this.hasMovedDuringDrag = false;
            viewport.style.cursor = 'default';
        });

        // 7. 마우스 휠 조작 분리:
        //    - [Ctrl + 휠]: 축척 확대 / 축소 (Zoom towards pointer)
        //    - [그냥 휠]: 위 / 아래 화면 스크롤 (Vertical Pan)
        //    - [Shift + 휠]: 좌 / 우 화면 스크롤 (Horizontal Pan)
        viewport.addEventListener('wheel', (e) => {
            e.preventDefault();

            if (e.ctrlKey || e.metaKey) {
                // [Ctrl + 휠]: 축척 확대 / 축소
                const rect = viewport.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;

                const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
                const newScale = Math.min(Math.max(0.2, this.scale * zoomFactor), 3.0);

                // 마우스 커서 위치를 축으로 자연스러운 줌 인/아웃
                this.panX = mouseX - (mouseX - this.panX) * (newScale / this.scale);
                this.panY = mouseY - (mouseY - this.panY) * (newScale / this.scale);
                this.scale = newScale;
                this.updateTransform();
            } else if (e.shiftKey) {
                // [Shift + 휠]: 좌 / 우 이동
                const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
                this.panX -= delta * 0.9;
                this.updateTransform();
            } else {
                // [그냥 휠]: 위 / 아래 스크롤 이동
                this.panY -= e.deltaY * 0.9;
                this.updateTransform();
            }
        }, { passive: false });

        // 8. 키보드 단축키 이벤트 (Ctrl+Z: 취소, Ctrl+Y: 다시실행)
        window.addEventListener('keydown', (e) => {
            const topoContainer = document.getElementById('topologyViewContainer');
            if (!topoContainer || topoContainer.style.display === 'none') return;

            // 입력창에 포커스되어 있을 때는 기본 텍스트 편집기 기능 우선
            const activeEl = document.activeElement;
            if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
                return;
            }

            const isCtrl = e.ctrlKey || e.metaKey;

            // Ctrl + Z: 실행 취소
            if (isCtrl && e.key.toLowerCase() === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.undo();
                return;
            }

            // Ctrl + Y 또는 Ctrl + Shift + Z: 다시 실행
            if (isCtrl && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
                e.preventDefault();
                this.redo();
                return;
            }

            // Delete 키: 선택된 블록 삭제
            if (e.key === 'Delete') {
                if (this.selectedNode) {
                    e.preventDefault();
                    this.deleteSelectedNode();
                }
            }
        });

        // 9. 버튼 이벤트 바인딩
        document.getElementById('btnTopoUndo').addEventListener('click', () => this.undo());
        document.getElementById('btnTopoRedo').addEventListener('click', () => this.redo());
        document.getElementById('btnTopoAddNode').addEventListener('click', () => this.addNewNode());
        document.getElementById('btnTopoConnectMode').addEventListener('click', (e) => this.toggleConnectMode(e.currentTarget));
        document.getElementById('btnTopoResetZoom').addEventListener('click', () => this.resetView());
        document.getElementById('btnTopoSave').addEventListener('click', () => this.saveTopology());
    }

    /**
     * 권역 전환
     */
    switchRegion(regionKey) {
        this.currentRegion = regionKey;

        const saved = localStorage.getItem('KIMHAE_TOPOLOGY_CUSTOM_' + this.currentRegion);
        if (saved) {
            try {
                this.data = JSON.parse(saved);
            } catch (e) {
                this.data = JSON.parse(JSON.stringify(window.KIMHAE_TOPOLOGY_DATA[regionKey]));
            }
        } else {
            this.data = JSON.parse(JSON.stringify(window.KIMHAE_TOPOLOGY_DATA[regionKey]));
        }

        this.undoStack = [];
        this.redoStack = [];
        this.draggedSubtreeNodeIds = [];
        this.updateUndoRedoBtnState();

        this.resetView();
        this.populateBlockDropdown();
        this.render();
    }

    /**
     * 캔버스 뷰 리셋
     */
    resetView() {
        this.scale = 0.85;
        this.panX = 50;
        this.panY = 50;
        this.updateTransform();
    }

    updateTransform() {
        const scene = document.getElementById('topoScene');
        if (scene) {
            scene.setAttribute('transform', `translate(${this.panX}, ${this.panY}) scale(${this.scale})`);
        }
    }

    /**
     * 계통도 전체 렌더링 (사각 박스 + 연결선)
     */
    render() {
        const scene = document.getElementById('topoScene');
        if (!scene) return;
        this.updateTransform();

        const nodeMap = {};
        this.data.nodes.forEach(n => nodeMap[n.id] = n);

        // 1. 연결선(Edges) 렌더링
        let edgesHtml = '<g class="topo-edges-layer">';
        this.data.edges.forEach(edge => {
            const from = nodeMap[edge.from];
            const to = nodeMap[edge.to];
            if (!from || !to) return;

            const fromW = this.getNodeWidth(from.type);
            const fromH = 42;
            const toH = 42;

            const startX = from.x + fromW;
            const startY = from.y + fromH / 2;
            const endX = to.x;
            const endY = to.y + toH / 2;

            // 계단형 직각 라인 (Orthogonal Path)
            const midX = startX + (endX - startX) / 2;
            const pathData = `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`;

            edgesHtml += `
                <path d="${pathData}" class="topo-edge-line" marker-end="url(#arrowhead)" />
            `;
        });
        edgesHtml += '</g>';

        // 2. 사각 노드(Nodes) 렌더링
        let nodesHtml = '<g class="topo-nodes-layer">';
        this.data.nodes.forEach(node => {
            const width = this.getNodeWidth(node.type);
            const height = 48;
            const colorClass = this.getNodeClass(node.type);
            const isSelected = this.selectedNode && this.selectedNode.id === node.id;
            const isChildDragging = this.draggedSubtreeNodeIds && this.draggedSubtreeNodeIds.includes(node.id);

            // 클라우드 유량 데이터 조회 (공급량 수치 확인)
            let flowText = '';
            if (window.GlobalWaterData && window.GlobalWaterData.supplyData) {
                const dates = Object.keys(window.GlobalWaterData.supplyData).sort();
                if (dates.length > 0) {
                    const latestD = dates[dates.length - 1];
                    const dayMap = window.GlobalWaterData.supplyData[latestD] || {};
                    const normName = typeof getNormalizedBlockName === 'function' ? getNormalizedBlockName(node.label) : node.label;
                    const bItem = dayMap[node.label] || dayMap[normName];
                    if (bItem && typeof bItem.totalSupply === 'number' && bItem.totalSupply > 0) {
                        flowText = `${Math.round(bItem.totalSupply).toLocaleString()} m³/d`;
                    }
                }
            }

            nodesHtml += `
                <g class="topo-node-item ${colorClass} ${isSelected ? 'selected' : ''} ${isChildDragging ? 'child-dragging' : ''}" 
                   transform="translate(${node.x}, ${node.y})" 
                   data-id="${node.id}">
                    <rect width="${width}" height="${height}" rx="6" ry="6" class="node-rect" />
                    <text x="${width / 2}" y="${flowText ? 21 : 28}" text-anchor="middle" class="node-text">${node.label}</text>
                    ${flowText ? `<text x="${width / 2}" y="38" text-anchor="middle" class="node-flow-subtext">${flowText}</text>` : ''}
                    <!-- 우측 종속 연결 포트 -->
                    <circle cx="${width}" cy="${height / 2}" r="5" class="node-connect-port" data-connect-id="${node.id}" title="클릭 후 뒤로 연결할 다음 블록을 선택하세요" />
                </g>
            `;
        });
        nodesHtml += '</g>';

        scene.innerHTML = edgesHtml + nodesHtml;

        // 노드 이벤트 바인딩
        this.bindNodeEvents();
    }

    getNodeWidth(type) {
        if (type === 'MAJOR') return 110;
        if (type === 'MID') return 115;
        if (type === 'SUB') return 100;
        return 90;
    }

    getNodeClass(type) {
        if (type === 'MAJOR') return 'node-major'; // 연보라
        if (type === 'MID') return 'node-mid';     // 연민트
        if (type === 'SUB') return 'node-sub';     // 노랑
        return 'node-facility';                    // 흰색
    }

    /**
     * 사각 노드별 마우스 이벤트 바인딩 (하위 종속 노드 연동 포함)
     */
    bindNodeEvents() {
        const scene = document.getElementById('topoScene');
        const nodeEls = scene.querySelectorAll('.topo-node-item');

        nodeEls.forEach(el => {
            const nodeId = el.dataset.id;
            const node = this.data.nodes.find(n => n.id === nodeId);

            // 마우스 드래그 시작
            el.addEventListener('mousedown', (e) => {
                if (e.target.classList.contains('node-connect-port')) return;
                e.stopPropagation();

                if (this.connectingSource) {
                    // 종속 연결 모드: 대상 노드 클릭 시 엣지 생성!
                    this.createEdge(this.connectingSource, nodeId);
                    this.connectingSource = null;
                    document.getElementById('btnTopoConnectMode').classList.remove('active');
                    return;
                }

                this.selectedNode = node;
                this.draggedNode = node;
                this.preDragSnapshot = JSON.stringify(this.data);
                this.hasMovedDuringDrag = false;

                // 🌟 상위 블록에 딸린 모든 하위 자손 블록 ID 추출
                this.draggedSubtreeNodeIds = this.getSubtreeNodeIds(node.id);

                // 드래그 시작 시점의 각 노드 기준 좌표 기억
                this.dragStartPositions = {};
                this.dragStartPositions[node.id] = { x: node.x, y: node.y };
                this.draggedSubtreeNodeIds.forEach(childId => {
                    const child = this.data.nodes.find(n => n.id === childId);
                    if (child) {
                        this.dragStartPositions[childId] = { x: child.x, y: child.y };
                    }
                });
                
                const rect = document.getElementById('topoViewport').getBoundingClientRect();
                const mouseX = (e.clientX - rect.left - this.panX) / this.scale;
                const mouseY = (e.clientY - rect.top - this.panY) / this.scale;
                this.dragOffset = { x: mouseX - node.x, y: mouseY - node.y };
                this.render();
            });

            // 연결 포트(●) 클릭 -> 종속 엣지 연결 시작
            const port = el.querySelector('.node-connect-port');
            if (port) {
                port.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.connectingSource = nodeId;
                    this.showToast(`[${node.label}] 뒤로 연결할 다음 블록을 클릭하세요.`);
                });
            }

            // 노드 더블클릭 시 이름 수정
            el.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                const newName = prompt("블록 명칭 수정:", node.label);
                if (newName && newName.trim() && newName.trim() !== node.label) {
                    this.pushHistory();
                    node.label = newName.trim();
                    this.populateBlockDropdown();
                    this.render();
                    this.showToast(`블록명이 [${node.label}]으로 수정되었습니다.`);
                }
            });
        });
    }

    /**
     * 종속 연결 엣지 생성 (부모 -> 자식 이어붙이기)
     */
    createEdge(fromId, toId) {
        if (fromId === toId) return;
        const exists = this.data.edges.some(e => e.from === fromId && e.to === toId);
        if (exists) {
            this.showToast("이미 연결되어 있는 계통 경로입니다.");
            return;
        }

        this.pushHistory();
        this.data.edges.push({ from: fromId, to: toId });
        this.render();
        this.showToast("🔗 종속 연결이 성공적으로 추가되었습니다! (Ctrl+Z 취소 가능)");
    }

    toggleConnectMode(btn) {
        if (this.connectingSource) {
            this.connectingSource = null;
            btn.classList.remove('active');
        } else {
            this.showToast("연결할 시작 블록의 우측 점(●) 또는 블록을 클릭하세요.");
            btn.classList.add('active');
        }
    }

    /**
     * 신규 사각 블록 추가
     */
    addNewNode() {
        const name = prompt("추가할 블록/시설 명칭 입력 (예: 진영8, 내외9, 가압장 등):");
        if (!name || !name.trim()) return;

        const type = prompt("블록 구분 (1: 소블록(노랑), 2: 중블록(민트), 3: 시설/수용가(흰색)):", "1");
        let nodeType = 'SUB';
        if (type === '2') nodeType = 'MID';
        else if (type === '3') nodeType = 'FACILITY';

        const newNode = {
            id: 'CUSTOM-' + Date.now(),
            label: name.trim(),
            type: nodeType,
            x: Math.round((-this.panX + 250) / this.scale),
            y: Math.round((-this.panY + 180) / this.scale)
        };

        this.pushHistory();
        this.data.nodes.push(newNode);
        this.selectedNode = newNode;
        this.populateBlockDropdown();
        this.render();
        this.showToast(`[${name}] 사각 블록이 추가되었습니다! 마우스로 원하는 위치로 배치하세요.`);
    }

    /**
     * 선택된 노드 삭제 (Delete 키)
     */
    deleteSelectedNode() {
        if (!this.selectedNode) return;
        if (confirm(`선택한 [${this.selectedNode.label}] 블록을 삭제하시겠습니까?`)) {
            this.pushHistory();
            const targetId = this.selectedNode.id;
            this.data.nodes = this.data.nodes.filter(n => n.id !== targetId);
            this.data.edges = this.data.edges.filter(e => e.from !== targetId && e.to !== targetId);
            this.selectedNode = null;
            this.populateBlockDropdown();
            this.render();
            this.showToast("블록이 삭제되었습니다. (Ctrl+Z로 되돌리기 가능)");
        }
    }

    /**
     * 실시간 블록 검색 및 드롭다운 추천 (전체 권역 지원 & 키보드 탐색)
     */
    handleSearch(query) {
        const dropdown = document.getElementById('topoSearchResults');
        if (!query || !query.trim()) {
            dropdown.style.display = 'none';
            this.searchSelectedIndex = -1;
            this.searchMatches = [];
            return;
        }

        const q = query.trim().toLowerCase();
        const matches = [];

        // 1. 현재 활성 권역에서 일치하는 노드 우선 검색
        this.data.nodes.forEach(n => {
            if (n.label.toLowerCase().includes(q)) {
                matches.push({ ...n, regionKey: this.currentRegion, isCurrentRegion: true });
            }
        });

        // 2. 다른 권역에서도 일치하는 노드 함께 검색
        if (window.KIMHAE_TOPOLOGY_DATA) {
            const regionNames = {
                myeongdong: '명동권역',
                samgye: '삼계권역',
                deoksan: '덕산권역'
            };

            Object.entries(window.KIMHAE_TOPOLOGY_DATA).forEach(([rKey, rData]) => {
                if (rKey === this.currentRegion) return;
                rData.nodes.forEach(n => {
                    if (n.label.toLowerCase().includes(q)) {
                        matches.push({
                            ...n,
                            regionKey: rKey,
                            regionTitle: regionNames[rKey] || rKey,
                            isCurrentRegion: false
                        });
                    }
                });
            });
        }

        this.searchMatches = matches;

        if (this.searchMatches.length === 0) {
            dropdown.innerHTML = '<div class="search-item-empty">일치하는 블록이 없습니다.</div>';
            dropdown.style.display = 'block';
            this.searchSelectedIndex = -1;
            return;
        }

        this.searchSelectedIndex = -1; // 초기화

        dropdown.innerHTML = this.searchMatches.map((m, idx) => `
            <div class="topo-search-item" data-id="${m.id}" data-region="${m.regionKey}" data-index="${idx}">
                <span class="search-badge ${this.getNodeClass(m.type)}"></span>
                <strong>${m.label}</strong>
                ${!m.isCurrentRegion ? `<span style="font-size:10px; background:#EEF2F6; color:#475569; padding:1px 5px; border-radius:4px; margin-left:4px;">${m.regionTitle}</span>` : ''}
                <small>(${m.type === 'SUB' ? '소블록' : m.type === 'MID' ? '중블록' : m.type === 'MAJOR' ? '대블록' : '시설/수용가'})</small>
            </div>
        `).join('');

        dropdown.style.display = 'block';

        // 마우스 호버 및 클릭 이벤트
        const items = dropdown.querySelectorAll('.topo-search-item');
        items.forEach((item, idx) => {
            item.addEventListener('mouseenter', () => {
                this.setSearchActiveIndex(idx);
            });
            item.addEventListener('click', () => {
                const targetId = item.dataset.id;
                const targetRegion = item.dataset.region;
                this.selectSearchItem(targetId, targetRegion);
            });
        });
    }

    /**
     * 검색 드롭다운 키보드 하이라이트 인덱스 지정
     */
    setSearchActiveIndex(index) {
        const dropdown = document.getElementById('topoSearchResults');
        if (!dropdown || dropdown.style.display === 'none') return;

        const items = dropdown.querySelectorAll('.topo-search-item');
        if (items.length === 0) return;

        items.forEach(el => el.classList.remove('active'));

        this.searchSelectedIndex = index;
        if (index >= 0 && index < items.length) {
            const activeItem = items[index];
            activeItem.classList.add('active');
            activeItem.scrollIntoView({ block: 'nearest' });
        }
    }

    /**
     * 검색 항목 확정 선택 및 이동 (권역 자동 전환 지원)
     */
    selectSearchItem(targetId, targetRegion) {
        const dropdown = document.getElementById('topoSearchResults');
        if (dropdown) dropdown.style.display = 'none';

        const searchInput = document.getElementById('topoSearchInput');
        if (searchInput) searchInput.value = '';

        this.searchSelectedIndex = -1;

        // 타 권역 블록인 경우 권역 자동 전환
        if (targetRegion && targetRegion !== this.currentRegion) {
            const regionSelect = document.getElementById('topoRegionSelect');
            if (regionSelect) regionSelect.value = targetRegion;
            this.switchRegion(targetRegion);
        }

        this.focusNode(targetId);
    }

    /**
     * 특정 노드로 부드럽게 캔버스 스크롤(Pan) 이동 & 하이라이트
     */
    focusNode(nodeId) {
        let node = this.data.nodes.find(n => n.id === nodeId);

        // 만약 현재 권역에 없는 경우 다른 권역에서 탐색 후 권역 전환
        if (!node && window.KIMHAE_TOPOLOGY_DATA) {
            for (const [rKey, rData] of Object.entries(window.KIMHAE_TOPOLOGY_DATA)) {
                const found = rData.nodes.find(n => n.id === nodeId);
                if (found) {
                    const regionSelect = document.getElementById('topoRegionSelect');
                    if (regionSelect) regionSelect.value = rKey;
                    this.switchRegion(rKey);
                    node = this.data.nodes.find(n => n.id === nodeId);
                    break;
                }
            }
        }

        if (!node) return;

        this.selectedNode = node;
        
        const viewport = document.getElementById('topoViewport');
        const viewW = viewport.clientWidth;
        const viewH = viewport.clientHeight;

        this.scale = 1.0;
        this.panX = viewW / 2 - (node.x + 50);
        this.panY = viewH / 2 - (node.y + 20);

        this.render();

        setTimeout(() => {
            const el = document.querySelector(`.topo-node-item[data-id="${nodeId}"]`);
            if (el) {
                el.classList.add('node-highlight-pulse');
                setTimeout(() => el.classList.remove('node-highlight-pulse'), 3000);
            }
        }, 50);
    }

    /**
     * 계통도 변경 사항 로컬 영속 저장
     */
    saveTopology() {
        const key = 'KIMHAE_TOPOLOGY_CUSTOM_' + this.currentRegion;
        localStorage.setItem(key, JSON.stringify(this.data));
        this.showToast("💾 계통도 수정 내역(블록 배치 및 연결)이 브라우저에 안전 보존되었습니다!");
    }
}

window.TopologyCanvasManager = TopologyCanvasManager;
