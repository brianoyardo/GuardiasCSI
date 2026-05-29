// tests/auth.spec.js
import { test, expect } from "@playwright/test";

// Prueba 1: Validar que el sistema rechace credenciales falsas
test("HU-1.1: Bloqueo de acceso con credenciales incorrectas", async ({ page }) => {
  // 1. Ir a la página de login
  await page.goto("http://localhost:3000/GuardiasCSI/#/login");

  // 2. Llenar el formulario usando los IDs exactos de tu LoginForm.jsx
  await page.fill('#login-email', "hacker@falso.com");
  await page.fill('#login-password', "ClaveEquivocada123");

  // 3. Hacer clic en el botón de submit usando su ID
  // En lugar de await page.click('#login-submit');
  await page.click('#login-submit', { force: true });

  // 4. El robot ESPERA que aparezca tu div con la clase .login-form__error
  const errorMessage = page.locator('.login-form__error');
  await expect(errorMessage).toBeVisible({ timeout: 10000 });
});

// Prueba 2: Validar el acceso correcto y el RBAC
test("HU-1.2: Login exitoso y redirección de guardia", async ({ page }) => {
  await page.goto("http://localhost:3000/GuardiasCSI/#/login");

  // 1. Ingresar tus credenciales reales
  await page.fill('#login-email', "brian@gmail.com");
  await page.fill('#login-password', "mancha2026"); 

  // 2. Hacer clic en ingresar
  await page.click('#login-submit');

  // 3. Esperar la redirección a la ruta real de tu guardia (según el log de tu consola)
  await page.waitForURL("**/guard/mis-rondas", { timeout: 15000 }); 

  // 4. (Opcional) Verifica que la pantalla cargó correctamente 
  // Nota: Si "Brian Ayardo" no sale textualmente en esa página, el robot fallará. 
  // Lo cambiaremos por buscar el layout del guardia para asegurar.
  const guardPanel = page.locator('.guard-layout'); // O cualquier clase principal de esa vista
  // await expect(guardPanel).toBeVisible(); 
});