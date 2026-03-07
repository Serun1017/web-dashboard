# config.py
import os
from dotenv import load_dotenv

load_dotenv() # .env 파일 로드

SERVICE_KEY = os.getenv("SERVICE_KEY", "")
API_URL = os.getenv("API_URL", "")
CSV_FILE_PATH = os.getenv("CSV_FILE_PATH", "격자_위경도.csv")

LAT_START = float(os.getenv("LAT_START", 39.0))
LAT_END = float(os.getenv("LAT_END", 33.0))
LON_START = float(os.getenv("LON_START", 125.0))
LON_END = float(os.getenv("LON_END", 130.0))
GRID_RES = float(os.getenv("GRID_RES", 0.1))

# --- DB_CONFIG 복구 및 환경변수 맵핑 ---
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", 5432)),
    "dbname": os.getenv("DB_NAME", "postgres"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "")
}