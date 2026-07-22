import { useAnnouncerStore } from '@/components/a11y/LiveAnnouncer';
import { ReunionStepper, type StepDef } from '@/components/reunions/ReunionStepper';
import { StepConfirmation } from '@/components/reunions/steps/StepConfirmation';
import { StepInfos, StepNav } from '@/components/reunions/steps/StepInfos';
import { StepOrdreJour } from '@/components/reunions/steps/StepOrdreJour';
import { StepParticipants } from '@/components/reunions/steps/StepParticipants';
import { Button } from '@/components/ui/Button';
import { clearDraft, loadDraft, saveDraft } from '@/lib/reunion-draft';
import {
  creerReunion,
  gererOrdreJour,
  gererParticipants,
  listerDirections,
  listerModeles,
  listerProfils,
  modifierReunion,
  obtenirReunion,
} from '@/lib/reunions-api';
import {
  etapeInfosSchema,
  fromDatePrevueISO,
  REUNION_FORM_DEFAULTS,
  reunionFormSchema,
  toDatePrevueISO,
  type ReunionFormValues,
} from '@/schemas/reunion-form.schema';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

const STEPS: StepDef[] = [
  { id: 1, label: 'Informations', description: '' },
  { id: 2, label: 'Participants', description: '' },
  { id: 3, label: 'Ordre du jour', description: '' },
  { id: 4, label: 'Confirmation', description: '' },
];

type Props = {
  mode: 'create' | 'edit';
  reunionId?: string;
};

