// tests/spatial-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '10s', target: 20 },  // Rampa a 20 peticiones concurrentes
    { duration: '15s', target: 50 },  // Sostener a 50
    { duration: '5s', target: 0 },    // Bajar a 0
  ],
};

export default function () {
  // Reemplaza con tu URL real de Firebase o la URL del endpoint si tienes uno en tu backend serverless
  // Nota: Si usas Firebase Client SDK directamente en React, k6 atacará la API REST de Firestore
  const PROJECT_ID = 'TU_PROJECT_ID'; 
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/geofences`;
  
  // Estructura GeoJSON simulada de alta carga
  const payload = JSON.stringify({
    fields: {
      type: { stringValue: 'Feature' },
      properties: {
        name: { stringValue: 'Geocerca de Estrés' },
        createdAt: { stringValue: new Date().toISOString() }
      },
      geometry: {
        mapValue: {
          fields: {
            type: { stringValue: 'Polygon' },
            coordinates: {
              arrayValue: {
                values: [
                  { arrayValue: { values: [
                    { mapValue: { fields: { lng: { doubleValue: -68.123 }, lat: { doubleValue: -16.500 } } } },
                    { mapValue: { fields: { lng: { doubleValue: -68.124 }, lat: { doubleValue: -16.501 } } } },
                    { mapValue: { fields: { lng: { doubleValue: -68.122 }, lat: { doubleValue: -16.502 } } } },
                    { mapValue: { fields: { lng: { doubleValue: -68.123 }, lat: { doubleValue: -16.500 } } } }
                  ] } }
                ]
              }
            }
          }
        }
      }
    }
  });

  const params = {
    headers: { 
      'Content-Type': 'application/json',
      // 'Authorization': 'Bearer TU_TOKEN_AQUI' (Si tu Firestore tiene reglas de seguridad fuertes)
    },
  };

  let res = http.post(url, payload, params);

  check(res, {
    'Latencia procesando GeoJSON < 600ms': (r) => r.timings.duration < 600,
  });

  sleep(1);
}