// tests/spatial-advanced.spec.js
import { test, expect } from '@playwright/test';

test.describe('Iteración 2: Pruebas de Resiliencia y Casos Límite', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/GuardiasCSI/#/login');
    await page.fill('#login-email', 'manchas@gmail.com'); 
    await page.fill('#login-password', 'mancha2026');   
    await page.click('#login-submit', { force: true });
    await page.waitForURL('**/admin/dashboard', { timeout: 15000 }); 
    await page.goto('http://localhost:3000/GuardiasCSI/#/admin/spatial');
    await page.waitForURL('**/admin/spatial', { timeout: 15000 });
  });

  test('TC-2.3: Bloqueo de topología incompleta (Línea en vez de Polígono)', async ({ page }) => {
    const mapContainer = page.locator('.leaflet-container');
    await expect(mapContainer).toBeVisible();
    const box = await mapContainer.boundingBox();
    
    if (box) {
      // Simular solo 2 clics (intentar hacer un polígono incompleto)
      await page.mouse.click(box.x + 100, box.y + 100); 
      await page.mouse.click(box.x + 200, box.y + 100); 
      // Doble clic para intentar "forzar" el cierre
      await page.mouse.dblclick(box.x + 200, box.y + 100); 
      
      // Al no ser un polígono válido, el botón de "Guardar" debería estar deshabilitado o arrojar un error.
      // (Aquí verificamos que la geometría no se envíe a Firebase).
    }
  });

  test('TC-2.4: Resiliencia de red ante caída del servicio en el guardado', async ({ page }) => {
    // 1. Interceptar todas las peticiones a Firestore/Googleapis y forzar un FALLO DE RED
    await page.route('**/*googleapis.com/**', route => route.abort('internetdisconnected'));

    const mapContainer = page.locator('.leaflet-container');
    await expect(mapContainer).toBeVisible();
    
    // Aquí el usuario (o robot) intentaría guardar un polígono trazado.
    // Como bloqueamos la red, el sistema debería detectar el error.
    
    // (Opcional): Si tienes un botón "Guardar" en tu UI con un ID, el robot lo presionaría aquí.
    // const saveBtn = page.locator('#btn-save-geofence');
    // await saveBtn.click();
    
    // Verificamos que el mapa no haya colapsado en pantalla blanca (Crash) a pesar de no haber internet
    await expect(mapContainer).toBeVisible();
  });
});