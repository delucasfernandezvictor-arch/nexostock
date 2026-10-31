import { Injectable, signal } from '@angular/core';

/** Voces femeninas en español habituales en Windows, macOS, Android y Chrome. */
const FEMENINAS = /elvira|helena|laura|luc[ií]a|paulina|m[oó]nica|ximena|dalia|abril|sabina|esperanza|elena|isabel|paloma|marisol|google español|female|mujer/i;
/** Voces masculinas conocidas (se descartan si hay alternativa). */
const MASCULINAS = /[aá]lvaro|pablo|jorge|ra[uú]l|diego|enrique|juan|carlos|male\b|hombre/i;
/** Voces neuronales: suenan mucho más naturales. */
const NATURALES = /natural|neural|online|premium|enhanced/i;

/** Datos mínimos de una voz (permite probar la selección sin navegador). */
export type VozLike = Pick<SpeechSynthesisVoice, 'name' | 'lang'>;

/**
 * Elige la mejor voz para la asistente: español, femenina y, si existe,
 * neuronal. Devuelve `null` si no hay ninguna voz en español.
 */
export function elegirVoz<T extends VozLike>(voces: readonly T[]): T | null {
  const puntua = (v: T): number =>
    (FEMENINAS.test(v.name) ? 10 : 0) +
    (NATURALES.test(v.name) ? 5 : 0) +
    (v.lang.toLowerCase().startsWith('es-es') ? 3 : 0) -
    (MASCULINAS.test(v.name) ? 20 : 0);
  return [...voces].filter((v) => v.lang.toLowerCase().startsWith('es')).sort((a, b) => puntua(b) - puntua(a))[0] ?? null;
}

/**
 * **VozService** — envoltorio de la Web Speech API (`speechSynthesis`).
 *
 * - Lee una lista de frases (una *utterance* por frase: evita el corte de
 *   Chrome en textos largos y permite saber qué frase se está diciendo).
 * - Expone señales para la interfaz: `speaking`, `frase` (índice actual) y
 *   `pulso` (marca de tiempo de cada palabra, que anima las ondas).
 */
@Injectable({ providedIn: 'root' })
export class VozService {
  private readonly synth: SpeechSynthesis | null = typeof speechSynthesis === 'undefined' ? null : speechSynthesis;
  private voz: SpeechSynthesisVoice | null = null;
  private run = 0;

  /** El navegador puede hablar */
  readonly supported = this.synth !== null;
  /** Hablando ahora mismo */
  readonly speaking = signal(false);
  /** Índice de la frase que se está diciendo (-1 = ninguna) */
  readonly frase = signal(-1);
  /** Se actualiza en cada palabra pronunciada (para animar las ondas) */
  readonly pulso = signal(0);
  /** Nombre de la voz elegida */
  readonly vozNombre = signal<string | null>(null);

  constructor() {
    if (!this.synth) return;
    const cargar = () => {
      this.voz = elegirVoz(this.synth!.getVoices());
      this.vozNombre.set(this.voz?.name ?? null);
    };
    cargar();
    // Las voces se cargan de forma asíncrona en Chrome y Edge
    this.synth.addEventListener?.('voiceschanged', cargar);
  }

  /**
   * Lee las frases en orden. Se resuelve al terminar o al detenerla.
   * Debe llamarse tras una acción del usuario (los navegadores bloquean el audio automático).
   */
  speak(frases: readonly string[]): Promise<void> {
    if (!this.synth || !frases.length) return Promise.resolve();
    this.stop();
    const run = ++this.run;
    this.speaking.set(true);
    return new Promise<void>((resolve) => {
      frases.forEach((texto, i) => {
        const u = new SpeechSynthesisUtterance(texto);
        u.lang = this.voz?.lang ?? 'es-ES';
        if (this.voz) u.voice = this.voz;
        u.rate = 1.03;
        u.pitch = 1.08;
        u.onstart = () => run === this.run && this.frase.set(i);
        u.onboundary = () => run === this.run && this.pulso.set(performance.now());
        const fin = () => {
          if (run !== this.run) return resolve();
          if (i === frases.length - 1) {
            this.speaking.set(false);
            this.frase.set(-1);
            resolve();
          }
        };
        u.onend = fin;
        u.onerror = fin;
        this.synth!.speak(u);
      });
    });
  }

  /** Detiene la voz inmediatamente. */
  stop(): void {
    this.run++;
    this.synth?.cancel();
    this.speaking.set(false);
    this.frase.set(-1);
  }
}
