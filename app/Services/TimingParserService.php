<?php

namespace App\Services;

use Exception;
use ZipArchive;
use Smalot\PdfParser\Parser as PdfParser;

class TimingParserService
{
    /**
     * Extrae texto de un archivo PDF, Word (.docx) o texto plano y lo convierte
     * en una lista estructurada de hitos de timing.
     */
    public function parseFile(string $filePath, string $extension): array
    {
        $text = '';
        $extension = strtolower($extension);

        if ($extension === 'pdf') {
            $text = $this->extractTextFromPdf($filePath);
        } elseif (in_array($extension, ['docx', 'doc'])) {
            $text = $this->extractTextFromDocx($filePath);
        } else {
            $text = @file_get_contents($filePath) ?: '';
        }

        return $this->parseText($text);
    }

    /**
     * Extrae texto de un PDF utilizando smalot/pdfparser.
     */
    public function extractTextFromPdf(string $filePath): string
    {
        try {
            $parser = new PdfParser();
            $pdf = $parser->parseFile($filePath);
            return $pdf->getText();
        } catch (Exception $e) {
            \Illuminate\Support\Facades\Log::warning("Error parsing PDF: " . $e->getMessage());
            return '';
        }
    }

    /**
     * Extrae texto de un archivo Word (.docx) desempaquetando word/document.xml.
     */
    public function extractTextFromDocx(string $filePath): string
    {
        try {
            $zip = new ZipArchive();
            if ($zip->open($filePath) === true) {
                $xml = $zip->getFromName('word/document.xml');
                $zip->close();

                if ($xml) {
                    // Reemplazar saltos de párrafo y filas de tabla por saltos de línea
                    $xml = str_replace(['</w:p>', '</w:tr>'], "\n", $xml);
                    $xml = str_replace(['<w:tab/>', '</w:tc>'], "\t", $xml);
                    return html_entity_decode(strip_tags($xml), ENT_QUOTES, 'UTF-8');
                }
            }
        } catch (Exception $e) {
            \Illuminate\Support\Facades\Log::warning("Error parsing DOCX: " . $e->getMessage());
        }

        return '';
    }

    /**
     * Parsea texto crudo y genera la lista estructurada de hitos del Timing.
     */
    public function parseText(string $rawText): array
    {
        // Normalizar saltos de línea y limpiar caracteres especiales
        $rawText = str_replace(["\r\n", "\r"], "\n", $rawText);
        $rawLines = explode("\n", $rawText);

        $items = [];
        $headerLines = [];
        $footerLines = [];
        $currentItem = null;
        $foundFirstTime = false;

        // Regex para detectar horas (ej: 07:00, 16:00-17:00, 16:30, 7:30 PM, etc.)
        $timeRegex = '/^(\d{1,2}:\d{2}(?:\s*(?:-|–|a|al|hasta)\s*\d{1,2}:\d{2})?(?:\s*(?:am|pm|hs|hrs|h))?)\s*[:\-\|\t]?\s*(.*)$/iu';

        foreach ($rawLines as $line) {
            $trimmed = trim($line);
            if (empty($trimmed)) {
                continue;
            }

            // Omitir separadores comunes
            if (preg_match('/^[-=_*]{3,}$/', $trimmed)) {
                continue;
            }

            if (preg_match($timeRegex, $trimmed, $matches)) {
                $foundFirstTime = true;

                // Guardar el item anterior
                if ($currentItem) {
                    $items[] = $currentItem;
                }

                $timeStr = trim($matches[1]);
                $titleStr = trim($matches[2] ?? '');

                $currentItem = [
                    'id' => 'timing_' . uniqid(),
                    'time' => $timeStr,
                    'title' => $titleStr,
                    'description' => '',
                    'completed' => false,
                ];
            } else {
                if (!$foundFirstTime) {
                    $headerLines[] = $trimmed;
                } else {
                    if ($currentItem) {
                        // Si el título del item estaba vacío, esta primera línea es el título
                        if (empty($currentItem['title'])) {
                            $currentItem['title'] = $trimmed;
                        } else {
                            // Detectar si la línea parece footer (ej: Planner: ..., Coordinación...)
                            if (preg_match('/(planner|coordinaci[oó]n|organiza|contacto|tel[eé]fono|instagram|eventos|producci[oó]n)/i', $trimmed) && count($items) >= 2) {
                                $footerLines[] = $trimmed;
                            } else {
                                $currentItem['description'] = empty($currentItem['description'])
                                    ? $trimmed
                                    : $currentItem['description'] . ' ' . $trimmed;
                            }
                        }
                    } else {
                        $footerLines[] = $trimmed;
                    }
                }
            }
        }

        // Agregar el último item
        if ($currentItem) {
            $items[] = $currentItem;
        }

        // Limpiar títulos y descripciones
        foreach ($items as &$it) {
            $it['title'] = trim(preg_replace('/^[:\-\|\t\s]+/', '', $it['title']));
            $it['description'] = trim($it['description']);
            if (empty($it['title']) && !empty($it['description'])) {
                $it['title'] = $it['description'];
                $it['description'] = '';
            }
        }
        unset($it);

        // Extraer metadatos del encabezado si existen
        $metadata = [
            'theme' => '',
            'subtitle' => '',
            'date_location' => '',
            'planner_notes' => implode(' | ', $footerLines),
        ];

        if (!empty($headerLines)) {
            // Filtrar "TIMING DEL EVENTO" o "CRONOGRAMA"
            $filteredHeader = array_filter($headerLines, fn($l) => !preg_match('/^(timing|cronograma|itinerario|escaleta)/i', $l));
            $filteredHeader = array_values($filteredHeader);

            if (isset($filteredHeader[0])) $metadata['theme'] = $filteredHeader[0];
            if (isset($filteredHeader[1])) $metadata['subtitle'] = $filteredHeader[1];
            if (isset($filteredHeader[2])) $metadata['date_location'] = $filteredHeader[2];
        }

        return [
            'items' => $items,
            'metadata' => $metadata,
            'count' => count($items),
        ];
    }
}
