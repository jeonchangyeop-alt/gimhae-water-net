/**
 * 김해관망관리 - 샘플 관망 공간 데이터 및 유수율 분석 데이터
 * 좌표계: WGS84 (EPSG:4326, [위도(lat), 경도(lng)])
 */

const SAMPLE_BLOCKS = [
    { code: "ALL", name: "전체 블록 보기" },
    { code: "GH-BW-01", name: "김해 부원 01 소블록" },
    { code: "GH-BW-02", name: "김해 부원 02 소블록" },
    { code: "GH-NW-01", name: "김해 내외 01 소블록" }
];

// 1. 관로 (Pipes) - LineString
const SAMPLE_PIPES = [
    {
        id: "PIPE-2024-001",
        name: "부원중앙로 배수관 1구간",
        block: "GH-BW-01",
        dia: 200,
        material: "DIP (덕타일주철관)",
        year: 2015,
        length: 245.5,
        pressure_target: 2.8,
        coordinates: [
            [35.2295, 128.8830],
            [35.2305, 128.8845],
            [35.2312, 128.8860]
        ]
    },
    {
        id: "PIPE-2024-002",
        name: "부원중앙로 배수관 2구간",
        block: "GH-BW-01",
        dia: 150,
        material: "DIP (덕타일주철관)",
        year: 2016,
        length: 180.2,
        pressure_target: 2.7,
        coordinates: [
            [35.2312, 128.8860],
            [35.2318, 128.8875],
            [35.2325, 128.8890]
        ]
    },
    {
        id: "PIPE-2024-003",
        name: "부원2길 지관",
        block: "GH-BW-01",
        dia: 80,
        material: "PE (폴리에틸렌관)",
        year: 2019,
        length: 110.0,
        pressure_target: 2.6,
        coordinates: [
            [35.2305, 128.8845],
            [35.2298, 128.8855],
            [35.2290, 128.8865]
        ]
    },
    {
        id: "PIPE-2024-004",
        name: "호계로 배수본관",
        block: "GH-BW-02",
        dia: 300,
        material: "SP (강관)",
        year: 2012,
        length: 320.8,
        pressure_target: 3.2,
        coordinates: [
            [35.2280, 128.8810],
            [35.2295, 128.8830],
            [35.2285, 128.8850]
        ]
    },
    {
        id: "PIPE-2024-005",
        name: "시청서길 급수지관",
        block: "GH-BW-02",
        dia: 50,
        material: "STS (스테인리스관)",
        year: 2021,
        length: 95.4,
        pressure_target: 2.5,
        coordinates: [
            [35.2285, 128.8850],
            [35.2278, 128.8862]
        ]
    },
    {
        id: "PIPE-2024-006",
        name: "내외로 연결간선",
        block: "GH-NW-01",
        dia: 250,
        material: "DIP (덕타일주철관)",
        year: 2018,
        length: 280.0,
        pressure_target: 2.9,
        coordinates: [
            [35.2330, 128.8810],
            [35.2335, 128.8835],
            [35.2345, 128.8855]
        ]
    }
];

// 2. 제수변 / 경계밸브 (Valves) - Point
const SAMPLE_VALVES = [
    {
        id: "VLV-BW-001",
        name: "부원01 블록경계 제수변 A",
        type: "VALVE",
        block: "GH-BW-01",
        dia: 200,
        status: "정상 (상시개방)",
        is_boundary: true,
        direction: "우회전식",
        total_turn: 25,
        depth: 1.2,
        address: "경남 김해시 부원동 615-1 도로상",
        lat: 35.2305,
        lng: 128.8845
    },
    {
        id: "VLV-BW-002",
        name: "부원01 블록경계 제수변 B",
        type: "VALVE",
        block: "GH-BW-01",
        dia: 80,
        status: "정상 (상시개방)",
        is_boundary: true,
        direction: "우회전식",
        total_turn: 12,
        depth: 0.9,
        address: "경남 김해시 부원동 620-3",
        lat: 35.2298,
        lng: 128.8855
    },
    {
        id: "VLV-BW-003",
        name: "호계로 블록경계 제수변 C (차단용)",
        type: "VALVE",
        block: "GH-BW-02",
        dia: 300,
        status: "고립 차단 (전폐)",
        is_boundary: true,
        direction: "우회전식",
        total_turn: 36,
        depth: 1.5,
        address: "경남 김해시 부원동 640 도로변",
        lat: 35.2280,
        lng: 128.8810
    },
    {
        id: "VLV-NW-001",
        name: "내외01 블록경계 감압밸브(PRV)",
        type: "VALVE",
        block: "GH-NW-01",
        dia: 200,
        status: "정상 가동중",
        is_boundary: true,
        direction: "자동제어",
        total_turn: 0,
        depth: 1.4,
        address: "경남 김해시 내동 1100-2",
        lat: 35.2335,
        lng: 128.8835
    }
];

