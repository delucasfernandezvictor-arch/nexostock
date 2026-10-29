import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DemoCredentials, demoCredentials, initials } from '../../../core/config/demo-accounts';
import { getRememberedEmail, setRememberedEmail } from '../../../core/utils/remember';
import { DemoAccessComponent } from './demo-access.component';

const ACCOUNTS = demoCredentials({ demoAdminPassword: 'admin-pass', demoUserPassword: 'user-pass' });

describe('DemoAccessComponent', () => {
  let fixture: ComponentFixture<DemoAccessComponent>;
  let picked: DemoCredentials[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DemoAccessComponent] }).compileComponents();
    fixture = TestBed.createComponent(DemoAccessComponent);
    fixture.componentRef.setInput('accounts', ACCOUNTS);
    picked = [];
    fixture.componentInstance.pick.subscribe((a) => picked.push(a));
    await fixture.whenStable();
  });

  const el = () => fixture.nativeElement as HTMLElement;
  const trigger = () => el().querySelector('.tile-user') as HTMLButtonElement;
  const key = (target: Element, k: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));

  it('la tarjeta de administrador emite la cuenta admin con su contraseña', () => {
    (el().querySelector('.tile-admin') as HTMLButtonElement).click();
    expect(picked[0]).toMatchObject({ email: 'admin@example.com', role: 'admin', password: 'admin-pass' });
  });

  it('el desplegable lista solo las cuentas de usuario estándar', async () => {
    trigger().click();
    await fixture.whenStable();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    const options = el().querySelectorAll('[role="option"]');
    expect(options.length).toBe(ACCOUNTS.filter((a) => a.role === 'user').length);
    expect(options[0]!.textContent).toContain('Usuario Demo');
  });

  it('se maneja con teclado: flecha abajo, flecha abajo y Enter elige la segunda cuenta', async () => {
    key(trigger(), 'ArrowDown');
    await fixture.whenStable();
    const list = el().querySelector('[role="listbox"]')!;
    key(list, 'ArrowDown');
    await fixture.whenStable();
    expect(list.getAttribute('aria-activedescendant')).toContain('opt-1');
    key(list, 'Enter');
    await fixture.whenStable();
    expect(picked[0]).toMatchObject({ email: 'lucia.herrera@example.com', password: 'user-pass' });
    expect(el().querySelector('[role="listbox"]')).toBeNull();
  });

  it('Esc cierra el desplegable sin elegir nada', async () => {
    trigger().click();
    await fixture.whenStable();
    key(el().querySelector('[role="listbox"]')!, 'Escape');
    await fixture.whenStable();
    expect(el().querySelector('[role="listbox"]')).toBeNull();
    expect(picked.length).toBe(0);
  });

  it('no muestra nada si el build no incluye contraseñas demo', async () => {
    fixture.componentRef.setInput('accounts', demoCredentials({ demoAdminPassword: '', demoUserPassword: '' }));
    await fixture.whenStable();
    expect(el().querySelector('.demo')).toBeNull();
  });
});

describe('utilidades de acceso', () => {
  it('initials toma las dos primeras iniciales', () => {
    expect(initials('Lucía Herrera')).toBe('LH');
    expect(initials('Admin')).toBe('A');
  });

  it('recordar email guarda solo el email normalizado y se puede olvidar', () => {
    localStorage.clear();
    setRememberedEmail('  Lucia.Herrera@Example.com ', true);
    expect(getRememberedEmail()).toBe('lucia.herrera@example.com');
    setRememberedEmail('lucia.herrera@example.com', false);
    expect(getRememberedEmail()).toBe('');
  });
});
