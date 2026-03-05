// static/js/ui.js

const UIManager = {
    showLoading: () => document.getElementById('loading').style.display = 'block',
    hideLoading: () => document.getElementById('loading').style.display = 'none',
    
    async loadTimeline() {
        try {
            const res = await fetch(CONFIG.endpoints.alerts);
            const data = await res.json();
            const html = data.map(item => `
                <div class="timeline-item">
                    <strong>[${item.level}] ${item.time}</strong>
                    ${item.message}
                </div>
            `).join('');
            document.getElementById('timeline-content').innerHTML = html;
        } catch (e) { document.getElementById('timeline-content').innerHTML = "타임라인 로드 실패"; }
    },

    async loadSOP(status = 'normal') {
        try {
            const res = await fetch(`${CONFIG.endpoints.sop}?status=${status}`);
            const data = await res.json();
            
            if (data.checklist.length === 0) {
                document.getElementById('sop-content').innerHTML = "현재 활성화된 매뉴얼이 없습니다.";
                return;
            }

            const html = data.checklist.map(item => `
                <div class="sop-item">
                    <input type="checkbox" id="chk-${item.id}">
                    <label for="chk-${item.id}">${item.task}</label>
                </div>
            `).join('');
            document.getElementById('sop-content').innerHTML = html;
        } catch (e) { document.getElementById('sop-content').innerHTML = "SOP 매뉴얼 로드 실패"; }
    },

    initSidebarFeatures() {
        // 사이드바 토글 로직
        const sidebar = document.getElementById('sidebar');
        const toggleBtn = document.getElementById('sidebar-toggle');
        
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            toggleBtn.innerText = sidebar.classList.contains('collapsed') ? '▶' : '◀';
        });

        // 챗봇 전송 로직
        const chatInput = document.getElementById('chat-input');
        const chatSend = document.getElementById('chat-send');
        const chatMessages = document.getElementById('chat-messages');

        const sendMessage = () => {
            const text = chatInput.value.trim();
            if(!text) return;
            
            // 사용자 메시지 UI 추가
            chatMessages.innerHTML += `<div style="margin-top:5px; color:#fff;">[User] ${text}</div>`;
            chatInput.value = '';
            
            // TODO: 실제 백엔드 RAG API 호출
            setTimeout(() => {
                chatMessages.innerHTML += `<div style="margin-top:5px; color:#4575b4;">[AI] '${text}'에 대한 답변입니다. (API 연동 대기중)</div>`;
                chatMessages.scrollTop = chatMessages.scrollHeight; // 스크롤 하단 이동
            }, 500);
        };

        chatSend.addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') sendMessage(); });
    },

    async showPlantDetails(plant) {
        const panel = document.getElementById('plant-info-panel');
        const details = document.getElementById('plant-details');
        
        // 1. API 호출 중 로딩 상태 UI 선행 표시
        details.innerHTML = `<div class="empty-state">데이터를 불러오는 중...</div>`;
        panel.style.borderLeftColor = "#4facfe"; 

        try {
            // 2. 백엔드에서 실제 데이터 Fetch
            const res = await fetch(`/api/facilities/plants/${plant.id}`);
            if (!res.ok) throw new Error("데이터 조회 실패");
            const data = await res.json();

            // 3. 상태 매핑
            const colorMap = {"정상": "val-normal", "주의": "val-warning", "경고": "val-alert", "비상": "val-emergency"};
            const borderColors = {"정상": "#4CAF50", "주의": "#FFEB3B", "경고": "#FF9800", "비상": "#F44336"};
            
            const statusClass = colorMap[data.radLevel] || "val-normal";
            panel.style.borderLeftColor = borderColors[data.radLevel] || "#4CAF50";

            // 4. 받아온 실제 데이터로 DOM 렌더링
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
        
        // 사이드바가 닫혀있다면 엽니다.
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('collapsed')) {
            document.getElementById('sidebar-toggle').click();
        }
    }
};