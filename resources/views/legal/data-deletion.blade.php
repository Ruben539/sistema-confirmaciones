@extends('legal.layout')

@section('title', 'Eliminación de datos')

@section('content')
    <p>Podés pedir que eliminemos los datos que {{ config('legal.brand') }} guarda sobre vos en cualquier momento.</p>

    <h2>Cómo pedirlo</h2>
    <div class="box">
        <p>
            @if (config('legal.email'))
                Escribinos a <a href="mailto:{{ config('legal.email') }}?subject=Eliminar%20mis%20datos">{{ config('legal.email') }}</a>
            @else
                Escribinos
            @endif
            @if (config('legal.whatsapp'))
                o por WhatsApp al {{ config('legal.whatsapp') }}
            @endif
            con el asunto <strong>“Eliminar mis datos”</strong>, indicando:
        </p>
        <ul>
            <li>Tu nombre y el número de teléfono con el que recibiste la invitación.</li>
            <li>El evento (nombre de los anfitriones o fecha), si lo sabés.</li>
        </ul>
    </div>

    <h2>Qué eliminamos</h2>
    <ul>
        <li>Tus datos de invitado (nombre, teléfono, acompañantes, confirmación, menú y mesa).</li>
        <li>Los mensajes de WhatsApp intercambiados con el sistema.</li>
        <li>Las dedicatorias, fotos o canciones que hayas compartido.</li>
    </ul>

    <h2>Plazo</h2>
    <p>
        Confirmamos la eliminación dentro de los 30 días. Si el evento todavía no ocurrió, avisamos a sus organizadores
        que ya no vas a recibir mensajes ni figurar en la lista.
    </p>
@endsection
