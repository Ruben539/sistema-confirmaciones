// Guest capacity and Digital Invitation per plan. Must match Event::PLANS in app/Models/Event.php.
// 'custom' has no fixed cap: max_guests is set by hand.
// Today no plan includes the Digital Invitation: it's always requested and the admin
// enables it per event as a paid add-on (event.digital_invitation_addon).
export const PLANS = [
    { id: 'initial', label: 'Plan Inicial', emoji: '⭐', maxGuests: 100, digitalInvitation: false },
    { id: 'medium', label: 'Plan Medio', emoji: '🚀', maxGuests: 150, digitalInvitation: false },
    { id: 'pro', label: 'Plan Pro', emoji: '💎', maxGuests: 180, digitalInvitation: false },
    { id: 'premium', label: 'Plan Premium', emoji: '👑', maxGuests: 300, digitalInvitation: false },
    { id: 'custom', label: 'Personalizado', emoji: '✨', maxGuests: null, digitalInvitation: false },
];

export const getPlan = (planType) => PLANS.find(p => p.id === planType) || PLANS[0];

export const planIncludesDigitalInvitation = (planType) => getPlan(planType).digitalInvitation;

// e.g. "Plan Medio (150)"; custom plans show the event's own max_guests
export const getPlanLabel = (planType, maxGuests = null, { emoji = false } = {}) => {
    const plan = getPlan(planType);
    const max = plan.maxGuests ?? maxGuests;
    const text = max ? `${plan.label} (${max})` : plan.label;
    return emoji ? `${plan.emoji} ${text}` : text;
};

// Plans shown as "Hasta N invitados" options, including the range they cover
export const getPlanRangeLabel = (plan) => {
    const idx = PLANS.indexOf(plan);
    if (plan.maxGuests === null) return 'Cantidad a medida';
    const from = idx > 0 ? PLANS[idx - 1].maxGuests + 1 : 1;
    return `${from} a ${plan.maxGuests} invitados`;
};
