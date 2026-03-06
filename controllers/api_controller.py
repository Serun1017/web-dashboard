from flask import Blueprint, jsonify, request, Response
from models.weather_model import get_wind_data
from models.facility_model import get_factories, get_plants, get_shelters, get_plant_details, DISASTER_STATE, get_initial_disaster_msgs

import models.weather_model as wm
import time
import logging
import json

# 'api'라는 이름의 Blueprint 객체 생성 (라우터 그룹화)
api_bp = Blueprint('api', __name__, url_prefix='/api')

# --- 추가: 서버 전역 비상 상태 변수 ---
EMERGENCY_STATE = {
    "is_emergency": False,
    "trigger_time": 0,
    "clear_time": 0,  # 추가: 해제 신호 감지용
    "plant_name": "",
    "latest_message": None,
    "msg_time": 0
}

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

@api_bp.route('/facilities/plants/<plant_id>')
def api_get_plant_details(plant_id):
    data = get_plant_details(plant_id)
    if not data:
        return jsonify({"error": "원전 상세 데이터를 찾을 수 없습니다."}), 404
    return jsonify(data)

@api_bp.route('/disaster/messages')
def api_get_disaster_messages():
    return jsonify(get_initial_disaster_msgs())

@api_bp.route('/stream')
def sse_stream():
    """SSE 스트리밍 엔드포인트"""
    def event_generator():
        last_sent_time = wm.WIND_LAST_UPDATED
        last_emergency_time = 0
        last_clear_time = 0  # 추가: 마지막 해제 시간 추적
        last_msg_time = 0
        last_disaster_time = 0

        while True:
            yield "event: ping\ndata: keep-alive\n\n"
            
            # (기존 바람장 갱신 감지)
            if wm.WIND_LAST_UPDATED > last_sent_time:
                last_sent_time = wm.WIND_LAST_UPDATED
                yield "event: wind_update\ndata: updated\n\n"
            
            # (기존 비상 모드 발동 감지)
            if EMERGENCY_STATE["trigger_time"] > last_emergency_time:
                last_emergency_time = EMERGENCY_STATE["trigger_time"]
                alert_data = json.dumps({"plant_name": EMERGENCY_STATE["plant_name"]})
                yield f"event: emergency_alert\ndata: {alert_data}\n\n"
                
            # --- 추가: 비상 모드 해제 감지 ---
            if EMERGENCY_STATE["clear_time"] > last_clear_time:
                last_clear_time = EMERGENCY_STATE["clear_time"]
                yield "event: emergency_clear\ndata: cleared\n\n"
                
            # (기존 RAG 실시간 메시지 감지)
            if EMERGENCY_STATE["msg_time"] > last_msg_time:
                last_msg_time = EMERGENCY_STATE["msg_time"]
                msg_data = json.dumps({"text": EMERGENCY_STATE["latest_message"]})
                yield f"event: rag_message\ndata: {msg_data}\n\n"
            
            if DISASTER_STATE["update_time"] > last_disaster_time:
                last_disaster_time = DISASTER_STATE["update_time"]
                data = json.dumps(DISASTER_STATE["new_msgs"])
                yield f"event: disaster_msg\ndata: {data}\n\n"

            time.sleep(1)
            
    return Response(event_generator(), mimetype="text/event-stream")

@api_bp.route('/webhook/emergency', methods=['POST'])
def receive_emergency_webhook():
    """RAG 또는 Azure Functions로부터 비상 알림을 수신"""
    global EMERGENCY_STATE
    try:
        payload = request.get_json()
        
        # RAG 시스템의 데이터 추출 (plant_name이 추가로 넘어온다고 가정)
        plant_name = payload.get('plant_name', '원자력 발전소(미상)')
        
        # 기존 텍스트(text) 포맷이나 RAG의 요약 텍스트(summary_text) 모두 호환되도록 처리
        message = payload.get('summary_text') or payload.get('text') or "비상 상황이 발생했습니다."
        
        # 서버 상태를 비상으로 업데이트 (시간을 갱신하여 SSE가 감지하도록 함)
        EMERGENCY_STATE["is_emergency"] = True
        EMERGENCY_STATE["plant_name"] = plant_name
        EMERGENCY_STATE["trigger_time"] = time.time()
        
        EMERGENCY_STATE["latest_message"] = message
        EMERGENCY_STATE["msg_time"] = time.time()
        
        return jsonify({"status": "success", "message": "Emergency broadcasted"}), 200
    except Exception as e:
        return jsonify({"error": "Bad Request", "details": str(e)}), 400
    
@api_bp.route('/webhook/emergency/clear', methods=['POST'])
def clear_emergency_webhook():
    """비상 상황 해제 알림을 수신"""
    global EMERGENCY_STATE
    try:
        EMERGENCY_STATE["is_emergency"] = False
        EMERGENCY_STATE["clear_time"] = time.time() # 해제 시간 갱신
        
        return jsonify({"status": "success", "message": "Emergency cleared"}), 200
    except Exception as e:
        return jsonify({"error": "Bad Request", "details": str(e)}), 400