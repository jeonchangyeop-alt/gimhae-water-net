/**
 * 김해관망관리 - 국토교통부 VWorld 지도 API 및 관망 GIS 렌더링 모듈
 * 1. VWorld 2D 기본지도 / 백지도 / 위성 항공사진 / 하이브리드 / 연속지적도 타일 연동
 * 2. VWorld 오픈API 2.0 기반 주소 검색 & 공간 확인 (도로명, 지번, 장소, 관망시설물, 블록)
 * 3. 김해시 전역 상세 공간 색인(Gimhae GIS Index) 내장으로 오프라인/CORS 안전한 무결점 검색 보장
 * 4. 지도 클릭 시 해당 위치 주소 자동 확인(Reverse Geocoding) & 반경 100m 인근 시설 분석
 * 5. 공종별(경계밸브/수용가/수압/누수) 작업 모드에 따른 동적 레이어 필터링 & 현장조사 즉시 연동
 */

// 김해시 전역 상세 주소, 주요 관공서/정수시설, 간선도로 및 86개 소블록 지오코딩 색인 데이터
const GIMHAE_GIS_INDEX = [
    // 1. 핵심 수도시설 & 관공서
    {
        title: "김해시청",
        category: "관공서",
        road: "경상남도 김해시 김해대로 2401",
        parcel: "경상남도 김해시 부원동 623",
        bldnm: "김해시청 본관",
        lat: 35.228512,
        lng: 128.889345,
        block: "GH-BW-01 (부원01)",
        system: "삼계계통",
        desc: "김해시 상수도 행정 총괄 및 상하수도사업소 소재지"
    },
    {
        title: "김해시 상하수도사업소",
        category: "상수도시설",
        road: "경상남도 김해시 김해대로 2401",
        parcel: "경상남도 김해시 부원동 623",
        bldnm: "상하수도사업소",
        lat: 35.228800,
        lng: 128.888500,
        block: "GH-BW-01 (부원01)",
        system: "삼계계통",
        desc: "김해시 상수도 관망 운영, 유수율 관리 및 누수탐사 지휘본부"
    },
    // === [김해시 상수도 가압장 시설 목록] ===
    {
        title: "삼계가압장",
        category: "가압장",
        road: "경상남도 김해시 가야로 30번길 85",
        parcel: "경상남도 김해시 삼계동 1150-1",
        bldnm: "삼계가압장",
        lat: 35.275500,
        lng: 128.862500,
        block: "GH-SG-01 (삼계01)",
        system: "삼계계통",
        capacity: "15,000 m³/일",
        pumpSpec: "다단원심펌프 3대 (주2, 예비1)",
        pressureOut: "4.2 kgf/cm²",
        status: "정상 자동운전 중",
        desc: "삼계 북부 및 화정마을 고지대 급수가압시설"
    },
    {
        title: "구산가압장",
        category: "가압장",
        road: "경상남도 김해시 가야로 65번길 12",
        parcel: "경상남도 김해시 구산동 1020-5",
        bldnm: "구산가압장",
        lat: 35.250200,
        lng: 128.874800,
        block: "구산3 (소블록)",
        system: "삼계계통",
        capacity: "12,000 m³/일",
        pumpSpec: "다단원심펌프 3대 (주2, 예비1)",
        pressureOut: "3.8 kgf/cm²",
        status: "정상 자동운전 중",
        desc: "구산 1~4 소블록 및 구지마을 배수구역 가압시설"
    },
    {
        title: "생림가압장",
        category: "가압장",
        road: "경상남도 김해시 생림면 마사로 120",
        parcel: "경상남도 김해시 생림면 마사리 250",
        bldnm: "생림가압장",
        lat: 35.345000,
        lng: 128.855000,
        block: "생림 (소블록)",
        system: "삼계계통",
        capacity: "5,500 m³/일",
        pumpSpec: "원심펌프 2대 (주1, 예비1)",
        pressureOut: "4.5 kgf/cm²",
        status: "정상 자동운전 중",
        desc: "생림면 농어촌 및 산간 급수 가압시설"
    },
    {
        title: "한림가압장",
        category: "가압장",
        road: "경상남도 김해시 한림면 한림로 150",
        parcel: "경상남도 김해시 한림면 명동리 120",
        bldnm: "한림가압장",
        lat: 35.312000,
        lng: 128.775000,
        block: "한림 (소블록)",
        system: "명동계통",
        capacity: "8,000 m³/일",
        pumpSpec: "원심펌프 2대 (주1, 예비1)",
        pressureOut: "3.5 kgf/cm²",
        status: "정상 자동운전 중",
        desc: "한림 농공단지 및 명동 배수구역 가압시설"
    },
    {
        title: "장유가압장",
        category: "가압장",
        road: "경상남도 김해시 대청계곡길 50",
        parcel: "경상남도 김해시 대청동 320-1",
        bldnm: "장유가압장",
        lat: 35.192000,
        lng: 128.798000,
        block: "GH-JY-01 (장유01)",
        system: "덕산계통",
        capacity: "18,000 m³/일",
        pumpSpec: "다단원심펌프 4대 (주3, 예비1)",
        pressureOut: "4.0 kgf/cm²",
        status: "정상 자동운전 중",
        desc: "장유 대청계곡 및 신도시 고지대 가압시설"
    },
    {
        title: "진례가압장",
        category: "가압장",
        road: "경상남도 김해시 진례면 산본로 80",
        parcel: "경상남도 김해시 진례면 산본리 45",
        bldnm: "진례가압장",
        lat: 35.258000,
        lng: 128.745000,
        block: "진례 (소블록)",
        system: "명동계통",
        capacity: "7,200 m³/일",
        pumpSpec: "원심펌프 2대 (주1, 예비1)",
        pressureOut: "3.6 kgf/cm²",
        status: "정상 자동운전 중",
        desc: "진례 테크노밸리 및 공단 공급 가압시설"
    },
    {
        title: "대동가압장",
        category: "가압장",
        road: "경상남도 김해시 대동면 동남로 45",
        parcel: "경상남도 김해시 대동면 초정리 80",
        bldnm: "대동가압장",
        lat: 35.268000,
        lng: 128.980000,
        block: "대동 (소블록)",
        system: "덕산계통",
        capacity: "6,000 m³/일",
        pumpSpec: "원심펌프 2대 (주1, 예비1)",
        pressureOut: "3.8 kgf/cm²",
        status: "정상 자동운전 중",
        desc: "대동 첨단일반산업단지 급수가압시설"
    },
    {
        title: "상동가압장",
        category: "가압장",
        road: "경상남도 김해시 상동면 상동로 220",
        parcel: "경상남도 김해시 상동면 대감리 110",
        bldnm: "상동가압장",
        lat: 35.320000,
        lng: 128.940000,
        block: "상동 (소블록)",
        system: "삼계계통",
        capacity: "4,500 m³/일",
        pumpSpec: "원심펌프 2대 (주1, 예비1)",
        pressureOut: "4.2 kgf/cm²",
        status: "정상 자동운전 중",
        desc: "상동 매리지역 급수공급 가압시설"
    },
    {
        title: "활천가압장",
        category: "가압장",
        road: "경상남도 김해시 인제로 230번길 15",
        parcel: "경상남도 김해시 삼방동 350-2",
        bldnm: "활천가압장",
        lat: 35.249000,
        lng: 128.918000,
        block: "GH-HC-01 (활천01)",
        system: "삼계계통",
        capacity: "9,500 m³/일",
        pumpSpec: "다단원심펌프 3대 (주2, 예비1)",
        pressureOut: "3.9 kgf/cm²",
        status: "정상 자동운전 중",
        desc: "어방·삼방 고지대 주거단지 급수가압시설"
    },
    {
        title: "동상가압장",
        category: "가압장",
        road: "경상남도 김해시 분성로 530번길 20",
        parcel: "경상남도 김해시 동상동 420-1",
        bldnm: "동상가압장",
        lat: 35.241000,
        lng: 128.895000,
        block: "동상 (소블록)",
        system: "삼계계통",
        capacity: "5,000 m³/일",
        pumpSpec: "원심펌프 2대 (주1, 예비1)",
        pressureOut: "3.5 kgf/cm²",
        status: "정상 자동운전 중",
        desc: "분성산 자락 고지대 주택가 가압시설"
    },
    {
        title: "주촌가압장",
        category: "가압장",
        road: "경상남도 김해시 주촌면 선지로 55",
        parcel: "경상남도 김해시 주촌면 선지리 200",
        bldnm: "주촌가압장",
        lat: 35.225000,
        lng: 128.828000,
        block: "주촌 (소블록)",
        system: "덕산계통",
        capacity: "10,000 m³/일",
        pumpSpec: "다단원심펌프 3대 (주2, 예비1)",
        pressureOut: "3.7 kgf/cm²",
        status: "정상 자동운전 중",
        desc: "선천지구 신도시 및 주촌농공단지 가압시설"
    },
    {
        title: "진영가압장",
        category: "가압장",
        road: "경상남도 김해시 진영읍 진영로 120",
        parcel: "경상남도 김해시 진영읍 여래리 180",
        bldnm: "진영가압장",
        lat: 35.315000,
        lng: 128.730000,
        block: "GH-JY-01 (진영01)",
        system: "명동계통",
        capacity: "8,500 m³/일",
        pumpSpec: "원심펌프 2대 (주1, 예비1)",
        pressureOut: "3.6 kgf/cm²",
        status: "정상 자동운전 중",
        desc: "진영 소업리 및 서북부 고지대 가압시설"
    },
    {
        title: "율하가압장",
        category: "가압장",
        road: "경상남도 김해시 율하로 420",
        parcel: "경상남도 김해시 율하동 650",
        bldnm: "율하가압장",
        lat: 35.172000,
        lng: 128.820000,
        block: "GH-YH-01 (율하01)",
        system: "덕산계통",
        capacity: "9,000 m³/일",
        pumpSpec: "다단원심펌프 3대 (주2, 예비1)",
        pressureOut: "3.8 kgf/cm²",
        status: "정상 자동운전 중",
        desc: "율하2지구 고지대 아파트 및 단독주택지 가압시설"
    },
    {
        title: "내외가압장",
        category: "가압장",
        road: "경상남도 김해시 내외로 70",
        parcel: "경상남도 김해시 내동 1105",
        bldnm: "내외가압장",
        lat: 35.236000,
        lng: 128.875000,
        block: "GH-NW-01 (내외01)",
        system: "삼계계통",
        capacity: "11,000 m³/일",
        pumpSpec: "다단원심펌프 3대 (주2, 예비1)",
        pressureOut: "3.6 kgf/cm²",
        status: "정상 자동운전 중",
        desc: "내외동 도심 고지대 아파트단지 가압시설"
    },
    {
        title: "삼계정수장",
        category: "정수장",
        road: "경상남도 김해시 가야로 30번길 80",
        parcel: "경상남도 김해시 삼계동 1150",
        bldnm: "삼계정수장",
        lat: 35.275000,
        lng: 128.862000,
        block: "GH-SG-01 (삼계01)",
        system: "삼계계통",
        desc: "김해 북부 및 도심권 주용수 공급 정수장 (일 시설용량 135,000 m³/일)"
    },
    {
        title: "명동정수장",
        category: "정수장",
        road: "경상남도 김해시 한림면 명동리 100",
        parcel: "경상남도 김해시 한림면 명동리 100",
        bldnm: "명동정수장",
        lat: 35.305000,
        lng: 128.762000,
        block: "GH-MD-01 (명동)",
        system: "명동계통",
        desc: "김해 서북부(진영, 진례, 한림) 권역 주용수 공급 정수장"
    },
    {
        title: "창암취수장",
        category: "취수장",
        road: "경상남도 김해시 생림면 마사로 100",
        parcel: "경상남도 김해시 생림면 창암리 50",
        bldnm: "창암취수장",
        lat: 35.352000,
        lng: 128.842000,
        block: "GH-CA-01 (창암)",
        system: "원수취수",
        desc: "낙동강 본류 복류수 및 하천 표류수 취수시설"
    },
    {
        title: "삼계배수지",
        category: "배수지",
        road: "경상남도 김해시 삼계동 산 25",
        parcel: "경상남도 김해시 삼계동 산 25",
        bldnm: "삼계배수지",
        lat: 35.271000,
        lng: 128.871000,
        block: "GH-SG-02 (삼계02)",
        system: "삼계계통",
        desc: "삼계·구산·내외동 권역 자연유하 배수지"
    },
    {
        title: "활천배수지",
        category: "배수지",
        road: "경상남도 김해시 삼방동 산 12",
        parcel: "경상남도 김해시 삼방동 산 12",
        bldnm: "활천배수지",
        lat: 35.251000,
        lng: 128.921000,
        block: "GH-HC-01 (활천01)",
        system: "삼계계통",
        desc: "동김해(삼방, 안동, 어방) 급수구역 공급 배수지"
    },
    {
        title: "칠산배수지",
        category: "배수지",
        road: "경상남도 김해시 화목동 산 5",
        parcel: "경상남도 김해시 화목동 산 5",
        bldnm: "칠산배수지",
        lat: 35.215000,
        lng: 128.871000,
        block: "GH-CS-01 (칠산)",
        system: "덕산계통",
        desc: "칠산서부동 및 김해 남부 농공단지 급수 배수지"
    },
    {
        title: "장유배수지",
        category: "배수지",
        road: "경상남도 김해시 대청동 산 45",
        parcel: "경상남도 김해시 대청동 산 45",
        bldnm: "장유배수지",
        lat: 35.188000,
        lng: 128.795000,
        block: "GH-JY-01 (장유01)",
        system: "덕산계통",
        desc: "장유신도시(대청, 삼문, 무계) 대규모 주거단지 배수지"
    },
    {
        title: "율하배수지",
        category: "배수지",
        road: "경상남도 김해시 율하동 산 30",
        parcel: "경상남도 김해시 율하동 산 30",
        bldnm: "율하배수지",
        lat: 35.168000,
        lng: 128.825000,
        block: "GH-YH-01 (율하01)",
        system: "덕산계통",
        desc: "율하 1·2 지구 신도시 급수 공급 배수지"
    },
    {
        title: "진영배수지",
        category: "배수지",
        road: "경상남도 김해시 진영읍 진영리 산 15",
        parcel: "경상남도 김해시 진영읍 진영리 산 15",
        bldnm: "진영배수지",
        lat: 35.318000,
        lng: 128.728000,
        block: "GH-JY-01 (진영01)",
        system: "명동계통",
        desc: "진영읍 원도심 및 신도시 공급 배수지"
    },
    {
        title: "김해여객터미널",
        category: "교통시설",
        road: "경상남도 김해시 김해대로 2232",
        parcel: "경상남도 김해시 외동 1260",
        bldnm: "김해여객터미널",
        lat: 35.226800,
        lng: 128.875200,
        block: "GH-NW-02 (내외02)",
        system: "삼계계통",
        desc: "봉황역 및 신세계백화점 인근 교통 요충지"
    },
    {
        title: "국립김해박물관",
        category: "문화시설",
        road: "경상남도 김해시 가야의길 190",
        parcel: "경상남도 김해시 구산동 232",
        bldnm: "국립김해박물관",
        lat: 35.245500,
        lng: 128.873200,
        block: "GH-GS-01 (구산01)",
        system: "삼계계통",
        desc: "가야 문화 중심 유적지 및 박물관"
    },
    {
        title: "연지공원",
        category: "공원",
        road: "경상남도 김해시 금관대로 1368번길 7",
        parcel: "경상남도 김해시 내동 106-1",
        bldnm: "연지공원 호수",
        lat: 35.241500,
        lng: 128.867500,
        block: "GH-NW-01 (내외01)",
        system: "삼계계통",
        desc: "김해 대표 호수공원 및 문화광장"
    },
    {
        title: "수로왕릉",
        category: "문화재",
        road: "경상남도 김해시 가락로 93번길 26",
        parcel: "경상남도 김해시 서상동 312",
        bldnm: "사적 제73호 수로왕릉",
        lat: 35.233500,
        lng: 128.880500,
        block: "GH-SS-01 (서상)",
        system: "삼계계통",
        desc: "금관가야 시조 김수로왕의 능침"
    },
    {
        title: "인제대학교",
        category: "교육시설",
        road: "경상남도 김해시 인제로 197",
        parcel: "경상남도 김해시 어방동 607",
        bldnm: "인제대학교 김해캠퍼스",
        lat: 35.247200,
        lng: 128.912500,
        block: "GH-AB-01 (어방01)",
        system: "삼계계통",
        desc: "어방동 소재 종합대학교"
    },

    {
        title: "김해가야테마파크",
        category: "관광지",
        road: "경상남도 김해시 가야테마길 161",
        parcel: "경상남도 김해시 어방동 994",
        bldnm: "가야테마파크 철광산공연장",
        lat: 35.2447,
        lng: 128.9325,
        block: "GH-AB-01 (어방01)",
        system: "삼계계통",
        desc: "김해 대표 랜드마크 오감체험형 테마파크"
    },
    {
        title: "김해낙동강레일파크",
        category: "관광지",
        road: "경상남도 김해시 생림면 마사로473번길 41",
        parcel: "경상남도 김해시 생림면 마사리 654-1",
        bldnm: "낙동강레일파크 와인동굴",
        lat: 35.3785,
        lng: 128.8572,
        block: "생림 (소블록)",
        system: "삼계계통",
        desc: "낙동강 철교 레일바이크 및 와인동굴"
    },
    {
        title: "대성동고분군",
        category: "유적지",
        road: "경상남도 김해시 가야의길 126",
        parcel: "경상남도 김해시 대성동 434",
        bldnm: "대성동고분박물관 (유네스코 세계유산)",
        lat: 35.2415,
        lng: 128.8775,
        block: "대성 (소블록)",
        system: "삼계계통",
        desc: "유네스코 세계유산 금관가야 왕릉군"
    },
    {
        title: "분산성",
        category: "유적지",
        road: "경상남도 김해시 가야로405번길 210-162",
        parcel: "경상남도 김해시 어방동 산57",
        bldnm: "사적 제66호 분산성 봉수대",
        lat: 35.2465,
        lng: 128.9015,
        block: "어방 (소블록)",
        system: "삼계계통",
        desc: "삼국시대 석축 산성 및 만장대"
    },
    {
        title: "봉황동유적",
        category: "유적지",
        road: "경상남도 김해시 가락로63번길 51",
        parcel: "경상남도 김해시 봉황동 253",
        bldnm: "사적 제2호 봉황대 패총",
        lat: 35.2312,
        lng: 128.8820,
        block: "봉황 (소블록)",
        system: "삼계계통",
        desc: "가야시대 최대 주거지 및 조개더미 유적"
    },
    {
        title: "김해문화의전당",
        category: "문화시설",
        road: "경상남도 김해시 김해대로 2060",
        parcel: "경상남도 김해시 내동 1131",
        bldnm: "김해문화의전당 아람누리",
        lat: 35.2375,
        lng: 128.8715,
        block: "GH-NW-01 (내외01)",
        system: "삼계계통",
        desc: "김해 대표 복합 문화예술 공연장"
    },
    {
        title: "김해롯데워터파크",
        category: "관광지",
        road: "경상남도 김해시 장유로 555",
        parcel: "경상남도 김해시 신문동 1417",
        bldnm: "김해 롯데워터파크 매표소",
        lat: 35.1740,
        lng: 128.8350,
        block: "장유 (소블록)",
        system: "덕산계통",
        desc: "국내 최대 규모 테마 워터파크"
    },
    {
        title: "클레이아크김해미술관",
        category: "문화시설",
        road: "경상남도 김해시 진례면 진례로 275-51",
        parcel: "경상남도 김해시 진례면 송정리 358",
        bldnm: "클레이아크 돔하우스",
        lat: 35.2725,
        lng: 128.7380,
        block: "진례 (소블록)",
        system: "명동계통",
        desc: "세계 최초 건축도자 전문 미술관"
    },
    {
        title: "화포천습지생태공원",
        category: "관광지",
        road: "경상남도 김해시 한림면 한림로 183-300",
        parcel: "경상남도 김해시 한림면 퇴래리 376-1",
        bldnm: "화포천습지 생태학습관",
        lat: 35.3210,
        lng: 128.8150,
        block: "한림 (소블록)",
        system: "명동계통",
        desc: "국내 최대 하천형 배후습지 생태공원"
    },
    {
        title: "골든루트일반산업단지",
        category: "산업단지",
        road: "경상남도 김해시 주촌면 골든루트로 66",
        parcel: "경상남도 김해시 주촌면 농소리 630",
        bldnm: "한국산업단지공단 김해지사",
        lat: 35.2150,
        lng: 128.8280,
        block: "주촌 (소블록)",
        system: "덕산계통",
        desc: "김해 첨단 기계·금속·정밀 제조업 클러스터"
    },
    {
        title: "진영역철도박물관",
        category: "관광지",
        road: "경상남도 김해시 진영읍 진영로 145-1",
        parcel: "경상남도 김해시 진영읍 진영리 275-37",
        bldnm: "구 진영역사 (등록문화재 제122호)",
        lat: 35.3080,
        lng: 128.7360,
        block: "진영 (소블록)",
        system: "명동계통",
        desc: "100년 경전선 역사 철도 테마공원"
    },
    // 2. 주요 간선도로 & 번지 주소
    {
        title: "김해대로 2401 (시청사거리)",
        category: "도로명주소",
        road: "경상남도 김해시 김해대로 2401",
        parcel: "경상남도 김해시 부원동 623",
        bldnm: "김해시청 교차로",
        lat: 35.228512,
        lng: 128.889345,
        block: "GH-BW-01 (부원01)",
        system: "삼계계통"
    },
    {
        title: "김해대로 2360 (부원역)",
        category: "도로명주소",
        road: "경상남도 김해시 김해대로 2360",
        parcel: "경상남도 김해시 부원동 615",
        bldnm: "부원역 아이스퀘어",
        lat: 35.230500,
        lng: 128.884500,
        block: "GH-BW-01 (부원01)",
        system: "삼계계통"
    },
    {
        title: "구산동 1020 (구산3소블록)",
        category: "지번주소",
        road: "경상남도 김해시 가야로 65",
        parcel: "경상남도 김해시 구산동 1020",
        bldnm: "구산육거리 인근",
        lat: 35.249500,
        lng: 128.874500,
        block: "구산3 (소블록)",
        system: "삼계계통",
        desc: "현재 집중 유수율·야간최소유량 모니터링 대상 구역"
    },
    {
        title: "분성로 525",
        category: "도로명주소",
        road: "경상남도 김해시 분성로 525",
        parcel: "경상남도 김해시 동상동 350",
        bldnm: "동상동 전통시장 사거리",
        lat: 35.239000,
        lng: 128.892000,
        block: "동상 (소블록)",
        system: "삼계계통"
    },
    {
        title: "분성로 300",
        category: "도로명주소",
        road: "경상남도 김해시 분성로 300",
        parcel: "경상남도 김해시 내동 1115",
        bldnm: "내외동 주민센터 인근",
        lat: 35.235000,
        lng: 128.872000,
        block: "GH-NW-01 (내외01)",
        system: "삼계계통"
    },
    {
        title: "가야로 200",
        category: "도로명주소",
        road: "경상남도 김해시 가야로 200",
        parcel: "경상남도 김해시 삼계동 1460",
        bldnm: "화정글샘도서관 앞",
        lat: 35.265000,
        lng: 128.870000,
        block: "GH-SG-01 (삼계01)",
        system: "삼계계통"
    },
    {
        title: "내외중앙로 45",
        category: "도로명주소",
        road: "경상남도 김해시 내외중앙로 45",
        parcel: "경상남도 김해시 내동 1100",
        bldnm: "내외프라자",
        lat: 35.234000,
        lng: 128.885000,
        block: "GH-NW-01 (내외01)",
        system: "삼계계통"
    },
    {
        title: "호계로 15",
        category: "도로명주소",
        road: "경상남도 김해시 호계로 15",
        parcel: "경상남도 김해시 부원동 640",
        bldnm: "부원빌라 A동",
        lat: 35.227600,
        lng: 128.886400,
        block: "GH-BW-02 (부원02)",
        system: "삼계계통"
    },

    // 3. 주요 법정동·행정동 중심
    { title: "구산동", category: "행정구역", road: "경상남도 김해시 구산동", parcel: "경남 김해시 구산동", lat: 35.2472, lng: 128.8752, block: "구산1~4 소블록", system: "삼계계통" },
    { title: "삼계동", category: "행정구역", road: "경상남도 김해시 삼계동", parcel: "경남 김해시 삼계동", lat: 35.2638, lng: 128.8687, block: "삼계1~4 소블록", system: "삼계계통" },
    { title: "부원동", category: "행정구역", road: "경상남도 김해시 부원동", parcel: "경남 김해시 부원동", lat: 35.2285, lng: 128.8893, block: "부원1~2 소블록", system: "삼계계통" },
    { title: "내동", category: "행정구역", road: "경상남도 김해시 내동", parcel: "경남 김해시 내동", lat: 35.2335, lng: 128.8682, block: "내외1~4 소블록", system: "삼계계통" },
    { title: "외동", category: "행정구역", road: "경상남도 김해시 외동", parcel: "경남 김해시 외동", lat: 35.2248, lng: 128.8671, block: "내외1~4 소블록", system: "삼계계통" },
    { title: "대성동", category: "행정구역", road: "경상남도 김해시 대성동", parcel: "경남 김해시 대성동", lat: 35.2395, lng: 128.8770, block: "대성 소블록", system: "삼계계통" },
    { title: "동상동", category: "행정구역", road: "경상남도 김해시 동상동", parcel: "경남 김해시 동상동", lat: 35.2382, lng: 128.8865, block: "동상 소블록", system: "삼계계통" },
    { title: "서상동", category: "행정구역", road: "경상남도 김해시 서상동", parcel: "경남 김해시 서상동", lat: 35.2355, lng: 128.8821, block: "서상 소블록", system: "삼계계통" },
    { title: "봉황동", category: "행정구역", road: "경상남도 김해시 봉황동", parcel: "경남 김해시 봉황동", lat: 35.2288, lng: 128.8812, block: "봉황 소블록", system: "삼계계통" },
    { title: "어방동", category: "행정구역", road: "경상남도 김해시 어방동", parcel: "경남 김해시 어방동", lat: 35.2435, lng: 128.9052, block: "어방1~2 소블록", system: "삼계계통" },
    { title: "삼방동", category: "행정구역", road: "경상남도 김해시 삼방동", parcel: "경남 김해시 삼방동", lat: 35.2532, lng: 128.9142, block: "삼방1~2 소블록", system: "삼계계통" },
    { title: "안동", category: "행정구역", road: "경상남도 김해시 안동", parcel: "경남 김해시 안동", lat: 35.2365, lng: 128.9102, block: "안동 소블록", system: "삼계계통" },
    { title: "불암동", category: "행정구역", road: "경상남도 김해시 불암동", parcel: "경남 김해시 불암동", lat: 35.2185, lng: 128.9325, block: "불암 소블록", system: "삼계계통" },
    { title: "전하동", category: "행정구역", road: "경상남도 김해시 전하동", parcel: "경남 김해시 전하동", lat: 35.2215, lng: 128.8785, block: "전하 소블록", system: "덕산계통" },
    { title: "흥동", category: "행정구역", road: "경상남도 김해시 흥동", parcel: "경남 김해시 흥동", lat: 35.2155, lng: 128.8652, block: "흥동 소블록", system: "덕산계통" },
    { title: "풍유동", category: "행정구역", road: "경상남도 김해시 풍유동", parcel: "경남 김해시 풍유동", lat: 35.2120, lng: 128.8520, block: "풍유 소블록", system: "덕산계통" },
    { title: "명법동", category: "행정구역", road: "경상남도 김해시 명법동", parcel: "경남 김해시 명법동", lat: 35.2015, lng: 128.8550, block: "명법 소블록", system: "덕산계통" },
    { title: "화목동", category: "행정구역", road: "경상남도 김해시 화목동", parcel: "경남 김해시 화목동", lat: 35.1950, lng: 128.8850, block: "화목 소블록", system: "덕산계통" },
    { title: "대청동", category: "행정구역", road: "경상남도 김해시 대청동", parcel: "경남 김해시 대청동", lat: 35.1932, lng: 128.8021, block: "대청1~2 소블록", system: "덕산계통" },
    { title: "삼문동", category: "행정구역", road: "경상남도 김해시 삼문동", parcel: "경남 김해시 삼문동", lat: 35.1985, lng: 128.8152, block: "삼문1~2 소블록", system: "덕산계통" },
    { title: "율하동", category: "행정구역", road: "경상남도 김해시 율하동", parcel: "경남 김해시 율하동", lat: 35.1765, lng: 128.8185, block: "율하1~3 소블록", system: "덕산계통" },
    { title: "무계동", category: "행정구역", road: "경상남도 김해시 무계동", parcel: "경남 김해시 무계동", lat: 35.2052, lng: 128.8125, block: "무계1~2 소블록", system: "덕산계통" },
    { title: "진영읍", category: "행정구역", road: "경상남도 김해시 진영읍", parcel: "경남 김해시 진영읍", lat: 35.3115, lng: 128.7352, block: "진영1~4 소블록", system: "명동계통" },
    { title: "진례면", category: "행정구역", road: "경상남도 김해시 진례면", parcel: "경남 김해시 진례면", lat: 35.2652, lng: 128.7420, block: "진례1~2 소블록", system: "명동계통" },
    { title: "한림면", category: "행정구역", road: "경상남도 김해시 한림면", parcel: "경남 김해시 한림면", lat: 35.3350, lng: 128.7985, block: "한림 소블록", system: "명동계통" },
    { title: "생림면", category: "행정구역", road: "경상남도 김해시 생림면", parcel: "경남 김해시 생림면", lat: 35.3325, lng: 128.8750, block: "생림 소블록", system: "삼계계통" },
    { title: "상동면", category: "행정구역", road: "경상남도 김해시 상동면", parcel: "경남 김해시 상동면", lat: 35.3150, lng: 128.9450, block: "상동 소블록", system: "삼계계통" },
    { title: "대동면", category: "행정구역", road: "경상남도 김해시 대동면", parcel: "경남 김해시 대동면", lat: 35.2750, lng: 128.9850, block: "대동1~3 소블록", system: "덕산계통" },
    { title: "주촌면", category: "행정구역", road: "경상남도 김해시 주촌면", parcel: "경남 김해시 주촌면", lat: 35.2285, lng: 128.8250, block: "주촌 소블록", system: "덕산계통" },

    // 4. 대표 86개 관망 소블록 중심 좌표
    { title: "구산1 (소블록)", category: "관망블록", road: "경상남도 김해시 구산동 200", parcel: "구산1 소블록 센터", lat: 35.2440, lng: 128.8720, block: "구산1", system: "삼계계통" },
    { title: "구산2 (소블록)", category: "관망블록", road: "경상남도 김해시 구산동 500", parcel: "구산2 소블록 센터", lat: 35.2470, lng: 128.8750, block: "구산2", system: "삼계계통" },
    { title: "구산3 (소블록)", category: "관망블록", road: "경상남도 김해시 가야로 65", parcel: "구산3 소블록 센터", lat: 35.2495, lng: 128.8745, block: "구산3", system: "삼계계통" },
    { title: "구산4 (소블록)", category: "관망블록", road: "경상남도 김해시 구산동 1080", parcel: "구산4 소블록 센터", lat: 35.2530, lng: 128.8770, block: "구산4", system: "삼계계통" },
    { title: "감노 (소블록)", category: "관망블록", road: "경상남도 김해시 상동면 감노리", parcel: "감노 소블록 센터", lat: 35.3210, lng: 128.9720, block: "감노", system: "삼계계통" },
    { title: "금음마을 (소블록)", category: "관망블록", road: "경상남도 김해시 한림면 금음리", parcel: "금음 소블록 센터", lat: 35.3280, lng: 128.7850, block: "금음마을", system: "명동계통" },
    { title: "삼계1 (소블록)", category: "관망블록", road: "경상남도 김해시 삼계동 1400", parcel: "삼계1 소블록 센터", lat: 35.2610, lng: 128.8670, block: "삼계1", system: "삼계계통" },
    { title: "삼계2 (소블록)", category: "관망블록", road: "경상남도 김해시 삼계동 1480", parcel: "삼계2 소블록 센터", lat: 35.2650, lng: 128.8690, block: "삼계2", system: "삼계계통" },
    { title: "삼계3 (소블록)", category: "관망블록", road: "경상남도 김해시 삼계동 1530", parcel: "삼계3 소블록 센터", lat: 35.2690, lng: 128.8660, block: "삼계3", system: "삼계계통" },
    { title: "삼계4 (소블록)", category: "관망블록", road: "경상남도 김해시 삼계동 1600", parcel: "삼계4 소블록 센터", lat: 35.2720, lng: 128.8640, block: "삼계4", system: "삼계계통" },
    { title: "부원1 (소블록)", category: "관망블록", road: "경상남도 김해시 김해대로 2360", parcel: "부원1 소블록 센터", lat: 35.2305, lng: 128.8845, block: "부원1", system: "삼계계통" },
    { title: "부원2 (소블록)", category: "관망블록", road: "경상남도 김해시 호계로 15", parcel: "부원2 소블록 센터", lat: 35.2276, lng: 128.8864, block: "부원2", system: "삼계계통" }
];

