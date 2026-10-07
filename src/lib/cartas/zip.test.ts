import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { crc32, montarZip } from "./zip";

describe("ZIP da exportação (funcionalidade 14 RN-10)", () => {
  it("CRC-32 padrão", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it("o unzip do sistema abre e devolve os mesmos bytes, com nome em UTF-8", () => {
    const pasta = mkdtempSync(path.join(tmpdir(), "zip-"));
    const texto = new TextEncoder().encode("Para você, com amor.\n");
    const binario = new Uint8Array(Array.from({ length: 300 }, (_, i) => i % 256));
    const zip = montarZip([
      { nome: "para-voce/carta.txt", dados: texto },
      { nome: "para-voce/áudio.webm", dados: binario },
    ]);
    writeFileSync(path.join(pasta, "cartas.zip"), zip);
    const lista = execFileSync("python3", ["-c", "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); print(z.testzip()); print('|'.join(z.namelist()))", path.join(pasta, "cartas.zip")]).toString().trim().split("\n");
    expect(lista[0]).toBe("None");
    expect(lista[1]).toBe("para-voce/carta.txt|para-voce/áudio.webm");
    execFileSync("python3", ["-c", "import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])", path.join(pasta, "cartas.zip"), pasta]);
    expect(readFileSync(path.join(pasta, "para-voce/carta.txt"), "utf8")).toBe("Para você, com amor.\n");
    expect(new Uint8Array(readFileSync(path.join(pasta, "para-voce/áudio.webm")))).toEqual(binario);
  });
});
