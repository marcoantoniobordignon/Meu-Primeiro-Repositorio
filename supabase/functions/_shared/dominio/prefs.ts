/**
 * `profiles.prefs` (jsonb). Chaves das specs: belly_* (05), faith_mode (06),
 * notifications_* (02 RN-13 e "modo discreto"). Valor ausente = padrão.
 */
export interface Prefs {
  belly_ghost_opacity?: number;
  belly_grid?: boolean;
  belly_reminders?: boolean;
  /** RN-05: semana em que ela tocou "Retomar as fotos?" (a pausa recomeça a contar dali). */
  belly_resumed_week?: number | null;
  faith_mode?: boolean;
  /** Funcionalidade 17 RN-08: a oração da semana no aviso da virada (padrão desligado). */
  faith_weekly_push?: boolean;
  /** Funcionalidade 16 RN-03: cartões de direitos dispensados da home (slugs). */
  rights_dismissed?: string[];
  notifications_suspended?: boolean;
  notifications_discreet?: boolean;
  /** Horário silencioso da fundação, "HH:MM". */
  quiet_start?: string;
  quiet_end?: string;
  /** Funcionalidade 12 RN-08: opt-out por tipo de aviso do parceiro. */
  partner_appointment_eve?: boolean;
  partner_exam_scheduled?: boolean;
  partner_milestones?: boolean;
}

export const PREFS_PADRAO: Required<Prefs> = {
  belly_ghost_opacity: 0.35,
  belly_grid: true,
  belly_reminders: true,
  belly_resumed_week: null,
  faith_mode: false,
  faith_weekly_push: false,
  rights_dismissed: [],
  notifications_suspended: false,
  // Decisão em aberto (spec 02): discreto por padrão? Por enquanto, não.
  notifications_discreet: false,
  quiet_start: "22:00",
  quiet_end: "07:00",
  partner_appointment_eve: true,
  partner_exam_scheduled: true,
  partner_milestones: true,
};

export const OPACIDADE_FANTASMA_MAX = 0.6;

export function prefsCompletas(p: Prefs | null | undefined): Required<Prefs> {
  const r = { ...PREFS_PADRAO, ...(p ?? {}) };
  r.belly_ghost_opacity = Math.min(OPACIDADE_FANTASMA_MAX, Math.max(0, Number(r.belly_ghost_opacity) || 0));
  return r;
}
