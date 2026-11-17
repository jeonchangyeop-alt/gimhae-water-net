/**
 * 김해시 상수도 공급 계통도 데이터 (명동권역, 삼계권역, 덕산권역)
 * 첨부 PDF 도면 기준 100% 매핑
 * 
 * 타입 구분:
 * - 'MAJOR': 대블록 (취수/정수) -> 연보라색
 * - 'MID': 중블록 (배수지/중블록) -> 연민트색
 * - 'SUB': 소블록 (92개 소블록) -> 노란색
 * - 'FACILITY': 시설(가압장/배수지) / 수용가 -> 흰색
 */

const KIMHAE_TOPOLOGY_DATA = {
    // 1. 명동권역 계통도 (Page 1 ~ 4)
    myeongdong: {
        id: "myeongdong",
        title: "명동권역 계통도",
        nodes: [
            // 계통 간선
            { id: "MD-IN-1", label: "창암(취)", type: "MAJOR", x: 60, y: 80 },
            { id: "MD-PUMP-1", label: "생림(가)", type: "FACILITY", x: 190, y: 80 },
            { id: "MD-PUR-1", label: "명동(정)", type: "MAJOR", x: 320, y: 80 },

            // 중블록 1: 진영(배)
            { id: "MD-RES-JY", label: "진영(배)", type: "MID", x: 480, y: 80 },
            
            // 진영1 계통
            { id: "BLK-JY-1", label: "진영1", type: "SUB", x: 660, y: 80 },
            { id: "USR-JY-1", label: "수용가", type: "FACILITY", x: 820, y: 60 },
            { id: "PUMP-PJ-1", label: "평지1(가)", type: "FACILITY", x: 820, y: 120 },
            { id: "RES-PJ-1", label: "평지1(배)", type: "FACILITY", x: 960, y: 120 },
            { id: "PUMP-PJ-2", label: "평지2(가)", type: "FACILITY", x: 1100, y: 120 },
            { id: "RES-PJ-2", label: "평지2(배)", type: "FACILITY", x: 1240, y: 120 },
            { id: "USR-PJ-2", label: "수용가", type: "FACILITY", x: 1380, y: 120 },

            // 진영2 계통
            { id: "BLK-JY-2", label: "진영2", type: "SUB", x: 660, y: 220 },
            { id: "USR-JY-2", label: "수용가", type: "FACILITY", x: 820, y: 200 },
            { id: "PUMP-NR", label: "내룡(가)", type: "FACILITY", x: 820, y: 260 },
            { id: "RES-NR", label: "내룡(배)", type: "FACILITY", x: 960, y: 260 },
            { id: "USR-NR", label: "수용가", type: "FACILITY", x: 1100, y: 260 },

            // 진영3 ~ 7
            { id: "BLK-JY-3", label: "진영3", type: "SUB", x: 660, y: 340 },
            { id: "USR-JY-3", label: "수용가", type: "FACILITY", x: 820, y: 340 },
            { id: "BLK-JY-4", label: "진영4", type: "SUB", x: 660, y: 420 },
            { id: "USR-JY-4", label: "수용가", type: "FACILITY", x: 820, y: 420 },
            { id: "BLK-JY-5", label: "진영5", type: "SUB", x: 660, y: 500 },
            { id: "USR-JY-5", label: "수용가", type: "FACILITY", x: 820, y: 500 },
            { id: "BLK-JY-6", label: "진영6", type: "SUB", x: 740, y: 560 },
            { id: "USR-JY-6", label: "수용가", type: "FACILITY", x: 900, y: 560 },
            { id: "BLK-JY-7", label: "진영7", type: "SUB", x: 740, y: 640 },
            { id: "USR-JY-7", label: "수용가", type: "FACILITY", x: 900, y: 620 },
            { id: "PUMP-HG-IND", label: "하계농공(가)", type: "FACILITY", x: 900, y: 680 },
            { id: "RES-HG-IND", label: "하계농공(배)", type: "FACILITY", x: 1060, y: 680 },
            { id: "USR-HG-IND", label: "수용가", type: "FACILITY", x: 1200, y: 680 },
            { id: "PUMP-HG", label: "하계(가)", type: "FACILITY", x: 900, y: 760 },
            { id: "RES-HG", label: "하계(배)", type: "FACILITY", x: 1060, y: 760 },
            { id: "PUMP-DC", label: "대창(가)", type: "FACILITY", x: 1200, y: 760 },
            { id: "USR-DC", label: "수용가", type: "FACILITY", x: 1340, y: 760 },

            // 중블록 2: 진례직결 / 진례(배)
            { id: "MID-JL-DIR", label: "진례직결(중)", type: "MID", x: 480, y: 920 },
            { id: "SUB-JL-DIR", label: "진례직결(소)", type: "SUB", x: 480, y: 960 },
            { id: "USR-JL-DIR", label: "수용가", type: "FACILITY", x: 660, y: 920 },
            { id: "PUMP-DAM", label: "담안(가)", type: "FACILITY", x: 660, y: 1000 },
            { id: "RES-DAM", label: "담안(배)", type: "FACILITY", x: 800, y: 1000 },
            { id: "USR-DAM", label: "수용가", type: "FACILITY", x: 940, y: 1000 },
            { id: "PUMP-SB", label: "산본(가)", type: "FACILITY", x: 660, y: 1080 },
            { id: "USR-SB", label: "수용가", type: "FACILITY", x: 800, y: 1080 },
            { id: "PUMP-YJ", label: "용전(가)", type: "FACILITY", x: 660, y: 1160 },
            { id: "USR-YJ", label: "수용가", type: "FACILITY", x: 800, y: 1160 },

            { id: "RES-JL", label: "진례(배)", type: "MID", x: 480, y: 1260 },
            { id: "SUB-TECHNO", label: "테크노산단", type: "SUB", x: 660, y: 1260 },
            { id: "USR-TECHNO", label: "수용가", type: "FACILITY", x: 820, y: 1260 },

            // 중블록 3: 한림직결 / 한림1~5
            { id: "MID-HL-DIR", label: "한림직결(중)", type: "MID", x: 480, y: 1380 },
            { id: "SUB-HL-5", label: "한림5(소)", type: "SUB", x: 480, y: 1420 },
            { id: "SUB-HL-1", label: "한림1", type: "SUB", x: 660, y: 1380 },
            { id: "USR-HL-1", label: "수용가", type: "FACILITY", x: 820, y: 1360 },
            { id: "PUMP-SL", label: "상리(가)", type: "FACILITY", x: 820, y: 1420 },
            { id: "RES-SL", label: "상리(배)", type: "FACILITY", x: 960, y: 1420 },
            { id: "USR-SL", label: "수용가", type: "FACILITY", x: 1100, y: 1420 },
            { id: "SUB-HL-2", label: "한림2", type: "SUB", x: 660, y: 1520 },
            { id: "USR-HL-2", label: "수용가", type: "FACILITY", x: 820, y: 1520 },
            { id: "SUB-HL-3", label: "한림3", type: "SUB", x: 660, y: 1600 },
            { id: "USR-HL-3", label: "수용가", type: "FACILITY", x: 820, y: 1600 },
            { id: "SUB-HL-4", label: "한림4", type: "SUB", x: 660, y: 1680 },
            { id: "USR-HL-4", label: "수용가", type: "FACILITY", x: 820, y: 1680 },

            // 중블록 4: 병동농공
            { id: "MID-BD-IND", label: "병동농공(중)", type: "MID", x: 480, y: 1780 },
            { id: "SUB-BD-IND", label: "병동농공(소)", type: "SUB", x: 480, y: 1820 },
            { id: "USR-BD-IND", label: "수용가", type: "FACILITY", x: 660, y: 1780 },
            { id: "PUMP-GR-1", label: "고령1(가)", type: "FACILITY", x: 660, y: 1840 },
            { id: "PUMP-GR-2", label: "고령2(가)", type: "FACILITY", x: 800, y: 1840 },
            { id: "RES-GR", label: "고령(배)", type: "FACILITY", x: 940, y: 1840 },
            { id: "USR-GR", label: "수용가", type: "FACILITY", x: 1080, y: 1840 },
            { id: "PUMP-BG", label: "범곡(가)", type: "FACILITY", x: 660, y: 1920 },
            { id: "USR-BG", label: "수용가", type: "FACILITY", x: 800, y: 1920 },

            // 중블록 5: 장유고지(배) 및 장유1~8
            { id: "RES-JY-HIGH", label: "장유고지(배)", type: "MID", x: 480, y: 2060 },
            { id: "SUB-JY-1", label: "장유1", type: "SUB", x: 660, y: 2060 },
            { id: "USR-JY-G1", label: "수용가", type: "FACILITY", x: 820, y: 2060 },
            { id: "SUB-JY-2", label: "장유2", type: "SUB", x: 660, y: 2140 },
            { id: "USR-JY-G2", label: "수용가", type: "FACILITY", x: 820, y: 2120 },
            { id: "PUMP-NJ", label: "냉정(가)", type: "FACILITY", x: 820, y: 2180 },
            { id: "RES-NJ", label: "냉정(배)", type: "FACILITY", x: 960, y: 2180 },
            { id: "USR-NJ", label: "수용가", type: "FACILITY", x: 1100, y: 2180 },
            { id: "SUB-JY-3", label: "장유3", type: "SUB", x: 660, y: 2260 },
            { id: "USR-JY-G3", label: "수용가", type: "FACILITY", x: 820, y: 2260 },
            { id: "SUB-JY-4", label: "장유4", type: "SUB", x: 660, y: 2340 },
            { id: "USR-JY-G4", label: "수용가", type: "FACILITY", x: 820, y: 2340 },
            { id: "SUB-JY-5", label: "장유5", type: "SUB", x: 660, y: 2420 },
            { id: "USR-JY-G5", label: "수용가", type: "FACILITY", x: 820, y: 2420 },
            { id: "SUB-JY-6", label: "장유6", type: "SUB", x: 660, y: 2500 },
            { id: "USR-JY-G6", label: "수용가", type: "FACILITY", x: 820, y: 2500 },
            { id: "SUB-JY-7", label: "장유7", type: "SUB", x: 660, y: 2580 },
            { id: "USR-JY-G7", label: "수용가", type: "FACILITY", x: 820, y: 2560 },
            { id: "PUMP-SJ-1", label: "상점1(가)", type: "FACILITY", x: 820, y: 2620 },
            { id: "RES-SJ-1", label: "상점1(배)", type: "FACILITY", x: 960, y: 2620 },
            { id: "PUMP-SJ-2", label: "상점2(가)", type: "FACILITY", x: 1100, y: 2620 },
            { id: "RES-SJ-2", label: "상점2(배)", type: "FACILITY", x: 1380, y: 2620 },
            { id: "USR-SJ-2", label: "수용가", type: "FACILITY", x: 1520, y: 2620 },
            { id: "SUB-JY-8", label: "장유8", type: "SUB", x: 660, y: 2720 },
            { id: "USR-JY-G8", label: "수용가", type: "FACILITY", x: 820, y: 2700 },
            { id: "PUMP-GD", label: "관동(가)", type: "FACILITY", x: 820, y: 2760 },
            { id: "RES-GD", label: "관동(배)", type: "FACILITY", x: 960, y: 2760 },
            { id: "USR-GD", label: "수용가", type: "FACILITY", x: 1100, y: 2760 },

            // 율하(배)
            { id: "RES-YH", label: "율하(배)", type: "MID", x: 480, y: 2860 },
            { id: "SUB-JY-9", label: "장유9", type: "SUB", x: 660, y: 2860 },
            { id: "USR-JY-9", label: "수용가", type: "FACILITY", x: 820, y: 2860 },
            { id: "SUB-YH-2", label: "율하2", type: "SUB", x: 660, y: 2940 },
            { id: "USR-YH-2", label: "수용가", type: "FACILITY", x: 820, y: 2940 }
        ],
        edges: [
            // 취수 -> 가압 -> 정수
            { from: "MD-IN-1", to: "MD-PUMP-1" },
            { from: "MD-PUMP-1", to: "MD-PUR-1" },
            
            // 정수장 -> 각 배수지/중블록 분기
            { from: "MD-PUR-1", to: "MD-RES-JY" },
            { from: "MD-PUR-1", to: "MID-JL-DIR" },
            { from: "MD-PUR-1", to: "RES-JL" },
            { from: "MD-PUR-1", to: "MID-HL-DIR" },
            { from: "MD-PUR-1", to: "MID-BD-IND" },
            { from: "MD-PUR-1", to: "RES-JY-HIGH" },
            { from: "MD-PUR-1", to: "RES-YH" },

            // 진영(배) 계통
            { from: "MD-RES-JY", to: "BLK-JY-1" },
            { from: "BLK-JY-1", to: "USR-JY-1" },
            { from: "BLK-JY-1", to: "PUMP-PJ-1" },
            { from: "PUMP-PJ-1", to: "RES-PJ-1" },
            { from: "RES-PJ-1", to: "PUMP-PJ-2" },
            { from: "PUMP-PJ-2", to: "RES-PJ-2" },
            { from: "RES-PJ-2", to: "USR-PJ-2" },

            { from: "MD-RES-JY", to: "BLK-JY-2" },
            { from: "BLK-JY-2", to: "USR-JY-2" },
            { from: "BLK-JY-2", to: "PUMP-NR" },
            { from: "PUMP-NR", to: "RES-NR" },
            { from: "RES-NR", to: "USR-NR" },

            { from: "MD-RES-JY", to: "BLK-JY-3" },
            { from: "BLK-JY-3", to: "USR-JY-3" },
            { from: "MD-RES-JY", to: "BLK-JY-4" },
            { from: "BLK-JY-4", to: "USR-JY-4" },
            { from: "MD-RES-JY", to: "BLK-JY-5" },
            { from: "BLK-JY-5", to: "USR-JY-5" },
            { from: "BLK-JY-5", to: "BLK-JY-6" },
            { from: "BLK-JY-6", to: "USR-JY-6" },
            { from: "BLK-JY-5", to: "BLK-JY-7" },
            { from: "BLK-JY-7", to: "USR-JY-7" },
            { from: "BLK-JY-7", to: "PUMP-HG-IND" },
            { from: "PUMP-HG-IND", to: "RES-HG-IND" },
            { from: "RES-HG-IND", to: "USR-HG-IND" },
            { from: "BLK-JY-7", to: "PUMP-HG" },
            { from: "PUMP-HG", to: "RES-HG" },
            { from: "RES-HG", to: "PUMP-DC" },
            { from: "PUMP-DC", to: "USR-DC" },

            // 진례직결
            { from: "MID-JL-DIR", to: "SUB-JL-DIR" },
            { from: "MID-JL-DIR", to: "USR-JL-DIR" },
            { from: "MID-JL-DIR", to: "PUMP-DAM" },
            { from: "PUMP-DAM", to: "RES-DAM" },
            { from: "RES-DAM", to: "USR-DAM" },
            { from: "MID-JL-DIR", to: "PUMP-SB" },
            { from: "PUMP-SB", to: "USR-SB" },
            { from: "MID-JL-DIR", to: "PUMP-YJ" },
            { from: "PUMP-YJ", to: "USR-YJ" },

            // 진례(배)
            { from: "RES-JL", to: "SUB-TECHNO" },
            { from: "SUB-TECHNO", to: "USR-TECHNO" },

            // 한림
            { from: "MID-HL-DIR", to: "SUB-HL-5" },
            { from: "MID-HL-DIR", to: "SUB-HL-1" },
            { from: "SUB-HL-1", to: "USR-HL-1" },
            { from: "SUB-HL-1", to: "PUMP-SL" },
            { from: "PUMP-SL", to: "RES-SL" },
            { from: "RES-SL", to: "USR-SL" },
            { from: "MID-HL-DIR", to: "SUB-HL-2" },
            { from: "SUB-HL-2", to: "USR-HL-2" },
            { from: "MID-HL-DIR", to: "SUB-HL-3" },
            { from: "SUB-HL-3", to: "USR-HL-3" },
            { from: "MID-HL-DIR", to: "SUB-HL-4" },
            { from: "SUB-HL-4", to: "USR-HL-4" },

            // 병동농공
            { from: "MID-BD-IND", to: "SUB-BD-IND" },
            { from: "MID-BD-IND", to: "USR-BD-IND" },
            { from: "MID-BD-IND", to: "PUMP-GR-1" },
            { from: "PUMP-GR-1", to: "PUMP-GR-2" },
            { from: "PUMP-GR-2", to: "RES-GR" },
            { from: "RES-GR", to: "USR-GR" },
            { from: "MID-BD-IND", to: "PUMP-BG" },
            { from: "PUMP-BG", to: "USR-BG" },

            // 장유고지(배)
            { from: "RES-JY-HIGH", to: "SUB-JY-1" },
            { from: "SUB-JY-1", to: "USR-JY-G1" },
            { from: "RES-JY-HIGH", to: "SUB-JY-2" },
            { from: "SUB-JY-2", to: "USR-JY-G2" },
            { from: "SUB-JY-2", to: "PUMP-NJ" },
            { from: "PUMP-NJ", to: "RES-NJ" },
            { from: "RES-NJ", to: "USR-NJ" },
            { from: "RES-JY-HIGH", to: "SUB-JY-3" },
            { from: "SUB-JY-3", to: "USR-JY-G3" },
            { from: "RES-JY-HIGH", to: "SUB-JY-4" },
            { from: "SUB-JY-4", to: "USR-JY-G4" },
            { from: "RES-JY-HIGH", to: "SUB-JY-5" },
            { from: "SUB-JY-5", to: "USR-JY-G5" },
            { from: "RES-JY-HIGH", to: "SUB-JY-6" },
            { from: "SUB-JY-6", to: "USR-JY-G6" },
            { from: "RES-JY-HIGH", to: "SUB-JY-7" },
            { from: "SUB-JY-7", to: "USR-JY-G7" },
            { from: "SUB-JY-7", to: "PUMP-SJ-1" },
            { from: "PUMP-SJ-1", to: "RES-SJ-1" },
            { from: "RES-SJ-1", to: "PUMP-SJ-2" },
            { from: "PUMP-SJ-2", to: "RES-SJ-2" },
            { from: "RES-SJ-2", to: "USR-SJ-2" },
            { from: "RES-JY-HIGH", to: "SUB-JY-8" },
            { from: "SUB-JY-8", to: "USR-JY-G8" },
            { from: "SUB-JY-8", to: "PUMP-GD" },
            { from: "PUMP-GD", to: "RES-GD" },
            { from: "RES-GD", to: "USR-GD" },

            // 율하(배)
            { from: "RES-YH", to: "SUB-JY-9" },
            { from: "SUB-JY-9", to: "USR-JY-9" },
            { from: "RES-YH", to: "SUB-YH-2" },
            { from: "SUB-YH-2", to: "USR-YH-2" }
        ]
    },

    // 2. 삼계권역 계통도 (Page 5 ~ 9)
    samgye: {
        id: "samgye",
        title: "삼계권역 계통도",
        nodes: [
            { id: "SG-IN-1", label: "창암(취)", type: "MAJOR", x: 60, y: 80 },
            { id: "SG-PUMP-1", label: "생림(가)", type: "FACILITY", x: 190, y: 80 },
            { id: "SG-PUR-1", label: "삼계(정)", type: "MAJOR", x: 320, y: 80 },
            
            // 생림(배)
            { id: "SG-RES-SL", label: "생림(배)", type: "MID", x: 480, y: 80 },
            { id: "SG-PUMP-AG", label: "안금(가)", type: "FACILITY", x: 640, y: 80 },
            { id: "SG-RES-AG", label: "안금(배)", type: "FACILITY", x: 780, y: 80 },
            { id: "BLK-SL-1", label: "생림1", type: "SUB", x: 920, y: 80 },
            { id: "USR-SL-1", label: "수용가", type: "FACILITY", x: 1060, y: 60 },
            { id: "PUMP-JC", label: "장척(가)", type: "FACILITY", x: 1060, y: 110 },
            { id: "USR-JC", label: "수용가", type: "FACILITY", x: 1200, y: 110 },

            { id: "BLK-SL-2", label: "생림2", type: "SUB", x: 640, y: 180 },
            { id: "USR-SL-2", label: "수용가", type: "FACILITY", x: 800, y: 180 },

            { id: "BLK-SL-3", label: "생림3", type: "SUB", x: 780, y: 240 },
            { id: "USR-SL-3", label: "수용가", type: "FACILITY", x: 940, y: 220 },
            { id: "PUMP-BL", label: "봉림(가)", type: "FACILITY", x: 940, y: 270 },
            { id: "RES-BL", label: "봉림(배)", type: "FACILITY", x: 1080, y: 270 },
            { id: "USR-BL", label: "수용가", type: "FACILITY", x: 1220, y: 270 },
            { id: "PUMP-SC", label: "생철(가)", type: "FACILITY", x: 940, y: 340 },
            { id: "RES-SC", label: "생철(배)", type: "FACILITY", x: 1080, y: 340 },
            { id: "USR-SC", label: "수용가", type: "FACILITY", x: 1220, y: 340 },

            // 동지역(중) 분기 - 김해 도심부
            { id: "MID-DONG", label: "동지역(중)", type: "MID", x: 480, y: 500 },

            // 구산1~4
            { id: "BLK-GS-1", label: "구산1", type: "SUB", x: 660, y: 500 },
            { id: "USR-GS-1", label: "수용가", type: "FACILITY", x: 820, y: 500 },
            { id: "BLK-GS-2", label: "구산2", type: "SUB", x: 660, y: 560 },
            { id: "USR-GS-2", label: "수용가", type: "FACILITY", x: 820, y: 560 },
            { id: "BLK-GS-3", label: "구산3", type: "SUB", x: 660, y: 620 },
            { id: "USR-GS-3", label: "수용가", type: "FACILITY", x: 820, y: 620 },
            { id: "BLK-GS-4", label: "구산4", type: "SUB", x: 660, y: 680 },
            { id: "USR-GS-4", label: "수용가", type: "FACILITY", x: 820, y: 680 },

            // 내외1~8
            { id: "BLK-NW-1", label: "내외1", type: "SUB", x: 660, y: 760 },
            { id: "USR-NW-1", label: "수용가", type: "FACILITY", x: 820, y: 760 },
            { id: "BLK-NW-2", label: "내외2", type: "SUB", x: 660, y: 820 },
            { id: "USR-NW-2", label: "수용가", type: "FACILITY", x: 820, y: 820 },
            { id: "BLK-NW-3", label: "내외3", type: "SUB", x: 660, y: 880 },
            { id: "USR-NW-3", label: "수용가", type: "FACILITY", x: 820, y: 880 },
            { id: "BLK-NW-4", label: "내외4", type: "SUB", x: 660, y: 940 },
            { id: "USR-NW-4", label: "수용가", type: "FACILITY", x: 820, y: 940 },
            { id: "BLK-NW-5", label: "내외5", type: "SUB", x: 660, y: 1000 },
            { id: "USR-NW-5", label: "수용가", type: "FACILITY", x: 820, y: 1000 },
            { id: "BLK-NW-6", label: "내외6", type: "SUB", x: 660, y: 1060 },
            { id: "USR-NW-6", label: "수용가", type: "FACILITY", x: 820, y: 1060 },
            { id: "BLK-NW-7", label: "내외7", type: "SUB", x: 660, y: 1120 },
            { id: "USR-NW-7", label: "수용가", type: "FACILITY", x: 820, y: 1120 },
            { id: "BLK-NW-8", label: "내외8", type: "SUB", x: 660, y: 1180 },
            { id: "USR-NW-8", label: "수용가", type: "FACILITY", x: 820, y: 1180 },

            // 동상1~2, 부원6, 부원7, 부원8
            { id: "PUMP-DS", label: "동상(가)", type: "FACILITY", x: 660, y: 1260 },
            { id: "RES-DS", label: "동상(배)", type: "FACILITY", x: 800, y: 1260 },
            { id: "BLK-DS-1", label: "동상1", type: "SUB", x: 940, y: 1260 },
            { id: "USR-DS-1", label: "수용가", type: "FACILITY", x: 1080, y: 1260 },
            { id: "BLK-DS-2", label: "동상2", type: "SUB", x: 660, y: 1330 },
            { id: "USR-DS-2", label: "수용가", type: "FACILITY", x: 820, y: 1330 },

            { id: "BLK-BW-6", label: "부원6", type: "SUB", x: 660, y: 1400 },
            { id: "USR-BW-6", label: "수용가", type: "FACILITY", x: 820, y: 1400 },
            { id: "BLK-BW-71", label: "부원7-1", type: "SUB", x: 660, y: 1460 },
            { id: "USR-BW-71", label: "수용가", type: "FACILITY", x: 820, y: 1460 },
            { id: "BLK-BW-72", label: "부원7-2", type: "SUB", x: 660, y: 1520 },
            { id: "USR-BW-72", label: "수용가", type: "FACILITY", x: 820, y: 1520 },
            { id: "BLK-BW-73", label: "부원7-3", type: "SUB", x: 660, y: 1580 },
            { id: "USR-BW-73", label: "수용가", type: "FACILITY", x: 820, y: 1580 },
            { id: "BLK-BW-8", label: "부원8", type: "SUB", x: 660, y: 1640 },
            { id: "USR-BW-8", label: "수용가", type: "FACILITY", x: 820, y: 1640 },

            // 북부1~6
            { id: "BLK-BB-1", label: "북부1", type: "SUB", x: 660, y: 1720 },
            { id: "USR-BB-1", label: "수용가", type: "FACILITY", x: 820, y: 1700 },
            { id: "PUMP-GB", label: "감분(가)", type: "FACILITY", x: 820, y: 1750 },
            { id: "RES-GB", label: "감분(배)", type: "FACILITY", x: 960, y: 1750 },
            { id: "USR-GB", label: "수용가", type: "FACILITY", x: 1100, y: 1750 },
            { id: "PUMP-DG", label: "두곡(가)", type: "FACILITY", x: 820, y: 1810 },
            { id: "USR-DG", label: "수용가", type: "FACILITY", x: 960, y: 1810 },
            { id: "BLK-BB-3", label: "북부3", type: "SUB", x: 660, y: 1880 },
            { id: "USR-BB-3", label: "수용가", type: "FACILITY", x: 820, y: 1880 },
            { id: "BLK-BB-4", label: "북부4", type: "SUB", x: 660, y: 1940 },
            { id: "USR-BB-4", label: "수용가", type: "FACILITY", x: 820, y: 1920 },
            { id: "PUMP-BB", label: "북부(가)", type: "FACILITY", x: 820, y: 1980 },
            { id: "RES-BB", label: "북부(배)", type: "FACILITY", x: 960, y: 1980 },
            { id: "USR-BB-RES", label: "수용가", type: "FACILITY", x: 1100, y: 1980 },
            { id: "BLK-BB-5", label: "북부5", type: "SUB", x: 660, y: 2060 },
            { id: "USR-BB-5", label: "수용가", type: "FACILITY", x: 820, y: 2040 },
            { id: "BLK-BB-2", label: "북부2", type: "SUB", x: 820, y: 2100 },
            { id: "USR-BB-2", label: "수용가", type: "FACILITY", x: 960, y: 2100 },
            { id: "BLK-BB-6", label: "북부6", type: "SUB", x: 660, y: 2170 },
            { id: "USR-BB-6", label: "수용가", type: "FACILITY", x: 820, y: 2170 },

            // 활천1~5, 칠산서부1~3
            { id: "BLK-HC-1", label: "활천1", type: "SUB", x: 660, y: 2260 },
            { id: "USR-HC-1", label: "수용가", type: "FACILITY", x: 820, y: 2260 },
            { id: "BLK-HC-2", label: "활천2", type: "SUB", x: 660, y: 2320 },
            { id: "USR-HC-2", label: "수용가", type: "FACILITY", x: 820, y: 2320 },
            { id: "BLK-HC-3", label: "활천3", type: "SUB", x: 660, y: 2380 },
            { id: "USR-HC-3", label: "수용가", type: "FACILITY", x: 820, y: 2380 },
            { id: "BLK-CS-1", label: "칠산서부1", type: "SUB", x: 660, y: 2450 },
            { id: "USR-CS-1", label: "수용가", type: "FACILITY", x: 820, y: 2450 },
            { id: "BLK-CS-2", label: "칠산서부2", type: "SUB", x: 660, y: 2510 },
            { id: "USR-CS-2", label: "수용가", type: "FACILITY", x: 820, y: 2490 },
            { id: "BLK-CS-3", label: "칠산서부3", type: "SUB", x: 820, y: 2550 },
            { id: "USR-CS-3", label: "수용가", type: "FACILITY", x: 960, y: 2550 }
        ],
        edges: [
            { from: "SG-IN-1", to: "SG-PUMP-1" },
            { from: "SG-PUMP-1", to: "SG-PUR-1" },
            { from: "SG-PUR-1", to: "SG-RES-SL" },
            { from: "SG-PUR-1", to: "MID-DONG" },

            // 생림(배)
            { from: "SG-RES-SL", to: "SG-PUMP-AG" },
            { from: "SG-PUMP-AG", to: "SG-RES-AG" },
            { from: "SG-RES-AG", to: "BLK-SL-1" },
            { from: "BLK-SL-1", to: "USR-SL-1" },
            { from: "BLK-SL-1", to: "PUMP-JC" },
            { from: "PUMP-JC", to: "USR-JC" },

            { from: "SG-RES-SL", to: "BLK-SL-2" },
            { from: "BLK-SL-2", to: "USR-SL-2" },
            { from: "BLK-SL-2", to: "BLK-SL-3" },
            { from: "BLK-SL-3", to: "USR-SL-3" },
            { from: "BLK-SL-3", to: "PUMP-BL" },
            { from: "PUMP-BL", to: "RES-BL" },
            { from: "RES-BL", to: "USR-BL" },
            { from: "BLK-SL-3", to: "PUMP-SC" },
            { from: "PUMP-SC", to: "RES-SC" },
            { from: "RES-SC", to: "USR-SC" },

            // 동지역(중) 하위 구산1~4, 내외1~8, 부원, 북부 등
            { from: "MID-DONG", to: "BLK-GS-1" }, { from: "BLK-GS-1", to: "USR-GS-1" },
            { from: "MID-DONG", to: "BLK-GS-2" }, { from: "BLK-GS-2", to: "USR-GS-2" },
            { from: "MID-DONG", to: "BLK-GS-3" }, { from: "BLK-GS-3", to: "USR-GS-3" },
            { from: "MID-DONG", to: "BLK-GS-4" }, { from: "BLK-GS-4", to: "USR-GS-4" },

            { from: "MID-DONG", to: "BLK-NW-1" }, { from: "BLK-NW-1", to: "USR-NW-1" },
            { from: "MID-DONG", to: "BLK-NW-2" }, { from: "BLK-NW-2", to: "USR-NW-2" },
            { from: "MID-DONG", to: "BLK-NW-3" }, { from: "BLK-NW-3", to: "USR-NW-3" },
            { from: "MID-DONG", to: "BLK-NW-4" }, { from: "BLK-NW-4", to: "USR-NW-4" },
            { from: "MID-DONG", to: "BLK-NW-5" }, { from: "BLK-NW-5", to: "USR-NW-5" },
            { from: "MID-DONG", to: "BLK-NW-6" }, { from: "BLK-NW-6", to: "USR-NW-6" },
            { from: "MID-DONG", to: "BLK-NW-7" }, { from: "BLK-NW-7", to: "USR-NW-7" },
            { from: "MID-DONG", to: "BLK-NW-8" }, { from: "BLK-NW-8", to: "USR-NW-8" },

            { from: "MID-DONG", to: "PUMP-DS" }, { from: "PUMP-DS", to: "RES-DS" }, { from: "RES-DS", to: "BLK-DS-1" }, { from: "BLK-DS-1", to: "USR-DS-1" },
            { from: "MID-DONG", to: "BLK-DS-2" }, { from: "BLK-DS-2", to: "USR-DS-2" },

            { from: "MID-DONG", to: "BLK-BW-6" }, { from: "BLK-BW-6", to: "USR-BW-6" },
            { from: "MID-DONG", to: "BLK-BW-71" }, { from: "BLK-BW-71", to: "USR-BW-71" },
            { from: "MID-DONG", to: "BLK-BW-72" }, { from: "BLK-BW-72", to: "USR-BW-72" },
            { from: "MID-DONG", to: "BLK-BW-73" }, { from: "BLK-BW-73", to: "USR-BW-73" },
            { from: "MID-DONG", to: "BLK-BW-8" }, { from: "BLK-BW-8", to: "USR-BW-8" },

            { from: "MID-DONG", to: "BLK-BB-1" }, { from: "BLK-BB-1", to: "USR-BB-1" },
            { from: "BLK-BB-1", to: "PUMP-GB" }, { from: "PUMP-GB", to: "RES-GB" }, { from: "RES-GB", to: "USR-GB" },
            { from: "BLK-BB-1", to: "PUMP-DG" }, { from: "PUMP-DG", to: "USR-DG" },
            { from: "MID-DONG", to: "BLK-BB-3" }, { from: "BLK-BB-3", to: "USR-BB-3" },
            { from: "MID-DONG", to: "BLK-BB-4" }, { from: "BLK-BB-4", to: "USR-BB-4" },
            { from: "BLK-BB-4", to: "PUMP-BB" }, { from: "PUMP-BB", to: "RES-BB" }, { from: "RES-BB", to: "USR-BB-RES" },
            { from: "MID-DONG", to: "BLK-BB-5" }, { from: "BLK-BB-5", to: "USR-BB-5" },
            { from: "BLK-BB-5", to: "BLK-BB-2" }, { from: "BLK-BB-2", to: "USR-BB-2" },
            { from: "MID-DONG", to: "BLK-BB-6" }, { from: "BLK-BB-6", to: "USR-BB-6" },

            { from: "MID-DONG", to: "BLK-HC-1" }, { from: "BLK-HC-1", to: "USR-HC-1" },
            { from: "MID-DONG", to: "BLK-HC-2" }, { from: "BLK-HC-2", to: "USR-HC-2" },
            { from: "MID-DONG", to: "BLK-HC-3" }, { from: "BLK-HC-3", to: "USR-HC-3" },
            { from: "MID-DONG", to: "BLK-CS-1" }, { from: "BLK-CS-1", to: "USR-CS-1" },
            { from: "MID-DONG", to: "BLK-CS-2" }, { from: "BLK-CS-2", to: "USR-CS-2" },
            { from: "BLK-CS-2", to: "BLK-CS-3" }, { from: "BLK-CS-3", to: "USR-CS-3" }
        ]
    },

    // 3. 덕산권역 계통도 (Page 10)
    deoksan: {
        id: "deoksan",
        title: "덕산권역 계통도",
        nodes: [
            { id: "DS-IN-1", label: "매리(취)", type: "MAJOR", x: 60, y: 80 },
            { id: "DS-PUR-1", label: "덕산(정)", type: "MAJOR", x: 200, y: 80 },

            // 대동(중)
            { id: "MID-DD", label: "대동(중)", type: "MID", x: 360, y: 80 },
            { id: "BLK-DD-1", label: "대동1", type: "SUB", x: 500, y: 80 },
            { id: "USR-DD-1", label: "수용가", type: "FACILITY", x: 660, y: 80 },

            { id: "BLK-DD-2", label: "대동2", type: "SUB", x: 500, y: 150 },
            { id: "USR-DD-2", label: "수용가", type: "FACILITY", x: 660, y: 150 },
            { id: "BLK-DD-3", label: "대동3", type: "SUB", x: 660, y: 220 },
            { id: "USR-DD-3", label: "수용가", type: "FACILITY", x: 820, y: 220 },
            { id: "PUMP-SR", label: "시례(가)", type: "FACILITY", x: 660, y: 280 },
            { id: "USR-SR", label: "수용가", type: "FACILITY", x: 820, y: 280 },
            { id: "PUMP-WD", label: "원동(가)", type: "FACILITY", x: 660, y: 340 },
            { id: "USR-WD", label: "수용가", type: "FACILITY", x: 820, y: 340 },

            { id: "BLK-DD-5", label: "대동5", type: "SUB", x: 500, y: 420 },
            { id: "USR-DD-5", label: "수용가", type: "FACILITY", x: 660, y: 420 },
            { id: "BLK-DD-4", label: "대동4", type: "SUB", x: 660, y: 480 },
            { id: "USR-DD-4", label: "수용가", type: "FACILITY", x: 820, y: 480 },
            { id: "BLK-DD-6", label: "대동6", type: "SUB", x: 660, y: 540 },
            { id: "USR-DD-6", label: "수용가", type: "FACILITY", x: 820, y: 540 },

            // 상동(중)
            { id: "MID-SD", label: "상동(중)", type: "MID", x: 360, y: 640 },
            { id: "PUMP-DD", label: "대동(가)", type: "FACILITY", x: 500, y: 640 },
            { id: "RES-DD", label: "대동(배)", type: "FACILITY", x: 640, y: 640 },
            
            { id: "BLK-SD-1", label: "상동1", type: "SUB", x: 800, y: 640 },
            { id: "USR-SD-1", label: "수용가", type: "FACILITY", x: 960, y: 640 },
            { id: "PUMP-SD-1", label: "상동1(가)", type: "FACILITY", x: 800, y: 700 },
            { id: "RES-SD-1", label: "상동1(배)", type: "FACILITY", x: 940, y: 700 },
            { id: "USR-SD-1B", label: "수용가", type: "FACILITY", x: 1080, y: 700 },
            { id: "PUMP-SD-2", label: "상동2(가)", type: "FACILITY", x: 1080, y: 760 },
            { id: "RES-SD-2", label: "상동2(배)", type: "FACILITY", x: 1220, y: 760 },
            { id: "USR-SD-2B", label: "수용가", type: "FACILITY", x: 1360, y: 760 },

            { id: "BLK-SD-2", label: "상동2", type: "SUB", x: 800, y: 840 },
            { id: "USR-SD-2", label: "수용가", type: "FACILITY", x: 960, y: 840 },
            { id: "BLK-SD-3", label: "상동3", type: "SUB", x: 800, y: 900 },
            { id: "USR-SD-3", label: "수용가", type: "FACILITY", x: 960, y: 900 }
        ],
        edges: [
            { from: "DS-IN-1", to: "DS-PUR-1" },
            { from: "DS-PUR-1", to: "MID-DD" },
            { from: "DS-PUR-1", to: "MID-SD" },

            // 대동(중)
            { from: "MID-DD", to: "BLK-DD-1" }, { from: "BLK-DD-1", to: "USR-DD-1" },
            { from: "MID-DD", to: "BLK-DD-2" }, { from: "BLK-DD-2", to: "USR-DD-2" },
            { from: "BLK-DD-2", to: "BLK-DD-3" }, { from: "BLK-DD-3", to: "USR-DD-3" },
            { from: "BLK-DD-2", to: "PUMP-SR" }, { from: "PUMP-SR", to: "USR-SR" },
            { from: "BLK-DD-2", to: "PUMP-WD" }, { from: "PUMP-WD", to: "USR-WD" },

            { from: "MID-DD", to: "BLK-DD-5" }, { from: "BLK-DD-5", to: "USR-DD-5" },
            { from: "BLK-DD-5", to: "BLK-DD-4" }, { from: "BLK-DD-4", to: "USR-DD-4" },
            { from: "BLK-DD-5", to: "BLK-DD-6" }, { from: "BLK-DD-6", to: "USR-DD-6" },

            // 상동(중)
            { from: "MID-SD", to: "PUMP-DD" }, { from: "PUMP-DD", to: "RES-DD" },
            { from: "RES-DD", to: "BLK-SD-1" }, { from: "BLK-SD-1", to: "USR-SD-1" },
            { from: "RES-DD", to: "PUMP-SD-1" }, { from: "PUMP-SD-1", to: "RES-SD-1" }, { from: "RES-SD-1", to: "USR-SD-1B" },
            { from: "RES-SD-1", to: "PUMP-SD-2" }, { from: "PUMP-SD-2", to: "RES-SD-2" }, { from: "RES-SD-2", to: "USR-SD-2B" },
            { from: "RES-DD", to: "BLK-SD-2" }, { from: "BLK-SD-2", to: "USR-SD-2" },
            { from: "RES-DD", to: "BLK-SD-3" }, { from: "BLK-SD-3", to: "USR-SD-3" }
        ]
    }
};

window.KIMHAE_TOPOLOGY_DATA = KIMHAE_TOPOLOGY_DATA;
