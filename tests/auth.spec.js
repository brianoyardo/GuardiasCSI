// tests/auth.spec.js
import { test, expect } from "@playwright/test";

// Prueba 1: Validar que el sistema rechace credenciales falsas
test("HU-1.1: Bloqueo de acceso con credenciales incorrectas", async ({
  page,
}) => {
  // 1. Ir a la página de login
  await page.goto("http://localhost:3000/GuardiasCSI/#/login"); // Cambia el puerto si Vite usa el 5173

  // 2. Llenar el formulario con datos falsos
  await page.fill('input[type="email"]', "hacker@falso.com");
  await page.fill('input[type="password"]', "ClaveEquivocada123");

  // 3. Hacer clic en el botón de iniciar sesión
  await page.click('button[type="submit"]');

  // 4. El robot ESPERA que aparezca el mensaje de error de Firebase
  // Nota: Asegúrate de que el texto coincida con el error real que muestra tu app
  const errorMessage = page.locator('.error-message, [role="alert"]');
  await expect(errorMessage).toBeVisible();
});

// Prueba 2: Validar el acceso correcto y el RBAC
test("HU-1.2: Login exitoso y redirección de guardia", async ({ page }) => {
  await page.goto("http://localhost:3000/GuardiasCSI/#/login");

  // 1. Ingresar tus credenciales reales (Cambia esto por tu usuario de prueba)
  await page.fill('input[type="email"]', "brian@gmail.com");
  await page.fill('input[type="password"]', "mancha2026"); // ¡Pon tu clave real local!

  // 2. Hacer clic en ingresar
  await page.click('button[type="submit"]');

  // 3. El robot ESPERA ser redirigido a la página de inicio (Panel del Guardia o Admin)
  // Verifica que la URL haya cambiado de /login a la ruta protegida
  await page.waitForURL("**/dashboard"); // Cambia '/dashboard' por la ruta inicial de tu app (ej: '/map' o '/rondas')

  // 4. Verifica que el panel cargó buscando un elemento clave en pantalla
  const welcomeText = page.locator("text=Brian Ayardo"); // Busca tu nombre en pantalla
  await expect(welcomeText).toBeVisible({ timeout: 10000 });
});
