# services/state_service.py
import time
from models.facility_model import get_plant_info_by_code

class StateManager:
    def __init__(self):
        self.state = {
            "is_emergency": False,
            "is_training": False,  # [신규 추가] 훈련 모드 상태
            "trigger_time": 0,
            "clear_time": 0,
            "plant_code": "",
            "plant_name": "",
            "lat": 0.0,
            "lon": 0.0,
            "latest_message": None,
            "msg_time": 0,
            "eta": 0
        }

    def trigger_emergency(self, plant_code, eta, is_training=False):
        # [수정] 훈련 모드 여부(is_training)를 매개변수로 받아 인과관계를 분리
        plant_info = get_plant_info_by_code(plant_code)
        self.state.update({
            "is_emergency": not is_training, # 훈련이 아니면 실제 비상(True)
            "is_training": is_training,      # 훈련이면 True
            "plant_code": plant_code,
            "plant_name": plant_info["name"],
            "lat": plant_info["lat"],
            "lon": plant_info["lon"],
            "eta": eta,
            "trigger_time": time.time()
        })
        return plant_info["name"]

    def update_rag_message(self, message):
        # [인과관계 검사 제거] 어떤 상태에서든 메시지를 수락하도록 변경
        # if not (self.state["is_emergency"] or self.state["is_training"]):
        #     raise ValueError("비상 또는 훈련 모드가 아님")
            
        self.state["latest_message"] = message
        self.state["msg_time"] = time.time()
        # 로깅을 추가하여 수신 여부를 터미널에서 확인
        print(f"--- RAG 메시지 강제 수신: {message[:20]}... ---")
        
    def clear_emergency(self):
        # [수정] 해제 시 실제 비상과 훈련 모드 플래그를 모두 초기화
        self.state.update({
            "is_emergency": False,
            "is_training": False, 
            "eta": 0,
            "clear_time": time.time()
        })

state_manager = StateManager() # 싱글톤 인스턴스