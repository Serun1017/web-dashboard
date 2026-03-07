// static/js/simulation.js

const SimulationManager = {
    isTraining: false,
    
    init() {
        const btnToggle = document.getElementById('btn-toggle-training');
        const modal = document.getElementById('training-modal');
        const btnStart = document.getElementById('btn-start-training');
        const btnCancel = document.getElementById('btn-cancel-training');

        if (btnToggle) {
            btnToggle.addEventListener('click', () => {
                if (UIManager.isEmergency) {
                    alert("⚠️ 현재 실제 비상 상황입니다. 훈련 모드를 실행할 수 없습니다.");
                    return;
                }

                if (this.isTraining) {
                    this.stopTraining();
                } else {
                    modal.style.display = 'block'; 
                }
            });
        }

        if (btnCancel) {
            btnCancel.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        if (btnStart) {
            btnStart.addEventListener('click', () => {
                modal.style.display = 'none';
                this.startTraining();
            });
        }
    },

    async startTraining() {
        this.isTraining = true;

        // --- [수정] select 태그의 선택된 옵션에서 데이터를 추출합니다 ---
        const selectEl = document.getElementById('train-plant-select');
        const selectedOption = selectEl.options[selectEl.selectedIndex];
        
        if (!selectedOption || !selectedOption.value) {
            alert("원전 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
            this.isTraining = false;
            return;
        }

        const code = selectedOption.value;
        const name = selectedOption.dataset.name;
        const lat = parseFloat(selectedOption.dataset.lat);
        const lon = parseFloat(selectedOption.dataset.lon);
        
        // ETA는 여전히 사용자가 입력한 값을 사용합니다
        const eta = parseInt(document.getElementById('train-eta').value) || 120;

        const btnToggle = document.getElementById('btn-toggle-training');
        if (btnToggle) {
            btnToggle.innerText = "훈련 모드 종료";
            btnToggle.style.backgroundColor = "#555";
            btnToggle.style.color = "#fff";
        }

        // 1. 프론트엔드 UI를 훈련 모드로 전환 (기존 로직)
        UIManager.triggerEmergencyMode(code, `[훈련] ${name}`, eta, lat, lon, true);

        // 2. config.js에서 분리된 URL을 사용하여 RAG 시스템으로 POST 전송
        try {
            const response = await fetch(CONFIG.endpoints.ragTrigger, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    plant_code: code,
                    eta: eta,
                    is_training: true 
                })
            });

            if (!response.ok) {
                console.warn("[훈련 모드] RAG 시스템으로 데이터 전송 실패:", response.status);
            } else {
                console.log("[훈련 모드] RAG 시스템으로 데이터 전송 성공");
            }
        } catch (error) {
            console.error("[훈련 모드] RAG 서버와 통신할 수 없습니다 (네트워크/CORS 문제일 수 있음).", error);
        }
    },

    stopTraining(isSilent = false) {
        this.isTraining = false;

        const btnToggle = document.getElementById('btn-toggle-training');
        if (btnToggle) {
            btnToggle.innerText = "훈련 모드 시작";
            btnToggle.style.backgroundColor = "#ff9800";
            btnToggle.style.color = "#000";
        }

        if (!isSilent) {
            UIManager.clearEmergencyMode(true); 
            alert("[훈련 종료] 훈련 모드가 해제되어 평시 모드로 복귀합니다.");
        }
    }
};