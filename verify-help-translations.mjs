import { chromium } from 'playwright';

async function verifyTranslations() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('Navigating to Help page...');
    await page.goto('http://localhost:4200/help', { waitUntil: 'networkidle', timeout: 10000 });
    
    // Wait for content to render
    await page.waitForLoadState('networkidle');
    
    console.log('\n=== Checking Spanish Translations ===');
    // Check for specific translated elements
    const content = await page.content();
    
    // Search for key translations
    const checks = [
      { key: 'Centro de Ayuda', label: 'Spanish title' },
      { key: 'Acceso y Contraseña', label: 'Spanish section: Access' },
      { key: 'Iniciar Sesión', label: 'Spanish topic: Log In' }
    ];
    
    checks.forEach(check => {
      const found = content.includes(check.key);
      const status = found ? '✅' : '❌';
      console.log(`${status} ${check.label}: "${check.key}"`);
    });
    
    // Check that raw keys are NOT present
    const rawKeyCheck = content.includes('help.topics');
    if (!rawKeyCheck) {
      console.log('✅ No untranslated raw keys found');
    } else {
      console.log('⚠️  Some untranslated keys may be present');
    }
    
    console.log('\n✅ Translation verification complete');
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.message.includes('net::ERR_CONNECTION_REFUSED')) {
      console.log('\n⚠️  Dev server not running. Start it with: npm start');
    }
  } finally {
    await browser.close();
  }
}

verifyTranslations();