export function ReunionFormWizard({ mode, reunionId }: Props) {
  const navigate = useNavigate();
  const announce = useAnnouncerStore((s) => s.announce);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [ready, setReady] = useState(mode === 'create');

  const form = useForm<ReunionFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(reunionFormSchema) as any,
    defaultValues: REUNION_FORM_DEFAULTS,
    mode: 'onChange',
  });

  const { register, handleSubmit, watch, setValue, reset, trigger, formState } = form;

  const directionsQuery = useQuery({
    queryKey: ['directions'],
    queryFn: listerDirections,
  });
  const profilsQuery = useQuery({
    queryKey: ['profils', 'form-reunion'],
    queryFn: () => listerProfils({ limite: 100 }),
  });
  const modelesQuery = useQuery({
    queryKey: ['modeles-cr'],
    queryFn: listerModeles,
  });

  // Chargement édition + brouillon
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (mode === 'edit' && reunionId) {
        const draft = loadDraft(reunionId);
        if (draft) {
          if (!cancelled) {
            reset(draft);
            setReady(true);
          }
          return;
        }
        try {
          const detail = await obtenirReunion(reunionId);
          if (cancelled) return;
          const { date, heure } = fromDatePrevueISO(detail.date_prevue);
          reset({
            titre: detail.titre,
            description: detail.description ?? '',
            type_reunion: detail.type_reunion,
            date,
            heure,
            lieu: detail.lieu ?? '',
            direction_id: detail.direction_id ?? '',
            modele_id: detail.modele_id ?? '',
            participants: detail.participants.map((p) => ({
              profil_id: p.profil_id,
              prenom: 'Participant',
              nom: '',
              email: '',
            })),
            points: detail.points_ordre_jour.map((p) => ({
              id: p.id,
              titre: p.titre,
              description: p.description ?? '',
              duree_minutes: p.duree_minutes,
            })),
          });
          // Enrichir noms participants depuis annuaire si disponible
          setReady(true);
        } catch (err) {
          if (!cancelled) {
            setSubmitError(
              err instanceof Error ? err.message : 'Impossible de charger la réunion.',
            );
            setReady(true);
          }
        }
        return;
      }

      const draft = loadDraft();
      if (draft && !cancelled) {
        reset(draft);
      }
      if (!cancelled) setReady(true);
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [mode, reunionId, reset]);

  // Enrichir prenom/nom des participants quand profils chargés (mode edit)
  useEffect(() => {
    const profils = profilsQuery.data?.items;
    if (!profils || mode !== 'edit') return;
    const current = watch('participants');
    if (current.length === 0) return;
    const enriched = current.map((p) => {
      const found = profils.find((x) => x.id === p.profil_id);
      if (!found) return p;
      return {
        ...p,
        prenom: found.prenom,
        nom: found.nom,
        email: found.email,
      };
    });
    setValue('participants', enriched);
  }, [profilsQuery.data, mode, setValue, watch]);

  // Auto-sauvegarde brouillon
  useEffect(() => {
    if (!ready) return;
    const sub = watch((values) => {
      saveDraft(values as ReunionFormValues, reunionId);
      setDraftSavedAt(new Date().toLocaleTimeString('fr-FR'));
    });
    return () => sub.unsubscribe();
  }, [watch, ready, reunionId]);

  async function goNext() {
    if (step === 0) {
      const ok = await trigger(['titre', 'type_reunion', 'date', 'heure']);
      // validation partielle infos
      const parsed = etapeInfosSchema.safeParse(watch());
      if (!ok || !parsed.success) {
        announce('Veuillez corriger les informations générales.');
        return;
      }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function onSubmit(values: ReunionFormValues) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = {
        titre: values.titre,
        description: values.description || null,
        type_reunion: values.type_reunion,
        date_prevue: toDatePrevueISO(values.date, values.heure),
        lieu: values.lieu || null,
        direction_id: values.direction_id || null,
        modele_id: values.modele_id || null,
      };

      let id = reunionId;
      if (mode === 'create') {
        const created = await creerReunion(payload);
        id = created.id;
      } else if (reunionId) {
        await modifierReunion(reunionId, payload);
      }

      if (!id) throw new Error('Identifiant réunion manquant.');

      await gererParticipants(
        id,
        values.participants.map((p) => ({
          profil_id: p.profil_id,
          statut: 'invite',
        })),
      );

      await gererOrdreJour(
        id,
        values.points.map((p, index) => ({
          titre: p.titre,
          description: p.description || null,
          ordre: index,
          duree_minutes: p.duree_minutes ?? null,
        })),
      );

      clearDraft(reunionId);
      if (mode === 'create') clearDraft();

      announce(
        mode === 'create'
          ? 'Réunion créée. Les participants ont été notifiés.'
          : 'Réunion mise à jour.',
      );
      navigate(`/reunions/${id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Enregistrement impossible.';
      setSubmitError(message);
      announce(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) {
    return (
      <div className="rounded-xl border border-border bg-surface p-10 text-center text-text-muted">
        Chargement du formulaire…
      </div>
    );
  }

  return (
    <form
      className="space-y-6"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      aria-label={mode === 'create' ? 'Créer une réunion' : 'Modifier une réunion'}
    >
      <ReunionStepper steps={STEPS} current={step} onStepClick={setStep} />

      <div className="flex items-center justify-between gap-3 text-xs text-text-muted">
        <span>
          {draftSavedAt
            ? `Brouillon enregistré à ${draftSavedAt}`
            : 'Le brouillon sera sauvegardé automatiquement'}
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            saveDraft(watch(), reunionId);
            setDraftSavedAt(new Date().toLocaleTimeString('fr-FR'));
            announce('Brouillon sauvegardé.');
          }}
        >
          <Save className="h-4 w-4" aria-hidden />
          Sauver brouillon
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.25 }}
          >
            {step === 0 && (
              <StepInfos
                register={register}
                errors={formState.errors}
                directions={directionsQuery.data ?? []}
              />
            )}
            {step === 1 && (
              <StepParticipants
                profils={profilsQuery.data?.items ?? []}
                watch={watch}
                setValue={setValue}
              />
            )}
            {step === 2 && <StepOrdreJour watch={watch} setValue={setValue} />}
            {step === 3 && (
              <StepConfirmation
                watch={watch}
                register={register}
                directions={directionsQuery.data ?? []}
                modeles={modelesQuery.data ?? []}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {submitError && (
          <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
            {submitError}
          </p>
        )}

        {step < 3 ? (
          <div className="mt-6">
            <StepNav
              onNext={() => void goNext()}
              onBack={step > 0 ? () => setStep((s) => s - 1) : undefined}
            />
          </div>
        ) : (
          <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={() => setStep(2)}>
              Retour
            </Button>
            <Button type="submit" loading={submitting}>
              {mode === 'create' ? 'Créer la réunion' : 'Enregistrer les modifications'}
            </Button>
          </div>
        )}
      </div>
    </form>
  );
}
