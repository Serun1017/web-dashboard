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
            this.isTraining ? this.stopTraining() : (document.getElementById('training-modal').style.display = 'block');
        });
        document.getElementById('btn-cancel-training')?.addEventListener('click', () => {
            document.getElementById('training-modal').style.display = 'none';
        });
    },

    async requestClear() {
        if (this.isTraining) {
            if (confirm("가상 훈련 모드를 종료하시겠습니까?")) this.stopTraining();
            return;
        }
        if (confirm("정말로 비상 상황을 수동으로 해제하시겠습니까?")) {
            try { await API.sendEmergencyClear(); } catch (e) { alert("해제 요청 실패"); }
        }
    },

    async startTraining() {
        const selectEl = document.getElementById('train-plant-select');
        const opt = selectEl.options[selectEl.selectedIndex];
        if (!opt?.value) return alert("원전 데이터를 선택하세요.");

        this.isTraining = true;
        const eta = parseInt(document.getElementById('train-eta').value) || 120;
        document.getElementById('training-modal').style.display = 'none';

        UIManager.renderEmergencyUI(opt.value, `[훈련] ${opt.dataset.name}`, eta, parseFloat(opt.dataset.lat), parseFloat(opt.dataset.lon), true);
        this.startEtaTimer(eta);

        try { await API.triggerRagTraining(opt.value, eta); } 
        catch (e) { console.error("RAG 연동 에러", e); }
    },

    stopTraining(isSilent = false) {
        this.isTraining = false;
        this.clearEtaTimer();
        if (!isSilent) {
            UIManager.renderNormalUI();
            alert("[훈련 종료] 훈련 모드가 해제되어 평시 모드로 복귀합니다.");
        }
    },

    handleServerAlert(data) {
        // [수정] 서버 데이터에 훈련 모드 플래그가 있는지 확인
        const incomingIsTraining = !!data.is_training;

        // 1. 실제 비상 상황이 왔는데 현재 훈련 중이라면 훈련 강제 종료
        if (!incomingIsTraining && this.isTraining) {
            this.stopTraining(true);
        }

        // 2. 상태값 업데이트 (훈련이면 isTraining, 실제면 isEmergency)
        if (incomingIsTraining) {
            this.isTraining = true;
            this.isEmergency = false;
        } else {
            this.isEmergency = true;
            this.isTraining = false;
        }

        // 3. UI 렌더링 (마지막 인자에 incomingIsTraining을 전달하여 UI 색상/문구 결정)
        UIManager.renderEmergencyUI(
            data.plant_code, 
            data.plant_name, 
            data.eta, 
            data.lat, 
            data.lon, 
            incomingIsTraining // [핵심] 이 값이 true면 훈련용 UI가 뜹니다.
        );

        this.startEtaTimer(data.eta);

        // 4. 알림 메시지 분기
        const msg = incomingIsTraining 
            ? `[가상 훈련] ${data.plant_name} 시나리오가 시작되었습니다.` 
            : `[실제 비상] ${data.plant_name}에서 이상이 감지되었습니다!`;
        alert(msg);
    },

    handleServerClear() {
        this.isEmergency = false;
        this.clearEtaTimer();
        UIManager.renderNormalUI();
        alert("[상황 종료] 비상 상황이 해제되어 평시 모드로 복귀합니다.");
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