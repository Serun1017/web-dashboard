// static/js/emergency_manager.js
const EmergencyManager = {
    isEmergency: false,
    isTraining: false,
    etaInterval: null,

    init() {
        document.getElementById('btn-start-training')?.addEventListener('click', () => this.startTraining());
        document.getElementById('btn-clear-emergency')?.addEventListener('click', () => this.requestClear());
        document.getElementById('btn-toggle-training')?.addEventListener('click', () => {
            if (this.isEmergency) return alert("⚠️ 실제 비상 상황입니다. 훈련 모드를 실행할 수 없습니다.");
            // 훈련 중이면 해제 API 호출, 아니면 모달 오픈
            this.isTraining ? this.requestClear() : (document.getElementById('training-modal').style.display = 'block');
        });
        document.getElementById('btn-cancel-training')?.addEventListener('click', () => {
            document.getElementById('training-modal').style.display = 'none';
        });
    },

    async requestClear() {
        const msg = this.isTraining ? "가상 훈련 모드를 종료하시겠습니까?" : "정말로 비상 상황을 수동으로 해제하시겠습니까?";
        if (confirm(msg)) {
            try { 
                // [인과 제어] 로컬 상태만 변경하지 않고 무조건 서버에 해제 명령 하달
                await API.sendEmergencyClear(); 
            } catch (e) { 
                alert("해제 요청 실패"); 
            }
        }
    },

    async startTraining() {
        const selectEl = document.getElementById('train-plant-select');
        const opt = selectEl.options[selectEl.selectedIndex];
        if (!opt?.value) return alert("원전 데이터를 선택하세요.");

        const eta = parseInt(document.getElementById('train-eta').value) || 120;
        document.getElementById('training-modal').style.display = 'none';

        try { 
            // [인과 제어] 로컬 UI 사전 렌더링 제거. 서버로 발령 명령만 전송
            await API.triggerRagTraining(opt.value, eta); 
        } catch (e) { 
            console.error("서버 연동 에러", e); 
            alert("훈련 발령 요청에 실패했습니다.");
        }
    },

    handleServerAlert(data) {
        const incomingIsTraining = !!data.is_training;

        // 실제 비상 상황이 훈련 모드를 덮어쓰는 경우의 안전 장치
        if (!incomingIsTraining && this.isTraining) {
            this.isTraining = false;
            this.clearEtaTimer();
        }

        if (incomingIsTraining) {
            this.isTraining = true;
            this.isEmergency = false;
        } else {
            this.isEmergency = true;
            this.isTraining = false;
        }

        // 서버 이벤트(SSE) 수신 시에만 UI를 한 번 렌더링
        UIManager.renderEmergencyUI(
            data.plant_code, 
            data.plant_name, 
            data.eta, 
            data.lat, 
            data.lon, 
            incomingIsTraining 
        );

        this.startEtaTimer(data.eta);

        const msg = incomingIsTraining 
            ? `[가상 훈련] ${data.plant_name} 시나리오가 시작되었습니다.` 
            : `[실제 비상] ${data.plant_name}에서 이상이 감지되었습니다!`;
        alert(msg);
    },

    handleServerClear() {
        this.isEmergency = false;
        this.isTraining = false; 
        this.clearEtaTimer();
        UIManager.renderNormalUI();
        alert("[상황 종료] 모든 상황이 해제되어 평시 모드로 복귀합니다.");
    },

    startEtaTimer(totalSeconds) {
        this.clearEtaTimer();
        UIManager.createTimerDOM();
        let current = totalSeconds;
        
        this.etaInterval = setInterval(() => {
            if (current <= 0) {
                UIManager.updateTimerText("⚠️ 위험!");
                clearInterval(this.etaInterval); 
                this.etaInterval = null;
                return; 
            }
            UIManager.updateTimerText(`도착 예상 시간 - ${Math.floor(current / 60).toString().padStart(2, '0')}:${(current % 60).toString().padStart(2, '0')}`);
            current--;
        }, 1000);
    },

    clearEtaTimer() {
        if (this.etaInterval) clearInterval(this.etaInterval);
        this.etaInterval = null;
        UIManager.removeTimerDOM();
    }
};