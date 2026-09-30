// Guest capacity per plan. Must match Event::PLANS in app/Models/Event.php.
// 'custom' has no fixed cap: max_guests is set by hand.
export const PLANS = [
    { id: 'initial', label: 'Plan Inicial', emoji: '⭐', maxGuests: 100 },
    { id: 'medium', label: 'Plan Medio', emoji: '🚀', maxGuests: 150 },
    { id: 'pro', label: 'Plan Pro', emoji: '💎', maxGuests: 180 },
    { id: 'premium', label: 'Plan Premium', emoji: '👑', maxGuests: 300 },
    { id: 'custom', label: 'Personalizado', emoji: '✨', maxGuests: null },
];

export const getPlan = (planType) => PLANS.find(p => p.id === planType) || PLANS[0];

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
