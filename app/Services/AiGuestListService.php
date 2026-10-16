<?php

namespace App\Services;

use Anthropic\Client;
use Anthropic\Core\Exceptions\APIConnectionException;
use Anthropic\Core\Exceptions\APIStatusException;
use Anthropic\Core\Exceptions\AuthenticationException;
use Anthropic\Core\Exceptions\RateLimitException;
use Anthropic\Messages\RawContentBlockDeltaEvent;
use Anthropic\Messages\RawMessageDeltaEvent;
use Anthropic\Messages\TextDelta;
use Illuminate\Support\Facades\Log;

/**
 * "Asistente de listas": Claude reads a guest list as it came (any Excel layout) and proposes how it ends up
 * in the system - one invitation per phone, with its total of people, named companions and other numbers -
 * plus what it couldn't decide. A follow-up instruction ("Nicole va con Oso") updates that proposal.
 * Nothing is saved here: the planner reviews the proposal and imports it.
 */
class AiGuestListService
{
    private const MAX_ROWS = 600;

    private const RULES = <<<'TXT'
Sos el asistente que prepara listas de invitados para un sistema de confirmación de asistencia a eventos (bodas, quince años, eventos) en Paraguay. Recibís las filas de un Excel tal como lo armó la organizadora (cualquier formato, columnas en cualquier orden) y devolvés cómo quedan las INVITACIONES en el sistema.

Qué es una invitación:
- Una invitación = UN número de WhatsApp (el titular) + todas las personas que van con esa invitación. El total de personas incluye al titular.
- Cada invitación se envía una sola vez, al teléfono principal.

Cómo leer la lista:
- Una columna de cantidad ("Total", "Cantidad", "Personas", "Pases"...) es el total de la invitación. Si la columna se llama "Acompañantes" y nunca tiene 0, casi seguro también es el total: decidilo mirando los nombres ("X y Sra" con 2 = total). Si es ambiguo, agregá una observación.
- Filas sin teléfono justo debajo de un titular son sus acompañantes (si entran en su total). Si no entran, es una observación.
- El mismo teléfono en varias filas = una sola invitación; las otras filas son acompañantes y el total se suma (salvo que sea la misma fila repetida).
- Las mismas personas en varias filas con distinto teléfono (ej. "Nadia y Enrique" dos veces, o "Hector y Karen" + "Karen") = una sola invitación; el otro número va en other_phones y el total es el de la pareja/familia (si cada fila dice 1, suman; si dicen lo mismo y es mayor a 1, es la misma invitación repetida).
- Nombres de acompañantes: los que aparecen en filas aparte o en una columna de nombres de acompañantes. No inventes nombres; si no hay, la lista de companions queda vacía y el total los cuenta igual.
- Niños: solo si la lista lo indica (columna de niños, "(hija, 4 años)", "bebé"...). children = cuántos de los del total son niños.
- Limpiá los nombres (espacios dobles, conectores sueltos al final, MAYÚSCULAS a formato normal) sin cambiar quién es.
- Teléfonos: copialos tal como vienen (el sistema los normaliza). Nunca inventes ni completes un teléfono.
- Mesa, restricción alimentaria y notas: copialas si existen.
- source_rows: los números de fila del Excel de los que sale cada invitación.

Observaciones: todo lo que no podés decidir con seguridad o que no cuadra (fila sin teléfono que no entra en ninguna invitación, posible duplicado, total que no coincide con los nombres, teléfono incompleto, invitado sin nombre). Cada una con sus filas y un mensaje corto y concreto para la organizadora, en español rioplatense.

Si recibís una instrucción de la organizadora y una propuesta anterior: aplicá la instrucción sobre esa propuesta y devolvé la propuesta COMPLETA actualizada (todas las invitaciones), quitando las observaciones que quedaron resueltas.

summary: una o dos oraciones con lo que hiciste (o lo que cambiaste), en español.
TXT;

