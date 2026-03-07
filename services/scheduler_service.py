# services/scheduler_service.py
from apscheduler.schedulers.background import BackgroundScheduler
import logging
import atexit
from datetime import datetime # 신규 추가

from models.weather_model import update_wind_cache_job
from models.facility_model import poll_new_disaster_msgs

def start_scheduler():
    scheduler = BackgroundScheduler(timezone="Asia/Seoul")
    
    # 1. [수정] 바람장 데이터 갱신 (매시 15분에 정확히 실행)
    scheduler.add_job(
        func=update_wind_cache_job, 
        trigger="cron",       # interval에서 cron 방식으로 변경
        minute=15,            # 매시간 15분에 동작하도록 지정
        id="wind_job", 
        replace_existing=True,
        next_run_time=datetime.now() # 서버 구동 시 최초 1회 즉시 실행은 유지
    )
    
    # 2. 신규 재난문자 폴링 (5분 간격)
    scheduler.add_job(
        func=poll_new_disaster_msgs, 
        trigger="interval", 
        minutes=5, 
        id="disaster_job", 
        replace_existing=True
    )
    
    scheduler.start()
    logging.info("백그라운드 스케줄러가 정상적으로 가동되었습니다.")
    atexit.register(lambda: scheduler.shutdown(wait=False))