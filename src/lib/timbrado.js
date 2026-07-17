// Configuracao do timbrado do escritorio.
// A logo e carregada de /public/timbrado-logo.png em runtime e convertida
// para os bytes necessarios pela biblioteca docx.

export const TIMBRADO = {
  escritorio: 'FAV Advogados',
  subtitulo: 'Fernando Andrade Vieira - Assessoria Juridica Trabalhista',
  logoUrl: '/timbrado-logo.png',
  rodape: {
    email: 'trabalhista@favadvogados.com.br',
    oab: 'OAB/SP 320.825',
  },
};

// Carrega a logo como ArrayBuffer para uso no ImageRun do docx.
// Retorna null caso a imagem nao esteja disponivel (o export segue sem logo).
export async function carregarLogoBytes() {
  try {
    const resp = await fetch(TIMBRADO.logoUrl);
    if (!resp.ok) return null;
    return await resp.arrayBuffer();
  } catch {
    return null;
  }
}
