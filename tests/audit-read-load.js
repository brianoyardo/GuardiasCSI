// tests/audit-read-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '10s', target: 100 }, // Rampa de subida agresiva a 100 supervisores
    { duration: '20s', target: 100 }, // Mantener la carga consultando historiales
    { duration: '5s', target: 0 },    // Bajar a 0
  ],
};

export default function () {
  // Reemplaza 'TU_PROJECT_ID' con el ID real de tu proyecto de Firebase
  // Si no lo recuerdas, pon algo como 'guardias-csi-tesis' solo para propósitos de simular la petición HTTP
  const PROJECT_ID = 'guardias-csi'; 
  
  // Endpoint de lectura (GET) de la colección de ejecuciones
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/ronda_executions`;
  
  const params = {
    headers: {
      'Accept': 'application/json',
    },
  };

  // El supervisor "solicita" la lista de historiales para hacer el scoring
  let res = http.get(url, params);

  // Verificamos que la base de datos responda rápido a la lectura masiva
  check(res, {
    'Lectura exitosa (HTTP 200)': (r) => r.status === 200,
    'Latencia de lectura forense < 500ms': (r) => r.timings.duration < 500,
  });

  // Cada supervisor hace una consulta cada segundo
  sleep(1);
}