// 3. 계량기 / 급수전 (Meters) - Point
const SAMPLE_METERS = [
    {
        id: "MTR-2024-101",
        name: "부원상가 101호 계량기",
        type: "METER",
        block: "GH-BW-01",
        dia: 25,
        owner: "김해상사",
        address: "경남 김해시 김해대로 2360번길 12",
        last_read: 1452,
        lat: 35.2308,
        lng: 128.8850
    },
    {
        id: "MTR-2024-102",
        name: "부원동 618번지 단독주택",
        type: "METER",
        block: "GH-BW-01",
        dia: 20,
        owner: "이영수",
        address: "경남 김해시 부원동 618-2",
        last_read: 843,
        lat: 35.2315,
        lng: 128.8863
    },
    {
        id: "MTR-2024-103",
        name: "부원 베이커리",
        type: "METER",
        block: "GH-BW-01",
        dia: 25,
        owner: "박지민",
        address: "경남 김해시 가락로 34",
        last_read: 2190,
        lat: 35.2294,
        lng: 128.8860
    },
    {
        id: "MTR-2024-104",
        name: "김해원조식당",
        type: "METER",
        block: "GH-BW-01",
        dia: 32,
        owner: "최정호",
        address: "경남 김해시 부원동 622-1",
        last_read: 3870,
        lat: 35.2320,
        lng: 128.8878
    },
    {
        id: "MTR-2024-201",
        name: "시청앞 카센터",
        type: "METER",
        block: "GH-BW-02",
        dia: 25,
        owner: "한승우",
        address: "경남 김해시 김해대로 2401",
        last_read: 1720,
        lat: 35.2288,
        lng: 128.8842
    },
    {
        id: "MTR-2024-202",
        name: "부원빌라 A동",
        type: "METER",
        block: "GH-BW-02",
        dia: 40,
        owner: "입주자대표",
        address: "경남 김해시 호계로 15",
        last_read: 5640,
        lat: 35.2276,
        lng: 128.8864
    },
    {
        id: "MTR-2024-301",
        name: "내외프라자 관리사무소",
        type: "METER",
        block: "GH-NW-01",
        dia: 50,
        owner: "관리소",
        address: "경남 김해시 내외중앙로 45",
        last_read: 9820,
        lat: 35.2340,
        lng: 128.8850
    }
];

// 4. 수압 측정점 (Pressure Points)
const SAMPLE_PRESSURE_POINTS = [
    {
        id: "PRS-BW-001",
        name: "부원사거리 소화전 수압점",
        type: "PRESSURE",
        block: "GH-BW-01",
        target_pressure: 2.8,
        current_pressure: 2.75,
        status: "적정수압",
        address: "경남 김해시 부원동 616 소화전",
        lat: 35.2310,
        lng: 128.8858
    },
    {
        id: "PRS-BW-002",
        name: "부원동 고지대 급수전 수압점",
        type: "PRESSURE",
        block: "GH-BW-01",
        target_pressure: 2.2,
        current_pressure: 1.85,
        status: "저수압 주의",
        address: "경남 김해시 부원동 630-1",
        lat: 35.2322,
        lng: 128.8885
    },
    {
        id: "PRS-BW-003",
        name: "호계로 배수본관 말단 수압점",
        type: "PRESSURE",
        block: "GH-BW-02",
        target_pressure: 3.0,
        current_pressure: 2.98,
        status: "적정수압",
        address: "경남 김해시 부원동 645",
        lat: 35.2275,
        lng: 128.8830
    }
];

