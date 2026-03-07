# models/weather_model.py
import pandas as pd
import numpy as np
from scipy.interpolate import griddata
import requests
from datetime import datetime, timedelta, timezone
import time
import logging

from config import *

# 메모리 캐시 상태 관리
TARGET_POINTS = []
CACHED_WIND_DATA = []
WIND_LAST_UPDATED = 0  # 초기화 누락 변수 추가

def init_target_points():
    """CSV 공간 다운샘플링 초기화"""
    global TARGET_POINTS
    try:
        df = pd.read_csv(CSV_FILE_PATH, encoding='utf-8')
        df['grid_x_bin'] = df['격자 X'] // 10
        df['grid_y_bin'] = df['격자 Y'] // 10
        sampled_df = df.drop_duplicates(subset=['grid_x_bin', 'grid_y_bin'])
        
        for _, row in sampled_df.iterrows():
            if pd.notna(row['격자 X']) and pd.notna(row['격자 Y']):
                TARGET_POINTS.append({
                    'nx': int(row['격자 X']), 'ny': int(row['격자 Y']),
                    'lon': float(row['경도(초/100)']), 'lat': float(row['위도(초/100)'])
                })
        logging.info(f"초기화 완료: 대상 지점 {len(TARGET_POINTS)}개 확보")
    except Exception as e:
        logging.error(f"CSV 로드 실패: {e}")

def fetch_weather_data():
    """기상청 실황 데이터 수집"""
    KST = timezone(timedelta(hours=9))
    now = datetime.now(KST)
    if now.minute < 15: now -= timedelta(hours=1)
    base_date, base_time = now.strftime('%Y%m%d'), now.strftime('%H00')
    
    obs_lons, obs_lats, obs_u, obs_v = [], [], [], []
    
    for pt in TARGET_POINTS:
        params = {
            'serviceKey': SERVICE_KEY, 'numOfRows': '10', 'pageNo': '1', 'dataType': 'JSON',
            'base_date': base_date, 'base_time': base_time, 'nx': pt['nx'], 'ny': pt['ny']
        }
        try:
            res = requests.get(API_URL, params=params, timeout=3)
            data = res.json()
            if data['response']['header']['resultCode'] == '00':
                u, v = 0.0, 0.0
                for item in data['response']['body']['items']['item']:
                    if item['category'] == 'UUU': u = float(item['obsrValue'])
                    elif item['category'] == 'VVV': v = float(item['obsrValue'])
                
                if abs(u) < 900 and abs(v) < 900:
                    obs_lons.append(pt['lon'])
                    obs_lats.append(pt['lat'])
                    obs_u.append(u)
                    obs_v.append(v)
        except Exception:
            pass
        time.sleep(0.01)
        
    return obs_lons, obs_lats, obs_u, obs_v

def interpolate_wind_vectors(obs_lons, obs_lats, obs_u, obs_v):
    """방사형 왜곡을 방지하기 위한 선형(Linear) 공간 보간"""
    points_array = np.array(list(zip(obs_lons, obs_lats)))
    u_array, v_array = np.array(obs_u), np.array(obs_v)
    
    # 북->남, 서->동 순서로 정규 격자 생성 (leaflet-velocity 표준)
    grid_lons = np.arange(LON_START, LON_END + GRID_RES, GRID_RES)
    grid_lats = np.arange(LAT_START, LAT_END - GRID_RES, -GRID_RES)
    grid_lon_mesh, grid_lat_mesh = np.meshgrid(grid_lons, grid_lats)
    
    # [핵심 수정] method='linear' 사용 및 외곽 빈 공간(바다 등)의 데이터 없는 곳은 0(무풍) 처리
    # 기존의 cubic + nearest 조합은 보간 범위를 넘어갈 때 극단적인 값(소용돌이)을 만들어내는 원인이었음
    grid_u = griddata(points_array, u_array, (grid_lon_mesh, grid_lat_mesh), method='linear', fill_value=0)
    grid_v = griddata(points_array, v_array, (grid_lon_mesh, grid_lat_mesh), method='linear', fill_value=0)
    
    return np.round(grid_u.flatten(), 2).tolist(), np.round(grid_v.flatten(), 2).tolist(), len(grid_lons), len(grid_lats)

def format_velocity_json(u_flat, v_flat, nx_points, ny_points):
    """JSON 배열 조립"""
    header_base = {
        "parameterCategory": 2, "dx": GRID_RES, "dy": GRID_RES,
        "la1": LAT_START, "la2": LAT_END, "lo1": LON_START, "lo2": LON_END,
        "nx": nx_points, "ny": ny_points
    }
    
    return [
        {"header": {**header_base, "parameterNumber": 2, "parameterNumberName": "U-component_of_wind", "parameterUnit": "m.s-1"}, "data": u_flat},
        {"header": {**header_base, "parameterNumber": 3, "parameterNumberName": "V-component_of_wind", "parameterUnit": "m.s-1"}, "data": v_flat}
    ]

def update_wind_cache_job():
    """스케줄러에 등록할 전체 파이프라인 함수"""
    global CACHED_WIND_DATA, WIND_LAST_UPDATED 
    lons, lats, u, v = fetch_weather_data()
    if len(u) < 3: return
        
    u_flat, v_flat, nx_p, ny_p = interpolate_wind_vectors(lons, lats, u, v)
    CACHED_WIND_DATA = format_velocity_json(u_flat, v_flat, nx_p, ny_p)
    
    WIND_LAST_UPDATED = time.time()  
    logging.info("바람장 데이터 캐시 갱신 완료")

def get_wind_data():
    """라우터에서 호출할 데이터 반환 함수"""
    return CACHED_WIND_DATA