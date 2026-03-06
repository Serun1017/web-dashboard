// static/js/map.js

const MapManager = {
    map: null,
    velocityLayer: null,
    layerGroups: {},
    dangerCircle: null, // 추가: 위험 구역 레이어 변수

    init() {
        this.map = L.map('map', {
            center: CONFIG.mapCenter,
            zoom: CONFIG.zoom,
            minZoom: CONFIG.minZoom,
            maxBounds: CONFIG.maxBounds,
            maxBoundsViscosity: 1.0 
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '© OpenStreetMap & CartoDB'
        }).addTo(this.map);

        this.map.on('click', (e) => SimulationManager.handleMapClick(e));

        this.layerGroups = {
            plants: L.layerGroup().addTo(this.map),    
            factories: L.layerGroup().addTo(this.map), 
            shelters: L.layerGroup()
        };

        L.control.layers(null, {
            "<span style='color:red; font-weight:bold;'>원자력 발전소</span>": this.layerGroups.plants,
            "<span style='color:blue; font-weight:bold;'>고객사 공장</span>": this.layerGroups.factories,
            "<span style='color:green; font-weight:bold;'>비상 대피소</span>": this.layerGroups.shelters
        }, { collapsed: false }).addTo(this.map);
    },

    async loadFacilityData() {
        try {
            const [resPlants, resFactories, resShelters] = await Promise.all([
                fetch(CONFIG.endpoints.plants),
                fetch(CONFIG.endpoints.factories),
                fetch(CONFIG.endpoints.shelters)
            ]);

            const plants = await resPlants.json();
            const factories = await resFactories.json();
            const shelters = await resShelters.json();

            plants.forEach(p => {
                if (!p.lat || !p.lon) return;
                const marker = L.circleMarker([p.lat, p.lon], {
                    radius: 12, fillColor: "#ff0000", color: "#ffffff", weight: 2, fillOpacity: 0.8
                }).addTo(this.layerGroups.plants)
                .bindPopup(`<b>[발전소] ${p.name}</b>`); // 팝업 내용 간소화

                // 추가: 마커 클릭 시 사이드바에 상세 정보 렌더링 지시
                marker.on('click', () => {
                    UIManager.showPlantDetails(p);
                });
            });

            factories.forEach(f => {
                if (!f.lat || !f.lon) return;
                L.circleMarker([f.lat, f.lon], {
                    radius: 8, fillColor: "#0055ff", color: "#ffffff", weight: 1.5, fillOpacity: 0.7
                }).addTo(this.layerGroups.factories)
                  .bindPopup(`<b>[공장] ${f.name}</b><br>${f.address}`);
            });

            shelters.forEach(s => {
                if (!s.lat || !s.lon) return;
                L.circleMarker([s.lat, s.lon], {
                    radius: 5, fillColor: "#00ff00", color: "#ffffff", weight: 1, fillOpacity: 0.6
                }).addTo(this.layerGroups.shelters)
                  .bindPopup(`<b>[대피소] ${s.name}</b><br>수용 가능: ${s.capacity}명<br>${s.address}`);
            });

        } catch (e) { console.error("시설물 데이터 로드 실패:", e); }
    },

    async renderWindLayer() {
        UIManager.showLoading();
        try {
            const res = await fetch(CONFIG.endpoints.wind);
            if (!res.ok) throw new Error("바람 데이터를 가져올 수 없습니다.");
            const data = await res.json();
            
            if (this.velocityLayer) this.map.removeLayer(this.velocityLayer);
            
            this.velocityLayer = L.velocityLayer({
                displayValues: true,
                displayOptions: {
                    velocityType: "기상청 실시간 바람",
                    displayPosition: "bottomleft",
                    displayEmptyString: "데이터 없음"
                },
                data: data, 
                maxVelocity: 15, 
                velocityScale: 0.01, 
                particleAge: 40,     
                particleMultiplier: 1/1600, 
                lineWidth: 1.5,
                colorScale: ["#ffffff", "#e0f3f8", "#91bfdb", "#4575b4"] 
            });
            this.velocityLayer.addTo(this.map);
        } catch (e) {
            console.warn(e.message);
        } finally {
            UIManager.hideLoading();
        }
    },

    // --- [추가] 위험 구역(방사선 비상 계획 구역) 렌더링 함수 ---
    drawDangerZone(lat, lon, radius) {
        this.clearDangerZone(); // 중복 생성 방지를 위한 초기화
        
        // Leaflet 라이브러리(L)를 이용한 원 레이어 생성
        if (typeof L !== 'undefined' && this.map) {
            this.dangerCircle = L.circle([lat, lon], {
                color: '#ff0000',      // 테두리 색상 (빨간색)
                fillColor: '#ff0000',  // 내부 채우기 색상
                fillOpacity: 0.2,      // 투명도
                weight: 2,             // 테두리 굵기
                radius: radius         // 미터 단위
            }).addTo(this.map);
            
            // 사용자가 상황을 즉시 파악할 수 있도록, 원 전체가 화면에 들어오게 줌 레벨과 시점을 강제 조정
            this.map.fitBounds(this.dangerCircle.getBounds());
        }
    },

    clearDangerZone() {
        if (this.dangerCircle && this.map) {
            this.map.removeLayer(this.dangerCircle);
            this.dangerCircle = null;
        }
    }
};