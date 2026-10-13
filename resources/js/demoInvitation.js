// Sample data for the Digital Invitation demo (/demo/invitacion). It mimics the API response of
// /api/rsvp/{token} so GuestRsvp renders a real-looking invitation without touching the backend.
// Optional query params personalize it: n = names, f = date (aaaa-mm-dd), l = location.

const isoDaysFromNow = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
};

const formatDdMmYyyy = (iso) => iso.split('-').reverse().join('/');

export function buildDemoInvitation(searchParams = new URLSearchParams()) {
    const coupleNames = searchParams.get('n') || 'Sofía & Mateo';
    const requestedDate = searchParams.get('f');
    const eventDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate || '') && requestedDate >= isoDaysFromNow(1)
        ? requestedDate
        : isoDaysFromNow(45);
    const location = searchParams.get('l') || 'Salón Los Jazmines, Asunción';
    const deadline = new Date(`${eventDate}T00:00:00`);
    deadline.setDate(deadline.getDate() - 7);

    return {
        event: {
            public_code: 'demo',
            title: `Boda de ${coupleNames}`,
            couple_names: coupleNames,
            event_type: 'boda',
            event_date: eventDate,
            location,
            cover_photo_url: null,
            background_music_url: '/audio/wedding-acoustic.mp3',
            spotify_url: null,
            welcome_message: 'Después de tantos años juntos, llegó el día de celebrar nuestro amor rodeados de las personas que más queremos. ¡Nos encantaría que seas parte!',
            dress_code: 'elegante_sport',
            dress_code_notes: 'Te sugerimos tonos claros. Las damas pueden evitar el blanco 🤍',
            gift_settings: {
                bank_name: 'Banco de Ejemplo',
                account_holder: coupleNames,
                alias: 'boda.demo.ejemplo',
                cbu: '',
                cvu: '',
                notes: 'Tu presencia es nuestro mejor regalo. Si querés hacernos un obsequio, te dejamos estos datos (son de ejemplo).',
                external_registry_url: '',
                custom_gifts: [
                    { id: 1, title: 'Noche de luna de miel', description: 'Una cena especial en nuestro viaje', amount: 300000, icon: '🌙' },
                    { id: 2, title: 'Excursión en pareja', description: 'Una aventura para recordar', amount: 500000, icon: '🏝️' },
                ],
            },
            features_enabled: {
                spotify: true,
                gifts: true,
                music_suggestions: true,
                countdown: true,
                guest_dedications: true,
                dress_code: true,
                background_music: true,
            },
            invitation_styles: {
                primary_color: '#E11D48',
                secondary_color: '#F59E0B',
                font_family: 'serif',
            },
        },
        guest: {
            name: 'Invitado Demo',
            token: 'demo',
            status: 'pending',
            adults: 2,
            youth: 0,
            children: 1,
            passes: 3,
            confirmed_adults: 0,
            confirmed_youth: 0,
            confirmed_children: 0,
            table_number: 7,
            dietary_restrictions: '',
            notes: '',
            song_suggestion: '',
        },
        is_expired: false,
        deadline_date: formatDdMmYyyy(deadline.toISOString().slice(0, 10)),
        dedications: [
            { id: 1, type: 'text', author_name: 'Tía Marta', message: '¡Qué emoción verlos dar este paso! Les deseo toda la felicidad del mundo 💕', media_url: null },
            { id: 2, type: 'text', author_name: 'Los primos', message: 'Prepárense que vamos a romper la pista 🕺💃', media_url: null },
        ],
        song_requests: [
            { id: 1, requester_name: 'Lucía', song_title: 'Vivir Mi Vida', artist: 'Marc Anthony', image_url: null },
            { id: 2, requester_name: 'Diego', song_title: 'Thinking Out Loud', artist: 'Ed Sheeran', image_url: null },
        ],
    };
}
