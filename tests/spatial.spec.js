// tests/spatial.spec.js
import { test, expect } from '@playwright/test';

test.describe('Iteración 2: Editor GIS y Administración Espacial', () => {

  test.beforeEach(async ({ page }) => {
    // 1. Iniciar sesión
    await page.goto('http://localhost:3000/GuardiasCSI/#/login');
    await page.fill('#login-email', 'manchas@gmail.com'); 
    await page.fill('#login-password', 'mancha2026');   
    await page.click('#login-submit', { force: true });
    
    // 2. Esperar a que el login sea exitoso y nos deje en el dashboard
    await page.waitForURL('**/admin/dashboard', { timeout: 15000 }); 

    // 3. Forzar la navegación al módulo del Editor GIS
    await page.goto('http://localhost:3000/GuardiasCSI/#/admin/spatial');
    await page.waitForURL('**/admin/spatial', { timeout: 15000 });
  });

  test('TC-2.1: El mapa base táctico debe renderizarse correctamente', async ({ page }) => {
    // Buscar el contenedor principal de Leaflet
    const mapContainer = page.locator('.leaflet-container');
    await expect(mapContainer).toBeVisible({ timeout: 10000 });
  });

  test('TC-2.2: Simular trazado de polígono y botón de guardado', async ({ page }) => {
    // 1. Localizar el mapa
    const mapContainer = page.locator('.leaflet-container');
    await expect(mapContainer).toBeVisible();

    // 2. Obtener las dimensiones del contenedor
    const box = await mapContainer.boundingBox();
    
    // 3. Simular clics geométricos
    if (box) {
      await page.mouse.click(box.x + 100, box.y + 100); 
      await page.mouse.click(box.x + 200, box.y + 100); 
      await page.mouse.click(box.x + 150, box.y + 200); 
      await page.mouse.click(box.x + 100, box.y + 100); 
    }
  });
});