// static/js/ui.js

const UIManager = {
    etaInterval: null,
    isEmergency: false, 

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

    appendDisasterMessages(newMsgs) {
        const container = document.getElementById('timeline-content');
        if (!container) return;
        
        const html = newMsgs.map(item => this.formatMsgHtml(item)).join('');
        container.insertAdjacentHTML('afterbegin', html);
    },

    initSidebarFeatures() {
        // 사이드바 토글 관련 이벤트 리스너 제거 완료

        const clearEmergencyBtn = document.getElementById('btn-clear-emergency');
        if (clearEmergencyBtn) {
            clearEmergencyBtn.addEventListener('click', async () => {
                if (SimulationManager.isTraining) {
                    if (confirm("가상 훈련 모드를 종료하시겠습니까?")) {
                        SimulationManager.stopTraining();
                    }
                    return;
                }

                if (confirm("정말로 비상 상황을 수동으로 해제하시겠습니까?\n모든 시스템이 평시 모드로 복구됩니다.")) {
                    try {
                        const res = await fetch('/api/webhook/emergency/clear', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ source: 'dashboard_ui' })
                        });
                        
                        if (!res.ok) throw new Error("서버 응답 오류");
                        console.log("비상 상황 수동 해제 요청 전송 완료");
                    } catch (e) {
                        console.error("비상 해제 요청 실패:", e);
                        alert("비상 상황 해제 요청에 실패했습니다. 서버 상태를 확인하세요.");
                    }
                }
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
    },

    triggerEmergencyMode(plantCode, plantName, eta, lat, lon, isTrainingEvent = false) {
        if (this.isEmergency && isTrainingEvent) return;

        if (!isTrainingEvent && SimulationManager.isTraining) {
            SimulationManager.stopTraining(true); 
            alert("⚠️ [실제 상황 발생] 훈련 모드가 강제 종료되며 실제 비상 체제로 전환합니다.");
        }

        const trainingPanel = document.getElementById('training-panel');

        if (!isTrainingEvent) {
            this.isEmergency = true; 
            if (trainingPanel) trainingPanel.style.display = 'none';
        }

        const indicator = document.getElementById('status-indicator');
        if (indicator) {
            if (isTrainingEvent) {
                indicator.innerHTML = '🟠 훈련 모드 (Training)';
                indicator.style.background = 'rgba(255, 152, 0, 0.9)';
                indicator.style.borderColor = '#f57c00';
                document.body.style.boxShadow = "inset 0 0 100px rgba(255, 152, 0, 0.4)";
                
                const ragPanel = document.getElementById('rag-panel');
                if (ragPanel) ragPanel.style.borderLeft = "4px solid #ff9800";
            } else {
                indicator.innerHTML = '🚨 비상 모드 (Emergency)';
                indicator.style.background = 'rgba(244, 67, 54, 0.9)'; 
                indicator.style.borderColor = '#d32f2f';
                document.body.style.boxShadow = "inset 0 0 100px rgba(244, 67, 54, 0.4)";
                
                const ragPanel = document.getElementById('rag-panel');
                if (ragPanel) ragPanel.style.borderLeft = "4px solid #F44336";
            }
        }
        
        const alertType = isTrainingEvent ? "[훈련 발령]" : "[비상 발령]";
        if (!isTrainingEvent) {
            alert(`${alertType} ${plantName}에서 이상이 감지되었습니다.\n모든 시스템이 비상 모드로 전환됩니다.`);
        }
        
        const ragPanel = document.getElementById('rag-panel');
        if (ragPanel) {
            ragPanel.style.display = 'block';
            document.getElementById('rag-messages').innerHTML = ''; 
        }

        if (plantCode && plantName) {
            this.showPlantDetails({ id: plantCode, name: plantName });
        }

        if (lat && lon && typeof MapManager.drawDangerZone === 'function') {
            MapManager.drawDangerZone(lat, lon, 30000); 
        }

        if (typeof MapManager.showShelters === 'function') {
            MapManager.showShelters();
        }

        if (eta > 0) {
            this.startEtaTimer(eta);
        }
    },

    startEtaTimer(totalSeconds) {
        if (this.etaInterval) clearInterval(this.etaInterval);

        let timerEl = document.getElementById('map-eta-timer');
        if (!timerEl) {
            timerEl = document.createElement('div');
            timerEl.id = 'map-eta-timer';
            timerEl.style.cssText = `
                position: absolute;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.8);
                color: #ff3333;
                padding: 15px 30px;
                border: 2px solid #ff3333;
                border-radius: 10px;
                font-size: 24px;
                font-weight: bold;
                z-index: 1000;
                pointer-events: none;
            `;
            const mapContainer = document.getElementById('map');
            if (mapContainer) {
                mapContainer.appendChild(timerEl);
            } else {
                document.body.appendChild(timerEl);
            }
        }

        let currentSeconds = totalSeconds;

        const updateTimerUI = () => {
            if (currentSeconds <= 0) {
                timerEl.innerHTML = "⚠️ 대상 도달 완료";
                clearInterval(this.etaInterval);
                return;
            }
            const m = Math.floor(currentSeconds / 60).toString().padStart(2, '0');
            const s = (currentSeconds % 60).toString().padStart(2, '0');
            timerEl.innerHTML = `도착 예상 시간 - ${m}:${s}`;
            currentSeconds--;
        };

        updateTimerUI(); 
        this.etaInterval = setInterval(updateTimerUI, 1000);
    },

    appendRagMessage(text) {
        const container = document.getElementById('rag-messages');
        if (!container) return;
        
        const emptyState = container.querySelector('.empty-state');
        if (emptyState) {
            emptyState.remove();
        }
        
        const now = new Date();
        const timeString = now.toLocaleTimeString('ko-KR', { hour12: false });
        
        const msgHtml = `
            <div style="margin-bottom: 12px; border-bottom: 1px solid #441111; padding-bottom: 8px;">
                <div style="color: #ff9a9e; font-size: 11px; margin-bottom: 4px;">[${timeString}] AI 분석 보고</div>
                <div style="color: #fff; line-height: 1.5;">${text}</div>
            </div>
        `;
        
        container.insertAdjacentHTML('afterbegin', msgHtml);
        container.scrollTop = 0;
    },

    clearEmergencyMode(isSilent = false) {
        this.isEmergency = false; 

        const trainingPanel = document.getElementById('training-panel');
        if (trainingPanel) trainingPanel.style.display = 'block';

        const indicator = document.getElementById('status-indicator');
        if (indicator) {
            indicator.innerHTML = '🟢 평시 모드 (Normal)';
            indicator.style.background = 'rgba(40, 167, 69, 0.9)';
            indicator.style.borderColor = '#1e7e34';
        }
        
        document.body.style.boxShadow = "none";
        
        if (!isSilent) {
            alert("[상황 종료] 비상 상황이 해제되어 평시 모드로 복귀합니다.");
        }
        
        const ragPanel = document.getElementById('rag-panel');
        if (ragPanel) {
            ragPanel.style.display = 'none';
        }

        if (this.etaInterval) {
            clearInterval(this.etaInterval);
            this.etaInterval = null;
        }
        const timerEl = document.getElementById('map-eta-timer');
        if (timerEl) timerEl.remove();

        if (typeof MapManager.clearDangerZone === 'function') {
            MapManager.clearDangerZone();
        }

        if (typeof MapManager.hideShelters === 'function') {
            MapManager.hideShelters();
        }
    }
};