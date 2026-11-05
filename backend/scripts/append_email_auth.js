const fs = require('fs');
let s = fs.readFileSync('src/services/auth.service.ts', 'utf8');

const codeToAppend = `
// ─── EMAIL + PASSWORD + OTP AUTHENTICATION ────────────────────────────────

export interface SendEmailOtpInput {
  tenantId: string;
  email: string;
  password?: string;
  name?: string;
  type: 'LOGIN' | 'REGISTER';
}

export interface VerifyEmailOtpInput {
  tenantId: string;
  email: string;
  code: string;
  password?: string;
  name?: string;
  deviceId?: string;
  type: 'LOGIN' | 'REGISTER';
}

/** Step 1: Validates credentials and sends a 6-digit verification code to the email. */
export async function sendEmailOtp(
  data: SendEmailOtpInput,
): Promise<{ message: string; email: string; debugOtp?: string }> {
  await assertTenantActive(data.tenantId);

  const tenant = await prisma.tenant.findUnique({
    where: { id: data.tenantId },
    select: { allowEmailAuth: true, brandName: true },
  });
  if (tenant?.allowEmailAuth === false) {
    throw ApiError.forbidden('Email authentication is currently disabled by administrator');
  }

  const normalizedEmail = data.email.toLowerCase().trim();

  if (data.type === 'REGISTER') {
    if (!data.password || data.password.length < 6) {
      throw ApiError.badRequest('Password must be at least 6 characters long');
    }
    const existing = await prisma.user.findFirst({
      where: { tenantId: data.tenantId, email: normalizedEmail },
    });
    if (existing) {
      throw ApiError.conflict('An account with this email already exists. Please login instead.');
    }
  } else {
    // LOGIN
    if (!data.password) {
      throw ApiError.badRequest('Password is required');
    }
    const user = await prisma.user.findFirst({
      where: { tenantId: data.tenantId, email: normalizedEmail },
    });
    if (!user || !user.passwordHash) {
      throw ApiError.unauthorized('Invalid email or password');
    }
    if (user.isBanned) {
      throw ApiError.forbidden('Your account has been banned');
    }
    const valid = verifyPassword(data.password, user.passwordHash);
    if (!valid) {
      throw ApiError.unauthorized('Invalid email or password');
    }
  }

  // Generate 6-digit random code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Delete previous OTPs for this email in this tenant
  await prisma.emailOtp.deleteMany({
    where: { tenantId: data.tenantId, email: normalizedEmail },
  });

  await prisma.emailOtp.create({
    data: {
      tenantId: data.tenantId,
      email: normalizedEmail,
      code,
      type: data.type,
      expiresAt,
    },
  });

  console.log(\`📧 [EMAIL OTP] Brand: \${tenant?.brandName} | To: \${normalizedEmail} | Type: \${data.type} | OTP: \${code}\`);

  return {
    message: \`6-digit verification code sent to \${normalizedEmail}\`,
    email: normalizedEmail,
    debugOtp: process.env.NODE_ENV !== 'production' ? code : undefined,
  };
}

/** Step 2: Verifies the 6-digit OTP code and creates or logs into the account. */
export async function verifyEmailOtp(
  data: VerifyEmailOtpInput,
): Promise<{ user: ReturnType<typeof sanitizeUser>; token: string }> {
  await assertTenantActive(data.tenantId);

  const tenant = await prisma.tenant.findUnique({
    where: { id: data.tenantId },
    select: { allowEmailAuth: true },
  });
  if (tenant?.allowEmailAuth === false) {
    throw ApiError.forbidden('Email authentication is currently disabled by administrator');
  }

  const normalizedEmail = data.email.toLowerCase().trim();
  const now = new Date();

  const otp = await prisma.emailOtp.findFirst({
    where: {
      tenantId: data.tenantId,
      email: normalizedEmail,
      code: data.code.trim(),
      expiresAt: { gt: now },
    },
  });

  if (!otp) {
    throw ApiError.badRequest('Invalid or expired verification code');
  }

  // Delete the used OTP
  await prisma.emailOtp.delete({ where: { id: otp.id } });

  let user = await prisma.user.findFirst({
    where: { tenantId: data.tenantId, email: normalizedEmail },
  });

  if (data.type === 'REGISTER') {
    if (user) {
      throw ApiError.conflict('User already exists with this email');
    }
    if (!data.password || data.password.length < 6) {
      throw ApiError.badRequest('Password must be at least 6 characters');
    }

    const deviceId = await assertDeviceFree(data.tenantId, data.deviceId);
    const passwordHash = hashPassword(data.password);
    const placeholderPhone = \`E\${Date.now().toString().slice(-9)}\`;

    user = await prisma.user.create({
      data: {
        tenantId: data.tenantId,
        email: normalizedEmail,
        phoneNumber: placeholderPhone,
        passwordHash,
        name: data.name?.trim() || 'Gamer',
        deviceId,
        role: 'USER',
      },
    });
  } else {
    // LOGIN
    if (!user) {
      throw ApiError.notFound('Account not found');
    }
    if (user.isBanned) {
      throw ApiError.forbidden('Your account has been banned');
    }
  }

  const token = generateToken({ userId: user.id, tenantId: user.tenantId, role: user.role });
  return { user: sanitizeUser(user), token };
}
`;

s += codeToAppend;
fs.writeFileSync('src/services/auth.service.ts', s, 'utf8');
console.log('Email auth functions appended successfully!');
