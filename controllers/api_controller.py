from flask import Blueprint, jsonify, request
from models.weather_model import get_wind_data
from models.facility_model import get_factories, get_plants, get_shelters

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