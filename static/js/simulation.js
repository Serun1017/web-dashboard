// static/js/simulation.js

const SimulationManager = {
    init() {
        const btn = document.getElementById('btn-toggle-sim');
        btn.addEventListener('click', () => {
            AppState.isSimulationMode = !AppState.isSimulationMode;
            
            if (AppState.isSimulationMode) {
                btn.innerText = "사고 위치 지정 (On)";
                btn.classList.add('active');
            } else {
                btn.innerText = "가상 사고 위치 지정 (Off)";
                btn.classList.remove('active');
                this.clearSimulation();
            }
        });
    },

    handleMapClick(e) {
        if (!AppState.isSimulationMode) return;
        
        if(AppState.simMarker) MapManager.map.removeLayer(AppState.simMarker);
        
        AppState.simMarker = L.marker(e.latlng).addTo(MapManager.map)
            .bindPopup("<b style='color:red;'>가상 사고 발생 지점</b><br>해당 지점 기준 SOP가 가동됩니다.")
            .openPopup();
        
        UIManager.loadSOP('red_alert');
        console.log(`[시뮬레이션] 발생 위치 좌표: 위도 ${e.latlng.lat}, 경도 ${e.latlng.lng}`);
    },

    clearSimulation() {
        if(AppState.simMarker) {
            MapManager.map.removeLayer(AppState.simMarker);
            AppState.simMarker = null;
        }
        UIManager.loadSOP('normal'); 
    }
};