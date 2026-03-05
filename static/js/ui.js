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
    }
};