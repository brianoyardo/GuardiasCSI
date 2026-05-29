// tests/radar-stress.spec.js
import { test, expect } from '@playwright/test';

test.describe('Iteración 4: Prueba de Estrés de Renderizado Cartográfico', () => {

  test('TC-4.3: Simulación de 1000 guardias en tiempo real (Zero-Render Thrashing)', async ({ page }) => {
    // 1. Iniciar sesión como Jefe de Operaciones
    await page.goto('http://localhost:3000/GuardiasCSI/#/login');
    await page.fill('#login-email', 'manchas@gmail.com'); 
    await page.fill('#login-password', 'mancha2026');   
    await page.click('#login-submit', { force: true });
    
    // 2. Navegar al Radar usando TU RUTA EXACTA
    await page.waitForURL('**/admin/dashboard', { timeout: 15000 }); 
    await page.goto('http://localhost:3000/GuardiasCSI/#/admin/monitoring');
    
    // Esperar que el mapa base cargue
    const mapContainer = page.locator('.leaflet-container');
    await expect(mapContainer).toBeVisible({ timeout: 15000 });

    // NUEVO: Le decimos al robot que espere hasta que Vite exponga el Store
    await page.waitForFunction(() => window.useRealtimeStore !== undefined, { timeout: 10000 });

    // 3. INYECCIÓN DE ESTRÉS: 1000 Guardias en la memoria de Zustand
    await page.evaluate(() => {
      const store = window.useRealtimeStore.getState();
      const mockExecutions = {};
      const centerLat = -16.5000; // Centro aproximado (La Paz)
      const centerLng = -68.1500;

      // Generar el ejército de guardias
      for (let i = 1; i <= 1000; i++) {
        mockExecutions[`stress-${i}`] = {
          id: `stress-${i}`,
          guardLabel: `Guardia Táctico ${i}`,
          status: 'IN_PROGRESS',
          patrolType: 'A_PIE',
          shift: 'DIURNO',
          location: {
            lat: centerLat + (Math.random() - 0.5) * 0.15,
            lng: centerLng + (Math.random() - 0.5) * 0.15,
            accuracy: 5,
            timestamp: Date.now()
          }
        };
      }
      
      // Inyectar masivamente
      store.setExecutions(mockExecutions);

      // 4. SIMULAR MOVIMIENTO CONSTANTE (60 FPS)
      setInterval(() => {
        const currentExecutions = window.useRealtimeStore.getState().activeExecutions;
        for (let i = 1; i <= 1000; i++) {
          const id = `stress-${i}`;
          if (currentExecutions[id]) {
            store.updateExecution(id, {
              location: {
                lat: currentExecutions[id].location.lat + (Math.random() - 0.5) * 0.0005,
                lng: currentExecutions[id].location.lng + (Math.random() - 0.5) * 0.0005,
              }
            });
          }
        }
      }, 500);
    });

    // 5. Pausamos el script indefinidamente para que tomes tu foto tranquilamente
    await page.pause();
  });
});