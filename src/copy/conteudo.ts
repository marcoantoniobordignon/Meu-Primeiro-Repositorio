/** Copy de stories e conteúdo (spec 07). */
export const conteudoCopy = {
  storiesTitulo: "Hoje para você",
  meta: (min: number) => `${min} min · expira hoje`,
  metaGuardada: (min: number) => `${min} min`,
  fechar: "Fechar",
  guardar: "Guardar",
  guardada: "Guardada ✓",
  desguardar: "Remover dos guardados",
  removida: "Removida dos guardados",
  proxima: "Próxima",
  concluir: "Concluir",
  avancar: "Avançar",
  voltarCard: "Voltar",
  bloqueio: {
    titulo: "Continuar lendo no Completo",
    apoio: "Este conteúdo faz parte do plano completo. O primeiro card é por nossa conta.",
    cta: "Conhecer o Completo",
    emBreve: "Assinatura chega em breve",
  },
  guardados: {
    titulo: "Guardados",
    vazio: "Nada guardado ainda. Toque no marcador dentro de uma story para salvar.",
    ir: "Ver stories de hoje",
  },
  naoEncontrada: "Essa story não existe mais.",
} as const;
