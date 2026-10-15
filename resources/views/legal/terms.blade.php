@extends('legal.layout')

@section('title', 'Condiciones del servicio')

@section('content')
    <p>
        Estas condiciones regulan el uso de {{ config('legal.brand') }}, el sistema de invitaciones, confirmación de
        asistencia y acreditación de eventos. Al usar el sistema o responder a una invitación aceptás estas condiciones.
    </p>

    <h2>El servicio</h2>
    <ul>
        <li>Los organizadores cargan la lista de invitados de sus eventos y envían las invitaciones por WhatsApp desde el número del sistema.</li>
        <li>Los invitados confirman su asistencia, indican cuántas personas van y su menú, y reciben un pase de ingreso con código QR.</li>
        <li>El día del evento, el personal del organizador acredita el ingreso con ese código.</li>
    </ul>

    <h2>Responsabilidades del organizador</h2>
    <ul>
        <li>Cargar solo invitados que esperan recibir la invitación de ese evento, con datos correctos.</li>
        <li>Usar el sistema únicamente para los fines del evento: no para publicidad ni para mensajes no relacionados.</li>
        <li>Cuidar sus credenciales de acceso y las de su personal (anfitrionas).</li>
    </ul>

    <h2>Invitados</h2>
    <ul>
        <li>Los mensajes son sobre la invitación recibida. Podés dejar de recibirlos respondiendo que no vas a asistir o pidiéndolo por el mismo chat.</li>
        <li>El pase QR es personal de la invitación: no lo compartas con personas que no estén invitadas.</li>
    </ul>

    <h2>Disponibilidad</h2>
    <p>
        Trabajamos para que el servicio esté disponible siempre, pero puede haber interrupciones por mantenimiento o por
        servicios de terceros (como WhatsApp). En ese caso el organizador puede acreditar el ingreso de forma manual.
    </p>

    <h2>Cambios</h2>
    <p>Podemos actualizar estas condiciones; la fecha de la última versión figura al principio de esta página.</p>
@endsection
