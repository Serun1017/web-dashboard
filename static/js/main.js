// static/js/main.js

const SSEManager = {
    init() {
        const evtSource = new EventSource('/api/stream');
        
        // 평시 기능: 바람장 업데이트
        evtSource.addEventListener('wind_update', (e) => {
            MapManager.renderWindLayer();
        });
        
        // 비상 발령 신호 수신 (수정: ETA 데이터 수신 및 전달)
        evtSource.addEventListener('emergency_alert', (e) => {
            const data = JSON.parse(e.data);
            console.log("[SSE] 비상 발령 감지:", data.plant_name, "ETA:", data.eta);
            UIManager.triggerEmergencyMode(data.plant_name, data.eta);
        });

        // 비상 발령 해제 신호 수신
        evtSource.addEventListener('emergency_clear', (e) => {
            console.log("[SSE] 비상 발령 해제 감지");
            UIManager.clearEmergencyMode();
        });

        // 실시간 재난 문자 수신
        evtSource.addEventListener('disaster_msg', (e) => {
            const newMsgs = JSON.parse(e.data);
            UIManager.appendDisasterMessages(newMsgs);
        });

        // RAG 실시간 메시지 수신
        evtSource.addEventListener('rag_message', (e) => {
            const data = JSON.parse(e.data);
            console.log("[SSE] RAG 메시지 수신:", data.text);
            UIManager.appendRagMessage(data.text);
        });

        evtSource.addEventListener('ping', (e) => {});
        evtSource.onerror = (err) => {
            console.error("[SSE] 서버 연결 오류 발생, 재연결을 시도합니다.", err);
        };
    }
};

window.onload = () => {
    UIManager.loadTimeline();

    MapManager.init();
    MapManager.renderWindLayer();
    MapManager.loadFacilityData(); 

    SimulationManager.init();
    
    SSEManager.init();
};