    private static function schema(): array
    {
        $str = ['type' => 'string'];
        $int = ['type' => 'integer'];

        return [
            'type' => 'object',
            'additionalProperties' => false,
            'required' => ['invitations', 'observations', 'summary'],
            'properties' => [
                'invitations' => [
                    'type' => 'array',
                    'items' => [
                        'type' => 'object',
                        'additionalProperties' => false,
                        'required' => ['name', 'phone', 'other_phones', 'total_people', 'children', 'companions', 'table', 'dietary', 'notes', 'source_rows'],
                        'properties' => [
                            'name' => $str,
                            'phone' => $str,
                            'other_phones' => ['type' => 'array', 'items' => $str],
                            'total_people' => $int,
                            'children' => $int,
                            'companions' => [
                                'type' => 'array',
                                'items' => [
                                    'type' => 'object',
                                    'additionalProperties' => false,
                                    'required' => ['name', 'category'],
                                    'properties' => [
                                        'name' => $str,
                                        'category' => ['type' => 'string', 'enum' => ['adult', 'youth', 'child']],
                                    ],
                                ],
                            ],
                            'table' => $str,
                            'dietary' => $str,
                            'notes' => $str,
                            'source_rows' => ['type' => 'array', 'items' => $int],
                        ],
                    ],
                ],
                'observations' => [
                    'type' => 'array',
                    'items' => [
                        'type' => 'object',
                        'additionalProperties' => false,
                        'required' => ['rows', 'message'],
                        'properties' => [
                            'rows' => ['type' => 'array', 'items' => $int],
                            'message' => $str,
                        ],
                    ],
                ],
                'summary' => $str,
            ],
        ];
    }

    /**
     * @param array $headers  column names as they came
     * @param array $rows     [['row' => excel row number, 'cells' => [...]], ...]
     * @param string|null $instruction  the planner's correction, with $proposal (the previous answer)
     * @return array{invitations: array, observations: array, summary: string}
     */
    public function analyze(array $headers, array $rows, ?string $instruction = null, ?array $proposal = null): array
    {
        $key = config('services.anthropic.key');
        if (!$key) {
            throw new \RuntimeException('Falta configurar ANTHROPIC_API_KEY en el servidor.');
        }
        if (count($rows) > self::MAX_ROWS) {
            throw new \RuntimeException('La lista tiene más de ' . self::MAX_ROWS . ' filas: dividila en partes.');
        }

        $table = "Columnas: " . json_encode(array_values($headers), JSON_UNESCAPED_UNICODE) . "\nFilas (número de fila del Excel → celdas):\n";
        foreach ($rows as $row) {
            $table .= ($row['row'] ?? '?') . ': ' . json_encode(array_values($row['cells'] ?? []), JSON_UNESCAPED_UNICODE) . "\n";
        }

        $content = "Lista de invitados del Excel:\n\n{$table}";
        if ($instruction !== null && $proposal !== null) {
            $content .= "\nPropuesta anterior:\n" . json_encode($proposal, JSON_UNESCAPED_UNICODE)
                . "\n\nInstrucción de la organizadora: {$instruction}";
        }

        $client = new Client(apiKey: $key);

        try {
            // Streaming: long lists produce long answers; the text is accumulated and parsed at the end
            $stream = $client->messages->createStream(
                model: config('services.anthropic.model', 'claude-opus-5-5'),
                maxTokens: 64000,
                system: [['type' => 'text', 'text' => self::RULES, 'cacheControl' => ['type' => 'ephemeral']]],
                messages: [['role' => 'user', 'content' => $content]],
                outputConfig: [
                    'effort' => 'medium',
                    'format' => ['type' => 'json_schema', 'schema' => self::schema()],
                ],
            );

            $text = '';
            $stopReason = null;
            foreach ($stream as $event) {
                if ($event instanceof RawContentBlockDeltaEvent && $event->delta instanceof TextDelta) {
                    $text .= $event->delta->text;
                } elseif ($event instanceof RawMessageDeltaEvent) {
                    $stopReason = $event->delta->stopReason ?? $stopReason;
                }
            }
        } catch (AuthenticationException $e) {
            throw new \RuntimeException('La clave de Anthropic (ANTHROPIC_API_KEY) no es válida.');
        } catch (RateLimitException $e) {
            throw new \RuntimeException('El asistente está muy solicitado en este momento. Probá de nuevo en un minuto.');
        } catch (APIStatusException $e) {
            Log::warning('[AI list] Anthropic API: ' . $e->getMessage());
            throw new \RuntimeException('El asistente no pudo procesar la lista. Probá de nuevo en unos minutos.');
        } catch (APIConnectionException $e) {
            Log::warning('[AI list] Connection: ' . $e->getMessage());
            throw new \RuntimeException('No se pudo conectar con el asistente. Revisá la conexión del servidor.');
        }

        if ($stopReason === 'refusal') {
            throw new \RuntimeException('El asistente no pudo procesar esta lista.');
        }
        if ($stopReason === 'max_tokens') {
            throw new \RuntimeException('La lista es demasiado larga para analizarla de una vez: dividila en partes.');
        }

        $data = json_decode($text, true);
        if (!is_array($data) || !isset($data['invitations'], $data['observations'])) {
            Log::warning('[AI list] Unexpected answer: ' . mb_substr($text, 0, 500));
            throw new \RuntimeException('La respuesta del asistente no vino en el formato esperado. Probá de nuevo.');
        }

        return $data;
    }
}
