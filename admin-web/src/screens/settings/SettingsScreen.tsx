import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, Save, Settings2 } from 'lucide-react';
import { ApiError, api } from '../../lib/api';
import { useToast } from '../../components/common/Toast';
import { GlassCard } from '../../components/common/GlassCard';
import { SectionHeader } from '../../components/common/SectionHeader';
import { AppButton } from '../../components/common/AppButton';
import { LoadingState } from '../../components/common/LoadingState';
import { Field, InfoNote, InlineError, TextInput, Toggle } from '../matches/MatchFormBits';
import type { TenantSettings } from '../../types';

type Draft = {
  upiId: string;
  upiName: string;
  supportWhatsapp: string;
  minDeposit: string;
  allowPhoneAuth: boolean;
  allowGoogleAuth: boolean;
  allowEmailAuth: boolean;
};

function toDraft(settings: TenantSettings): Draft {
  return {
    upiId: settings.upiId,
    upiName: settings.upiName,
    supportWhatsapp: settings.supportWhatsapp,
    minDeposit: String(settings.minDeposit),
    allowPhoneAuth: settings.allowPhoneAuth,
    allowGoogleAuth: settings.allowGoogleAuth,
    allowEmailAuth: settings.allowEmailAuth,
  };
}

export function SettingsScreen() {
  const toast = useToast();

  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await api.settings.get();
      setSettings(data);
      setDraft(toDraft(data));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setFormError('');
  };

  const save = async () => {
    if (!draft || saving) return;
    const minDeposit = Number(draft.minDeposit);
    if (!/^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(draft.upiId.trim())) {
      setFormError('UPI ID must look like name@bank (e.g. thunderesports@okaxis).');
      return;
    }
    if (draft.upiName.trim().length < 2) {
      setFormError('Payee name must be at least 2 characters.');
      return;
    }
    if (draft.supportWhatsapp && !/^\+?\d{10,15}$/.test(draft.supportWhatsapp.trim())) {
      setFormError('Support WhatsApp must be a 10–15 digit number.');
      return;
    }
    if (!Number.isInteger(minDeposit) || minDeposit < 1 || minDeposit > 100000) {
      setFormError('Minimum deposit must be a whole number between ₹1 and ₹1,00,000.');
      return;
    }
    if (!draft.allowPhoneAuth && !draft.allowGoogleAuth && !draft.allowEmailAuth) {
      setFormError('At least one login method must stay on, otherwise nobody can sign in.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const saved = await api.settings.update({
        upiId: draft.upiId.trim(),
        upiName: draft.upiName.trim(),
        supportWhatsapp: draft.supportWhatsapp.trim(),
        minDeposit,
        allowPhoneAuth: draft.allowPhoneAuth,
        allowGoogleAuth: draft.allowGoogleAuth,
        allowEmailAuth: draft.allowEmailAuth,
      });
      setSettings(saved);
      setDraft(toDraft(saved));
      toast.success('Settings saved — live in the Player app immediately');
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save the settings');
    } finally {
      setSaving(false);
    }
  };

  const dirty =
    Boolean(settings && draft) &&
    JSON.stringify(draft) !== JSON.stringify(toDraft(settings as TenantSettings));

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Owner controls"
        title="App Settings"
        subtitle="UPI collecting account, support number, minimum Add Cash and player login methods."
        action={
          <AppButton
            variant="secondary"
            size="sm"
            icon={<RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />}
            disabled={loading || saving}
            onClick={() => void load()}
          >
            Refresh
          </AppButton>
        }
      />

      {error && <InlineError>{error}</InlineError>}

      {loading || !draft || !settings ? (
        <LoadingState label="Loading settings…" />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <GlassCard className="p-4">
            <SectionHeader title="Collections" subtitle="Where players send Add Cash money." />
            <div className="mt-3 space-y-3">
              <Field label="UPI ID" hint="Read by the player Add Cash screen; no app rebuild needed.">
                <TextInput
                  value={draft.upiId}
                  onChange={(e) => update('upiId', e.target.value.trim().slice(0, 320))}
                  placeholder="thunderesports@okaxis"
                />
              </Field>
              <Field label="Payee name" hint="Shown next to the UPI ID in the player app.">
                <TextInput
                  value={draft.upiName}
                  onChange={(e) => update('upiName', e.target.value.slice(0, 60))}
                  placeholder="Thunder Esports"
                />
              </Field>
              <Field label="Minimum deposit (₹)" hint="Applies to new Add Cash requests instantly.">
                <TextInput
                  inputMode="numeric"
                  value={draft.minDeposit}
                  onChange={(e) => update('minDeposit', e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="50"
                />
              </Field>
            </div>
          </GlassCard>

          <GlassCard className="p-4">
            <SectionHeader title="Support & sign-in" subtitle="WhatsApp help line and the login methods." />
            <div className="mt-3 space-y-3">
              <Field label="Support WhatsApp" hint="10–15 digits with country code (e.g. 919876543210).">
                <TextInput
                  inputMode="tel"
                  value={draft.supportWhatsapp}
                  onChange={(e) => update('supportWhatsapp', e.target.value.replace(/[^\d+]/g, '').slice(0, 15))}
                  placeholder="919876543210"
                />
              </Field>

              <div>
                <p className="mb-1.5 text-[9px] font-black uppercase tracking-wider text-slate-500">
                  Login methods (at least one)
                </p>
                <div className="space-y-1.5">
                  <Toggle
                    checked={draft.allowPhoneAuth}
                    onChange={(value) => update('allowPhoneAuth', value)}
                    label="Phone OTP"
                    hint="Player signs in with a phone number."
                  />
                  <Toggle
                    checked={draft.allowGoogleAuth}
                    onChange={(value) => update('allowGoogleAuth', value)}
                    label="Google"
                    hint="Google sign-in in the player app."
                  />
                  <Toggle
                    checked={draft.allowEmailAuth}
                    onChange={(value) => update('allowEmailAuth', value)}
                    label="Email OTP"
                    hint="Player signs in with an email address."
                  />
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard flat className="p-4 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <Settings2 className="h-3.5 w-3.5" />
                Brand <b className="text-slate-700 dark:text-slate-200">{settings.brandName}</b> · tenant{' '}
                <span className="font-mono text-[10px]">{api.tenantId.slice(0, 8)}…</span>
              </div>
              <div className="flex items-center gap-2">
                {dirty && <span className="text-[10.5px] font-bold text-amber-600 dark:text-amber-300">Unsaved changes</span>}
                <AppButton
                  icon={<Save className="h-4 w-4" />}
                  loading={saving}
                  disabled={!dirty}
                  onClick={() => void save()}
                >
                  Save settings
                </AppButton>
              </div>
            </div>
            {formError && (
              <div className="mt-3">
                <InlineError>{formError}</InlineError>
              </div>
            )}
            <p className="mt-3 flex items-start gap-2 text-[11px] text-slate-500">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Saving writes to the tenant row the Player app reads on next launch — UPI QR, payee
              and minimum deposit update without shipping a new APK.
            </p>
          </GlassCard>

          <div className="lg:col-span-2">
            <InfoNote>
              Owner-only screen. Staff accounts never see this route, and the server rejects the
              update without the ADMIN role.
            </InfoNote>
          </div>
        </div>
      )}
    </div>
  );
}
