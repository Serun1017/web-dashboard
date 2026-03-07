// static/js/ui.js
const UIManager = {
    showLoading: () => document.getElementById('loading').style.display = 'block',
    hideLoading: () => document.getElementById('loading').style.display = 'none',

    renderEmergencyUI(plantCode, plantName, eta, lat, lon, isTrainingEvent) {
        const ind = document.getElementById('status-indicator');
        const ragPanel = document.getElementById('rag-panel');
        const trainingPanel = document.getElementById('training-panel');

        if (isTrainingEvent) {
            ind.innerHTML = '🟠 훈련 모드';
            ind.style.background = 'rgba(255, 152, 0, 0.9)';
            ind.style.borderColor = '#f57c00';
            document.body.style.boxShadow = "inset 0 0 100px rgba(255, 152, 0, 0.4)";
            ragPanel.style.borderLeft = "4px solid #ff9800";
            document.getElementById('btn-toggle-training').innerText = "훈련 모드 종료";
        } else {
            ind.innerHTML = '🚨 비상 모드';
            ind.style.background = 'rgba(244, 67, 54, 0.9)';
            ind.style.borderColor = '#d32f2f';
            document.body.style.boxShadow = "inset 0 0 100px rgba(244, 67, 54, 0.4)";
            ragPanel.style.borderLeft = "4px solid #F44336";
            if (trainingPanel) trainingPanel.style.display = 'none';
        }

        ragPanel.style.display = 'block';
        document.getElementById('rag-messages').innerHTML = '';
        
        // 이름 파라미터 전달 추가
        if (plantCode) this.loadAndShowPlant(plantCode, plantName);
        
        if (lat && lon) MapManager.drawDangerZone(lat, lon, 30000);
        MapManager.showShelters();
    },

    renderNormalUI() {
        const ind = document.getElementById('status-indicator');
        ind.innerHTML = '🟢 평시 모드';
        ind.style.background = 'rgba(40, 167, 69, 0.9)';
        ind.style.borderColor = '#1e7e34';
        document.body.style.boxShadow = "none";
        
        document.getElementById('rag-panel').style.display = 'none';
        document.getElementById('training-panel').style.display = 'block';
        document.getElementById('btn-toggle-training').innerText = "훈련 모드 시작";

        MapManager.clearDangerZone();
        MapManager.hideShelters();
    },

    // 파라미터에 plantName 추가 및 누락된 UI 그리드 복구
    async loadAndShowPlant(plantId, plantName) {
        const panel = document.getElementById('plant-info-panel');
        const details = document.getElementById('plant-details');
        
        details.innerHTML = `<div class="empty-state">데이터를 불러오는 중...</div>`;
        panel.style.borderLeftColor = "#4facfe"; 

        try {
            const data = await API.fetchPlantDetails(plantId);
            const colorMap = {"정상": "val-normal", "주의": "val-warning", "경고": "val-alert", "비상": "val-emergency"};
            const borderColors = {"정상": "#4CAF50", "주의": "#FFEB3B", "경고": "#FF9800", "비상": "#F44336"};
            
            panel.style.borderLeftColor = borderColors[data.radLevel] || "#4CAF50";
            
            details.innerHTML = `
                <div style="font-size: 15px; font-weight: bold; text-align: center; margin-bottom: 15px;">${plantName}</div>
                <div class="plant-data-grid">
                    <div class="data-box">
                        <div class="label">방사선량</div>
                        <div class="value ${colorMap[data.radLevel]}">${data.radLevel}</div>
                        <div style="font-size: 11px; color: #aaa; margin-top: 4px; font-weight: normal;">${data.radValue} µSv/h</div>
                    </div>
                    <div class="data-box">
                        <div class="label">현재 온도</div>
                        <div class="value" style="color:#fff;">${data.temp} °C</div>
                    </div>
                    <div class="data-box">
                        <div class="label">강우량</div>
                        <div class="value" style="color:#fff;">${data.rain} mm</div>
                    </div>
                    <div class="data-box">
                        <div class="label">습도</div>
                        <div class="value" style="color:#fff;">${data.humidity} %</div>
                    </div>
                </div>`;
        } catch (e) {
            details.innerHTML = `<div class="empty-state" style="color:#F44336;">데이터를 불러올 수 없습니다.</div>`;
        }
    },

    appendRagMessage(text) {
        const container = document.getElementById('rag-messages');
        const time = new Date().toLocaleTimeString('ko-KR', { hour12: false });
        container.insertAdjacentHTML('afterbegin', `<div style="margin-bottom:12px; border-bottom:1px solid #441111; padding-bottom:8px;"><div style="color:#ff9a9e; font-size:11px;">[${time}] AI 보고</div><div>${text}</div></div>`);
        container.scrollTop = 0;
    },

    createTimerDOM() {
        if (!document.getElementById('map-eta-timer')) {
            const el = document.createElement('div');
            el.id = 'map-eta-timer';
            el.style.cssText = `position:absolute; top:20px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.8); color:#ff3333; padding:15px 30px; border:2px solid #ff3333; border-radius:10px; font-size:24px; font-weight:bold; z-index:1000; pointer-events:none;`;
            document.getElementById('map').appendChild(el);
        }
    },
    updateTimerText(text) { document.getElementById('map-eta-timer').innerHTML = text; },
    removeTimerDOM() { document.getElementById('map-eta-timer')?.remove(); }
};