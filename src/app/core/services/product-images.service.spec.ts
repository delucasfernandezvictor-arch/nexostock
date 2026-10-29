import { TestBed } from '@angular/core/testing';
import { APP_CONFIG } from '../config/app-config';
import { ProductImagesService, fitWithin, validateImageFile } from './product-images.service';

describe('ProductImagesService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: APP_CONFIG,
          useValue: { supabaseUrl: 'https://demo.supabase.co', supabaseAnonKey: 'x'.repeat(30), production: false, pageSize: 10, demoAdminPassword: '', demoUserPassword: '' },
        },
      ],
    });
  });

  it('construye la URL pública del bucket y codifica la ruta', () => {
    const svc = TestBed.inject(ProductImagesService);
    expect(svc.url('INF-0001/1730.webp')).toBe('https://demo.supabase.co/storage/v1/object/public/productos/INF-0001/1730.webp');
    expect(svc.url('A B/ñ.webp')).toBe('https://demo.supabase.co/storage/v1/object/public/productos/A%20B/%C3%B1.webp');
    expect(svc.url(null)).toBeNull();
  });

  it('valida tipo y tamaño de la imagen antes de procesarla', () => {
    expect(validateImageFile({ type: 'image/png', size: 1024 })).toBeNull();
    expect(validateImageFile({ type: 'image/jpeg', size: 9 * 1024 * 1024 })).toBeNull();
    expect(validateImageFile({ type: 'application/pdf', size: 1024 })).toContain('debe ser una imagen');
    expect(validateImageFile({ type: 'image/png', size: 11 * 1024 * 1024 })).toContain('10 MB');
  });

  it('reduce las dimensiones manteniendo la proporción y nunca amplía', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1080, 1920)).toEqual({ width: 450, height: 800 });
    expect(fitWithin(320, 240)).toEqual({ width: 320, height: 240 });
  });
});
