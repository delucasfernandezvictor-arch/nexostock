import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, viewChild,
} from '@angular/core';

/** Nodo de «circuito» que flota a los lados de las ondas. */
interface Nodo {
  x: number;
  y: number;
  size: number;
  fase: number;
  lado: -1 | 1;
}

/**
 * **`<app-ai-waves>`** — visualización animada de la voz de la asistente.
 *
 * Dibuja en un `<canvas>` varias ondas entrelazadas (degradado cian → violeta →
 * rosa) y nodos de circuito a los lados. Cuando `active` es true las ondas se
 * agitan y cada `pulse` (una palabra pronunciada) las hace crecer un instante.
 *
 * - Es decorativa (`aria-hidden`): el texto del resumen está siempre en pantalla.
 * - Respeta `prefers-reduced-motion`: dibuja un único fotograma estático.
 * - Se adapta al tamaño del contenedor y a pantallas de alta densidad.
 */
@Component({
  selector: 'app-ai-waves',
  template: '<canvas #canvas aria-hidden="true"></canvas>',
  styles: [':host { display: block; position: relative; } canvas { display: block; width: 100%; height: 100%; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiWavesComponent {
  /** La asistente está hablando */
  readonly active = input(false);
  /** Marca de tiempo de la última palabra (cada cambio produce un pico) */
  readonly pulse = input(0);
  /** Número de líneas por onda */
  readonly lines = input(18);

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private frame = 0;
  private energia = 0.12;
  private pico = 0;
  private nodos: Nodo[] = [];

  constructor() {
    const destroyRef = inject(DestroyRef);

    effect(() => {
      if (this.pulse()) this.pico = 1;
    });

    afterNextRender(() => {
      const canvas = this.canvas().nativeElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const { width, height } = canvas.getBoundingClientRect();
        canvas.width = Math.max(1, Math.round(width * dpr));
        canvas.height = Math.max(1, Math.round(height * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.nodos = crearNodos(width, height);
        if (reduce) this.dibujar(ctx, width, height, 0);
      };
      const ro = new ResizeObserver(resize);
      ro.observe(canvas);
      resize();

      const loop = (t: number) => {
        const { width, height } = canvas.getBoundingClientRect();
        // La energía sube suave al hablar y baja al callar; el pico decae rápido
        const objetivo = this.active() ? 0.55 : 0.12;
        this.energia += (objetivo - this.energia) * 0.06;
        this.pico *= 0.9;
        this.dibujar(ctx, width, height, t / 1000);
        this.frame = requestAnimationFrame(loop);
      };
      if (!reduce) this.frame = requestAnimationFrame(loop);

      destroyRef.onDestroy(() => {
        cancelAnimationFrame(this.frame);
        ro.disconnect();
      });
    });
  }

  private dibujar(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
    ctx.clearRect(0, 0, w, h);
    const mid = h / 2;
    const amp = h * (0.12 + this.energia * 0.45 + this.pico * 0.12);

    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#ec4899');
    grad.addColorStop(0.3, '#8b5cf6');
    grad.addColorStop(0.5, '#22d3ee');
    grad.addColorStop(0.7, '#8b5cf6');
    grad.addColorStop(1, '#ec4899');

    // Ondas: dos haces de líneas en contrafase que se cruzan en el centro
    const n = this.lines();
    ctx.lineWidth = 1;
    ctx.strokeStyle = grad;
    for (let haz = 0; haz < 2; haz++) {
      for (let i = 0; i < n; i++) {
        const k = i / (n - 1);
        ctx.globalAlpha = 0.18 + 0.5 * Math.sin(Math.PI * k);
        ctx.beginPath();
        for (let x = 0; x <= w; x += 4) {
          const u = x / w;
          // Envolvente: las ondas se abren en el centro y se estrechan en los bordes
          const env = Math.sin(Math.PI * u) ** 1.4;
          const fase = t * (1.1 + haz * 0.4) + k * 1.6 + haz * Math.PI;
          const y =
            mid +
            Math.sin(u * Math.PI * 3 + fase) * amp * env * (0.55 + 0.45 * k) +
            Math.sin(u * Math.PI * 7 - t * 2.3 + k * 3) * amp * 0.12 * env;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }

    // Nodos de circuito: parpadean y se iluminan más al hablar
    for (const nodo of this.nodos) {
      const brillo = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t * 2 + nodo.fase)) * (0.5 + this.energia);
      ctx.globalAlpha = Math.min(1, brillo);
      ctx.fillStyle = nodo.lado < 0 ? '#ec4899' : '#a855f7';
      ctx.fillRect(nodo.x, nodo.y, nodo.size, nodo.size);
      ctx.globalAlpha = Math.min(1, brillo * 0.6);
      ctx.strokeStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(nodo.x + nodo.size / 2, nodo.y + nodo.size / 2);
      ctx.lineTo(nodo.x + nodo.size / 2 - nodo.lado * nodo.size * 4, nodo.y + nodo.size / 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

/** Nodos repartidos de forma determinista (mismo dibujo en cada visita). */
function crearNodos(w: number, h: number): Nodo[] {
  const nodos: Nodo[] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const total = Math.round(Math.min(40, w / 14));
  for (let i = 0; i < total; i++) {
    const lado: -1 | 1 = i % 2 ? 1 : -1;
    const banda = w * 0.22;
    const x = lado < 0 ? rnd() * banda : w - rnd() * banda;
    nodos.push({ x, y: h * 0.12 + rnd() * h * 0.76, size: 2 + Math.round(rnd() * 3), fase: rnd() * Math.PI * 2, lado });
  }
  return nodos;
}
