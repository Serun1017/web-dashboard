# app.py
from flask import Flask, jsonify, render_template, request
from apscheduler.schedulers.background import BackgroundScheduler
from weather_service import init_target_points, update_wind_cache_job, get_wind_data
from db_service import get_factories, get_plants, get_shelters

import logging

app = Flask(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- [서버 초기화 및 스케줄러 등록] ---
init_target_points()
update_wind_cache_job() # 최초 1회 즉시 실행

scheduler = BackgroundScheduler(timezone="Asia/Seoul")
scheduler.add_job(update_wind_cache_job, 'cron', minute='15')
scheduler.start()


# --- [API 라우터] ---

@app.route('/')
def index():
    """메인 대시보드 화면 반환"""
    return render_template('index.html')

@app.route('/api/weather/wind')
def api_get_wind():
    """실시간 풍장 데이터 반환"""
    data = get_wind_data()
    if not data:
        return jsonify({"error": "데이터 초기화 중"}), 503
    return jsonify(data)

@app.route('/api/disaster/alerts')
def api_get_disaster_alerts():
    """재난 문자 및 공지사항 데이터 반환 (Stub)"""
    dummy_data = [
        {"time": "15:00", "level": "경계", "message": "인근 지역 비상 발령. 매뉴얼 확인 요망"},
        {"time": "14:30", "level": "주의", "message": "국지성 돌풍 발생. 시설물 점검 요망"}
    ]
    return jsonify(dummy_data)

@app.route('/api/disaster/sop')
def api_get_sop_manual():
    """상황별 SOP 매뉴얼 데이터 반환 (Stub)"""
    status = request.args.get('status', 'normal')
    dummy_sop = [
        {"id": 1, "task": "현장 인력 대피 지시", "done": False},
        {"id": 2, "task": "방사능 측정기 작동 확인", "done": False},
        {"id": 3, "task": "인근 구호소 통신 라인 확보", "done": False}
    ]
    return jsonify({"status": status, "checklist": dummy_sop})

@app.route('/api/facilities/factories')
def api_get_factories():
    return jsonify(get_factories())

@app.route('/api/facilities/plants')
def api_get_plants():
    return jsonify(get_plants())

@app.route('/api/facilities/shelters')
def api_get_shelters():
    return jsonify(get_shelters())

if __name__ == '__main__':
    app.run(debug=False, port=5000)