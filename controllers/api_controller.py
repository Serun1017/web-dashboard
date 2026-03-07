# controllers/api_controller.py
from flask import Blueprint, jsonify, request, Response
from models.weather_model import get_wind_data
from models.facility_model import get_factories, get_plants, get_shelters, get_plant_details, DISASTER_STATE, get_initial_disaster_msgs, get_plant_info_by_code

import models.weather_model as wm
import time
import logging
import json

# 리팩토링: 상태 관리를 전담하는 서비스 임포트
from services.state_service import state_manager

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
        # 1. 연결 순간의 기준점 설정 (state_manager 참조)
        last_sent_time = wm.WIND_LAST_UPDATED
        last_emergency_time = state_manager.state["trigger_time"]
        last_clear_time = state_manager.state["clear_time"]
        last_msg_time = state_manager.state["msg_time"]
        last_disaster_time = DISASTER_STATE["update_time"]

        # 2. 재접속 시점에 서버가 이미 비상 모드인 경우 복구 로직
        if state_manager.state["is_emergency"] or state_manager.state.get("is_training"):
            elapsed_time = time.time() - state_manager.state["trigger_time"]
            remaining_eta = max(0, int(state_manager.state["eta"] - elapsed_time))
            
            alert_data = json.dumps({
                "plant_code": state_manager.state["plant_code"],
                "plant_name": state_manager.state["plant_name"],
                "lat": state_manager.state["lat"],
                "lon": state_manager.state["lon"],
                "eta": state_manager.state["eta"], # (복구 부분은 remaining_eta)
                
                # [신규 추가] 프론트엔드가 훈련 모드임을 알 수 있도록 상태 전송
                "is_training": state_manager.state.get("is_training", False)
            })
            yield f"event: emergency_alert\ndata: {alert_data}\n\n"
            
            if state_manager.state["latest_message"]:
                msg_data = json.dumps({"text": state_manager.state["latest_message"]})
                yield f"event: rag_message\ndata: {msg_data}\n\n"

        # 3. 새로운 이벤트 감지 무한 루프
        while True:
            yield "event: ping\ndata: keep-alive\n\n"
            
            if wm.WIND_LAST_UPDATED > last_sent_time:
                last_sent_time = wm.WIND_LAST_UPDATED
                yield "event: wind_update\ndata: updated\n\n"
            
            # 신규 비상 발령 시 원본 ETA 전송
            if state_manager.state["trigger_time"] > last_emergency_time:
                last_emergency_time = state_manager.state["trigger_time"]
                alert_data = json.dumps({
                    "plant_code": state_manager.state["plant_code"],
                    "plant_name": state_manager.state["plant_name"],
                    "lat": state_manager.state["lat"],
                    "lon": state_manager.state["lon"],
                    "eta": state_manager.state["eta"],
                    
                    # [누락된 부분 추가] 프론트엔드가 훈련 모드를 인식하도록 필수 전송
                    "is_training": state_manager.state.get("is_training", False)
                })
                yield f"event: emergency_alert\ndata: {alert_data}\n\n"
                
            if state_manager.state["clear_time"] > last_clear_time:
                last_clear_time = state_manager.state["clear_time"]
                yield "event: emergency_clear\ndata: cleared\n\n"
                
            if state_manager.state["msg_time"] > last_msg_time:
                last_msg_time = state_manager.state["msg_time"]
                msg_data = json.dumps({"text": state_manager.state["latest_message"]})
                yield f"event: rag_message\ndata: {msg_data}\n\n"
            
            if DISASTER_STATE["update_time"] > last_disaster_time:
                last_disaster_time = DISASTER_STATE["update_time"]
                data = json.dumps(DISASTER_STATE["new_msgs"])
                yield f"event: disaster_msg\ndata: {data}\n\n"

            time.sleep(1)
            
    return Response(event_generator(), mimetype="text/event-stream")

@api_bp.route('/webhook/eta', methods=['POST'])
def receive_eta_webhook():
    try:
        payload = request.get_json()
        plant_code = payload.get('plant_code') or payload.get('plant_name') or 'WS'
        eta = payload.get('eta', 0)
        
        # [신규 추가] 프론트엔드에서 보낸 훈련 모드 여부를 추출 (없으면 기본값 False)
        is_training = payload.get('is_training', False)
        
        # [수정] state_manager에 훈련 여부까지 포함하여 상태 변경 위임
        plant_name = state_manager.trigger_emergency(plant_code, eta, is_training=is_training)
        
        mode_str = "훈련" if is_training else "비상"
        return jsonify({"status": "success", "message": f"{plant_name} {mode_str} 모드 가동"}), 200
    except Exception as e:
        return jsonify({"error": "Bad Request", "details": str(e)}), 400

@api_bp.route('/webhook/emergency', methods=['POST'])
def receive_emergency_webhook():
    try:
        payload = request.get_json()
        message = payload.get('summary_text') or payload.get('text') or "비상 상황 보고."
        
        # 무조건 업데이트 진행
        state_manager.update_rag_message(message)
        
        return jsonify({"status": "success", "message": "RAG message forced broadcasted"}), 200
    except Exception as e:
        # 상태 검사 에러(403)를 무시하고 일반 에러만 처리
        return jsonify({"error": "Server Error", "details": str(e)}), 500

@api_bp.route('/webhook/emergency/clear', methods=['POST'])
def clear_emergency_webhook():
    """비상 상황 해제 알림을 수신"""
    try:
        state_manager.clear_emergency()
        return jsonify({"status": "success", "message": "Emergency cleared"}), 200
    except Exception as e:
        return jsonify({"error": "Bad Request", "details": str(e)}), 400