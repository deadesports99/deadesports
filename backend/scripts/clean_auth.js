const fs = require('fs');
let s = fs.readFileSync('src/services/auth.service.ts', 'utf8');

const target = `  if (data.idToken) {
    const verified = await verifyFirebasePhoneToken(data.idToken);
    targetPhone = verified.national;
  }

  if (!targetPhone) {
    throw ApiError.badRequest('Phone number or Firebase idToken is required');
  }`;

// Normalize newlines to \n
s = s.replace(/\r\n/g, '\n');
const targetNorm = target.replace(/\r\n/g, '\n');

if (s.includes(targetNorm)) {
  s = s.replaceAll(targetNorm, '');
  fs.writeFileSync('src/services/auth.service.ts', s, 'utf8');
  console.log('Cleaned redundant checks successfully!');
} else {
  console.log('Target not found in normalized text');
}
