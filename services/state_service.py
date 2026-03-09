# services/state_service.py
import time
import logging
import psycopg2
import os
from models.facility_model import get_plant_info_by_code

class StateManager:
    def __init__(self):
        self.state = {
            "is_emergency": False,
            "is_training": False,
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

    def get_db_connection(self):
        try:
            return psycopg2.connect(
                host=os.environ.get("DB_HOST", "localhost"),
                dbname=os.environ.get("DB_NAME", "postgres"),
                user=os.environ.get("DB_USER", "postgres"),
                password=os.environ.get("DB_PASSWORD", "password"),
                port=os.environ.get("DB_PORT", "5432")
            )
        except Exception as e:
            logging.error(f"DB 연결 실패: {e}")
            return None

    def trigger_emergency(self, plant_code, eta, is_training=False):
        plant_info = get_plant_info_by_code(plant_code)
        plant_name = plant_info["name"]
        
        self.state.update({
            "is_emergency": not is_training,
            "is_training": is_training,
            "plant_code": plant_code,
            "plant_name": plant_name,
            "lat": plant_info["lat"],
            "lon": plant_info["lon"],
            "eta": eta,
            "trigger_time": time.time()
        })
        
        # 인과 제어: 훈련 모드 발령 시 이름(plant_name)이 아닌 코드(plant_code)를 전달
        if is_training:
            self._insert_training_data(plant_code, eta)
            
        return plant_name

    def _insert_training_data(self, plant_code, eta_seconds):
        conn = self.get_db_connection()
        if not conn:
            raise Exception("DB 연결 객체를 생성할 수 없어 훈련 데이터를 적재할 수 없습니다.")

        try:
            with conn.cursor() as cur:
                # 1. ETA 환산 로직 (초 -> 분)
                eta_minutes = float(eta_seconds) / 60.0
                
                # 2. time_code 규격 포맷팅 (예: 20분 -> T-20)
                time_code = f"T-{int(eta_minutes)}"
                
                # 3. 누락되었던 환경 변수 기본값 보강 (샘플 데이터 기준)
                distance_km = 5.0
                wind_dir_deg = 120.0
                wind_speed_mps = 3.0
                
                # genname 컬럼에 KR 등과 같은 plant_code 삽입
                query = """
                    INSERT INTO eta_prediction 
                    (genname, predicted_at, eta_minutes, distance_km, wind_dir_deg, wind_speed_mps, time_code)
                    VALUES (%s, NOW(), %s, %s, %s, %s, %s)
                """
                cur.execute(query, (plant_code, eta_minutes, distance_km, wind_dir_deg, wind_speed_mps, time_code))
            
            conn.commit()
            logging.info(f"훈련 데이터 적재 완료 - 코드: {plant_code}, 시간: {time_code}")
            
        except Exception as e:
            conn.rollback()
            logging.error(f"훈련 데이터 DB 적재 쿼리 실패: {e}")
            # API 호출이 명시적으로 실패(500)하도록 예외를 상위로 던짐
            raise e
        finally:
            conn.close()

    def update_rag_message(self, message):
        self.state["latest_message"] = message
        self.state["msg_time"] = time.time()
        print(f"--- RAG 메시지 강제 수신: {message[:20]}... ---")
        
    def clear_emergency(self):
        self.state.update({
            "is_emergency": False,
            "is_training": False, 
            "eta": 0,
            "clear_time": time.time()
        })

state_manager = StateManager()