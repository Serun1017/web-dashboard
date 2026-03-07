from flask import Flask
from apscheduler.schedulers.background import BackgroundScheduler
from models.facility_model import poll_new_disaster_msgs # 추가 임포트
import logging
import os

# [Model] 백그라운드 연산 모듈 임포트
from models.weather_model import init_target_points, update_wind_cache_job

# [Controller] Blueprint 임포트
from controllers.page_controller import page_bp
from controllers.api_controller import api_bp

app = Flask(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# 1. 스케줄러 및 데이터 초기화
if os.environ.get('WERKZEUG_RUN_MAIN') == 'true' or not app.debug:
    init_target_points()
    update_wind_cache_job()

    scheduler = BackgroundScheduler(timezone="Asia/Seoul")
    scheduler.add_job(update_wind_cache_job, 'cron', minute='15')
    
    # 추가: 5분 주기로 새 재난 문자 확인 (DB 부하 방지용 간격)
    scheduler.add_job(poll_new_disaster_msgs, 'interval', minutes=5)
    scheduler.start()

# 2. Controller (Blueprint) 등록
app.register_blueprint(page_bp)
app.register_blueprint(api_bp)

if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True, port=5000)