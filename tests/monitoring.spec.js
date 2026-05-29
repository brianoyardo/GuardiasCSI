// tests/monitoring.spec.js
import { test, expect } from '@playwright/test';

test.describe('Iteración 4: Centro de Monitoreo en Vivo (Radar)', () => {

  test.beforeEach(async ({ page }) => {
    // 1. El Jefe de Operaciones inicia sesión
    await page.goto('http://localhost:3000/GuardiasCSI/#/login');
    await page.fill('#login-email', 'manchas@gmail.com'); 
    await page.fill('#login-password', 'mancha2026');   
    await page.click('#login-submit', { force: true });
    
    // 2. Esperamos llegar al dashboard y navegamos al Radar Táctico
    await page.waitForURL('**/admin/dashboard', { timeout: 15000 }); 
    
    // NOTA PARA BRIAN: Si la URL de tu mapa en vivo es diferente, cámbiala aquí
    await page.goto('http://localhost:3000/GuardiasCSI/#/admin/monitoring');
    // await page.waitForURL('**/admin/live', { timeout: 15000 });
  });

  test('TC-4.1: El lienzo cartográfico panorámico debe cargar al 100%', async ({ page }) => {
    // Verificamos que el contenedor de Leaflet se haya instanciado
    const mapContainer = page.locator('.leaflet-container');
    await expect(mapContainer).toBeVisible({ timeout: 15000 });
  });

  test('TC-4.2: El panel superpuesto de métricas debe renderizarse correctamente', async ({ page }) => {
    // Aseguramos que el mapa de fondo está listo
    const mapContainer = page.locator('.leaflet-container');
    await expect(mapContainer).toBeVisible();

    // Verificamos la existencia de un panel de métricas/estadísticas superpuesto
    // Ajusta la clase css '.monitoring-stats' o '.live-panel' a la que uses en tu proyecto
    // Si usas un header o un div flotante para los indicadores, búscalo por su texto:
    
    const panelIndicadores = page.locator('text=Activos'); // Busca una palabra clave de tu panel
    // O si usas una clase específica: const panelIndicadores = page.locator('.monitoring-stats');
    
    await expect(panelIndicadores.first()).toBeVisible();
  });
});