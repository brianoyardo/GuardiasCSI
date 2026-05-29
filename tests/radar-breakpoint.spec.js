// tests/radar-breakpoint.spec.js
import { test, expect } from '@playwright/test';

test.describe('Iteración 4: Prueba de Degradación y Límites (Breakpoint Testing)', () => {

  test('TC-4.4: Inyección escalonada y medición de FPS', async ({ page }) => {
    test.setTimeout(120000); // 2 minutos de tiempo límite

    // 1. Iniciar sesión y navegar al radar
    await page.goto('http://localhost:3000/GuardiasCSI/#/login');
    await page.fill('#login-email', 'manchas@gmail.com'); 
    await page.fill('#login-password', 'mancha2026');   
    await page.click('#login-submit', { force: true });
    
    await page.waitForURL('**/admin/dashboard', { timeout: 15000 }); 
    await page.goto('http://localhost:3000/GuardiasCSI/#/admin/monitoring');
    
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15000 });
    await page.waitForFunction(() => window.useRealtimeStore !== undefined, { timeout: 10000 });

    console.log('\n🚀 INICIANDO PRUEBA DE LÍMITES DE RENDERIZADO (BREAKPOINT)...');
    console.log('------------------------------------------------------------');

    // 2. Lógica inyectada en el navegador para escalar y medir
    const results = await page.evaluate(async () => {
      const store = window.useRealtimeStore.getState();
      const centerLat = -16.5000; 
      const centerLng = -68.1500;
      
      let currentInterval = null;
      // NUEVOS LOTES REALISTAS
      const testBatches = [200, 500, 1000, 2500]; 
      const report = [];

      // Función para medir FPS durante 3 segundos
      const measureFPS = async (duration = 3000) => {
        return new Promise(resolve => {
          let frames = 0;
          let startTime = performance.now();
          function loop() {
            frames++;
            if (performance.now() - startTime < duration) {
              requestAnimationFrame(loop);
            } else {
              resolve(Math.round((frames * 1000) / duration));
            }
          }
          requestAnimationFrame(loop);
        });
      };

      for (const batchSize of testBatches) {
        if (currentInterval) clearInterval(currentInterval);

        // Generar el lote de guardias
        const mockExecutions = {};
        for (let i = 1; i <= batchSize; i++) {
          mockExecutions[`stress-${i}`] = {
            id: `stress-${i}`,
            guardLabel: `Guardia ${i}`,
            status: 'IN_PROGRESS',
            location: {
              lat: centerLat + (Math.random() - 0.5) * 0.2, 
              lng: centerLng + (Math.random() - 0.5) * 0.2,
            }
          };
        }
        store.setExecutions(mockExecutions);

        // SIMULACIÓN GPS REAL: Actualizar posiciones 1 vez por segundo (1000ms)
        currentInterval = setInterval(() => {
          const currentExecs = window.useRealtimeStore.getState().activeExecutions;
          for (let i = 1; i <= batchSize; i++) {
            const id = `stress-${i}`;
            if (currentExecs[id]) {
              store.updateExecution(id, {
                location: {
                  lat: currentExecs[id].location.lat + (Math.random() - 0.5) * 0.0005,
                  lng: currentExecs[id].location.lng + (Math.random() - 0.5) * 0.0005,
                }
              });
            }
          }
        }, 1000);

        // Dejar que el DOM se estabilice un segundo
        await new Promise(r => setTimeout(r, 1000));
        
        // Medir los FPS reales del navegador bajo esta carga
        const fps = await measureFPS(3000);
        
        let status = 'ÓPTIMO 🟢';
        if (fps < 45 && fps >= 24) status = 'ACEPTABLE 🟡';
        if (fps < 24) status = 'CRÍTICO 🔴';

        report.push({ batchSize, fps, status });
      }

      // Detener el motor al terminar
      clearInterval(currentInterval);
      store.clear();
      return report;
    });

    // 3. Imprimir el reporte en la consola de Node
    results.forEach(r => {
      console.log(`Lote: ${r.batchSize.toString().padStart(4, ' ')} guardias | Rendimiento: ${r.fps.toString().padStart(2, ' ')} FPS | Estado: ${r.status}`);
    });
    console.log('------------------------------------------------------------\n');

    // Afirmación: El sistema debe mantener rendimiento funcional (>=24 FPS) con 500 guardias
    const fps500 = results.find(r => r.batchSize === 500).fps;
    expect(fps500).toBeGreaterThanOrEqual(24);
  });
});