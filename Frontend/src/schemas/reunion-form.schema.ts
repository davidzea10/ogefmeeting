import { TYPES_REUNION } from '@ogefmeeting/shared';
import { z } from 'zod';

export const etapeInfosSchema = z.object({
  titre: z.string().trim().min(3, 'Le titre doit contenir au moins 3 caractères.'),
  description: z.string().trim().optional().or(z.literal('')),
  type_reunion: z.enum(TYPES_REUNION),
  date: z.string().min(1, 'La date est requise.'),
  heure: z.string().min(1, 'L’heure est requise.'),
  lieu: z.string().trim().optional().or(z.literal('')),
  direction_id: z.string().uuid().optional().or(z.literal('')),
});

export const participantDraftSchema = z.object({
  profil_id: z.string().uuid(),
  prenom: z.string(),
  nom: z.string(),
  email: z.string().optional(),
});

export const pointDraftSchema = z.object({
  id: z.string(),
  titre: z.string().trim().min(2, 'Titre trop court.'),
  description: z.string().trim().optional().or(z.literal('')),
  duree_minutes: z
    .number()
    .int()
    .min(1)
    .nullable()
    .optional()
    .or(z.nan().transform(() => null)),
});

export const etapeParticipantsSchema = z.object({
  participants: z.array(participantDraftSchema),
});

export const etapeOrdreJourSchema = z.object({
  points: z.array(pointDraftSchema),
});

export const etapeConfirmationSchema = z.object({
  modele_id: z.string().uuid().optional().or(z.literal('')),
});

export const reunionFormSchema = etapeInfosSchema
  .merge(etapeParticipantsSchema)
  .merge(etapeOrdreJourSchema)
  .merge(etapeConfirmationSchema);

export type ReunionFormValues = z.infer<typeof reunionFormSchema>;

export const REUNION_FORM_DEFAULTS: ReunionFormValues = {
  titre: '',
  description: '',
  type_reunion: 'autre',
  date: '',
  heure: '09:00',
  lieu: '',
  direction_id: '',
  participants: [],
  points: [],
  modele_id: '',
};

/** Combine date + heure locales → ISO UTC */
export function toDatePrevueISO(date: string, heure: string): string {
  const local = new Date(`${date}T${heure}:00`);
  if (Number.isNaN(local.getTime())) {
    throw new Error('Date ou heure invalide.');
  }
  return local.toISOString();
}

export function fromDatePrevueISO(iso: string): { date: string; heure: string } {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    heure: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}
