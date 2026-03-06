// static/js/ui.js

const UIManager = {
    showLoading: () => document.getElementById('loading').style.display = 'block',
    hideLoading: () => document.getElementById('loading').style.display = 'none',
    
    formatMsgHtml(item) {
        return `
            <div class="timeline-item">
                <strong style="color: #ffcc00;">[재난문자] ${item.created_at || ''}</strong>
                ${item.msg || item.message}
            </div>
        `;
    },

    async loadTimeline() {
        try {
            const res = await fetch('/api/disaster/messages'); 
            const data = await res.json();
            const container = document.getElementById('timeline-content');
            
            const html = data.map(item => this.formatMsgHtml(item)).join('');
            container.innerHTML = html;
            
            container.style.maxHeight = "250px"; 
            container.style.overflowY = "auto";
            container.style.paddingRight = "5px";
        } catch (e) { 
            document.getElementById('timeline-content').innerHTML = "재난 문자 로드 실패"; 
        }
    },

    // --- 백엔드에서 전송된 새 재난 문자를 타임라인 최상단에 삽입 ---
    appendDisasterMessages(newMsgs) {
        const container = document.getElementById('timeline-content');
        if (!container) return;
        
        // 새로운 데이터들을 HTML로 변환하여 기존 내용 맨 위(afterbegin)에 끼워 넣음
        const html = newMsgs.map(item => this.formatMsgHtml(item)).join('');
        container.insertAdjacentHTML('afterbegin', html);
    },

    initSidebarFeatures() {
        const sidebar = document.getElementById('sidebar');
        const toggleBtn = document.getElementById('sidebar-toggle');
        
        if (toggleBtn && sidebar) {
            toggleBtn.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');
                toggleBtn.innerText = sidebar.classList.contains('collapsed') ? '▶' : '◀';
            });
        }
    },

    async showPlantDetails(plant) {
        const panel = document.getElementById('plant-info-panel');
        const details = document.getElementById('plant-details');
        
        details.innerHTML = `<div class="empty-state">데이터를 불러오는 중...</div>`;
        panel.style.borderLeftColor = "#4facfe"; 

        try {
            const res = await fetch(`/api/facilities/plants/${plant.id}`);
            if (!res.ok) throw new Error("데이터 조회 실패");
            const data = await res.json();

            const colorMap = {"정상": "val-normal", "주의": "val-warning", "경고": "val-alert", "비상": "val-emergency"};
            const borderColors = {"정상": "#4CAF50", "주의": "#FFEB3B", "경고": "#FF9800", "비상": "#F44336"};
            
            const statusClass = colorMap[data.radLevel] || "val-normal";
            panel.style.borderLeftColor = borderColors[data.radLevel] || "#4CAF50";

            details.innerHTML = `
                <div style="font-size: 15px; margin-bottom: 15px; font-weight: bold; color: #fff; text-align: center; letter-spacing: 1px;">
                    ${plant.name}
                </div>
                <div class="plant-data-grid">
                    <div class="data-box">
                        <div class="label">방사선량</div>
                        <div class="value ${statusClass}">${data.radLevel}</div>
                        <div style="font-size: 11px; color: #aaa; margin-top: 4px; font-weight: normal;">
                            ${data.radValue} µSv/h
                        </div>
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
                </div>
            `;
        } catch (error) {
            console.error(error);
            details.innerHTML = `<div class="empty-state" style="color:#F44336;">데이터를 불러올 수 없습니다.</div>`;
        }
        
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('collapsed')) {
            document.getElementById('sidebar-toggle').click();
        }
    },

    triggerEmergencyMode(plantName) {
        const indicator = document.getElementById('status-indicator');
        if (indicator) {
            indicator.innerHTML = '🚨 비상 모드 (Emergency)';
            indicator.style.background = 'rgba(244, 67, 54, 0.9)'; 
            indicator.style.borderColor = '#d32f2f';
        }
        
        document.body.style.boxShadow = "inset 0 0 100px rgba(244, 67, 54, 0.4)";
        alert(`[비상 발령] ${plantName}에서 이상이 감지되었습니다.\n모든 시스템이 비상 모드로 전환됩니다.`);
        
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('collapsed')) {
            document.getElementById('sidebar-toggle').click();
        }
        const ragPanel = document.getElementById('rag-panel');
        if (ragPanel) {
            ragPanel.style.display = 'block';
            document.getElementById('rag-messages').innerHTML = ''; 
        }
    },

    appendRagMessage(text) {
        const container = document.getElementById('rag-messages');
        if (!container) return;
        
        const now = new Date();
        const timeString = now.toLocaleTimeString('ko-KR', { hour12: false });
        
        const msgHtml = `
            <div style="margin-bottom: 12px; border-bottom: 1px solid #441111; padding-bottom: 8px;">
                <div style="color: #ff9a9e; font-size: 11px; margin-bottom: 4px;">[${timeString}] AI 분석 보고</div>
                <div style="color: #fff; line-height: 1.5;">${text}</div>
            </div>
        `;
        
        container.innerHTML += msgHtml;
        container.scrollTop = container.scrollHeight;
    },

    clearEmergencyMode() {
        const indicator = document.getElementById('status-indicator');
        if (indicator) {
            indicator.innerHTML = '🟢 평시 모드 (Normal)';
            indicator.style.background = 'rgba(40, 167, 69, 0.9)';
            indicator.style.borderColor = '#1e7e34';
        }
        
        document.body.style.boxShadow = "none";
        alert("[상황 종료] 비상 상황이 해제되어 평시 모드로 복귀합니다.");
        
        const ragPanel = document.getElementById('rag-panel');
        if (ragPanel) {
            ragPanel.style.display = 'none';
        }
    }
};