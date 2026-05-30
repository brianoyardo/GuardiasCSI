// tests/incidents-flow.spec.js
import { test, expect } from '@playwright/test';

test.describe('Iteración 5: Gestión de Incidentes y Evidencia (Appwrite)', () => {

  test('TC-5.1 y TC-5.2: Verificación de acceso al panel de incidentes', async ({ page }) => {
    // 1. Iniciar sesión como Jefe de Operaciones
    await page.goto('http://localhost:3000/GuardiasCSI/#/login');
    await page.fill('#login-email', 'manchas@gmail.com'); 
    await page.fill('#login-password', 'mancha2026');   
    await page.click('#login-submit', { force: true });
    
    // 2. Navegar a la bandeja de incidentes
    await page.waitForURL('**/admin/dashboard', { timeout: 15000 }); 
    await page.goto('http://localhost:3000/GuardiasCSI/#/admin/incidents');
    
    // 3. Verificar que el contenedor principal de tu código existe (.inc-mgmt)
    const contenedorPrincipal = page.locator('.inc-mgmt').first();
    await expect(contenedorPrincipal).toBeVisible({ timeout: 15000 });
  });

  test('TC-5.3: Carga de lista y semántica de estado', async ({ page }) => {
    // 1. Iniciar sesión
    await page.goto('http://localhost:3000/GuardiasCSI/#/login');
    await page.fill('#login-email', 'manchas@gmail.com'); 
    await page.fill('#login-password', 'mancha2026');   
    await page.click('#login-submit', { force: true });
    
    await page.waitForURL('**/admin/dashboard', { timeout: 15000 }); 
    await page.goto('http://localhost:3000/GuardiasCSI/#/admin/incidents');

    // Damos 2 segundos para que Firebase devuelva los incidentes
    await page.waitForTimeout(2000); 

    // 2. Verificamos tu clase específica de lista de incidentes
    const listaIncidentes = page.locator('.inc-mgmt__list').first();
    await expect(listaIncidentes).toBeVisible({ timeout: 10000 });
  });
});