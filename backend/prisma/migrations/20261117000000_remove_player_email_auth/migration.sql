-- Player email + password / OTP sign-in has been removed from the app.
-- Admin console email OTP (EmailOtp table) is unaffected and stays.
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "allowEmailAuth";
