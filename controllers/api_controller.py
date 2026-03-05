from flask import Blueprint, jsonify, request, Response
from models.weather_model import get_wind_data
from models.facility_model import get_factories, get_plants, get_shelters

import models.weather_model as wm
import time

# 'api'라는 이름의 Blueprint 객체 생성 (라우터 그룹화)
api_bp = Blueprint('api', __name__, url_prefix='/api')

@api_bp.route('/weather/wind')
def api_get_wind():
    data = get_wind_data()
    if not data:
        return jsonify({"error": "데이터 초기화 중"}), 503
    return jsonify(data)

@api_bp.route('/facilities/factories')
def api_get_factories():
    return jsonify(get_factories())

@api_bp.route('/facilities/plants')
def api_get_plants():
    return jsonify(get_plants())

@api_bp.route('/facilities/shelters')
def api_get_shelters():
    return jsonify(get_shelters())

@api_bp.route('/disaster/alerts')
def api_get_disaster_alerts():
    # Stub 데이터
    return jsonify([
        {"time": "15:00", "level": "경계", "message": "인근 지역 비상 발령. 매뉴얼 확인 요망"}
    ])

@api_bp.route('/disaster/sop')
def api_get_sop_manual():
    # Stub 데이터
    status = request.args.get('status', 'normal')
    return jsonify({"status": status, "checklist": [
        {"id": 1, "task": "현장 인력 대피 지시", "done": False}
    ]})

@api_bp.route('/stream')
def sse_stream():
    """SSE (Server-Sent Events) 스트리밍 엔드포인트"""
    def event_generator():
        last_sent_time = wm.WIND_LAST_UPDATED
        
        while True:
            # 1. 연결 유지를 위한 Ping 전송 (Heroku, Azure 등에서 Timeout 방지)
            yield "event: ping\ndata: keep-alive\n\n"
            
            # 2. 바람장 데이터가 새로 갱신되었는지 확인
            if wm.WIND_LAST_UPDATED > last_sent_time:
                last_sent_time = wm.WIND_LAST_UPDATED
                yield "event: wind_update\ndata: updated\n\n"
            
            time.sleep(5)  # 5초 주기로 상태 확인
            
    return Response(event_generator(), mimetype="text/event-stream")