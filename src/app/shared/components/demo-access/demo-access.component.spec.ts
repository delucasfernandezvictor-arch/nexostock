import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QuickAccount, avatarColor, demoCredentials, initials, rememberedQuickAccounts } from '../../../core/config/demo-accounts';
import { MAX_REMEMBERED, getRememberedAccounts, getRememberedEmail, rememberAccount, setRememberedEmail } from '../../../core/utils/remember';
import { DemoAccessComponent } from './demo-access.component';

const ACCOUNTS = demoCredentials({ demoAdminPassword: 'admin-pass', demoUserPassword: 'user-pass' });

describe('DemoAccessComponent', () => {
  let fixture: ComponentFixture<DemoAccessComponent>;
  let picked: QuickAccount[];

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

  it('las cuentas recordadas salen primero, en su propio grupo, y se eligen sin contraseña', async () => {
    const recordadas = rememberedQuickAccounts([{ email: 'nuevo@example.com', nombre: 'Nuevo Usuario', departamento: 'Ventas', role: 'user' }]);
    fixture.componentRef.setInput('accounts', [...recordadas, ...ACCOUNTS]);
    await fixture.whenStable();
    trigger().click();
    await fixture.whenStable();
    const groups = el().querySelectorAll('[role="group"]');
    expect(groups.length).toBe(2);
    expect(groups[0]!.textContent).toContain('Recordadas en este dispositivo');
    expect(groups[0]!.textContent).toContain('Nuevo Usuario');
    (el().querySelector('[role="option"]') as HTMLElement).click();
    expect(picked[0]).toMatchObject({ email: 'nuevo@example.com', recordada: true });
    expect(picked[0]!.password).toBeUndefined();
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

  it('recuerda cuentas sin contraseña: la última primero, sin duplicados y con límite', () => {
    localStorage.clear();
    for (let i = 0; i < MAX_REMEMBERED + 2; i++) {
      rememberAccount({ email: `u${i}@example.com`, nombre: `Usuario ${i}`, departamento: 'Ventas', role: 'user' }, true);
    }
    rememberAccount({ email: 'U3@Example.com', nombre: 'Usuario 3', departamento: 'Ventas', role: 'user' }, true);
    const cuentas = getRememberedAccounts();
    expect(cuentas.length).toBe(MAX_REMEMBERED);
    expect(cuentas[0]!.email).toBe('u3@example.com');
    expect(cuentas.filter((c) => c.email === 'u3@example.com').length).toBe(1);
    expect(JSON.stringify(localStorage)).not.toContain('password');
    rememberAccount({ email: 'u3@example.com', nombre: '', departamento: '', role: 'user' }, false);
    expect(getRememberedAccounts().some((c) => c.email === 'u3@example.com')).toBe(false);
  });

  it('no duplica las cuentas demo y da a cada email un color estable', () => {
    const quick = rememberedQuickAccounts([
      { email: 'usuario@example.com', nombre: 'Usuario Demo', departamento: 'Logística', role: 'user' },
      { email: 'otra@example.com', nombre: 'Otra', departamento: '', role: 'user' },
    ]);
    expect(quick.map((q) => q.email)).toEqual(['otra@example.com']);
    expect(quick[0]!.departamento).toBe('Sin departamento');
    expect(avatarColor('otra@example.com')).toBe(avatarColor('otra@example.com'));
  });

  it('ignora datos corruptos en el almacenamiento', () => {
    localStorage.setItem('nexostock.cuentas-recordadas', '{no es json');
    expect(getRememberedAccounts()).toEqual([]);
  });
});
