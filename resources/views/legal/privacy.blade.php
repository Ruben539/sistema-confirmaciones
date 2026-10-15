@extends('legal.layout')

@section('title', 'Política de privacidad')

@section('content')
    <p>
        {{ config('legal.brand') }} es un sistema que usan organizadores de eventos (wedding planners) para invitar a
        los invitados de una celebración, recibir su confirmación de asistencia y acreditar su ingreso el día del evento.
        Esta política explica qué datos se tratan, para qué y cómo pedir su eliminación.
    </p>

    <h2>Datos que tratamos</h2>
    <ul>
        <li><strong>De los invitados</strong> (cargados por los anfitriones u organizadores del evento): nombre, número de teléfono, cantidad de personas invitadas y nombres de sus acompañantes, mesa asignada, confirmación de asistencia, restricciones alimentarias que el invitado nos indique y hora de ingreso al evento.</li>
        <li><strong>Mensajes de WhatsApp</strong> que el invitado intercambia con el número del sistema sobre su invitación.</li>
        <li><strong>Contenido opcional</strong> que el invitado decida compartir: dedicatorias, fotos o sugerencias de canciones para el evento.</li>
        <li><strong>De los organizadores y su personal</strong>: nombre, correo, teléfono y datos de acceso a su cuenta.</li>
    </ul>

    <h2>Para qué los usamos</h2>
    <ul>
        <li>Enviar la invitación, recordatorios y el pase de ingreso (código QR) por WhatsApp.</li>
        <li>Registrar la respuesta del invitado (si asiste, cuántas personas y su menú) y mostrársela a los organizadores del evento.</li>
        <li>Organizar las mesas y acreditar el ingreso el día del evento.</li>
        <li>Responder las consultas que el invitado envíe por WhatsApp.</li>
    </ul>
    <p>No vendemos ni alquilamos datos personales y no los usamos para publicidad.</p>

    <h2>Con quién se comparten</h2>
    <ul>
        <li>Con los <strong>anfitriones y organizadores del evento</strong> al que el invitado fue invitado (solo los de ese evento).</li>
        <li>Con los proveedores que hacen funcionar el servicio: <strong>WhatsApp / Meta</strong> (envío y recepción de mensajes), <strong>Google Drive</strong> (fotos y archivos del evento) y el proveedor de hosting del servidor.</li>
    </ul>

    <h2>Cuánto tiempo se guardan</h2>
    <p>
        Los datos de un evento se conservan mientras el organizador los necesite para su celebración. Los mensajes de
        WhatsApp se eliminan periódicamente. Cualquier persona puede pedir antes la eliminación de sus datos (ver abajo).
    </p>

    <h2>Tus derechos</h2>
    <p>
        Podés pedir acceso, corrección o eliminación de tus datos, o dejar de recibir mensajes. Para dejar de recibir
        mensajes de una invitación alcanza con responder <strong>“No voy a poder”</strong> o escribirnos que no querés recibir más mensajes.
        Para eliminar tus datos seguí las instrucciones de <a href="/eliminar-datos">Eliminación de datos</a>.
    </p>

    <h2>Seguridad</h2>
    <p>
        El acceso al sistema requiere usuario y contraseña, cada organizador ve solo sus eventos y las comunicaciones
        viajan cifradas (HTTPS). Los enlaces y códigos QR de cada invitado son únicos y difíciles de adivinar.
    </p>
@endsection
