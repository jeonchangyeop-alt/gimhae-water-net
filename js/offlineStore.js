/**
 * 김해관망관리 - 오프라인 영속 저장소 (IndexedDB 기반)
 * 1. 통신이 두절되거나 창을 닫아도 조사 데이터와 사진이 100% 보존됨
 * 2. 조사 상태: DRAFT(임시), READY(전송대기), SYNCED(서버동기화완료)
 * 3. 시설물 기본 정보 수정 이력(Modified Attributes) 보존
 */

class OfflineStore {
    constructor() {
        this.dbName = 'GimhaeWaterNetworkDB';
        this.dbVersion = 1;
        this.db = null;
    }

    /**
     * DB 초기화
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // 1. 현장 조사 이력 저장소
                if (!db.objectStoreNames.contains('surveys')) {
                    const surveyStore = db.createObjectStore('surveys', { keyPath: 'surveyId' });
                    surveyStore.createIndex('facilityId', 'facilityId', { unique: false });
                    surveyStore.createIndex('syncStatus', 'syncStatus', { unique: false });
                    surveyStore.createIndex('createdAt', 'createdAt', { unique: false });
                }

                // 2. 시설물 속성 수정 이력 저장소 (기본데이터 수정분)
                if (!db.objectStoreNames.contains('facilityModifications')) {
                    const modStore = db.createObjectStore('facilityModifications', { keyPath: 'facilityId' });
                    modStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error("IndexedDB 열기 실패:", event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * 조사 저장 (사진 포함)
     */
    async saveSurvey(survey) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['surveys'], 'readwrite');
            const store = tx.objectStore('surveys');
            
            const record = {
                surveyId: survey.surveyId || 'SRV-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
                facilityId: survey.facilityId,
                facilityName: survey.facilityName,
                facilityType: survey.facilityType,
                blockCode: survey.blockCode,
                surveyor: survey.surveyor || '현장조사원',
                surveyType: survey.surveyType,
                data: survey.data || {},
                photos: survey.photos || [], // { id, thumb, blob, meta }
                syncStatus: 'LOCAL_SAVED', // LOCAL_SAVED, SYNCING, SYNCED
                createdAt: survey.createdAt || new Date().toISOString()
            };

            const req = store.put(record);
            req.onsuccess = () => resolve(record);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    /**
     * 전체 조사 내역 조회
     */
    async getAllSurveys() {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['surveys'], 'readonly');
            const store = tx.objectStore('surveys');
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    /**
     * 특정 시설물의 조사 내역 조회
     */
    async getSurveysByFacility(facilityId) {
        const all = await this.getAllSurveys();
        return all.filter(s => s.facilityId === facilityId);
    }

    /**
     * 시설물 기본속성 수정사항 저장
     */
    async saveFacilityModification(facilityId, newAttributes) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['facilityModifications'], 'readwrite');
            const store = tx.objectStore('facilityModifications');
            const record = {
                facilityId,
                attributes: newAttributes,
                updatedAt: new Date().toISOString()
            };
            const req = store.put(record);
            req.onsuccess = () => resolve(record);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    /**
     * 전체 시설물 수정사항 조회
     */
    async getAllFacilityModifications() {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['facilityModifications'], 'readonly');
            const store = tx.objectStore('facilityModifications');
            const req = store.getAll();
            req.onsuccess = () => {
                const map = {};
                (req.result || []).forEach(item => {
                    map[item.facilityId] = item.attributes;
                });
                resolve(map);
            };
            req.onerror = (e) => reject(e.target.error);
        });
    }

    /**
     * 동기화 상태 갱신 (서버 저장 시뮬레이션용)
     */
    async updateSyncStatus(surveyId, status) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['surveys'], 'readwrite');
            const store = tx.objectStore('surveys');
            const getReq = store.get(surveyId);

            getReq.onsuccess = () => {
                const record = getReq.result;
                if (!record) return resolve(null);
                record.syncStatus = status;
                const putReq = store.put(record);
                putReq.onsuccess = () => resolve(record);
                putReq.onerror = (e) => reject(e.target.error);
            };
            getReq.onerror = (e) => reject(e.target.error);
        });
    }

    /**
     * 백업용 전체 데이터 내보내기 (JSON 형식)
     */
    async exportBackupData() {
        const surveys = await this.getAllSurveys();
        const mods = await this.getAllFacilityModifications();
        
        // Blob 데이터는 JSON으로 직접 안 들어가므로 메타만 직렬화
        const sanitizedSurveys = surveys.map(s => ({
            ...s,
            photos: s.photos.map(p => ({
                id: p.id,
                thumb: p.thumb,
                meta: p.meta
            }))
        }));

        return {
            exportDate: new Date().toISOString(),
            surveysCount: sanitizedSurveys.length,
            surveys: sanitizedSurveys,
            modifications: mods
        };
    }
}

window.offlineStore = new OfflineStore();
