// static/js/main.js

window.APP_CONFIG = {};

window.onload = async () => {
    try {
        const configRes = await fetch('/static/config.json');
        window.APP_CONFIG = await configRes.json();

        MapManager.init();
        MapManager.renderWindLayer();
        MapManager.loadFacilityData();
        EmergencyManager.init();

        const evtSource = new EventSource('/api/stream');
        evtSource.addEventListener('wind_update', () => MapManager.renderWindLayer());
        evtSource.addEventListener('emergency_alert', (e) => EmergencyManager.handleServerAlert(JSON.parse(e.data)));
        evtSource.addEventListener('emergency_clear', () => EmergencyManager.handleServerClear());
        evtSource.addEventListener('rag_message', (e) => UIManager.appendRagMessage(JSON.parse(e.data).text));
        
        // --- 재난 문자 실시간 수신 이벤트 리스너 ---
        // --- [수정] 재난 문자 실시간 수신 이벤트 리스너 ---
        evtSource.addEventListener('disaster_msg', (e) => {
            const newMsgs = JSON.parse(e.data);
            const container = document.getElementById('timeline-content');
            
            if (container.innerHTML.includes('로딩 중') || container.innerHTML.includes('수신된 재난 문자가 없습니다')) {
                container.innerHTML = '';
            }

            // 1. [신규 로직] 기존에 있던 '신규 재난문자'들을 찾아 일반 상태로 강등 처리
            const existingNews = container.querySelectorAll('.timeline-item strong');
            existingNews.forEach(strongEl => {
                if (strongEl.innerText.includes('[신규 재난문자]')) {
                    // 텍스트를 일반 '재난문자'로 변경
                    strongEl.innerText = strongEl.innerText.replace('[신규 재난문자]', '[재난문자]');
                    // 텍스트 색상을 기본(흰색)으로 복구
                    strongEl.style.color = '#fff'; 
                    // 부모 컨테이너(.timeline-item)의 왼쪽 테두리 색상을 기본(핑크/레드)으로 복구
                    strongEl.parentElement.style.borderLeftColor = '#ff9a9e'; 
                }
            });
            
            // 2. 새로운 문자를 노란색 강조 스타일로 최상단 삽입
            let html = '';
            newMsgs.forEach(m => {
                const text = m.msg || m.message || "내용 없음";
                html += `<div class="timeline-item" style="border-left-color: #ffcc00;">
                            <strong style="color: #ffcc00;">[신규 재난문자] ${m.created_at}</strong>${text}
                         </div>`;
            });
            container.insertAdjacentHTML('afterbegin', html);
        });
        
        // 4. 초기 재난 문자 로드 (과거 데이터)
        API.fetchDisasterMessages().then(msgs => {
            const container = document.getElementById('timeline-content');
            if (msgs.length === 0) {
                container.innerHTML = '<div class="empty-state">수신된 재난 문자가 없습니다.</div>';
                return;
            }
            container.innerHTML = msgs.map(m => {
                const text = m.msg || m.message || "내용 없음";
                return `<div class="timeline-item"><strong>[재난문자] ${m.created_at}</strong>${text}</div>`;
            }).join('');
        });

    } catch (e) {
        console.error("앱 초기화 실패:", e);
    }
};