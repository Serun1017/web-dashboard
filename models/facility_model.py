# db_service.py
import psycopg2
from psycopg2.extras import RealDictCursor
import logging
from config import DB_CONFIG

def get_db_connection():
    """PostgreSQL 데이터베이스 연결 객체 반환"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        logging.error(f"PostgreSQL DB 연결 실패: {e}")
        return None

def fetch_data_from_db(query):
    """주어진 쿼리를 실행하고 JSON 형태로 직렬화 가능한 딕셔너리 리스트 반환"""
    conn = get_db_connection()
    if not conn:
        return []  # DB 연결 실패 시 빈 배열 반환 (프론트엔드 에러 방지)
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query)
            records = cur.fetchall()
            # Decimal 타입을 float으로 변환 (JSON 직렬화 문제 해결)
            for row in records:
                for key, value in row.items():
                    if hasattr(value, 'to_eng_string'):  # Decimal 판별
                        row[key] = float(value)
            return records
    except Exception as e:
        logging.error(f"쿼리 실행 에러: {e}")
        return []
    finally:
        conn.close()

# --- [데이터 조회 함수] ---

def get_factories():
    query = """
        SELECT factory_code as id, factory_name as name, factory_address as address, 
               factory_lat as lat, factory_lon as lon 
        FROM factory_info;
    """
    return fetch_data_from_db(query)

def get_plants():
    query = """
        SELECT plant_code as id, plant_name as name, plant_address as address, 
               plant_lat as lat, plant_lon as lon 
        FROM khnp_plant_info;
    """
    return fetch_data_from_db(query)

def get_shelters():
    # 제공된 다이어그램의 한글/영문 컬럼명을 알맞게 매핑
    query = """
        SELECT id, 대피소명 as name, 도로명주소 as address, 
               위도 as lat, 경도 as lon, 수용가능인원 as capacity 
        FROM emergency_shelter_info;
    """
    return fetch_data_from_db(query)

def get_plant_details(plant_id):
    """특정 원전의 최신 기상 정보와 방사선량 상태를 조회"""
    conn = get_db_connection()
    if not conn:
        return None
        
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # 1. 최신 기상 정보 조회
            cur.execute("""
                SELECT temp, rain_fall as rain, humidity 
                FROM khnp_weather_info 
                WHERE plant_code = %s 
                ORDER BY collected_at DESC 
                LIMIT 1
            """, (plant_id,))
            weather = cur.fetchone() or {'temp': '-', 'rain': '-', 'humidity': '-'}
            
            # 2. 최신 방사선량 및 안전 등급 조회 (센서 테이블 조인)
            cur.execute("""
                SELECT r.radiorate 
                FROM khnp_radiorate_info r
                JOIN khnp_sensor_info s ON r.sensor_code = s.sensor_code
                WHERE s.plant_code = %s 
                ORDER BY r.collected_at DESC 
                LIMIT 1
            """, (plant_id,))
            radio = cur.fetchone()
            
            rad_level = "정상" # 기본값
            rad_val_out = "-" # 수치 기본값
            
            if radio and radio['radiorate'] is not None:
                rad_val = float(radio['radiorate'])
                rad_val_out = round(rad_val, 4) # 소수점 4자리까지 표시                
                
                # 방사선 수치 기반 등급 산출
                cur.execute("""
                    SELECT grade 
                    FROM safety_grade 
                    WHERE min_threshold <= %s 
                    ORDER BY min_threshold DESC 
                    LIMIT 1
                """, (rad_val,))
                grade_row = cur.fetchone()
                if grade_row:
                    rad_level = grade_row['grade']
            
            # Decimal 직렬화 에러를 방지하기 위한 형변환 포함 반환
            return {
                "radLevel": rad_level,
                "radValue": rad_val_out,  # <-- 추가: 실제 방사선 수치
                "temp": float(weather['temp']) if weather.get('temp') != '-' else '-',
                "rain": float(weather['rain']) if weather.get('rain') != '-' else '-',
                "humidity": float(weather['humidity']) if weather.get('humidity') != '-' else '-'
            }
    except Exception as e:
        logging.error(f"원전 상세 조회 에러 (plant_id: {plant_id}): {e}")
        return None
    finally:
        conn.close()