// static/js/main.js

window.onload = () => {
    UIManager.loadTimeline();
    UIManager.loadSOP();

    MapManager.init();
    MapManager.renderWindLayer();
    MapManager.loadFacilityData(); 

    SimulationManager.init();
};