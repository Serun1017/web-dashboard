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