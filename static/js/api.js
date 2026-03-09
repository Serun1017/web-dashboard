// static/js/api.js
const API = {
    async fetchPlantDetails(plantId) {
        const res = await fetch(`/api/facilities/plants/${plantId}`);
        if (!res.ok) throw new Error("원전 데이터 조회 실패");
        return await res.json();
    },

    async fetchDisasterMessages() {
        // 이 부분도 필요하다면 '/api/disaster/messages' 등 실제 엔드포인트로 변경 권장
        const endpoint = window.APP_CONFIG?.endpoints?.disasterMessages || '/api/disaster/messages';
        const res = await fetch(endpoint);
        return await res.json();
    },

    async sendEmergencyClear() {
        const endpoint = window.APP_CONFIG?.endpoints?.emergencyClear || '/api/webhook/emergency/clear';
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: 'dashboard_ui' })
        });
        if (!res.ok) throw new Error("비상 해제 서버 응답 오류");
    },

    async triggerRagTraining(code, eta) {
        // [인과 제어] 외부 RAG 서버가 아닌 내부 Flask 백엔드로 요청 전송
        const res = await fetch('/api/webhook/eta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plant_code: code, eta: eta, is_training: true })
        });
        
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`HTTP Error ${res.status}: ${errorText}`);
        }
        return await res.json();
    }
};