import fs from 'fs';
import path from 'path';

const html = fs.readFileSync('watch-point-landing/index.html', 'utf8');
const regex = /(src|href)="([^"]+)"/g;
let match;
const missing = [];
while ((match = regex.exec(html)) !== null) {
  const url = match[2];
  if (url.startsWith('http') || url.startsWith('#') || url.startsWith('tel:') || url.startsWith('mailto:')) continue;
  const filePath = path.join('watch-point-landing', url.split('?')[0]);
  if (!fs.existsSync(filePath)) {
    missing.push(url);
  }
}
console.log('Missing files:', missing.length === 0 ? 'None! All files exist!' : missing);