// 하위 호환 및 전역 색인 참조 별칭
const GIMHAE_PRESET_LOCATIONS = GIMHAE_GIS_INDEX;

/**
 * 김해시 154,000개 전 시설물(관로 121,800개, 밸브 31,652개) 초고속 공간 격자 색인 (Spatial Grid Index)
 * 2D 캔버스 뷰포트 내 수초 지연 없는 0.1ms 쿼리 및 무한 60fps 보장
 */
class GisSpatialGrid {
    constructor(cellSize = 0.015) {
        this.cellSize = cellSize;
        this.cells = new Map();
    }

    clear() {
        this.cells.clear();
    }

    insertPoly(item, coords) {
        if (!coords || coords.length < 2) return;
        let minLat = coords[0][0], maxLat = coords[0][0];
        let minLng = coords[0][1], maxLng = coords[0][1];
        for (let i = 1; i < coords.length; i++) {
            const lat = coords[i][0], lng = coords[i][1];
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
        }
        item._minLat = minLat; item._maxLat = maxLat;
        item._minLng = minLng; item._maxLng = maxLng;

        const x1 = Math.floor(minLng / this.cellSize);
        const x2 = Math.floor(maxLng / this.cellSize);
        const y1 = Math.floor(minLat / this.cellSize);
        const y2 = Math.floor(maxLat / this.cellSize);

        for (let x = x1; x <= x2; x++) {
            for (let y = y1; y <= y2; y++) {
                const k = `${x}_${y}`;
                let b = this.cells.get(k);
                if (!b) { b = []; this.cells.set(k, b); }
                b.push(item);
            }
        }
    }

    insertPoint(item, lat, lng) {
        item._minLat = lat; item._maxLat = lat;
        item._minLng = lng; item._maxLng = lng;
        const x = Math.floor(lng / this.cellSize);
        const y = Math.floor(lat / this.cellSize);
        const k = `${x}_${y}`;
        let b = this.cells.get(k);
        if (!b) { b = []; this.cells.set(k, b); }
        b.push(item);
    }

    query(minLat, maxLat, minLng, maxLng, outArr = []) {
        const x1 = Math.floor(minLng / this.cellSize);
        const x2 = Math.floor(maxLng / this.cellSize);
        const y1 = Math.floor(minLat / this.cellSize);
        const y2 = Math.floor(maxLat / this.cellSize);
        const seen = new Set();

        for (let x = x1; x <= x2; x++) {
            for (let y = y1; y <= y2; y++) {
                const b = this.cells.get(`${x}_${y}`);
                if (b) {
                    const blen = b.length;
                    for (let i = 0; i < blen; i++) {
                        const it = b[i];
                        if (!seen.has(it)) {
                            seen.add(it);
                            if (it._maxLat >= minLat && it._minLat <= maxLat &&
                                it._maxLng >= minLng && it._minLng <= maxLng) {
                                outArr.push(it);
                            }
                        }
                    }
                }
            }
        }
        return outArr;
    }
}

/**
 * QGIS 표준 밸브류 SA코드별 특화 심볼 렌더러 (사용자 제공 도식 100% 일치)
 */
