// tests/telemetry-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '10s', target: 50 },  // Escalar rápido a 50 guardias
    { duration: '20s', target: 50 },  // Mantener durante 20 segundos
    { duration: '5s', target: 0 },    // Bajar a 0
  ],
};

export default function () {
  const PROJECT_ID = 'TU_PROJECT_ID'; 
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/ronda_executions`;
  
  // Simulamos un payload transaccional de un punto de control
  const payload = JSON.stringify({
    fields: {
      guardId: { stringValue: 'guard-test-123' },
      status: { stringValue: 'IN_PROGRESS' },
      lastPosition: {
        mapValue: {
          fields: {
            lat: { doubleValue: -16.5123 },
            lng: { doubleValue: -68.1234 },
            timestamp: { integerValue: new Date().getTime().toString() }
          }
        }
      }
    }
  });

  const params = { headers: { 'Content-Type': 'application/json' } };
  let res = http.post(url, payload, params);

  check(res, {
    'Latencia de telemetría < 800ms': (r) => r.timings.duration < 800,
  });

  // El guardia reporta su GPS cada 1 segundo
  sleep(1);
}