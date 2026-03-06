from flask import Blueprint, jsonify, request, Response
from models.weather_model import get_wind_data
from models.facility_model import get_factories, get_plants, get_shelters, get_plant_details, DISASTER_STATE, get_initial_disaster_msgs, get_plant_info_by_code

import models.weather_model as wm
import time
import logging
import json

api_bp = Blueprint('api', __name__, url_prefix='/api')

# --- 서버 전역 비상 상태 변수 ---
EMERGENCY_STATE = {
    "is_emergency": False,
    "trigger_time": 0,
    "clear_time": 0,
    "plant_code": "",
    "plant_name": "",
    "lat": 0.0,  # 추가됨
    "lon": 0.0,  # 추가됨
    "latest_message": None,
    "msg_time": 0,
    "eta": 0
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
        # 1. 0이 아닌 연결 순간의 서버 전역 상태 타임스탬프로 기준점 설정 (과거 이벤트 재실행 방지)
        last_sent_time = wm.WIND_LAST_UPDATED
        last_emergency_time = EMERGENCY_STATE["trigger_time"]
        last_clear_time = EMERGENCY_STATE["clear_time"]
        last_msg_time = EMERGENCY_STATE["msg_time"]
        last_disaster_time = DISASTER_STATE["update_time"]

        # 2. 새로고침(재접속) 시점에 서버가 이미 비상 모드인 경우의 복구 로직
        if EMERGENCY_STATE["is_emergency"]:
            # 경과된 시간을 빼서 남은 타이머 시간(remaining_eta) 계산
            elapsed_time = time.time() - EMERGENCY_STATE["trigger_time"]
            remaining_eta = max(0, int(EMERGENCY_STATE["eta"] - elapsed_time))
            
            # 남은 시간을 담아 현재 상태를 프론트엔드로 동기화
            alert_data = json.dumps({
                "plant_code": EMERGENCY_STATE["plant_code"],
                "plant_name": EMERGENCY_STATE["plant_name"],
                "lat": EMERGENCY_STATE["lat"],
                "lon": EMERGENCY_STATE["lon"],
                "eta": remaining_eta
            })
            yield f"event: emergency_alert\ndata: {alert_data}\n\n"
            
            # 최신 RAG 브리핑 메시지도 화면에 복구
            if EMERGENCY_STATE["latest_message"]:
                msg_data = json.dumps({"text": EMERGENCY_STATE["latest_message"]})
                yield f"event: rag_message\ndata: {msg_data}\n\n"

        # 3. 이후부터 발생하는 새로운 이벤트만 감지
        while True:
            yield "event: ping\ndata: keep-alive\n\n"
            
            if wm.WIND_LAST_UPDATED > last_sent_time:
                last_sent_time = wm.WIND_LAST_UPDATED
                yield "event: wind_update\ndata: updated\n\n"
            
            # 신규 비상 발령 시 원본 ETA 전송
            if EMERGENCY_STATE["trigger_time"] > last_emergency_time:
                last_emergency_time = EMERGENCY_STATE["trigger_time"]
                alert_data = json.dumps({
                    "plant_code": EMERGENCY_STATE["plant_code"],
                    "plant_name": EMERGENCY_STATE["plant_name"],
                    "lat": EMERGENCY_STATE["lat"],
                    "lon": EMERGENCY_STATE["lon"],
                    "eta": EMERGENCY_STATE["eta"]
                })
                yield f"event: emergency_alert\ndata: {alert_data}\n\n"
                
            if EMERGENCY_STATE["clear_time"] > last_clear_time:
                last_clear_time = EMERGENCY_STATE["clear_time"]
                yield "event: emergency_clear\ndata: cleared\n\n"
                
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

@api_bp.route('/webhook/eta', methods=['POST'])
def receive_eta_webhook():
    global EMERGENCY_STATE
    try:
        payload = request.get_json()
        plant_code = payload.get('plant_code') or payload.get('plant_name') or 'WS'
        eta = payload.get('eta', 0)
        
        # 이름, 위도, 경도 함께 조회
        plant_info = get_plant_info_by_code(plant_code)
        
        EMERGENCY_STATE["is_emergency"] = True
        EMERGENCY_STATE["plant_code"] = plant_code
        EMERGENCY_STATE["plant_name"] = plant_info["name"]
        EMERGENCY_STATE["lat"] = plant_info["lat"]
        EMERGENCY_STATE["lon"] = plant_info["lon"]
        EMERGENCY_STATE["eta"] = eta
        EMERGENCY_STATE["trigger_time"] = time.time()
        
        return jsonify({"status": "success", "message": f"Emergency mode activated for {plant_info['name']}"}), 200
    except Exception as e:
        return jsonify({"error": "Bad Request", "details": str(e)}), 400

@api_bp.route('/webhook/emergency', methods=['POST'])
def receive_emergency_webhook():
    """[수정] RAG 시스템의 분석 보고 메시지를 수신"""
    global EMERGENCY_STATE
    try:
        # 비상 상황이 아니면 RAG 메시지 수신 거부 (인과관계 제어)
        if not EMERGENCY_STATE["is_emergency"]:
            return jsonify({"error": "비상 모드가 활성화되지 않아 메시지를 수신할 수 없습니다."}), 403
            
        payload = request.get_json()
        message = payload.get('summary_text') or payload.get('text') or "비상 상황 보고."
        
        # 상태 전환 없이 메시지만 업데이트 후 SSE 발송 트리거
        EMERGENCY_STATE["latest_message"] = message
        EMERGENCY_STATE["msg_time"] = time.time()
        
        return jsonify({"status": "success", "message": "RAG message broadcasted"}), 200
    except Exception as e:
        return jsonify({"error": "Bad Request", "details": str(e)}), 400
    

@api_bp.route('/webhook/emergency/clear', methods=['POST'])
def clear_emergency_webhook():
    """비상 상황 해제 알림을 수신"""
    global EMERGENCY_STATE
    try:
        EMERGENCY_STATE["is_emergency"] = False
        EMERGENCY_STATE["eta"] = 0 # 타이머 초기화
        EMERGENCY_STATE["clear_time"] = time.time() 
        
        return jsonify({"status": "success", "message": "Emergency cleared"}), 200
    except Exception as e:
        return jsonify({"error": "Bad Request", "details": str(e)}), 400