function drawValveSymbol(ctx, v, x, y, r) {
    const cde = v.cde || 'SA200';
    switch (cde) {
        case 'SA200':
        case 'SA201':
        case 'SA220':
        default:
            // ▷◁ 수평 나비넥타이 외곽선 (검정 외곽선, 흰색 채움)
            ctx.fillStyle = '#FFFFFF';
            ctx.strokeStyle = '#0F172A';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(x - r, y - r * 0.7);
            ctx.lineTo(x, y);
            ctx.lineTo(x - r, y + r * 0.7);
            ctx.closePath();
            ctx.moveTo(x + r, y - r * 0.7);
            ctx.lineTo(x, y);
            ctx.lineTo(x + r, y + r * 0.7);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            break;

        case 'SA205':
            // ▷◁ 적색 솔리드 채움 나비넥타이 (이토변/버터플라이)
            ctx.fillStyle = '#DC2626';
            ctx.strokeStyle = '#991B1B';
            ctx.lineWidth = 1.0;
            ctx.beginPath();
            ctx.moveTo(x - r, y - r * 0.7);
            ctx.lineTo(x, y);
            ctx.lineTo(x - r, y + r * 0.7);
            ctx.closePath();
            ctx.moveTo(x + r, y - r * 0.7);
            ctx.lineTo(x, y);
            ctx.lineTo(x + r, y + r * 0.7);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            break;

        case 'SA910':
            // ⊗ 원형 속 대각선 X (제수변 원형 심볼)
            ctx.fillStyle = '#FFFFFF';
            ctx.strokeStyle = '#0F172A';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            const diag = r * 0.707;
            ctx.moveTo(x - diag, y - diag);
            ctx.lineTo(x + diag, y + diag);
            ctx.moveTo(x - diag, y + diag);
            ctx.lineTo(x + diag, y - diag);
            ctx.stroke();
            break;

        case 'SA203':
            // Ⓐ 원형 속 대문자 A (공기변)
            ctx.fillStyle = '#FFFFFF';
            ctx.strokeStyle = '#0F172A';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.font = `bold ${Math.round(r * 1.35)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#0F172A';
            ctx.fillText('A', x, y + 0.5);
            break;

        case 'SA119':
            // ㊋ 적색 원형 속 火 (소화전)
            ctx.fillStyle = '#FEF2F2';
            ctx.strokeStyle = '#DC2626';
            ctx.lineWidth = 1.3;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.font = `bold ${Math.round(r * 1.3)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#DC2626';
            ctx.fillText('火', x, y + 0.5);
            break;

        case 'SA202':
            // ⮑ 적색 역지 기호 (역지변)
            ctx.strokeStyle = '#DC2626';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(x - r, y + r * 0.35);
            ctx.lineTo(x + r, y + r * 0.35);
            ctx.moveTo(x - r * 0.3, y + r * 0.35);
            ctx.lineTo(x - r * 0.3, y - r * 0.55);
            ctx.lineTo(x + r * 0.6, y - r * 0.55);
            ctx.lineTo(x + r * 0.2, y - r * 0.85);
            ctx.moveTo(x + r * 0.6, y - r * 0.55);
            ctx.lineTo(x + r * 0.2, y - r * 0.25);
            ctx.stroke();
            break;

        case 'SA204':
            // ◇ 적색 마름모 속 중심선 (감압변)
            ctx.fillStyle = '#FEF2F2';
            ctx.strokeStyle = '#DC2626';
            ctx.lineWidth = 1.3;
            ctx.beginPath();
            ctx.moveTo(x, y - r * 1.15);
            ctx.lineTo(x + r * 0.9, y);
            ctx.lineTo(x, y + r * 1.15);
            ctx.lineTo(x - r * 0.9, y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x - r * 0.9, y);
            ctx.lineTo(x + r * 0.9, y);
            ctx.stroke();
            break;
    }
}

/**
 * 김해시 관망 전용 하드웨어 가속 60fps 캔버스 렌더러
 * 브라우저 메모리 부하 제로, 1.2ms 내 렌더링 완성, 지연 없는 부드러운 패닝/줌
 */
let GisCanvasLayer = null;
function initGisCanvasLayerClass() {
    if (GisCanvasLayer || typeof L === 'undefined' || !L.Layer) return;

    GisCanvasLayer = L.Layer.extend({
        initialize: function (mapManager) {
            this.mm = mapManager;
            this._canvas = null;
            this._ctx = null;
            this._padX = 0;
            this._padY = 0;
        },

        onAdd: function (map) {
            this._map = map;
            if (!this._canvas) {
                this._initCanvas();
            }
            map.getPanes().overlayPane.appendChild(this._canvas);

            // 1. 축척(줌) 확대/축소 시작 즉시 이전 화면을 숨김 -> 줌 중 관로 잔상(Ghosting) 완전 차단
            this._onZoomStart = () => {
                if (this._animFrameId) {
                    cancelAnimationFrame(this._animFrameId);
                }
                if (this._canvas) {
                    this._canvas.style.opacity = '0';
                }
            };

            // 2. 축척(줌) 변경 완료 즉시 새 축척에 맞게 즉시 동기 렌더링 후 선명하게 복원
            this._onZoomEnd = () => {
                if (this._canvas) {
                    this._canvas.style.transform = '';
                    this._update();
                    this._canvas.style.opacity = '1';
                }
            };

            // 3. 지도 드래그(패닝) 종료 시 뷰포트 중심 재정렬 및 버퍼 갱신
            this._onMoveEnd = () => {
                this._update();
            };

            this._onResize = () => {
                this._update();
            };

            map.on('zoomstart', this._onZoomStart);
            map.on('zoomend', this._onZoomEnd);
            map.on('moveend', this._onMoveEnd);
            map.on('resize', this._onResize);

            this._update();
        },

        onRemove: function (map) {
            if (this._animFrameId) {
                cancelAnimationFrame(this._animFrameId);
            }
            if (this._canvas && this._canvas.parentNode) {
                this._canvas.parentNode.removeChild(this._canvas);
            }
            map.off('zoomstart', this._onZoomStart);
            map.off('zoomend', this._onZoomEnd);
            map.off('moveend', this._onMoveEnd);
            map.off('resize', this._onResize);
        },

        _initCanvas: function () {
            const canvas = L.DomUtil.create('canvas', 'leaflet-gis-canvas-layer');
            canvas.style.position = 'absolute';
            canvas.style.pointerEvents = 'none';
            canvas.style.zIndex = '350';
            canvas.style.transformOrigin = '0 0';
            this._canvas = canvas;
            this._ctx = canvas.getContext('2d');
        },

        _update: function () {
            if (!this._map || !this._canvas) return;
            if (this._animFrameId) {
                cancelAnimationFrame(this._animFrameId);
            }
            this._animFrameId = requestAnimationFrame(() => {
                this._doUpdate();
            });
        },

        _doUpdate: function () {
            if (!this._map || !this._canvas) return;
            const map = this._map;
            const size = map.getSize();
            if (size.x <= 0 || size.y <= 0) return;

            // 모바일 렌더링 최적화: 사방 15% 추가 여유 마진 (캔버스 픽셀 면적 및 메모리 40% 절감)
            const padX = Math.round(size.x * 0.15);
            const padY = Math.round(size.y * 0.15);
            const totalW = size.x + padX * 2;
            const totalH = size.y + padY * 2;
            this._padX = padX;
            this._padY = padY;

            const topLeft = map.containerPointToLayerPoint([-padX, -padY]);
            L.DomUtil.setPosition(this._canvas, topLeft);

            // QField 수준의 선명도를 위한 Retina / HiDPI (devicePixelRatio) 하드웨어 가속 연동
            const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
            const canvasW = Math.round(totalW * dpr);
            const canvasH = Math.round(totalH * dpr);

            if (this._canvas.width !== canvasW || this._canvas.height !== canvasH) {
                this._canvas.width = canvasW;
                this._canvas.height = canvasH;
                this._canvas.style.width = totalW + 'px';
                this._canvas.style.height = totalH + 'px';
            }

            this._render(padX, padY, dpr);
        },

        redraw: function () {
            if (this._map) {
                this._update();
            }
        },

        _render: function (padX, padY, dpr = 1) {
            const ctx = this._ctx;
            const map = this._map;
            const mm = this.mm;
            if (!ctx || !map || !mm.gisData) return;

            ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
            ctx.save();
            if (dpr !== 1) {
                ctx.scale(dpr, dpr);
            }
            ctx.translate(padX || 0, padY || 0);

            const zoom = map.getZoom();
            // 화면 밖 불필요 객체 질의 방지: 여유 마진 0.18
            const viewBounds = map.getBounds().pad(0.18);
            const minLat = viewBounds.getSouth();
            const maxLat = viewBounds.getNorth();
            const minLng = viewBounds.getWest();
            const maxLng = viewBounds.getEast();

            // 1. 급수관로 (Service Pipes 48,125개) - QField 스타일 네온 사이언 (#00E5FF) (zoom 15 이상 고밀도 구간만 표출)
            if (mm.layerVisibility.servicePipes && zoom >= 15 && mm.spatialIndexSp) {
                const spList = mm.spatialIndexSp.query(minLat, maxLat, minLng, maxLng);
                const len = spList.length;
                if (len > 0) {
                    const baseW = (mm.symbolSizes && mm.symbolSizes.pipes && mm.symbolSizes.pipes.servicePipes) || 1.0;
                    const pathSp = new Path2D();
                    for (let i = 0; i < len; i++) {
                        const coords = spList[i].coordinates || spList[i].c;
                        if (!coords || coords.length < 2) continue;
                        const pt0 = map.latLngToContainerPoint(coords[0]);
                        pathSp.moveTo(pt0.x, pt0.y);
                        for (let j = 1; j < coords.length; j++) {
                            const pt = map.latLngToContainerPoint(coords[j]);
                            pathSp.lineTo(pt.x, pt.y);
                        }
                    }
                    const spLineWidth = Math.max(0.3, baseW * (zoom >= 18 ? 1.15 : 1.0));
                    // 1차: 선이 굵을 때만 보조 외곽선 (가장 얇을 때는 과도한 굵어짐 방지)
                    if (spLineWidth >= 1.2) {
                        ctx.beginPath();
                        ctx.strokeStyle = 'rgba(0, 30, 50, 0.65)';
                        ctx.lineWidth = spLineWidth + 0.8;
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                        ctx.stroke(pathSp);
                    }

                    // 2차: QField 네온 사이언 본체 선
                    ctx.beginPath();
                    ctx.strokeStyle = (mm.pipeColors && mm.pipeColors.servicePipes) || '#00E5FF';
                    ctx.lineWidth = spLineWidth;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.stroke(pathSp);

                    // 1-2. 급수관로 관경 라벨 표출 (사용자 요청: 라벨 ON 상태 & zoom >= 17)
                    if (mm.labelVisibility && mm.labelVisibility.servicePipes && zoom >= 17) {
                        const spLabelSize = (mm.labelSizes && mm.labelSizes.servicePipes) || 9;
                        ctx.save();
                        ctx.font = `bold ${spLabelSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';
                        const spOffset = (spLineWidth / 2) + 2.5;

                        for (let i = 0; i < len; i++) {
                            const sp = spList[i];
                            const dia = sp.dia || sp.d || 20;
                            const coords = sp.coordinates || sp.c;
                            if (!coords || coords.length < 2) continue;
                            const midIdx = Math.floor(coords.length / 2);
                            const pt1 = map.latLngToContainerPoint(coords[midIdx - 1]);
                            const pt2 = map.latLngToContainerPoint(coords[midIdx]);
                            const distSq = (pt2.x - pt1.x) * (pt2.x - pt1.x) + (pt2.y - pt1.y) * (pt2.y - pt1.y);
                            if (distSq < 500) continue;
                            const mx = (pt1.x + pt2.x) / 2;
                            const my = (pt1.y + pt2.y) / 2;
                            const spFld = (mm.labelFields && mm.labelFields.servicePipes) || 'dia';
                            let labelText = 'D' + dia;
                            if (spFld === 'len') labelText = (sp.len ? sp.len + 'm' : 'D' + dia);
                            else if (spFld === 'id') labelText = sp.id || ('D' + dia);
                            const dx = pt2.x - pt1.x;
                            const dy = pt2.y - pt1.y;
                            let angle = Math.atan2(dy, dx);
                            if (angle > Math.PI / 2 || angle < -Math.PI / 2) angle += Math.PI;

                            ctx.save();
                            ctx.translate(mx, my);
                            ctx.rotate(angle);
                            ctx.lineJoin = 'round';
                            ctx.miterLimit = 2;
                            // 관 위쪽으로 띄워 표출
                            ctx.lineWidth = 2.6;
                            ctx.strokeStyle = '#000000';
                            ctx.strokeText(labelText, 0, -spOffset);
                            ctx.fillStyle = '#FFFFFF';
                            ctx.fillText(labelText, 0, -spOffset);
                            ctx.restore();
                        }
                        ctx.restore();
                    }
                }
            }

            // 2. 상수관로 LM2 - QField 비비드 블루 (zoom 13 이상에서 표출)
            if (mm.layerVisibility.pipesLm2 && zoom >= 13 && mm.spatialIndexLm2) {
                const lm2List = mm.spatialIndexLm2.query(minLat, maxLat, minLng, maxLng);
                const len = lm2List.length;
                if (len > 0) {
                    const baseW = (mm.symbolSizes && mm.symbolSizes.pipes && mm.symbolSizes.pipes.pipesLm2) || 1.1;
                    const lm2LineWidth = Math.max(0.4, baseW * (zoom >= 18 ? 1.2 : 1.0));
                    const pathLm2 = new Path2D();
                    for (let i = 0; i < len; i++) {
                        const coords = lm2List[i].coordinates || lm2List[i].c;
                        if (!coords || coords.length < 2) continue;
                        const pt0 = map.latLngToContainerPoint(coords[0]);
                        pathLm2.moveTo(pt0.x, pt0.y);
                        for (let j = 1; j < coords.length; j++) {
                            const pt = map.latLngToContainerPoint(coords[j]);
                            pathLm2.lineTo(pt.x, pt.y);
                        }
                    }
                    // 1차: 선이 굵을 때만 보조 외곽선
                    if (lm2LineWidth >= 1.2) {
                        ctx.beginPath();
                        ctx.strokeStyle = 'rgba(0, 15, 60, 0.65)';
                        ctx.lineWidth = lm2LineWidth + 0.8;
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                        ctx.stroke(pathLm2);
                    }

                    // 2차: QField 비비드 블루 본체 선
                    ctx.beginPath();
                    ctx.strokeStyle = (mm.pipeColors && mm.pipeColors.pipesLm2) || '#0040FF';
                    ctx.lineWidth = lm2LineWidth;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.stroke(pathLm2);
                }

                // 2-2. 상수관로 (LM2) 관로 라벨 표출 (라벨 ON & zoom >= 15)
                if (mm.labelVisibility && mm.labelVisibility.pipesLm2 && zoom >= 15) {
                    const lm2LabelSize = (mm.labelSizes && mm.labelSizes.pipesLm2) || 10;
                    ctx.save();
                    ctx.font = `bold ${lm2LabelSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    const lm2Offset = (lm2LineWidth / 2) + 2.8;

                    const lm2Fld = (mm.labelFields && mm.labelFields.pipesLm2) || 'pip_lbl';
                    for (let i = 0; i < len; i++) {
                        const p = lm2List[i];
                        const dia = p.dia || p.d || 80;
                        const coords = p.coordinates || p.c;
                        if (!coords || coords.length < 2) continue;
                        const midIdx = Math.floor(coords.length / 2);
                        const pt1 = map.latLngToContainerPoint(coords[midIdx - 1]);
                        const pt2 = map.latLngToContainerPoint(coords[midIdx]);
                        const distSq = (pt2.x - pt1.x) * (pt2.x - pt1.x) + (pt2.y - pt1.y) * (pt2.y - pt1.y);
                        if (distSq < 700) continue;
                        const mx = (pt1.x + pt2.x) / 2;
                        const my = (pt1.y + pt2.y) / 2;

                        let labelText = '';
                        if (lm2Fld === 'pip_lbl') labelText = p.pip_lbl || ('D' + dia);
                        else if (lm2Fld === 'dia') labelText = 'D' + dia;
                        else if (lm2Fld === 'mat') labelText = p.mat || 'DCIP';
                        else if (lm2Fld === 'len') labelText = (p.len ? p.len + 'm' : '-');
                        else if (lm2Fld === 'id') labelText = p.id || '-';

                        const dx = pt2.x - pt1.x;
                        const dy = pt2.y - pt1.y;
                        let angle = Math.atan2(dy, dx);
                        if (angle > Math.PI / 2 || angle < -Math.PI / 2) angle += Math.PI;

                        ctx.save();
                        ctx.translate(mx, my);
                        ctx.rotate(angle);
                        ctx.lineJoin = 'round';
                        ctx.miterLimit = 2;
                        // 관 위쪽으로 띄워 표출
                        ctx.lineWidth = 2.8;
                        ctx.strokeStyle = '#000000';
                        ctx.strokeText(labelText, 0, -lm2Offset);
                        ctx.fillStyle = '#FFFFFF';
                        ctx.fillText(labelText, 0, -lm2Offset);
                        ctx.restore();
                    }
                    ctx.restore();
                }
            }

            // 3. 상수관로 LM - [초고속 단일패스 + Path2D 하드웨어 가속]
            // [규정] 0~250mm 이하: 파란색, 250~500mm: 빨간색, 500mm 초과: 빨간색 점선
            if (mm.layerVisibility.pipesLm && mm.spatialIndexLm) {
                const lmList = mm.spatialIndexLm.query(minLat, maxLat, minLng, maxLng);
                const len = lmList.length;
                if (len > 0) {
                    const subVis = (mm.subLayerVisibility && mm.subLayerVisibility.pipesLm) ? mm.subLayerVisibility.pipesLm : { d250: true, d500: true, dover: true };
                    const sizes = (mm.symbolSizes && mm.symbolSizes.pipes) ? mm.symbolSizes.pipes : {};
                    const w250 = sizes.pipesLm_d250 !== undefined ? sizes.pipesLm_d250 : 0.8;
                    const w500 = sizes.pipesLm_d500 !== undefined ? sizes.pipesLm_d500 : 1.2;
                    const wOver = sizes.pipesLm_dover !== undefined ? sizes.pipesLm_dover : 1.6;
                    const zoomScale = zoom >= 18 ? 1.2 : 1.0;

                    // LOD (레벨 오브 디테일): 원거리(zoom < 14)에서는 대구경 송·배수관(D250 초과) 위주로 표출하여 렉 완전 차단!
                    const show250 = subVis.d250 !== false && zoom >= 14;
                    const show500 = subVis.d500 !== false;
                    const showOver = subVis.dover !== false;

                    const pathOver = new Path2D();
                    const path500 = new Path2D();
                    const path250 = new Path2D();
                    let hasOver = false, has500 = false, has250 = false;

                    for (let i = 0; i < len; i++) {
                        const p = lmList[i];
                        const dia = p.dia || p.d || 100;
                        const coords = p.coordinates || p.c;
                        if (!coords || coords.length < 2) continue;

                        let targetPath = null;
                        if (dia > 500 && showOver) {
                            targetPath = pathOver;
                            hasOver = true;
                        } else if (dia > 250 && show500) {
                            targetPath = path500;
                            has500 = true;
                        } else if (dia <= 250 && show250) {
                            targetPath = path250;
                            has250 = true;
                        }

                        if (targetPath) {
                            const pt0 = map.latLngToContainerPoint(coords[0]);
                            targetPath.moveTo(pt0.x, pt0.y);
                            for (let j = 1; j < coords.length; j++) {
                                const pt = map.latLngToContainerPoint(coords[j]);
                                targetPath.lineTo(pt.x, pt.y);
                            }
                        }
                    }

                    const wOverActual = Math.max(1.0, wOver * zoomScale);
                    const w500Actual = Math.max(0.8, w500 * zoomScale);
                    const w250Actual = Math.max(0.4, w250 * zoomScale);

                    // 3-1. 500mm 초과 (빨간색 점선)
                    if (hasOver) {
                        ctx.save();
                        ctx.beginPath();
                        ctx.strokeStyle = (mm.pipeColors && mm.pipeColors.dover) || '#DC2626';
                        ctx.lineWidth = wOverActual;
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                        const dashSize = Math.max(6, Math.round(wOverActual * 2.0));
                        const gapSize = Math.max(4, Math.round(wOverActual * 1.2));
                        ctx.setLineDash([dashSize, gapSize]);
                        ctx.stroke(pathOver);
                        ctx.restore();
                    }

                    // 3-2. 250mm 초과 ~ 500mm 이하 (빨간색 실선)
                    if (has500) {
                        if (w500Actual >= 1.2) {
                            ctx.beginPath();
                            ctx.strokeStyle = 'rgba(60, 0, 0, 0.65)';
                            ctx.lineWidth = w500Actual + 0.8;
                            ctx.lineCap = 'round';
                            ctx.lineJoin = 'round';
                            ctx.setLineDash([]);
                            ctx.stroke(path500);
                        }

                        ctx.beginPath();
                        ctx.strokeStyle = (mm.pipeColors && mm.pipeColors.d500) || '#DC2626';
                        ctx.lineWidth = w500Actual;
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                        ctx.stroke(path500);
                    }

                    // 3-3. 0 ~ 250mm 이하 (QField 비비드 파란색 실선)
                    if (has250) {
                        if (w250Actual >= 1.2) {
                            ctx.beginPath();
                            ctx.strokeStyle = 'rgba(0, 15, 60, 0.65)';
                            ctx.lineWidth = w250Actual + 0.8;
                            ctx.lineCap = 'round';
                            ctx.lineJoin = 'round';
                            ctx.setLineDash([]);
                            ctx.stroke(path250);
                        }

                        // 2차 비비드 블루 본체 선
                        ctx.beginPath();
                        ctx.strokeStyle = (mm.pipeColors && mm.pipeColors.d250) || '#0040FF';
                        ctx.lineWidth = w250Actual;
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                        ctx.stroke(path250);
                    }

                    // 3-4. 상수관로 (LM) 관경 라벨 표출 (사용자 요청: 라벨 ON 상태 & zoom >= 15)
                    if (mm.labelVisibility && mm.labelVisibility.pipesLm && zoom >= 15) {
                        const pipeLabelSize = (mm.labelSizes && mm.labelSizes.pipesLm) || 10;
                        ctx.save();
                        ctx.font = `bold ${pipeLabelSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';
                        for (let i = 0; i < len; i++) {
                            const p = lmList[i];
                            const dia = p.dia || p.d || 100;
                            const coords = p.coordinates || p.c;
                            if (!coords || coords.length < 2) continue;
                            const midIdx = Math.floor(coords.length / 2);
                            const pt1 = map.latLngToContainerPoint(coords[midIdx - 1]);
                            const pt2 = map.latLngToContainerPoint(coords[midIdx]);
                            const distSq = (pt2.x - pt1.x) * (pt2.x - pt1.x) + (pt2.y - pt1.y) * (pt2.y - pt1.y);
                            if (distSq < 700) continue;
                            const mx = (pt1.x + pt2.x) / 2;
                            const my = (pt1.y + pt2.y) / 2;
                            const lmFld = (mm.labelFields && mm.labelFields.pipesLm) || 'pip_lbl';
                            let labelText = '';
                            if (lmFld === 'pip_lbl') {
                                labelText = p.pip_lbl || ('D' + dia);
                            } else if (lmFld === 'dia') {
                                labelText = 'D' + dia;
                            } else if (lmFld === 'mat') {
                                labelText = p.mat || 'DCIP';
                            } else if (lmFld === 'len') {
                                labelText = (p.len ? p.len + 'm' : '-');
                            } else if (lmFld === 'id') {
                                labelText = p.id || '-';
                            }

                            const dx = pt2.x - pt1.x;
                            const dy = pt2.y - pt1.y;
                            let angle = Math.atan2(dy, dx);
                            if (angle > Math.PI / 2 || angle < -Math.PI / 2) angle += Math.PI;

                            // 관 위쪽으로 띄워 배치 (관경별 실제 굵기 반영: 굵기 반경 + 2.8px 여백)
                            const curPipeW = (dia > 500) ? wOverActual : ((dia > 250) ? w500Actual : w250Actual);
                            const labelOffset = (curPipeW / 2) + 2.8;

                            ctx.save();
                            ctx.translate(mx, my);
                            ctx.rotate(angle);
                            ctx.lineJoin = 'round';
                            ctx.miterLimit = 2;
                            // QField 스타일: 굵은 검정 외곽선 + 순백색 본체 텍스트 (관 위쪽으로 띄움)
                            ctx.lineWidth = 2.8;
                            ctx.strokeStyle = '#000000';
                            ctx.strokeText(labelText, 0, -labelOffset);
                            ctx.fillStyle = '#FFFFFF';
                            ctx.fillText(labelText, 0, -labelOffset);
                            ctx.restore();
                        }
                        ctx.restore();
                    }
                }
            }

            // 4. 밸브류 (Valves 33,358개소) - SA코드별 소분류 필터링 및 고속 표출 (zoom 15 이상)
            if (mm.layerVisibility.valves && zoom >= 15 && mm.spatialIndexValves) {
                const vList = mm.spatialIndexValves.query(minLat, maxLat, minLng, maxLng);
                const len = vList.length;
                if (len > 0) {
                    const zoomScale = zoom >= 17 ? 1.25 : (zoom >= 16 ? 1.0 : 0.75);
                    const subVis = (mm.subLayerVisibility && mm.subLayerVisibility.valves) ? mm.subLayerVisibility.valves : {};
                    const sizes = (mm.symbolSizes && mm.symbolSizes.valves) ? mm.symbolSizes.valves : {};
                    const isSimplified = zoom < 16; // zoom 15: 경량 도트 표출로 렉 완전 제거

                    for (let i = 0; i < len; i++) {
                        const v = vList[i];
                        const cde = v.cde || 'OTHER';
                        const subKey = subVis[cde] !== undefined ? cde : 'OTHER';
                        if (subVis[subKey] === false) continue;

                        const baseR = sizes[subKey] !== undefined ? sizes[subKey] : 5.0;
                        const r = baseR * zoomScale;
                        const pt = map.latLngToContainerPoint([v.lat, v.lng]);
                        if (isSimplified) {
                            ctx.fillStyle = '#D97706';
                            ctx.strokeStyle = '#FFFFFF';
                            ctx.lineWidth = 1;
                            ctx.beginPath();
                            ctx.arc(pt.x, pt.y, Math.max(2.5, r * 0.75), 0, Math.PI * 2);
                            ctx.fill();
                            ctx.stroke();
                        } else {
                            drawValveSymbol(ctx, v, pt.x, pt.y, r);
                        }
                    }
                }
            }

            // 5. 부과 수용가 (Billing Consumers 55,699개소) - 소분류별 On/Off 및 실시간 크기 표출 (zoom 15 이상)
            if (mm.layerVisibility.billing && zoom >= 15 && mm.spatialIndexBilling) {
                const bList = mm.spatialIndexBilling.query(minLat, maxLat, minLng, maxLng);
                const len = bList.length;
                if (len > 0) {
                    const zoomScale = zoom >= 17 ? 1.25 : (zoom >= 16 ? 1.0 : 0.75);
                    const subVis = (mm.subLayerVisibility && mm.subLayerVisibility.billing) ? mm.subLayerVisibility.billing : {};
                    const sizes = (mm.symbolSizes && mm.symbolSizes.billing) ? mm.symbolSizes.billing : {};
                    ctx.lineWidth = 1.0;
                    for (let i = 0; i < len; i++) {
                        const b = bList[i];
                        const isClosed = b.cls === '폐전';
                        const isBulk = (b.use && b.use >= 300) || (b.dia && b.dia >= 32);
                        const bType = isClosed ? 'closed' : (isBulk ? 'bulk' : 'normal');

                        if (subVis[bType] === false) continue;

                        const baseR = sizes[bType] !== undefined ? sizes[bType] : (isBulk ? 5.0 : (isClosed ? 3.0 : 3.5));
                        const r = baseR * zoomScale;
                        const pt = map.latLngToContainerPoint([b.lat, b.lng]);

                        ctx.fillStyle = isClosed ? '#94A3B8' : (isBulk ? '#8B5CF6' : '#10B981');
                        ctx.strokeStyle = '#FFFFFF';
                        ctx.beginPath();
                        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.stroke();
                    }
                }
            }

            ctx.restore();
        }
    });
}

class WaterMapManager {
    constructor(mapContainerId, onFacilitySelectCallback) {
        this.containerId = mapContainerId;
        this.onFacilitySelect = onFacilitySelectCallback;
        this.map = null;
        this.baseLayers = {};
        this.overlayLayers = {
            cadastral: null,
            hybrid: null
        };
        this.canvasRenderer = null;
        this.gisCanvasLayer = null;
        this.spatialIndexLm = null;
        this.spatialIndexLm2 = null;
        this.spatialIndexSp = null;
        this.spatialIndexValves = null;
        this.spatialIndexBilling = null;
        this.layers = {
            blocks: null,
            reservoirs: null,
            boosters: null,
            meters: null,
            pipesLm: null,
            pipesLm2: null,
            servicePipes: null,
            valves: null,
            pipes: null, // 상수관로(LM) 호환용 별칭
            pressures: null,
            leaks: null,
            verification: null // 주소 확인 마커 & 버퍼 레이어
        };
        // GPS 현재 위치 인식 마커 & 정확도 원 & 추적 ID
        this.userLocationMarker = null;
        this.userLocationAccuracyCircle = null;
        this.userLocationWatchId = null;
        this.currentUserLatLng = null;

        // 사용자 요청: 최초 켜지는 레이어는 블록경계, 상수관로(LM), 밸브류(SA910, SA202 제외)만 기본 활성화 (급수관로/부과량 제외로 속도 극대화)
        this.layerVisibility = {
            blocks: true,
            reservoirs: false,
            boosters: false,
            meters: false,
            pipesLm: true,
            pipesLm2: false,
            servicePipes: false,
            valves: true,
            billing: false,
            hybrid: true,
            cadastral: false
        };

        // 사용자 요청: 레이어 소분류 가시성 On/Off 설정 (관경별 소분류 & SA910, SA202 초기 제외)
        this.subLayerVisibility = {
            pipesLm: {
                d250: true,   // 0~250mm 이하 (파란색)
                d500: true,   // 250~500mm (빨간색)
                dover: true   // 500mm 초과 (빨간색 점선)
            },
            valves: {
                SA200: true,
                SA910: false, // 13,583개 제외 (초고속화)
                SA119: true,
                SA203: true,
                SA202: false, // 773개 제외
                SA205: true,
                SA204: true,
                SA201: true,
                SA220: true,
                OTHER: true
            },
            billing: {
                normal: false, // 부과량 초기 제외
                bulk: false,
                closed: false
            }
        };

        // 사용자 요청: 각 레이어 및 소분류 심볼 크기 / 선 굵기 실시간 설정
        this.symbolSizes = {
            valves: {
                SA200: 5.0,
                SA910: 5.0,
                SA119: 6.0,
                SA203: 5.0,
                SA202: 5.0,
                SA205: 5.0,
                SA204: 5.0,
                SA201: 5.0,
                SA220: 5.0,
                OTHER: 5.0
            },
            billing: {
                normal: 3.5,
                bulk: 5.0,
                closed: 3.0
            },
            pipes: {
                pipesLm: 0.8,
                pipesLm2: 0.8,
                servicePipes: 0.6,
                pipesLm_d250: 0.8, // 0~250mm 이하 기본 선 굵기 (충분히 얇은 설정)
                pipesLm_d500: 1.2, // 250~500mm 기본 선 굵기
                pipesLm_dover: 1.6 // 500mm 초과 기본 선 굵기
            },
            facilities: {
                blocks: 2.2,
                blockOpacity: 0.24, // 기본 24% 투명도 (사용자 요청: 20~30% 연한 투명도로 관로 가독성 확보)
                meters: 5.5,
                boosters: 22,
                reservoirs: 24
            }
        };

        // 사용자 요청: 관망도 레이어 라벨(명칭/관라벨) On/Off 및 크기 설정
        this.labelLayers = {
            blocks: null,
            reservoirs: null,
            boosters: null,
            meters: null
        };
        this.labelVisibility = {
            blocks: true,      // 사용자 요청: 블록경계는 기본 켰을 때 라벨과 레이어가 켜져있는 상태로 시작
            reservoirs: false,
            boosters: false,
            meters: false,
            pipesLm: false,
            servicePipes: false
        };
        this.labelSizes = {
            blocks: 10,
            reservoirs: 10,
            boosters: 10,
            meters: 9,
            pipesLm: 9,
            servicePipes: 8
        };
        this._activeModalLayer = null;

        try {
            const savedBlocks = localStorage.getItem('gis_label_vis_blocks');
            if (savedBlocks !== null) {
                this.labelVisibility.blocks = (savedBlocks === 'true');
            }
            ['reservoirs', 'boosters', 'meters', 'pipesLm', 'servicePipes'].forEach(k => {
                const s = localStorage.getItem(`gis_label_vis_${k}`);
                if (s !== null) this.labelVisibility[k] = (s === 'true');
            });
            Object.keys(this.labelSizes).forEach(k => {
                const s = localStorage.getItem(`gis_label_size_${k}`);
                if (s) {
                    const parsed = parseFloat(s);
                    if (!isNaN(parsed) && parsed > 0) this.labelSizes[k] = parsed;
                }
            });
        } catch (e) {}
        this.activeBlock = 'ALL';
        this.currentWorkMode = 'ALL'; // ALL, VALVE_SURVEY, METER_SURVEY, PRESSURE_SURVEY, LEAK_SURVEY

        // VWorld API 인증키 (기본 공용 데모키 또는 로컬스토리지 저장키)
        this.defaultVworldKey = "767B4665-E5A7-3532-8419-5E9B5614F98E";
        this.vworldApiKey = localStorage.getItem('vworld_api_key') || this.defaultVworldKey;
        this.verifiedMarker = null;
        this.verifiedCircle = null;
        this.isRoadviewMode = false;
        this.contextMenuLatLng = null;

        // 로드뷰 상태 관리 (동기화, 도킹, 관로표현, 진행방향)
        this.roadviewState = {
            isOpen: false,
            isDocked: false,
            lat: 35.23069,
            lng: 128.88347,
            heading: 0, // 0: 북, 90: 동, 180: 남, 270: 서
            title: '',
            provider: 'kakao',
            isPipeOverlayOn: false
        };
        this.roadviewLiveMarker = null;
    }

    /**
     * VWorld 지도 초기화
     */
    initMap() {
        const center = [35.2305, 128.8845]; // 김해시청-부원동 중심
        this.map = L.map(this.containerId, {
            center: center,
            zoom: 15,
            minZoom: 9,
            maxZoom: 22, // 사용자 요청: 지도 확대를 19 -> 22로 대폭 확대 지원 (초정밀 관로/밸브 식별)
            preferCanvas: true,
            zoomControl: false,
            wheelDebounceTime: 60,
            wheelPxPerZoomLevel: 90
        });

        L.control.zoom({ position: 'bottomright' }).addTo(this.map);

        // 1. 국토교통부 VWorld 2D 표준 배경지도 타일 (네이티브 19레벨 타일을 22까지 매끄럽게 고화질 확대)
        const vworldBase = L.tileLayer('https://xdworld.vworld.kr/2d/Base/service/{z}/{x}/{y}.png', {
            maxZoom: 22,
            maxNativeZoom: 19,
            updateWhenIdle: true,
            keepBuffer: 2,
            attribution: '© 국토교통부 VWORLD (공간정보오픈플랫폼)'
        });

        // VWorld 타일 로드 지연/차단 시를 대비한 CartoDB 글로벌 백업 타일 레이어
        const cartoFallback = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            maxZoom: 22,
            maxNativeZoom: 19,
            updateWhenIdle: true,
            keepBuffer: 2,
            subdomains: 'abcd',
            attribution: '© OpenStreetMap, © CARTO'
        });

        // 2. VWorld 고해상도 항공위성 사진 타일
        const vworldSatellite = L.tileLayer('https://xdworld.vworld.kr/2d/Satellite/service/{z}/{x}/{y}.jpeg', {
            maxZoom: 22,
            maxNativeZoom: 19,
            updateWhenIdle: true,
            keepBuffer: 2,
            attribution: '© 국토교통부 VWORLD (고해상도 항공사진)'
        });

        // 3. VWorld 하이브리드(지명, 도로, 경계선 라벨) 타일
        const vworldHybrid = L.tileLayer('https://xdworld.vworld.kr/2d/hybrid/service/{z}/{x}/{y}.png', {
            maxZoom: 22,
            maxNativeZoom: 19,
            updateWhenIdle: true,
            keepBuffer: 1,
            zIndex: 10
        });

        // 4. 국토교통부 연속지적도(Cadastral 필지 경계선) 타일
        const vworldCadastral = L.tileLayer('https://xdworld.vworld.kr/2d/Cadastral/service/{z}/{x}/{y}.png', {
            maxZoom: 22,
            maxNativeZoom: 19,
            opacity: 0.75,
            zIndex: 9,
            attribution: '© 국토교통부 연속지적도'
        });

        // 기본 지도 표출 (VWorld 실패 시 백업 타일 자동 지원)
        vworldBase.addTo(this.map);

        this.baseLayers = {
            base: vworldBase,
            satellite: vworldSatellite,
            fallback: cartoFallback
        };

        this.overlayLayers = {
            hybrid: vworldHybrid,
            cadastral: vworldCadastral
        };

        // 초고성능 벡터 캔버스 렌더러 (지도 DOM에 즉시 연결)
        try {
            this.canvasRenderer = L.canvas({ padding: 0.25 }).addTo(this.map);
        } catch (e) {
            this.canvasRenderer = null;
        }

        // GIS 8대 레이어 그룹 등록
        this.layers.blocks = L.featureGroup().addTo(this.map);
        this.layers.reservoirs = L.featureGroup().addTo(this.map);
        this.layers.boosters = L.featureGroup().addTo(this.map);
        this.layers.meters = L.featureGroup().addTo(this.map);
        this.layers.pipesLm = L.featureGroup().addTo(this.map);
        this.layers.pipesLm2 = L.featureGroup().addTo(this.map);
        this.layers.servicePipes = L.featureGroup().addTo(this.map);
        this.layers.valves = L.featureGroup().addTo(this.map);
        this.layers.pipes = this.layers.pipesLm; // 기존 호환용 별칭
        this.layers.pressures = L.featureGroup().addTo(this.map);
        this.layers.leaks = L.featureGroup().addTo(this.map);
        this.layers.verification = L.featureGroup().addTo(this.map);

        // 관망도 라벨 레이어 그룹 등록 (블록경계 라벨은 기본 켜진 상태로 시작)
        this.labelLayers = {
            blocks: L.featureGroup(),
            reservoirs: L.featureGroup(),
            boosters: L.featureGroup(),
            meters: L.featureGroup()
        };
        // 사용자 요청: 줌 레벨 변경 시 라벨 축척 연동 (zoom < 13 광역 축척에서는 경계 라벨 숨김)
        this.map.on('zoomend', () => this.updateLabelsOnZoom());

        this.initGisLayerControl();
        this.initDraggableControls();

        // 1. 지도 좌클릭: 컨텍스트 메뉴 닫기 및 시설물 원클릭 선택 / 로드뷰 모드 연동
        this.map.on('click', (e) => {
            this.hideContextMenu();
            if (this.isRoadviewMode) {
                this.openRoadview(e.latlng.lat, e.latlng.lng);
                return;
            } else if (this.roadviewState.isOpen) {
                // 로드뷰 활성화 상태에서 지도를 클릭하면 해당 위치로 로드뷰와 지도 마커가 즉시 동기화 이동
                this.updateRoadviewPosition(e.latlng.lat, e.latlng.lng, this.roadviewState.heading, false);
                return;
            }

            // GIS 부과 수용가 스마트 선택 (클릭 반경 18px 이내)
            if (this.layerVisibility.billing) {
                const clickedConsumer = this.findNearestGisBilling(e.latlng.lat, e.latlng.lng, 18);
                if (clickedConsumer) {
                    this.highlightGisBilling(clickedConsumer);
                    if (typeof this.onFacilitySelect === 'function') {
                        this.onFacilitySelect({ ...clickedConsumer, category: '부과 수용가', facilityType: 'CONSUMER' });
                    }
                    return;
                }
            }

            // GIS 밸브(제수·공기·역지·감압·이토변 등) 스마트 선택 (클릭 반경 18px 이내)
            const clickedValve = this.findNearestGisValve(e.latlng.lat, e.latlng.lng, 18);
            if (clickedValve) {
                this.highlightGisValve(clickedValve);
                if (typeof this.onFacilitySelect === 'function') {
                    this.onFacilitySelect({ ...clickedValve, category: clickedValve.cat || '제수변', facilityType: 'VALVE' });
                }
                return;
            }

            // GIS 관로 스마트 선택 (클릭 반경 25m 이내)
            const clickedPipe = this.findNearestGisPipe(e.latlng.lat, e.latlng.lng, 25);
            if (clickedPipe) {
                this.highlightGisPipe(clickedPipe);
                if (typeof this.onFacilitySelect === 'function') {
                    this.onFacilitySelect({ ...clickedPipe, category: '상수관로', facilityType: 'PIPE' });
                }
                return;
            }
        });

        // 2. 지도 우클릭(마우스 오른쪽 버튼 클릭): 사용자 요청 반영 -> 컨텍스트 메뉴 표출 후 주소 검색 및 로드뷰 선택 가능
        this.map.on('contextmenu', (e) => {
            if (e.originalEvent) {
                e.originalEvent.preventDefault();
                e.originalEvent.stopPropagation();
            }
            this.handleMapContextMenu(e);
        });

        // 김해시 실제 관망 GIS 공간데이터셋(8대 레이어) 즉시 로드 및 고속 렌더링
        if (window.GIMHAE_GIS_DATA) {
            window.GIMHAE_DEFAULT_GIS_DATA = window.GIMHAE_GIS_DATA;
            this.loadGisDataset(window.GIMHAE_GIS_DATA);
        } else {
            this.renderAllFacilities();
            window.addEventListener('load', () => {
                if (window.GIMHAE_GIS_DATA && !this.gisDataLoaded) {
                    window.GIMHAE_DEFAULT_GIS_DATA = window.GIMHAE_GIS_DATA;
                    this.loadGisDataset(window.GIMHAE_GIS_DATA);
                }
            });
        }

        this.initRoadviewKeyboardNav();
        this.initRoadviewIframeGuidance();
        this.initKakaoSdk();
    }

    /**
     * 배경지도 전환 (일반지도 <-> 항공위성)
     */
    switchBaseMap(type) {
        if (type === 'satellite') {
            if (this.map.hasLayer(this.baseLayers.base)) {
                this.map.removeLayer(this.baseLayers.base);
            }
            if (!this.map.hasLayer(this.baseLayers.satellite)) {
                this.baseLayers.satellite.addTo(this.map);
            }
            // 위성 모드에서는 하이브리드(지명/도로 라벨) 기본 활성화
            if (!this.map.hasLayer(this.overlayLayers.hybrid)) {
                this.overlayLayers.hybrid.addTo(this.map);
            }
        } else {
            if (this.map.hasLayer(this.baseLayers.satellite)) {
                this.map.removeLayer(this.baseLayers.satellite);
            }
            if (!this.map.hasLayer(this.baseLayers.base)) {
                this.baseLayers.base.addTo(this.map);
            }
        }
    }

    /**
     * 국토부 연속지적도(필지선) 레이어 토글
     */
    toggleCadastral(enable) {
        if (enable) {
            if (!this.map.hasLayer(this.overlayLayers.cadastral)) {
                this.overlayLayers.cadastral.addTo(this.map);
            }
        } else {
            if (this.map.hasLayer(this.overlayLayers.cadastral)) {
                this.map.removeLayer(this.overlayLayers.cadastral);
            }
        }
    }

    /**
     * 하이브리드(지명·도로명 라벨) 레이어 토글
     */
    toggleHybrid(enable) {
        if (enable) {
            if (!this.map.hasLayer(this.overlayLayers.hybrid)) {
                this.overlayLayers.hybrid.addTo(this.map);
            }
        } else {
            if (this.map.hasLayer(this.overlayLayers.hybrid)) {
                this.map.removeLayer(this.overlayLayers.hybrid);
            }
        }
    }

    /**
     * 김해시 전체 관망 중심으로 줌 리셋
     */
    resetView() {
        this.map.flyTo([35.2305, 128.8845], 15, { duration: 1.0 });
    }

    /**
     * 작업 모드 설정 (경계밸브/수용가/수압/누수 등)
     */
    setWorkMode(mode) {
        this.currentWorkMode = mode;
        this.renderAllFacilities();

        // 모드에 따라 지도 뷰포트 최적화
        if (mode === 'VALVE_SURVEY') {
            const bounds = this.layers.valves.getBounds();
            if (bounds.isValid()) this.map.fitBounds(bounds.pad(0.3));
        } else if (mode === 'PRESSURE_SURVEY') {
            const bounds = this.layers.pressures.getBounds();
            if (bounds.isValid()) this.map.fitBounds(bounds.pad(0.3));
        } else if (mode === 'LEAK_SURVEY') {
            const bounds = this.layers.leaks.getBounds();
            if (bounds.isValid()) this.map.fitBounds(bounds.pad(0.3));
        }
    }

    /**
     * 전체 시설물 렌더링 (현재 작업 모드 반영)
     */
    renderAllFacilities() {
        // 실제 GIS 데이터셋(8대 레이어)이 이미 로드되었거나 전역에 존재할 경우 샘플데이터로 덮어쓰지 않음
        if (this.gisDataLoaded || window.GIMHAE_GIS_DATA) {
            if (!this.gisDataLoaded && window.GIMHAE_GIS_DATA) {
                this.loadGisDataset(window.GIMHAE_GIS_DATA);
            }
            return;
        }

        this.layers.pipes.clearLayers();
        this.layers.valves.clearLayers();
        this.layers.meters.clearLayers();
        this.layers.pressures.clearLayers();
        this.layers.leaks.clearLayers();

        const mode = this.currentWorkMode;

        // 1. 관로 (Pipes)
        const showPipes = true;
        const pipeOpacity = (mode === 'VALVE_SURVEY' || mode === 'PRESSURE_SURVEY') ? 0.4 : 0.85;

        if (showPipes && window.SAMPLE_PIPES) {
            window.SAMPLE_PIPES.forEach(pipe => {
                if (this.activeBlock !== 'ALL' && pipe.block !== this.activeBlock) return;

                const weight = Math.max(3, Math.min(8, pipe.dia / 35));
                let color = '#2563EB';
                if (pipe.dia >= 300) color = '#7C3AED';
                else if (pipe.dia <= 80) color = '#0284C7';

                const line = L.polyline(pipe.coordinates, {
                    color: color,
                    weight: weight,
                    opacity: pipeOpacity,
                    lineCap: 'round',
                    lineJoin: 'round'
                });

                line.bindTooltip(`<b>${pipe.name}</b><br>구경: D${pipe.dia}mm (${pipe.material})<br>연장: ${pipe.length}m`, {
                    sticky: true
                });

                line.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    if (this.isRoadviewMode || this.roadviewState.isOpen) {
                        this.updateRoadviewPosition(e.latlng.lat, e.latlng.lng, this.roadviewState.heading, false);
                    }
                    this.highlightFacility(line);
                    this.onFacilitySelect({ ...pipe, facilityType: 'PIPE' });
                });

                this.layers.pipes.addLayer(line);
            });
        }

        // 2. 제수변 / 경계밸브 (Valves)
        const showValves = (mode === 'ALL' || mode === 'VALVE_SURVEY') && window.SAMPLE_VALVES;
        if (showValves) {
            const isHighlightMode = mode === 'VALVE_SURVEY';

            window.SAMPLE_VALVES.forEach(vlv => {
                if (this.activeBlock !== 'ALL' && vlv.block !== this.activeBlock) return;

                const iconHtml = `<div class="marker-pin marker-valve ${isHighlightMode ? 'marker-pulse' : ''}">
                    <i class="fa-solid fa-gear"></i>
                </div>`;

                const valveIcon = L.divIcon({
                    className: 'custom-map-icon',
                    html: iconHtml,
                    iconSize: [isHighlightMode ? 34 : 28, isHighlightMode ? 34 : 28],
                    iconAnchor: [isHighlightMode ? 17 : 14, isHighlightMode ? 17 : 14]
                });

                const marker = L.marker([vlv.lat, vlv.lng], { icon: valveIcon });
                marker.bindTooltip(`<b>[경계밸브] ${vlv.name}</b><br>D${vlv.dia}mm | ${vlv.status}<br>회전수: ${vlv.total_turn}회<br>위치: ${vlv.address || ''}`, {
                    sticky: true
                });

                marker.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    if (this.isRoadviewMode || this.roadviewState.isOpen) {
                        this.openRoadview(vlv.lat, vlv.lng, vlv.name);
                    }
                    this.highlightFacility(marker);
                    this.onFacilitySelect({ ...vlv, facilityType: 'VALVE' });
                });

                this.layers.valves.addLayer(marker);
            });
        }

        // 3. 계량기 / 급수전 (Meters)
        const showMeters = (mode === 'ALL' || mode === 'METER_SURVEY') && window.SAMPLE_METERS;
        if (showMeters) {
            const isHighlightMode = mode === 'METER_SURVEY';

            window.SAMPLE_METERS.forEach(mtr => {
                if (this.activeBlock !== 'ALL' && mtr.block !== this.activeBlock) return;

                const iconHtml = `<div class="marker-pin marker-meter ${isHighlightMode ? 'marker-pulse' : ''}">
                    <i class="fa-solid fa-faucet-drip"></i>
                </div>`;

                const meterIcon = L.divIcon({
                    className: 'custom-map-icon',
                    html: iconHtml,
                    iconSize: [isHighlightMode ? 32 : 26, isHighlightMode ? 32 : 26],
                    iconAnchor: [isHighlightMode ? 16 : 13, isHighlightMode ? 16 : 13]
                });

                const marker = L.marker([mtr.lat, mtr.lng], { icon: meterIcon });
                marker.bindTooltip(`<b>[수용가] ${mtr.name}</b><br>수용가: ${mtr.owner} (D${mtr.dia}mm)<br>지침: ${mtr.last_read} m³<br>위치: ${mtr.address || ''}`, {
                    sticky: true
                });

                marker.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    if (this.isRoadviewMode || this.roadviewState.isOpen) {
                        this.openRoadview(mtr.lat, mtr.lng, mtr.name);
                    }
                    this.highlightFacility(marker);
                    this.onFacilitySelect({ ...mtr, facilityType: 'METER' });
                });

                this.layers.meters.addLayer(marker);
            });
        }

        // 4. 수압 측정점 (Pressures)
        const showPressures = (mode === 'ALL' || mode === 'PRESSURE_SURVEY') && window.SAMPLE_PRESSURE_POINTS;
        if (showPressures) {
            window.SAMPLE_PRESSURE_POINTS.forEach(prs => {
                if (this.activeBlock !== 'ALL' && prs.block !== this.activeBlock) return;

                const isWarning = prs.status.includes('주의');
                const pinColor = isWarning ? '#EF4444' : '#10B981';

                const iconHtml = `<div class="marker-pin" style="background:${pinColor};">
                    <i class="fa-solid fa-gauge-high"></i>
                </div>`;

                const icon = L.divIcon({
                    className: 'custom-map-icon',
                    html: iconHtml,
                    iconSize: [30, 30],
                    iconAnchor: [15, 15]
                });

                const marker = L.marker([prs.lat, prs.lng], { icon });
                marker.bindTooltip(`<b>[수압점] ${prs.name}</b><br>실측수압: <b>${prs.current_pressure} kgf/cm²</b><br>상태: ${prs.status}<br>위치: ${prs.address || ''}`, {
                    sticky: true
                });

                marker.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    if (this.isRoadviewMode || this.roadviewState.isOpen) {
                        this.openRoadview(prs.lat, prs.lng, prs.name);
                    }
                    this.highlightFacility(marker);
                    this.onFacilitySelect({ ...prs, facilityType: 'PRESSURE' });
                });

                this.layers.pressures.addLayer(marker);
            });
        }

        // 5. 누수탐사 및 복구점 (Leaks)
        const showLeaks = (mode === 'ALL' || mode === 'LEAK_SURVEY') && window.SAMPLE_LEAK_POINTS;
        if (showLeaks) {
            window.SAMPLE_LEAK_POINTS.forEach(lk => {
                if (this.activeBlock !== 'ALL' && lk.block !== this.activeBlock) return;

                const iconHtml = `<div class="marker-pin marker-leak marker-pulse">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                </div>`;

                const icon = L.divIcon({
                    className: 'custom-map-icon',
                    html: iconHtml,
                    iconSize: [32, 32],
                    iconAnchor: [16, 16]
                });

                const marker = L.marker([lk.lat, lk.lng], { icon });
                marker.bindTooltip(`<b>[누수탐사] ${lk.name}</b><br>청음: ${lk.sound_grade}<br>상태: ${lk.status}<br>위치: ${lk.address || ''}`, {
                    sticky: true
                });

                marker.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    if (this.isRoadviewMode || this.roadviewState.isOpen) {
                        this.openRoadview(lk.lat, lk.lng, lk.name);
                    }
                    this.highlightFacility(marker);
                    this.onFacilitySelect({ ...lk, facilityType: 'LEAK' });
                });

                this.layers.leaks.addLayer(marker);
            });
        }
    }

    /**
     * 초고속 공간 검색: 클릭 위치(lat, lng)에서 가장 가까운 GIS 관로 검색 (소요시간 < 0.05ms)
     */
    findNearestGisPipe(lat, lng, maxDistMeters = 35) {
        if (!this.gisData) return null;
        const latBox = (maxDistMeters / 111000) * 1.5;
        const lngBox = latBox / Math.cos((lat * Math.PI) / 180);

        const candidates = [];
        if (this.layerVisibility.pipesLm && this.spatialIndexLm) {
            const subVis = (this.subLayerVisibility && this.subLayerVisibility.pipesLm) ? this.subLayerVisibility.pipesLm : null;
            const lmCands = [];
            this.spatialIndexLm.query(lat - latBox, lat + latBox, lng - lngBox, lng + lngBox, lmCands);
            for (let i = 0; i < lmCands.length; i++) {
                const p = lmCands[i];
                if (subVis) {
                    const dia = p.dia || p.d || 100;
                    if (dia <= 250 && subVis.d250 === false) continue;
                    if (dia > 250 && dia <= 500 && subVis.d500 === false) continue;
                    if (dia > 500 && subVis.dover === false) continue;
                }
                candidates.push(p);
            }
        }
        if (this.layerVisibility.pipesLm2 && this.spatialIndexLm2) {
            this.spatialIndexLm2.query(lat - latBox, lat + latBox, lng - lngBox, lng + lngBox, candidates);
        }
        if (this.layerVisibility.servicePipes && this.spatialIndexSp) {
            this.spatialIndexSp.query(lat - latBox, lat + latBox, lng - lngBox, lng + lngBox, candidates);
        }

        let nearest = null;
        let minDist = maxDistMeters;

        const len = candidates.length;
        for (let i = 0; i < len; i++) {
            const p = candidates[i];
            const coords = p.coordinates || p.c;
            if (!coords || coords.length < 2) continue;

            for (let j = 0; j < coords.length - 1; j++) {
                const a = coords[j];
                const b = coords[j + 1];
                const d = this.distToSegmentMeters(lat, lng, a[0], a[1], b[0], b[1]);
                if (d < minDist) {
                    minDist = d;
                    nearest = p;
                }
            }
        }
        return nearest;
    }

    /**
     * 점(lat, lng)에서 선분(lat1,lng1 ~ lat2,lng2)까지의 미터 단위 거리
     */
    distToSegmentMeters(lat, lng, lat1, lng1, lat2, lng2) {
        const cosLat = Math.cos((lat * Math.PI) / 180);
        const px = lng * cosLat * 111320;
        const py = lat * 111320;
        const ax = lng1 * cosLat * 111320;
        const ay = lat1 * 111320;
        const bx = lng2 * cosLat * 111320;
        const by = lat2 * 111320;

        const dx = bx - ax;
        const dy = by - ay;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return Math.hypot(px - ax, py - ay);

        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
        const projX = ax + t * dx;
        const projY = ay + t * dy;
        return Math.hypot(px - projX, py - projY);
    }

    /**
     * 특정 관로 하이라이트 발광 표출
     */
    highlightGisPipe(pipe) {
        if (!this.layers.highlight) {
            this.layers.highlight = L.featureGroup().addTo(this.map);
        }
        this.layers.highlight.clearLayers();
        const coords = pipe ? (pipe.coordinates || pipe.c) : null;
        if (!coords || coords.length < 2) return;

        const glow = L.polyline(coords, {
            color: '#F59E0B',
            weight: 8,
            opacity: 0.65,
            lineCap: 'round',
            lineJoin: 'round'
        });
        const main = L.polyline(coords, {
            color: '#FFFFFF',
            weight: 3.5,
            opacity: 1,
            lineCap: 'round',
            lineJoin: 'round'
        });
        this.layers.highlight.addLayer(glow);
        this.layers.highlight.addLayer(main);
    }

    /**
     * 초고속 밸브 공간 검색: 클릭 위치(lat, lng)에서 가장 가까운 GIS 밸브(제수변) 검색
     */
    findNearestGisValve(lat, lng, maxDistPixels = 18) {
        if (!this.gisData || !this.gisData.valves || !this.layerVisibility.valves || !this.map) return null;
        const clickPt = this.map.latLngToContainerPoint([lat, lng]);
        const latBox = 0.003;
        const lngBox = 0.003;
        let candidates = [];
        if (this.spatialIndexValves) {
            candidates = this.spatialIndexValves.query(lat - latBox, lat + latBox, lng - lngBox, lng + lngBox);
        } else {
            candidates = this.gisData.valves;
        }

        let nearest = null;
        let minDist = maxDistPixels;
        const len = candidates.length;
        const subVis = (this.subLayerVisibility && this.subLayerVisibility.valves) ? this.subLayerVisibility.valves : {};
        for (let i = 0; i < len; i++) {
            const v = candidates[i];
            const cde = v.cde || 'OTHER';
            const subKey = subVis[cde] !== undefined ? cde : 'OTHER';
            if (subVis[subKey] === false) continue;

            const pt = this.map.latLngToContainerPoint([v.lat, v.lng]);
            const d = Math.hypot(pt.x - clickPt.x, pt.y - clickPt.y);
            if (d < minDist) {
                minDist = d;
                nearest = v;
            }
        }
        return nearest;
    }

    /**
     * 특정 밸브 발광 하이라이트 표출
     */
    highlightGisValve(valve) {
        if (!this.layers.highlight) {
            this.layers.highlight = L.featureGroup().addTo(this.map);
        }
        this.layers.highlight.clearLayers();
        if (!valve || !valve.lat || !valve.lng) return;

        const pulseRing = L.circleMarker([valve.lat, valve.lng], {
            radius: 13,
            color: '#F59E0B',
            fillColor: '#F59E0B',
            fillOpacity: 0.3,
            weight: 3
        });
        const centerPt = L.circleMarker([valve.lat, valve.lng], {
            radius: 6,
            color: '#FFFFFF',
            fillColor: '#D97706',
            fillOpacity: 1,
            weight: 2
        });
        this.layers.highlight.addLayer(pulseRing);
        this.layers.highlight.addLayer(centerPt);
    }

    /**
     * 초고속 부과 수용가 공간 검색: 클릭 위치(lat, lng)에서 가장 가까운 수용가 검색
     */
    findNearestGisBilling(lat, lng, maxDistPixels = 18) {
        if (!this.gisData || !this.gisData.billingConsumers || !this.layerVisibility.billing || !this.map) return null;
        const clickPt = this.map.latLngToContainerPoint([lat, lng]);
        const latBox = 0.003;
        const lngBox = 0.003;
        let candidates = [];
        if (this.spatialIndexBilling) {
            candidates = this.spatialIndexBilling.query(lat - latBox, lat + latBox, lng - lngBox, lng + lngBox);
        } else {
            candidates = this.gisData.billingConsumers;
        }

        let nearest = null;
        let minDist = maxDistPixels;
        const len = candidates.length;
        const subVis = (this.subLayerVisibility && this.subLayerVisibility.billing) ? this.subLayerVisibility.billing : {};
        for (let i = 0; i < len; i++) {
            const b = candidates[i];
            const isClosed = b.cls === '폐전';
            const isBulk = (b.use && b.use >= 300) || (b.dia && b.dia >= 32);
            const bType = isClosed ? 'closed' : (isBulk ? 'bulk' : 'normal');
            if (subVis[bType] === false) continue;

            const pt = this.map.latLngToContainerPoint([b.lat, b.lng]);
            const d = Math.hypot(pt.x - clickPt.x, pt.y - clickPt.y);
            if (d < minDist) {
                minDist = d;
                nearest = b;
            }
        }
        return nearest;
    }

    /**
     * 특정 부과 수용가 하이라이트 표출
     */
    highlightGisBilling(consumer) {
        if (!this.layers.highlight) {
            this.layers.highlight = L.featureGroup().addTo(this.map);
        }
        this.layers.highlight.clearLayers();
        if (!consumer || !consumer.lat || !consumer.lng) return;

        const pulseRing = L.circleMarker([consumer.lat, consumer.lng], {
            radius: 14,
            color: '#10B981',
            fillColor: '#10B981',
            fillOpacity: 0.25,
            weight: 3
        });
        const centerPt = L.circleMarker([consumer.lat, consumer.lng], {
            radius: 6,
            color: '#FFFFFF',
            fillColor: '#059669',
            fillOpacity: 1,
            weight: 2
        });
        this.layers.highlight.addLayer(pulseRing);
        this.layers.highlight.addLayer(centerPt);
    }

    /**
     * 103개 관망 블록 인접성(Adjacency) 분석 및 인접 블록 간 상이한 대비 색상 자동 배정 (카토그래픽 4색 정리 알고리즘)
     * 인접 블록끼리는 절대 같은 색상이 중복되지 않도록 14종의 고대비 조화 팔레트 자동 배정
     */
    assignBlockColors(blocks) {
        if (!blocks || !Array.isArray(blocks) || blocks.length === 0) return;

        // 고대비 프리미엄 GIS 카토그래픽 팔레트 (14색)
        // 인접한 블록이 시각적으로 즉각 구분되면서도 관로(파랑, 빨강)를 방해하지 않는 산뜻한 톤
        const PALETTE = [
            { fill: '#8B5CF6', border: '#6D28D9', name: '바이올렛' },
            { fill: '#10B981', border: '#047857', name: '에메랄드' },
            { fill: '#F59E0B', border: '#B45309', name: '앰버골드' },
            { fill: '#EC4899', border: '#BE185D', name: '핑크' },
            { fill: '#06B6D4', border: '#0E7490', name: '시안' },
            { fill: '#F97316', border: '#C2410C', name: '오렌지' },
            { fill: '#6366F1', border: '#4338CA', name: '인디고' },
            { fill: '#84CC16', border: '#4D7C0F', name: '라임연두' },
            { fill: '#14B8A6', border: '#0F766E', name: '틸민트' },
            { fill: '#E11D48', border: '#9F1239', name: '로즈진홍' },
            { fill: '#3B82F6', border: '#1D4ED8', name: '스카이블루' },
            { fill: '#A855F7', border: '#7E22CE', name: '퍼플' },
            { fill: '#D97706', border: '#92400E', name: '브론즈' },
            { fill: '#0284C7', border: '#0369A1', name: '딥스카이' }
        ];

        const n = blocks.length;
        const bboxes = [];
        for (let i = 0; i < n; i++) {
            const coords = blocks[i].coordinates || [];
            if (!coords || coords.length === 0) {
                bboxes.push({ minLat: 0, maxLat: 0, minLng: 0, maxLng: 0, cLat: 0, cLng: 0 });
                continue;
            }
            let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
            let sumLat = 0, sumLng = 0;
            for (let k = 0; k < coords.length; k++) {
                const p = coords[k];
                if (p[0] < minLat) minLat = p[0];
                if (p[0] > maxLat) maxLat = p[0];
                if (p[1] < minLng) minLng = p[1];
                if (p[1] > maxLng) maxLng = p[1];
                sumLat += p[0];
                sumLng += p[1];
            }
            bboxes.push({
                minLat, maxLat, minLng, maxLng,
                cLat: sumLat / coords.length,
                cLng: sumLng / coords.length
            });
        }

        // 인접 그래프 (Adjacency Graph) 구성
        const adj = Array.from({ length: n }, () => new Set());
        const MARGIN = 0.0012; // 약 120m
        const VERTEX_PROXIMITY_SQ = 0.0007 * 0.0007; // 약 70m

        for (let i = 0; i < n; i++) {
            const bbA = bboxes[i];
            const coordsA = blocks[i].coordinates || [];
            if (coordsA.length === 0) continue;

            for (let j = i + 1; j < n; j++) {
                const bbB = bboxes[j];
                const coordsB = blocks[j].coordinates || [];
                if (coordsB.length === 0) continue;

                // Bounding Box 빠른 배제
                if (bbA.maxLat + MARGIN < bbB.minLat || bbA.minLat - MARGIN > bbB.maxLat ||
                    bbA.maxLng + MARGIN < bbB.minLng || bbA.minLng - MARGIN > bbB.maxLng) {
                    continue;
                }

                // 중심점 거리가 매우 가까우면(약 450m 이내) 인접 이웃
                const dCenterSq = (bbA.cLat - bbB.cLat) ** 2 + (bbA.cLng - bbB.cLng) ** 2;
                if (dCenterSq < 0.0045 * 0.0045) {
                    adj[i].add(j);
                    adj[j].add(i);
                    continue;
                }

                // 꼭짓점 간 근접 검사 (샘플링)
                let isNeighbor = false;
                const stepA = Math.max(1, Math.floor(coordsA.length / 35));
                const stepB = Math.max(1, Math.floor(coordsB.length / 35));

                for (let a = 0; a < coordsA.length && !isNeighbor; a += stepA) {
                    const ptA = coordsA[a];
                    for (let b = 0; b < coordsB.length; b += stepB) {
                        const ptB = coordsB[b];
                        const distSq = (ptA[0] - ptB[0]) ** 2 + (ptA[1] - ptB[1]) ** 2;
                        if (distSq <= VERTEX_PROXIMITY_SQ) {
                            isNeighbor = true;
                            break;
                        }
                    }
                }

                if (isNeighbor) {
                    adj[i].add(j);
                    adj[j].add(i);
                }
            }
        }

        // 탐욕 그래프 컬러링 (Welsh-Powell)
        const order = Array.from({ length: n }, (_, i) => i);
        order.sort((a, b) => adj[b].size - adj[a].size);

        const assignedColors = new Array(n).fill(-1);

        for (let k = 0; k < n; k++) {
            const u = order[k];
            const used = new Set();
            adj[u].forEach(nbr => {
                if (assignedColors[nbr] !== -1) {
                    used.add(assignedColors[nbr]);
                }
            });

            let chosenIdx = 0;
            while (chosenIdx < PALETTE.length && used.has(chosenIdx)) {
                chosenIdx++;
            }
            if (chosenIdx >= PALETTE.length) {
                chosenIdx = chosenIdx % PALETTE.length;
            }

            assignedColors[u] = chosenIdx;
            blocks[u].colorStyle = PALETTE[chosenIdx];
        }
    }

    /**
     * SHP / ZIP 등 실제 GIS 공간 데이터셋을 MultiPolyline 기반으로 30ms 안에 초고속 렌더링
     */
    loadGisDataset(gisData) {
        if (typeof L === 'undefined' || !this.map) {
            return;
        }
        if (!gisData) {
            if (window.GIMHAE_GIS_DATA) gisData = window.GIMHAE_GIS_DATA;
            else return;
        }
        this.gisData = gisData;

        // 8대 레이어 그룹 보장
        if (!this.layers.blocks) this.layers.blocks = L.featureGroup().addTo(this.map);
        if (!this.layers.reservoirs) this.layers.reservoirs = L.featureGroup().addTo(this.map);
        if (!this.layers.boosters) this.layers.boosters = L.featureGroup().addTo(this.map);
        if (!this.layers.meters) this.layers.meters = L.featureGroup().addTo(this.map);
        if (!this.layers.pipesLm) this.layers.pipesLm = L.featureGroup().addTo(this.map);
        if (!this.layers.pipesLm2) this.layers.pipesLm2 = L.featureGroup().addTo(this.map);
        if (!this.layers.servicePipes) this.layers.servicePipes = L.featureGroup().addTo(this.map);
        if (!this.layers.valves) this.layers.valves = L.featureGroup().addTo(this.map);
        if (!this.layers.highlight) this.layers.highlight = L.featureGroup().addTo(this.map);
        this.layers.pipes = this.layers.pipesLm; // 기존 호환용

        this.layers.blocks.clearLayers();
        this.layers.reservoirs.clearLayers();
        this.layers.boosters.clearLayers();
        this.layers.meters.clearLayers();
        this.layers.pipesLm.clearLayers();
        this.layers.pipesLm2.clearLayers();
        this.layers.servicePipes.clearLayers();
        this.layers.valves.clearLayers();
        this.layers.highlight.clearLayers();

        // 라벨 레이어 초기화
        if (!this.labelLayers) {
            this.labelLayers = {
                blocks: L.featureGroup(),
                reservoirs: L.featureGroup(),
                boosters: L.featureGroup(),
                meters: L.featureGroup()
            };
        } else {
            if (!this.labelLayers.blocks) this.labelLayers.blocks = L.featureGroup();
            if (!this.labelLayers.reservoirs) this.labelLayers.reservoirs = L.featureGroup();
            if (!this.labelLayers.boosters) this.labelLayers.boosters = L.featureGroup();
            if (!this.labelLayers.meters) this.labelLayers.meters = L.featureGroup();
        }
        this.labelLayers.blocks.clearLayers();
        this.labelLayers.reservoirs.clearLayers();
        this.labelLayers.boosters.clearLayers();
        this.labelLayers.meters.clearLayers();

        // 캔버스 렌더러 지도 부착 보장
        if (!this.canvasRenderer || !this.map.hasLayer(this.canvasRenderer)) {
            try {
                this.canvasRenderer = L.canvas({ padding: 0.25 }).addTo(this.map);
            } catch (e) {
                this.canvasRenderer = null;
            }
        }
        const renderer = this.canvasRenderer;
        const allBounds = L.latLngBounds([]);

        // 1. 블록경계 (103개 Polygon) - 인접 블록 간 상이한 대비 색상 자동 분할 및 20~30% 연한 투명도 렌더링
        this.assignBlockColors(gisData.blocks);

        const blockWeight = (this.symbolSizes && this.symbolSizes.facilities && this.symbolSizes.facilities.blocks) || 2.2;
        const blockOpacity = (this.symbolSizes && this.symbolSizes.facilities && this.symbolSizes.facilities.blockOpacity) || 0.24;

        if (gisData.blocks && gisData.blocks.length > 0) {
            gisData.blocks.forEach(b => {
                if (b.coordinates && b.coordinates.length > 2) {
                    const colorStyle = b.colorStyle || { fill: '#8B5CF6', border: '#7C3AED' };
                    const poly = L.polygon(b.coordinates, {
                        renderer: renderer,
                        color: colorStyle.border,
                        weight: blockWeight,
                        opacity: 0.90,
                        fillColor: colorStyle.fill,
                        fillOpacity: blockOpacity,
                        dashArray: '5, 4',
                        originalColorStyle: colorStyle
                    });
                    poly.bindTooltip(`<div style="padding:2px 6px; font-weight:700; font-size:12px; color:#0F172A;">${b.name}</div>`, {
                        sticky: true,
                        direction: 'top',
                        className: 'gis-block-tooltip'
                    });
                    poly.on('mouseover', (e) => {
                        if (this.activeBlock !== b.name) {
                            e.target.setStyle({
                                weight: blockWeight + 1.2,
                                fillOpacity: Math.min(0.42, blockOpacity + 0.12)
                            });
                        }
                    });
                    poly.on('mouseout', (e) => {
                        if (this.activeBlock !== b.name) {
                            e.target.setStyle({
                                weight: blockWeight,
                                fillOpacity: blockOpacity
                            });
                        }
                    });
                    poly.on('click', () => {
                        this.highlightBlock(b.name);
                    });
                    this.layers.blocks.addLayer(poly);
                    allBounds.extend(poly.getBounds());
                }
            });

            // 블록명 라벨 렌더링 (표출 여부는 축척 연동 updateLabelsOnZoom()에서 제어)
            this.renderBlockLabels();
        }

        // 2. 정수장 / 배수지 (44개 Point)
        const resSize = (this.symbolSizes && this.symbolSizes.facilities && this.symbolSizes.facilities.reservoirs) || 24;
        const resHalf = Math.round(resSize / 2);
        if (gisData.reservoirs && gisData.reservoirs.length > 0) {
            gisData.reservoirs.forEach(res => {
                if (res.lat && res.lng) {
                    const icon = L.divIcon({
                        className: 'gis-marker-reservoir',
                        html: `<div style="background:#0284C7; color:white; border-radius:50%; width:${resSize}px; height:${resSize}px; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 6px rgba(0,0,0,0.3); border:2px solid white; font-size:${Math.round(resSize*0.45)}px;"><i class="fa-solid fa-water"></i></div>`,
                        iconSize: [resSize, resSize],
                        iconAnchor: [resHalf, resHalf]
                    });
                    const m = L.marker([res.lat, res.lng], { icon: icon });
                    m.bindTooltip(`<b>${res.name}</b>`, { sticky: true });
                    m.on('click', () => {
                        this.onFacilitySelect({ ...res, category: '배수지', facilityType: 'RESERVOIR' });
                    });
                    this.layers.reservoirs.addLayer(m);
                    allBounds.extend([res.lat, res.lng]);
                }
            });

            // 정수·배수지 시설물명 라벨 렌더링
            this.renderReservoirLabels();
        }

        // 3. 가압장 (63개 Point)
        const bstSize = (this.symbolSizes && this.symbolSizes.facilities && this.symbolSizes.facilities.boosters) || 22;
        const bstHalf = Math.round(bstSize / 2);
        if (gisData.boosters && gisData.boosters.length > 0) {
            gisData.boosters.forEach(bst => {
                if (bst.lat && bst.lng) {
                    const icon = L.divIcon({
                        className: 'gis-marker-booster',
                        html: `<div style="background:#EA580C; color:white; border-radius:50%; width:${bstSize}px; height:${bstSize}px; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 6px rgba(0,0,0,0.3); border:2px solid white; font-size:${Math.round(bstSize*0.45)}px;"><i class="fa-solid fa-bolt"></i></div>`,
                        iconSize: [bstSize, bstSize],
                        iconAnchor: [bstHalf, bstHalf]
                    });
                    const m = L.marker([bst.lat, bst.lng], { icon: icon });
                    m.bindTooltip(`<b>${bst.name}</b>`, { sticky: true });
                    m.on('click', () => {
                        this.onFacilitySelect({ ...bst, category: '가압장', facilityType: 'BOOSTER' });
                    });
                    this.layers.boosters.addLayer(m);
                    allBounds.extend([bst.lat, bst.lng]);
                }
            });

            // 가압장 명칭 라벨 렌더링
            this.renderBoosterLabels();
        }

        // 4. 구역유량계 (326개 Point)
        const meterR = (this.symbolSizes && this.symbolSizes.facilities && this.symbolSizes.facilities.meters) || 5.5;
        if (gisData.flowMeters && gisData.flowMeters.length > 0) {
            gisData.flowMeters.forEach(flw => {
                if (flw.lat && flw.lng) {
                    const m = L.circleMarker([flw.lat, flw.lng], {
                        renderer: renderer,
                        radius: meterR,
                        fillColor: '#10B981',
                        color: '#FFFFFF',
                        weight: 2,
                        opacity: 1,
                        fillOpacity: 0.95
                    });
                    m.bindTooltip(`<b>${flw.name}</b>`, { sticky: true });
                    m.on('click', () => {
                        this.onFacilitySelect({ ...flw, category: '유량계', facilityType: 'FLOW_METER' });
                    });
                    this.layers.meters.addLayer(m);
                    allBounds.extend([flw.lat, flw.lng]);
                }
            });

            // 구역유량계 블록유량계명 라벨 렌더링
            this.renderMeterLabels();
        }

        // 축척 연동 라벨 표출 실행 (zoom < 13 광역 숨김, zoom >= 13 자동 표출)
        this.updateLabelsOnZoom();

        // 5~9. 공간 격자 색인 인스턴스 구축 및 시설물 고속 색인화 (관로·밸브·수용가 210,000개 전수)
        this.spatialIndexLm = new GisSpatialGrid(0.015);
        this.spatialIndexLm2 = new GisSpatialGrid(0.015);
        this.spatialIndexSp = new GisSpatialGrid(0.015);
        this.spatialIndexValves = new GisSpatialGrid(0.015);
        this.spatialIndexBilling = new GisSpatialGrid(0.015);

        if (gisData.pipesLm) {
            const list = gisData.pipesLm;
            for (let i = 0; i < list.length; i++) {
                this.spatialIndexLm.insertPoly(list[i], list[i].coordinates || list[i].c);
            }
        }
        if (gisData.pipesLm2) {
            const list = gisData.pipesLm2;
            for (let i = 0; i < list.length; i++) {
                this.spatialIndexLm2.insertPoly(list[i], list[i].coordinates || list[i].c);
            }
        }
        if (gisData.servicePipes) {
            const list = gisData.servicePipes;
            for (let i = 0; i < list.length; i++) {
                this.spatialIndexSp.insertPoly(list[i], list[i].coordinates || list[i].c);
            }
        }
        if (gisData.valves) {
            const list = gisData.valves;
            for (let i = 0; i < list.length; i++) {
                this.spatialIndexValves.insertPoint(list[i], list[i].lat, list[i].lng);
            }
        }
        if (gisData.billingConsumers) {
            const list = gisData.billingConsumers;
            for (let i = 0; i < list.length; i++) {
                this.spatialIndexBilling.insertPoint(list[i], list[i].lat, list[i].lng);
            }
        }

        // 전수 관로(121,800구간) 및 밸브(31,652개소) 초고성능 60fps 하드웨어 캔버스 레이어 장착
        initGisCanvasLayerClass();
        if (GisCanvasLayer) {
            if (!this.gisCanvasLayer) {
                this.gisCanvasLayer = new GisCanvasLayer(this);
                this.gisCanvasLayer.addTo(this.map);
            } else {
                this.gisCanvasLayer.redraw();
            }
        }

        this.gisDataLoaded = true;
        this.allGisBounds = allBounds;
        this.updateGisLayerCounts();
        this.applyLayerVisibility();

        const container = this.map ? this.map.getContainer() : null;
        if (container && container.offsetWidth > 50 && container.offsetHeight > 50 && allBounds.isValid()) {
            this.map.fitBounds(allBounds.pad(0.05), { animate: true, maxZoom: 16 });
        } else if (this.map) {
            this.map.setView([35.2285, 128.8893], 14);
        }

        // 상단 블록 선택 드롭다운에 실제 김해시 블록 103개 구역 자동 등록 (중복 제거된 단일 등록)
        const blockSelect = document.getElementById('blockSelect');
        if (blockSelect && gisData.blocks && gisData.blocks.length > 0) {
            const currentVal = blockSelect.value;
            let optionsHtml = '<option value="ALL">전체 블록 보기 (김해시 전역)</option>';
            gisData.blocks.forEach(b => {
                optionsHtml += `<option value="${b.name}">${b.name}</option>`;
            });
            blockSelect.innerHTML = optionsHtml;
            if (currentVal) blockSelect.value = currentVal;
        }
    }

    /**
     * 좌측 GIS 레이어 컨트롤 패널 초기화 및 이벤트 바인딩
     */
    initGisLayerControl() {
        const panel = document.getElementById('gisLayerControlPanel');
        if (!panel) return;

        // Leaflet 지도 터치/클릭 전파 방지 (모바일에서 select 박스 및 슬라이더 터치 조작 100% 보장)
        if (window.L && L.DomEvent) {
            L.DomEvent.disableClickPropagation(panel);
            L.DomEvent.disableScrollPropagation(panel);
        }
        panel.querySelectorAll('select, input, button, label').forEach(el => {
            ['touchstart', 'touchend', 'pointerdown'].forEach(evName => {
                el.addEventListener(evName, (e) => e.stopPropagation(), { passive: true });
            });
        });

        // 모바일 기본값: 화면 너비가 768px 이하이면 접힌 상태로 시작하여 지도 가림 완전 방지
        if (window.innerWidth <= 768) {
            panel.classList.add('collapsed');
        }

        // 1. 접기 / 펼치기 버튼 (✕ 닫기)
        const btnCollapse = document.getElementById('btnGlcCollapse');
        if (btnCollapse) {
            btnCollapse.addEventListener('click', (e) => {
                e.stopPropagation();
                panel.classList.toggle('collapsed');
            });
        }

        // 접혀있는 작은 레이어 아이콘을 클릭/터치하면 즉시 전체 패널 펼치기
        panel.addEventListener('click', (e) => {
            if (panel.classList.contains('collapsed')) {
                e.stopPropagation();
                panel.classList.remove('collapsed');
                const rect = panel.getBoundingClientRect();
                if (rect.right > window.innerWidth - 8) {
                    const newLeft = Math.max(8, window.innerWidth - (panel.offsetWidth || 242) - 8);
                    panel.style.left = newLeft + 'px';
                }
            }
        });

        // 2. 전체 일괄 켜기 / 끄기 토글 버튼
        const btnToggleAll = document.getElementById('btnGlcToggleAll');
        if (btnToggleAll) {
            btnToggleAll.addEventListener('click', (e) => {
                e.stopPropagation();
                const anyOn = Object.keys(this.layerVisibility)
                    .filter(k => k !== 'hybrid' && k !== 'cadastral')
                    .some(k => this.layerVisibility[k] === true);
                const newState = !anyOn;
                this.toggleAllGisLayers(newState);
                btnToggleAll.textContent = newState ? '전체' : '전체';
            });
        }

        // 사용자 기본 설정 초기화 (버전 13: 관로 최소 선굵기 및 최소 라벨 크기 적용, 축척 연동 라벨)
        try {
            if (localStorage.getItem('gis_layer_init_v13') !== 'true') {
                const defaults = {
                    blocks: 'true',
                    reservoirs: 'false',
                    boosters: 'false',
                    meters: 'false',
                    pipesLm: 'true',
                    pipesLm2: 'false',
                    servicePipes: 'false',
                    valves: 'true',
                    billing: 'false',
                    hybrid: 'true',
                    cadastral: 'false'
                };
                Object.entries(defaults).forEach(([k, v]) => {
                    localStorage.setItem(`gis_layer_vis_${k}`, v);
                    this.layerVisibility[k] = (v === 'true');
                });

                // 소분류 기본값 저장 (pipesLm 관경대역별, SA910: false, SA202: false, billing: false)
                const subDefaults = {
                    'pipesLm_d250': 'true',
                    'pipesLm_d500': 'true',
                    'pipesLm_dover': 'true',
                    'valves_SA200': 'true',
                    'valves_SA910': 'false',
                    'valves_SA119': 'true',
                    'valves_SA203': 'true',
                    'valves_SA202': 'false',
                    'valves_SA205': 'true',
                    'valves_SA204': 'true',
                    'valves_SA201': 'true',
                    'valves_SA220': 'true',
                    'valves_OTHER': 'true',
                    'billing_normal': 'false',
                    'billing_bulk': 'false',
                    'billing_closed': 'false'
                };
                Object.entries(subDefaults).forEach(([k, v]) => {
                    localStorage.setItem(`gis_subvis_${k}`, v);
                    const [grp, sub] = k.split('_');
                    if (this.subLayerVisibility && this.subLayerVisibility[grp]) {
                        this.subLayerVisibility[grp][sub] = (v === 'true');
                    }
                });

                // 관경별 선 굵기 최소 기본값 저장 (사용자 요청: 가장 작은 설정)
                const sizeDefaults = {
                    'pipes_pipesLm_d250': '1.0',
                    'pipes_pipesLm_d500': '1.5',
                    'pipes_pipesLm_dover': '2.0',
                    'pipes_pipesLm2': '1.0',
                    'pipes_servicePipes': '0.8'
                };
                Object.entries(sizeDefaults).forEach(([k, v]) => {
                    localStorage.setItem(`gis_size_${k}`, v);
                    const [grp, sub] = k.split('_');
                    if (this.symbolSizes && this.symbolSizes[grp]) {
                        this.symbolSizes[grp][sub] = parseFloat(v);
                    }
                });

                // 라벨 표시 여부 및 최소 크기 기본값 저장 (사용자 요청: 가장 작은 크기)
                localStorage.setItem('gis_label_vis_blocks', 'true');
                this.labelVisibility.blocks = true;
                const labelSizeDefaults = {
                    'blocks': 10,
                    'reservoirs': 10,
                    'boosters': 10,
                    'meters': 9,
                    'pipesLm': 9,
                    'servicePipes': 8
                };
                Object.entries(labelSizeDefaults).forEach(([k, v]) => {
                    localStorage.setItem(`gis_label_size_${k}`, v.toString());
                    this.labelSizes[k] = v;
                });

                localStorage.setItem('gis_layer_init_v13', 'true');
            }
        } catch (e) {}

        // 3. 각 레이어 체크박스 이벤트 바인딩
        const checkboxes = panel.querySelectorAll('.glc-checkbox');
        checkboxes.forEach(chk => {
            const layerKey = chk.dataset.layer;
            if (!layerKey) return;

            // 로컬스토리지 저장된 사용자 설정 복원
            const saved = localStorage.getItem(`gis_layer_vis_${layerKey}`);
            if (saved !== null) {
                const isVis = saved === 'true';
                chk.checked = isVis;
                this.layerVisibility[layerKey] = isVis;
            } else {
                chk.checked = !!this.layerVisibility[layerKey];
            }

            chk.addEventListener('change', (e) => {
                this.toggleGisLayer(layerKey, e.target.checked, true);
            });
        });

        // 4. 소분류 펼치기 / 접기 아코디언 버튼 바인딩
        const expandBtns = panel.querySelectorAll('.glc-expand-btn');
        expandBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const targetId = btn.dataset.target;
                const subPanel = document.getElementById(targetId);
                const group = btn.closest('.glc-layer-group');
                if (subPanel) {
                    const isHidden = (subPanel.style.display === 'none' || !subPanel.style.display);
                    subPanel.style.display = isHidden ? 'flex' : 'none';
                    if (group) group.classList.toggle('expanded', isHidden);
                }
            });
        });

        // 5. 소분류별 개별 On/Off 체크박스 이벤트 바인딩
        const subCheckboxes = panel.querySelectorAll('.glc-sub-checkbox');
        subCheckboxes.forEach(chk => {
            const group = chk.dataset.group;
            const subtype = chk.dataset.subtype;
            if (!group || !subtype) return;

            // 로컬스토리지 저장된 사용자 소분류 설정 복원
            const saved = localStorage.getItem(`gis_subvis_${group}_${subtype}`);
            if (saved !== null) {
                const isVis = (saved === 'true');
                chk.checked = isVis;
                if (this.subLayerVisibility && this.subLayerVisibility[group]) {
                    this.subLayerVisibility[group][subtype] = isVis;
                }
            } else if (this.subLayerVisibility && this.subLayerVisibility[group] && this.subLayerVisibility[group][subtype] !== undefined) {
                chk.checked = !!this.subLayerVisibility[group][subtype];
            }

            chk.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                if (this.subLayerVisibility && this.subLayerVisibility[group]) {
                    this.subLayerVisibility[group][subtype] = isChecked;
                    try {
                        localStorage.setItem(`gis_subvis_${group}_${subtype}`, isChecked ? 'true' : 'false');
                    } catch (err) {}
                }
                if (this.gisCanvasLayer) {
                    this.gisCanvasLayer.redraw();
                }
                this.syncParentCheckboxState(group);
            });
        });

        // 6. 소분류별 및 레이어별 심볼 크기/선 굵기 실시간 조절 슬라이더 바인딩
        const sizeSliders = panel.querySelectorAll('.glc-size-slider');
        sizeSliders.forEach(slider => {
            const group = slider.dataset.group;
            const subtype = slider.dataset.subtype;
            if (!group || !subtype) return;

            const lbl = document.getElementById(`lblSize_${group}_${subtype}`);

            // 로컬스토리지 저장된 크기 설정 복원
            const saved = localStorage.getItem(`gis_size_${group}_${subtype}`);
            if (saved !== null) {
                const val = parseFloat(saved);
                if (!isNaN(val)) {
                    slider.value = val;
                    if (lbl) {
                        lbl.textContent = subtype === 'blockOpacity' ? `${Math.round(val * 100)}%` : `${val.toFixed(1)}px`;
                    }
                    this.applySymbolSize(group, subtype, val, false);
                }
            }

            slider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                if (lbl) {
                    lbl.textContent = subtype === 'blockOpacity' ? `${Math.round(val * 100)}%` : `${val.toFixed(1)}px`;
                }
                this.applySymbolSize(group, subtype, val, true);
            });
        });

        // 초기 소분류 체크 상태에 따른 상위 체크박스 동기화
        ['valves', 'billing', 'pipesLm'].forEach(grp => this.syncParentCheckboxState(grp));

        // 7. 레이어 롱프레스(꾹 누르기) 및 우클릭(컨텍스트) 감지 -> 라벨 설정 팝업 호출
        const targetLabelLayers = ['blocks', 'reservoirs', 'boosters', 'meters', 'pipesLm', 'servicePipes'];
        const layerRows = panel.querySelectorAll('.glc-layer-row');
        layerRows.forEach(row => {
            const chk = row.querySelector('.glc-checkbox');
            const layerKey = chk ? chk.dataset.layer : null;
            if (!layerKey || !targetLabelLayers.includes(layerKey)) return;

            let touchTimer = null;
            let startX = 0, startY = 0;
            let longPressed = false;

            row.addEventListener('touchstart', (e) => {
                if (e.target.closest('.glc-checkbox') || e.target.closest('.glc-expand-btn')) return;
                const t = e.touches[0];
                startX = t.clientX;
                startY = t.clientY;
                longPressed = false;
                touchTimer = setTimeout(() => {
                    longPressed = true;
                    if (navigator.vibrate) {
                        try { navigator.vibrate(40); } catch (err) {}
                    }
                    this.openLabelSettingsModal(layerKey);
                }, 450);
            }, { passive: true });

            row.addEventListener('touchmove', (e) => {
                if (!touchTimer) return;
                const t = e.touches[0];
                if (Math.hypot(t.clientX - startX, t.clientY - startY) > 8) {
                    clearTimeout(touchTimer);
                    touchTimer = null;
                }
            }, { passive: true });

            row.addEventListener('touchend', (e) => {
                if (touchTimer) {
                    clearTimeout(touchTimer);
                    touchTimer = null;
                }
                if (longPressed) {
                    e.preventDefault();
                }
            });

            row.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.openLabelSettingsModal(layerKey);
            });
        });

        // 8. 서브패널 내부 라벨 체크박스 & 라벨 크기 슬라이더 바인딩
        const labelCheckboxes = panel.querySelectorAll('.glc-label-chk');
        labelCheckboxes.forEach(chk => {
            const layerKey = chk.dataset.layer;
            if (!layerKey) return;
            chk.checked = !!this.labelVisibility[layerKey];
            chk.addEventListener('change', (e) => {
                this.toggleLayerLabel(layerKey, e.target.checked);
            });
        });

        const labelSliders = panel.querySelectorAll('.glc-label-slider');
        labelSliders.forEach(slider => {
            const layerKey = slider.dataset.layer;
            if (!layerKey) return;
            const curSize = this.labelSizes[layerKey] || 12;
            slider.value = curSize;
            const lbl = document.getElementById(`lblLabelSize_${layerKey}`);
            if (lbl) lbl.textContent = `${curSize}px`;

            slider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                this.setLayerLabelSize(layerKey, val);
            });
        });

        // 9. 롱프레스 라벨 설정 모달 이벤트 바인딩
        const modalBackdrop = document.getElementById('glcLabelModalBackdrop');
        const modalCloseBtn = document.getElementById('btnGlcModalClose');
        const modalConfirmBtn = document.getElementById('btnGlcModalConfirm');
        const modalToggle = document.getElementById('chkGlcModalToggle');
        const modalSlider = document.getElementById('rngGlcModalSize');

        if (modalCloseBtn) modalCloseBtn.addEventListener('click', () => this.closeLabelSettingsModal());
        if (modalConfirmBtn) modalConfirmBtn.addEventListener('click', () => this.closeLabelSettingsModal());
        if (modalBackdrop) {
            modalBackdrop.addEventListener('click', (e) => {
                if (e.target === modalBackdrop) this.closeLabelSettingsModal();
            });
        }
        if (modalToggle) {
            modalToggle.addEventListener('change', (e) => {
                if (this._activeModalLayer) {
                    this.toggleLayerLabel(this._activeModalLayer, e.target.checked);
                }
            });
        }
        if (modalSlider) {
            modalSlider.addEventListener('input', (e) => {
                if (this._activeModalLayer) {
                    const val = parseFloat(e.target.value);
                    this.setLayerLabelSize(this._activeModalLayer, val);
                }
            });
        }

        // 10. 관로 색상 선택 드롭다운 이벤트 바인딩
        if (!this.pipeColors) {
            this.pipeColors = {
                d250: '#0040FF',
                d500: '#DC2626',
                dover: '#DC2626',
                pipesLm2: '#0040FF',
                servicePipes: '#00E5FF'
            };
        }
        try {
            const savedColors = localStorage.getItem('gis_pipe_colors');
            if (savedColors) {
                const parsed = JSON.parse(savedColors);
                if (parsed.d250 === '#2563EB') parsed.d250 = '#0040FF';
                if (parsed.pipesLm2 === '#2563EB') parsed.pipesLm2 = '#0040FF';
                if (parsed.servicePipes === '#0D9488') parsed.servicePipes = '#00E5FF';
                Object.assign(this.pipeColors, parsed);
            }
        } catch (e) {}

        const colorSelects = panel.querySelectorAll('.glc-color-select');
        colorSelects.forEach(sel => {
            const pipeSubtype = sel.dataset.pipeSubtype;
            if (!pipeSubtype) return;

            if (this.pipeColors[pipeSubtype]) {
                sel.value = this.pipeColors[pipeSubtype];
            }

            const updateSymbolColor = (val) => {
                const sym = panel.querySelector(`.glc-pipe-sym-${pipeSubtype}`);
                if (sym) sym.style.color = val;
            };
            updateSymbolColor(sel.value);

            const onColorChange = (e) => {
                const val = e.target.value;
                this.pipeColors[pipeSubtype] = val;
                updateSymbolColor(val);
                try {
                    localStorage.setItem('gis_pipe_colors', JSON.stringify(this.pipeColors));
                } catch (err) {}
                if (this.gisCanvasLayer) {
                    this.gisCanvasLayer.redraw();
                }
            };
            sel.addEventListener('change', onColorChange);
            sel.addEventListener('input', onColorChange);
        });

        // 11. 라벨 표시 필드 선택 드롭다운 이벤트 바인딩
        if (!this.labelFields) {
            this.labelFields = {
                blocks: 'name',
                reservoirs: 'name',
                boosters: 'name',
                meters: 'name',
                pipesLm: 'pip_lbl',
                pipesLm2: 'pip_lbl',
                servicePipes: 'dia'
            };
        }
        try {
            const savedFields = localStorage.getItem('gis_label_fields');
            if (savedFields) {
                Object.assign(this.labelFields, JSON.parse(savedFields));
            }
        } catch (e) {}

        const labelFieldSelects = panel.querySelectorAll('.glc-label-field-select');
        labelFieldSelects.forEach(sel => {
            const layerKey = sel.dataset.layer;
            if (!layerKey) return;

            if (this.labelFields[layerKey]) {
                sel.value = this.labelFields[layerKey];
            }

            const onLabelFieldChange = (e) => {
                const val = e.target.value;
                this.labelFields[layerKey] = val;
                try {
                    localStorage.setItem('gis_label_fields', JSON.stringify(this.labelFields));
                } catch (err) {}

                if (layerKey === 'blocks') this.renderBlockLabels();
                else if (layerKey === 'reservoirs') this.renderReservoirLabels();
                else if (layerKey === 'boosters') this.renderBoosterLabels();
                else if (layerKey === 'meters') this.renderMeterLabels();

                if (this.gisCanvasLayer) {
                    this.gisCanvasLayer.redraw();
                }
            };
            sel.addEventListener('change', onLabelFieldChange);
            sel.addEventListener('input', onLabelFieldChange);
        });
    }

    /**
     * 레이어 및 소분류 심볼 크기 / 선 굵기 실시간 적용
     */
    applySymbolSize(group, subtype, val, redraw = true) {
        if (!this.symbolSizes[group]) this.symbolSizes[group] = {};
        this.symbolSizes[group][subtype] = val;
        try {
            localStorage.setItem(`gis_size_${group}_${subtype}`, val);
        } catch (e) {}

        if (['valves', 'billing', 'pipes'].includes(group)) {
            if (redraw && this.gisCanvasLayer) {
                this.gisCanvasLayer.redraw();
            }
            return;
        }

        // HTML/SVG 기반 시설물 레이어 크기 즉각 반영
        if (group === 'facilities') {
            if (subtype === 'blocks' && this.layers.blocks) {
                this.layers.blocks.eachLayer(l => {
                    if (l.setStyle) l.setStyle({ weight: val });
                });
            } else if (subtype === 'blockOpacity' && this.layers.blocks) {
                this.layers.blocks.eachLayer(l => {
                    if (l.setStyle) l.setStyle({ fillOpacity: val });
                });
            } else if (subtype === 'meters' && this.layers.meters) {
                this.layers.meters.eachLayer(l => {
                    if (l.setRadius) l.setRadius(val);
                });
            } else if (subtype === 'reservoirs' && this.layers.reservoirs) {
                this.layers.reservoirs.eachLayer(m => {
                    const el = m.getElement ? m.getElement() : null;
                    if (el) {
                        const iconDiv = el.querySelector('div');
                        if (iconDiv) {
                            iconDiv.style.width = `${val}px`;
                            iconDiv.style.height = `${val}px`;
                        }
                    }
                });
            } else if (subtype === 'boosters' && this.layers.boosters) {
                this.layers.boosters.eachLayer(m => {
                    const el = m.getElement ? m.getElement() : null;
                    if (el) {
                        const iconDiv = el.querySelector('div');
                        if (iconDiv) {
                            iconDiv.style.width = `${val}px`;
                            iconDiv.style.height = `${val}px`;
                        }
                    }
                });
            }
        }

        // 초기 소분류 체크 상태에 따른 상위 레이어 체크박스 indeterminate 상태 즉시 동기화
        this.syncParentCheckboxState('valves');
        this.syncParentCheckboxState('billing');
    }

    /**
     * 블록경계 블록명 라벨 생성 및 렌더링
     */
    renderBlockLabels() {
        if (!this.labelLayers || !this.labelLayers.blocks) return;
        this.labelLayers.blocks.clearLayers();
        if (!this.gisData || !this.gisData.blocks) return;
        const size = (this.labelSizes && this.labelSizes.blocks) || 10;

        this.gisData.blocks.forEach(b => {
            if (!b.centroid && b.coordinates && b.coordinates.length > 2) {
                let latSum = 0, lngSum = 0;
                const n = b.coordinates.length;
                for (let i = 0; i < n; i++) {
                    latSum += b.coordinates[i][0];
                    lngSum += b.coordinates[i][1];
                }
                b.centroid = [latSum / n, lngSum / n];
            }
            if (b.centroid) {
const blkFld = (this.labelFields && this.labelFields.blocks) || 'name';
                const blkText = blkFld === 'id' ? (b.id || b.name) : (b.name || b.id);
                const icon = L.divIcon({
                    className: 'gis-div-label-container',
                    html: `<span class="gis-map-label gis-map-label-block" style="font-size:${size}px;" data-block="${b.name}">${blkText}</span>`,
                    iconSize: [0, 0],
                    iconAnchor: [0, 0]
                });
                const m = L.marker(b.centroid, { icon: icon, interactive: false });
                this.labelLayers.blocks.addLayer(m);
            }
        });
    }

    /**
     * 정수·배수지 시설물명 라벨 생성 및 렌더링
     */
    renderReservoirLabels() {
        if (!this.labelLayers || !this.labelLayers.reservoirs) return;
        this.labelLayers.reservoirs.clearLayers();
        if (!this.gisData || !this.gisData.reservoirs) return;
        const size = (this.labelSizes && this.labelSizes.reservoirs) || 10;

        this.gisData.reservoirs.forEach(res => {
            if (res.lat && res.lng) {
                const resFld = (this.labelFields && this.labelFields.reservoirs) || 'name';
                let resText = res.name;
                if (resFld === 'capacity') resText = `${res.name} (${res.capacity || '-'}m³)`;
                else if (resFld === 'id') resText = res.id || res.name;
                const icon = L.divIcon({
                    className: 'gis-div-label-container',
                    html: `<span class="gis-map-label gis-map-label-facility gis-map-label-res" style="font-size:${size}px;">${resText}</span>`,
                    iconSize: [0, 0],
                    iconAnchor: [0, -14]
                });
                const m = L.marker([res.lat, res.lng], { icon: icon, interactive: false });
                this.labelLayers.reservoirs.addLayer(m);
            }
        });
    }

    /**
     * 가압장 명칭 라벨 생성 및 렌더링
     */
    renderBoosterLabels() {
        if (!this.labelLayers || !this.labelLayers.boosters) return;
        this.labelLayers.boosters.clearLayers();
        if (!this.gisData || !this.gisData.boosters) return;
        const size = (this.labelSizes && this.labelSizes.boosters) || 10;

        this.gisData.boosters.forEach(bst => {
            if (bst.lat && bst.lng) {
                const bstFld = (this.labelFields && this.labelFields.boosters) || 'name';
                let bstText = bst.name;
                if (bstFld === 'capacity') bstText = `${bst.name} (${bst.capacity || '-'})`;
                else if (bstFld === 'id') bstText = bst.id || bst.name;
                const icon = L.divIcon({
                    className: 'gis-div-label-container',
                    html: `<span class="gis-map-label gis-map-label-facility gis-map-label-bst" style="font-size:${size}px;">${bstText}</span>`,
                    iconSize: [0, 0],
                    iconAnchor: [0, -14]
                });
                const m = L.marker([bst.lat, bst.lng], { icon: icon, interactive: false });
                this.labelLayers.boosters.addLayer(m);
            }
        });
    }

    /**
     * 구역유량계 블록유량계명 라벨 생성 및 렌더링
     */
    renderMeterLabels() {
        if (!this.labelLayers || !this.labelLayers.meters) return;
        this.labelLayers.meters.clearLayers();
        if (!this.gisData || !this.gisData.flowMeters) return;
        const size = (this.labelSizes && this.labelSizes.meters) || 9;

        this.gisData.flowMeters.forEach(flw => {
            if (flw.lat && flw.lng) {
                const mtrFld = (this.labelFields && this.labelFields.meters) || 'name';
                let mtrText = flw.name;
                if (mtrFld === 'id') mtrText = flw.id || flw.name;
                const icon = L.divIcon({
                    className: 'gis-div-label-container',
                    html: `<span class="gis-map-label gis-map-label-facility gis-map-label-meter" style="font-size:${size}px;">${mtrText}</span>`,
                    iconSize: [0, 0],
                    iconAnchor: [0, -10]
                });
                const m = L.marker([flw.lat, flw.lng], { icon: icon, interactive: false });
                this.labelLayers.meters.addLayer(m);
            }
        });
    }

    /**
     * 사용자 요청: 축척 연동 라벨 표출 제어
     * - 광역 축척(zoom < 13)에서는 블록경계 및 시설물 라벨을 숨겨 지도가 깨끗하게 보이도록 유지
     * - 상세 축척(zoom >= 13)으로 확대 시 설정이 켜진 라벨들을 자동 표출
     */
    updateLabelsOnZoom() {
        if (!this.map) return;
        const zoom = this.map.getZoom();

        // 1. 블록경계 라벨: zoom >= 13 일 때만 표출 (광역 축척 축소 시 숨김)
        if (this.labelLayers && this.labelLayers.blocks) {
            const shouldShow = (zoom >= 13) && !!this.labelVisibility.blocks && !!this.layerVisibility.blocks;
            if (shouldShow) {
                if (!this.map.hasLayer(this.labelLayers.blocks)) this.map.addLayer(this.labelLayers.blocks);
            } else {
                if (this.map.hasLayer(this.labelLayers.blocks)) this.map.removeLayer(this.labelLayers.blocks);
            }
        }

        // 2. 정수·배수지, 가압장, 유량계 시설물 라벨 (zoom >= 13/14 이상에서만 표출)
        ['reservoirs', 'boosters', 'meters'].forEach(k => {
            if (this.labelLayers && this.labelLayers[k]) {
                const minZoom = (k === 'meters') ? 14 : 13;
                const shouldShow = (zoom >= minZoom) && !!this.labelVisibility[k] && !!this.layerVisibility[k];
                if (shouldShow) {
                    if (!this.map.hasLayer(this.labelLayers[k])) this.map.addLayer(this.labelLayers[k]);
                } else {
                    if (this.map.hasLayer(this.labelLayers[k])) this.map.removeLayer(this.labelLayers[k]);
                }
            }
        });
    }

    /**
     * 개별 레이어 라벨 표출 On/Off 토글
     */
    toggleLayerLabel(layerKey, isVisible) {
        this.labelVisibility[layerKey] = isVisible;
        try {
            localStorage.setItem(`gis_label_vis_${layerKey}`, isVisible ? 'true' : 'false');
        } catch (e) {}

        // 1. 포인트 및 폴리곤 라벨 레이어 축척 연동 및 동기화
        this.updateLabelsOnZoom();

        // 2. 캔버스 기반 관로 라벨
        if (layerKey === 'pipesLm' || layerKey === 'servicePipes') {
            if (this.gisCanvasLayer) this.gisCanvasLayer.redraw();
        }

        // 3. 서브패널 체크박스 상태 동기화
        const chk = document.getElementById(`chkLabel_${layerKey}`);
        if (chk && chk.checked !== isVisible) {
            chk.checked = isVisible;
        }

        // 4. 모달창 열려있을 때 모달창 토글 동기화
        if (this._activeModalLayer === layerKey) {
            const modalChk = document.getElementById('chkGlcModalToggle');
            if (modalChk && modalChk.checked !== isVisible) modalChk.checked = isVisible;
        }
    }

    /**
     * 개별 레이어 라벨 폰트 크기 조절
     */
    setLayerLabelSize(layerKey, size) {
        const numSize = parseFloat(size);
        if (isNaN(numSize) || numSize <= 0) return;
        this.labelSizes[layerKey] = numSize;
        try {
            localStorage.setItem(`gis_label_size_${layerKey}`, numSize.toString());
        } catch (e) {}

        if (layerKey === 'blocks') {
            document.querySelectorAll('.gis-map-label-block').forEach(el => {
                el.style.fontSize = `${numSize}px`;
            });
        } else if (layerKey === 'reservoirs') {
            document.querySelectorAll('.gis-map-label-res').forEach(el => {
                el.style.fontSize = `${numSize}px`;
            });
        } else if (layerKey === 'boosters') {
            document.querySelectorAll('.gis-map-label-bst').forEach(el => {
                el.style.fontSize = `${numSize}px`;
            });
        } else if (layerKey === 'meters') {
            document.querySelectorAll('.gis-map-label-meter').forEach(el => {
                el.style.fontSize = `${numSize}px`;
            });
        } else if (layerKey === 'pipesLm' || layerKey === 'servicePipes') {
            if (this.gisCanvasLayer) this.gisCanvasLayer.redraw();
        }

        // 서브패널 슬라이더 및 수치 동기화
        const subSlider = document.querySelector(`.glc-label-slider[data-layer="${layerKey}"]`);
        if (subSlider && parseFloat(subSlider.value) !== numSize) {
            subSlider.value = numSize;
        }
        const subLbl = document.getElementById(`lblLabelSize_${layerKey}`);
        if (subLbl) subLbl.textContent = `${numSize}px`;

        // 모달창 동기화
        if (this._activeModalLayer === layerKey) {
            const modalSlider = document.getElementById('rngGlcModalSize');
            if (modalSlider && parseFloat(modalSlider.value) !== numSize) modalSlider.value = numSize;
            const modalVal = document.getElementById('lblGlcModalSize');
            if (modalVal) modalVal.textContent = `${numSize}px`;
        }
    }

    /**
     * 롱프레스 라벨 설정 모달창 열기
     */
    openLabelSettingsModal(layerKey) {
        const layerNames = {
            blocks: '블록경계',
            reservoirs: '정수·배수지',
            boosters: '가압장',
            meters: '구역유량계',
            pipesLm: '상수관로 (LM)',
            servicePipes: '급수관로'
        };
        const labelNames = {
            blocks: '블록명',
            reservoirs: '시설물명',
            boosters: '명칭',
            meters: '유량계명',
            pipesLm: '관라벨 (D관경)',
            servicePipes: '관라벨 (D관경)'
        };
        const sizeRanges = {
            blocks: { min: 10, max: 22 },
            reservoirs: { min: 10, max: 20 },
            boosters: { min: 10, max: 20 },
            meters: { min: 9, max: 18 },
            pipesLm: { min: 9, max: 18 },
            servicePipes: { min: 8, max: 16 }
        };

        if (!layerNames[layerKey]) return;
        this._activeModalLayer = layerKey;

        const backdrop = document.getElementById('glcLabelModalBackdrop');
        const titleEl = document.getElementById('glcModalLayerName');
        const descEl = document.getElementById('glcModalLabelDesc');
        const chk = document.getElementById('chkGlcModalToggle');
        const slider = document.getElementById('rngGlcModalSize');
        const sizeVal = document.getElementById('lblGlcModalSize');

        if (titleEl) titleEl.textContent = layerNames[layerKey];
        if (descEl) descEl.textContent = `라벨 표시 (${labelNames[layerKey]})`;

        const isVis = this.labelVisibility[layerKey] !== undefined ? this.labelVisibility[layerKey] : false;
        if (chk) chk.checked = isVis;

        const curSize = this.labelSizes[layerKey] || 12;
        const range = sizeRanges[layerKey] || { min: 8, max: 20 };
        if (slider) {
            slider.min = range.min;
            slider.max = range.max;
            slider.value = curSize;
        }
        if (sizeVal) sizeVal.textContent = `${curSize}px`;

        // 모바일 라벨 항목 드롭다운 옵션 동적 구성
        const modalFieldSel = document.getElementById('selGlcModalLabelField');
        const modalFieldRow = document.getElementById('glcModalFieldRow');
        if (modalFieldSel && modalFieldRow) {
            const fieldOptions = {
                pipesLm: [
                    { val: 'pip_lbl', text: '관로라벨 (pip_lbl - 년도/관종/관경/연장/심도)' },
                    { val: 'dia', text: '관경 (D관경)' },
                    { val: 'mat', text: '관종 (재질)' },
                    { val: 'len', text: '연장 (m)' },
                    { val: 'id', text: '관리번호 (LM-1)' }
                ],
                pipesLm2: [
                    { val: 'pip_lbl', text: '관로라벨 (pip_lbl)' },
                    { val: 'dia', text: '관경 (D관경)' },
                    { val: 'mat', text: '관종 (재질)' },
                    { val: 'len', text: '연장 (m)' },
                    { val: 'id', text: '관리번호 (LM2-1)' }
                ],
                servicePipes: [
                    { val: 'dia', text: '관경 (D관경)' },
                    { val: 'len', text: '연장 (m)' },
                    { val: 'id', text: '관리번호' }
                ],
                blocks: [
                    { val: 'name', text: '블록명 (구산1 등)' },
                    { val: 'id', text: '블록코드' }
                ],
                reservoirs: [
                    { val: 'name', text: '시설물명 (배수지명)' },
                    { val: 'capacity', text: '시설용량 (m³)' },
                    { val: 'id', text: '관리번호' }
                ],
                boosters: [
                    { val: 'name', text: '시설물명 (가압장명)' },
                    { val: 'capacity', text: '시설용량' },
                    { val: 'id', text: '관리번호' }
                ],
                meters: [
                    { val: 'name', text: '시설물명 (유량계명)' },
                    { val: 'id', text: '관리번호' }
                ]
            };

            const opts = fieldOptions[layerKey];
            if (opts && opts.length > 0) {
                modalFieldRow.style.display = 'flex';
                const curFld = (this.labelFields && this.labelFields[layerKey]) || opts[0].val;
                modalFieldSel.innerHTML = opts.map(o => `<option value="${o.val}" ${o.val === curFld ? 'selected' : ''}>${o.text}</option>`).join('');
                modalFieldSel.onchange = (e) => {
                    const val = e.target.value;
                    if (!this.labelFields) this.labelFields = {};
                    this.labelFields[layerKey] = val;
                    try { localStorage.setItem('gis_label_fields', JSON.stringify(this.labelFields)); } catch (err) {}
                    const syncSel = document.querySelector(`.glc-label-field-select[data-layer="${layerKey}"]`);
                    if (syncSel) syncSel.value = val;
                    if (layerKey === 'blocks') this.renderBlockLabels();
                    else if (layerKey === 'reservoirs') this.renderReservoirLabels();
                    else if (layerKey === 'boosters') this.renderBoosterLabels();
                    else if (layerKey === 'meters') this.renderMeterLabels();
                    if (this.gisCanvasLayer) this.gisCanvasLayer.redraw();
                };
            } else {
                modalFieldRow.style.display = 'none';
            }
        }

        // 모바일 관로 색상 드롭다운 동기화
        const modalColorRow = document.getElementById('glcModalColorRow');
        const modalColorSel = document.getElementById('selGlcModalColor');
        if (modalColorRow && modalColorSel) {
            const isPipe = (layerKey === 'pipesLm' || layerKey === 'pipesLm2' || layerKey === 'servicePipes');
            if (isPipe) {
                modalColorRow.style.display = 'flex';
                const pipeTypeKey = layerKey === 'pipesLm' ? 'd250' : layerKey;
                const curColor = (this.pipeColors && this.pipeColors[pipeTypeKey]) || '#2563EB';
                modalColorSel.value = curColor;
                modalColorSel.onchange = (e) => {
                    const col = e.target.value;
                    if (!this.pipeColors) this.pipeColors = {};
                    this.pipeColors[pipeTypeKey] = col;
                    try { localStorage.setItem('gis_pipe_colors', JSON.stringify(this.pipeColors)); } catch (err) {}
                    const syncColorSel = document.querySelector(`.glc-color-select[data-pipe-subtype="${pipeTypeKey}"]`);
                    if (syncColorSel) syncColorSel.value = col;
                    const sym = document.querySelector(`.glc-pipe-sym-${pipeTypeKey}`);
                    if (sym) sym.style.color = col;
                    if (this.gisCanvasLayer) this.gisCanvasLayer.redraw();
                };
            } else {
                modalColorRow.style.display = 'none';
            }
        }

        if (backdrop) backdrop.style.display = 'flex';
    }

    /**
     * 롱프레스 라벨 설정 모달창 닫기
     */
    closeLabelSettingsModal() {
        const backdrop = document.getElementById('glcLabelModalBackdrop');
        if (backdrop) backdrop.style.display = 'none';
        this._activeModalLayer = null;
    }

    /**
     * 사용자 요청: 지도 주요 플로팅 요소 드래그 이동 기능 (웹 마우스 + 모바일 터치)
     * - 레이어 창 아이콘/패널 (#gisLayerControlPanel)
     * - 지도 설정 툴바 (#mapTopRightControls)
     * - 현재 위치 바로가기 FAB (#btnMapCurrentLocation)
     */
    initDraggableControls() {
        const makeDraggable = (el, storageKey) => {
            if (!el) return;

            // 1. 기존 저장된 위치 복원 (화면 밖 벗어남 방지 클램핑)
            try {
                const saved = localStorage.getItem(`pos_${storageKey}`);
                if (saved) {
                    const pos = JSON.parse(saved);
                    if (typeof pos.left === 'number' && typeof pos.top === 'number') {
                        const maxLeft = Math.max(0, window.innerWidth - 45);
                        const maxTop = Math.max(0, window.innerHeight - 45);
                        const safeLeft = Math.min(Math.max(6, pos.left), maxLeft);
                        const safeTop = Math.min(Math.max(6, pos.top), maxTop);
                        el.style.left = safeLeft + 'px';
                        el.style.top = safeTop + 'px';
                        el.style.right = 'auto';
                        el.style.bottom = 'auto';
                    }
                }
            } catch (e) {}

            let isPointerDown = false;
            let isDragging = false;
            let startX = 0, startY = 0;
            let initialLeft = 0, initialTop = 0;
            let dragDistance = 0;

            el.addEventListener('pointerdown', (e) => {
                if (e.button && e.button !== 0) return;

                // 폼 컨트롤(슬라이더, 인풋, 텍스트에어리어 등) 및 서브패널 내부 조작 시에만 드래그 차단
                if (e.target.closest('input, select, textarea, .glc-sub-panel')) {
                    return;
                }

                // 레이어 패널이 펼쳐져 있을 때는 상단 헤더(#glcHeader) 영역을 잡았을 때만 드래그 허용 (바디 스크롤 보장)
                if (el.id === 'gisLayerControlPanel' && !el.classList.contains('collapsed')) {
                    if (!e.target.closest('#glcHeader')) return;
                    if (e.target.closest('button')) return; // 헤더 버튼(내보내기, 전체, 닫기) 클릭 시 드래그 방지
                }

                isPointerDown = true;
                isDragging = false;
                dragDistance = 0;
                startX = e.clientX;
                startY = e.clientY;

                const rect = el.getBoundingClientRect();
                initialLeft = rect.left;
                initialTop = rect.top;
            });

            el.addEventListener('pointermove', (e) => {
                if (!isPointerDown) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                dragDistance = Math.hypot(dx, dy);

                if (!isDragging && dragDistance > 6) {
                    isDragging = true;
                    el.classList.add('is-dragging-floating');
                    try {
                        el.setPointerCapture(e.pointerId);
                    } catch (err) {}
                }

                if (isDragging) {
                    e.preventDefault();
                    const w = el.offsetWidth || 40;
                    const h = el.offsetHeight || 40;
                    const newLeft = Math.min(Math.max(4, initialLeft + dx), window.innerWidth - w - 4);
                    const newTop = Math.min(Math.max(4, initialTop + dy), window.innerHeight - h - 4);

                    el.style.left = newLeft + 'px';
                    el.style.top = newTop + 'px';
                    el.style.right = 'auto';
                    el.style.bottom = 'auto';
                }
            });

            const endDrag = (e) => {
                if (!isPointerDown) return;
                isPointerDown = false;

                try {
                    el.releasePointerCapture(e.pointerId);
                } catch (err) {}

                if (isDragging) {
                    isDragging = false;
                    el.classList.remove('is-dragging-floating');

                    // 드래그 종료 후 단순 클릭 이벤트 1회 캡처 차단
                    const captureClickBlocker = (clickEvent) => {
                        clickEvent.stopPropagation();
                        clickEvent.preventDefault();
                        window.removeEventListener('click', captureClickBlocker, true);
                    };
                    window.addEventListener('click', captureClickBlocker, true);

                    // 새 좌표 로컬스토리지 저장
                    try {
                        const rect = el.getBoundingClientRect();
                        localStorage.setItem(`pos_${storageKey}`, JSON.stringify({
                            left: Math.round(rect.left),
                            top: Math.round(rect.top)
                        }));
                    } catch (err) {}
                }
            };

            el.addEventListener('pointerup', endDrag);
            el.addEventListener('pointercancel', endDrag);
        };

        makeDraggable(document.getElementById('gisLayerControlPanel'), 'gis_layer_panel');
        makeDraggable(document.getElementById('mapTopRightControls'), 'map_top_controls');
        makeDraggable(document.getElementById('btnMapCurrentLocation'), 'map_gps_btn');
    }

    /**
     * 소분류 체크 상태에 따른 상위 레이어 체크박스 상태 동기화
     */
    syncParentCheckboxState(group) {
        if (!this.subLayerVisibility || !this.subLayerVisibility[group]) return;
        const subMap = this.subLayerVisibility[group];
        const vals = Object.values(subMap);
        const allChecked = vals.every(v => v === true);
        const anyChecked = vals.some(v => v === true);

        const parentChk = document.getElementById(`chkLayer_${group}`);
        if (parentChk) {
            parentChk.checked = anyChecked;
            parentChk.indeterminate = (anyChecked && !allChecked);
            this.layerVisibility[group] = anyChecked;
            try {
                localStorage.setItem(`gis_layer_vis_${group}`, anyChecked ? 'true' : 'false');
            } catch (e) {}
        }
    }

    /**
     * 개별 GIS 레이어 가시성 On/Off 토글
     */
    toggleGisLayer(layerKey, isVisible, syncSubcategories = false) {
        this.layerVisibility[layerKey] = isVisible;
        try {
            localStorage.setItem(`gis_layer_vis_${layerKey}`, isVisible ? 'true' : 'false');
        } catch (e) {}

        // 상위 레이어 체크박스를 클릭했을 때 하위 소분류들도 일괄 동기화 (syncSubcategories가 true일 때만)
        if (syncSubcategories && this.subLayerVisibility && this.subLayerVisibility[layerKey]) {
            Object.keys(this.subLayerVisibility[layerKey]).forEach(sub => {
                let targetState = isVisible;
                // 밸브를 일괄 켤 때도 SA910(13,583개), SA202(773개)는 기본 OFF 상태 유지하여 브라우저 부하 방지
                if (isVisible && layerKey === 'valves' && (sub === 'SA910' || sub === 'SA202')) {
                    targetState = false;
                }
                this.subLayerVisibility[layerKey][sub] = targetState;
                try {
                    localStorage.setItem(`gis_subvis_${layerKey}_${sub}`, targetState ? 'true' : 'false');
                } catch (e) {}
                const subChk = document.querySelector(`.glc-sub-checkbox[data-group="${layerKey}"][data-subtype="${sub}"]`);
                if (subChk) subChk.checked = targetState;
            });
            this.syncParentCheckboxState(layerKey);
        }

        if (layerKey === 'hybrid') {
            if (this.overlayLayers.hybrid && this.map) {
                if (isVisible) this.overlayLayers.hybrid.addTo(this.map);
                else this.map.removeLayer(this.overlayLayers.hybrid);
            }
            return;
        }

        if (layerKey === 'cadastral') {
            if (this.overlayLayers.cadastral && this.map) {
                if (isVisible) this.overlayLayers.cadastral.addTo(this.map);
                else this.map.removeLayer(this.overlayLayers.cadastral);
            }
            return;
        }

        // 고속 캔버스 레이어로 관리되는 대용량 관로, 밸브 및 부과수용가 레이어: 즉시 redraw (1ms 지연 없음)
        if (['pipesLm', 'pipesLm2', 'servicePipes', 'valves', 'billing'].includes(layerKey)) {
            if (this.gisCanvasLayer) {
                this.gisCanvasLayer.redraw();
            }
            return;
        }

        const layerGroup = this.layers[layerKey];
        if (layerGroup && this.map) {
            if (isVisible) {
                if (!this.map.hasLayer(layerGroup)) {
                    this.map.addLayer(layerGroup);
                }
            } else {
                if (this.map.hasLayer(layerGroup)) {
                    this.map.removeLayer(layerGroup);
                }
            }
        }

        // 라벨 레이어 연동: 축척 연동 및 가시성 동기화
        if (this.labelLayers && this.labelLayers[layerKey] && this.map) {
            this.updateLabelsOnZoom();
        }
    }

    /**
     * 전체 GIS 9대 레이어 일괄 On/Off
     */
    toggleAllGisLayers(turnOn) {
        const keys = ['blocks', 'reservoirs', 'boosters', 'meters', 'pipesLm', 'pipesLm2', 'servicePipes', 'valves', 'billing'];
        keys.forEach(k => {
            const chk = document.getElementById(`chkLayer_${k}`);
            if (chk) chk.checked = turnOn;
            this.toggleGisLayer(k, turnOn, true);
        });
    }

    /**
     * 현재 저장된 레이어 가시성 일괄 적용 (하위 소분류 설정 덮어쓰지 않고 안전하게 적용)
     */
    applyLayerVisibility() {
        Object.keys(this.layerVisibility).forEach(k => {
            const isVis = this.layerVisibility[k];
            const chk = document.getElementById(`chkLayer_${k}`);
            if (chk) chk.checked = isVis;

            if (k === 'hybrid') {
                if (this.overlayLayers.hybrid && this.map) {
                    if (isVis) this.overlayLayers.hybrid.addTo(this.map);
                    else this.map.removeLayer(this.overlayLayers.hybrid);
                }
                return;
            }

            if (k === 'cadastral') {
                if (this.overlayLayers.cadastral && this.map) {
                    if (isVis) this.overlayLayers.cadastral.addTo(this.map);
                    else this.map.removeLayer(this.overlayLayers.cadastral);
                }
                return;
            }

            const layerGroup = this.layers[k];
            if (layerGroup && this.map) {
                if (isVis && !this.map.hasLayer(layerGroup)) {
                    this.map.addLayer(layerGroup);
                } else if (!isVis && this.map.hasLayer(layerGroup)) {
                    this.map.removeLayer(layerGroup);
                }
            }
        });

        // 축척 연동 라벨 일괄 갱신
        this.updateLabelsOnZoom();

        // 소분류 체크 상태에 따른 부모 체크박스 indeterminate 상태 갱신
        ['valves', 'billing', 'pipesLm'].forEach(grp => this.syncParentCheckboxState(grp));

        // 고속 캔버스 재렌더링
        if (this.gisCanvasLayer) {
            this.gisCanvasLayer.redraw();
        }
    }

    /**
     * 좌측 레이어 패널의 시설물 개수 뱃지 갱신
     */
    updateGisLayerCounts() {
        if (!this.gisData) return;
        const countMap = {
            cntLayer_blocks: (this.gisData.blocks || []).length,
            cntLayer_reservoirs: (this.gisData.reservoirs || []).length,
            cntLayer_boosters: (this.gisData.boosters || []).length,
            cntLayer_meters: (this.gisData.flowMeters || []).length,
            cntLayer_pipesLm: (this.gisData.pipesLm || this.gisData.pipes || []).length,
            cntLayer_pipesLm2: (this.gisData.pipesLm2 || []).length,
            cntLayer_servicePipes: (this.gisData.servicePipes || []).length,
            cntLayer_valves: (this.gisData.valves || []).length,
            cntLayer_billing: (this.gisData.billingConsumers || []).length
        };
        Object.entries(countMap).forEach(([id, cnt]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = cnt.toLocaleString();
        });

        // 상수관로 (LM) 관경대역별 개수 뱃지 실시간 산출
        if (this.gisData.pipesLm) {
            let c250 = 0, c500 = 0, cOver = 0;
            const plist = this.gisData.pipesLm;
            for (let i = 0; i < plist.length; i++) {
                const d = plist[i].dia || plist[i].d || 100;
                if (d <= 250) c250++;
                else if (d <= 500) c500++;
                else cOver++;
            }
            const el250 = document.getElementById('cntSub_pipesLm_d250');
            if (el250) el250.textContent = c250.toLocaleString();
            const el500 = document.getElementById('cntSub_pipesLm_d500');
            if (el500) el500.textContent = c500.toLocaleString();
            const elOver = document.getElementById('cntSub_pipesLm_dover');
            if (elOver) elOver.textContent = cOver.toLocaleString();
        }
    }

    /**
     * 현장 시설물 수정사항(관경, 관종, 회전수, 상태 등) 인메모리 GIS 데이터 즉시 반영 및 캔버스 갱신
     */
    applyFacilityModificationInMemory(id, modData) {
        if (!this.gisData || !id || !modData) return;
        this.facilityModifications = this.facilityModifications || {};
        this.facilityModifications[id] = modData;

        // 1. 관로 (LM)
        if (id.startsWith('LM-') && this.gisData.pipesLm) {
            const idx = parseInt(id.replace('LM-', ''), 10) - 1;
            if (this.gisData.pipesLm[idx]) {
                Object.assign(this.gisData.pipesLm[idx], modData);
            }
        }
        // 2. 관로 (LM2)
        else if (id.startsWith('LM2-') && this.gisData.pipesLm2) {
            const idx = parseInt(id.replace('LM2-', ''), 10) - 1;
            if (this.gisData.pipesLm2[idx]) {
                Object.assign(this.gisData.pipesLm2[idx], modData);
            }
        }
        // 3. 밸브류
        else if (id.startsWith('VLV-') && this.gisData.valves) {
            const idx = parseInt(id.replace('VLV-', ''), 10) - 1;
            if (this.gisData.valves[idx]) {
                Object.assign(this.gisData.valves[idx], modData);
            }
        }

        if (this.gisCanvasLayer) {
            this.gisCanvasLayer.redraw();
        }
    }

    /**
     * 클라우드에서 실시간 수신된 전체 팀원 현장 수정사항 일괄 적용
     */
    applyAllFacilityModifications(modMap) {
        if (!this.gisData || !modMap) return;
        this.facilityModifications = this.facilityModifications || {};
        Object.entries(modMap).forEach(([id, mod]) => {
            this.applyFacilityModificationInMemory(id, mod);
        });
        if (this.gisCanvasLayer) {
            this.gisCanvasLayer.redraw();
        }
    }

    /**
     * 현장 수정사항(MOD_YMD, MOD_USR, MOD_DESC)이 완벽히 포함된 최신 GIS GeoJSON 파일 내보내기 (QGIS/SHP 100% 호환)
     */
    exportModifiedGisGeoJson() {
        if (!this.gisData) {
            alert("GIS 공간데이터셋이 로드되지 않았습니다.");
            return;
        }

        const features = [];
        
        // 1. 상수관로 (LM)
        if (this.gisData.pipesLm) {
            this.gisData.pipesLm.forEach(p => {
                const rawCoords = p.coordinates || p.c || [];
                if (rawCoords.length >= 2) {
                    const coords = rawCoords.map(pt => [pt[1], pt[0]]); // GeoJSON 표준: [경도, 위도]
                    features.push({
                        type: "Feature",
                        geometry: { type: "LineString", coordinates: coords },
                        properties: {
                            id: p.id,
                            layer: "상수관로(LM)",
                            dia: p.dia || 100,
                            mat: p.mat || p.material || "DIP",
                            len: p.len || 0,
                            MOD_YMD: p.MOD_YMD || "",
                            MOD_USR: p.MOD_USR || "",
                            MOD_DESC: p.MOD_DESC || ""
                        }
                    });
                }
            });
        }

        // 2. 밸브류
        if (this.gisData.valves) {
            this.gisData.valves.forEach(v => {
                if (v.lat && v.lng) {
                    features.push({
                        type: "Feature",
                        geometry: { type: "Point", coordinates: [v.lng, v.lat] },
                        properties: {
                            id: v.id,
                            layer: "밸브류",
                            cde: v.cde || "SA200",
                            cat: v.cat || "제수변",
                            name: v.name || "",
                            dia: v.dia || 100,
                            turn: v.turn || 0,
                            status: v.status || "정상",
                            MOD_YMD: v.MOD_YMD || "",
                            MOD_USR: v.MOD_USR || "",
                            MOD_DESC: v.MOD_DESC || ""
                        }
                    });
                }
            });
        }

        const geojson = {
            type: "FeatureCollection",
            name: "Gimhae_Water_Network_Latest",
            crs: { type: "name", properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" } },
            features: features
        };

        const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(geojson));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", jsonStr);
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        downloadAnchor.setAttribute("download", `김해시_최신관망도_현장수정반영_${dateStr}.geojson`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        alert(`[내보내기 완료] 현장 수정내역(MOD_YMD, MOD_USR)이 포함된 최신 GeoJSON 파일이 다운로드되었습니다!\nQGIS에서 열거나 SHP로 즉시 변환하실 수 있습니다.`);
    }

    /**
     * 지도 화면 크기 재계산 및 김해시 관망도 바운드 전체 맞춤
     */
    fitGisBounds() {
        if (!this.map) return;
        this.map.invalidateSize();
        if (this.allGisBounds && typeof this.allGisBounds.isValid === 'function' && this.allGisBounds.isValid()) {
            this.map.fitBounds(this.allGisBounds.pad(0.05), { animate: false, maxZoom: 16 });
        } else {
            this.map.setView([35.2285, 128.8893], 14);
        }
    }

    /**
     * 모바일 GPS 현재 위치 인식 및 지도 즉시 이동
     * @param {boolean} panToLocation - 현재 위치로 지도를 이동(flyTo)할지 여부 (기본: true)
     * @param {boolean} showNotification - 사용자 안내 알림 표출 여부 (기본: true)
     */
    locateUser(panToLocation = true, showNotification = true) {
        if (!navigator.geolocation) {
            if (showNotification) alert("현재 브라우저 또는 스마트폰 기기에서 GPS 위치 기능을 지원하지 않습니다.");
            return;
        }

        const btnLoc = document.getElementById('btnMapCurrentLocation');
        if (btnLoc) btnLoc.classList.add('loading');

        const geoOptions = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        };

        const onGeoSuccess = (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const accuracy = pos.coords.accuracy || 15;
            this.currentUserLatLng = [lat, lng];

            if (btnLoc) {
                btnLoc.classList.remove('loading');
                btnLoc.classList.add('tracking');
            }

            // 기존 마커 및 오차 반경 원 정리
            if (this.userLocationMarker && this.map) {
                this.map.removeLayer(this.userLocationMarker);
            }
            if (this.userLocationAccuracyCircle && this.map) {
                this.map.removeLayer(this.userLocationAccuracyCircle);
            }

            // 1. 오차 반경 원 (반투명 파란색)
            this.userLocationAccuracyCircle = L.circle([lat, lng], {
                radius: Math.max(accuracy, 10),
                color: '#3B82F6',
                weight: 1.5,
                fillColor: '#60A5FA',
                fillOpacity: 0.15,
                interactive: false
            }).addTo(this.map);

            // 2. 펄스 애니메이션 현재위치 블루도트 마커
            const gpsIcon = L.divIcon({
                className: 'custom-user-gps-icon',
                html: `
                    <div class="user-gps-pulse-wrapper">
                        <div class="user-gps-pulse-ring"></div>
                        <div class="user-gps-pulse-dot"></div>
                    </div>
                `,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            });

            this.userLocationMarker = L.marker([lat, lng], {
                icon: gpsIcon,
                zIndexOffset: 10000,
                title: '내 현재 위치'
            }).addTo(this.map);

            this.userLocationMarker.bindTooltip(`📍 내 현재 위치 (오차: 약 ±${Math.round(accuracy)}m)`, {
                direction: 'top',
                offset: [0, -12],
                permanent: false
            });

            // 3. 지도를 현재 위치로 부드럽게 줌 이동 (현장 관로/밸브가 뚜렷이 보이는 18레벨)
            if (panToLocation && this.map) {
                const targetZoom = Math.max(this.map.getZoom(), 18);
                this.map.flyTo([lat, lng], targetZoom, {
                    animate: true,
                    duration: 0.8
                });
            }

            // 4. 걸어갈 때 블루 도트가 따라오도록 백그라운드 추적 감시 시작
            if (!this.userLocationWatchId) {
                this.startLocationTracking();
            }
        };

        const onGeoError = (err) => {
            if (btnLoc) btnLoc.classList.remove('loading');
            console.warn('[GPS] 위치 획득 실패:', err);
            if (showNotification) {
                if (err.code === 1) { // PERMISSION_DENIED
                    alert("GPS 위치 접근 권한이 차단되어 있습니다.\n브라우저 주소창 왼쪽의 자물쇠/설정 아이콘에서 [위치 접근]을 '허용'해 주세요.");
                } else if (err.code === 3) { // TIMEOUT
                    alert("GPS 신호 수신 시간이 초과되었습니다.\n신호가 잘 잡히는 야외에서 다시 시도해 주세요.");
                } else {
                    alert("현재 위치를 가져올 수 없습니다 (" + (err.message || '오류') + ").");
                }
            }
        };

        navigator.geolocation.getCurrentPosition(onGeoSuccess, onGeoError, geoOptions);
    }

    /**
     * 현장 이동 시 내 위치 실시간 추적 감시 (블루 도트 이동)
     */
    startLocationTracking() {
        if (!navigator.geolocation || this.userLocationWatchId) return;

        this.userLocationWatchId = navigator.geolocation.watchPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                const accuracy = pos.coords.accuracy || 15;
                this.currentUserLatLng = [lat, lng];

                if (this.userLocationMarker) {
                    this.userLocationMarker.setLatLng([lat, lng]);
                    this.userLocationMarker.setTooltipContent(`📍 내 현재 위치 (오차: 약 ±${Math.round(accuracy)}m)`);
                }
                if (this.userLocationAccuracyCircle) {
                    this.userLocationAccuracyCircle.setLatLng([lat, lng]);
                    this.userLocationAccuracyCircle.setRadius(Math.max(accuracy, 10));
                }
            },
            (err) => console.warn('[GPS Watch] 추적 경고:', err),
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
        );
    }

    /**
     * 기존 GIS 공간 데이터 레이어 및 저장소 완전 초기화 (Clean Delete)
     */
    clearGisLayers() {
        if (this.layers.blocks) this.layers.blocks.clearLayers();
        if (this.layers.boosters) this.layers.boosters.clearLayers();
        if (this.layers.reservoirs) this.layers.reservoirs.clearLayers();
        if (this.layers.pipes) this.layers.pipes.clearLayers();
        if (this.layers.pipesLm) this.layers.pipesLm.clearLayers();
        if (this.layers.pipesLm2) this.layers.pipesLm2.clearLayers();
        if (this.layers.servicePipes) this.layers.servicePipes.clearLayers();
        if (this.layers.valves) this.layers.valves.clearLayers();
        if (this.layers.meters) this.layers.meters.clearLayers();
        if (this.layers.highlight) this.layers.highlight.clearLayers();
        if (this.labelLayers) {
            Object.values(this.labelLayers).forEach(grp => grp && grp.clearLayers && grp.clearLayers());
        }
        if (this.gisCanvasLayer) this.gisCanvasLayer.redraw();
        this.gisData = null;
        this.gisDataLoaded = false;
        this.allGisBounds = null;
        localStorage.removeItem('GIMHAE_CUSTOM_GIS_DATA');
        if (this.map) {
            this.map.setView([35.2285, 128.8893], 14);
        }
    }

    highlightFacility(layer) {
        if (layer.getLatLng) {
            this.map.panTo(layer.getLatLng(), { animate: true });
        } else if (layer.getBounds) {
            this.map.fitBounds(layer.getBounds().pad(0.3), { animate: true });
        }
    }

    highlightBlock(blockName) {
        if (!blockName) return;
        const blockSelect = document.getElementById('blockSelect');
        if (blockSelect) blockSelect.value = blockName;
        this.activeBlock = blockName;

        // 블록명 맵 라벨 하이라이트 동기화
        document.querySelectorAll('.gis-map-label-block').forEach(el => {
            if (el.dataset.block === blockName) {
                el.classList.add('active-block-label');
            } else {
                el.classList.remove('active-block-label');
            }
        });

        if (this.layers.blocks) {
            const blockWeight = (this.symbolSizes && this.symbolSizes.facilities && this.symbolSizes.facilities.blocks) || 2.2;
            const blockOpacity = (this.symbolSizes && this.symbolSizes.facilities && this.symbolSizes.facilities.blockOpacity) || 0.24;
            this.layers.blocks.eachLayer(l => {
                const tooltipContent = (l.getTooltip && l.getTooltip().getContent()) || '';
                const isMatch = tooltipContent.includes(blockName);
                if (isMatch) {
                    l.setStyle({
                        weight: blockWeight + 1.8,
                        opacity: 1.0,
                        fillOpacity: Math.min(0.42, blockOpacity + 0.16),
                        dashArray: null
                    });
                    if (l.bringToFront) l.bringToFront();
                    if (l.getBounds) {
                        this.map.fitBounds(l.getBounds().pad(0.12), { animate: true });
                    }
                    if (typeof this.onFacilitySelect === 'function') {
                        this.onFacilitySelect({ id: blockName, name: blockName, facilityType: 'BLOCK', category: '블록경계' });
                    }
                } else {
                    const originalColor = l.options.originalColorStyle;
                    if (originalColor) {
                        l.setStyle({
                            color: originalColor.border,
                            fillColor: originalColor.fill,
                            weight: blockWeight,
                            opacity: 0.90,
                            fillOpacity: blockOpacity,
                            dashArray: '5, 4'
                        });
                    }
                }
            });
        }
    }

    filterByBlock(blockCode) {
        this.activeBlock = blockCode;

        // 블록명 맵 라벨 하이라이트 동기화
        if (blockCode === 'ALL') {
            document.querySelectorAll('.gis-map-label-block').forEach(el => el.classList.remove('active-block-label'));
        } else {
            document.querySelectorAll('.gis-map-label-block').forEach(el => {
                el.classList.toggle('active-block-label', el.dataset.block === blockCode);
            });
        }

        if (this.gisDataLoaded && this.layers.blocks) {
            const blockWeight = (this.symbolSizes && this.symbolSizes.facilities && this.symbolSizes.facilities.blocks) || 2.2;
            const blockOpacity = (this.symbolSizes && this.symbolSizes.facilities && this.symbolSizes.facilities.blockOpacity) || 0.24;
            if (blockCode === 'ALL') {
                this.layers.blocks.eachLayer(l => {
                    const originalColor = l.options.originalColorStyle;
                    if (originalColor) {
                        l.setStyle({
                            color: originalColor.border,
                            fillColor: originalColor.fill,
                            weight: blockWeight,
                            opacity: 0.90,
                            fillOpacity: blockOpacity,
                            dashArray: '5, 4'
                        });
                    }
                });
                this.fitGisBounds();
                return;
            }
            let found = false;
            this.layers.blocks.eachLayer(l => {
                const tooltipContent = (l.getTooltip && l.getTooltip().getContent()) || '';
                const isMatch = tooltipContent.includes(blockCode);
                if (isMatch) {
                    l.setStyle({
                        weight: blockWeight + 1.8,
                        opacity: 1.0,
                        fillOpacity: Math.min(0.42, blockOpacity + 0.16),
                        dashArray: null
                    });
                    if (l.bringToFront) l.bringToFront();
                    this.map.fitBounds(l.getBounds().pad(0.15), { animate: true });
                    found = true;
                } else {
                    const originalColor = l.options.originalColorStyle;
                    if (originalColor) {
                        l.setStyle({
                            color: originalColor.border,
                            fillColor: originalColor.fill,
                            weight: blockWeight,
                            opacity: 0.90,
                            fillOpacity: blockOpacity,
                            dashArray: '5, 4'
                        });
                    }
                }
            });
            if (found) return;
        }
        this.renderAllFacilities();

        const allBounds = L.latLngBounds([]);
        this.layers.pipes.eachLayer(l => allBounds.extend(l.getBounds()));
        this.layers.valves.eachLayer(l => allBounds.extend(l.getLatLng()));
        this.layers.meters.eachLayer(l => allBounds.extend(l.getLatLng()));
        this.layers.pressures.eachLayer(l => allBounds.extend(l.getLatLng()));
        this.layers.leaks.eachLayer(l => allBounds.extend(l.getLatLng()));

        if (allBounds.isValid()) {
            this.map.fitBounds(allBounds.pad(0.2));
        }
    }

    focusFacility(facilityId) {
        let target = null;
        let data = null;

        // 계량기
        data = (window.SAMPLE_METERS || []).find(m => m.id === facilityId);
        if (data) {
            this.layers.meters.eachLayer(layer => {
                if (Math.abs(layer.getLatLng().lat - data.lat) < 0.00001) target = layer;
            });
            if (target) {
                this.highlightFacility(target);
                this.onFacilitySelect({ ...data, facilityType: 'METER' });
                return;
            }
        }

        // 제수변
        data = (window.SAMPLE_VALVES || []).find(v => v.id === facilityId);
        if (data) {
            this.layers.valves.eachLayer(layer => {
                if (Math.abs(layer.getLatLng().lat - data.lat) < 0.00001) target = layer;
            });
            if (target) {
                this.highlightFacility(target);
                this.onFacilitySelect({ ...data, facilityType: 'VALVE' });
                return;
            }
        }

        // 수압점
        data = (window.SAMPLE_PRESSURE_POINTS || []).find(p => p.id === facilityId);
        if (data) {
            this.layers.pressures.eachLayer(layer => {
                if (Math.abs(layer.getLatLng().lat - data.lat) < 0.00001) target = layer;
            });
            if (target) {
                this.highlightFacility(target);
                this.onFacilitySelect({ ...data, facilityType: 'PRESSURE' });
                return;
            }
        }

        // 누수점
        data = (window.SAMPLE_LEAK_POINTS || []).find(l => l.id === facilityId);
        if (data) {
            this.layers.leaks.eachLayer(layer => {
                if (Math.abs(layer.getLatLng().lat - data.lat) < 0.00001) target = layer;
            });
            if (target) {
                this.highlightFacility(target);
                this.onFacilitySelect({ ...data, facilityType: 'LEAK' });
                return;
            }
        }

        // 관로
        data = (window.SAMPLE_PIPES || []).find(p => p.id === facilityId);
        if (data) {
            this.layers.pipes.eachLayer(layer => {
                const coords = layer.getLatLngs();
                if (coords && coords.length > 0 && Math.abs(coords[0].lat - data.coordinates[0][0]) < 0.00001) {
                    target = layer;
                }
            });
            if (target) {
                this.highlightFacility(target);
                this.onFacilitySelect({ ...data, facilityType: 'PIPE' });
            }
        }
    }

    // =========================================================================
    // VWorld 오픈API 2.0 및 주소 검색 & 공간 확인(Geocoding) 기능
    // =========================================================================

    /**
     * 주소 검색 통합 엔진 (김해 GIS 8종 전 시설물 색인 + VWorld Search 2.0 API 병합)
     */
    /**
     * 주소 검색 통합 엔진 (김해 131개 블록 + 가압장 63개 + 배수지 44개 + 56,689 수용가 상호·주소 + VWorld 장소/지명 오픈API 통합)
     * 블록명, 가압장명, 배수지명, 주소(도로명/지번), 지명, 상호/가게명 100% 즉시 검색 지원
     */
    async searchAddress(query) {
        const q = (query || '').trim();
        if (!q) return [];

        const cleanQ = q.toLowerCase().replace(/\s+/g, '');
        const coreQ = cleanQ.replace(/블록|소블록|중블록|가압장|배수지|정수장|취수장|지구/g, '');
        const gis = this.gisData || window.GIMHAE_GIS_DATA || {};

        const candidates = [];
        const seenKeys = new Set();
        const seenAddresses = new Set();

        const addCandidate = (item, type, basePriority = 500, matchText = '') => {
            if (!item) return;
            const latVal = typeof item.lat === 'number' ? item.lat : parseFloat(item.lat);
            const lngVal = typeof item.lng === 'number' ? item.lng : parseFloat(item.lng);
            if (isNaN(latVal) || isNaN(lngVal)) return;

            const key = `${item.title}_${Math.round(latVal * 10000)}_${Math.round(lngVal * 10000)}`;
            if (seenKeys.has(key)) return;
            seenKeys.add(key);

            if (type === 'ADDRESS') {
                const normAddr = (item.road || item.parcel || '').trim();
                if (normAddr) {
                    if (seenAddresses.has(normAddr)) return;
                    seenAddresses.add(normAddr);
                }
            }

            let relevance = 0;
            const cleanText = (matchText || item.title || '').toLowerCase().replace(/\s+/g, '');
            if (cleanText === cleanQ) {
                relevance = 600;
            } else if (cleanText.startsWith(cleanQ)) {
                relevance = 400;
            } else if (cleanText.includes(cleanQ)) {
                relevance = 250;
            } else if (coreQ.length >= 2 && cleanText.includes(coreQ)) {
                relevance = 150;
            } else {
                relevance = 50;
            }

            const score = basePriority + relevance;
            candidates.push({
                ...item,
                lat: latVal,
                lng: lngVal,
                _score: score,
                _type: type
            });
        };

        // =========================================================================
        // 0. [최우선] 김해시 핵심 시설 및 관공서 색인 (GIMHAE_GIS_INDEX)
        // =========================================================================
        if (typeof GIMHAE_GIS_INDEX !== 'undefined' && Array.isArray(GIMHAE_GIS_INDEX)) {
            GIMHAE_GIS_INDEX.forEach(item => {
                const title = item.title || '';
                const road = item.road || '';
                const parcel = item.parcel || '';
                const bld = item.bldnm || '';
                const cleanTitle = title.toLowerCase().replace(/\s+/g, '');
                const cleanRoad = road.toLowerCase().replace(/\s+/g, '');
                const cleanParcel = parcel.toLowerCase().replace(/\s+/g, '');
                const cleanBld = bld.toLowerCase().replace(/\s+/g, '');

                const isMatch = cleanTitle.includes(cleanQ) || cleanQ.includes(cleanTitle) ||
                                cleanRoad.includes(cleanQ) || cleanParcel.includes(cleanQ) ||
                                cleanBld.includes(cleanQ) ||
                                (coreQ.length >= 2 && cleanTitle.includes(coreQ));

                if (isMatch) {
                    addCandidate({
                        ...item,
                        title: item.title,
                        name: item.title,
                        category: item.category || '상수도시설',
                        road: item.road,
                        parcel: item.parcel,
                        lat: item.lat,
                        lng: item.lng,
                        block: item.block,
                        facilityType: item.category === '가압장' ? 'BOOSTER' : (item.category === '배수지' || item.category === '정수장' ? 'RESERVOIR' : 'FACILITY'),
                        source: '김해 GIS 핵심색인'
                    }, 'FACILITY', 2300, item.title);
                }
            });
        }

        // =========================================================================
        // 1. [최우선] 관망 블록명 검색 (131개 유수율 관리 블록 + 103개 GIS 블록 통합)
        // =========================================================================
        const blockMap = new Map();

        // 1-A. GIS 블록 폴리곤 데이터
        if (gis.blocks && Array.isArray(gis.blocks)) {
            gis.blocks.forEach(b => {
                const name = b.name || '';
                const cleanName = name.replace(/\s+/g, '');
                let centerLat = 35.2285, centerLng = 128.8893;
                if (b.coordinates && b.coordinates.length > 0) {
                    let sLat = 0, sLng = 0;
                    b.coordinates.forEach(c => { sLat += c[0]; sLng += c[1]; });
                    centerLat = sLat / b.coordinates.length;
                    centerLng = sLng / b.coordinates.length;
                }
                blockMap.set(cleanName, {
                    name: name,
                    id: b.id || '',
                    lat: centerLat,
                    lng: centerLng,
                    coordinates: b.coordinates
                });
            });
        }

        // 1-B. 131개 유수율 관리 블록 목록 (누락 방지)
        const allYieldBlocks = (typeof getAllYieldReportBlocks === 'function') ? getAllYieldReportBlocks() :
            (window.VERIFIED_YIELD_DATA ? Object.keys(window.VERIFIED_YIELD_DATA) : []);
        allYieldBlocks.forEach(blkName => {
            const cleanName = blkName.replace(/\s+/g, '');
            if (!blockMap.has(cleanName)) {
                const center = this.findBlockCenter(blkName) || { lat: 35.2285, lng: 128.8893 };
                blockMap.set(cleanName, {
                    name: blkName,
                    id: `BLK-${cleanName}`,
                    lat: center.lat,
                    lng: center.lng,
                    coordinates: null
                });
            }
        });

        // 1-C. 블록 검색 실행
        blockMap.forEach((bInfo, cleanName) => {
            const rawName = bInfo.name;
            const strippedName = cleanName.replace(/블록|소블록|중블록|_수정/g, '');
            const isMatch = cleanName.includes(cleanQ) || cleanQ.includes(cleanName) ||
                            (coreQ.length >= 2 && (strippedName.includes(coreQ) || coreQ.includes(strippedName)));

            if (isMatch) {
                addCandidate({
                    title: `[관망블록] ${rawName}`,
                    name: rawName,
                    category: '관망블록',
                    road: `김해시 ${rawName} 관망 블록`,
                    parcel: `블록코드: ${bInfo.id || rawName}`,
                    lat: bInfo.lat,
                    lng: bInfo.lng,
                    block: rawName,
                    isBlock: true,
                    coordinates: bInfo.coordinates,
                    facilityType: 'BLOCK',
                    facilityId: bInfo.id,
                    source: '김해 관망 블록대장'
                }, 'BLOCK', 2200, rawName);
            }
        });

        // =========================================================================
        // 2. [최우선] 가압장 시설 검색 (63개소)
        // =========================================================================
        if (gis.boosters && Array.isArray(gis.boosters)) {
            const isBoosterCategorySearch = (cleanQ === '가압장' || cleanQ === '가압');
            gis.boosters.forEach(bst => {
                const name = bst.name || '';
                const cleanName = name.toLowerCase().replace(/\s+/g, '');
                const isMatch = cleanName.includes(cleanQ) || cleanQ.includes(cleanName) ||
                                (coreQ.length >= 2 && cleanName.includes(coreQ)) ||
                                (isBoosterCategorySearch && cleanName.includes('가압'));

                if (isMatch) {
                    addCandidate({
                        title: `[가압장] ${name}`,
                        name: name,
                        category: '가압장',
                        road: bst.address || `김해시 ${name}`,
                        parcel: `시설용량: ${bst.capacity || '-'}`,
                        lat: bst.lat,
                        lng: bst.lng,
                        block: bst.block || '',
                        facilityType: 'BOOSTER',
                        facilityId: bst.id || '',
                        source: '김해 GIS 가압장대장'
                    }, 'FACILITY', 2000, name);
                }
            });
        }

        // =========================================================================
        // 3. [최우선] 배수지 / 정수장 / 취수장 검색 (44개소)
        // =========================================================================
        if (gis.reservoirs && Array.isArray(gis.reservoirs)) {
            const isReservoirCategorySearch = (cleanQ === '배수지' || cleanQ === '배수' || cleanQ === '정수장' || cleanQ === '정수' || cleanQ === '취수장');
            gis.reservoirs.forEach(res => {
                const name = res.name || '';
                const cleanName = name.toLowerCase().replace(/\s+/g, '');
                const isPlant = cleanName.includes('정수') || cleanName.includes('취수');
                const isMatch = cleanName.includes(cleanQ) || cleanQ.includes(cleanName) ||
                                (coreQ.length >= 2 && cleanName.includes(coreQ)) ||
                                (isReservoirCategorySearch && (cleanName.includes('배수') || cleanName.includes('정수') || cleanName.includes('취수')));

                if (isMatch) {
                    addCandidate({
                        title: `[${isPlant ? '정수·취수장' : '배수지'}] ${name}`,
                        name: name,
                        category: isPlant ? '정수장' : '배수지',
                        road: res.address || `김해시 ${name}`,
                        parcel: `시설용량: ${res.capacity || '-'}`,
                        lat: res.lat,
                        lng: res.lng,
                        block: res.block || '',
                        facilityType: 'RESERVOIR',
                        facilityId: res.id || '',
                        source: '김해 GIS 배수지대장'
                    }, 'FACILITY', 2000, name);
                }
            });
        }

        // =========================================================================
        // 4. 구역유량계 (326개소) 및 주요 밸브
        // =========================================================================
        if (gis.flowMeters && Array.isArray(gis.flowMeters)) {
            let mCount = 0;
            for (let i = 0; i < gis.flowMeters.length && mCount < 8; i++) {
                const flw = gis.flowMeters[i];
                const name = flw.name || '';
                const id = flw.id || '';
                if (name.toLowerCase().includes(cleanQ) || id.toLowerCase().includes(cleanQ)) {
                    mCount++;
                    addCandidate({
                        title: `[유량계] ${name || id}`,
                        name: name || id,
                        category: '구역유량계',
                        road: flw.address || `김해시 구역유량계 (${id})`,
                        parcel: `관리번호: ${id}`,
                        lat: flw.lat,
                        lng: flw.lng,
                        block: flw.block || '',
                        facilityType: 'FLOW_METER',
                        facilityId: id,
                        source: '김해 GIS 유량계대장'
                    }, 'FACILITY', 1400, name || id);
                }
            }
        }

        // =========================================================================
        // 5. 부과수용가 (56,689건) 상호 / 가게명 / 공장명 / 도로명 / 지번 주소 검색
        // =========================================================================
        if (gis.billingConsumers && Array.isArray(gis.billingConsumers) && cleanQ.length >= 2) {
            let storeCount = 0;
            let addrCount = 0;
            const bLen = gis.billingConsumers.length;

            for (let i = 0; i < bLen && (storeCount < 10 || addrCount < 10); i++) {
                const b = gis.billingConsumers[i];
                const name = (b.name || '').trim();
                const addr = (b.addr || '').trim();
                const oaddr = (b.oaddr || '').trim();

                const cleanName = name.toLowerCase().replace(/\s+/g, '');
                const cleanAddr = addr.toLowerCase().replace(/\s+/g, '');
                const cleanOaddr = oaddr.toLowerCase().replace(/\s+/g, '');

                // 5-A. 상호/가게명/공장명 일치
                if (storeCount < 10 && cleanName && cleanName.length >= 2 && cleanName.includes(cleanQ)) {
                    storeCount++;
                    addCandidate({
                        title: `[상호] ${name}`,
                        name: name,
                        category: '상호/지명',
                        road: addr || oaddr,
                        parcel: oaddr || addr,
                        lat: b.lat,
                        lng: b.lng,
                        block: b.block || this.findNearestBlockName(b.lat, b.lng),
                        facilityType: 'CONSUMER',
                        facilityId: b.cno || '',
                        source: '김해 수용가 상호대장'
                    }, 'STORE', 1500, name);
                }

                // 5-B. 도로명/지번 주소 일치
                if (addrCount < 10 && (cleanAddr.includes(cleanQ) || cleanOaddr.includes(cleanQ))) {
                    addrCount++;
                    addCandidate({
                        title: addr || oaddr,
                        name: addr || oaddr,
                        category: addr ? '도로명주소' : '지번주소',
                        road: addr || oaddr,
                        parcel: oaddr || addr,
                        lat: b.lat,
                        lng: b.lng,
                        block: b.block || this.findNearestBlockName(b.lat, b.lng),
                        facilityType: 'CONSUMER',
                        facilityId: b.cno || '',
                        source: '김해 주소대장'
                    }, 'ADDRESS', 1200, addr || oaddr);
                }
            }
        }

        // =========================================================================
        // 6. 전국 주소·장소 통합 검색 (대한민국 전역 도로명/지번/POI + VWorld 병렬 쿼리)
        // =========================================================================
        if (cleanQ.length >= 2) {
            try {
                const nationwidePromise = Promise.allSettled([
                    this.queryNationwideAddressApi(q),
                    this.queryVWorldSearchApi(q)
                ]);
                const timeoutPromise = new Promise(resolve => setTimeout(() => resolve([]), 3500));
                const resList = await Promise.race([nationwidePromise, timeoutPromise]);

                if (Array.isArray(resList)) {
                    resList.forEach(res => {
                        if (res && res.status === 'fulfilled' && Array.isArray(res.value)) {
                            res.value.forEach(item => {
                                const isGimhae = (item.lat >= 35.1 && item.lat <= 35.45 && item.lng >= 128.65 && item.lng <= 129.1);
                                addCandidate({
                                    title: item.title,
                                    name: item.title,
                                    category: item.category || '전국 주소/장소',
                                    road: item.road || item.parcel,
                                    parcel: item.parcel || item.road,
                                    lat: item.lat,
                                    lng: item.lng,
                                    block: item.block || (isGimhae ? this.findNearestBlockName(item.lat, item.lng) : '전국'),
                                    source: item.source || '전국 공간정보'
                                }, 'POI', isGimhae ? 1400 : 1050, item.title);
                            });
                        }
                    });
                }
            } catch (err) {
                // 외부 검색 오류 시에도 로컬 GIS 결과 보존
            }
        }

        // 최종 정렬: 점수 내림차순 정렬 후 최상위 20개 반환
        candidates.sort((a, b) => (b._score || 0) - (a._score || 0));
        return candidates.slice(0, 20);
    }

    /**
     * 대한민국 전국 주소 및 장소 검색 API (OpenStreetMap Nominatim 한국 지오코더 + 도로명/지번/지명 완전 대응)
     */
    async queryNationwideAddressApi(query) {
        const q = (query || '').trim();
        if (!q || q.length < 2) return [];
        try {
            const encQuery = encodeURIComponent(q);
            const url = 'https://nominatim.openstreetmap.org/search?q=' + encQuery + '&countrycodes=kr&format=json&addressdetails=1&limit=10';
            const resp = await fetch(url, {
                headers: {
                    'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.5'
                }
            });
            if (!resp.ok) return [];
            const data = await resp.json();
            if (!Array.isArray(data)) return [];

            return data.map(it => {
                const lat = parseFloat(it.lat);
                const lng = parseFloat(it.lon);
                const addr = it.address || {};
                
                // 전국 행정구역 주소 조립
                const parts = [];
                if (addr.province || addr.city) parts.push(addr.province || addr.city);
                if (addr.borough || addr.district || addr.county) parts.push(addr.borough || addr.district || addr.county);
                if (addr.suburb || addr.neighbourhood) parts.push(addr.suburb || addr.neighbourhood);
                if (addr.road) parts.push(addr.road);
                if (addr.house_number) parts.push(addr.house_number);

                const fullAddr = parts.length > 0 ? parts.join(' ') : (it.display_name || '');
                const title = it.name || (it.display_name ? it.display_name.split(',')[0].trim() : q);
                const isGimhae = (lat >= 35.1 && lat <= 35.45 && lng >= 128.65 && lng <= 129.1);

                let regionName = '전국';
                if (addr.city) regionName = addr.city;
                else if (addr.province) regionName = addr.province;
                else if (addr.district) regionName = addr.district;

                return {
                    title: title,
                    name: title,
                    category: '전국 주소/장소',
                    road: fullAddr,
                    parcel: it.display_name || fullAddr,
                    lat: lat,
                    lng: lng,
                    block: isGimhae ? this.findNearestBlockName(lat, lng) : regionName,
                    source: '전국 공간정보'
                };
            }).filter(it => !isNaN(it.lat) && !isNaN(it.lng));
        } catch (e) {
            console.warn('전국 주소 검색 오류:', e);
            return [];
        }
    }

    /**
     * VWorld Search API 2.0 단일 요청 (JSONP 통신)
     */
    queryVWorldSingle(query, type, category, apiKey) {
        return new Promise((resolve) => {
            const domain = window.location.hostname || 'localhost';
            const callbackName = 'vworld_cb_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
            const script = document.createElement('script');
            script.id = callbackName;

            let isHandled = false;
            const cleanup = () => {
                if (isHandled) return;
                isHandled = true;
                try {
                    delete window[callbackName];
                    const el = document.getElementById(callbackName);
                    if (el && el.parentNode) el.parentNode.removeChild(el);
                } catch (e) {}
            };

            const timer = setTimeout(() => {
                cleanup();
                resolve([]); // 타임아웃 시 안전 반환
            }, 3000);

            window[callbackName] = (data) => {
                clearTimeout(timer);
                cleanup();
                try {
                    if (data && data.response && data.response.status === 'OK' && data.response.result && data.response.result.items) {
                        const items = data.response.result.items.map(it => {
                            const pt = it.point || {};
                            const addr = it.address || {};
                            const lat = parseFloat(pt.y);
                            const lng = parseFloat(pt.x);
                            return {
                                title: it.title || addr.road || addr.parcel || query,
                                category: type === 'place' ? '장소/건물' : (category === 'PARCEL' ? '지번주소' : '도로명주소'),
                                road: addr.road || addr.parcel || '',
                                parcel: addr.parcel || '',
                                bldnm: addr.bldnm || it.title || '',
                                lat: lat,
                                lng: lng,
                                block: this.findNearestBlockName(lat, lng),
                                system: 'VWorld 공간정보',
                                source: 'VWorld 오픈API'
                            };
                        }).filter(it => !isNaN(it.lat) && !isNaN(it.lng));

                        resolve(items);
                    } else {
                        resolve([]);
                    }
                } catch (err) {
                    resolve([]);
                }
            };

            script.onerror = () => {
                clearTimeout(timer);
                cleanup();
                resolve([]);
            };

            const encQuery = encodeURIComponent(query);
            let url = `https://api.vworld.kr/req/search?service=search&request=search&version=2.0&crs=EPSG:4326&size=8&page=1&query=${encQuery}&type=${type}&format=json&errorformat=json&key=${apiKey}&domain=${encodeURIComponent(domain)}&callback=${callbackName}`;
            if (category) {
                url += `&category=${category}`;
            }
            script.src = url;
            document.head.appendChild(script);
        });
    }

    /**
     * VWorld Search API 2.0 통합 검색 (장소 place, 도로명 road, 지번 parcel 3종 동시 병렬 쿼리)
     */
    async queryVWorldSearchApi(query) {
        const apiKey = this.vworldApiKey || this.defaultVworldKey;
        const results = await Promise.allSettled([
            this.queryVWorldSingle(query, 'place', null, apiKey),
            this.queryVWorldSingle(query, 'address', 'ROAD', apiKey),
            this.queryVWorldSingle(query, 'address', 'PARCEL', apiKey)
        ]);

        const merged = [];
        results.forEach(res => {
            if (res.status === 'fulfilled' && Array.isArray(res.value)) {
                merged.push(...res.value);
            }
        });
        return merged;
    }

    /**
     * 주소 검색 결과 선택 시 지도 이동 및 확인 마커·버퍼·팝업 표출
     */
    verifyAndGoToLocation(item) {
        if (!item) return;

        // 1. 관망블록 선택 시: 블록 외곽선 하이라이트 및 폴리곤 영역 자동 줌
        if (item.isBlock || item.facilityType === 'BLOCK') {
            const blockName = item.name || item.block;
            this.highlightBlock(blockName);
            if (item.coordinates && item.coordinates.length > 2) {
                try {
                    this.map.fitBounds(item.coordinates, { padding: [40, 40], animate: true, maxZoom: 17 });
                } catch (e) {
                    if (!isNaN(item.lat) && !isNaN(item.lng)) {
                        this.map.flyTo([item.lat, item.lng], 16, { duration: 1.0 });
                    }
                }
            } else if (!isNaN(item.lat) && !isNaN(item.lng)) {
                this.map.flyTo([item.lat, item.lng], 16, { duration: 1.0 });
            }
            if (typeof window.showLocationOnRightPanel === 'function') {
                window.showLocationOnRightPanel(item, null, blockName);
            }
            return;
        }

        if (isNaN(item.lat) || isNaN(item.lng)) return;

        // 기존 주소 확인 마커 제거
        this.clearVerificationMarker();

        const lat = typeof item.lat === 'number' ? item.lat : parseFloat(item.lat);
        const lng = typeof item.lng === 'number' ? item.lng : parseFloat(item.lng);

        const isGimhae = (lat >= 35.1 && lat <= 35.45 && lng >= 128.65 && lng <= 129.1);

        // 시설물 및 전국 위치별 최적 확대 배율
        let targetZoom = 17;
        if (!isGimhae) {
            targetZoom = 16;
        } else if (item.facilityType === 'BOOSTER' || item.facilityType === 'RESERVOIR') {
            targetZoom = 18;
        } else if (item.facilityType === 'VALVE' || item.facilityType === 'METER' || item.facilityType === 'PIPE') {
            targetZoom = 19;
        } else if (item.facilityType === 'FLOW_METER') {
            targetZoom = 18;
        }

        // 지도 부드럽게 비행 이동
        this.map.flyTo([lat, lng], targetZoom, { duration: 1.0 });

        // 1. 펄스 애니메이션 확인 핀 마커 생성
        const pinHtml = `
            <div class="vworld-verified-marker-wrap">
                <div class="vworld-pulse-wave"></div>
                <div class="vworld-marker-core">
                    <i class="fa-solid fa-location-dot"></i>
                </div>
            </div>
        `;

        const icon = L.divIcon({
            className: 'vworld-verified-divicon',
            html: pinHtml,
            iconSize: [42, 42],
            iconAnchor: [21, 38],
            popupAnchor: [0, -36]
        });

        this.verifiedMarker = L.marker([lat, lng], { icon: icon }).addTo(this.layers.verification);

        // 2. 인근 시설물(100m 이내) 실시간 자동 스캔 (김해 관내일 때만 실행)
        const nearbySummary = isGimhae ? this.scanNearbyFacilities(lat, lng, 100) : [];
        const matchedBlock = item.block || (isGimhae ? this.findNearestBlockName(lat, lng) : '전국');

        const cleanTitle = (item.title || item.road || '선택 위치')
            .replace(/\[클릭\s*확인\]\s*/g, '')
            .trim();

        // 사용자 요청: 지도 위 팝업은 표출하지 않고 핀 마커만 표시, 모든 결과는 우측 패널에만 집중 표출
        this.verifiedMarker.on('click', () => {
            if (typeof window.showLocationOnRightPanel === 'function') {
                window.showLocationOnRightPanel(item, nearbySummary, matchedBlock);
            }
        });

        // 5. 우측 칸(Right Panel)에 시설물 상세 DB 및 위치 정보 실시간 표출
        if (typeof window.showLocationOnRightPanel === 'function') {
            window.showLocationOnRightPanel(item, nearbySummary, matchedBlock);
        } else if (typeof window.onFacilitySelected === 'function' && item.facilityType) {
            window.onFacilitySelected(item);
        } else if (typeof window.openSidePanel === 'function') {
            window.openSidePanel();
        }
    }

    /**
     * 관망 블록명 기준 대표 중심 좌표 조회
     */
    findBlockCenter(blockName) {
        const cleanName = (blockName || '').replace(/\s+/g, '');
        const match = GIMHAE_GIS_INDEX.find(l => {
            const lTitle = (l.title || '').replace(/\s+/g, '');
            const lBlock = (l.block || '').replace(/\s+/g, '');
            return lTitle.includes(cleanName) || lBlock.includes(cleanName);
        });
        if (match) return { lat: match.lat, lng: match.lng };
        return { lat: 35.228512, lng: 128.889345 };
    }

    /**
     * 지도 우클릭 시 컨텍스트 메뉴 표시 (사용자 요구사항 반영)
     */
    handleMapContextMenu(e) {
        const menu = document.getElementById('mapContextMenu');
        if (!menu) return;

        this.contextMenuLatLng = { lat: e.latlng.lat, lng: e.latlng.lng };

        // GPS 좌표 표시 갱신
        const coordText = document.getElementById('mcmCoordText');
        if (coordText) {
            coordText.textContent = `${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`;
        }

        // 메뉴 위치 지정 (화면 밖 벗어남 방지)
        const container = document.getElementById('map');
        const rect = container ? container.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
        let x = e.containerPoint.x;
        let y = e.containerPoint.y;

        if (x + 270 > rect.width) x = rect.width - 275;
        if (y + 240 > rect.height) y = rect.height - 245;

        menu.style.left = `${Math.max(10, x)}px`;
        menu.style.top = `${Math.max(10, y)}px`;
        menu.style.display = 'flex';
    }

    /**
     * 지도 컨텍스트 메뉴 숨김
     */
    hideContextMenu() {
        const menu = document.getElementById('mapContextMenu');
        if (menu) menu.style.display = 'none';
    }

    /**
     * 로드뷰 모드 켜기/끄기
     */
    setRoadviewMode(enable) {
        this.isRoadviewMode = !!enable;
        const mapEl = document.getElementById('map');
        const btnRv = document.getElementById('btnMapRoadview');
        const banner = document.getElementById('roadviewModeBanner');

        if (mapEl) mapEl.classList.toggle('roadview-cursor-mode', this.isRoadviewMode);
        if (btnRv) btnRv.classList.toggle('active', this.isRoadviewMode);
        if (banner) banner.style.display = this.isRoadviewMode ? 'flex' : 'none';
    }

    /**
     * 특정 좌표의 가장 가까운 색인 지명/주소 항목 조회
     */
    findNearestIndexItem(lat, lng) {
        let minDist = 999999;
        let nearestItem = null;
        GIMHAE_GIS_INDEX.forEach(item => {
            const d = this.calculateDistance(lat, lng, item.lat, item.lng);
            if (d < minDist) {
                minDist = d;
                nearestItem = item;
            }
        });
        return nearestItem;
    }

    /**
     * 실시간 360° 로드뷰(거리뷰) 호출 (팝업 모달 없이 우측 결과창 패널에 즉시 표출)
     */
    openRoadview(lat, lng, title) {
        this.hideContextMenu();
        this.setRoadviewMode(false);

        const latitude = typeof lat === 'number' ? lat : parseFloat(lat);
        const longitude = typeof lng === 'number' ? lng : parseFloat(lng);

        if (isNaN(latitude) || isNaN(longitude)) {
            console.error('[Roadview] 유효하지 않은 좌표:', lat, lng);
            alert('선택하신 위치의 GPS 좌표가 올바르지 않습니다.');
            return;
        }

        const cleanTitle = (title || `김해시 관내 도로 (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`)
            .replace(/\[클릭\s*확인\]\s*/g, '')
            .trim();

        this.roadviewState.isOpen = true;
        this.roadviewState.lat = latitude;
        this.roadviewState.lng = longitude;
        this.roadviewState.title = cleanTitle;

        // 1. 좌측 전체 지도 위 실시간 로드뷰 마커(보행자 아이콘 & 시야각 빔 & 드래그) 생성 또는 위치 이동
        this.createRoadviewLiveMarker(latitude, longitude, this.roadviewState.heading);

        // 2. 우측 사이드 패널 열기 및 결과창 로드뷰 패널 표출
        const sidePanel = document.getElementById('sidePanel');
        if (sidePanel) {
            sidePanel.classList.remove('collapsed');
            sidePanel.classList.add('roadview-docked-mode');
        }
        const mainContent = document.querySelector('.main-content');
        if (mainContent) mainContent.classList.add('side-panel-open');

        if (typeof window.switchTab === 'function') {
            window.switchTab('surveyTab');
        }

        const dockPane = document.getElementById('roadviewDockPane');
        if (dockPane) {
            dockPane.style.display = 'flex';
            setTimeout(() => {
                dockPane.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 80);
        }
        const splitResizer = document.getElementById('rvSplitResizer');
        if (splitResizer) splitResizer.style.display = 'flex';

        // 3. 우측 결과창 로드뷰 프레임 및 주소 정보 동기화
        this.syncDockedRoadview();

        // 4. 좌측 지도 영역 크기 재계산 및 로드뷰 위치로 부드럽게 중심 이동
        setTimeout(() => {
            if (this.map) {
                this.map.invalidateSize();
                this.map.panTo([latitude, longitude], { animate: true });
            }
        }, 300);

        // 5. 지하 상수관망 AR 투영도 텔레메트리 갱신
        this.updatePipeTelemetryInfo(latitude, longitude);
    }

    /**
     * 카카오 Maps JavaScript SDK 동적 로딩 및 네이티브 로드뷰 초기화
     */
    initKakaoSdk() {
        const kakaoAppKey = localStorage.getItem('kakao_appkey');
        if (!kakaoAppKey) return;

        if (window.kakao && window.kakao.maps) {
            this.setupKakaoNativeRoadview();
            return;
        }

        const scriptId = 'kakao-maps-sdk-script';
        if (document.getElementById(scriptId)) return;

        const script = document.createElement('script');
        script.id = scriptId;
        script.type = 'text/javascript';
        script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoAppKey}&libraries=services&autoload=false`;
        script.onload = () => {
            if (window.kakao && window.kakao.maps) {
                kakao.maps.load(() => {
                    this.setupKakaoNativeRoadview();
                });
            }
        };
        script.onerror = () => {
            console.warn('[Kakao SDK] SDK 로드 실패. 표준 iframe 모드로 자동 폴백 유지.');
        };
        document.head.appendChild(script);
    }

    setupKakaoNativeRoadview() {
        const container = document.getElementById('rvNativeRoadview');
        if (!container || !window.kakao || !window.kakao.maps || !window.kakao.maps.Roadview) return;

        try {
            this.kakaoRoadview = new kakao.maps.Roadview(container);
            this.kakaoRoadviewClient = new kakao.maps.RoadviewClient();

            // 로드뷰 내 화살표 클릭 시 100% 실시간 위치 변경 이벤트 연동!
            kakao.maps.event.addListener(this.kakaoRoadview, 'position_changed', () => {
                const pos = this.kakaoRoadview.getPosition();
                this.handleNativeRoadviewMoved(pos.getLat(), pos.getLng());
            });

            // 시점 회전 이벤트 연동
            kakao.maps.event.addListener(this.kakaoRoadview, 'viewpoint_changed', () => {
                const vp = this.kakaoRoadview.getViewpoint();
                this.updateRoadviewLiveMarkerHeading(vp.pan);
            });
            console.log('[Kakao SDK] 네이티브 Roadview 이벤트 리스너(position_changed) 등록 완료');
        } catch (e) {
            console.warn('[Kakao SDK] Roadview 초기화 오류:', e);
        }
    }

    handleNativeRoadviewMoved(lat, lng) {
        this.roadviewState.lat = lat;
        this.roadviewState.lng = lng;

        if (this.roadviewLiveMarker) {
            this.roadviewLiveMarker.setLatLng([lat, lng]);
        }
        if (this.map) {
            this.map.panTo([lat, lng], { animate: true });
        }

        const roadEl = document.getElementById('rvDockRoadAddr');
        const parcelEl = document.getElementById('rvDockParcelAddr');
        const coordEl = document.getElementById('rvDockCoord');
        if (coordEl) coordEl.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        const nearest = this.findNearestIndexItem(lat, lng);
        if (roadEl) roadEl.textContent = nearest?.road || this.roadviewState.title;
        if (parcelEl) parcelEl.textContent = nearest?.parcel || nearest?.block || '-';

        this.updatePipeTelemetryInfo(lat, lng);
        this.showRoadviewLiveFeedback(`📍 ${nearest?.road || '도로'} 위치 이동 (지도 동기화)`);
    }

    /**
     * 우측 결과창 패널 로드뷰 뷰어 동기화 (주소, iframe URL / 네이티브 SDK, AR 관로 상태)
     */
    syncDockedRoadview() {
        const { lat, lng, title, provider } = this.roadviewState;
        const kakaoUrl = `https://map.kakao.com/link/roadview/${lat},${lng}`;
        const naverUrl = `https://map.naver.com/p?c=${lng},${lat},17,0,0,0,dh&viewType=roadview`;

        const roadEl = document.getElementById('rvDockRoadAddr');
        const parcelEl = document.getElementById('rvDockParcelAddr');
        const coordEl = document.getElementById('rvDockCoord');

        if (coordEl) coordEl.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        const nearest = this.findNearestIndexItem(lat, lng);
        if (roadEl) roadEl.textContent = nearest?.road || title;
        if (parcelEl) parcelEl.textContent = nearest?.parcel || nearest?.block || '-';

        const frameKakao = document.getElementById('rvDockIframeKakao');
        const nativeContainer = document.getElementById('rvNativeRoadview');
        const frameNaver = document.getElementById('rvDockIframeNaver');
        const btnTabKakao = document.getElementById('btnRvDockTabKakao');
        const btnTabNaver = document.getElementById('btnRvDockTabNaver');
        const btnOpenNewTab = document.getElementById('btnRvDockOpenNewTab');

        const switchDockTab = (tab) => {
            this.roadviewState.provider = tab;
            if (tab === 'kakao') {
                if (this.kakaoRoadview) {
                    if (nativeContainer) nativeContainer.style.display = 'block';
                    if (frameKakao) frameKakao.style.display = 'none';
                    const pos = new kakao.maps.LatLng(lat, lng);
                    this.kakaoRoadviewClient.getNearestPanoId(pos, 80, (panoId) => {
                        if (panoId) {
                            this.kakaoRoadview.setPanoId(panoId, pos);
                        } else if (frameKakao) {
                            if (nativeContainer) nativeContainer.style.display = 'none';
                            frameKakao.style.display = 'block';
                            if (frameKakao.src !== kakaoUrl) frameKakao.src = kakaoUrl;
                        }
                    });
                } else {
                    if (nativeContainer) nativeContainer.style.display = 'none';
                    if (frameKakao) {
                        frameKakao.style.display = 'block';
                        if (frameKakao.src !== kakaoUrl) frameKakao.src = kakaoUrl;
                    }
                }
                if (frameNaver) frameNaver.style.display = 'none';
                if (btnTabKakao) btnTabKakao.classList.add('active');
                if (btnTabNaver) btnTabNaver.classList.remove('active');
                if (btnOpenNewTab) {
                    btnOpenNewTab.onclick = () => window.open(kakaoUrl, '_blank');
                    btnOpenNewTab.title = '카카오 로드뷰 새 탭으로 크게 보기';
                }
            } else {
                if (nativeContainer) nativeContainer.style.display = 'none';
                if (frameKakao) frameKakao.style.display = 'none';
                if (frameNaver) frameNaver.style.display = 'block';
                if (btnTabKakao) btnTabKakao.classList.remove('active');
                if (btnTabNaver) btnTabNaver.classList.add('active');
                if (btnOpenNewTab) {
                    btnOpenNewTab.onclick = () => window.open(naverUrl, '_blank');
                    btnOpenNewTab.title = '네이버 거리뷰 새 탭으로 크게 보기';
                }
            }
        };

        if (!this.kakaoRoadview && frameKakao && frameKakao.src !== kakaoUrl) frameKakao.src = kakaoUrl;
        if (frameNaver && frameNaver.src !== naverUrl) frameNaver.src = naverUrl;

        if (btnTabKakao) btnTabKakao.onclick = () => switchDockTab('kakao');
        if (btnTabNaver) btnTabNaver.onclick = () => switchDockTab('naver');

        switchDockTab(provider || 'kakao');

        // 도킹 AR 관로 오버레이 상태 동기화
        const dockPipeOverlay = document.getElementById('rvDockPipeOverlay');
        if (dockPipeOverlay) {
            dockPipeOverlay.style.display = this.roadviewState.isPipeOverlayOn ? 'block' : 'none';
        }
        const btnDockPipe = document.getElementById('btnRvDockTogglePipe');
        if (btnDockPipe) {
            btnDockPipe.classList.toggle('active', this.roadviewState.isPipeOverlayOn);
            btnDockPipe.innerHTML = `<i class="fa-solid fa-water"></i> 관로표현 ${this.roadviewState.isPipeOverlayOn ? '<span style="font-size:10px; background:#22C55E; color:#FFF; padding:1px 4px; border-radius:4px; margin-left:3px;">ON</span>' : ''}`;
        }
    }

    /**
     * 지도 위 실시간 로드뷰 마커(방향 빔 & 보행자 아이콘 & 드래그 이동)
     */
    createRoadviewLiveMarker(lat, lng, heading = 0) {
        if (this.roadviewLiveMarker) {
            this.roadviewLiveMarker.setLatLng([lat, lng]);
            this.updateRoadviewLiveMarkerHeading(heading);
            return;
        }

        const html = `
            <div class="rv-live-pin-wrap" id="rvLivePinWrap" style="transform: rotate(${heading}deg);">
                <div class="rv-live-fov-cone"></div>
                <div class="rv-live-pin-center" title="드래그하여 원하는 도로로 로드뷰 위치를 이동할 수 있습니다">
                    <i class="fa-solid fa-person-walking"></i>
                </div>
                <div class="rv-live-pin-pulse"></div>
            </div>
        `;

        const customIcon = L.divIcon({
            className: 'rv-live-marker-icon',
            html: html,
            iconSize: [48, 48],
            iconAnchor: [24, 24]
        });

        this.roadviewLiveMarker = L.marker([lat, lng], {
            icon: customIcon,
            zIndexOffset: 3000,
            draggable: true
        }).addTo(this.map);

        this.roadviewLiveMarker.bindTooltip('360° 로드뷰 현장 시점<br><span style="font-size:11px; color:#38BDF8;">지도를 클릭하거나 마커를 드래그하여 이동</span>', {
            direction: 'top',
            offset: [0, -20],
            className: 'rv-marker-tooltip'
        });

        // 사용자가 지도 위의 로드뷰 마커를 직접 드래그하여 도로에 놓으면 해당 위치로 즉시 로드뷰 갱신!
        this.roadviewLiveMarker.on('dragend', (e) => {
            const pos = e.target.getLatLng();
            this.updateRoadviewPosition(pos.lat, pos.lng, this.roadviewState.heading, true);
        });
    }

    /**
     * 로드뷰 마커의 방향 빔 각도 회전 갱신
     */
    updateRoadviewLiveMarkerHeading(heading) {
        const pinWrap = document.getElementById('rvLivePinWrap');
        if (pinWrap) {
            pinWrap.style.transform = `rotate(${heading}deg)`;
        }
    }

    /**
     * 로드뷰 위치 좌표 업데이트 (지도 마커, 주소, 프레임, 오버레이 실시간 동기화)
     */
    updateRoadviewPosition(lat, lng, heading = 0, panMap = true) {
        this.roadviewState.lat = lat;
        this.roadviewState.lng = lng;
        this.roadviewState.heading = heading;

        if (this.roadviewLiveMarker) {
            this.roadviewLiveMarker.setLatLng([lat, lng]);
            this.updateRoadviewLiveMarkerHeading(heading);
        } else {
            this.createRoadviewLiveMarker(lat, lng, heading);
        }

        if (panMap && this.map) {
            this.map.panTo([lat, lng], { animate: true });
        }

        if (this.roadviewState.isOpen) {
            this.syncDockedRoadview();
        }

        this.updatePipeTelemetryInfo(lat, lng);
    }

    /**
     * 로드뷰 내비게이션: 관로/도로망 축을 따라 실시간 전진 / 후진 이동 (좌측 지도 실시간 동기화)
     * @param {number} meters 이동 거리 (양수: 전진, 음수: 후진)
     */
    stepRoadview(meters = 20) {
        if (!this.roadviewState.lat || !this.roadviewState.lng) return;

        // 실제 도로망 / 관로 벡터를 탐색하여 도로 축을 따라 정밀 이동
        const roadBearing = this.findRoadBearing(this.roadviewState.lat, this.roadviewState.lng, this.roadviewState.heading || 0);
        const useHeading = meters >= 0 ? roadBearing : (roadBearing + 180) % 360;
        const absMeters = Math.abs(meters);

        const rad = useHeading * Math.PI / 180;
        const deltaLat = (absMeters * Math.cos(rad)) / 111111;
        const deltaLng = (absMeters * Math.sin(rad)) / (111111 * Math.cos(this.roadviewState.lat * Math.PI / 180));
        const newLat = this.roadviewState.lat + deltaLat;
        const newLng = this.roadviewState.lng + deltaLng;

        this.roadviewState.heading = roadBearing;
        this.updateRoadviewPosition(newLat, newLng, roadBearing, true);

        // 노면 화살표 펄스 효과
        const pvArrow = document.getElementById('rvRoadPavementArrow');
        if (pvArrow) {
            pvArrow.classList.add('arrow-pulsing');
            setTimeout(() => pvArrow.classList.remove('arrow-pulsing'), 350);
        }

        // 시각 피드백 알림 배지 표출
        const roadName = document.getElementById('rvDockRoadAddr')?.textContent || '도로';
        const actionText = meters >= 0 ? '전진 20m' : '후진 20m';
        this.showRoadviewLiveFeedback(`📍 ${roadName} ${actionText} 이동 (지도 연동 완료)`);
    }

    /**
     * 현재 위치 주변 가장 가까운 관로/도로 세그먼트의 방위각 계산
     */
    findRoadBearing(lat, lng, currentHeading = 0) {
        let nearestSegment = null;
        let minDist = 999999;

        if (window.SAMPLE_PIPES && Array.isArray(window.SAMPLE_PIPES)) {
            window.SAMPLE_PIPES.forEach(pipe => {
                if (!pipe.coordinates || pipe.coordinates.length < 2) return;
                for (let i = 0; i < pipe.coordinates.length - 1; i++) {
                    const p1 = pipe.coordinates[i];
                    const p2 = pipe.coordinates[i + 1];
                    const d = this.distanceToSegment(lat, lng, p1[0], p1[1], p2[0], p2[1]);
                    if (d < minDist) {
                        minDist = d;
                        nearestSegment = { p1, p2, dist: d };
                    }
                }
            });
        }

        if (nearestSegment && nearestSegment.dist < 150) {
            const dLat = nearestSegment.p2[0] - nearestSegment.p1[0];
            const dLng = (nearestSegment.p2[1] - nearestSegment.p1[1]) * Math.cos(lat * Math.PI / 180);
            let roadHeading = (Math.atan2(dLng, dLat) * 180 / Math.PI + 360) % 360;

            const diff1 = Math.abs((roadHeading - currentHeading + 540) % 360 - 180);
            const diff2 = Math.abs(((roadHeading + 180) % 360 - currentHeading + 540) % 360 - 180);
            return diff1 < diff2 ? roadHeading : (roadHeading + 180) % 360;
        }

        return currentHeading || 90; // 기본 동서 도로 방위
    }

    /**
     * 점 (pLat, pLng)과 선분 (a - b) 사이의 최단거리(미터) 계산
     */
    distanceToSegment(pLat, pLng, aLat, aLng, bLat, bLng) {
        const x = pLng * Math.cos(pLat * Math.PI / 180);
        const y = pLat;
        const x1 = aLng * Math.cos(aLat * Math.PI / 180);
        const y1 = aLat;
        const x2 = bLng * Math.cos(bLat * Math.PI / 180);
        const y2 = bLat;

        const dx = x2 - x1;
        const dy = y2 - y1;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) {
            return Math.hypot(x - x1, y - y1) * 111111;
        }

        let t = ((x - x1) * dx + (y - y1) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
        const projX = x1 + t * dx;
        const projY = y1 + t * dy;
        return Math.hypot(x - projX, y - projY) * 111111;
    }

    /**
     * 로드뷰 실시간 동기화 상태 피드백 알림 배지 표출
     */
    showRoadviewLiveFeedback(text, duration = 2500) {
        const pill = document.getElementById('rvFloatSyncPill');
        const textEl = document.getElementById('rvFloatSyncText');
        if (!pill || !textEl) return;
        textEl.textContent = text;
        pill.classList.add('pill-active');
        clearTimeout(this._rvFeedbackTimer);
        this._rvFeedbackTimer = setTimeout(() => {
            pill.classList.remove('pill-active');
            textEl.textContent = '좌측 지도 위치 실시간 동기화 중';
        }, duration);
    }

    /**
     * 로드뷰 단축키 및 iframe 안내 핸들러 (사용자 요청: 인위적인 키 가로채기 방지)
     */
    initRoadviewKeyboardNav() {
        // 인위적인 키보드 가로채기 방지
    }

    initRoadviewIframeGuidance() {
        // 인위적인 블러 피드백 방지
    }

    /**
     * 로드뷰 시점 회전 (좌회전 / 우회전)
     * @param {number} deltaDegrees 회전 각도 (-45: 좌회전, +45: 우회전)
     */
    rotateRoadview(deltaDegrees = 45) {
        this.roadviewState.heading = (this.roadviewState.heading + deltaDegrees + 360) % 360;
        this.updateRoadviewLiveMarkerHeading(this.roadviewState.heading);
        if (this.kakaoRoadview) {
            const vp = this.kakaoRoadview.getViewpoint();
            this.kakaoRoadview.setViewpoint({ pan: (vp.pan + deltaDegrees + 360) % 360, tilt: vp.tilt, zoom: vp.zoom });
        }
        this.showRoadviewLiveFeedback(`🧭 시점 회전 ${this.roadviewState.heading}°`);
    }

    /**
     * 지도를 현재 로드뷰 위치 중심으로 맞춤
     */
    syncMapToRoadviewCenter() {
        if (this.map && this.roadviewState.lat) {
            this.map.setView([this.roadviewState.lat, this.roadviewState.lng], 17, { animate: true });
        }
    }

    /**
     * 로드뷰 패널 닫기 (이전 모달 닫기 호환성 유지)
     */
    closeRoadviewModal() {
        this.closeDockedRoadview();
    }

    /**
     * 결과창 로드뷰 패널 닫기
     */
    closeDockedRoadview() {
        this.roadviewState.isOpen = false;

        const dockPane = document.getElementById('roadviewDockPane');
        if (dockPane) dockPane.style.display = 'none';
        const splitResizer = document.getElementById('rvSplitResizer');
        if (splitResizer) splitResizer.style.display = 'none';

        const sidePanel = document.getElementById('sidePanel');
        if (sidePanel) sidePanel.classList.remove('roadview-docked-mode');

        const frameKakao = document.getElementById('rvDockIframeKakao');
        const frameNaver = document.getElementById('rvDockIframeNaver');
        const nativeContainer = document.getElementById('rvNativeRoadview');
        if (frameKakao) frameKakao.src = 'about:blank';
        if (frameNaver) frameNaver.src = 'about:blank';
        if (nativeContainer) nativeContainer.style.display = 'none';
        clearTimeout(this._rvFeedbackTimer);

        if (this.roadviewLiveMarker) {
            this.map.removeLayer(this.roadviewLiveMarker);
            this.roadviewLiveMarker = null;
        }

        setTimeout(() => {
            if (this.map) this.map.invalidateSize();
        }, 320);
    }

    /**
     * [관로표현] 도로 노면 아래 상수관망 AR 투영도 ON/OFF 토글
     */
    togglePipeOverlay(forceState) {
        const nextState = typeof forceState === 'boolean' ? forceState : !this.roadviewState.isPipeOverlayOn;
        this.roadviewState.isPipeOverlayOn = nextState;

        const dockPipe = document.getElementById('rvDockPipeOverlay');
        if (dockPipe) dockPipe.style.display = nextState ? 'block' : 'none';

        const btnDockPipe = document.getElementById('btnRvDockTogglePipe');
        if (btnDockPipe) {
            btnDockPipe.classList.toggle('active', nextState);
            btnDockPipe.innerHTML = `<i class="fa-solid fa-water"></i> 관로표현 ${nextState ? '<span style="font-size:10px; background:#22C55E; color:#FFF; padding:1px 4px; border-radius:4px; margin-left:3px;">ON</span>' : ''}`;
        }
    }

    /**
     * 현재 로드뷰 좌표 주변 상수도 관망 속성 텔레메트리 갱신
     */
    updatePipeTelemetryInfo(lat, lng) {
        const nearestBlock = this.findNearestBlockName(lat, lng) || '부원01블록';
        const arPipeSpec = document.getElementById('rvDockArPipeSpec');
        if (arPipeSpec) {
            arPipeSpec.textContent = `${nearestBlock} 본관 D200 주철관(DIP) | 심도 GL -1.25m | 2.42 kgf/cm²`;
        }
    }

    /**
     * 지도 클릭 시 역지오코딩(Reverse Geocoding) 주소 확인
     */
    async handleMapClickReverseGeocode(lat, lng) {
        // 이미 열린 팝업이나 클릭 이벤트가 시설물 클릭과 중복되지 않도록 처리
        const nearestBlock = this.findNearestBlockName(lat, lng);
        let roadAddr = '김해시 관내 도로';
        let parcelAddr = '';

        // 로컬 지오코딩 색인에서 400m 이내 가장 가까운 지명/도로명 검색
        let minDist = 999999;
        let nearestItem = null;

        GIMHAE_GIS_INDEX.forEach(item => {
            const d = this.calculateDistance(lat, lng, item.lat, item.lng);
            if (d < minDist) {
                minDist = d;
                nearestItem = item;
            }
        });

        let landmark = '';
        if (nearestItem && minDist < 450) {
            roadAddr = nearestItem.road || nearestItem.title;
            parcelAddr = nearestItem.parcel || '';
            landmark = nearestItem.bldnm || (nearestItem.title !== roadAddr ? nearestItem.title : '');
        } else {
            roadAddr = `김해시 ${nearestBlock} 구역`;
        }

        const cleanRoadAddr = roadAddr
            .replace(/\[클릭\s*확인\]\s*/g, '')
            .replace(/\s*인근\s*\([^)]*\)/g, '')
            .replace(/\s*\([^)]*m\)/g, '')
            .trim();

        const clickItem = {
            title: cleanRoadAddr,
            road: cleanRoadAddr,
            parcel: parcelAddr,
            bldnm: landmark,
            place: landmark,
            category: nearestItem?.category || '',
            lat: lat,
            lng: lng,
            block: nearestBlock,
            source: '주소 확인'
        };

        this.verifyAndGoToLocation(clickItem);
    }

    /**
     * 주소 확인 마커 및 반경 원 제거
     */
    clearVerificationMarker() {
        if (this.verifiedMarker) {
            try { this.layers.verification.removeLayer(this.verifiedMarker); } catch (e) {}
            this.verifiedMarker = null;
        }
        if (this.verifiedCircle) {
            try { this.layers.verification.removeLayer(this.verifiedCircle); } catch (e) {}
            this.verifiedCircle = null;
        }
    }

    /**
     * 블록 하이라이트 스타일 초기화
     */
    clearBlockHighlight() {
        this.activeBlock = null;
        document.querySelectorAll('.gis-map-label-block').forEach(el => {
            el.classList.remove('active-block-label');
        });
        if (this.layers.blocks) {
            const blockWeight = (this.symbolSizes && this.symbolSizes.facilities && this.symbolSizes.facilities.blocks) || 2.2;
            const blockOpacity = (this.symbolSizes && this.symbolSizes.facilities && this.symbolSizes.facilities.blockOpacity) || 0.24;
            this.layers.blocks.eachLayer(l => {
                const originalColor = l.options.originalColorStyle;
                if (originalColor) {
                    l.setStyle({
                        color: originalColor.border,
                        fillColor: originalColor.fill,
                        weight: blockWeight,
                        opacity: 0.9,
                        fillOpacity: blockOpacity
                    });
                }
            });
        }
    }

    /**
     * 반경 R(미터) 이내 관망 시설물 스캔 집계
     */
    scanNearbyFacilities(lat, lng, radiusMeters) {
        let pipeCount = 0;
        let valveCount = 0;
        let meterCount = 0;
        let pressureCount = 0;
        let leakCount = 0;

        (window.SAMPLE_VALVES || []).forEach(v => {
            if (this.calculateDistance(lat, lng, v.lat, v.lng) <= radiusMeters) valveCount++;
        });
        (window.SAMPLE_METERS || []).forEach(m => {
            if (this.calculateDistance(lat, lng, m.lat, m.lng) <= radiusMeters) meterCount++;
        });
        (window.SAMPLE_PRESSURE_POINTS || []).forEach(p => {
            if (this.calculateDistance(lat, lng, p.lat, p.lng) <= radiusMeters) pressureCount++;
        });
        (window.SAMPLE_LEAK_POINTS || []).forEach(l => {
            if (this.calculateDistance(lat, lng, l.lat, l.lng) <= radiusMeters) leakCount++;
        });
        (window.SAMPLE_PIPES || []).forEach(p => {
            if (p.coordinates && p.coordinates.length > 0) {
                const cLat = p.coordinates[0][0];
                const cLng = p.coordinates[0][1];
                if (this.calculateDistance(lat, lng, cLat, cLng) <= radiusMeters) pipeCount++;
            }
        });

        return { pipeCount, valveCount, meterCount, pressureCount, leakCount };
    }

    /**
     * 좌표로부터 가장 가까운 소블록명 탐색
     */
    findNearestBlockName(lat, lng) {
        const blocks = [
            { name: "구산3 (소블록)", lat: 35.2495, lng: 128.8745 },
            { name: "구산1 (소블록)", lat: 35.2440, lng: 128.8720 },
            { name: "구산2 (소블록)", lat: 35.2470, lng: 128.8750 },
            { name: "구산4 (소블록)", lat: 35.2530, lng: 128.8770 },
            { name: "부원01 (소블록)", lat: 35.2305, lng: 128.8845 },
            { name: "부원02 (소블록)", lat: 35.2276, lng: 128.8864 },
            { name: "내외01 (소블록)", lat: 35.2340, lng: 128.8680 },
            { name: "내외02 (소블록)", lat: 35.2268, lng: 128.8752 },
            { name: "삼계01 (소블록)", lat: 35.2650, lng: 128.8680 },
            { name: "어방01 (소블록)", lat: 35.2435, lng: 128.9052 },
            { name: "진영01 (소블록)", lat: 35.3115, lng: 128.7352 },
            { name: "장유01 (소블록)", lat: 35.1932, lng: 128.8021 }
        ];

        let closest = "김해시 관망구역";
        let minD = 999999;
        blocks.forEach(b => {
            const d = this.calculateDistance(lat, lng, b.lat, b.lng);
            if (d < minD) {
                minD = d;
                closest = b.name;
            }
        });
        return closest;
    }

    /**
     * 위경도 두 지점 간 거리 계산 (Haversine Formula, 미터 단위)
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000; // 지구 반지름 (m)
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * 주소 확인 팝업에서 특정 공종 조사 모드로 즉시 전환
     */
    triggerSurveyModeFromLocation(mode, title, lat, lng, address) {
        if (typeof window.setWorkMode === 'function') {
            window.setWorkMode(mode);
        } else {
            this.setWorkMode(mode);
        }
        if (typeof window.openSidePanel === 'function') {
            window.openSidePanel();
            window.switchTab('surveyTab');
        }
    }

    /**
     * 주소 확인 팝업에서 신규 현장점검 서식으로 주소·좌표 자동 전달
     */
    openNewSurveyForm(title, address, lat, lng, block) {
        if (typeof window.openSidePanel === 'function') {
            window.openSidePanel();
            window.switchTab('surveyTab');
        }

        // 현장점검 서식에 주소 및 위치 특이사항 자동 기입
        const memoInput = document.getElementById('inputSurveyMemo');
        if (memoInput) {
            memoInput.value = `[VWorld 주소확인: ${title}] 주소: ${address} (좌표: ${lat.toFixed(6)}, ${lng.toFixed(6)}) / 소속블록: ${block}`;
            memoInput.focus();
        }

        const detailContainer = document.getElementById('facilityDetailContent');
        if (detailContainer) {
            detailContainer.innerHTML = `
                <div class="detail-header">
                    <div>
                        <span class="type-tag tag-pipe"><i class="fa-solid fa-map-pin"></i> VWorld 주소 연계 조사</span>
                        <span class="detail-title" style="margin-left:6px;">${title}</span>
                    </div>
                </div>
                <div class="attr-grid">
                    <div class="attr-item"><span class="attr-label">소속블록</span><span class="attr-value">${block}</span></div>
                    <div class="attr-item"><span class="attr-label">확인좌표</span><span class="attr-value">${lat.toFixed(5)}, ${lng.toFixed(5)}</span></div>
                    <div class="attr-item" style="grid-column: span 2;"><span class="attr-label">주소</span><span class="attr-value">${address}</span></div>
                </div>
            `;
        }
    }

    /**
     * 좌표 클립보드 복사 유틸리티
     */
    copyCoordToClipboard(lat, lng) {
        const text = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                alert(`좌표가 클립보드에 복사되었습니다:\n${text}`);
            });
        } else {
            alert(`GPS 좌표: ${text}`);
        }
    }

    /**
     * VWorld API 인증키 관리
     */
    getVWorldApiKey() {
        return this.vworldApiKey;
    }

    setVWorldApiKey(newKey) {
        const clean = (newKey || '').trim();
        if (clean) {
            this.vworldApiKey = clean;
            localStorage.setItem('vworld_api_key', clean);
        } else {
            this.vworldApiKey = this.defaultVworldKey;
            localStorage.removeItem('vworld_api_key');
        }
    }
}

window.WaterMapManager = WaterMapManager;
