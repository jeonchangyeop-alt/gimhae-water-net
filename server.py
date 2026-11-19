# -*- coding: utf-8 -*-
"""
김해관망관리 시스템 - 로컬 개발 및 테스트 서버
실행 시 자동으로 기본 브라우저를 열어 관망관리 시스템 화면을 띄웁니다.
"""
import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # CORS 허용 및 캐시 방지(개발용)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

def run_server():
    os.chdir(DIRECTORY)
    with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
        url = f"http://localhost:{PORT}/index.html"
        print("=" * 60)
        print(f" [김해관망관리 시스템] 로컬 서버가 시작되었습니다.")
        print(f" 접속 주소: {url}")
        print(f" 종료하려면 이 창에서 Ctrl+C를 누르세요.")
        print("=" * 60)
        
        # 브라우저 자동 오픈
        webbrowser.open(url)
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n서버를 종료합니다.")
            httpd.server_close()

if __name__ == '__main__':
    run_server()
