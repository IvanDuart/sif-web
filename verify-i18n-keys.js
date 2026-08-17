const fs = require('fs');

// Read help-content.ts and extract all i18n keys
const contentFile = fs.readFileSync('src/app/features/help/content/help-content.ts', 'utf8');

// Extract all titleKey and descKey values
const titleKeyMatches = contentFile.match(/titleKey:\s*['"]([^'"]+)['"]/g) || [];
const descKeyMatches = contentFile.match(/descKey:\s*['"]([^'"]+)['"]/g) || [];
const stepMatches = contentFile.match(/steps:\s*\[[\s\S]*?\]/g) || [];

const titleKeys = new Set(titleKeyMatches.map(m => m.replace(/titleKey:\s*['"]|['"]/g, '')));
const descKeys = new Set(descKeyMatches.map(m => m.replace(/descKey:\s*['"]|['"]/g, '')));

// Extract step keys
const stepKeys = new Set();
stepMatches.forEach(match => {
  const steps = match.match(/['"]([^'"]+step[^'"]*)['"]/g) || [];
  steps.forEach(step => {
    stepKeys.add(step.replace(/['"]/g, ''));
  });
});

// Read i18n files
const es = JSON.parse(fs.readFileSync('src/assets/i18n/es.json', 'utf8'));

// Helper to check if key exists in nested object
function keyExists(obj, keyPath) {
  const parts = keyPath.split('.');
  let current = obj;
  for (const part of parts) {
    if (current[part] === undefined) return false;
    current = current[part];
  }
  return true;
}

// Check all keys
console.log('=== CHECKING i18n KEY COVERAGE ===\n');

let missing = 0;
let found = 0;
const missingKeys = [];

titleKeys.forEach(key => {
  if (keyExists(es, key)) {
    found++;
  } else {
    missingKeys.push(key);
    missing++;
  }
});

descKeys.forEach(key => {
  if (keyExists(es, key)) {
    found++;
  } else {
    missingKeys.push(key);
    missing++;
  }
});

stepKeys.forEach(key => {
  if (keyExists(es, key)) {
    found++;
  } else {
    missingKeys.push(key);
    missing++;
  }
});

console.log(`=== SUMMARY ===`);
console.log(`✅ Found keys: ${found}`);
console.log(`❌ Missing keys: ${missing}`);
console.log(`📊 Total sections: 16`);
console.log(`📊 Total topics: 62`);
console.log(`📊 Total expected keys: ~${found + missing}`);

if (missingKeys.length > 0) {
  console.log(`\n❌ Missing keys:`);
  missingKeys.forEach(k => console.log(`   - ${k}`));
}

if (missing === 0) {
  console.log('\n🎉 ALL KEYS PRESENT - i18n structure complete!');
  process.exit(0);
} else {
  console.log(`\n⚠️  ${missing} keys missing - needs fixing`);
  process.exit(1);
}
