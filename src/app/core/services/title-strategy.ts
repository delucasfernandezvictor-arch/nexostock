import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { NotifyService } from './notify.service';

/**
 * Título de documento por ruta (WCAG 2.4.2 Página titulada).
 * Además anuncia el cambio de página a los lectores de pantalla, ya que en
 * una SPA el navegador no lo hace por sí mismo.
 */
@Injectable({ providedIn: 'root' })
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly notify = inject(NotifyService);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const page = this.buildTitle(snapshot);
    this.title.setTitle(page ? `${page} · NexoStock` : 'NexoStock · Gestión de inventario y pedidos');
    if (page) this.notify.announce(`Página: ${page}`);
  }
}