// 5. 누수탐사 및 복구 관리 (Leak Points)
const SAMPLE_LEAK_POINTS = [
    {
        id: "LEAK-2024-001",
        name: "부원2길 누수 의심 청음지점",
        type: "LEAK",
        block: "GH-BW-01",
        status: "청음확인(복구대기)",
        sound_grade: "A등급 (파열음 명확)",
        estimated_loss: "일 45 m³",
        address: "경남 김해시 부원동 621 도로",
        lat: 35.2300,
        lng: 128.8852
    },
    {
        id: "LEAK-2024-002",
        name: "호계로 노면 결로 조사지점",
        type: "LEAK",
        block: "GH-BW-02",
        status: "복구완료",
        sound_grade: "B등급",
        estimated_loss: "일 20 m³",
        address: "경남 김해시 부원동 638-2",
        lat: 35.2283,
        lng: 128.8825
    }
];

// 6. 유수율 분석 데이터 (블록별 월간 공급량, 부과량, 유수율 통계)
const SAMPLE_REVENUE_WATER_DATA = {
    "GH-BW-01": {
        blockName: "김해 부원 01 소블록",
        targetRatio: 85.0,
        history: [
            { month: "2024-06", supply: 48500, billed: 38800, ratio: 80.0, leak: 9700 },
            { month: "2024-07", supply: 51200, billed: 41984, ratio: 82.0, leak: 9216 },
            { month: "2024-08", supply: 53000, billed: 44255, ratio: 83.5, leak: 8745 },
            { month: "2024-09", supply: 49800, billed: 42081, ratio: 84.5, leak: 7719 },
            { month: "2024-10", supply: 47200, billed: 40403, ratio: 85.6, leak: 6797 }
        ],
        mnf: 18.5
    },
    "GH-BW-02": {
        blockName: "김해 부원 02 소블록",
        targetRatio: 82.0,
        history: [
            { month: "2024-06", supply: 62000, billed: 45880, ratio: 74.0, leak: 16120 },
            { month: "2024-07", supply: 64500, billed: 48697, ratio: 75.5, leak: 15803 },
            { month: "2024-08", supply: 66000, billed: 50820, ratio: 77.0, leak: 15180 },
            { month: "2024-09", supply: 61000, billed: 47885, ratio: 78.5, leak: 13115 },
            { month: "2024-10", supply: 59500, billed: 47600, ratio: 80.0, leak: 11900 }
        ],
        mnf: 26.2
    },
    "GH-NW-01": {
        blockName: "김해 내외 01 소블록",
        targetRatio: 88.0,
        history: [
            { month: "2024-06", supply: 98000, billed: 84280, ratio: 86.0, leak: 13720 },
            { month: "2024-07", supply: 102000, billed: 88740, ratio: 87.0, leak: 13260 },
            { month: "2024-08", supply: 105000, billed: 91875, ratio: 87.5, leak: 13125 },
            { month: "2024-09", supply: 99500, billed: 87560, ratio: 88.0, leak: 11940 },
            { month: "2024-10", supply: 97000, billed: 86136, ratio: 88.8, leak: 10864 }
        ],
        mnf: 32.0
    }
};

window.SAMPLE_BLOCKS = SAMPLE_BLOCKS;
window.SAMPLE_PIPES = SAMPLE_PIPES;
window.SAMPLE_VALVES = SAMPLE_VALVES;
window.SAMPLE_METERS = SAMPLE_METERS;
window.SAMPLE_PRESSURE_POINTS = SAMPLE_PRESSURE_POINTS;
window.SAMPLE_LEAK_POINTS = SAMPLE_LEAK_POINTS;
window.SAMPLE_REVENUE_WATER_DATA = SAMPLE_REVENUE_WATER_DATA;
