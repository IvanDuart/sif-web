const fs = require('fs');
const path = require('path');

function replaceInDir(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            replaceInDir(fullPath);
        } else if (fullPath.endsWith('.mjs')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('ChangeDetectionStrategy.Eager')) {
                content = content.replace(/ChangeDetectionStrategy\.Eager/g, 'ChangeDetectionStrategy.Default');
                fs.writeFileSync(fullPath, content);
                console.log('Patched: ' + fullPath);
            }
        }
    }
}

const targetDir = path.resolve(__dirname, '../node_modules/primeng/fesm2022');
replaceInDir(targetDir);
console.log('PrimeNG patch complete.');
