// static/js/api.js
const API = {
    async fetchPlantDetails(plantId) {
        const res = await fetch(`/api/facilities/plants/${plantId}`);
        if (!res.ok) throw new Error("원전 데이터 조회 실패");
        return await res.json();
    },

    async fetchDisasterMessages() {
        const res = await fetch(window.APP_CONFIG.endpoints.disasterMessages);
        return await res.json();
    },

    async sendEmergencyClear() {
        const res = await fetch(window.APP_CONFIG.endpoints.emergencyClear, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: 'dashboard_ui' })
        });
        if (!res.ok) throw new Error("서버 응답 오류");
    },

    async triggerRagTraining(code, eta) {
        return await fetch(window.APP_CONFIG.endpoints.ragTrigger, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plant_code: code, eta: eta, is_training: true })
        });
    }
};