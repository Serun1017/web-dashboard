// static/js/map.js

const MapManager = {
    map: null,
    velocityLayer: null,
    layerGroups: {},
    dangerCircle: null,

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

        this.layerGroups = {
            plants: L.layerGroup().addTo(this.map),    
            factories: L.layerGroup().addTo(this.map), 
            shelters: L.layerGroup()
        };

        // --- position 옵션을 추가하여 우측 상단으로 이동 ---
        L.control.layers(null, {
            "<span style='color:red; font-weight:bold;'>원자력 발전소</span>": this.layerGroups.plants,
            "<span style='color:blue; font-weight:bold;'>고객사 공장</span>": this.layerGroups.factories,
            "<span style='color:green; font-weight:bold;'>비상 대피소</span>": this.layerGroups.shelters
        }, { 
            position: 'topright',  // 위치 지정 (topleft, topright, bottomleft, bottomright 사용 가능)
            collapsed: false 
        }).addTo(this.map);
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

            // --- [신규 추가] 훈련 모드용 원전 선택 드롭다운에 DB 데이터 바인딩 ---
            const plantSelect = document.getElementById('train-plant-select');
            if (plantSelect) {
                plantSelect.innerHTML = ''; // 기본 "로딩 중..." 텍스트 제거
                plants.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p.id;          // 원전 코드 (예: WS)
                    opt.dataset.name = p.name; // 원전 이름
                    opt.dataset.lat = p.lat;   // 위도
                    opt.dataset.lon = p.lon;   // 경도
                    opt.textContent = p.name;  // 사용자에게 보여질 텍스트
                    plantSelect.appendChild(opt);
                });
            }

            plants.forEach(p => {
                if (!p.lat || !p.lon) return;
                const marker = L.circleMarker([p.lat, p.lon], {
                    radius: 12, fillColor: "#ff0000", color: "#ffffff", weight: 2, fillOpacity: 0.8
                }).addTo(this.layerGroups.plants)
                .bindPopup(`<b>[발전소] ${p.name}</b>`); 

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

    drawDangerZone(lat, lon, radius) {
        this.clearDangerZone(); 
        
        if (typeof L !== 'undefined' && this.map) {
            this.dangerCircle = L.circle([lat, lon], {
                color: '#ff0000',      
                fillColor: '#ff0000',  
                fillOpacity: 0.2,      
                weight: 2,             
                radius: radius         
            }).addTo(this.map);
            
            this.map.fitBounds(this.dangerCircle.getBounds());
        }
    },

    clearDangerZone() {
        if (this.dangerCircle && this.map) {
            this.map.removeLayer(this.dangerCircle);
            this.dangerCircle = null;
        }
    },

    showShelters() {
        if (this.map && this.layerGroups.shelters) {
            this.map.addLayer(this.layerGroups.shelters);
        }
    },

    hideShelters() {
        if (this.map && this.layerGroups.shelters) {
            this.map.removeLayer(this.layerGroups.shelters);
        }
    }
};