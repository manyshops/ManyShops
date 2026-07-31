'use client';

import { ArrowLeft, Banknote, TriangleAlert } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { isValidLebanesePhone, LEBANON_REGIONS } from '@/lib/phone';
import { formatUsd } from '@/lib/pricing';
import type { Quote } from '@/lib/quote-types';

export type CheckoutValues = {
  fullName: string;
  phone: string;
  region: string;
  address: string;
  landmark: string;
  note: string;
};

type Props = {
  quote: Quote;
  busy: boolean;
  submitError: string | null;
  onSubmit: (values: CheckoutValues) => void;
  onBack: () => void;
};

const EMPTY: CheckoutValues = {
  fullName: '',
  phone: '',
  region: '',
  address: '',
  landmark: '',
  note: ''
};

type FieldErrors = Partial<Record<keyof CheckoutValues, string>>;

export function CheckoutPanel({
  quote,
  busy,
  submitError,
  onSubmit,
  onBack
}: Props) {
  const t = useTranslations('checkout');
  const locale = useLocale();
  const [values, setValues] = useState<CheckoutValues>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});

  function update<K extends keyof CheckoutValues>(key: K, value: string) {
    setValues((previous) => ({ ...previous, [key]: value }));
    if (errors[key]) {
      setErrors((previous) => ({ ...previous, [key]: undefined }));
    }
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (values.fullName.trim().length < 2) {
      next.fullName = t('validation.fullName');
    }
    if (!isValidLebanesePhone(values.phone)) {
      next.phone = t('validation.phone');
    }
    if (!values.region) {
      next.region = t('validation.region');
    }
    if (values.address.trim().length < 8) {
      next.address = t('validation.address');
    }
    return next;
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const first = document.getElementById(
        `checkout-${Object.keys(found)[0]}`
      );
      first?.focus();
      return;
    }
    onSubmit(values);
  }

  const fieldClass = (invalid: boolean) =>
    `w-full rounded-2xl border bg-white px-4 py-3.5 text-base text-navy-900 shadow-sm outline-none transition-colors placeholder:text-navy-800/35 focus:border-teal-500 ${
      invalid ? 'border-coral-500' : 'border-navy-900/12'
    }`;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-6 sm:p-9" noValidate>
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-teal-500">
          {t('eyebrow')}
        </p>
        <h2 className="mt-1 text-2xl font-bold text-navy-900">{t('title')}</h2>
        <p className="mt-3 flex items-start gap-2 rounded-2xl bg-teal-100/60 px-4 py-3 text-sm font-medium leading-relaxed text-navy-800">
          <Banknote aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-teal-500" />
          {t('subtitle', {
            amount: formatUsd(quote.breakdown.totalUsd, locale)
          })}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="checkout-fullName"
          label={t('fields.fullName')}
          error={errors.fullName}
          className="sm:col-span-2"
        >
          <input
            id="checkout-fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            required
            value={values.fullName}
            onChange={(event) => update('fullName', event.target.value)}
            placeholder={t('fields.fullNamePlaceholder')}
            aria-invalid={errors.fullName ? 'true' : undefined}
            aria-describedby={errors.fullName ? 'checkout-fullName-error' : undefined}
            className={fieldClass(Boolean(errors.fullName))}
          />
        </Field>

        <Field
          id="checkout-phone"
          label={t('fields.phone')}
          error={errors.phone}
          hint={t('fields.phoneHint')}
        >
          <input
            id="checkout-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            dir="ltr"
            autoComplete="tel"
            required
            value={values.phone}
            onChange={(event) => update('phone', event.target.value)}
            placeholder={t('fields.phonePlaceholder')}
            aria-invalid={errors.phone ? 'true' : undefined}
            aria-describedby={
              errors.phone ? 'checkout-phone-error' : 'checkout-phone-hint'
            }
            className={`${fieldClass(Boolean(errors.phone))} numeric`}
          />
        </Field>

        <Field id="checkout-region" label={t('fields.region')} error={errors.region}>
          <select
            id="checkout-region"
            name="region"
            required
            value={values.region}
            onChange={(event) => update('region', event.target.value)}
            aria-invalid={errors.region ? 'true' : undefined}
            aria-describedby={errors.region ? 'checkout-region-error' : undefined}
            className={fieldClass(Boolean(errors.region))}
          >
            <option value="" disabled>
              {t('fields.regionPlaceholder')}
            </option>
            {LEBANON_REGIONS.map((region) => (
              <option key={region} value={region}>
                {t(`regions.${region}`)}
              </option>
            ))}
          </select>
        </Field>

        <Field
          id="checkout-address"
          label={t('fields.address')}
          error={errors.address}
          className="sm:col-span-2"
        >
          <textarea
            id="checkout-address"
            name="address"
            rows={3}
            autoComplete="street-address"
            required
            value={values.address}
            onChange={(event) => update('address', event.target.value)}
            placeholder={t('fields.addressPlaceholder')}
            aria-invalid={errors.address ? 'true' : undefined}
            aria-describedby={errors.address ? 'checkout-address-error' : undefined}
            className={`${fieldClass(Boolean(errors.address))} resize-y`}
          />
        </Field>

        <Field id="checkout-landmark" label={t('fields.landmark')}>
          <input
            id="checkout-landmark"
            name="landmark"
            type="text"
            value={values.landmark}
            onChange={(event) => update('landmark', event.target.value)}
            placeholder={t('fields.landmarkPlaceholder')}
            className={fieldClass(false)}
          />
        </Field>

        <Field id="checkout-note" label={t('fields.note')}>
          <input
            id="checkout-note"
            name="note"
            type="text"
            value={values.note}
            onChange={(event) => update('note', event.target.value)}
            placeholder={t('fields.notePlaceholder')}
            className={fieldClass(false)}
          />
        </Field>
      </div>

      {submitError && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-2xl bg-coral-100 px-4 py-3 text-sm font-medium text-coral-600"
        >
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {submitError}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-2xl border border-navy-900/12 px-5 py-4 text-sm font-semibold text-navy-800 transition-colors hover:bg-sand-100 disabled:opacity-45"
        >
          <ArrowLeft aria-hidden="true" className="size-4 rtl:rotate-180" />
          {t('back')}
        </button>
        <button
          type="submit"
          disabled={busy}
          className="flex-1 rounded-2xl bg-coral-500 px-6 py-4 text-base font-bold text-white shadow-xl shadow-coral-500/30 transition-all hover:-translate-y-0.5 hover:bg-coral-400 disabled:translate-y-0 disabled:opacity-55"
        >
          {busy ? t('submitting') : t('submit')}
        </button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  className,
  children
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className ?? ''}`}>
      <label htmlFor={id} className="text-sm font-semibold text-navy-900">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-coral-600">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-xs text-navy-800/55">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
