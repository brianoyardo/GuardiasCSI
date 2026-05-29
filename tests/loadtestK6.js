// loadtest.js
import http from 'k6/http';
import { check, sleep } from 'k6';

// Configuración de la prueba de estrés
export let options = {
  stages: [
    { duration: '10s', target: 50 },  // Subir a 50 guardias en 10 seg
    { duration: '20s', target: 100 }, // Subir a 100 guardias concurrentes (Cambio de turno)
    { duration: '10s', target: 0 },   // Bajar a 0 (Fin de la prueba)
  ],
};

export default function () {
  // Endpoint oficial de Firebase Identity Toolkit para login
  const url = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyAes98Y-p_8M6lcRxoaPbC87GPLYkYKKBA';
  
  const payload = JSON.stringify({
    email: 'brian@gmail.com', // Usamos tu usuario de prueba
    password: 'mancha2026',
    returnSecureToken: true,
  });

  const params = {
    headers: { 'Content-Type': 'application/json' },
  };

  // Disparar la petición
  let res = http.post(url, payload, params);

  // Verificar que Firebase respondió con un 200 OK (Login exitoso)
  check(res, {
    'Login fue exitoso (Status 200)': (r) => r.status === 200,
    'Respondió rápido (< 500ms)': (r) => r.timings.duration < 500,
  });

  // Pequeña pausa para no saturar los puertos de la PC local
  sleep(1);
}