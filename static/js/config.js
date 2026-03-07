// static/js/config.js

const CONFIG = {
    endpoints: {
        wind: '/api/weather/wind',
        alerts: '/api/disaster/alerts',
        factories: '/api/facilities/factories',
        plants: '/api/facilities/plants',
        shelters: '/api/facilities/shelters',
        ragTrigger: 'http://localhost:8000/api/rag/trigger'
    },
    mapCenter: [36.0, 127.5],
    zoom: 7,
    minZoom: 6,
    maxBounds: [
        [31.0, 120.0], 
        [43.0, 134.0]  
    ]
};

const AppState = {
    isSimulationMode: false,
    simMarker: null
};