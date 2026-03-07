# app.py
import os
import logging
from flask import Flask

# 분리된 컨트롤러(라우터) 임포트
from controllers.page_controller import page_bp
from controllers.api_controller import api_bp

# 분리된 스케줄러 서비스 임포트
from services.scheduler_service import start_scheduler

# 시스템 초기화 함수 임포트
from models.weather_model import init_target_points

# 로깅 기본 설정
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__)

# 컨트롤러 등록
app.register_blueprint(page_bp)
app.register_blueprint(api_bp)

# [핵심 인과관계 제어] 
# flask run --debug 실행 시 Werkzeug 리로더가 프로세스를 2개 띄웁니다.
# 메인 프로세스(WERKZEUG_RUN_MAIN == 'true')에서만 단 1회 초기화 및 스케줄러가 가동되도록 통제합니다.
if os.environ.get('WERKZEUG_RUN_MAIN') == 'true' or not app.debug:
    logging.info("시스템 초기화를 시작합니다...")
    init_target_points()  # 바람장 좌표 초기화 연산
    start_scheduler()     # 스케줄러 가동

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)