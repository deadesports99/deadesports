const fs = require('fs');
let s = fs.readFileSync('src/controllers/auth.controller.ts', 'utf8');

const schemas = `
const sendEmailOtpSchema = z.object({
  tenantId: z.string().min(1, 'tenantId is required'),
  email: z.string().trim().email('Invalid email address').max(254),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  name: z.string().trim().min(2).max(80).optional(),
  type: z.enum(['LOGIN', 'REGISTER']),
});

const verifyEmailOtpSchema = z.object({
  tenantId: z.string().min(1, 'tenantId is required'),
  email: z.string().trim().email('Invalid email address').max(254),
  code: z.string().trim().length(6, 'OTP must be 6 digits'),
  password: z.string().min(6).optional(),
  name: z.string().trim().min(2).max(80).optional(),
  deviceId: z.string().trim().min(1).max(255).optional(),
  type: z.enum(['LOGIN', 'REGISTER']),
});
`;

const handlers = `
export async function sendEmailOtp(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = sendEmailOtpSchema.parse(req.body);
    const result = await authService.sendEmailOtp(body);
    sendResponse(res, 200, result.message, result);
  } catch (err) {
    next(err);
  }
}

export async function verifyEmailOtp(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = verifyEmailOtpSchema.parse(req.body);
    const result = await authService.verifyEmailOtp(body);
    sendResponse(res, 200, 'Authenticated successfully with Email OTP', result);
  } catch (err) {
    next(err);
  }
}
`;

s = s.replace('const googleAuthSchema =', schemas + '\nconst googleAuthSchema =');
s = s.replace('export async function createStaffMember(', handlers + '\nexport async function createStaffMember(');

fs.writeFileSync('src/controllers/auth.controller.ts', s, 'utf8');
console.log('auth.controller.ts updated successfully');
