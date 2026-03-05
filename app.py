from flask import Flask
from apscheduler.schedulers.background import BackgroundScheduler
import logging

# [Model] 백그라운드 연산 모듈 임포트
from models.weather_model import init_target_points, update_wind_cache_job

# [Controller] Blueprint 임포트
from controllers.page_controller import page_bp
from controllers.api_controller import api_bp

app = Flask(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# 1. 스케줄러 및 데이터 초기화
init_target_points()
update_wind_cache_job()

scheduler = BackgroundScheduler(timezone="Asia/Seoul")
scheduler.add_job(update_wind_cache_job, 'cron', minute='15')
scheduler.start()

# 2. Controller (Blueprint) 등록
app.register_blueprint(page_bp)
app.register_blueprint(api_bp)

if __name__ == '__main__':
    app.run(debug=True, port=5000)