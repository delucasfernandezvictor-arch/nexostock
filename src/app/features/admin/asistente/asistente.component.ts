import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { IonButton, IonIcon, IonModal, IonSpinner, IonToggle } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline, calendarOutline, closeOutline, cubeOutline, peopleOutline, refreshOutline, sparkles,
  stopCircleOutline, trendingUpOutline, volumeHighOutline,
} from 'ionicons/icons';
import { forkJoin } from 'rxjs';
import { PedidosService } from '../../../core/services/pedidos.service';
import { ProductosService } from '../../../core/services/productos.service';
import { UsuariosService } from '../../../core/services/usuarios.service';
import { AuthStore } from '../../../core/state/auth.store';
import { AiWavesComponent } from '../../../shared/components/ai-waves/ai-waves.component';
import { ASISTENTE_NOMBRE, BriefingTipo, buildBriefing, claveDia, frasesVoz } from './asistente.briefing';
import { VozService } from './voz.service';

const KEY_VISTO = 'nexostock.asistente.visto';
const KEY_CONOCIDO = 'nexostock.asistente.conocido';
const KEY_VOZ = 'nexostock.asistente.voz';

function leer(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function guardar(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* almacenamiento no disponible */
  }
}

/**
 * **Nexa, la asistente del administrador.**
 *
 * Botón flotante que abre un diálogo con el **resumen del día** generado a partir
 * de los datos reales (pedidos pendientes por urgencia, stock bajo, ventas de hoy
 * frente a ayer, altas de usuarios y recordatorios de calendario) y lo lee en voz
 * alta con la Web Speech API mientras las ondas reaccionan a cada palabra.
 *
 * El resumen se recalcula cada vez que se abre, así que cambia de un día a otro.
 * Solo se muestra a administradores y, aun así, los datos llegan filtrados por RLS.
 */
@Component({
  selector: 'app-asistente',
  templateUrl: './asistente.component.html',
  styleUrls: ['./asistente.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonModal, IonButton, IonIcon, IonSpinner, IonToggle, AiWavesComponent],
})
export class AsistenteComponent {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly productos = inject(ProductosService);
  private readonly pedidos = inject(PedidosService);
  private readonly usuarios = inject(UsuariosService);
  protected readonly voz = inject(VozService);

  protected readonly nombre = ASISTENTE_NOMBRE;
  protected readonly abierto = signal(false);
  /** Leer el resumen en voz alta al abrir */
  protected readonly vozAuto = signal(leer(KEY_VOZ) !== 'off');
  /** Fecha de referencia del resumen (se fija al abrir) */
  private readonly ahora = signal(new Date());
  /** Día actual (se revisa cada minuto para avisar del resumen nuevo tras la medianoche) */
  private readonly hoy = signal(claveDia(new Date()));
  private readonly visto = signal(leer(KEY_VISTO));
  private primeraVez = leer(KEY_CONOCIDO) === null;
  private hablarAlCargar = false;

  /** Hay un resumen del día que todavía no se ha abierto */
  protected readonly nuevo = computed(() => this.visto() !== this.hoy());

  protected readonly data = rxResource({
    params: () => (this.abierto() ? { dia: this.ahora().getTime() } : undefined),
    stream: () =>
      forkJoin({ productos: this.productos.list(), pedidos: this.pedidos.list(), usuarios: this.usuarios.list() }),
  });

  protected readonly briefing = computed(() => {
    const d = this.data.value();
    if (!d) return null;
    const nombre = this.auth.profile()?.nombre?.split(' ')[0] || this.auth.displayName();
    return buildBriefing(d, this.ahora(), nombre, this.primeraVez);
  });

  protected readonly estado = computed(() => {
    if (this.data.isLoading()) return 'Preparando tu resumen…';
    if (this.voz.speaking()) return 'Hablando…';
    return this.briefing() ? 'Resumen listo' : 'En espera';
  });

  protected readonly iconos: Record<BriefingTipo, string> = {
    urgente: 'alert-circle-outline',
    stock: 'cube-outline',
    ventas: 'trending-up-outline',
    equipo: 'people-outline',
    recordatorio: 'calendar-outline',
  };

  constructor() {
    addIcons({
      alertCircleOutline, calendarOutline, closeOutline, cubeOutline, peopleOutline, refreshOutline, sparkles,
      stopCircleOutline, trendingUpOutline, volumeHighOutline,
    });

    // Cuando llega el resumen tras abrir, se lee si la voz automática está activa
    effect(() => {
      const b = this.briefing();
      if (b && this.abierto() && this.hablarAlCargar) {
        this.hablarAlCargar = false;
        void this.leerResumen();
      }
    });

    const id = setInterval(() => this.hoy.set(claveDia(new Date())), 60_000);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(id);
      this.voz.stop();
    });
  }

  protected abrir(): void {
    const now = new Date();
    this.ahora.set(now);
    this.hoy.set(claveDia(now));
    this.visto.set(claveDia(now));
    guardar(KEY_VISTO, claveDia(now));
    this.hablarAlCargar = this.vozAuto() && this.voz.supported;
    this.abierto.set(true);
  }

  protected cerrar(): void {
    this.voz.stop();
    this.hablarAlCargar = false;
    this.abierto.set(false);
  }

  /** Vuelve a consultar los datos y recalcula el resumen. */
  protected actualizar(): void {
    this.voz.stop();
    this.ahora.set(new Date());
  }

  protected async alternarVoz(): Promise<void> {
    if (this.voz.speaking()) this.voz.stop();
    else await this.leerResumen();
  }

  protected cambiarVozAuto(activa: boolean): void {
    this.vozAuto.set(activa);
    guardar(KEY_VOZ, activa ? 'on' : 'off');
  }

  /** Cierra el diálogo y navega a la pantalla de la acción sugerida. */
  protected async ir(url: string): Promise<void> {
    this.cerrar();
    await this.router.navigateByUrl(url);
  }

  private async leerResumen(): Promise<void> {
    const b = this.briefing();
    if (!b) return;
    const lectura = this.voz.speak(frasesVoz(b));
    if (this.primeraVez) {
      this.primeraVez = false;
      guardar(KEY_CONOCIDO, '1');
    }
    await lectura;
  }
}
