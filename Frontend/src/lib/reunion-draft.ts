import type { ReunionFormValues } from '@/schemas/reunion-form.schema';
import { REUNION_FORM_DEFAULTS } from '@/schemas/reunion-form.schema';

const PREFIX = 'ogefmeeting-brouillon-reunion';

export function draftKey(reunionId?: string) {
  return reunionId ? `${PREFIX}-${reunionId}` : `${PREFIX}-nouvelle`;
}

export function loadDraft(reunionId?: string): ReunionFormValues | null {
  try {
    const raw = localStorage.getItem(draftKey(reunionId));
    if (!raw) return null;
    return { ...REUNION_FORM_DEFAULTS, ...JSON.parse(raw) } as ReunionFormValues;
  } catch {
    return null;
  }
}

export function saveDraft(values: ReunionFormValues, reunionId?: string): void {
  try {
    localStorage.setItem(draftKey(reunionId), JSON.stringify(values));
  } catch {
    // quota / mode privé — ignorer
  }
}

export function clearDraft(reunionId?: string): void {
  try {
    localStorage.removeItem(draftKey(reunionId));
  } catch {
    // ignore
  }
}
