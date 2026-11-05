const fs = require('fs');
let s = fs.readFileSync('prisma/schema.prisma', 'utf8');
const lines = s.split(/\r?\n/);
let emailOtpCount = 0;
const newLines = [];
let skipping = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('// 7. EMAIL OTP VERIFICATION') || line.includes('model EmailOtp {')) {
    emailOtpCount++;
    if (emailOtpCount === 1) {
      skipping = true;
    }
  }

  if (skipping) {
    if (line.trim() === '}' && lines[i - 1]?.includes('@@index')) {
      skipping = false;
      continue;
    }
    continue;
  }

  newLines.push(line);
}

fs.writeFileSync('prisma/schema.prisma', newLines.join('\n'), 'utf8');
console.log('Schema fixed!');
