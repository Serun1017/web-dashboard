# services/scheduler_service.py
from apscheduler.schedulers.background import BackgroundScheduler
import logging
import atexit
from datetime import datetime, timedelta

from models.weather_model import update_wind_cache_job
from models.facility_model import poll_new_disaster_msgs

def start_scheduler():
    scheduler = BackgroundScheduler(timezone="Asia/Seoul")
    
    # 1. 바람장 데이터 갱신 (매시 15분 실행, 지각해도 무조건 실행하도록 허용시간 추가)
    scheduler.add_job(
        func=update_wind_cache_job, 
        trigger="cron",
        minute=15,
        id="wind_job", 
        replace_existing=True,
        misfire_grace_time=3600,  # [핵심] 1시간(3600초) 늦어도 취소하지 않고 즉시 실행
        next_run_time=datetime.now() + timedelta(seconds=3) # 서버 구동 후 3초 뒤 최초 1회 무조건 실행
    )
    
    # 2. 신규 재난문자 폴링 (5분 간격)
    scheduler.add_job(
        func=poll_new_disaster_msgs, 
        trigger="interval", 
        minutes=5, 
        id="disaster_job", 
        replace_existing=True,
        misfire_grace_time=300
    )
    
    scheduler.start()
    logging.info("백그라운드 스케줄러가 정상적으로 가동되었습니다.")
    atexit.register(lambda: scheduler.shutdown(wait=False))