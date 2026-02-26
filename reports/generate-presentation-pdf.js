const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

function asDataUri(filePath) {
  const ext = path.extname(filePath).toLowerCase().replace('.', '') || 'png';
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
  const base64 = fs.readFileSync(filePath).toString('base64');
  return `data:${mime};base64,${base64}`;
}

(async () => {
  const shotsDir = path.resolve('reports', 'presentation-shots');
  const outputPdf = path.resolve('reports', 'apresentação sistema orçamentário.pdf');

  const slides = [
    {
      title: 'Tela de Login',
      note:
        'Aqui comeca tudo. A ideia foi deixar o acesso direto: usuario e senha, sem poluicao visual. O foco e entrar rapido e ir pro trabalho.',
      image: '01-login.png',
    },
    {
      title: 'Dashboard Geral',
      note:
        'Esse e o painel pra bater o olho e entender o momento do orçamento. A gente pensou em trazer os numeros principais logo no topo pra ajudar decisao rapida.',
      image: '02-dashboard.png',
    },
    {
      title: 'Contas por Coordenador (Planejamento)',
      note:
        'Aqui e o coracao operacional. O coordenador ajusta valores por conta, filtra, compara e acompanha o que foi orcado vs realizado no mesmo lugar.',
      image: '03-planejamento.png',
    },
    {
      title: 'Mapa Estrategico BSC',
      note:
        'Nessa tela o objetivo foi conectar meta estrategica com indicador. Fica facil navegar por objetivo, processo e palavra-chave sem se perder.',
      image: '04-bsc-mapa.png',
    },
    {
      title: 'BSC Mensal (Gestao)',
      note:
        'Aqui o time acompanha meta mensal e realizado. O desenho foi pensado pra leitura rapida de status e acao imediata quando tem desvio.',
      image: '05-bsc-mensal.png',
    },
    {
      title: 'Analises DRE',
      note:
        'No DRE a ideia foi juntar comparacao e tendencia. Em vez de ficar pulando planilha, tudo importante fica na mesma tela com contexto.',
      image: '06-dre-analises.png',
    },
    {
      title: 'Cadastro de Contas',
      note:
        'Essa parte cuida da base: conta contabil, classificacao e organizacao. Sem cadastro limpo, o resto do painel perde confianca.',
      image: '07-contas.png',
    },
    {
      title: 'Orcamentos e Versoes',
      note:
        'Aqui entra governanca: versao, status, controle de ciclo e historico. Foi pensado pra dar seguranca no processo sem travar a operacao.',
      image: '08-orcamentos.png',
    },
  ];

  const renderedSlides = slides
    .map((slide, index) => {
      const file = path.join(shotsDir, slide.image);
      const imgSrc = fs.existsSync(file) ? asDataUri(file) : '';
      return `
        <section class="slide ${index > 0 ? 'page-break' : ''}">
          <div class="slide-head">
            <div class="chip">Printbag | Sistema Orcamentario</div>
            <h2>${index + 1}. ${slide.title}</h2>
            <p>${slide.note}</p>
          </div>
          <div class="shot-wrap">
            <img src="${imgSrc}" alt="${slide.title}" />
          </div>
        </section>
      `;
    })
    .join('\n');

  const html = `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Apresentacao Sistema Orcamentario</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: 'Segoe UI', Arial, sans-serif;
            color: #0f172a;
            background: #eef3fa;
          }
          .cover {
            min-height: 100vh;
            padding: 44px 50px;
            background:
              radial-gradient(900px 300px at -10% -15%, rgba(43,108,176,0.18), transparent 60%),
              radial-gradient(800px 260px at 110% 0%, rgba(31,77,143,0.12), transparent 62%),
              #f4f8ff;
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 16px;
          }
          .cover h1 {
            margin: 0;
            font-size: 46px;
            line-height: 1.05;
            color: #113b75;
          }
          .cover p {
            margin: 0;
            max-width: 840px;
            font-size: 18px;
            color: #334155;
          }
          .meta {
            margin-top: 14px;
            display: inline-block;
            padding: 10px 14px;
            border-radius: 999px;
            background: rgba(17, 59, 117, 0.1);
            color: #113b75;
            font-weight: 600;
            font-size: 13px;
            width: fit-content;
          }
          .section-title {
            margin: 28px 0 4px;
            font-size: 22px;
            color: #113b75;
          }
          .bullets {
            margin: 0;
            padding-left: 22px;
            color: #334155;
            font-size: 16px;
            line-height: 1.6;
          }
          .slide {
            min-height: 100vh;
            padding: 34px 38px 30px;
            background: #f8fbff;
          }
          .page-break {
            page-break-before: always;
          }
          .slide-head {
            margin-bottom: 14px;
          }
          .chip {
            display: inline-block;
            padding: 6px 10px;
            border-radius: 999px;
            font-size: 11px;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: #1f4d8f;
            border: 1px solid rgba(31,77,143,0.25);
            background: rgba(31,77,143,0.08);
            margin-bottom: 8px;
          }
          .slide h2 {
            margin: 0 0 6px;
            color: #113b75;
            font-size: 28px;
          }
          .slide p {
            margin: 0;
            color: #334155;
            font-size: 16px;
            line-height: 1.55;
          }
          .shot-wrap {
            margin-top: 16px;
            border: 1px solid rgba(15,23,42,0.15);
            border-radius: 18px;
            overflow: hidden;
            box-shadow: 0 16px 36px rgba(15,23,42,0.14);
            background: #fff;
          }
          .shot-wrap img {
            display: block;
            width: 100%;
            height: auto;
          }
        </style>
      </head>
      <body>
        <section class="cover">
          <h1>Apresentacao do Sistema Orcamentario</h1>
          <p>
            Esse material mostra o projeto de um jeito direto, sem linguagem engessada: o que ele resolve,
            como foi pensado e como cada tela ajuda no dia a dia de quem toca o orçamento.
          </p>
          <div class="meta">Data de geracao: ${new Date().toLocaleString('pt-BR')}</div>

          <h2 class="section-title">Como a solucao foi pensada</h2>
          <ul class="bullets">
            <li>Foco em fluxo real de trabalho: planejar, acompanhar, ajustar e fechar ciclo.</li>
            <li>Visao por perfil: admin, controller e coordenador, cada um com seu nivel de acesso.</li>
            <li>Tudo integrado: planejamento, BSC, DRE e cadastros em um ecossistema unico.</li>
            <li>Interface clara pra leitura rapida de numero e tomada de decisao.</li>
          </ul>
        </section>

        ${renderedSlides}
      </body>
    </html>
  `;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.pdf({
    path: outputPdf,
    format: 'A4',
    printBackground: true,
    margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
  });
  await browser.close();

  console.log('pdf:', outputPdf);
})();
