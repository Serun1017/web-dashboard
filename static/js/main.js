// static/js/main.js

const SSEManager = {
    init() {
        // SSE 엔드포인트 연결
        const evtSource = new EventSource('/api/stream');

        // 서버에서 'wind_update' 이벤트를 보내면 실행
        evtSource.addEventListener('wind_update', (e) => {
            console.log("[SSE] 백엔드 바람 데이터 갱신 감지. 애니메이션을 재렌더링합니다.");
            MapManager.renderWindLayer();
        });

        // 서버와의 연결 유지 핑 수신
        evtSource.addEventListener('ping', (e) => {
            console.log("[SSE] Keep-alive ping 수신");
        });

        evtSource.onerror = (err) => {
            console.error("[SSE] 서버 연결 오류 발생, 재연결을 시도합니다.", err);
        };
    }
};

window.onload = () => {
    UIManager.loadTimeline();
    UIManager.loadSOP();

    MapManager.init();
    MapManager.renderWindLayer();
    MapManager.loadFacilityData(); 

    SimulationManager.init();
    
    // 추가: SSE 매니저 초기화
    SSEManager.init();
};
