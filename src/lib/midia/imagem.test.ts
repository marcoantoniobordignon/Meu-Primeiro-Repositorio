import { describe, expect, it } from "vitest";

import { dimensoesAlvo, jpegTemExif, recorteCentral } from "./imagem";

describe("BAR RN-04 · processamento de foto", () => {
  it("maior lado até 1600 px, mantendo a proporção; menor não aumenta", () => {
    expect(dimensoesAlvo(4032, 3024)).toEqual({ largura: 1600, altura: 1200 });
    expect(dimensoesAlvo(3024, 4032)).toEqual({ largura: 1200, altura: 1600 });
    expect(dimensoesAlvo(800, 600)).toEqual({ largura: 800, altura: 600 });
    expect(dimensoesAlvo(1600, 1600)).toEqual({ largura: 1600, altura: 1600 });
  });

  it("recorte central 3:4", () => {
    expect(recorteCentral(1920, 1080, 3 / 4)).toEqual({ x: 555, y: 0, largura: 810, altura: 1080 });
    expect(recorteCentral(1080, 1920, 3 / 4)).toEqual({ x: 0, y: 240, largura: 1080, altura: 1440 });
  });

  it("detecta o segmento EXIF (onde fica o GPS) e o JPEG limpo", () => {
    const app1 = [0xff, 0xe1, 0x00, 0x0a, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x4d, 0x4d];
    const app0 = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00];
    const sos = [0xff, 0xda, 0x00, 0x02];
    expect(jpegTemExif(new Uint8Array([0xff, 0xd8, ...app0, ...app1, ...sos]))).toBe(true);
    expect(jpegTemExif(new Uint8Array([0xff, 0xd8, ...app0, ...sos]))).toBe(false);
    expect(jpegTemExif(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
    // "Exif" depois do SOS (dados da imagem) não conta.
    expect(jpegTemExif(new Uint8Array([0xff, 0xd8, ...sos, ...app1]))).toBe(false);
  });
});
