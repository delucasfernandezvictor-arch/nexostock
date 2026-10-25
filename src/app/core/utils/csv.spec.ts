import { escapeCsv, fileName, toCsv } from './csv';

describe('csv utils', () => {
  it('escapa separadores, comillas y saltos de línea (RFC 4180)', () => {
    expect(escapeCsv('a;b')).toBe('"a;b"');
    expect(escapeCsv('di "hola"')).toBe('"di ""hola"""');
    expect(escapeCsv('línea1\nlínea2')).toBe('"línea1\nlínea2"');
    expect(escapeCsv('simple')).toBe('simple');
  });

  it('usa coma decimal en números y vacío en nulos', () => {
    expect(escapeCsv(12.5)).toBe('12,5');
    expect(escapeCsv(null)).toBe('');
    expect(escapeCsv(undefined)).toBe('');
  });

  it('neutraliza la inyección de fórmulas en hojas de cálculo', () => {
    expect(escapeCsv('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)");
    expect(escapeCsv('@cmd')).toBe("'@cmd");
    expect(escapeCsv(-5)).toBe('-5');
  });

  it('genera cabecera y filas con separador ;', () => {
    const csv = toCsv(
      [
        { a: 'x', b: 1 },
        { a: 'y;z', b: 2.25 },
      ],
      [
        { label: 'Col A', value: (r) => r.a },
        { label: 'Col B', value: (r) => r.b },
      ],
    );
    expect(csv).toBe('Col A;Col B\r\nx;1\r\n"y;z";2,25');
  });

  it('crea nombres de fichero seguros sin acentos', () => {
    expect(fileName('Informe de Categorías', 'csv', new Date('2026-10-25T10:00:00Z'))).toBe('informe-de-categorias_2026-10-25.csv');
  });
});
