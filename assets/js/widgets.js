/* ===================================================================
   widgets.js: simuladores e calculadoras interativas
   Uso nas páginas: <div data-widget="nome"></div>
   Mecânica Clássica II / LFCA–URCA
   =================================================================== */

(function () {
  'use strict';

  /* ---------- utilitários de DOM ---------- */
  function el(tag, attrs, filhos) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k === 'texto') n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (filhos || []).forEach(function (c) { n.appendChild(c); });
    return n;
  }

  function moldura(raiz, titulo) {
    raiz.classList.add('widget');
    raiz.appendChild(el('div', { class: 'widget-cabeca', texto: titulo }));
    var corpo = el('div', { class: 'widget-corpo' });
    raiz.appendChild(corpo);
    return corpo;
  }

  /* Devolve o <input type=range>, para que o chamador possa movê-lo por código. */
  function deslizante(pai, rot, min, max, passo, inicial, aoMudar, formata) {
    var campo = el('div', { class: 'campo' });
    var lab = el('label');
    var val = el('span', { class: 'valor' });
    var inp = el('input', { type: 'range', min: min, max: max, step: passo, value: inicial });
    function mostrar() {
      val.innerHTML = formata ? formata(Number(inp.value)) : String(inp.value).replace('.', ',');
    }
    lab.innerHTML = rot + ' ';
    lab.appendChild(val);
    campo.appendChild(lab);
    campo.appendChild(inp);
    pai.appendChild(campo);
    inp.addEventListener('input', function () { mostrar(); aoMudar(Number(inp.value)); });
    mostrar();
    return inp;
  }

  /* Botões mutuamente exclusivos. Devolve uma função que troca a seleção. */
  function opcoes(pai, lista, inicial, aoMudar) {
    var cx = el('div', { class: 'botoes' });
    var bs = lista.map(function (o, i) {
      var b = el('button', { type: 'button', texto: o.rot });
      if (i !== inicial) b.classList.add('sec');
      b.addEventListener('click', function () {
        bs.forEach(function (x) { x.classList.add('sec'); });
        b.classList.remove('sec');
        aoMudar(o.v, o);
      });
      cx.appendChild(b);
      return b;
    });
    pai.appendChild(cx);
    return function (i) { bs[i].click(); };
  }

  function cartoes(pai, lista) {
    var g = el('div', { class: 'grade-num' });
    lista.forEach(function (c) {
      g.appendChild(el('div', { class: 'cartao-num', html:
        '<span class="rot">' + c.rot + '</span><span class="val" data-k="' + c.k + '">·</span>' }));
    });
    pai.appendChild(g);
    return function (vals) {
      Object.keys(vals).forEach(function (k) {
        var n = g.querySelector('[data-k="' + k + '"]');
        if (n) n.innerHTML = vals[k];
      });
    };
  }

  function tipografar(no) {
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([no]).catch(function () {});
    }
  }

  var REGISTRO = {};


  /* Seta com ponta, usada por quase todo widget de cinemática. */
  function seta(ct, xa, ya, xb, yb, cor, esp, tracejado) {
    var dx = xb - xa, dy = yb - ya, r = Math.sqrt(dx * dx + dy * dy);
    if (r < 1.5) return;
    var ux = dx / r, uy = dy / r, p = Math.min(8, r * 0.42);
    ct.save();
    ct.strokeStyle = cor; ct.fillStyle = cor;
    ct.lineWidth = esp || 2; ct.lineCap = 'round'; ct.lineJoin = 'round';
    if (tracejado) ct.setLineDash(tracejado);
    ct.beginPath(); ct.moveTo(xa, ya); ct.lineTo(xb - ux * p * 0.8, yb - uy * p * 0.8);
    ct.stroke();
    ct.setLineDash([]);
    ct.beginPath();
    ct.moveTo(xb, yb);
    ct.lineTo(xb - ux * p - uy * p * 0.46, yb - uy * p + ux * p * 0.46);
    ct.lineTo(xb - ux * p + uy * p * 0.46, yb - uy * p - ux * p * 0.46);
    ct.closePath(); ct.fill();
    ct.restore();
  }

  /* Rótulo com halo branco, legível por cima de qualquer desenho. */
  function rotulo(ct, texto, x, y, cor, al, bl, fonte, corHalo) {
    ct.save();
    ct.font = fonte || '600 11px system-ui, sans-serif';
    ct.textAlign = al || 'center'; ct.textBaseline = bl || 'middle';
    ct.lineJoin = 'round'; ct.lineWidth = 3.5; ct.strokeStyle = corHalo || '#fff';
    ct.strokeText(texto, x, y);
    ct.fillStyle = cor; ct.fillText(texto, x, y);
    ct.restore();
  }

  /* =================================================================
     1. Campo de velocidades de um corpo rígido
     Três coisas que o texto afirma e que só convencem desenhadas: que
     a velocidade varia de ponto para ponto enquanto ω não varia; que a
     separação em translação mais rotação depende do ponto escolhido
     mas a soma não; e que a aceleração tem uma parte tangencial e uma
     centrípeta mesmo quando o ponto de apoio não acelera.
     ================================================================= */
  REGISTRO.corporigido = function (raiz) {
    /* um L, porque num corpo simétrico não se enxerga a rotação */
    var FORMA = [[-1.7, -1.0], [1.9, -1.0], [1.9, -0.25], [-0.5, -0.25],
                 [-0.5, 1.5], [-1.7, 1.5]];
    var MARCOS = [
      { n: 'A', b: [-1.1, 1.1] },
      { n: 'B', b: [1.5, -0.65] },
      { n: 'C', b: [0.1, -0.62] }
    ];
    var est = { vista: 'campo', th: 25, w: 1.4, V: 1.2, al: 0, base: 0 };

    var corpo = moldura(raiz, 'Corpo rígido: o campo de velocidades');

    var c0 = el('div', { class: 'controles' });
    corpo.appendChild(c0);
    opcoes(c0, [
      { rot: 'Campo de velocidades', v: 'campo' },
      { rot: 'Translação + rotação', v: 'decomp' },
      { rot: 'Aceleração', v: 'acel' }
    ], 0, function (v) { est.vista = v; desenhar(); });

    var c1 = el('div', { class: 'controles' });
    corpo.appendChild(c1);
    c1.appendChild(el('span', { class: 'etiqueta', texto: 'ponto de apoio O' }));
    opcoes(c1, MARCOS.map(function (m, i) { return { rot: m.n, v: i }; }), 0,
      function (v) { est.base = v; desenhar(); });

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'orientação θ', 0, 360, 1, 25,
      function (v) { est.th = v; desenhar(); },
      function (v) { return v + '°'; });
    deslizante(ctr, 'velocidade angular ω', -2.5, 2.5, 0.1, 1.4,
      function (v) { est.w = v; desenhar(); },
      function (v) { return F.fmt(v, 1) + ' rad/s'; });
    deslizante(ctr, 'velocidade do centro', 0, 3, 0.1, 1.2,
      function (v) { est.V = v; desenhar(); },
      function (v) { return F.fmt(v, 1) + ' m/s'; });
    deslizante(ctr, 'aceleração angular α', -2.5, 2.5, 0.1, 0,
      function (v) { est.al = v; desenhar(); },
      function (v) { return F.fmt(v, 1) + ' rad/s²'; });

    var mostrar = cartoes(corpo, [
      { rot: 'ω (igual para todo ponto)', k: 'w' },
      { rot: '|v| em A (m/s)', k: 'va' },
      { rot: '|v| em B (m/s)', k: 'vb' },
      { rot: '|v| em C (m/s)', k: 'vc' },
      { rot: 'centro instantâneo', k: 'ci' },
      { rot: '|a| em A (m/s²)', k: 'aa' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    function gira(b, th) {
      var c = Math.cos(th), s = Math.sin(th);
      return [c * b[0] - s * b[1], s * b[0] + c * b[1]];
    }
    /* v = v_C + ω ẑ × s, com s medido a partir do centro */
    function vel(s) { return [est.V - est.w * s[1], est.w * s[0]]; }
    function mod(v) { return Math.sqrt(v[0] * v[0] + v[1] * v[1]); }

    function desenhar() {
      var th = est.th * Math.PI / 180;
      var alt = 330;
      var p = G.preparar(cv, alt), ct = p.ct, Lp = p.L;
      ct.clearRect(0, 0, Lp, alt);

      var esc = Math.min((Lp - 150) / 5.2, (alt - 86) / 3.2);  // px por unidade
      var cx = Lp / 2, cy = alt / 2 - 6;
      var X = function (u) { return cx + u[0] * esc; };
      var Y = function (u) { return cy - u[1] * esc; };
      var verts = FORMA.map(function (b) { return gira(b, th); });

      /* Escala das setas: fixá-la em px por (m/s) deixava a figura sair
         do quadro quando ω cresce. Aqui a maior seta da vista ocupa
         sempre a mesma fração do corpo, e o que se compara é o tamanho
         relativo entre as setas, que é o que interessa. */
      var alvos = MARCOS.map(function (m) { return gira(m.b, th); }).concat(verts);
      var vmax = 0.3, amax = 0.3;
      alvos.forEach(function (s) {
        vmax = Math.max(vmax, mod(vel(s)));
        amax = Math.max(amax, Math.sqrt(
          Math.pow(-est.al * s[1] - est.w * est.w * s[0], 2) +
          Math.pow(est.al * s[0] - est.w * est.w * s[1], 2)));
      });
      var ev = esc * 1.15 / (est.vista === 'acel' ? amax : vmax);

      /* contorno do corpo */
      ct.beginPath();
      verts.forEach(function (u, i) { (i ? ct.lineTo : ct.moveTo).call(ct, X(u), Y(u)); });
      ct.closePath();
      ct.fillStyle = 'rgba(23,107,93,.13)';
      ct.fill();
      ct.strokeStyle = G.COR.mestra; ct.lineWidth = 2; ct.stroke();

      var marcos = MARCOS.map(function (m) { return { n: m.n, s: gira(m.b, th) }; });
      var O = marcos[est.base];

      /* centro instantâneo de rotação, onde a velocidade se anula */
      /* onde a velocidade se anula: r* = C + (ẑ × v_C)/ω, e com
         v_C = (V, 0) o produto ẑ × v_C vale (0, V) */
      var ci = Math.abs(est.w) > 1e-6 ? [0, est.V / est.w] : null;

      if (est.vista === 'campo') {
        marcos.concat(verts.map(function (u) { return { n: '', s: u }; }))
          .forEach(function (m) {
            var v = vel(m.s);
            seta(ct, X(m.s), Y(m.s), X(m.s) + v[0] * ev, Y(m.s) - v[1] * ev,
              m.n ? G.COR.mestra : 'rgba(23,107,93,.45)', m.n ? 2.4 : 1.6);
          });
      } else if (est.vista === 'decomp') {
        var vO = vel(O.s);
        marcos.forEach(function (m) {
          var rot = [-est.w * (m.s[1] - O.s[1]), est.w * (m.s[0] - O.s[0])];
          var x0 = X(m.s), y0 = Y(m.s);
          var x1 = x0 + vO[0] * ev, y1 = y0 - vO[1] * ev;
          var x2 = x1 + rot[0] * ev, y2 = y1 - rot[1] * ev;
          seta(ct, x0, y0, x1, y1, G.COR.suave, 2);
          seta(ct, x1, y1, x2, y2, G.COR.bronze, 2);
          seta(ct, x0, y0, x2, y2, G.COR.mestra, 2.6);
        });
      } else {
        /* a = α ẑ × s − ω² s, tomando o centro como ponto sem aceleração */
        marcos.forEach(function (m) {
          var tg = [-est.al * m.s[1], est.al * m.s[0]];
          var cp = [-est.w * est.w * m.s[0], -est.w * est.w * m.s[1]];
          var x0 = X(m.s), y0 = Y(m.s);
          seta(ct, x0, y0, x0 + tg[0] * ev, y0 - tg[1] * ev, G.COR.bronze, 2);
          seta(ct, x0, y0, x0 + cp[0] * ev, y0 - cp[1] * ev, G.COR.vinho, 2);
          seta(ct, x0, y0, x0 + (tg[0] + cp[0]) * ev, y0 - (tg[1] + cp[1]) * ev,
            G.COR.mestra, 2.6);
        });
      }

      /* pontos marcados por cima das setas */
      marcos.forEach(function (m) {
        var destaque = est.vista === 'decomp' && m === O;
        ct.beginPath();
        ct.arc(X(m.s), Y(m.s), destaque ? 5.5 : 4, 0, 2 * Math.PI);
        ct.fillStyle = destaque ? G.COR.bronze : '#fff';
        ct.fill();
        ct.strokeStyle = destaque ? G.COR.bronze : G.COR.mestra;
        ct.lineWidth = 2; ct.stroke();
        rotulo(ct, m.n, X(m.s) - 11, Y(m.s) - 11, G.COR.tinta);
      });

      /* centro do corpo */
      ct.beginPath(); ct.arc(cx, cy, 2.6, 0, 2 * Math.PI);
      ct.fillStyle = G.COR.suave; ct.fill();

      if (ci && est.vista !== 'acel' && Math.abs(ci[1]) * esc < alt) {
        ct.beginPath(); ct.arc(X(ci), Y(ci), 5, 0, 2 * Math.PI);
        ct.strokeStyle = G.COR.roxo; ct.lineWidth = 2;
        ct.setLineDash([3, 3]); ct.stroke(); ct.setLineDash([]);
        rotulo(ct, 'centro instantâneo', X(ci), Y(ci) - 14, G.COR.roxo,
          X(ci) > Lp - 90 ? 'right' : 'center');
      }

      /* legenda da vista */
      var leg = est.vista === 'decomp'
        ? [['translação v_O', G.COR.suave], ['rotação ω×s', G.COR.bronze],
           ['soma: v do ponto', G.COR.mestra]]
        : est.vista === 'acel'
          ? [['tangencial α×s', G.COR.bronze], ['centrípeta −ω²s', G.COR.vinho],
             ['soma: a do ponto', G.COR.mestra]]
          : [['v = v_C + ω ẑ × s', G.COR.mestra]];
      leg.forEach(function (l, i) {
        var y = 14 + i * 16;
        ct.fillStyle = l[1]; ct.fillRect(8, y - 3, 14, 3);
        rotulo(ct, l[0], 27, y, l[1], 'left');
      });

      var va = mod(vel(marcos[0].s)), vb = mod(vel(marcos[1].s)),
          vc = mod(vel(marcos[2].s));
      var sA = marcos[0].s;
      var aA = Math.sqrt(Math.pow(-est.al * sA[1] - est.w * est.w * sA[0], 2)
                       + Math.pow(est.al * sA[0] - est.w * est.w * sA[1], 2));
      mostrar({
        w: F.fmt(est.w, 2) + ' rad/s',
        va: F.fmt(va, 2), vb: F.fmt(vb, 2), vc: F.fmt(vc, 2),
        ci: ci ? ('a ' + F.fmt(Math.abs(ci[1]), 2) + ' m do centro') : 'não existe (ω = 0)',
        aa: F.fmt(aA, 2)
      });

      var comum = '<p>O corpo gira com velocidade angular \\(\\vet{\\omega}=\\omega\\vers{z}\\) '
        + 'e o seu centro translada com \\(\\vet{v}_C\\). A velocidade de um ponto qualquer é '
        + '\\[\\vet{v}=\\vet{v}_C+\\vet{\\omega}\\cruz\\vet{s},\\] '
        + 'com \\(\\vet{s}\\) medido a partir do centro.</p>';

      if (est.vista === 'campo') {
        nota.innerHTML = comum
          + '<p>Mexa em \\(\\theta\\) e repare: as setas mudam de ponto para ponto, e os três '
          + 'pontos marcados têm velocidades diferentes (' + F.fmt(va, 2) + ', '
          + F.fmt(vb, 2) + ' e ' + F.fmt(vc, 2) + ' m/s). <strong>Não existe "a velocidade '
          + 'do corpo".</strong> O que existe é um campo de velocidades.</p>'
          + '<p>Já \\(\\vet{\\omega}\\) é um só para o corpo inteiro. Essa assimetria é o '
          + 'resultado central da seção 5: a velocidade é uma propriedade do ponto, a '
          + 'velocidade angular é uma propriedade do movimento.</p>'
          + (ci ? '<p>O ponto roxo é o <strong>centro instantâneo de rotação</strong>, onde '
              + 'o campo se anula. Naquele instante o corpo gira em torno dele como se '
              + 'estivesse espetado ali. Ele não precisa estar dentro do corpo.</p>'
              : '<p>Com \\(\\omega=0\\) não há centro instantâneo: o movimento é uma '
              + 'translação pura e todos os pontos têm a mesma velocidade.</p>');
      } else if (est.vista === 'decomp') {
        nota.innerHTML = comum
          + '<p>Agora a mesma velocidade aparece quebrada em duas parcelas, '
          + '\\(\\vet{v}=\\vet{v}_O+\\vet{\\omega}\\cruz\\vet{s}_O\\), com \\(O\\) sendo o '
          + 'ponto ' + MARCOS[est.base].n + '. A seta cinza é igual para todos os pontos: é '
          + 'a translação. A seta bronze é a rotação em torno de ' + MARCOS[est.base].n + '.</p>'
          + '<p><strong>Troque o ponto de apoio nos botões acima.</strong> As duas parcelas '
          + 'mudam completamente, mas a seta verde, que é a soma, não se move. A separação '
          + 'entre translação e rotação é uma escolha de quem descreve; a velocidade de cada '
          + 'ponto é um fato. E \\(\\omega\\) é o mesmo nas três escolhas, que é o teorema de '
          + 'Chasles em ação.</p>';
      } else {
        nota.innerHTML = comum
          + '<p>Derivando a velocidade e tomando o centro como ponto sem aceleração,</p>'
          + '\\[\\vet{a}=\\underbrace{\\vet{\\alpha}\\cruz\\vet{s}}_{\\text{tangencial}}'
          + '+\\underbrace{\\vet{\\omega}\\cruz(\\vet{\\omega}\\cruz\\vet{s})}_{\\text{centrípeta}}'
          + '=\\vet{\\alpha}\\cruz\\vet{s}-\\omega^2\\vet{s}.\\]'
          + '<p>A parcela vinho aponta sempre para o eixo e existe mesmo com \\(\\alpha=0\\): '
          + 'é ela que mantém o ponto na circunferência. A parcela bronze só aparece quando a '
          + 'rotação acelera, e é perpendicular à primeira.</p>'
          + '<p>Zere \\(\\alpha\\) e varie \\(\\omega\\): só sobra a centrípeta, e ela cresce '
          + 'com o <em>quadrado</em> de \\(\\omega\\). Zere \\(\\omega\\) e varie \\(\\alpha\\): '
          + 'só sobra a tangencial, proporcional à distância ao eixo.</p>';
      }
      tipografar(corpo);
    }

    registrarRedesenho(desenhar);
  };

  /* =================================================================
     2. Rotações finitas não comutam
     É o ponto mais contraintuitivo do módulo e o único que justifica
     por que ω é vetor e φ não é. Mostrar os dois caminhos lado a lado
     resolve em dois segundos o que meia página de texto não resolve, e
     a segunda vista mede o desencontro para exibir que ele é de
     segunda ordem, que é exatamente a razão de o infinitesimal valer.
     ================================================================= */
  REGISTRO.comutam = function (raiz) {
    var est = { fi: 90, vista: 'caminhos' };

    var corpo = moldura(raiz, 'Rotações finitas não comutam');

    var c0 = el('div', { class: 'controles' });
    corpo.appendChild(c0);
    opcoes(c0, [
      { rot: 'Os dois caminhos', v: 'caminhos' },
      { rot: 'Quanto eles diferem', v: 'erro' }
    ], 0, function (v) { est.vista = v; desenhar(); });

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'ângulo de cada rotação φ', 0, 180, 1, 90,
      function (v) { est.fi = v; desenhar(); },
      function (v) { return v + '°'; });

    var mostrar = cartoes(corpo, [
      { rot: 'ângulo φ de cada giro', k: 'fi' },
      { rot: 'desencontro ψ entre os dois', k: 'psi' },
      { rot: 'previsão de segunda ordem φ²', k: 'q' },
      { rot: 'eixo do desencontro', k: 'eixo' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    /* a álgebra de matrizes e o desenho do cubo são compartilhados com
       os widgets de rotação do módulo 5, em M3 e desenhaCubo */
    var mul = M3.mul, transp = M3.transp,
        Rx = M3.Rx, Rz = M3.Rz, anguloEixo = M3.anguloEixo;
    var cubo = desenhaCubo;

    function desenharCaminhos() {
      var fi = est.fi * Math.PI / 180;
      var alt = 362;
      var p = G.preparar(cv, alt), ct = p.ct, Lp = p.L;
      ct.clearRect(0, 0, Lp, alt);

      /* cada fileira tem uma faixa de título em cima e a legenda do
         painel embaixo; o cubo fica na sobra entre as duas */
      var cols = 3, lg = Lp / cols, lin = (alt - 20) / 2;
      var s = Math.min(lg * 0.22, 37);
      var estreito = Lp < 560;

      var I = Rz(0);
      var seq = [
        { rot: 'primeiro em x, depois em z',
          ms: [I, Rx(fi), mul(Rz(fi), Rx(fi))],
          leg: ['inicial', 'após o giro em x',
                (estreito ? '' : 'resultado: ') + 'x e depois z'] },
        { rot: 'primeiro em z, depois em x',
          ms: [I, Rz(fi), mul(Rx(fi), Rz(fi))],
          leg: ['inicial', 'após o giro em z',
                (estreito ? '' : 'resultado: ') + 'z e depois x'] }
      ];

      seq.forEach(function (q, li) {
        var topo = 20 + lin * li, cy = topo + 90;
        q.ms.forEach(function (R, ci) {
          var cx = lg * ci + lg / 2;
          cubo(ct, cx, cy, s, R);
          rotulo(ct, q.leg[ci], cx, topo + lin - 14, G.COR.suave, 'center', 'middle',
            '600 10px system-ui, sans-serif');
        });
        rotulo(ct, q.rot, 8, topo + 9, li ? G.COR.bronze : G.COR.mestra,
          'left', 'middle');
        if (li) {
          ct.strokeStyle = G.COR.grade; ct.lineWidth = 1;
          ct.beginPath(); ct.moveTo(8, topo - 1); ct.lineTo(Lp - 8, topo - 1); ct.stroke();
        }
      });

      /* moldura em volta dos dois resultados, que é o que importa comparar */
      ct.save();
      ct.strokeStyle = G.COR.roxo; ct.lineWidth = 1.6; ct.setLineDash([5, 4]);
      ct.strokeRect(lg * 2 + 5, 18, lg - 10, alt - 26);
      ct.restore();
      rotulo(ct, 'compare', lg * 2 + lg / 2, 9, G.COR.roxo);
    }

    function desenharErro() {
      var gr = G.eixos(cv, {
        altura: 300, xmin: 0, xmax: 180, ymin: 0, ymax: 190,
        rotX: 'ângulo φ de cada rotação (graus)',
        rotY: 'desencontro ψ (graus)',
        marcasX: G.marcasLineares(0, 180, 6, 0),
        formataY: function (v) { return F.fmt(v, 0); }
      });
      var psi = function (g) {
        var f = g * Math.PI / 180;
        var C = mul(mul(Rz(f), Rx(f)), transp(mul(Rx(f), Rz(f))));
        return anguloEixo(C).ang * 180 / Math.PI;
      };
      var quad = function (g) {
        var f = g * Math.PI / 180;
        return f * f * 180 / Math.PI;
      };
      G.curva(gr, quad, G.COR.bronze, 2, [6, 5]);
      G.curva(gr, psi, G.COR.mestra, 2.6);
      G.vertical(gr, est.fi, G.COR.suave, '', true);
      rotulo(gr.ct, 'desencontro medido ψ(φ)', gr.X(96), gr.Y(psi(96)) - 14, G.COR.mestra);
      rotulo(gr.ct, 'previsão de 2.ª ordem: φ²', gr.X(52), gr.Y(quad(52)) + 16,
        G.COR.bronze);
    }

    function desenhar() {
      if (est.vista === 'caminhos') desenharCaminhos();
      else desenharErro();

      var f = est.fi * Math.PI / 180;
      var C = mul(mul(Rz(f), Rx(f)), transp(mul(Rx(f), Rz(f))));
      var ae = anguloEixo(C);
      /* dar o nome de um eixo cartesiano aqui engana: para φ = 90° o
         desencontro é em torno de uma diagonal do cubo, com as três
         componentes iguais. Melhor mostrar o versor. */
      var eixo = 'nenhum (comutam)';
      if (ae.eixo && ae.ang > 1e-4) {
        eixo = '(' + ae.eixo.map(function (c) { return F.fmt(c, 2); }).join('; ') + ')';
      }
      mostrar({
        fi: est.fi + '°',
        psi: F.fmt(ae.ang * 180 / Math.PI, 1) + '°',
        q: F.fmt(f * f * 180 / Math.PI, 1) + '°',
        eixo: eixo
      });

      nota.innerHTML =
        '<p>As duas fileiras partem do mesmo cubo e aplicam as mesmas duas rotações, de '
        + est.fi + '° cada, <strong>apenas em ordem trocada</strong>. A de cima gira primeiro '
        + 'em torno de \\(x\\) e depois de \\(z\\); a de baixo, o contrário. Os cubos da '
        + 'coluna da direita deveriam ser iguais se rotações se somassem como vetores. '
        + (est.fi === 0 ? 'Com φ = 0 nada acontece, claro.'
            : 'Com φ = ' + est.fi + '° eles diferem por uma rotação de '
              + F.fmt(ae.ang * 180 / Math.PI, 1) + '°.') + '</p>'
        + '<p>Em símbolos, \\(\\Ten{R}_z\\Ten{R}_x\\neq\\Ten{R}_x\\Ten{R}_z\\): as rotações '
        + 'formam um grupo <em>não comutativo</em>. Por isso um ângulo de rotação finito '
        + '<strong>não é um vetor</strong>, por mais que tenha módulo, direção e sentido. '
        + 'Falta-lhe a soma comutativa, que é parte da definição.</p>'
        + '<p>Mas olhe o que acontece quando φ encolhe. Escrevendo cada rotação pequena como '
        + '\\(\\Ten{R}=\\Ten{1}+\\Ten{A}\\), com \\(\\Ten{A}\\) antissimétrica e de ordem φ,</p>'
        + '\\[\\Ten{R}_1\\Ten{R}_2=\\Ten{1}+\\Ten{A}_1+\\Ten{A}_2+\\Ten{A}_1\\Ten{A}_2,\\]'
        + '<p>e o único termo que distingue as ordens é o produto \\(\\Ten{A}_1\\Ten{A}_2\\), '
        + 'que é de ordem \\(\\varphi^2\\). Em primeira ordem a soma é comutativa. A segunda '
        + 'vista mostra isso medido: o desencontro ψ acompanha a curva \\(\\varphi^2\\) para '
        + 'φ pequeno e só se descola dela quando os giros ficam grandes.</p>'
        + '<p>É essa a licença para tratar \\(\\vet{\\omega}=d\\vet{\\varphi}/dt\\) como '
        + 'vetor, e para somar velocidades angulares, '
        + '\\(\\vet{\\omega}_{31}=\\vet{\\omega}_{32}+\\vet{\\omega}_{21}\\), que é o que se '
        + 'usa o módulo inteiro. Rotações finitas não se somam; velocidades angulares, '
        + 'sim.</p>';
      tipografar(corpo);
    }

    registrarRedesenho(desenhar);
  };

  /* =================================================================
     3. Rolamento sem deslizamento
     O vínculo v = ωR não é hipótese, é consequência de o ponto de
     contato estar parado. A cicloide com bico no chão é a prova
     visual: a curva só faz bico onde a velocidade se anula. A segunda
     vista mostra o campo de velocidades e o centro instantâneo no
     contato, de onde sai |v| = 2Rω sen(θ/2) sem conta nenhuma.
     ================================================================= */
  REGISTRO.rolamento = function (raiz) {
    var R = 1;                       // raio em metros
    var est = { vista: 'traj', lam: 1, d: 1, w: 1.6, t: 0, rodando: true };

    var corpo = moldura(raiz, 'Rolamento: o ponto de contato está parado');

    var c0 = el('div', { class: 'controles' });
    corpo.appendChild(c0);
    opcoes(c0, [
      { rot: 'Trajetória de um ponto', v: 'traj' },
      { rot: 'Campo de velocidades', v: 'vel' }
    ], 0, function (v) { est.vista = v; });

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'razão v / ωR', 0, 2, 0.05, 1,
      function (v) { est.lam = v; }, function (v) { return F.fmt(v, 2); });
    deslizante(ctr, 'distância do ponto ao centro', 0, 1.5, 0.05, 1,
      function (v) { est.d = v; }, function (v) { return F.fmt(v, 2) + ' R'; });
    deslizante(ctr, 'velocidade angular ω', 0.4, 3, 0.1, 1.6,
      function (v) { est.w = v; }, function (v) { return F.fmt(v, 1) + ' rad/s'; });
    var bt = el('button', { type: 'button', texto: 'pausar' });
    bt.addEventListener('click', function () {
      est.rodando = !est.rodando;
      bt.textContent = est.rodando ? 'pausar' : 'continuar';
    });
    ctr.appendChild(bt);

    var mostrar = cartoes(corpo, [
      { rot: 'v do centro (m/s)', k: 'v' },
      { rot: 'ωR (m/s)', k: 'wr' },
      { rot: '|v| no topo (m/s)', k: 'topo' },
      { rot: '|v| no contato (m/s)', k: 'cont' },
      { rot: 'situação', k: 'sit' },
      { rot: 'comprimento de um arco', k: 'arco' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    /* posição do ponto marcado em função do ângulo girado */
    function ponto(fi) {
      return [est.lam * R * fi - est.d * Math.sin(fi), R - est.d * Math.cos(fi)];
    }

    function desenhar() {
      var alt = 282;
      var p = G.preparar(cv, alt), ct = p.ct, Lp = p.L;
      ct.clearRect(0, 0, Lp, alt);

      var fi = est.t;                       // ângulo já girado
      var volta = 2 * Math.PI;
      var xmax = Math.max(2.6, est.lam * volta + est.d);
      var ymax = R + Math.max(R, est.d) + 0.5;
      /* um teto na escala impede que a roda engula o quadro quando a
         janela é larga e a cicloide, curta */
      var esc = Math.min((Lp - 60) / xmax, (alt - 76) / ymax, 76);
      var x0 = 30, ych = alt - 42;          // chão
      var X = function (u) { return x0 + u * esc; };
      var Y = function (u) { return ych - u * esc; };

      /* chão */
      ct.strokeStyle = G.COR.suave; ct.lineWidth = 2;
      ct.beginPath(); ct.moveTo(0, ych); ct.lineTo(Lp, ych); ct.stroke();
      ct.fillStyle = 'rgba(91,103,115,.10)';
      ct.fillRect(0, ych, Lp, alt - ych);

      var xc = est.lam * R * fi;            // centro da roda
      var cxp = X(xc), cyp = Y(R);

      if (est.vista === 'traj') {
        /* curva já percorrida e o que ainda falta */
        var fmax = est.lam > 0.05 ? volta : 2.4;
        ct.lineWidth = 2;
        [[0, fi, G.COR.mestra, null], [fi, fmax, 'rgba(23,107,93,.28)', [5, 4]]]
          .forEach(function (tr) {
            if (tr[1] <= tr[0]) return;
            ct.beginPath();
            ct.strokeStyle = tr[2];
            ct.setLineDash(tr[3] || []);
            for (var k = 0; k <= 160; k++) {
              var f = tr[0] + (tr[1] - tr[0]) * k / 160, q = ponto(f);
              (k ? ct.lineTo : ct.moveTo).call(ct, X(q[0]), Y(q[1]));
            }
            ct.stroke(); ct.setLineDash([]);
          });
      }

      /* roda */
      ct.beginPath(); ct.arc(cxp, cyp, R * esc, 0, 2 * Math.PI);
      ct.fillStyle = 'rgba(23,107,93,.09)'; ct.fill();
      ct.strokeStyle = G.COR.mestra; ct.lineWidth = 2.4; ct.stroke();
      /* raios, para a rotação ficar visível */
      for (var j = 0; j < 6; j++) {
        var a = -fi + j * Math.PI / 3;
        ct.beginPath();
        ct.moveTo(cxp, cyp);
        ct.lineTo(cxp + R * esc * Math.cos(a), cyp - R * esc * Math.sin(a));
        ct.strokeStyle = 'rgba(23,107,93,.35)'; ct.lineWidth = 1.2; ct.stroke();
      }
      ct.beginPath(); ct.arc(cxp, cyp, 3, 0, 2 * Math.PI);
      ct.fillStyle = G.COR.mestra; ct.fill();

      var vcm = est.lam * est.w * R;
      var ev = Math.min(esc * 0.34, 26);

      if (est.vista === 'traj') {
        var q = ponto(fi);
        ct.beginPath(); ct.arc(X(q[0]), Y(q[1]), 5.5, 0, 2 * Math.PI);
        ct.fillStyle = G.COR.bronze; ct.fill();
        ct.strokeStyle = '#fff'; ct.lineWidth = 1.6; ct.stroke();
        ct.beginPath();
        ct.moveTo(cxp, cyp); ct.lineTo(X(q[0]), Y(q[1]));
        ct.strokeStyle = G.COR.bronze; ct.lineWidth = 1.6; ct.stroke();
      } else {
        /* campo de velocidades na borda */
        for (var k2 = 0; k2 < 12; k2++) {
          var th = -fi + k2 * Math.PI / 6;
          var sx = R * Math.cos(th), sy = R * Math.sin(th);
          var vx = vcm + est.w * sy, vy = -est.w * sx;
          /* v = (v_cm,0) + (−ω ẑ) × s, com s = (sx, sy) */
          var px = cxp + sx * esc, py = cyp - sy * esc;
          seta(ct, px, py, px + vx * ev, py - vy * ev, G.COR.mestra, 1.8);
        }
        /* topo e contato em destaque */
        [[0, R, G.COR.vinho, 'topo'], [0, -R, G.COR.roxo, 'contato']].forEach(function (m) {
          var vx = vcm + est.w * m[1], px = cxp, py = cyp - m[1] * esc;
          seta(ct, px, py, px + vx * ev, py, m[2], 2.8);
          ct.beginPath(); ct.arc(px, py, 4.5, 0, 2 * Math.PI);
          ct.fillStyle = '#fff'; ct.fill();
          ct.strokeStyle = m[2]; ct.lineWidth = 2; ct.stroke();
          rotulo(ct, m[3], px, py + (m[1] > 0 ? -16 : 16), m[2]);
        });
        seta(ct, cxp, cyp, cxp + vcm * ev, cyp, G.COR.bronze, 2.4);
      }

      var contato = Math.abs(vcm - est.w * R);
      var sit = Math.abs(est.lam - 1) < 0.03 ? 'rolamento puro'
        : est.lam > 1 ? 'derrapa para a frente' : 'patina no lugar';
      mostrar({
        v: F.fmt(vcm, 2), wr: F.fmt(est.w * R, 2),
        topo: F.fmt(vcm + est.w * R, 2), cont: F.fmt(contato, 2),
        sit: sit,
        arco: (Math.abs(est.lam - 1) < 0.03 && Math.abs(est.d - 1) < 0.03)
          ? '8R = ' + F.fmt(8 * R, 1) + ' m' : 'só vale 8R na cicloide'
      });
    }

    function texto() {
      var vcm = est.lam * est.w * R;
      var comum = '<p>A roda tem raio \\(R\\) e gira com velocidade angular \\(\\omega\\) '
        + 'enquanto o centro avança com \\(v\\). A velocidade do ponto do pneu que toca o '
        + 'chão é \\(v-\\omega R\\). <strong>Rolar sem deslizar é exigir que ela seja '
        + 'zero</strong>, e é só isso: o vínculo \\(v=\\omega R\\) não é uma hipótese extra, '
        + 'é a tradução de "o pneu não desliza sobre o asfalto".</p>';
      if (est.vista === 'traj') {
        nota.innerHTML = comum
          + '<p>A curva desenhada é o rastro do ponto bronze. Com \\(v=\\omega R\\) e o ponto '
          + 'na borda, ela é a <strong>cicloide</strong>, e o detalhe que interessa é o '
          + '<em>bico</em> que ela faz a cada volta, exatamente no chão. Uma curva só faz bico '
          + 'onde a velocidade se anula, e a velocidade ali se anula porque aquele é o ponto '
          + 'de contato. O bico é a assinatura geométrica do vínculo.</p>'
          + '<p>Puxe o deslizante da distância para dentro da roda: a curva perde o bico e '
          + 'vira uma cicloide encurtada, porque esse ponto nunca chega a parar. Puxe para '
          + 'fora de \\(R\\), como um ponto no friso de uma roda de trem, e aparece uma alça: '
          + 'naquele trecho o ponto <strong>anda para trás</strong> em relação ao solo, embora '
          + 'o trem inteiro vá para a frente.</p>'
          + '<p>Mexa agora na razão \\(v/\\omega R\\). Acima de 1 a roda derrapa, abaixo de 1 '
          + 'ela patina, e nos dois casos o bico some: não há mais nenhum instante em que o '
          + 'contato esteja parado. Um arco inteiro da cicloide tem comprimento \\(8R\\) e '
          + 'encerra área \\(3\\pi R^2\\), resultados que foram motivo de disputa no século '
          + 'XVII.</p>';
      } else {
        nota.innerHTML = comum
          + '<p>Como o contato está parado, ele é o <strong>centro instantâneo de rotação</strong>: '
          + 'naquele instante a roda inteira gira em torno dele. Daí sai de graça a velocidade '
          + 'de qualquer ponto, que é \\(\\omega\\) vezes a distância até o contato:</p>'
          + '\\[|\\vet{v}|=\\omega\\,\\overline{PC}=2R\\omega\\,\\sen\\frac{\\theta}{2},\\]'
          + '<p>com \\(\\theta\\) medido a partir do contato. No topo, \\(\\theta=\\pi\\) e '
          + '\\(|\\vet{v}|=2R\\omega=2v\\): <strong>o alto do pneu anda ao dobro da velocidade '
          + 'do carro</strong>, que hoje vale ' + F.fmt(vcm, 2) + ' m/s. No eixo, '
          + '\\(\\theta=\\pi/2\\) e sai \\(\\sqrt2\\,v\\)? Não: o eixo está a \\(R\\) do '
          + 'contato, e dá \\(v\\), como tem de ser.</p>'
          + '<p>As setas formam um leque que cresce linearmente com a altura, igual ao campo '
          + 'de velocidades de um corpo girando em torno de um eixo fixo, porque é isso mesmo '
          + 'que ele é naquele instante. O eixo instantâneo, porém, muda de lugar a cada '
          + 'instante: ele caminha junto com o ponto de contato.</p>';
      }
      tipografar(corpo);
    }

    var ultimoTexto = '';
    function quadro() {
      if (est.rodando) {
        est.t += 0.016 * est.w;
        var lim = est.lam > 0.05 ? 2 * Math.PI : 2.4;
        if (est.t > lim) est.t -= lim;
      }
      desenhar();
      var chave = est.vista + '|' + F.fmt(est.lam * est.w * R, 2);
      if (chave !== ultimoTexto) { ultimoTexto = chave; texto(); }
      requestAnimationFrame(quadro);
    }

    texto();
    requestAnimationFrame(quadro);
    registrarRedesenho(desenhar);
  };


  /* =================================================================
     4. Momento de inércia: catálogo e teorema de Steiner
     O catálogo em barras deixa visível o único conteúdo físico do
     momento de inércia, que é quão longe do eixo a massa está: a casca
     esférica bate a esfera maciça e o aro bate as duas, com a mesma
     massa e o mesmo raio. A parábola de Steiner mostra de uma vez que
     o eixo pelo centro de massa é sempre o de menor inércia.
     ================================================================= */
  REGISTRO.inercia = function (raiz) {
    /* k é o fator adimensional em I = k M R², ou I = k M L² na haste */
    var CORPOS = [
      { n: 'esfera maciça', k: 2 / 5, f: '\\tfrac25 MR^2', tipo: 'esfera' },
      { n: 'cilindro maciço', k: 1 / 2, f: '\\tfrac12 MR^2', tipo: 'disco' },
      { n: 'casca esférica', k: 2 / 3, f: '\\tfrac23 MR^2', tipo: 'casca' },
      { n: 'aro ou cilindro oco', k: 1, f: 'MR^2', tipo: 'aro' },
      { n: 'disco, eixo diametral', k: 1 / 4, f: '\\tfrac14 MR^2', tipo: 'diam' }
    ];
    var est = { vista: 'catalogo', k: 1, d: 0.8 };

    var corpo = moldura(raiz, 'Momento de inércia: catálogo e teorema de Steiner');

    var c0 = el('div', { class: 'controles' });
    corpo.appendChild(c0);
    opcoes(c0, [
      { rot: 'Catálogo', v: 'catalogo' },
      { rot: 'Teorema de Steiner', v: 'steiner' }
    ], 0, function (v) { est.vista = v; desenhar(); });

    var c1 = el('div', { class: 'controles' });
    corpo.appendChild(c1);
    c1.appendChild(el('span', { class: 'etiqueta', texto: 'corpo' }));
    opcoes(c1, CORPOS.map(function (c, i) { return { rot: c.n, v: i }; }), 1,
      function (v) { est.k = v; desenhar(); });

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'distância do eixo ao centro de massa', 0, 2.5, 0.05, 0.8,
      function (v) { est.d = v; desenhar(); },
      function (v) { return F.fmt(v, 2) + ' R'; });

    var mostrar = cartoes(corpo, [
      { rot: 'corpo', k: 'nome' },
      { rot: 'I pelo centro de massa', k: 'icm' },
      { rot: 'distância do eixo', k: 'd' },
      { rot: 'I pelo eixo deslocado', k: 'i' },
      { rot: 'raio de giração', k: 'kg' },
      { rot: 'quanto Steiner acrescenta', k: 'razao' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    /* desenha a seção transversal de cada corpo, em px */
    function figura(ct, cx, cy, r, tipo) {
      ct.save();
      ct.lineWidth = 2;
      ct.strokeStyle = G.COR.mestra;
      if (tipo === 'aro') {
        ct.beginPath(); ct.arc(cx, cy, r, 0, 2 * Math.PI);
        ct.lineWidth = Math.max(3, r * 0.26);
        ct.stroke();
      } else if (tipo === 'casca') {
        ct.beginPath(); ct.arc(cx, cy, r, 0, 2 * Math.PI);
        ct.lineWidth = Math.max(2.5, r * 0.16);
        ct.stroke();
        ct.lineWidth = 1; ct.setLineDash([2, 3]);
        ct.beginPath(); ct.arc(cx, cy, r * 0.84, 0, 2 * Math.PI); ct.stroke();
        ct.setLineDash([]);
      } else if (tipo === 'diam') {
        ct.beginPath(); ct.arc(cx, cy, r, 0, 2 * Math.PI);
        ct.fillStyle = 'rgba(23,107,93,.18)'; ct.fill(); ct.stroke();
        ct.strokeStyle = G.COR.bronze; ct.lineWidth = 2; ct.setLineDash([4, 3]);
        ct.beginPath(); ct.moveTo(cx - r * 1.25, cy); ct.lineTo(cx + r * 1.25, cy);
        ct.stroke(); ct.setLineDash([]);
      } else {
        ct.beginPath(); ct.arc(cx, cy, r, 0, 2 * Math.PI);
        var g = ct.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
        g.addColorStop(0, tipo === 'esfera' ? 'rgba(23,107,93,.42)' : 'rgba(23,107,93,.24)');
        g.addColorStop(1, 'rgba(23,107,93,.16)');
        ct.fillStyle = g; ct.fill(); ct.stroke();
        if (tipo === 'disco') {
          ct.lineWidth = 1;
          ct.beginPath(); ct.moveTo(cx, cy); ct.lineTo(cx, cy - r); ct.stroke();
        }
      }
      ct.restore();
    }

    function desenhaCatalogo() {
      var alt = 322;
      var p = G.preparar(cv, alt), ct = p.ct, Lp = p.L;
      ct.clearRect(0, 0, Lp, alt);

      var n = CORPOS.length, lg = Lp / n;
      var r = Math.min(lg * 0.26, 30);
      /* a folga de 26 px abaixo da figura é para o número no topo da
         barra mais alta não encostar nela */
      var yFig = 44, yBase = alt - 58, hMax = yBase - (yFig + r + 26);

      ct.strokeStyle = G.COR.grade; ct.lineWidth = 1;
      ct.beginPath(); ct.moveTo(10, yBase); ct.lineTo(Lp - 10, yBase); ct.stroke();

      CORPOS.forEach(function (c, i) {
        var cx = lg * i + lg / 2;
        figura(ct, cx, yFig, r, c.tipo);
        var h = hMax * c.k;
        var larg = Math.min(lg * 0.44, 46);
        ct.fillStyle = i === est.k ? G.COR.mestra : 'rgba(23,107,93,.34)';
        ct.fillRect(cx - larg / 2, yBase - h, larg, h);
        rotulo(ct, F.fmt(c.k, 2), cx, yBase - h - 10,
          i === est.k ? G.COR.mestra : G.COR.suave);
        var palavras = c.n.split(' ');
        var linhas = lg < 130 && palavras.length > 1
          ? [palavras.slice(0, Math.ceil(palavras.length / 2)).join(' '),
             palavras.slice(Math.ceil(palavras.length / 2)).join(' ')]
          : [c.n];
        linhas.forEach(function (t, j) {
          rotulo(ct, t, cx, yBase + 14 + j * 13, G.COR.tinta, 'center', 'middle',
            '600 10px system-ui, sans-serif');
        });
      });

      rotulo(ct, 'fator k em I = k M R², com a mesma massa e o mesmo raio',
        10, alt - 8, G.COR.suave, 'left');
    }

    function desenhaSteiner() {
      var c = CORPOS[est.k];
      var gr = G.eixos(cv, {
        altura: 300, xmin: -2.5, xmax: 2.5, ymin: 0, ymax: c.k + 6.4,
        rotX: 'posição do eixo, em raios a partir do centro de massa',
        rotY: 'I / M R²',
        marcasX: G.marcasLineares(-2.5, 2.5, 10, 1),
        formataY: function (v) { return F.fmt(v, 1); }
      });
      var f = function (x) { return c.k + x * x; };
      G.area(gr, f, -2.5, 2.5, 'rgba(23,107,93,.10)');
      G.curva(gr, function () { return c.k; }, G.COR.bronze, 2, [6, 5]);
      G.curva(gr, f, G.COR.mestra, 2.6);
      G.vertical(gr, est.d, G.COR.roxo, '', true);

      var ct = gr.ct;
      /* o ponto de operação e as duas parcelas */
      var y0 = gr.Y(0), yc = gr.Y(c.k), yt = gr.Y(f(est.d)), px = gr.X(est.d);
      ct.beginPath(); ct.arc(px, yt, 5, 0, 2 * Math.PI);
      ct.fillStyle = G.COR.roxo; ct.fill();
      seta(ct, px - 26, y0, px - 26, yc, G.COR.bronze, 1.8);
      seta(ct, px - 26, yc, px - 26, yt, G.COR.roxo, 1.8);
      rotulo(ct, 'I_cm', px - 32, (y0 + yc) / 2, G.COR.bronze, 'right');
      rotulo(ct, 'M d²', px - 32, (yc + yt) / 2, G.COR.roxo, 'right');
      rotulo(ct, 'mínimo no centro de massa', gr.X(0), yc - 16, G.COR.bronze);

      /* a figura do corpo com o eixo deslocado, no canto */
      var r = 24, cx = gr.x1 - 64, cy = gr.y0 + 46;
      if (gr.L > 520) {
        figura(ct, cx, cy, r, c.tipo);
        var dx = est.d * r;
        ct.strokeStyle = G.COR.roxo; ct.lineWidth = 2;
        ct.beginPath(); ct.moveTo(cx + dx, cy - r - 12); ct.lineTo(cx + dx, cy + r + 12);
        ct.stroke();
        rotulo(ct, 'eixo', cx + dx, cy + r + 20, G.COR.roxo);
      }
    }

    function desenhar() {
      var c = CORPOS[est.k];
      if (est.vista === 'catalogo') desenhaCatalogo();
      else desenhaSteiner();

      var I = c.k + est.d * est.d;
      mostrar({
        nome: c.n,
        icm: F.fmt(c.k, 3) + ' MR²',
        d: F.fmt(est.d, 2) + ' R',
        i: F.fmt(I, 3) + ' MR²',
        kg: F.fmt(Math.sqrt(I), 3) + ' R',
        razao: F.fmt(I / c.k, 2) + ' vezes'
      });

      if (est.vista === 'catalogo') {
        nota.innerHTML =
          '<p>Todos os cinco corpos têm a <strong>mesma massa e o mesmo raio</strong>. A '
          + 'barra é o fator \\(k\\) em \\(I=kMR^2\\), e a ordem não é arbitrária: ela mede '
          + 'apenas <em>quão longe do eixo a massa foi colocada</em>.</p>'
          + '<p>O aro tem toda a massa em \\(R\\), e por isso \\(k=1\\), o maior possível '
          + 'para um corpo que cabe dentro do raio \\(R\\). A casca esférica tem a massa toda '
          + 'na superfície, mas parte dela perto dos polos, onde a distância ao eixo é '
          + 'pequena, e cai para \\(2/3\\). A esfera maciça ainda enche o miolo e cai para '
          + '\\(2/5\\). Nada disso depende do material nem do tamanho.</p>'
          + '<p>\\[I=\\sum_i m_i\\rho_i^2=\\int \\rho^2\\,dm,\\]</p>'
          + '<p>com \\(\\rho\\) medido <em>até o eixo</em>, não até o centro. É esse detalhe '
          + 'que separa o disco girando como um pião (\\(k=1/2\\)) do mesmo disco girando em '
          + 'torno de um diâmetro (\\(k=1/4\\)): no segundo caso cada ponto está mais perto do '
          + 'eixo. Repare que \\(1/4+1/4=1/2\\), que é o <strong>teorema dos eixos '
          + 'perpendiculares</strong> para lâminas, \\(I_z=I_x+I_y\\).</p>';
      } else {
        nota.innerHTML =
          '<p>Para um eixo paralelo ao que passa pelo centro de massa, afastado de \\(d\\),</p>'
          + '\\[I=I_{\\rm cm}+Md^2,\\]'
          + '<p>que é o <strong>teorema dos eixos paralelos</strong>, ou teorema de Steiner. '
          + 'A curva verde é essa parábola para o corpo escolhido; a reta bronze é '
          + '\\(I_{\\rm cm}\\), e a diferença entre as duas é a parcela \\(Md^2\\).</p>'
          + '<p>Duas leituras saltam do gráfico. A primeira é que <strong>o eixo pelo centro '
          + 'de massa é sempre o de menor momento de inércia</strong>, porque \\(Md^2\\) nunca '
          + 'é negativo: o mínimo da parábola está em \\(d=0\\). A segunda é que a parcela '
          + 'acrescentada não sabe nada sobre a forma do corpo, só sobre a massa total e a '
          + 'distância. Aqui ela já multiplica \\(I_{\\rm cm}\\) por '
          + F.fmt((CORPOS[est.k].k + est.d * est.d) / CORPOS[est.k].k, 2) + '.</p>'
          + '<p>Por isso, para \\(d\\) grande, todos os corpos convergem: a partir de umas '
          + 'poucas vezes o raio, qualquer objeto gira como se fosse uma massa pontual presa '
          + 'a um fio. A Terra em torno do Sol é esse caso extremo.</p>'
          + '<p>O <strong>raio de giração</strong> \\(k_g=\\sqrt{I/M}\\), que o cartão exibe, '
          + 'é a distância em que seria preciso pôr toda a massa, concentrada, para obter o '
          + 'mesmo \\(I\\).</p>';
      }
      tipografar(corpo);
    }

    registrarRedesenho(desenhar);
  };

  /* =================================================================
     5. O centro de massa se move como uma partícula
     Lançar um objeto girando e desenhar dois rastros resolve a seção
     em silêncio: o da ponta é uma confusão, o do centro de massa é a
     parábola de sempre. A vista de energia mostra o teorema de König,
     com a parcela de rotação constante porque a gravidade não exerce
     torque em torno do centro de massa.
     ================================================================= */
  REGISTRO.centromassa = function (raiz) {
    var G0 = 9.80665, V0 = 8, L = 1;
    var est = { vista: 'rastro', ang: 55, w: 7, razao: 1, t: 0, rodando: true };

    var corpo = moldura(raiz, 'O centro de massa se move como uma partícula');

    var c0 = el('div', { class: 'controles' });
    corpo.appendChild(c0);
    opcoes(c0, [
      { rot: 'Os dois rastros', v: 'rastro' },
      { rot: 'As parcelas da energia', v: 'energia' }
    ], 0, function (v) { est.vista = v; });

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'ângulo de lançamento', 20, 80, 1, 55,
      function (v) { est.ang = v; }, function (v) { return v + '°'; });
    deslizante(ctr, 'rotação ω', 0, 14, 0.5, 7,
      function (v) { est.w = v; }, function (v) { return F.fmt(v, 1) + ' rad/s'; });
    deslizante(ctr, 'razão entre as massas m₁/m₂', 0.2, 5, 0.1, 1,
      function (v) { est.razao = v; }, function (v) { return F.fmt(v, 1); });
    var bt = el('button', { type: 'button', texto: 'pausar' });
    bt.addEventListener('click', function () {
      est.rodando = !est.rodando;
      bt.textContent = est.rodando ? 'pausar' : 'continuar';
    });
    ctr.appendChild(bt);

    var mostrar = cartoes(corpo, [
      { rot: 'I em torno do centro de massa', k: 'icm' },
      { rot: 'energia de translação (J)', k: 'tt' },
      { rot: 'energia de rotação (J)', k: 'tr' },
      { rot: 'energia potencial (J)', k: 'u' },
      { rot: 'soma das três (J)', k: 'tot' },
      { rot: 'tempo de voo', k: 'tv' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    /* massas nas pontas de uma haste de comprimento L, massa total 1 kg */
    function geo() {
      var m1 = est.razao / (1 + est.razao), m2 = 1 - m1;
      /* distâncias das pontas ao centro de massa */
      return { m1: m1, m2: m2, d1: L * m2, d2: L * m1, I: L * L * m1 * m2 };
    }
    function voo() {
      var a = est.ang * Math.PI / 180;
      return { vx: V0 * Math.cos(a), vy: V0 * Math.sin(a), T: 2 * V0 * Math.sin(a) / G0 };
    }
    /* o lançamento parte de uma altura igual ao raio do corpo, para a
       haste não começar enterrada no chão */
    function y0() { var g = geo(); return Math.max(g.d1, g.d2) + 0.15; }
    function cm(t) {
      var v = voo();
      return [v.vx * t, y0() + v.vy * t - 0.5 * G0 * t * t];
    }
    function pontas(t) {
      var g = geo(), c = cm(t), th = est.w * t + 0.4;
      var u = [Math.cos(th), Math.sin(th)];
      return [[c[0] - g.d1 * u[0], c[1] - g.d1 * u[1]],
              [c[0] + g.d2 * u[0], c[1] + g.d2 * u[1]]];
    }

    function desenhaRastro() {
      var v = voo(), alt = 300;
      var p = G.preparar(cv, alt), ct = p.ct, Lp = p.L;
      ct.clearRect(0, 0, Lp, alt);

      var g = geo();
      var alcance = v.vx * v.T, altura = v.vy * v.vy / (2 * G0);
      var folga = Math.max(g.d1, g.d2) + 0.15;
      var esc = Math.min((Lp - 50) / (alcance + 2 * folga),
                         (alt - 40) / (y0() + altura + folga));
      /* sem linha de chão: o lançamento parte e chega a y0, e uma reta
         ali embaixo faria o voo parecer terminar no ar */
      var x0 = 25 + folga * esc, ych = alt - 14;
      var X = function (u) { return x0 + u * esc; };
      var Y = function (u) { return ych - u * esc; };

      /* rastro da ponta pesada: a confusão */
      ct.beginPath(); ct.strokeStyle = 'rgba(168,96,31,.75)'; ct.lineWidth = 1.6;
      for (var k = 0; k <= 400; k++) {
        var t = v.T * k / 400 * Math.min(1, est.t / v.T), q = pontas(t)[0];
        if (est.t <= 0) break;
        (k ? ct.lineTo : ct.moveTo).call(ct, X(q[0]), Y(q[1]));
      }
      ct.stroke();

      /* rastro do centro de massa: a parábola */
      ct.beginPath(); ct.strokeStyle = G.COR.mestra; ct.lineWidth = 2.4;
      for (var k2 = 0; k2 <= 200; k2++) {
        var t2 = Math.min(est.t, v.T) * k2 / 200, q2 = cm(t2);
        (k2 ? ct.lineTo : ct.moveTo).call(ct, X(q2[0]), Y(q2[1]));
      }
      ct.stroke();
      /* o que ainda falta, tracejado */
      ct.beginPath(); ct.strokeStyle = 'rgba(23,107,93,.3)'; ct.lineWidth = 2;
      ct.setLineDash([5, 4]);
      for (var k3 = 0; k3 <= 200; k3++) {
        var t3 = Math.min(est.t, v.T) + (v.T - Math.min(est.t, v.T)) * k3 / 200;
        var q3 = cm(t3);
        (k3 ? ct.lineTo : ct.moveTo).call(ct, X(q3[0]), Y(q3[1]));
      }
      ct.stroke(); ct.setLineDash([]);

      /* o corpo */
      var tt = Math.min(est.t, v.T), c = cm(tt), pt = pontas(tt);
      ct.strokeStyle = G.COR.tinta; ct.lineWidth = 2.4;
      ct.beginPath(); ct.moveTo(X(pt[0][0]), Y(pt[0][1]));
      ct.lineTo(X(pt[1][0]), Y(pt[1][1])); ct.stroke();
      [[pt[0], g.m1, G.COR.bronze], [pt[1], g.m2, G.COR.azul]].forEach(function (b) {
        ct.beginPath();
        ct.arc(X(b[0][0]), Y(b[0][1]), 4 + 9 * Math.pow(b[1], 1 / 3), 0, 2 * Math.PI);
        ct.fillStyle = b[2]; ct.fill();
      });
      ct.beginPath(); ct.arc(X(c[0]), Y(c[1]), 4.5, 0, 2 * Math.PI);
      ct.fillStyle = '#fff'; ct.fill();
      ct.strokeStyle = G.COR.mestra; ct.lineWidth = 2.4; ct.stroke();

      rotulo(ct, 'rastro da ponta', 10, 14, G.COR.bronze, 'left');
      rotulo(ct, 'rastro do centro de massa: uma parábola', 10, 30, G.COR.mestra, 'left');
    }

    function desenhaEnergia() {
      var v = voo(), g = geo();
      var Tr = 0.5 * g.I * est.w * est.w;
      var gr = G.eixos(cv, {
        altura: 300, xmin: 0, xmax: v.T, ymin: 0, ymax: (0.5 * V0 * V0 + Tr) * 1.22,
        rotX: 'tempo (s)', rotY: 'energia (J)',
        marcasX: G.marcasLineares(0, v.T, 5, 2),
        formataY: function (x) { return F.fmt(x, 0); }
      });
      var fU = function (t) { return G0 * cm(t)[1]; };
      var fUT = function (t) {
        var vy = v.vy - G0 * t;
        return G0 * cm(t)[1] + 0.5 * (v.vx * v.vx + vy * vy);
      };
      var fTot = function (t) { return fUT(t) + Tr; };

      /* faixas opacas, desenhadas da maior para a menor: empilhar
         camadas translúcidas dá um cinza que não lembra nenhuma delas */
      G.area(gr, fTot, 0, v.T, '#d7e9e4');
      G.area(gr, fUT, 0, v.T, '#f0e4d2');
      G.area(gr, fU, 0, v.T, '#dce6f0');
      G.curva(gr, fU, G.COR.azul, 2.2);
      G.curva(gr, fUT, G.COR.bronze, 2.2);
      G.curva(gr, fTot, G.COR.mestra, 2.6);
      G.vertical(gr, Math.min(est.t, v.T), G.COR.suave, '', true);

      var ct = gr.ct;
      rotulo(ct, 'potencial M g y', gr.X(v.T * 0.5), gr.Y(fU(v.T * 0.5)) + 14, '#20486c');
      rotulo(ct, '+ translação ½MV²', gr.X(v.T * 0.18),
        gr.Y((fU(v.T * 0.18) + fUT(v.T * 0.18)) / 2), '#7a4a12', 'left');
      rotulo(ct, '+ rotação ½Iω², constante', gr.X(v.T * 0.5),
        gr.Y((fUT(v.T * 0.5) + fTot(v.T * 0.5)) / 2), G.COR.mestra);
    }

    function desenhar() {
      if (est.vista === 'rastro') desenhaRastro();
      else desenhaEnergia();

      var v = voo(), g = geo(), t = Math.min(est.t, v.T);
      var vy = v.vy - G0 * t;
      var Tt = 0.5 * (v.vx * v.vx + vy * vy), Tr = 0.5 * g.I * est.w * est.w;
      var U = G0 * cm(t)[1];
      mostrar({
        icm: F.fmt(g.I, 3) + ' kg·m²',
        tt: F.fmt(Tt, 2), tr: F.fmt(Tr, 2), u: F.fmt(U, 2),
        tot: F.fmt(Tt + Tr + U, 2), tv: F.fmt(v.T, 2) + ' s'
      });
    }

    function texto() {
      var g = geo();
      var comum = '<p>Duas massas nas pontas de uma haste de 1 m, somando 1 kg, lançadas a '
        + V0 + ' m/s. A razão \\(m_1/m_2\\) desloca o centro de massa ao longo da haste, e '
        + 'o momento de inércia em torno dele vale '
        + '\\(I_{\\rm cm}=m_1d_1^2+m_2d_2^2=\\mu L^2\\), com \\(\\mu=m_1m_2/M\\) a massa '
        + 'reduzida: aqui, ' + F.fmt(g.I, 3) + ' kg·m².</p>';
      if (est.vista === 'rastro') {
        nota.innerHTML = comum
          + '<p>A ponta descreve uma curva complicada, que muda inteiramente quando se mexe '
          + 'em \\(\\omega\\) ou nas massas. O centro de massa, não: ele traça a mesma '
          + 'parábola de um projétil pontual, e <strong>nenhum dos deslizantes a altera</strong>, '
          + 'exceto o ângulo de lançamento.</p>'
          + '<p>A razão está em somar \\(\\vet{F}_i=m_i\\ddot{\\vet{r}}_i\\) sobre todas as '
          + 'partículas. Pela terceira lei, as forças internas se cancelam aos pares, e sobra</p>'
          + '\\[\\vet{F}^{\\rm ext}=M\\ddot{\\vet{R}},\\qquad \\vet{R}=\\frac1M\\sum_i m_i\\vet{r}_i.\\]'
          + '<p>É a segunda lei de Newton outra vez, agora para um ponto que talvez nem seja '
          + 'material. Essa é a justificativa de tratar bolas, cometas e planetas como '
          + 'partículas: o que se estava descrevendo o tempo todo era o centro de massa.</p>'
          + '<p>Como corolário, \\(\\vet{P}=M\\vet{V}_{\\rm cm}\\) e, sem força externa, o '
          + 'centro de massa segue em linha reta por mais violenta que seja a agitação '
          + 'interna. Uma granada que explode no ar tem os estilhaços espalhados, mas o '
          + 'centro de massa dos estilhaços continua na parábola original até o primeiro '
          + 'tocar o chão.</p>';
      } else {
        nota.innerHTML = comum
          + '<p>Separando cada posição em \\(\\vet{r}_i=\\vet{R}+\\vet{r}\\,\'_i\\) e usando '
          + 'que \\(\\sum_i m_i\\vet{r}\\,\'_i=\\vet 0\\) por definição de centro de massa, o '
          + 'termo cruzado da energia cinética morre e sobra o <strong>teorema de '
          + 'König</strong>:</p>'
          + '\\[T=\\underbrace{\\tfrac12 MV_{\\rm cm}^2}_{\\text{translação}}'
          + '+\\underbrace{\\tfrac12 I_{\\rm cm}\\omega^2}_{\\text{rotação}}.\\]'
          + '<p>No gráfico, a faixa azul é a energia potencial, a bronze é a translação e a '
          + 'verde é a rotação. As duas primeiras trocam de lugar o tempo todo, como em '
          + 'qualquer lançamento; a <strong>faixa de rotação tem espessura constante</strong>, '
          + 'e esse é o conteúdo físico da figura: a gravidade age no centro de massa e '
          + 'portanto não exerce torque em torno dele. Sem torque, \\(\\omega\\) não muda.</p>'
          + '<p>A soma das três é uma reta horizontal, que é a conservação da energia. '
          + 'Experimente \\(\\omega=0\\): a faixa verde some e fica o lançamento de sempre.</p>';
      }
      tipografar(corpo);
    }

    var chaveAnt = '';
    function quadro() {
      var v = voo();
      if (est.rodando) {
        est.t += 0.016;
        if (est.t > v.T + 0.45) est.t = 0;
      }
      desenhar();
      var chave = est.vista + '|' + F.fmt(geo().I, 3);
      if (chave !== chaveAnt) { chaveAnt = chave; texto(); }
      requestAnimationFrame(quadro);
    }

    texto();
    requestAnimationFrame(quadro);
    registrarRedesenho(desenhar);
  };

  /* =================================================================
     6. A corrida no plano inclinado
     O resultado que mais surpreende o aluno em todo o módulo: a ordem
     de chegada não depende da massa nem do raio, só do fator k. Os
     deslizantes de massa e de raio estão aqui de propósito, para que
     se veja que mexer neles não muda nada.
     ================================================================= */
  REGISTRO.descida = function (raiz) {
    var G0 = 9.80665, S = 3;                  // comprimento da rampa, em metros
    var CORRE = [
      { n: 'esfera maciça', k: 2 / 5, cor: '#176b5d', tipo: 'esfera' },
      { n: 'cilindro maciço', k: 1 / 2, cor: '#a8601f', tipo: 'disco' },
      { n: 'casca esférica', k: 2 / 3, cor: '#6b4e8f', tipo: 'casca' },
      { n: 'aro', k: 1, cor: '#8c2f39', tipo: 'aro' },
      { n: 'bloco sem atrito', k: 0, cor: '#2c5f8d', tipo: 'bloco' }
    ];
    var est = { vista: 'corrida', ang: 20, raio: 0.18, massa: 1, t: 0, rodando: true };

    var corpo = moldura(raiz, 'A corrida no plano inclinado');

    var c0 = el('div', { class: 'controles' });
    corpo.appendChild(c0);
    opcoes(c0, [
      { rot: 'A corrida', v: 'corrida' },
      { rot: 'Como a energia se reparte', v: 'reparte' }
    ], 0, function (v) { est.vista = v; });

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'inclinação', 5, 40, 1, 20,
      function (v) { est.ang = v; }, function (v) { return v + '°'; });
    deslizante(ctr, 'raio (não muda nada)', 0.08, 0.3, 0.01, 0.18,
      function (v) { est.raio = v; }, function (v) { return F.fmt(v, 2) + ' m'; });
    deslizante(ctr, 'massa (também não)', 0.2, 5, 0.1, 1,
      function (v) { est.massa = v; }, function (v) { return F.fmt(v, 1) + ' kg'; });
    var bt = el('button', { type: 'button', texto: 'soltar de novo' });
    bt.addEventListener('click', function () { est.t = 0; est.rodando = true; });
    ctr.appendChild(bt);

    var mostrar = cartoes(corpo, CORRE.map(function (c, i) {
      return { rot: c.n, k: 'c' + i };
    }).concat([{ rot: 'g sen θ (m/s²)', k: 'gs' }]));
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    function acel(k) { return G0 * Math.sin(est.ang * Math.PI / 180) / (1 + k); }
    function tempo(k) { return Math.sqrt(2 * S / acel(k)); }
    function pos(k, t) { return Math.min(S, 0.5 * acel(k) * t * t); }

    function desenhaCorrida() {
      var alt = 310;
      var p = G.preparar(cv, alt), ct = p.ct, Lp = p.L;
      ct.clearRect(0, 0, Lp, alt);

      var n = CORRE.length, faixa = (alt - 40) / n;
      /* a folga à direita acomoda o corpo parado sobre a linha de
         chegada e o tempo escrito ao lado dele */
      var marg = 108, comp = Lp - marg - 92;

      CORRE.forEach(function (c, i) {
        var y = 26 + faixa * i + faixa / 2;
        /* a pista */
        ct.strokeStyle = G.COR.grade; ct.lineWidth = 2;
        ct.beginPath(); ct.moveTo(marg, y + 10); ct.lineTo(marg + comp, y + 10); ct.stroke();
        rotulo(ct, c.n, marg - 8, y, c.cor, 'right');

        var s = pos(c.k, est.t), x = marg + comp * s / S;
        var r = Math.max(9, est.raio * 58);
        var fi = c.tipo === 'bloco' ? 0 : s / est.raio;

        ct.save();
        ct.translate(x, y + 10 - r);
        if (c.tipo === 'bloco') {
          ct.fillStyle = 'rgba(44,95,141,.24)';
          ct.fillRect(-r, -r * 0.7, 2 * r, r * 1.7);
          ct.strokeStyle = c.cor; ct.lineWidth = 2;
          ct.strokeRect(-r, -r * 0.7, 2 * r, r * 1.7);
        } else {
          ct.rotate(fi);
          ct.beginPath(); ct.arc(0, 0, r, 0, 2 * Math.PI);
          if (c.tipo === 'aro' || c.tipo === 'casca') {
            ct.strokeStyle = c.cor;
            ct.lineWidth = c.tipo === 'aro' ? Math.max(3, r * 0.3) : Math.max(2.4, r * 0.18);
            ct.stroke();
          } else {
            ct.fillStyle = c.cor + '33'; ct.fill();
            ct.strokeStyle = c.cor; ct.lineWidth = 2; ct.stroke();
          }
          ct.beginPath(); ct.moveTo(0, 0); ct.lineTo(0, -r);
          ct.strokeStyle = c.cor; ct.lineWidth = 1.4; ct.stroke();
        }
        ct.restore();

        if (s >= S) {
          rotulo(ct, F.fmt(tempo(c.k), 2) + ' s',
            marg + comp + Math.max(9, est.raio * 58) + 8, y, c.cor, 'left');
        }
      });

      /* linha de chegada */
      ct.strokeStyle = G.COR.tinta; ct.lineWidth = 2; ct.setLineDash([4, 4]);
      ct.beginPath(); ct.moveTo(marg + comp, 20); ct.lineTo(marg + comp, alt - 14);
      ct.stroke(); ct.setLineDash([]);
      rotulo(ct, 'chegada', marg + comp, 12, G.COR.tinta);
      rotulo(ct, 'rampa de ' + S + ' m a ' + est.ang + '°', 6, 12, G.COR.suave, 'left');
    }

    function desenhaReparte() {
      var alt = 310;
      var p = G.preparar(cv, alt), ct = p.ct, Lp = p.L;
      ct.clearRect(0, 0, Lp, alt);

      var n = CORRE.length, lg = Lp / n;
      var yBase = alt - 52, hMax = yBase - 54;

      CORRE.forEach(function (c, i) {
        var cx = lg * i + lg / 2, larg = Math.min(lg * 0.5, 54);
        var fTrans = 1 / (1 + c.k), fRot = c.k / (1 + c.k);
        var hT = hMax * fTrans, hR = hMax * fRot;
        ct.fillStyle = c.cor;
        ct.fillRect(cx - larg / 2, yBase - hT, larg, hT);
        ct.fillStyle = c.cor + '55';
        ct.fillRect(cx - larg / 2, yBase - hT - hR, larg, hR);
        rotulo(ct, F.pct(fTrans, 0), cx, yBase - hT / 2, '#fff', 'center', 'middle',
          null, c.cor);
        if (hR > 16) rotulo(ct, F.pct(fRot, 0), cx, yBase - hT - hR / 2, c.cor);
        var ps = c.n.split(' ');
        rotulo(ct, ps[0], cx, yBase + 14, G.COR.tinta, 'center', 'middle',
          '600 10px system-ui, sans-serif');
        if (ps[1]) rotulo(ct, ps.slice(1).join(' '), cx, yBase + 27, G.COR.tinta,
          'center', 'middle', '600 10px system-ui, sans-serif');
      });

      rotulo(ct, 'parte da energia que vira translação (sólido) e rotação (claro)',
        8, 14, G.COR.suave, 'left');
      rotulo(ct, 'quanto mais vai para a rotação, mais devagar o corpo desce',
        8, 30, G.COR.suave, 'left');
    }

    function desenhar() {
      if (est.vista === 'corrida') desenhaCorrida();
      else desenhaReparte();
      var vals = { gs: F.fmt(G0 * Math.sin(est.ang * Math.PI / 180), 2) };
      CORRE.forEach(function (c, i) {
        vals['c' + i] = F.fmt(tempo(c.k), 2) + ' s';
      });
      mostrar(vals);
    }

    function texto() {
      nota.innerHTML =
        '<p>Todos partem juntos do alto de uma rampa de ' + S + ' m. Conservando a energia '
        + 'ao descer uma altura \\(h\\), e usando \\(v=\\omega R\\) do rolamento,</p>'
        + '\\[Mgh=\\tfrac12MV^2+\\tfrac12 I\\omega^2=\\tfrac12MV^2\\left(1+k\\right),'
        + '\\qquad I=kMR^2,\\]'
        + '<p>e a aceleração ao longo da rampa sai disso:</p>'
        + '\\[a=\\frac{g\\sen\\theta}{1+k}.\\]'
        + '<p>Olhe o que <strong>não</strong> está nessa fórmula: nem \\(M\\), nem \\(R\\). '
        + 'Os dois se cancelam, e os deslizantes de massa e de raio estão aí para você '
        + 'conferir que mexer neles não muda tempo nenhum. Uma bola de gude e uma bola de '
        + 'boliche descem lado a lado.</p>'
        + '<p>O que decide a corrida é só o fator \\(k\\), que mede quanto da energia precisa '
        + 'ser desviado para a rotação em vez de virar avanço. A esfera maciça, com '
        + '\\(k=2/5\\), gasta 29% na rotação e chega primeiro entre os que rolam. O aro, com '
        + '\\(k=1\\), gasta metade e chega por último. O bloco que desliza sem atrito não '
        + 'gasta nada e ganha de todos, com \\(a=g\\sen\\theta\\).</p>'
        + '<p>Uma consequência que surpreende: a ordem de chegada é a mesma em qualquer '
        + 'planeta e em qualquer inclinação. Mudar \\(\\theta\\) muda todos os tempos pelo '
        + 'mesmo fator \\(1/\\sqrt{\\sen\\theta}\\), nunca a ordem.</p>';
      tipografar(corpo);
    }

    var chaveAnt = '';
    function quadro() {
      if (est.rodando) {
        est.t += 0.016;
        if (est.t > tempo(1) + 1.2) est.rodando = false;
      }
      desenhar();
      if (est.vista !== chaveAnt) { chaveAnt = est.vista; texto(); }
      requestAnimationFrame(quadro);
    }

    texto();
    requestAnimationFrame(quadro);
    registrarRedesenho(desenhar);
  };


  /* =================================================================
     7. Pêndulo físico
     O período não cai monotonicamente com a distância ao eixo: ele tem
     mínimo em d = k_g, e isso só convence vendo a curva. A vista da
     oscilação põe ao lado o pêndulo simples de mesmo período, que é o
     significado operacional do comprimento equivalente, e marca o
     centro de oscilação, de onde sai a reversibilidade de Huygens.
     ================================================================= */
  REGISTRO.pendulofisico = function (raiz) {
    /* kg2 é o raio de giração ao quadrado, em m² */
    var FORMAS = [
      { n: 'haste', tam: 1.0, kg2: 1.0 * 1.0 / 12, dmax: 0.5 },
      { n: 'disco', tam: 0.5, kg2: 0.5 * 0.5 / 2, dmax: 0.5 },
      { n: 'aro', tam: 0.5, kg2: 0.5 * 0.5, dmax: 0.5 },
      { n: 'placa quadrada', tam: 0.7, kg2: 2 * 0.7 * 0.7 / 12, dmax: 0.49 }
    ];
    var G0 = 9.80665;
    var est = { vista: 'oscila', f: 0, d: 0.35, amp: 18, t: 0, rodando: true };

    var corpo = moldura(raiz, 'Pêndulo físico: período, comprimento equivalente e o mínimo');

    var c0 = el('div', { class: 'controles' });
    corpo.appendChild(c0);
    opcoes(c0, [
      { rot: 'A oscilação', v: 'oscila' },
      { rot: 'Período contra distância', v: 'curva' }
    ], 0, function (v) { est.vista = v; });

    var c1 = el('div', { class: 'controles' });
    corpo.appendChild(c1);
    c1.appendChild(el('span', { class: 'etiqueta', texto: 'corpo' }));
    opcoes(c1, FORMAS.map(function (s, i) { return { rot: s.n, v: i }; }), 0,
      function (v) { est.f = v; est.t = 0; });

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    var slD = deslizante(ctr, 'distância do eixo ao centro de massa', 0.03, 0.5, 0.01, 0.35,
      function (v) { est.d = v; est.t = 0; },
      function (v) { return F.fmt(v, 2) + ' m'; });
    deslizante(ctr, 'amplitude', 4, 30, 1, 18,
      function (v) { est.amp = v; }, function (v) { return v + '°'; });
    var bt = el('button', { type: 'button', texto: 'pausar' });
    bt.addEventListener('click', function () {
      est.rodando = !est.rodando;
      bt.textContent = est.rodando ? 'pausar' : 'continuar';
    });
    ctr.appendChild(bt);

    var mostrar = cartoes(corpo, [
      { rot: 'raio de giração k<sub>g</sub>', k: 'kg' },
      { rot: 'I pelo eixo (kg·m², M = 1)', k: 'ip' },
      { rot: 'comprimento equivalente ℓ', k: 'l' },
      { rot: 'período T', k: 'tt' },
      { rot: 'd que minimiza o período', k: 'dm' },
      { rot: 'período mínimo', k: 'tm' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    function dados() {
      var s = FORMAS[est.f], d = Math.min(est.d, s.dmax);
      var Ip = s.kg2 + d * d;                   // com M = 1 kg
      var l = Ip / d;                           // comprimento equivalente
      var kg = Math.sqrt(s.kg2);
      return { s: s, d: d, Ip: Ip, l: l, kg: kg,
               T: 2 * Math.PI * Math.sqrt(l / G0),
               Tmin: 2 * Math.PI * Math.sqrt(2 * kg / G0) };
    }

    function desenhaCorpo(ct, X, Y, esc, s, cx, cy, th) {
      ct.save();
      ct.translate(X(cx), Y(cy));
      /* o eixo y da tela aponta para baixo, de modo que o giro que leva
         o corpo a acompanhar a reta eixo-centro de massa é -th */
      ct.rotate(-th);
      ct.strokeStyle = G.COR.mestra; ct.lineWidth = 2;
      ct.fillStyle = 'rgba(23,107,93,.16)';
      if (s.n === 'haste') {
        var h = s.tam * esc, l2 = Math.max(7, esc * 0.05);
        ct.fillRect(-l2, -h / 2, 2 * l2, h);
        ct.strokeRect(-l2, -h / 2, 2 * l2, h);
      } else if (s.n === 'placa quadrada') {
        var a = s.tam * esc;
        ct.fillRect(-a / 2, -a / 2, a, a);
        ct.strokeRect(-a / 2, -a / 2, a, a);
      } else {
        ct.beginPath(); ct.arc(0, 0, s.tam * esc, 0, 2 * Math.PI);
        if (s.n === 'aro') { ct.lineWidth = Math.max(4, esc * 0.05); ct.stroke(); }
        else { ct.fill(); ct.stroke(); }
      }
      ct.restore();
    }

    function desenhaOscila() {
      var D = dados(), alt = 330;
      var p = G.preparar(cv, alt), ct = p.ct, Lp = p.L;
      ct.clearRect(0, 0, Lp, alt);

      var th = est.amp * Math.PI / 180 * Math.cos(2 * Math.PI * est.t / D.T);
      var alturaCena = Math.max(D.l, D.d + D.s.tam) + 0.25;
      var esc = Math.min((alt - 46) / alturaCena, 230);
      var yTopo = 30;
      var X = function (u) { return u; };
      var Y = function (u) { return yTopo + u * esc; };

      var xA = Lp * (Lp > 560 ? 0.33 : 0.3);
      var xB = Lp * (Lp > 560 ? 0.72 : 0.74);

      /* suporte */
      ct.strokeStyle = G.COR.suave; ct.lineWidth = 2;
      ct.beginPath(); ct.moveTo(20, yTopo); ct.lineTo(Lp - 20, yTopo); ct.stroke();

      /* o corpo */
      var cxA = xA + D.d * esc * Math.sin(th), cyA = D.d * Math.cos(th);
      ct.strokeStyle = G.COR.mestra; ct.lineWidth = 1.6;
      ct.beginPath(); ct.moveTo(xA, Y(0)); ct.lineTo(cxA, Y(cyA)); ct.stroke();
      desenhaCorpo(ct, X, Y, esc, D.s, cxA, cyA, th);
      ct.beginPath(); ct.arc(cxA, Y(cyA), 3.5, 0, 2 * Math.PI);
      ct.fillStyle = G.COR.mestra; ct.fill();
      ct.beginPath(); ct.arc(xA, Y(0), 4, 0, 2 * Math.PI);
      ct.fillStyle = G.COR.tinta; ct.fill();

      /* centro de oscilação, a ℓ do eixo */
      var xo = xA + D.l * esc * Math.sin(th), yo = D.l * Math.cos(th);
      if (Y(yo) < alt - 14) {
        ct.beginPath(); ct.arc(xo, Y(yo), 5, 0, 2 * Math.PI);
        ct.strokeStyle = G.COR.roxo; ct.lineWidth = 2;
        ct.setLineDash([3, 3]); ct.stroke(); ct.setLineDash([]);
        rotulo(ct, 'centro de oscilação', xo, Y(yo) + 15, G.COR.roxo);
      }

      /* pêndulo simples de mesmo período, ao lado */
      var xb = xB + D.l * esc * Math.sin(th), yb = D.l * Math.cos(th);
      ct.strokeStyle = G.COR.bronze; ct.lineWidth = 1.6;
      ct.beginPath(); ct.moveTo(xB, Y(0)); ct.lineTo(xb, Y(yb)); ct.stroke();
      ct.beginPath(); ct.arc(xb, Y(yb), 7, 0, 2 * Math.PI);
      ct.fillStyle = G.COR.bronze; ct.fill();
      ct.beginPath(); ct.arc(xB, Y(0), 4, 0, 2 * Math.PI);
      ct.fillStyle = G.COR.tinta; ct.fill();

      rotulo(ct, 'pêndulo físico', xA, 16, G.COR.mestra);
      rotulo(ct, 'pêndulo simples de comprimento ℓ', xB, 16, G.COR.bronze);
      rotulo(ct, 'T = ' + F.fmt(D.T, 3) + ' s nos dois', Lp / 2, alt - 10, G.COR.suave);
    }

    function desenhaCurva() {
      var D = dados(), s = D.s;
      var f = function (d) {
        return d < 0.012 ? 99 : 2 * Math.PI * Math.sqrt((s.kg2 + d * d) / (G0 * d));
      };
      var ymax = Math.min(4.2, f(0.03) * 1.05);
      var gr = G.eixos(cv, {
        altura: 320, xmin: 0, xmax: s.dmax, ymin: 0, ymax: ymax,
        rotX: 'distância do eixo ao centro de massa (m)', rotY: 'período (s)',
        marcasX: G.marcasLineares(0, s.dmax, 5, 2),
        formataY: function (v) { return F.fmt(v, 1); }
      });
      G.curva(gr, f, G.COR.mestra, 2.6);
      G.vertical(gr, D.d, G.COR.suave, '', true);

      var ct = gr.ct;
      var dm = D.kg;
      if (dm <= s.dmax) {
        G.vertical(gr, dm, G.COR.bronze, '', true);
        ct.beginPath(); ct.arc(gr.X(dm), gr.Y(f(dm)), 5, 0, 2 * Math.PI);
        ct.fillStyle = G.COR.bronze; ct.fill();
        rotulo(ct, 'mínimo em d = k_g = ' + F.fmt(dm, 3) + ' m',
          gr.X(dm) + 8, gr.Y(f(dm)) - 16, G.COR.bronze, 'left');
      }
      ct.beginPath(); ct.arc(gr.X(D.d), gr.Y(f(D.d)), 5, 0, 2 * Math.PI);
      ct.fillStyle = G.COR.roxo; ct.fill();
      rotulo(ct, 'T = ' + F.fmt(D.T, 3) + ' s', gr.X(D.d), gr.Y(f(D.d)) - 15, G.COR.roxo);
      rotulo(ct, 'perto do eixo pelo centro de massa o período dispara',
        gr.x0 + 8, gr.y0 + 14, G.COR.suave, 'left');
    }

    function desenhar() {
      var D = dados();
      if (slD.max !== String(D.s.dmax)) slD.max = D.s.dmax;
      if (est.vista === 'oscila') desenhaOscila();
      else desenhaCurva();
      mostrar({
        kg: F.fmt(D.kg, 3) + ' m',
        ip: F.fmt(D.Ip, 4),
        l: F.fmt(D.l, 3) + ' m',
        tt: F.fmt(D.T, 3) + ' s',
        dm: F.fmt(D.kg, 3) + ' m',
        tm: F.fmt(D.Tmin, 3) + ' s'
      });
    }

    function texto() {
      var D = dados();
      nota.innerHTML =
        '<p>Pendure um corpo por um ponto qualquer, afaste-o um pouco da vertical e solte. '
        + 'O peso age no centro de massa, a uma distância \\(d\\) do eixo, e o torque que ele '
        + 'exerce vale \\(-Mgd\\sen\\theta\\). Igualando ao produto do momento de inércia '
        + 'pelo ângulo acelerado, e tomando \\(\\sen\\theta\\approx\\theta\\),</p>'
        + '\\[I_{\\rm eixo}\\ddot\\theta=-Mgd\\,\\theta \\quad\\Longrightarrow\\quad '
        + 'T=2\\pi\\sqrt{\\frac{I_{\\rm eixo}}{Mgd}}=2\\pi\\sqrt{\\frac{\\ell}{g}},'
        + '\\qquad \\ell\\equiv\\frac{I_{\\rm eixo}}{Md}.\\]'
        + '<p>O número \\(\\ell\\) tem a dimensão de comprimento e faz o papel exato do '
        + 'comprimento de um pêndulo simples. Na vista da oscilação ele está desenhado ao '
        + 'lado: uma massa pontual num fio de ' + F.fmt(D.l, 3) + ' m acompanha o corpo '
        + 'batida por batida. Daí o nome <strong>comprimento equivalente</strong>.</p>'
        + '<p>Usando Steiner, \\(I_{\\rm eixo}=M(k_g^2+d^2)\\), o comprimento equivalente '
        + 'fica \\(\\ell=(k_g^2+d^2)/d\\). Aproximar o eixo do centro de massa faz \\(d\\) '
        + 'cair no denominador e \\(\\ell\\) crescer sem limite; afastá-lo faz \\(d^2\\) '
        + 'dominar e \\(\\ell\\) crescer também. Entre os dois extremos há um mínimo, e '
        + 'derivando sai \\(d=k_g\\): para este corpo, ' + F.fmt(D.kg, 3) + ' m, com '
        + 'período ' + F.fmt(D.Tmin, 3) + ' s. <strong>Pendurar mais longe nem sempre faz '
        + 'oscilar mais devagar.</strong></p>'
        + '<p>O ponto a \\(\\ell\\) do eixo, marcado em roxo, chama-se <strong>centro de '
        + 'oscilação</strong>. Pendurando o corpo por ele, o novo comprimento equivalente dá '
        + 'exatamente o mesmo \\(\\ell\\), e o período não muda. Essa reciprocidade foi '
        + 'descoberta por Huygens e virou instrumento de precisão nas mãos de Kater, que a '
        + 'usou para medir \\(g\\) com quatro casas sem precisar medir \\(I\\) nem \\(d\\): '
        + 'basta achar os dois eixos de mesmo período e medir a distância entre eles.</p>';
      tipografar(corpo);
    }

    var chaveAnt = '';
    function quadro() {
      if (est.rodando) est.t += 0.016;
      desenhar();
      var chave = est.f + '|' + F.fmt(est.d, 2) + '|' + est.vista;
      if (chave !== chaveAnt) { chaveAnt = chave; texto(); }
      requestAnimationFrame(quadro);
    }

    texto();
    requestAnimationFrame(quadro);
    registrarRedesenho(desenhar);
  };

  /* =================================================================
     8. Centro de percussão
     O mesmo ℓ do pêndulo físico reaparece aqui, e essa coincidência é
     o ponto da seção: bater no centro de oscilação é bater sem que a
     mão sinta nada. A vista do gráfico mostra a reação trocando de
     sinal, que é o que o jogador descreve como bater "atrasado" ou
     "adiantado" no taco.
     ================================================================= */
  REGISTRO.percussao = function (raiz) {
    /* corpos pendurados por uma ponta; d é a distância do eixo ao
       centro de massa e kg2 o raio de giração ao quadrado em torno do
       centro de massa, ambos em unidades do comprimento L = 1 */
    var CORPOS = [
      /* haste homogênea de massa 1 sobre [0, 1] */
      { n: 'haste uniforme', d: 0.5, kg2: 1 / 12, perfil: 'uniforme' },
      /* cabo de 0,4 homogêneo mais 0,6 concentrado em 0,85 */
      { n: 'taco', d: 0.71, kg2: 0.06273, perfil: 'taco' },
      /* cabo de 0,5 homogêneo mais 0,5 de aro em 0,80 */
      { n: 'raquete', d: 0.65, kg2: 0.06417, perfil: 'raquete' }
    ];
    var est = { vista: 'pancada', c: 0, b: 0.6, t: 0, rodando: true };

    var corpo = moldura(raiz, 'Centro de percussão: onde bater para a mão não sentir');

    var c0 = el('div', { class: 'controles' });
    corpo.appendChild(c0);
    opcoes(c0, [
      { rot: 'A pancada', v: 'pancada' },
      { rot: 'Reação contra o ponto', v: 'curva' }
    ], 0, function (v) { est.vista = v; });

    var c1 = el('div', { class: 'controles' });
    corpo.appendChild(c1);
    c1.appendChild(el('span', { class: 'etiqueta', texto: 'corpo' }));
    opcoes(c1, CORPOS.map(function (c, i) { return { rot: c.n, v: i }; }), 0,
      function (v) { est.c = v; est.t = 0; });

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'ponto da pancada, a partir do eixo', 0.05, 1, 0.01, 0.6,
      function (v) { est.b = v; est.t = 0; },
      function (v) { return F.fmt(v, 2) + ' L'; });
    var bt = el('button', { type: 'button', texto: 'bater de novo' });
    bt.addEventListener('click', function () { est.t = 0; est.rodando = true; });
    ctr.appendChild(bt);

    var mostrar = cartoes(corpo, [
      { rot: 'I pelo eixo (M = 1, L = 1)', k: 'ip' },
      { rot: 'centro de percussão', k: 'cp' },
      { rot: 'ponto da pancada', k: 'b' },
      { rot: 'reação no eixo, por unidade de impulso', k: 'r' },
      { rot: 'o que a mão sente', k: 'sente' },
      { rot: 'ω logo após a pancada', k: 'w' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    function dados() {
      var c = CORPOS[est.c];
      var Ip = c.kg2 + c.d * c.d;        // M = 1
      var b = est.b;
      return { c: c, Ip: Ip, b: b, cp: Ip / c.d, R: c.d * b / Ip - 1, w: b / Ip };
    }

    function desenhaCorpoBarra(ct, x0, y0, esc, c, th) {
      ct.save();
      ct.translate(x0, y0);
      ct.rotate(-th);
      var w0 = Math.max(8, esc * 0.035);
      ct.fillStyle = 'rgba(23,107,93,.18)';
      ct.strokeStyle = G.COR.mestra; ct.lineWidth = 2;
      if (c.perfil === 'uniforme') {
        ct.fillRect(-w0, 0, 2 * w0, esc);
        ct.strokeRect(-w0, 0, 2 * w0, esc);
      } else if (c.perfil === 'taco') {
        ct.beginPath();
        ct.moveTo(-w0 * 0.5, 0); ct.lineTo(w0 * 0.5, 0);
        ct.lineTo(w0 * 1.6, esc); ct.lineTo(-w0 * 1.6, esc);
        ct.closePath(); ct.fill(); ct.stroke();
      } else {
        ct.fillRect(-w0 * 0.45, 0, w0 * 0.9, esc * 0.55);
        ct.strokeRect(-w0 * 0.45, 0, w0 * 0.9, esc * 0.55);
        ct.beginPath();
        ct.ellipse(0, esc * 0.78, w0 * 1.7, esc * 0.22, 0, 0, 2 * Math.PI);
        ct.fill(); ct.stroke();
      }
      ct.restore();
    }

    function desenhaPancada() {
      var D = dados(), alt = 330;
      var p = G.preparar(cv, alt), ct = p.ct, Lp = p.L;
      ct.clearRect(0, 0, Lp, alt);

      var esc = Math.min(alt - 86, Lp * 0.38);
      var x0 = Lp * 0.38, y0 = 34;
      /* gira só depois da pancada, com ângulo limitado para não sair do
         quadro: o que interessa aqui é o instante do impulso, não a
         trajetória posterior */
      var th = est.t < 0.25 ? 0
        : Math.min(0.42, D.w * (est.t - 0.25) * 1.6);

      ct.strokeStyle = G.COR.suave; ct.lineWidth = 2;
      ct.beginPath(); ct.moveTo(x0 - 70, y0); ct.lineTo(x0 + 70, y0); ct.stroke();

      desenhaCorpoBarra(ct, x0, y0, esc, D.c, th);

      /* centro de massa e centro de percussão, sobre a barra girada */
      function sobre(u) {
        return [x0 + u * esc * Math.sin(th), y0 + u * esc * Math.cos(th)];
      }
      var pcm = sobre(D.c.d), pcp = sobre(D.cp), pb = sobre(D.b);

      if (D.cp <= 1.02) {
        ct.beginPath(); ct.arc(pcp[0], pcp[1], 6, 0, 2 * Math.PI);
        ct.strokeStyle = G.COR.roxo; ct.lineWidth = 2;
        ct.setLineDash([3, 3]); ct.stroke(); ct.setLineDash([]);
        /* afasta o rótulo perpendicularmente à barra, senão ele cai em cima dela */
        rotulo(ct, 'centro de percussão',
          pcp[0] + 18 * Math.cos(th), pcp[1] - 18 * Math.sin(th),
          G.COR.roxo, 'left');
      }
      ct.beginPath(); ct.arc(pcm[0], pcm[1], 4, 0, 2 * Math.PI);
      ct.fillStyle = G.COR.mestra; ct.fill();
      rotulo(ct, 'cm', pcm[0] - 12, pcm[1], G.COR.mestra, 'right');

      /* o impulso da pancada */
      if (est.t < 0.75) {
        var al = est.t < 0.5 ? 1 : (0.75 - est.t) * 4;
        ct.globalAlpha = Math.max(0, al);
        seta(ct, pb[0] - 58, pb[1], pb[0] - 8, pb[1], G.COR.bronze, 3);
        rotulo(ct, 'impulso J', pb[0] - 62, pb[1] - 13, G.COR.bronze, 'right');
        ct.globalAlpha = 1;
      }
      ct.beginPath(); ct.arc(pb[0], pb[1], 4, 0, 2 * Math.PI);
      ct.fillStyle = G.COR.bronze; ct.fill();

      /* a reação no eixo */
      var esq = D.R;
      ct.beginPath(); ct.arc(x0, y0, 5, 0, 2 * Math.PI);
      ct.fillStyle = G.COR.tinta; ct.fill();
      if (Math.abs(esq) > 0.02 && est.t < 1.1) {
        var comp = Math.min(60, Math.abs(esq) * 70);
        seta(ct, x0, y0 - 16, x0 + Math.sign(esq) * comp, y0 - 16, G.COR.vinho, 2.6);
        rotulo(ct, 'a mão sente', x0 + Math.sign(esq) * comp * 0.5, y0 - 30, G.COR.vinho);
      } else if (est.t < 1.1) {
        rotulo(ct, 'a mão não sente nada', x0, y0 - 22, G.COR.mestra);
      }
      rotulo(ct, 'eixo (a mão)', x0 - 76, y0, G.COR.tinta, 'right');
    }

    function desenhaCurva() {
      var D = dados();
      var f = function (b) { return D.c.d * b / D.Ip - 1; };
      var gr = G.eixos(cv, {
        altura: 310, xmin: 0, xmax: 1, ymin: -1.1, ymax: 1.1,
        rotX: 'ponto da pancada, a partir do eixo (em L)',
        rotY: 'reação no eixo, por unidade de impulso',
        marcasX: G.marcasLineares(0, 1, 5, 2),
        formataY: function (v) { return F.fmt(v, 1); }
      });
      var ct = gr.ct;
      /* a linha do zero, que é o que se procura */
      ct.strokeStyle = G.COR.grade; ct.lineWidth = 1.5;
      ct.beginPath(); ct.moveTo(gr.x0, gr.Y(0)); ct.lineTo(gr.x1, gr.Y(0)); ct.stroke();
      G.curva(gr, f, G.COR.mestra, 2.6);
      G.vertical(gr, D.b, G.COR.suave, '', true);
      if (D.cp <= 1) {
        ct.beginPath(); ct.arc(gr.X(D.cp), gr.Y(0), 5.5, 0, 2 * Math.PI);
        ct.fillStyle = G.COR.roxo; ct.fill();
        rotulo(ct, 'centro de percussão: ' + F.fmt(D.cp, 3) + ' L',
          gr.X(D.cp), gr.Y(0) - 16, G.COR.roxo);
      }
      rotulo(ct, 'bateu perto demais: a mão é empurrada para trás',
        gr.x0 + 8, gr.Y(-0.62), G.COR.vinho, 'left');
      rotulo(ct, 'bateu longe demais: a mão é puxada para a frente',
        gr.x1 - 8, gr.Y(0.72), G.COR.vinho, 'right');
    }

    function desenhar() {
      var D = dados();
      if (est.vista === 'pancada') desenhaPancada();
      else desenhaCurva();
      var sente = Math.abs(D.R) < 0.03 ? 'nada: é o ponto certo'
        : D.R < 0 ? 'empurrão para trás' : 'puxão para a frente';
      mostrar({
        ip: F.fmt(D.Ip, 4),
        cp: F.fmt(D.cp, 3) + ' L',
        b: F.fmt(D.b, 2) + ' L',
        r: F.fmt(D.R, 3),
        sente: sente,
        w: F.fmt(D.w, 2) + ' J/(kg·m)'
      });
    }

    function texto() {
      var D = dados();
      nota.innerHTML =
        '<p>Segure uma barra por uma ponta e dê nela uma pancada seca, de impulso \\(J\\), a '
        + 'uma distância \\(b\\) da mão. O impulso angular em torno do eixo põe a barra a '
        + 'girar com \\(\\omega=Jb/I_{\\rm eixo}\\), e o centro de massa, que está a \\(d\\) '
        + 'do eixo, passa a andar com \\(V=\\omega d\\). Mas o impulso linear total tem de '
        + 'bater com essa quantidade de movimento, e quem fecha a conta é a mão:</p>'
        + '\\[J+R=MV=M\\omega d \\quad\\Longrightarrow\\quad '
        + 'R=J\\left(\\frac{Mdb}{I_{\\rm eixo}}-1\\right).\\]'
        + '<p>Essa reação some quando os dois termos se igualam, isto é, quando</p>'
        + '\\[b=\\frac{I_{\\rm eixo}}{Md}=\\ell.\\]'
        + '<p>O ponto a essa distância é o <strong>centro de percussão</strong>, e o '
        + '\\(\\ell\\) que apareceu é o mesmo comprimento equivalente do pêndulo físico da '
        + 'seção anterior. Centro de percussão e centro de oscilação são o mesmo ponto, o '
        + 'que não é coincidência: nos dois casos a pergunta é onde pôr a força para que o '
        + 'vínculo no eixo não precise entrar em ação.</p>'
        + '<p>Para a ' + D.c.n + ' deste simulador, ele fica a ' + F.fmt(D.cp, 3)
        + ' L do eixo. Batendo mais perto, a barra gira devagar demais para o impulso '
        + 'recebido e a mão leva um empurrão para trás; batendo mais longe, gira depressa '
        + 'demais e a mão é puxada para a frente. É o que um jogador chama de pegar a bola '
        + 'atrasada ou adiantada no taco, e o ponto no meio é o que ele chama de '
        + '<em>sweet spot</em>.</p>'
        + '<p>Numa haste uniforme segura pela ponta, \\(I=ML^2/3\\) e \\(d=L/2\\) dão '
        + '\\(b=2L/3\\). Concentrando massa na extremidade, como num taco, o centro de '
        + 'percussão se desloca para mais longe da mão: compare os três corpos nos '
        + 'botões.</p>';
      tipografar(corpo);
    }

    var chaveAnt = '';
    function quadro() {
      if (est.rodando) {
        est.t += 0.016;
        if (est.t > 1.9) est.t = 0;
      }
      desenhar();
      var chave = est.c + '|' + F.fmt(est.b, 2) + '|' + est.vista;
      if (chave !== chaveAnt) { chaveAnt = chave; texto(); }
      requestAnimationFrame(quadro);
    }

    texto();
    requestAnimationFrame(quadro);
    registrarRedesenho(desenhar);
  };

  /* =================================================================
     9. Máquina de Atwood com polia de massa
     Enquanto a polia é ideal, as duas trações são iguais e o problema
     não precisa de torque nenhum. Dar massa à polia quebra essa
     igualdade, e a diferença entre as trações é exatamente o que
     fornece o torque: é o exemplo mais curto em que τ = Iα é
     indispensável.
     ================================================================= */
  REGISTRO.atwood = function (raiz) {
    var G0 = 9.80665, Rp = 0.12;
    var est = { m1: 2, m2: 1.2, mp: 1, k: 0.5, t: 0, rodando: true };

    var corpo = moldura(raiz, 'Atwood com polia de massa: onde τ = Iα é indispensável');

    var c1 = el('div', { class: 'controles' });
    corpo.appendChild(c1);
    c1.appendChild(el('span', { class: 'etiqueta', texto: 'polia' }));
    opcoes(c1, [
      { rot: 'disco maciço (k = ½)', v: 0.5 },
      { rot: 'aro (k = 1)', v: 1 },
      { rot: 'ideal, sem massa', v: 0 }
    ], 0, function (v) { est.k = v; est.t = 0; });

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'massa m₁', 0.5, 4, 0.1, 2,
      function (v) { est.m1 = v; est.t = 0; },
      function (v) { return F.fmt(v, 1) + ' kg'; });
    deslizante(ctr, 'massa m₂', 0.5, 4, 0.1, 1.2,
      function (v) { est.m2 = v; est.t = 0; },
      function (v) { return F.fmt(v, 1) + ' kg'; });
    deslizante(ctr, 'massa da polia', 0, 6, 0.1, 1,
      function (v) { est.mp = v; est.t = 0; },
      function (v) { return F.fmt(v, 1) + ' kg'; });

    var mostrar = cartoes(corpo, [
      { rot: 'aceleração a (m/s²)', k: 'a' },
      { rot: 'tração T₁ (N)', k: 't1' },
      { rot: 'tração T₂ (N)', k: 't2' },
      { rot: 'diferença T₁ − T₂ (N)', k: 'dt' },
      { rot: 'a com polia ideal (m/s²)', k: 'ai' },
      { rot: 'quanto a polia freia', k: 'err' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    function dados() {
      var ef = est.k * est.mp;                 // inércia efetiva da polia, I/R²
      var a = (est.m1 - est.m2) * G0 / (est.m1 + est.m2 + ef);
      var ai = (est.m1 - est.m2) * G0 / (est.m1 + est.m2);
      return { a: a, ai: ai, ef: ef,
               T1: est.m1 * (G0 - a), T2: est.m2 * (G0 + a) };
    }

    function desenhar() {
      var D = dados(), alt = 318;
      var p = G.preparar(cv, alt), ct = p.ct, Lp = p.L;
      ct.clearRect(0, 0, Lp, alt);

      var esc = 150;                           // px por metro
      var rp = Rp * esc;
      var cx = Lp / 2, cy = 52;
      var s = Math.min(0.78, 0.5 * D.a * est.t * est.t);   // deslocamento, m
      if (D.a < 0) s = Math.max(-0.78, s);

      /* suporte e polia */
      ct.strokeStyle = G.COR.suave; ct.lineWidth = 3;
      ct.beginPath(); ct.moveTo(cx - 70, 16); ct.lineTo(cx + 70, 16); ct.stroke();
      ct.beginPath(); ct.moveTo(cx, 16); ct.lineTo(cx, cy); ct.stroke();

      var fi = s / Rp;
      ct.save(); ct.translate(cx, cy); ct.rotate(fi);
      ct.beginPath(); ct.arc(0, 0, rp, 0, 2 * Math.PI);
      if (est.k === 0) {
        ct.strokeStyle = G.COR.grade; ct.lineWidth = 2;
        ct.setLineDash([4, 4]); ct.stroke(); ct.setLineDash([]);
      } else if (est.k === 1) {
        ct.strokeStyle = G.COR.mestra; ct.lineWidth = Math.max(5, rp * 0.3); ct.stroke();
      } else {
        ct.fillStyle = 'rgba(23,107,93,.2)'; ct.fill();
        ct.strokeStyle = G.COR.mestra; ct.lineWidth = 2; ct.stroke();
      }
      ct.beginPath(); ct.moveTo(0, 0); ct.lineTo(0, -rp);
      ct.strokeStyle = G.COR.mestra; ct.lineWidth = 1.6; ct.stroke();
      ct.restore();

      /* blocos: o deslocamento é limitado para m₂ não subir dentro da
         polia nem m₁ sair pelo pé do quadro */
      var desl = Math.max(-78, Math.min(78, s * 130));
      var repouso = cy + rp + 88;
      var y1 = repouso + desl, y2 = repouso - desl;
      [[cx - rp, y1, est.m1, 'm₁', D.T1, G.COR.bronze],
       [cx + rp, y2, est.m2, 'm₂', D.T2, G.COR.azul]].forEach(function (b) {
        ct.strokeStyle = G.COR.tinta; ct.lineWidth = 1.6;
        ct.beginPath(); ct.moveTo(b[0], cy); ct.lineTo(b[0], b[1]); ct.stroke();
        var lado = 16 + 9 * Math.pow(b[2], 1 / 3);
        ct.fillStyle = b[5] + '33';
        ct.fillRect(b[0] - lado / 2, b[1], lado, lado);
        ct.strokeStyle = b[5]; ct.lineWidth = 2;
        ct.strokeRect(b[0] - lado / 2, b[1], lado, lado);
        rotulo(ct, b[3], b[0], b[1] + lado / 2, b[5]);
        rotulo(ct, F.fmt(b[4], 2) + ' N', b[0] + (b[0] < cx ? -1 : 1) * (lado / 2 + 8),
          b[1] + lado / 2, b[5], b[0] < cx ? 'right' : 'left');
      });

      rotulo(ct, est.k === 0 ? 'polia ideal: T₁ = T₂'
        : 'polia com massa: T₁ ≠ T₂, e a diferença gira a polia',
        Lp / 2, alt - 12, est.k === 0 ? G.COR.suave : G.COR.mestra);

      mostrar({
        a: F.fmt(D.a, 3), t1: F.fmt(D.T1, 2), t2: F.fmt(D.T2, 2),
        dt: F.fmt(D.T1 - D.T2, 3), ai: F.fmt(D.ai, 3),
        err: D.ai === 0 ? 'nada a frear' : F.pct(1 - D.a / D.ai, 1) + ' a menos'
      });
    }

    function texto() {
      var D = dados();
      nota.innerHTML =
        '<p>Escreva a segunda lei para cada bloco e a equação de rotação para a polia, de '
        + 'raio \\(R\\) e momento de inércia \\(I=kM_pR^2\\). O fio não desliza, de modo que '
        + '\\(a=\\alpha R\\):</p>'
        + '\\[m_1g-T_1=m_1a,\\qquad T_2-m_2g=m_2a,\\qquad \\left(T_1-T_2\\right)R=I\\frac{a}{R}.\\]'
        + '<p>A terceira equação já diz o essencial: a diferença entre as trações é o que '
        + 'fornece o torque, e vale \\(T_1-T_2=kM_pa\\). Somando as três,</p>'
        + '\\[a=\\frac{\\left(m_1-m_2\\right)g}{m_1+m_2+kM_p}.\\]'
        + '<p>A polia entra no denominador como se fosse uma massa adicional de \\(kM_p\\), '
        + 'que para um disco maciço é metade da massa dela. Ela não cai nem sobe, mas precisa '
        + 'ser posta a girar, e isso custa a mesma coisa que arrastar massa.</p>'
        + '<p>Ponha a massa da polia em zero e repare no que acontece com os dois números das '
        + 'trações: eles se igualam. <strong>A regra de que a tração é a mesma dos dois lados '
        + 'de uma polia só vale para polia sem massa</strong>, e o motivo é que uma tração '
        + 'igual dos dois lados não exerce torque nenhum. Com a polia atual, de '
        + F.fmt(est.mp, 1) + ' kg, a diferença é ' + F.fmt(D.T1 - D.T2, 3) + ' N e a '
        + 'aceleração cai '
        + (D.ai === 0 ? 'nada, porque as massas estão equilibradas' : F.pct(1 - D.a / D.ai, 1))
        + ' em relação ao caso ideal.</p>';
      tipografar(corpo);
    }

    var chaveAnt = '';
    function quadro() {
      if (est.rodando) {
        est.t += 0.016;
        if (est.t > 2.4) est.t = 0;
      }
      desenhar();
      var chave = F.fmt(dados().a, 3) + '|' + est.k + '|' + F.fmt(est.mp, 1);
      if (chave !== chaveAnt) { chaveAnt = chave; texto(); }
      requestAnimationFrame(quadro);
    }

    texto();
    requestAnimationFrame(quadro);
    registrarRedesenho(desenhar);
  };


  /* =================================================================
     10. Conservação do momento angular: a patinadora
     O ponto que o aluno sempre estranha não é ω crescer, e sim a
     energia crescer junto, aparentemente do nada. O gráfico de T(r)
     ao lado de ω(r) resolve isso: T = L²/2I cresce porque alguém
     puxou os braços contra uma força, e o trabalho dessa força é
     exatamente a diferença.
     ================================================================= */
  REGISTRO.patinadora = function (raiz) {
    var I0 = 1.2, M = 3, RMAX = 0.9, RMIN = 0.15;
    var L0 = (I0 + 2 * M * RMAX * RMAX) * 1.5;   // momento angular fixo
    var est = { vista: 'gira', r: RMAX, th: 0, rodando: true };

    var corpo = moldura(raiz, 'A patinadora: L se conserva, ω e T não');

    var c0 = el('div', { class: 'controles' });
    corpo.appendChild(c0);
    opcoes(c0, [
      { rot: 'Encolhendo os braços', v: 'gira' },
      { rot: 'ω e T contra o raio', v: 'curva' }
    ], 0, function (v) { est.vista = v; });

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'distância das mãos ao eixo', RMIN, RMAX, 0.01, RMAX,
      function (v) { est.r = v; }, function (v) { return F.fmt(v, 2) + ' m'; });
    var bt = el('button', { type: 'button', texto: 'pausar' });
    bt.addEventListener('click', function () {
      est.rodando = !est.rodando;
      bt.textContent = est.rodando ? 'pausar' : 'continuar';
    });
    ctr.appendChild(bt);

    var mostrar = cartoes(corpo, [
      { rot: 'L (constante)', k: 'l' },
      { rot: 'I no instante', k: 'i' },
      { rot: 'ω = L / I', k: 'w' },
      { rot: 'T = L² / 2I', k: 't' },
      { rot: 'força em cada mão', k: 'f' },
      { rot: 'trabalho feito pelos braços', k: 'wt' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    function inercia(r) { return I0 + 2 * M * r * r; }
    function dados(r) {
      var I = inercia(r), w = L0 / I;
      return { I: I, w: w, T: L0 * L0 / (2 * I), Fm: M * w * w * r,
               W: L0 * L0 / 2 * (1 / I - 1 / inercia(RMAX)) };
    }

    function desenhaGira() {
      var alt = 300;
      var p = G.preparar(cv, alt), ct = p.ct, Lp = p.L;
      ct.clearRect(0, 0, Lp, alt);
      var D = dados(est.r);
      var esc = Math.min((alt - 60) / 2.1, (Lp - 60) / 2.4) / RMAX * 0.9;
      var cx = Lp / 2, cy = alt / 2 - 4;

      /* plataforma */
      ct.beginPath(); ct.arc(cx, cy, 0.42 * esc, 0, 2 * Math.PI);
      ct.fillStyle = 'rgba(23,107,93,.12)'; ct.fill();
      ct.strokeStyle = G.COR.mestra; ct.lineWidth = 2; ct.stroke();

      /* rastro circular das mãos */
      ct.beginPath(); ct.arc(cx, cy, est.r * esc, 0, 2 * Math.PI);
      ct.strokeStyle = G.COR.grade; ct.lineWidth = 1.4;
      ct.setLineDash([4, 4]); ct.stroke(); ct.setLineDash([]);

      [0, Math.PI].forEach(function (off) {
        var a = est.th + off;
        var mx = cx + est.r * esc * Math.cos(a), my = cy - est.r * esc * Math.sin(a);
        ct.beginPath(); ct.moveTo(cx, cy); ct.lineTo(mx, my);
        ct.strokeStyle = G.COR.mestra; ct.lineWidth = 3; ct.stroke();
        ct.beginPath(); ct.arc(mx, my, 9, 0, 2 * Math.PI);
        ct.fillStyle = G.COR.bronze; ct.fill();
        /* a força que os braços fazem, apontando para o eixo */
        var comp = Math.min(46, D.Fm * 1.9);
        seta(ct, mx, my, mx - comp * Math.cos(a), my + comp * Math.sin(a),
          G.COR.vinho, 2.2);
      });

      ct.beginPath(); ct.arc(cx, cy, 4, 0, 2 * Math.PI);
      ct.fillStyle = G.COR.tinta; ct.fill();

      rotulo(ct, 'ω = ' + F.fmt(D.w, 2) + ' rad/s', 10, 16, G.COR.mestra, 'left');
      rotulo(ct, 'força dos braços', 10, 32, G.COR.vinho, 'left');
      rotulo(ct, F.fmt(D.w * 60 / (2 * Math.PI), 0) + ' rpm',
        Lp - 10, 16, G.COR.suave, 'right');
    }

    function desenhaCurva() {
      var gr = G.eixos(cv, {
        altura: 300, xmin: RMIN, xmax: RMAX, ymin: 0,
        ymax: Math.max(dados(RMIN).T, dados(RMIN).w) * 1.12,
        rotX: 'distância das mãos ao eixo (m)',
        rotY: 'ω (rad/s)   e   T (J)',
        marcasX: G.marcasLineares(RMIN, RMAX, 5, 2),
        formataY: function (v) { return F.fmt(v, 0); }
      });
      G.curva(gr, function (r) { return dados(r).T; }, G.COR.bronze, 2.6);
      G.curva(gr, function (r) { return dados(r).w; }, G.COR.mestra, 2.6);
      G.vertical(gr, est.r, G.COR.suave, '', true);
      var ct = gr.ct;
      rotulo(ct, 'T = L²/2I   (energia cinética)', gr.X(0.45),
        gr.Y(dados(0.45).T) - 14, G.COR.bronze);
      rotulo(ct, 'ω = L/I', gr.X(0.6), gr.Y(dados(0.6).w) - 14, G.COR.mestra);
      rotulo(ct, 'L é constante nas duas curvas', gr.x1 - 8, gr.y0 + 14,
        G.COR.suave, 'right');
    }

    function desenhar() {
      var D = dados(est.r);
      if (est.vista === 'gira') desenhaGira();
      else desenhaCurva();
      mostrar({
        l: F.fmt(L0, 2) + ' kg·m²/s',
        i: F.fmt(D.I, 3) + ' kg·m²',
        w: F.fmt(D.w, 2) + ' rad/s',
        t: F.fmt(D.T, 2) + ' J',
        f: F.fmt(D.Fm, 1) + ' N',
        wt: F.fmt(D.W, 2) + ' J'
      });
    }

    function texto() {
      var D = dados(est.r), A = dados(RMAX);
      nota.innerHTML =
        '<p>A plataforma gira sem atrito, de modo que nenhum torque externo age em torno do '
        + 'eixo vertical. Os braços puxam as massas para dentro, mas essa força aponta '
        + '<em>para o eixo</em> e tem braço nulo: ela não exerce torque. Com '
        + '\\(\\tau_z=0\\),</p>'
        + '\\[L_z=I\\omega=\\text{constante}\\quad\\Longrightarrow\\quad '
        + '\\frac{\\omega_2}{\\omega_1}=\\frac{I_1}{I_2}.\\]'
        + '<p>Encolhendo os braços de ' + F.fmt(RMAX, 2) + ' m para '
        + F.fmt(est.r, 2) + ' m, o momento de inércia cai de ' + F.fmt(A.I, 2) + ' para '
        + F.fmt(D.I, 2) + ' kg·m² e a rotação sobe de ' + F.fmt(A.w, 2) + ' para '
        + F.fmt(D.w, 2) + ' rad/s.</p>'
        + '<p>Agora o que costuma incomodar. Escrevendo a energia cinética em termos do que '
        + 'se conserva,</p>'
        + '\\[T=\\tfrac12I\\omega^2=\\frac{L^2}{2I},\\]'
        + '<p>vê-se que ela <strong>cresce</strong> quando \\(I\\) diminui: de '
        + F.fmt(A.T, 2) + ' para ' + F.fmt(D.T, 2) + ' J. Energia não aparece do nada, e '
        + 'aqui ela não apareceu: as mãos giram num círculo e, para puxá-las para dentro, é '
        + 'preciso vencer a força de ' + F.fmt(D.Fm, 1) + ' N que cada uma exige para '
        + 'descrever a curva. O trabalho dos braços ao longo do percurso vale '
        + F.fmt(D.W, 2) + ' J, exatamente a diferença de energia cinética.</p>'
        + '<p>Conservar o momento angular, portanto, não é conservar energia. São duas '
        + 'contabilidades independentes, e é só por acaso que num torque nulo a primeira '
        + 'fecha sozinha enquanto a segunda precisa de quem pague a conta.</p>';
      tipografar(corpo);
    }

    var chaveAnt = '';
    function quadro() {
      if (est.rodando) est.th += 0.016 * dados(est.r).w;
      desenhar();
      var chave = F.fmt(est.r, 2) + '|' + est.vista;
      if (chave !== chaveAnt) { chaveAnt = chave; texto(); }
      requestAnimationFrame(quadro);
    }

    texto();
    requestAnimationFrame(quadro);
    registrarRedesenho(desenhar);
  };

  /* =================================================================
     11. A escada apoiada na parede
     O problema de estática que mais aparece em prova, e o que melhor
     mostra que a escolha do ponto é livre: tomando os torques no pé da
     escada, duas das três incógnitas somem da equação.
     ================================================================= */
  REGISTRO.escada = function (raiz) {
    var G0 = 9.80665, Lesc = 5;
    var est = { ang: 60, mu: 0.4, Mp: 15, mg: 70, d: 0.5 };

    var corpo = moldura(raiz, 'A escada: quando ela escorrega');

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'inclinação', 25, 85, 1, 60,
      function (v) { est.ang = v; desenhar(); }, function (v) { return v + '°'; });
    deslizante(ctr, 'atrito no chão μ', 0.05, 0.8, 0.01, 0.4,
      function (v) { est.mu = v; desenhar(); }, function (v) { return F.fmt(v, 2); });
    deslizante(ctr, 'pessoa na escada', 0, 1, 0.02, 0.5,
      function (v) { est.d = v; desenhar(); },
      function (v) { return F.fmt(v * Lesc, 1) + ' m do pé'; });
    deslizante(ctr, 'massa da pessoa', 0, 110, 5, 70,
      function (v) { est.mg = v; desenhar(); },
      function (v) { return v ? F.fmt(v, 0) + ' kg' : 'ninguém'; });

    var mostrar = cartoes(corpo, [
      { rot: 'normal do chão N (N)', k: 'n' },
      { rot: 'empurrão da parede P (N)', k: 'p' },
      { rot: 'atrito disponível μN (N)', k: 'fmax' },
      { rot: 'inclinação mínima', k: 'amin' },
      { rot: 'margem de segurança', k: 'marg' },
      { rot: 'situação', k: 'sit' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    function dados() {
      var th = est.ang * Math.PI / 180;
      var N = (est.Mp + est.mg) * G0;
      /* torque no pé: P·L senθ = Mg(L/2)cosθ + mg·d·L·cosθ */
      var P = (est.Mp * 0.5 + est.mg * est.d) * G0 / Math.tan(th);
      var fmax = est.mu * N;
      var tgmin = (est.Mp * 0.5 + est.mg * est.d) / (est.mu * (est.Mp + est.mg));
      return { th: th, N: N, P: P, fmax: fmax,
               amin: Math.atan(tgmin) * 180 / Math.PI, seguro: P <= fmax };
    }

    function desenhar() {
      var D = dados(), alt = 320;
      var p = G.preparar(cv, alt), ct = p.ct, Lp = p.L;
      ct.clearRect(0, 0, Lp, alt);

      var esc = Math.min((alt - 56) / Lesc, (Lp - 150) / (Lesc * 0.95));
      /* centra a escada mais uma faixa de parede, senão a figura fica
         encostada à direita e sobra meia tela vazia à esquerda */
      var vao = Lesc * Math.cos(D.th) * esc;
      var xp = Math.max(60, (Lp - vao - 90) / 2);
      var ych = alt - 34;
      var xw = xp + Lesc * Math.cos(D.th) * esc;
      var yw = ych - Lesc * Math.sin(D.th) * esc;

      /* chão e parede */
      ct.strokeStyle = G.COR.suave; ct.lineWidth = 2.5;
      ct.beginPath(); ct.moveTo(20, ych); ct.lineTo(Lp - 20, ych); ct.stroke();
      ct.beginPath(); ct.moveTo(xw, ych); ct.lineTo(xw, 14); ct.stroke();
      ct.fillStyle = 'rgba(91,103,115,.09)';
      ct.fillRect(20, ych, Lp - 40, alt - ych);
      ct.fillRect(xw, 14, Lp - 20 - xw, ych - 14);

      /* escada */
      ct.strokeStyle = D.seguro ? G.COR.mestra : G.COR.vinho;
      ct.lineWidth = 5; ct.lineCap = 'round';
      ct.beginPath(); ct.moveTo(xp, ych); ct.lineTo(xw, yw); ct.stroke();

      function sobre(u) {
        return [xp + u * Lesc * Math.cos(D.th) * esc, ych - u * Lesc * Math.sin(D.th) * esc];
      }
      /* centro de massa da escada e a pessoa */
      var pc = sobre(0.5);
      ct.beginPath(); ct.arc(pc[0], pc[1], 4.5, 0, 2 * Math.PI);
      ct.fillStyle = '#fff'; ct.strokeStyle = G.COR.mestra; ct.lineWidth = 2; ct.stroke();
      ct.fill();
      if (est.mg > 0) {
        var pp = sobre(est.d);
        ct.beginPath(); ct.arc(pp[0], pp[1] - 7, 7, 0, 2 * Math.PI);
        ct.fillStyle = G.COR.bronze; ct.fill();
      }

      /* forças */
      var ev = 0.09;
      seta(ct, xp, ych, xp, ych - D.N * ev, G.COR.azul, 2.4);
      rotulo(ct, 'N', xp - 12, ych - D.N * ev / 2, G.COR.azul, 'right');
      seta(ct, xw, yw, xw - D.P * ev, yw, G.COR.roxo, 2.4);
      rotulo(ct, 'P', xw - D.P * ev - 10, yw - 12, G.COR.roxo, 'right');
      seta(ct, xp, ych, xp + D.P * ev, ych, G.COR.vinho, 2.4);
      rotulo(ct, 'atrito', xp + D.P * ev + 8, ych - 12, G.COR.vinho, 'left');
      seta(ct, pc[0], pc[1], pc[0], pc[1] + est.Mp * G0 * ev, G.COR.mestra, 2);
      if (est.mg > 0) {
        var pp2 = sobre(est.d);
        seta(ct, pp2[0], pp2[1], pp2[0], pp2[1] + est.mg * G0 * ev, G.COR.bronze, 2);
      }

      rotulo(ct, D.seguro ? 'a escada fica' : 'a escada escorrega',
        Lp / 2, 16, D.seguro ? G.COR.mestra : G.COR.vinho);

      mostrar({
        n: F.fmt(D.N, 0), p: F.fmt(D.P, 0), fmax: F.fmt(D.fmax, 0),
        amin: F.fmt(D.amin, 1) + '°',
        marg: D.seguro ? F.fmt(D.fmax - D.P, 0) + ' N de folga'
                       : 'falta ' + F.fmt(D.P - D.fmax, 0) + ' N',
        sit: D.seguro ? 'em equilíbrio' : 'escorrega'
      });

      nota.innerHTML =
        '<p>São três incógnitas, a normal do chão, o atrito e o empurrão da parede, e três '
        + 'equações. As duas de força saem de imediato: na vertical, \\(N=(M+m)g\\), e na '
        + 'horizontal, o atrito tem de igualar \\(P\\), já que a parede é lisa.</p>'
        + '<p>Para a terceira, tome os torques <strong>no pé da escada</strong>. Ali a normal '
        + 'e o atrito têm braço nulo e desaparecem da equação, deixando só o peso e o '
        + 'empurrão da parede:</p>'
        + '\\[P\\,\\ell\\sen\\theta=Mg\\,\\frac{\\ell}{2}\\cos\\theta+mg\\,d\\cos\\theta'
        + '\\quad\\Longrightarrow\\quad '
        + 'P=\\left(\\frac{M}{2}+\\frac{md}{\\ell}\\right)g\\cotg\\theta.\\]'
        + '<p>A condição de não escorregar é \\(P\\leq\\mu N\\), o que dá</p>'
        + '\\[\\tg\\theta\\geq\\frac{M/2+md/\\ell}{\\mu\\left(M+m\\right)}.\\]'
        + '<p>Com os valores atuais, a inclinação mínima é ' + F.fmt(D.amin, 1) + '°, e a '
        + 'escada está a ' + est.ang + '°. Suba a pessoa pela escada e repare que o limite '
        + 'piora à medida que ela se aproxima do topo: o numerador cresce com \\(d\\) '
        + 'enquanto o denominador não muda. É por isso que escadas escorregam quando se está '
        + 'quase chegando, e não no começo da subida.</p>'
        + '<p>Com a escada sozinha, \\(m=0\\), a condição vira \\(\\tg\\theta\\geq1/2\\mu\\), '
        + 'sem nenhuma dependência da massa: uma escada pesada não é mais segura que uma '
        + 'leve.</p>';
      tipografar(corpo);
    }

    registrarRedesenho(desenhar);
  };

  /* =================================================================
     12. Tombar ou escorregar
     Duas condições independentes competem, e qual delas vence depende
     só da geometria: se a largura da base dividida pela altura for
     menor que o coeficiente de atrito, o corpo tomba antes de
     escorregar. Mexer nos deslizantes troca o vencedor.
     ================================================================= */
  REGISTRO.tombamento = function (raiz) {
    var est = { ang: 15, mu: 0.5, larg: 0.5, alt: 1.2 };

    var corpo = moldura(raiz, 'Tombar ou escorregar: quem vence primeiro');

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'inclinação da rampa', 0, 45, 1, 15,
      function (v) { est.ang = v; desenhar(); }, function (v) { return v + '°'; });
    deslizante(ctr, 'atrito μ', 0.05, 1.2, 0.05, 0.5,
      function (v) { est.mu = v; desenhar(); }, function (v) { return F.fmt(v, 2); });
    deslizante(ctr, 'largura da base', 0.2, 1.4, 0.05, 0.5,
      function (v) { est.larg = v; desenhar(); },
      function (v) { return F.fmt(v, 2) + ' m'; });
    deslizante(ctr, 'altura do corpo', 0.4, 2, 0.05, 1.2,
      function (v) { est.alt = v; desenhar(); },
      function (v) { return F.fmt(v, 2) + ' m'; });

    var mostrar = cartoes(corpo, [
      { rot: 'tg da inclinação', k: 'tg' },
      { rot: 'escorrega acima de', k: 'ae' },
      { rot: 'tomba acima de', k: 'at' },
      { rot: 'quem vence', k: 'quem' },
      { rot: 'base / altura', k: 'ba' },
      { rot: 'situação', k: 'sit' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    function dados() {
      var th = est.ang * Math.PI / 180, tg = Math.tan(th);
      var tgE = est.mu, tgT = est.larg / est.alt;
      return { th: th, tg: tg, tgE: tgE, tgT: tgT,
               aE: Math.atan(tgE) * 180 / Math.PI,
               aT: Math.atan(tgT) * 180 / Math.PI,
               escorrega: tg > tgE, tomba: tg > tgT };
    }

    function desenhar() {
      var D = dados(), alt = 310;
      var p = G.preparar(cv, alt), ct = p.ct, Lp = p.L;
      ct.clearRect(0, 0, Lp, alt);

      var esc = Math.min(110, (alt - 90) / 2.1, (Lp - 120) / 3.2);
      var x0 = Lp / 2 - 1.4 * esc, y0 = alt - 56;

      /* rampa */
      ct.save();
      ct.translate(x0, y0);
      ct.rotate(-D.th);
      ct.strokeStyle = G.COR.suave; ct.lineWidth = 3;
      ct.beginPath(); ct.moveTo(-0.2 * esc, 0); ct.lineTo(3.0 * esc, 0); ct.stroke();
      ct.fillStyle = 'rgba(91,103,115,.10)';
      ct.fillRect(-0.2 * esc, 0, 3.2 * esc, 26);

      /* o bloco, assentado na rampa */
      var w = est.larg * esc, h = est.alt * esc, xb = 1.5 * esc;
      var cor = D.tomba && D.tg > D.tgT ? G.COR.vinho
        : D.escorrega ? G.COR.bronze : G.COR.mestra;
      ct.fillStyle = cor + '28';
      ct.fillRect(xb - w / 2, -h, w, h);
      ct.strokeStyle = cor; ct.lineWidth = 2.4;
      ct.strokeRect(xb - w / 2, -h, w, h);

      /* centro de massa e a vertical por ele */
      var cmx = xb, cmy = -h / 2;
      ct.beginPath(); ct.arc(cmx, cmy, 4, 0, 2 * Math.PI);
      ct.fillStyle = cor; ct.fill();
      /* a vertical verdadeira, que na rampa girada aparece inclinada */
      var dx = Math.tan(D.th) * (h / 2 + 4);
      ct.beginPath();
      ct.moveTo(cmx, cmy); ct.lineTo(cmx + dx, 4);
      ct.strokeStyle = G.COR.roxo; ct.lineWidth = 1.8;
      ct.setLineDash([4, 3]); ct.stroke(); ct.setLineDash([]);
      ct.beginPath(); ct.arc(cmx + dx, 0, 3.5, 0, 2 * Math.PI);
      ct.fillStyle = G.COR.roxo; ct.fill();
      /* as duas quinas da base */
      [-1, 1].forEach(function (s) {
        ct.beginPath(); ct.arc(xb + s * w / 2, 0, 3, 0, 2 * Math.PI);
        ct.fillStyle = G.COR.tinta; ct.fill();
      });
      ct.restore();

      var sit = D.tomba && D.tg > D.tgE
        ? (D.tgT < D.tgE ? 'tomba' : 'escorrega')
        : D.tomba ? 'tomba' : D.escorrega ? 'escorrega' : 'fica parado';
      rotulo(ct, 'a vertical pelo centro de massa ' +
        (D.tomba ? 'saiu da base: tomba' : 'cai dentro da base'),
        Lp / 2, 18, D.tomba ? G.COR.vinho : G.COR.roxo);
      rotulo(ct, sit === 'fica parado' ? 'em repouso' : sit,
        Lp / 2, alt - 14, sit === 'fica parado' ? G.COR.mestra : G.COR.vinho);

      mostrar({
        tg: F.fmt(D.tg, 3), ae: F.fmt(D.aE, 1) + '°', at: F.fmt(D.aT, 1) + '°',
        quem: D.tgT < D.tgE ? 'tomba primeiro' : 'escorrega primeiro',
        ba: F.fmt(D.tgT, 3), sit: sit
      });

      nota.innerHTML =
        '<p>Um corpo apoiado numa rampa pode falhar de duas maneiras independentes, e cada '
        + 'uma tem a sua condição.</p>'
        + '<p><strong>Escorregar</strong> depende do atrito. Decompondo o peso, a componente '
        + 'ao longo da rampa vale \\(Mg\\sen\\theta\\) e a normal vale \\(Mg\\cos\\theta\\), '
        + 'de modo que o deslizamento começa quando</p>'
        + '\\[\\tg\\theta>\\mu.\\]'
        + '<p><strong>Tombar</strong> depende da geometria. O corpo gira em torno da quina de '
        + 'baixo assim que a vertical traçada pelo centro de massa deixa de cair dentro da '
        + 'base de apoio, o que acontece quando</p>'
        + '\\[\\tg\\theta>\\frac{b}{h},\\]'
        + '<p>com \\(b\\) a largura da base e \\(h\\) a altura do corpo, já que o centro de '
        + 'massa está a meia altura e a meia largura. Note que a massa não aparece em '
        + 'nenhuma das duas condições: nem escorregar nem tombar dependem de quanto o corpo '
        + 'pesa.</p>'
        + '<p>Qual das duas acontece primeiro é uma comparação direta entre \\(\\mu\\) e '
        + '\\(b/h\\). Aqui \\(b/h=' + F.fmt(D.tgT, 3) + '\\) e \\(\\mu=' + F.fmt(est.mu, 2)
        + '\\), de modo que o corpo ' + (D.tgT < D.tgE ? 'tomba' : 'escorrega')
        + ' primeiro. Estreite a base ou levante o corpo e o tombamento passa à frente; é '
        + 'por isso que caminhões altos tombam em curvas onde carros baixos apenas derrapam, '
        + 'e é por isso que se carrega carga pesada no fundo do porta-malas.</p>';
      tipografar(corpo);
    }

    registrarRedesenho(desenhar);
  };


  /* Álgebra de matrizes 3×3, usada pelos widgets de rotação. */
  var M3 = (function () {
    function mul(A, B) {
      var C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], i, j, k;
      for (i = 0; i < 3; i++) for (j = 0; j < 3; j++) {
        var s = 0;
        for (k = 0; k < 3; k++) s += A[i][k] * B[k][j];
        C[i][j] = s;
      }
      return C;
    }
    function apl(A, v) {
      return [A[0][0] * v[0] + A[0][1] * v[1] + A[0][2] * v[2],
              A[1][0] * v[0] + A[1][1] * v[1] + A[1][2] * v[2],
              A[2][0] * v[0] + A[2][1] * v[1] + A[2][2] * v[2]];
    }
    function transp(A) {
      return [[A[0][0], A[1][0], A[2][0]],
              [A[0][1], A[1][1], A[2][1]],
              [A[0][2], A[1][2], A[2][2]]];
    }
    function Rx(a) {
      var c = Math.cos(a), s = Math.sin(a);
      return [[1, 0, 0], [0, c, -s], [0, s, c]];
    }
    function Ry(a) {
      var c = Math.cos(a), s = Math.sin(a);
      return [[c, 0, s], [0, 1, 0], [-s, 0, c]];
    }
    function Rz(a) {
      var c = Math.cos(a), s = Math.sin(a);
      return [[c, -s, 0], [s, c, 0], [0, 0, 1]];
    }
    function det(A) {
      return A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1])
           - A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0])
           + A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]);
    }
    function traco(A) { return A[0][0] + A[1][1] + A[2][2]; }
    /* ângulo e eixo de uma rotação própria, pelo traço e pela parte
       antissimétrica. Em φ = π a parte antissimétrica se anula e o eixo
       sai da diagonal de R + 1. */
    function anguloEixo(A) {
      var c = Math.max(-1, Math.min(1, (traco(A) - 1) / 2));
      var ang = Math.acos(c);
      var e = [A[2][1] - A[1][2], A[0][2] - A[2][0], A[1][0] - A[0][1]];
      var n = Math.sqrt(e[0] * e[0] + e[1] * e[1] + e[2] * e[2]);
      if (n > 1e-7) return { ang: ang, eixo: [e[0] / n, e[1] / n, e[2] / n] };
      if (ang < 1e-5) return { ang: 0, eixo: null };
      /* em φ = π vale R = 2nn^T - 1: tira-se a maior componente da
         diagonal e as outras das linhas correspondentes, o que fixa os
         sinais relativos (o sinal global é livre, como deve ser) */
      var k = 0, i2;
      for (i2 = 1; i2 < 3; i2++) if (A[i2][i2] > A[k][k]) k = i2;
      var nk = Math.sqrt(Math.max(1e-12, (A[k][k] + 1) / 2));
      var d = [0, 0, 0];
      d[k] = nk;
      for (i2 = 0; i2 < 3; i2++) if (i2 !== k) d[i2] = A[k][i2] / (2 * nk);
      return { ang: ang, eixo: d };
    }
    /* rotação de ângulo a em torno do versor n, por Rodrigues */
    function eixoPara(n, a) {
      var c = Math.cos(a), s = Math.sin(a), u = 1 - c;
      var x = n[0], y = n[1], z = n[2];
      return [[c + x * x * u, x * y * u - z * s, x * z * u + y * s],
              [y * x * u + z * s, c + y * y * u, y * z * u - x * s],
              [z * x * u - y * s, z * y * u + x * s, c + z * z * u]];
    }
    return { mul: mul, apl: apl, transp: transp, Rx: Rx, Ry: Ry, Rz: Rz,
             det: det, traco: traco, anguloEixo: anguloEixo, eixoPara: eixoPara };
  })();

  /* Desenha um cubo rotulado, visto de um ponto fixo. Compartilhado
     pelos widgets que precisam mostrar uma orientação no espaço. */
  var CUBO_FACES = [
    { v: [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]], c: '#c9e2dc', r: 'D' },
    { v: [[-1, -1, -1], [-1, 1, -1], [-1, 1, 1], [-1, -1, 1]], c: '#e9e2cf', r: 'E' },
    { v: [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]], c: '#f0d9d6', r: 'T' },
    { v: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]], c: '#d9d6ea', r: 'F' },
    { v: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], c: '#ffffff', r: 'C' },
    { v: [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1]], c: '#dfe4e2', r: 'B' }
  ];
  var VISTA = M3.mul(M3.Rz(-0.62), M3.Rx(-1.14));

  function desenhaCubo(ct, cx, cy, s, R) {
    var faces = CUBO_FACES.map(function (f) {
      var pts = f.v.map(function (v) { return M3.apl(M3.mul(VISTA, R), v); });
      var prof = pts.reduce(function (a, p) { return a + p[1]; }, 0) / 4;
      return { pts: pts, prof: prof, c: f.c, r: f.r };
    });
    faces.sort(function (a, b) { return b.prof - a.prof; });
    faces.forEach(function (f) {
      ct.beginPath();
      f.pts.forEach(function (p, i) {
        (i ? ct.lineTo : ct.moveTo).call(ct, cx + p[0] * s, cy - p[2] * s);
      });
      ct.closePath();
      ct.fillStyle = f.c; ct.fill();
      ct.strokeStyle = '#2f3b38'; ct.lineWidth = 1.2; ct.stroke();
      if (f.prof < 0) {
        var mx = 0, my = 0;
        f.pts.forEach(function (p) { mx += cx + p[0] * s; my += cy - p[2] * s; });
        ct.fillStyle = '#2f3b38';
        ct.font = '700 ' + Math.round(s * 0.5) + 'px system-ui, sans-serif';
        ct.textAlign = 'center'; ct.textBaseline = 'middle';
        ct.fillText(f.r, mx / 4, my / 4);
      }
    });
  }

  /* =================================================================
     13. A matriz de rotação no plano
     Mostrar a matriz ao lado da figura que ela move, com o determinante
     e o produto por sua transposta calculados ao vivo, transforma três
     definições abstratas em três números que o aluno vê mudar (ou não
     mudar) enquanto arrasta o deslizante. A vista da reflexão existe
     para que o determinante -1 seja visto, e não apenas afirmado.
     ================================================================= */
  REGISTRO.matrizrot = function (raiz) {
    /* uma letra F, porque numa figura simétrica a reflexão não se nota */
    var FIG = [[0, 0], [0, 2.2], [1.5, 2.2], [1.5, 1.75], [0.5, 1.75],
               [0.5, 1.25], [1.25, 1.25], [1.25, 0.8], [0.5, 0.8], [0.5, 0]];
    var est = { vista: 'rot', th: 35 };

    var corpo = moldura(raiz, 'A matriz de rotação, vista por dentro');

    var c0 = el('div', { class: 'controles' });
    corpo.appendChild(c0);
    opcoes(c0, [
      { rot: 'Rotação (det = +1)', v: 'rot' },
      { rot: 'Com reflexão (det = −1)', v: 'ref' }
    ], 0, function (v) { est.vista = v; desenhar(); });

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'ângulo θ', 0, 360, 1, 35,
      function (v) { est.th = v; desenhar(); }, function (v) { return v + '°'; });

    var mostrar = cartoes(corpo, [
      { rot: 'primeira coluna', k: 'c1' },
      { rot: 'segunda coluna', k: 'c2' },
      { rot: 'produto escalar das colunas', k: 'dot' },
      { rot: 'comprimento de cada coluna', k: 'norm' },
      { rot: 'determinante', k: 'det' },
      { rot: 'o que isso é', k: 'tipo' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    function matriz() {
      var a = est.th * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      /* a reflexão no eixo x entra depois da rotação e troca o sinal
         da segunda coluna, levando o determinante a -1 */
      return est.vista === 'rot' ? [[c, -s], [s, c]] : [[c, s], [s, -c]];
    }

    function desenhar() {
      var R = matriz(), alt = 330;
      var p = G.preparar(cv, alt), ct = p.ct, Lp = p.L;
      ct.clearRect(0, 0, Lp, alt);

      var esc = Math.min((alt - 60) / 5.2, 56);
      var cx = Lp * (Lp > 620 ? 0.36 : 0.5), cy = alt / 2 + 4;
      var X = function (u) { return cx + u * esc; };
      var Y = function (u) { return cy - u * esc; };

      /* grade e eixos */
      ct.strokeStyle = G.COR.grade; ct.lineWidth = 1;
      for (var g = -3; g <= 3; g++) {
        ct.beginPath(); ct.moveTo(X(g), Y(-2.4)); ct.lineTo(X(g), Y(2.6)); ct.stroke();
        ct.beginPath(); ct.moveTo(X(-2.6), Y(g)); ct.lineTo(X(2.8), Y(g)); ct.stroke();
      }
      ct.strokeStyle = G.COR.suave; ct.lineWidth = 1.6;
      ct.beginPath(); ct.moveTo(X(-2.6), Y(0)); ct.lineTo(X(2.8), Y(0)); ct.stroke();
      ct.beginPath(); ct.moveTo(X(0), Y(-2.4)); ct.lineTo(X(0), Y(2.6)); ct.stroke();

      /* figura original e transformada */
      function poli(pts, traco, preenche, larg) {
        ct.beginPath();
        pts.forEach(function (q, i) { (i ? ct.lineTo : ct.moveTo).call(ct, X(q[0]), Y(q[1])); });
        ct.closePath();
        if (preenche) { ct.fillStyle = preenche; ct.fill(); }
        ct.strokeStyle = traco; ct.lineWidth = larg || 2; ct.stroke();
      }
      poli(FIG, G.COR.grade, 'rgba(91,103,115,.07)', 1.6);
      poli(FIG.map(function (q) {
        return [R[0][0] * q[0] + R[0][1] * q[1], R[1][0] * q[0] + R[1][1] * q[1]];
      }), est.vista === 'rot' ? G.COR.mestra : G.COR.vinho,
        est.vista === 'rot' ? 'rgba(23,107,93,.16)' : 'rgba(140,47,57,.14)', 2.4);

      /* as colunas da matriz são as imagens dos versores da base */
      seta(ct, X(0), Y(0), X(R[0][0]), Y(R[1][0]), G.COR.bronze, 2.6);
      seta(ct, X(0), Y(0), X(R[0][1]), Y(R[1][1]), G.COR.roxo, 2.6);
      rotulo(ct, 'imagem de x̂', X(R[0][0] * 1.22), Y(R[1][0] * 1.22), G.COR.bronze);
      rotulo(ct, 'imagem de ŷ', X(R[0][1] * 1.3), Y(R[1][1] * 1.3), G.COR.roxo);

      /* a matriz escrita ao lado */
      if (Lp > 620) {
        var mx = Lp * 0.76, my = cy - 22;
        ct.font = '600 15px ui-monospace, Menlo, monospace';
        ct.textAlign = 'right'; ct.textBaseline = 'middle';
        ct.fillStyle = G.COR.tinta;
        [[0, 0], [0, 1], [1, 0], [1, 1]].forEach(function (ij) {
          ct.fillStyle = ij[1] === 0 ? G.COR.bronze : G.COR.roxo;
          ct.fillText(F.fmt(R[ij[0]][ij[1]], 3),
            mx + (ij[1] === 0 ? -18 : 48), my + (ij[0] === 0 ? -16 : 16));
        });
        ct.strokeStyle = G.COR.tinta; ct.lineWidth = 1.6;
        [[-78, 1], [60, -1]].forEach(function (b) {
          ct.beginPath();
          ct.moveTo(mx + b[0] + b[1] * 7, my - 34); ct.lineTo(mx + b[0], my - 34);
          ct.lineTo(mx + b[0], my + 34); ct.lineTo(mx + b[0] + b[1] * 7, my + 34);
          ct.stroke();
        });
        rotulo(ct, est.vista === 'rot' ? 'det = +1' : 'det = −1',
          mx - 10, my + 56, est.vista === 'rot' ? G.COR.mestra : G.COR.vinho);
      }

      var d = R[0][0] * R[0][1] + R[1][0] * R[1][1];
      var n1 = Math.sqrt(R[0][0] * R[0][0] + R[1][0] * R[1][0]);
      var det = R[0][0] * R[1][1] - R[0][1] * R[1][0];
      mostrar({
        c1: '(' + F.fmt(R[0][0], 3) + '; ' + F.fmt(R[1][0], 3) + ')',
        c2: '(' + F.fmt(R[0][1], 3) + '; ' + F.fmt(R[1][1], 3) + ')',
        dot: F.fmt(Math.abs(d) < 1e-12 ? 0 : d, 3),
        norm: F.fmt(n1, 3),
        det: F.fmt(det, 3),
        tipo: est.vista === 'rot' ? 'rotação própria' : 'imprópria: inverte a mão'
      });

      var comum =
        '<p>Uma transformação linear fica inteiramente determinada pelo que faz com os '
        + 'versores da base, e as <strong>colunas da matriz são justamente as imagens '
        + 'desses versores</strong>: a seta bronze é a primeira coluna e a roxa é a segunda. '
        + 'Olhe para os dois primeiros cartões enquanto arrasta o deslizante e repare no que '
        + 'não muda: cada coluna continua de comprimento 1 e o produto escalar entre elas '
        + 'continua zero.</p>'
        + '<p>Essas duas propriedades, escritas de uma vez só, são a condição de '
        + '<strong>ortogonalidade</strong>:</p>'
        + '\\[\\Ten{R}^{\\sf T}\\Ten{R}=\\Ten{1}\\qquad\\text{ou}\\qquad '
        + 'R_{ki}R_{kj}=\\delta_{ij}.\\]'
        + '<p>Guardar ângulos e comprimentos é exatamente o que se espera de uma mudança de '
        + 'base entre sistemas cartesianos, e é por isso que toda matriz de rotação é '
        + 'ortogonal.</p>';

      if (est.vista === 'rot') {
        nota.innerHTML = comum
          + '<p>Tomando o determinante da condição de ortogonalidade, '
          + '\\(\\det(\\Ten{R}^{\\sf T})\\det(\\Ten{R})=\\left[\\det\\Ten{R}\\right]^2=1\\), '
          + 'sobram apenas dois valores possíveis, \\(+1\\) e \\(-1\\). Aqui o determinante '
          + 'vale \\(+1\\) para qualquer \\(\\theta\\): a figura gira, mas o F nunca aparece '
          + 'espelhado, e a base continua destra. Chamam-se <strong>próprias</strong> as '
          + 'rotações desse tipo, e o conjunto delas é o grupo \\(SO(3)\\).</p>'
          + '<p>Mexa o ângulo até 360° e repare que a matriz volta exatamente ao que era. No '
          + 'plano, a composição é simplesmente a soma dos ângulos, '
          + '\\(\\Ten{R}(\\theta_1)\\Ten{R}(\\theta_2)=\\Ten{R}(\\theta_1+\\theta_2)\\), e '
          + 'por isso rotações planas <em>comutam</em>. No espaço isso deixa de valer, como o '
          + 'módulo 1 mostrou.</p>';
      } else {
        nota.innerHTML = comum
          + '<p>Esta matriz também é ortogonal: as colunas continuam unitárias e '
          + 'perpendiculares, e os cartões confirmam. O determinante, porém, vale \\(-1\\), e '
          + 'a consequência está à vista: o <strong>F aparece espelhado</strong>.</p>'
          + '<p>Transformações assim são <strong>impróprias</strong>. Elas preservam ângulos '
          + 'e distâncias, mas trocam a mão do sistema de coordenadas, levando uma base '
          + 'destra numa canhota. Nenhuma sequência de rotações, por mais longa, produz esse '
          + 'efeito: o determinante de um produto é o produto dos determinantes, e '
          + '\\(+1\\) multiplicado por si mesmo nunca dá \\(-1\\).</p>'
          + '<p>Fisicamente isso importa porque um corpo rígido real não pode ser levado à '
          + 'sua imagem especular por movimento nenhum. A mão esquerda e a direita são '
          + 'congruentes por reflexão e incongruentes por rotação, e é essa distinção que '
          + 'separa \\(O(3)\\) de \\(SO(3)\\).</p>';
      }
      tipografar(corpo);
    }

    registrarRedesenho(desenhar);
  };

  /* =================================================================
     14. Teorema de Euler: toda rotação tem um eixo
     O módulo 1 mostrou que duas rotações em ordem trocada dão
     resultados diferentes. Falta a outra metade da história: cada um
     desses resultados, por mais embaralhado que pareça, é ele próprio
     uma única rotação em torno de um eixo. Aqui o eixo é calculado e
     desenhado atravessando o cubo, e a terceira coluna mostra que
     girar só em torno dele reproduz o resultado.
     ================================================================= */
  REGISTRO.eixoangulo = function (raiz) {
    var est = { a1: 0, a2: 2, f1: 70, f2: 55 };
    var EIXOS = [
      { r: 'x', v: [1, 0, 0], m: M3.Rx },
      { r: 'y', v: [0, 1, 0], m: M3.Ry },
      { r: 'z', v: [0, 0, 1], m: M3.Rz }
    ];

    var corpo = moldura(raiz, 'Teorema de Euler: duas rotações valem por uma só');

    var c1 = el('div', { class: 'controles' });
    corpo.appendChild(c1);
    c1.appendChild(el('span', { class: 'etiqueta', texto: 'primeiro eixo' }));
    opcoes(c1, EIXOS.map(function (e, i) { return { rot: e.r, v: i }; }), 0,
      function (v) { est.a1 = v; desenhar(); });
    c1.appendChild(el('span', { class: 'etiqueta', texto: 'depois' }));
    opcoes(c1, EIXOS.map(function (e, i) { return { rot: e.r, v: i }; }), 2,
      function (v) { est.a2 = v; desenhar(); });

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'ângulo do primeiro giro', 0, 180, 1, 70,
      function (v) { est.f1 = v; desenhar(); }, function (v) { return v + '°'; });
    deslizante(ctr, 'ângulo do segundo giro', 0, 180, 1, 55,
      function (v) { est.f2 = v; desenhar(); }, function (v) { return v + '°'; });

    var mostrar = cartoes(corpo, [
      { rot: 'traço de R', k: 'tr' },
      { rot: 'ângulo equivalente φ', k: 'fi' },
      { rot: 'confere 1 + 2cos φ', k: 'chk' },
      { rot: 'eixo equivalente', k: 'eixo' },
      { rot: 'determinante', k: 'det' },
      { rot: 'erro entre as duas colunas', k: 'err' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    function dados() {
      var R1 = EIXOS[est.a1].m(est.f1 * Math.PI / 180);
      var R2 = EIXOS[est.a2].m(est.f2 * Math.PI / 180);
      var R = M3.mul(R2, R1);
      var ae = M3.anguloEixo(R);
      var Re = ae.eixo ? M3.eixoPara(ae.eixo, ae.ang) : R;
      var err = 0, i, j;
      for (i = 0; i < 3; i++) for (j = 0; j < 3; j++)
        err = Math.max(err, Math.abs(R[i][j] - Re[i][j]));
      return { R1: R1, R2: R2, R: R, ae: ae, Re: Re, err: err };
    }

    function desenhar() {
      var D = dados(), alt = 300;
      var p = G.preparar(cv, alt), ct = p.ct, Lp = p.L;
      ct.clearRect(0, 0, Lp, alt);

      var cols = 3, lg = Lp / cols;
      var s = Math.min(lg * 0.2, 40);
      var cy = alt / 2 + 2;

      var painel = [
        { R: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], rot: 'inicial', cor: G.COR.suave },
        { R: D.R, rot: 'os dois giros, em sequência', cor: G.COR.mestra },
        { R: D.Re, rot: 'um giro só, em torno do eixo', cor: G.COR.roxo }
      ];
      painel.forEach(function (q, i) {
        var cx = lg * i + lg / 2;
        /* o eixo equivalente atravessando o cubo, nos dois últimos */
        if (i > 0 && D.ae.eixo) {
          var e = M3.apl(VISTA, D.ae.eixo);
          var L2 = s * 2.1;
          ct.beginPath();
          ct.moveTo(cx - e[0] * L2, cy + e[2] * L2);
          ct.lineTo(cx + e[0] * L2, cy - e[2] * L2);
          ct.strokeStyle = G.COR.roxo; ct.lineWidth = 2;
          ct.setLineDash([5, 4]); ct.stroke(); ct.setLineDash([]);
        }
        desenhaCubo(ct, cx, cy, s, q.R);
        if (i > 0 && D.ae.eixo) {
          var e2 = M3.apl(VISTA, D.ae.eixo), L3 = s * 2.1;
          seta(ct, cx, cy, cx + e2[0] * L3, cy - e2[2] * L3, G.COR.roxo, 2.4);
        }
        rotulo(ct, q.rot, cx, alt - 14, q.cor, 'center', 'middle',
          '600 10px system-ui, sans-serif');
      });

      rotulo(ct, 'as duas colunas da direita têm de dar o mesmo cubo',
        Lp / 2, 14, G.COR.suave);

      var tr = M3.traco(D.R);
      mostrar({
        tr: F.fmt(tr, 4),
        fi: F.fmt(D.ae.ang * 180 / Math.PI, 2) + '°',
        chk: F.fmt(1 + 2 * Math.cos(D.ae.ang), 4),
        eixo: D.ae.eixo
          ? '(' + D.ae.eixo.map(function (c) { return F.fmt(c, 2); }).join('; ') + ')'
          : 'nenhum: é a identidade',
        det: F.fmt(M3.det(D.R), 4),
        err: D.err < 1e-9 ? 'zero' : F.fmt(D.err, 9)
      });

      nota.innerHTML =
        '<p>Compondo dois giros em torno de eixos diferentes, o resultado é uma matriz '
        + 'ortogonal de determinante \\(+1\\), porque o produto de duas dessas é outra do '
        + 'mesmo tipo. O <strong>teorema de Euler</strong> diz mais do que isso: toda matriz '
        + 'assim é uma rotação em torno de <em>algum</em> eixo.</p>'
        + '<p>A demonstração cabe em duas linhas. Procura-se um vetor que a rotação deixe '
        + 'parado, isto é, um autovetor de autovalor 1, o que exige '
        + '\\(\\det(\\Ten{R}-\\Ten{1})=0\\). Usando \\(\\det\\Ten{R}=1\\),</p>'
        + '\\[\\det(\\Ten{R}-\\Ten{1})=\\det\\Ten{R}^{\\sf T}\\det(\\Ten{R}-\\Ten{1})'
        + '=\\det(\\Ten{1}-\\Ten{R}^{\\sf T})=\\det(\\Ten{1}-\\Ten{R})'
        + '=-\\det(\\Ten{R}-\\Ten{1}),\\]'
        + '<p>de modo que o determinante é igual ao seu próprio negativo e portanto nulo. O '
        + 'eixo existe, e existe porque a dimensão é ímpar: no plano, uma rotação não deixa '
        + 'direção nenhuma parada.</p>'
        + '<p>O ângulo sai do traço. Escrevendo a rotação numa base cujo terceiro vetor é o '
        + 'próprio eixo, a matriz fica com um bloco \\(2\\cruz2\\) de rotação e um 1 no '
        + 'canto, e o traço vale \\(1+2\\cos\\varphi\\). Como o traço não muda com a mudança '
        + 'de base, isso vale em qualquer uma. Confira nos cartões: o traço é '
        + F.fmt(tr, 4) + ' e \\(1+2\\cos\\varphi\\) dá '
        + F.fmt(1 + 2 * Math.cos(D.ae.ang), 4) + '.</p>'
        + '<p>A terceira coluna da figura é a prova visual. Ela aplica ao cubo inicial uma '
        + 'única rotação de ' + F.fmt(D.ae.ang * 180 / Math.PI, 1) + '° em torno do eixo '
        + 'roxo, e o resultado coincide com o da sequência de dois giros, elemento a '
        + 'elemento, com erro ' + (D.err < 1e-9 ? 'nulo' : F.fmt(D.err, 9)) + '.</p>';
      tipografar(corpo);
    }

    registrarRedesenho(desenhar);
  };

  /* =================================================================
     15. Ativa ou passiva
     A fonte mais comum de erro de sinal em todo o curso. As duas
     operações usam a mesma matriz, uma delas transposta, e a figura
     deixa claro que numa o vetor se move e na outra quem se move são
     os eixos.
     ================================================================= */
  REGISTRO.ativapassiva = function (raiz) {
    var est = { vista: 'passiva', th: 40, vx: 2.1, vy: 0.9 };

    var corpo = moldura(raiz, 'Girar o vetor ou girar os eixos');

    var c0 = el('div', { class: 'controles' });
    corpo.appendChild(c0);
    opcoes(c0, [
      { rot: 'Passiva: giram os eixos', v: 'passiva' },
      { rot: 'Ativa: gira o vetor', v: 'ativa' }
    ], 0, function (v) { est.vista = v; desenhar(); });

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'ângulo θ', -180, 180, 1, 40,
      function (v) { est.th = v; desenhar(); }, function (v) { return v + '°'; });
    deslizante(ctr, 'componente x do vetor', -2.5, 2.5, 0.1, 2.1,
      function (v) { est.vx = v; desenhar(); }, function (v) { return F.fmt(v, 1); });
    deslizante(ctr, 'componente y do vetor', -2.5, 2.5, 0.1, 0.9,
      function (v) { est.vy = v; desenhar(); }, function (v) { return F.fmt(v, 1); });

    var mostrar = cartoes(corpo, [
      { rot: 'o vetor na base antiga', k: 'a' },
      { rot: 'o vetor na base nova', k: 'b' },
      { rot: 'módulo (não muda)', k: 'm' },
      { rot: 'matriz usada', k: 'mat' },
      { rot: 'o que girou', k: 'quem' },
      { rot: 'o que ficou parado', k: 'parado' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    function desenhar() {
      var a = est.th * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      var alt = 320;
      var p = G.preparar(cv, alt), ct = p.ct, Lp = p.L;
      ct.clearRect(0, 0, Lp, alt);

      var esc = Math.min((alt - 56) / 5.6, (Lp - 60) / 6.4, 54);
      var cx = Lp / 2, cy = alt / 2 + 2;
      var X = function (u) { return cx + u * esc; };
      var Y = function (u) { return cy - u * esc; };
      var passiva = est.vista === 'passiva';

      /* base antiga, sempre no lugar */
      ct.strokeStyle = G.COR.grade; ct.lineWidth = 1.4;
      ct.beginPath(); ct.moveTo(X(-2.8), Y(0)); ct.lineTo(X(2.8), Y(0)); ct.stroke();
      ct.beginPath(); ct.moveTo(X(0), Y(-2.4)); ct.lineTo(X(0), Y(2.4)); ct.stroke();
      seta(ct, X(0), Y(0), X(1), Y(0), G.COR.suave, 2);
      seta(ct, X(0), Y(0), X(0), Y(1), G.COR.suave, 2);
      rotulo(ct, 'x̂', X(1.16), Y(-0.16), G.COR.suave);
      rotulo(ct, 'ŷ', X(-0.18), Y(1.16), G.COR.suave);

      if (passiva) {
        /* a base nova, girada de θ */
        ct.strokeStyle = 'rgba(23,107,93,.3)'; ct.lineWidth = 1.2;
        ct.beginPath();
        ct.moveTo(X(-2.8 * c), Y(-2.8 * s)); ct.lineTo(X(2.8 * c), Y(2.8 * s)); ct.stroke();
        ct.beginPath();
        ct.moveTo(X(2.4 * s), Y(-2.4 * c)); ct.lineTo(X(-2.4 * s), Y(2.4 * c)); ct.stroke();
        seta(ct, X(0), Y(0), X(c), Y(s), G.COR.mestra, 2.4);
        seta(ct, X(0), Y(0), X(-s), Y(c), G.COR.mestra, 2.4);
        rotulo(ct, "x̂'", X(1.2 * c), Y(1.2 * s), G.COR.mestra);
        rotulo(ct, "ŷ'", X(-1.2 * s), Y(1.2 * c), G.COR.mestra);
      }

      /* o vetor */
      var v = passiva ? [est.vx, est.vy]
                      : [c * est.vx - s * est.vy, s * est.vx + c * est.vy];
      if (!passiva) {
        seta(ct, X(0), Y(0), X(est.vx), Y(est.vy), G.COR.grade, 2.4);
        rotulo(ct, 'antes', X(est.vx * 1.1), Y(est.vy * 1.1) + 14, G.COR.suave);
      }
      seta(ct, X(0), Y(0), X(v[0]), Y(v[1]), G.COR.bronze, 3);
      rotulo(ct, 'v', X(v[0] * 1.1), Y(v[1] * 1.1) - 12, G.COR.bronze);

      /* as componentes do vetor na base que interessa */
      var comp = passiva ? [c * est.vx + s * est.vy, -s * est.vx + c * est.vy]
                         : [v[0], v[1]];
      var e1 = passiva ? [c, s] : [1, 0], e2 = passiva ? [-s, c] : [0, 1];
      ct.setLineDash([3, 3]); ct.strokeStyle = G.COR.roxo; ct.lineWidth = 1.4;
      ct.beginPath();
      ct.moveTo(X(v[0]), Y(v[1]));
      ct.lineTo(X(comp[0] * e1[0]), Y(comp[0] * e1[1]));
      ct.stroke();
      ct.beginPath();
      ct.moveTo(X(v[0]), Y(v[1]));
      ct.lineTo(X(comp[1] * e2[0]), Y(comp[1] * e2[1]));
      ct.stroke();
      ct.setLineDash([]);

      rotulo(ct, passiva ? 'o vetor não se mexe; os eixos é que giram'
                         : 'os eixos não se mexem; o vetor é que gira',
        Lp / 2, 16, passiva ? G.COR.mestra : G.COR.bronze);

      mostrar({
        a: '(' + F.fmt(est.vx, 2) + '; ' + F.fmt(est.vy, 2) + ')',
        b: '(' + F.fmt(comp[0], 2) + '; ' + F.fmt(comp[1], 2) + ')',
        m: F.fmt(Math.sqrt(est.vx * est.vx + est.vy * est.vy), 3),
        mat: passiva ? 'Rᵀ(θ) nas componentes' : 'R(θ) no vetor',
        quem: passiva ? 'a base' : 'o vetor',
        parado: passiva ? 'o vetor' : 'a base'
      });

      nota.innerHTML =
        '<p>A mesma matriz \\(\\Ten{R}(\\theta)\\) serve a duas operações que são quase '
        + 'opostas, e trocar uma pela outra é a origem de metade dos erros de sinal deste '
        + 'curso.</p>'
        + '<p>Na transformação <strong>passiva</strong>, que é a do módulo 6, o vetor é um '
        + 'objeto físico e não se mexe: uma velocidade continua sendo a mesma velocidade. O '
        + 'que gira é o sistema de eixos de quem observa, e o que muda são as '
        + '<em>componentes</em>:</p>'
        + '\\[v\\,\'_i=\\left(\\Ten{R}^{\\sf T}\\right)_{ij}v_j,'
        + '\\qquad\\text{isto é}\\qquad v\\,\'_i=\\vers{e}\\,\'_i\\cdot\\vet{v}.\\]'
        + '<p>Na transformação <strong>ativa</strong>, que é a do módulo 1, os eixos ficam '
        + 'parados e quem gira é o corpo. Aí \\(\\vet{v}\\,\'=\\Ten{R}\\vet{v}\\) é um vetor '
        + 'diferente do original, apontando para outro lado.</p>'
        + '<p>Troque entre as duas vistas com o mesmo \\(\\theta\\) e compare os números: as '
        + 'componentes resultantes diferem exatamente pela troca do sinal de \\(\\theta\\), '
        + 'porque \\(\\Ten{R}^{\\sf T}(\\theta)=\\Ten{R}(-\\theta)\\). Girar os eixos de '
        + '\\(+\\theta\\) é indistinguível, nas contas, de girar o mundo de '
        + '\\(-\\theta\\).</p>'
        + '<p>O módulo do vetor, em ambos os casos, não muda: ' + F.fmt(
          Math.sqrt(est.vx * est.vx + est.vy * est.vy), 3) + '. É a ortogonalidade da matriz '
        + 'garantindo que comprimentos sobrevivem à transformação, seja qual for a leitura '
        + 'que se dê a ela.</p>';
      tipografar(corpo);
    }

    registrarRedesenho(desenhar);
  };


  /* =================================================================
     16. O mesmo movimento, visto de dois referenciais
     Nenhuma força age sobre a bola, e no laboratório ela anda em linha
     reta. Pôr as duas vistas lado a lado mostra que a curva do disco
     não está na bola, está no observador, e que as setas de Coriolis e
     centrífuga são exatamente o que falta para a reta virar espiral.
     ================================================================= */
  REGISTRO.girante = function (raiz) {
    var est = { vista: 'disco', W: 1.1, v: 1.0, t: 0, rodando: true };

    var corpo = moldura(raiz, 'Referencial girante: de onde vem a curva');

    var c0 = el('div', { class: 'controles' });
    corpo.appendChild(c0);
    opcoes(c0, [
      { rot: 'Quem gira com o disco', v: 'disco' },
      { rot: 'Quem está no laboratório', v: 'lab' },
      { rot: 'As duas lado a lado', v: 'ambas' }
    ], 0, function (v) { est.vista = v; });

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'rotação do disco Ω', 0, 2.4, 0.05, 1.1,
      function (v) { est.W = v; est.t = 0; },
      function (v) { return F.fmt(v, 2) + ' rad/s'; });
    deslizante(ctr, 'velocidade de lançamento', 0.3, 2, 0.05, 1,
      function (v) { est.v = v; est.t = 0; },
      function (v) { return F.fmt(v, 2) + ' m/s'; });
    var bt = el('button', { type: 'button', texto: 'lançar de novo' });
    bt.addEventListener('click', function () { est.t = 0; est.rodando = true; });
    ctr.appendChild(bt);

    var mostrar = cartoes(corpo, [
      { rot: 'força real sobre a bola', k: 'real' },
      { rot: 'distância ao centro', k: 'r' },
      { rot: 'centrífuga por unidade de massa', k: 'cf' },
      { rot: 'Coriolis por unidade de massa', k: 'co' },
      { rot: 'razão Coriolis / centrífuga', k: 'raz' },
      { rot: 'ângulo já girado pelo disco', k: 'ang' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    var TMAX = 2.6;
    function noLab(t) { return [est.v * t, 0]; }
    function noDisco(t) {
      var a = est.W * t, c = Math.cos(a), s = Math.sin(a), q = noLab(t);
      return [c * q[0] + s * q[1], -s * q[0] + c * q[1]];
    }

    function painel(ct, cx, cy, esc, girante, t, rotulo1) {
      var ang = est.W * t;
      /* o disco, com uma marca que denuncia a rotação */
      ct.beginPath(); ct.arc(cx, cy, 2.3 * esc, 0, 2 * Math.PI);
      ct.fillStyle = 'rgba(23,107,93,.07)'; ct.fill();
      ct.strokeStyle = G.COR.mestra; ct.lineWidth = 2; ct.stroke();
      var marca = girante ? 0 : ang;
      for (var k = 0; k < 4; k++) {
        var a2 = marca + k * Math.PI / 2;
        ct.beginPath();
        ct.moveTo(cx, cy);
        ct.lineTo(cx + 2.3 * esc * Math.cos(a2), cy - 2.3 * esc * Math.sin(a2));
        ct.strokeStyle = 'rgba(23,107,93,.22)'; ct.lineWidth = 1.2; ct.stroke();
      }

      /* rastro */
      ct.beginPath(); ct.strokeStyle = G.COR.bronze; ct.lineWidth = 2.2;
      for (var j = 0; j <= 160; j++) {
        var tt = t * j / 160, q = girante ? noDisco(tt) : noLab(tt);
        (j ? ct.lineTo : ct.moveTo).call(ct, cx + q[0] * esc, cy - q[1] * esc);
      }
      ct.stroke();

      var p = girante ? noDisco(t) : noLab(t);
      var px = cx + p[0] * esc, py = cy - p[1] * esc;

      /* no referencial girante, as duas forças de inércia */
      if (girante && t > 0.02) {
        var r = Math.sqrt(p[0] * p[0] + p[1] * p[1]);
        if (r > 1e-3) {
          var ur = [p[0] / r, p[1] / r];
          var acf = est.W * est.W * r;
          seta(ct, px, py, px + ur[0] * acf * esc * 0.42,
            py - ur[1] * acf * esc * 0.42, G.COR.vinho, 2.4);
          /* velocidade relativa: derivada de noDisco */
          var h = 0.004, q1 = noDisco(t + h), q0 = noDisco(t - h);
          var vr = [(q1[0] - q0[0]) / (2 * h), (q1[1] - q0[1]) / (2 * h)];
          /* -2 Ω ẑ × v, com Ω no sentido anti-horário */
          var aco = [2 * est.W * vr[1], -2 * est.W * vr[0]];
          seta(ct, px, py, px + aco[0] * esc * 0.42, py - aco[1] * esc * 0.42,
            G.COR.roxo, 2.4);
        }
      }

      ct.beginPath(); ct.arc(px, py, 6, 0, 2 * Math.PI);
      ct.fillStyle = G.COR.bronze; ct.fill();
      ct.strokeStyle = '#fff'; ct.lineWidth = 1.6; ct.stroke();
      ct.beginPath(); ct.arc(cx, cy, 3, 0, 2 * Math.PI);
      ct.fillStyle = G.COR.tinta; ct.fill();
      rotulo(ct, rotulo1, cx, cy + 2.3 * esc + 18, girante ? G.COR.mestra : G.COR.suave);
    }

    function desenhar() {
      var alt = 310;
      var p = G.preparar(cv, alt), ct = p.ct, Lp = p.L;
      ct.clearRect(0, 0, Lp, alt);
      var t = Math.min(est.t, TMAX);
      var duas = est.vista === 'ambas' && Lp > 560;

      if (duas) {
        var esc = Math.min((Lp / 2 - 40) / 5, (alt - 70) / 5);
        painel(ct, Lp * 0.25, alt / 2 - 8, esc, true, t, 'visto do disco');
        painel(ct, Lp * 0.75, alt / 2 - 8, esc, false, t, 'visto do laboratório');
        ct.strokeStyle = G.COR.grade; ct.lineWidth = 1;
        ct.beginPath(); ct.moveTo(Lp / 2, 16); ct.lineTo(Lp / 2, alt - 16); ct.stroke();
      } else {
        var esc2 = Math.min((Lp - 60) / 5.2, (alt - 60) / 5.2);
        var gir = est.vista !== 'lab';
        painel(ct, Lp / 2, alt / 2 - 6, esc2, gir, t,
          gir ? 'visto do disco' : 'visto do laboratório');
      }

      if (est.vista !== 'lab') {
        rotulo(ct, 'centrífuga', 10, 16, G.COR.vinho, 'left');
        rotulo(ct, 'Coriolis', 10, 32, G.COR.roxo, 'left');
      }

      var q = noDisco(t), r = Math.sqrt(q[0] * q[0] + q[1] * q[1]);
      var acf = est.W * est.W * r, aco = 2 * est.W * est.v;
      mostrar({
        real: 'nenhuma',
        r: F.fmt(r, 2) + ' m',
        cf: F.fmt(acf, 2) + ' m/s²',
        co: F.fmt(aco, 2) + ' m/s²',
        raz: r > 0.02 ? F.fmt(aco / acf, 2) : '—',
        ang: F.fmt(est.W * t * 180 / Math.PI, 0) + '°'
      });
    }

    function texto() {
      nota.innerHTML =
        '<p>Uma bola desliza sem atrito sobre um disco que gira. Nenhuma força horizontal '
        + 'age sobre ela, e por isso, <strong>vista do laboratório, ela anda em linha '
        + 'reta</strong>, como manda a primeira lei. Nada de estranho acontece.</p>'
        + '<p>Vista de quem gira junto com o disco, a mesma bola descreve uma espiral que se '
        + 'encurva. Um observador preso ao disco, convencido de estar parado, precisa '
        + 'explicar essa curva, e para isso inventa forças. É por isso que elas se chamam '
        + '<em>fictícias</em>: a curva não está na bola, está no observador.</p>'
        + '<p>Aplicando o teorema do transporte duas vezes à posição, a aceleração medida no '
        + 'referencial girante satisfaz</p>'
        + '\\[m\\vet{a}_{\\rm rel}=\\vet{F}'
        + '\\underbrace{-\\,m\\vet{\\omega}\\cruz\\left(\\vet{\\omega}\\cruz\\vet{r}\\right)}'
        + '_{\\text{centrífuga}}'
        + '\\underbrace{-\\,2m\\vet{\\omega}\\cruz\\vet{v}_{\\rm rel}}_{\\text{Coriolis}}'
        + '\\underbrace{-\\,m\\dot{\\vet{\\omega}}\\cruz\\vet{r}}_{\\text{Euler}}.\\]'
        + '<p>Com \\(\\vet{F}=\\vet 0\\), como aqui, sobram só as três de inércia, e como '
        + '\\(\\Omega\\) é constante a de Euler também some. As duas setas desenhadas na '
        + 'bola são exatamente o que o observador do disco precisa postular para que a '
        + 'espiral obedeça à segunda lei.</p>'
        + '<p>Repare na diferença entre elas. A <strong>centrífuga</strong> aponta sempre '
        + 'para fora, cresce com a distância ao eixo e não depende de a bola estar se '
        + 'movendo. A <strong>de Coriolis</strong> é perpendicular à velocidade relativa, '
        + 'some quando a bola está parada no disco e nunca realiza trabalho, porque é sempre '
        + 'ortogonal ao deslocamento. É ela que encurva, e a centrífuga apenas afasta.</p>';
      tipografar(corpo);
    }

    var chaveAnt = '';
    function quadro() {
      if (est.rodando) {
        est.t += 0.016;
        if (est.t > TMAX + 0.6) est.t = 0;
      }
      desenhar();
      if (est.vista !== chaveAnt) { chaveAnt = est.vista; texto(); }
      requestAnimationFrame(quadro);
    }

    texto();
    requestAnimationFrame(quadro);
    registrarRedesenho(desenhar);
  };

  /* =================================================================
     17. Gravidade efetiva e o fio de prumo
     A centrífuga da Terra é pequena, mas não é zero, e o que ela faz
     de mais instrutivo não é diminuir g: é inclinar a vertical. O
     desvio do fio de prumo é máximo em 45° e vale seis minutos de
     arco, e nenhuma construção civil ignora isso.
     ================================================================= */
  REGISTRO.pesoefetivo = function (raiz) {
    var OM = 7.2921e-5, RT = 6.371e6, G0 = 9.8144;
    var est = { vista: 'corte', lat: 45, exag: 60 };

    var corpo = moldura(raiz, 'A Terra gira: g efetivo e o fio de prumo');

    var c0 = el('div', { class: 'controles' });
    corpo.appendChild(c0);
    opcoes(c0, [
      { rot: 'Corte da Terra', v: 'corte' },
      { rot: 'Contra a latitude', v: 'curva' }
    ], 0, function (v) { est.vista = v; desenhar(); });

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'latitude', -90, 90, 1, 45,
      function (v) { est.lat = v; desenhar(); },
      function (v) { return Math.abs(v) + '° ' + (v >= 0 ? 'N' : 'S'); });
    deslizante(ctr, 'exagero da centrífuga no desenho', 10, 120, 5, 60,
      function (v) { est.exag = v; desenhar(); },
      function (v) { return v + ' vezes'; });

    var mostrar = cartoes(corpo, [
      { rot: 'aceleração centrífuga', k: 'ac' },
      { rot: 'fração de g', k: 'fr' },
      { rot: 'g efetivo (só a rotação)', k: 'gef' },
      { rot: 'desvio do fio de prumo', k: 'des' },
      { rot: 'desvio em minutos de arco', k: 'min' },
      { rot: 'g medido nessa latitude', k: 'med' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    function dados(latg) {
      var la = latg * Math.PI / 180;
      var ac = OM * OM * RT * Math.cos(la);
      var gv = G0 - ac * Math.cos(la);
      var gh = ac * Math.sin(la);
      /* fórmula internacional da gravidade, que já inclui o achatamento */
      var med = 9.780327 * (1 + 0.0053024 * Math.pow(Math.sin(la), 2)
        - 0.0000058 * Math.pow(Math.sin(2 * la), 2));
      return { la: la, ac: ac, gv: gv, gh: gh,
               g: Math.sqrt(gv * gv + gh * gh),
               des: Math.atan2(Math.abs(gh), gv) * 180 / Math.PI, med: med };
    }

    function desenhaCorte() {
      var D = dados(est.lat), alt = 330;
      var p = G.preparar(cv, alt), ct = p.ct, Lp = p.L;
      ct.clearRect(0, 0, Lp, alt);

      var R = Math.min((alt - 54) / 2, Lp * 0.26);
      var cx = Lp * (Lp > 620 ? 0.42 : 0.5), cy = alt / 2;

      /* o globo em corte, com o eixo */
      ct.beginPath(); ct.arc(cx, cy, R, 0, 2 * Math.PI);
      ct.fillStyle = 'rgba(23,107,93,.08)'; ct.fill();
      ct.strokeStyle = G.COR.mestra; ct.lineWidth = 2; ct.stroke();
      ct.beginPath(); ct.moveTo(cx, cy - R * 1.22); ct.lineTo(cx, cy + R * 1.22);
      ct.strokeStyle = G.COR.suave; ct.lineWidth = 1.6;
      ct.setLineDash([6, 4]); ct.stroke(); ct.setLineDash([]);
      ct.beginPath(); ct.moveTo(cx - R, cy); ct.lineTo(cx + R, cy);
      ct.strokeStyle = G.COR.grade; ct.lineWidth = 1.4; ct.stroke();
      rotulo(ct, 'eixo', cx, cy - R * 1.22 - 10, G.COR.suave);
      rotulo(ct, 'equador', cx + R + 4, cy, G.COR.suave, 'left');

      /* o ponto na latitude escolhida */
      var px = cx + R * Math.cos(D.la), py = cy - R * Math.sin(D.la);
      ct.beginPath(); ct.arc(px, py, 5, 0, 2 * Math.PI);
      ct.fillStyle = G.COR.tinta; ct.fill();

      /* distância ao eixo */
      ct.beginPath(); ct.moveTo(cx, py); ct.lineTo(px, py);
      ct.strokeStyle = G.COR.grade; ct.lineWidth = 1.4;
      ct.setLineDash([3, 3]); ct.stroke(); ct.setLineDash([]);

      /* os três vetores, com a centrífuga exagerada para ser visível */
      var ev = R / G0 * 0.85;
      var ex = est.exag;
      seta(ct, px, py, px - Math.cos(D.la) * G0 * ev,
        py + Math.sin(D.la) * G0 * ev, G.COR.azul, 2.6);
      rotulo(ct, 'atração', px - Math.cos(D.la) * G0 * ev * 1.1,
        py + Math.sin(D.la) * G0 * ev * 1.1 + 12, G.COR.azul);
      seta(ct, px, py, px + D.ac * ex * ev, py, G.COR.vinho, 2.6);
      rotulo(ct, 'centrífuga ×' + ex, px + D.ac * ex * ev + 8, py - 12,
        G.COR.vinho, 'left');
      /* a soma, com a mesma exageração na parte centrífuga */
      var sx = -Math.cos(D.la) * G0 + D.ac * ex;
      var sy = Math.sin(D.la) * G0;
      seta(ct, px, py, px + sx * ev, py + sy * ev, G.COR.bronze, 3);
      rotulo(ct, 'fio de prumo', px + sx * ev * 1.06, py + sy * ev * 1.06 + 14,
        G.COR.bronze);

      if (Lp > 620) {
        rotulo(ct, 'latitude ' + Math.abs(est.lat) + '°', Lp * 0.84, 24, G.COR.tinta);
        rotulo(ct, 'desvio: ' + F.fmt(D.des * 60, 2) + "'", Lp * 0.84, 46, G.COR.bronze);
        rotulo(ct, 'g = ' + F.fmt(D.g, 4) + ' m/s²', Lp * 0.84, 68, G.COR.mestra);
      }
    }

    function desenhaCurva() {
      var gr = G.eixos(cv, {
        altura: 320, xmin: 0, xmax: 90, ymin: 0, ymax: 6.6,
        rotX: 'latitude (graus)',
        rotY: "desvio do prumo (')   e   100 (g − 9,78)",
        marcasX: G.marcasLineares(0, 90, 6, 0),
        formataY: function (v) { return F.fmt(v, 1); }
      });
      G.curva(gr, function (l) { return dados(l).des * 60; }, G.COR.bronze, 2.6);
      G.curva(gr, function (l) { return 100 * (dados(l).g - 9.78); }, G.COR.mestra, 2.6);
      G.curva(gr, function (l) { return 100 * (dados(l).med - 9.78); },
        G.COR.azul, 2.2, [6, 5]);
      G.vertical(gr, Math.abs(est.lat), G.COR.suave, '', true);
      var ct = gr.ct;
      rotulo(ct, 'desvio do fio de prumo, máximo em 45°', gr.X(45),
        gr.Y(dados(45).des * 60) - 15, G.COR.bronze);
      rotulo(ct, 'só a rotação', gr.X(72), gr.Y(100 * (dados(72).g - 9.78)) + 15,
        G.COR.mestra);
      rotulo(ct, 'g medido, com o achatamento', gr.X(58),
        gr.Y(100 * (dados(58).med - 9.78)) - 14, '#20486c');
    }

    function desenhar() {
      var D = dados(est.lat);
      if (est.vista === 'corte') desenhaCorte();
      else desenhaCurva();
      mostrar({
        ac: F.fmt(D.ac, 4) + ' m/s²',
        fr: F.pct(D.ac / G0, 3),
        gef: F.fmt(D.g, 4) + ' m/s²',
        des: F.fmt(D.des, 4) + '°',
        min: F.fmt(D.des * 60, 2) + "'",
        med: F.fmt(D.med, 4) + ' m/s²'
      });

      nota.innerHTML =
        '<p>Um laboratório na superfície da Terra gira com ela, a '
        + '\\(\\omega=7{,}292\\cruz10^{-5}\\) rad/s. Quem trabalha nesse laboratório e '
        + 'escreve a segunda lei sem correção está num referencial girante, e paga por isso '
        + 'com duas forças de inércia.</p>'
        + '<p>A <strong>centrífuga</strong> aponta para fora do eixo, e não do centro da '
        + 'Terra. Seu módulo é \\(\\omega^2R\\cos\\lambda\\), que no equador vale 0,0339 '
        + 'm/s², ou 0,35% de \\(g\\). Decompondo-a na vertical e na horizontal do lugar,</p>'
        + '\\[g_{\\rm ef}=g_0-\\omega^2R\\cos^2\\lambda,\\qquad '
        + 'g_{\\rm horiz}=\\omega^2R\\cos\\lambda\\sen\\lambda.\\]'
        + '<p>A primeira parcela é a que todo mundo cita: a balança marca menos no equador. A '
        + 'segunda é a mais interessante e quase nunca mencionada. Ela é horizontal, aponta '
        + 'para o equador, e <strong>inclina a vertical</strong>: o fio de prumo não aponta '
        + 'para o centro da Terra em latitude nenhuma, exceto nos polos e no equador. O '
        + 'desvio vale \\(\\left(\\omega^2R/2g\\right)\\sen2\\lambda\\), máximo em 45° de '
        + 'latitude, onde chega a 5,9 minutos de arco. Em ' + Math.abs(est.lat) + '° ele é '
        + F.fmt(D.des * 60, 2) + " minutos.</p>"
        + '<p>Seis minutos de arco parecem pouco até se multiplicar por uma altura. No topo '
        + 'de um prédio de 200 m, essa inclinação dá 34 cm de diferença em relação à direção '
        + 'do centro da Terra. Topografia e construção civil trabalham com a vertical do fio '
        + 'de prumo, que é esta, e não com a direção da atração gravitacional.</p>'
        + '<p>Uma honestidade necessária: a curva tracejada da segunda vista é o \\(g\\) '
        + 'realmente medido, e ela não coincide com a prevista só pela rotação. A diferença '
        + 'vem do <strong>achatamento</strong> da Terra, que afasta o equador do centro e '
        + 'responde por cerca de um terço da variação total de 9,780 a 9,832 m/s². As duas '
        + 'causas têm a mesma origem histórica, porque foi a rotação que achatou o planeta, '
        + 'mas são efeitos distintos.</p>';
      tipografar(corpo);
    }

    registrarRedesenho(desenhar);
  };

  /* =================================================================
     18. O pêndulo de Foucault
     A experiência de 1851 é a demonstração mais direta de que a Terra
     gira, e o fator sen(latitude) é o que a torna um problema de
     mecânica e não de astronomia: no equador o pêndulo não precessa, e
     isso é tão instrutivo quanto o caso do polo.
     ================================================================= */
  REGISTRO.foucault = function (raiz) {
    var DIA = 23.9344699;                 // dia sideral, em horas
    var est = { lat: 48.87, t: 0, rodando: true, vel: 1 };

    var corpo = moldura(raiz, 'O pêndulo de Foucault, visto de cima');

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'latitude', -90, 90, 1, 49,
      function (v) { est.lat = v; est.t = 0; },
      function (v) { return Math.abs(v) + '° ' + (v >= 0 ? 'N' : 'S'); });
    deslizante(ctr, 'velocidade da animação', 0.3, 4, 0.1, 1,
      function (v) { est.vel = v; }, function (v) { return F.fmt(v, 1) + '×'; });
    var bt = el('button', { type: 'button', texto: 'pausar' });
    bt.addEventListener('click', function () {
      est.rodando = !est.rodando;
      bt.textContent = est.rodando ? 'pausar' : 'continuar';
    });
    ctr.appendChild(bt);

    var mostrar = cartoes(corpo, [
      { rot: 'latitude', k: 'lat' },
      { rot: 'taxa de precessão', k: 'taxa' },
      { rot: 'período de uma volta', k: 'per' },
      { rot: 'sentido', k: 'sent' },
      { rot: 'já girou', k: 'ja' },
      { rot: 'no Panteão de Paris', k: 'paris' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    function dados() {
      var s = Math.sin(est.lat * Math.PI / 180);
      return { s: s, taxa: 15.041 * s, per: Math.abs(s) < 1e-4 ? Infinity : DIA / Math.abs(s) };
    }

    function desenhar() {
      var D = dados(), alt = 310;
      var p = G.preparar(cv, alt), ct = p.ct, Lp = p.L;
      ct.clearRect(0, 0, Lp, alt);

      var R = Math.min((alt - 56) / 2, Lp * 0.3);
      var cx = Lp / 2, cy = alt / 2 - 2;
      /* uma volta do plano de oscilação em TMOSTRA segundos de animação */
      var ang = -D.s * est.t * 0.55;

      /* a areia do chão e as marcas já riscadas */
      ct.beginPath(); ct.arc(cx, cy, R, 0, 2 * Math.PI);
      ct.fillStyle = 'rgba(181,131,31,.08)'; ct.fill();
      ct.strokeStyle = G.COR.suave; ct.lineWidth = 2; ct.stroke();

      var nm = 26;
      for (var k = 0; k < nm; k++) {
        var tk = est.t * k / (nm - 1), ak = -D.s * tk * 0.55;
        ct.beginPath();
        ct.moveTo(cx + R * 0.94 * Math.cos(ak), cy - R * 0.94 * Math.sin(ak));
        ct.lineTo(cx - R * 0.94 * Math.cos(ak), cy + R * 0.94 * Math.sin(ak));
        ct.strokeStyle = 'rgba(168,96,31,' + (0.07 + 0.2 * k / nm) + ')';
        ct.lineWidth = 1.2; ct.stroke();
      }

      /* o plano de oscilação agora, e a massa indo e vindo */
      ct.beginPath();
      ct.moveTo(cx + R * 0.94 * Math.cos(ang), cy - R * 0.94 * Math.sin(ang));
      ct.lineTo(cx - R * 0.94 * Math.cos(ang), cy + R * 0.94 * Math.sin(ang));
      ct.strokeStyle = G.COR.bronze; ct.lineWidth = 2.4; ct.stroke();
      var u = 0.94 * Math.cos(est.t * 7);
      var bx = cx + R * u * Math.cos(ang), by = cy - R * u * Math.sin(ang);
      ct.beginPath(); ct.arc(bx, by, 7, 0, 2 * Math.PI);
      ct.fillStyle = G.COR.bronze; ct.fill();
      ct.strokeStyle = '#fff'; ct.lineWidth = 1.6; ct.stroke();
      ct.beginPath(); ct.arc(cx, cy, 3, 0, 2 * Math.PI);
      ct.fillStyle = G.COR.tinta; ct.fill();

      /* a direção inicial, para medir quanto já girou */
      ct.beginPath();
      ct.moveTo(cx + R * 1.02, cy); ct.lineTo(cx - R * 1.02, cy);
      ct.strokeStyle = G.COR.grade; ct.lineWidth = 1.4;
      ct.setLineDash([5, 4]); ct.stroke(); ct.setLineDash([]);

      rotulo(ct, D.s > 0.001 ? 'gira no sentido horário'
        : D.s < -0.001 ? 'gira no sentido anti-horário'
        : 'não gira: aqui o pêndulo não denuncia nada',
        cx, 16, Math.abs(D.s) < 0.001 ? G.COR.suave : G.COR.bronze);
      rotulo(ct, 'norte', cx, cy - R - 14, G.COR.suave);

      mostrar({
        lat: Math.abs(est.lat) + '° ' + (est.lat >= 0 ? 'N' : 'S'),
        taxa: F.fmt(D.taxa, 2) + '°/h',
        per: D.per === Infinity ? 'nunca completa' : F.fmt(D.per, 1) + ' h',
        sent: D.s > 0.001 ? 'horário (hemisfério norte)'
          : D.s < -0.001 ? 'anti-horário (sul)' : 'nenhum',
        ja: F.fmt(Math.abs(ang) * 180 / Math.PI % 360, 0) + '°',
        paris: '31,8 h, a 48,87° N'
      });
    }

    function texto() {
      var D = dados();
      nota.innerHTML =
        '<p>Em 1851, no Panteão de Paris, Foucault pendurou uma esfera de 28 kg num fio de '
        + '67 m e a pôs a oscilar diante do público. Ao longo das horas, o plano de '
        + 'oscilação foi girando, riscando a areia do chão em direções sucessivamente '
        + 'diferentes. Nenhuma força horizontal agia sobre o pêndulo, e ainda assim o plano '
        + 'girava.</p>'
        + '<p>A explicação é a força de Coriolis. Decompondo \\(\\vet{\\omega}\\) da Terra na '
        + 'vertical e na horizontal do lugar, só a componente vertical, '
        + '\\(\\omega\\sen\\lambda\\), produz desvio no plano horizontal. O plano de '
        + 'oscilação precessa com essa taxa, no sentido oposto ao da rotação local:</p>'
        + '\\[\\Omega_{\\rm prec}=-\\,\\omega\\sen\\lambda,\\qquad '
        + 'T_{\\rm prec}=\\frac{23{,}93\\ {\\rm h}}{\\left|\\sen\\lambda\\right|}.\\]'
        + '<p>O fator \\(\\sen\\lambda\\) é o que transforma a experiência num problema de '
        + 'mecânica. No polo, \\(\\sen\\lambda=1\\): o pêndulo mantém o plano fixo em relação '
        + 'às estrelas e o chão gira sob ele em 23,93 h, que é o dia sideral. Em Paris, a '
        + '48,87°, o período sobe para 31,8 h, pouco menos de 11° por hora, que foi o que o '
        + 'público viu.</p>'
        + '<p>No equador, \\(\\sen\\lambda=0\\) e <strong>o pêndulo não precessa</strong>. '
        + 'Esse caso é tão instrutivo quanto o do polo: a experiência de Foucault não '
        + 'funciona em todo lugar, e isso mostra que ela mede a componente vertical da '
        + 'rotação, não a rotação em si. No hemisfério sul o sentido se inverte, porque '
        + '\\(\\sen\\lambda\\) troca de sinal.</p>'
        + '<p>Na latitude atual, ' + Math.abs(est.lat) + '°, a taxa é '
        + F.fmt(Math.abs(D.taxa), 2) + ' graus por hora'
        + (D.per === Infinity ? ' e o plano nunca completa uma volta.'
            : ' e uma volta leva ' + F.fmt(D.per, 1) + ' horas.') + '</p>';
      tipografar(corpo);
    }

    var chaveAnt = '';
    function quadro() {
      if (est.rodando) est.t += 0.016 * est.vel;
      desenhar();
      var chave = String(est.lat);
      if (chave !== chaveAnt) { chaveAnt = chave; texto(); }
      requestAnimationFrame(quadro);
    }

    texto();
    requestAnimationFrame(quadro);
    registrarRedesenho(desenhar);
  };


  /* =================================================================
     19. A força de maré
     Esta é a figura que o professor plota em Python nas suas aulas: o
     campo de maré ao redor da Terra, com as duas protuberâncias. O
     ponto que a figura resolve sozinha é por que existem DUAS marés
     por dia e não uma: o campo é quadrupolar, não dipolar, porque é o
     que sobra depois de subtrair a aceleração do centro da Terra.
     ================================================================= */
  REGISTRO.mare = function (raiz) {
    var GN = 6.67430e-11, RT = 6.371e6, MT = 5.972e24, g0 = 9.81;
    var ASTROS = {
      lua: { n: 'Lua', M: 7.342e22, D: 3.844e8 },
      sol: { n: 'Sol', M: 1.989e30, D: 1.496e11 }
    };
    var est = { vista: 'campo', caso: 'lua' };

    var corpo = moldura(raiz, 'A força de maré: por que são duas por dia');

    var c0 = el('div', { class: 'controles' });
    corpo.appendChild(c0);
    opcoes(c0, [
      { rot: 'O campo em volta da Terra', v: 'campo' },
      { rot: 'Radial e tangencial', v: 'comp' }
    ], 0, function (v) { est.vista = v; desenhar(); });

    var c1 = el('div', { class: 'controles' });
    corpo.appendChild(c1);
    c1.appendChild(el('span', { class: 'etiqueta', texto: 'causa' }));
    opcoes(c1, [
      { rot: 'só a Lua', v: 'lua' },
      { rot: 'só o Sol', v: 'sol' },
      { rot: 'sizígia (alinhados)', v: 'siz' },
      { rot: 'quadratura (90°)', v: 'qua' }
    ], 0, function (v) { est.caso = v; desenhar(); });

    var cv = el('canvas');
    corpo.appendChild(cv);

    var mostrar = cartoes(corpo, [
      { rot: 'maré da Lua (m/s²)', k: 'al' },
      { rot: 'maré do Sol (m/s²)', k: 'as' },
      { rot: 'razão Lua / Sol', k: 'raz' },
      { rot: 'fração de g', k: 'fr' },
      { rot: 'altura da maré de equilíbrio', k: 'h' },
      { rot: 'situação', k: 'sit' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    /* amplitude do campo de maré: a = (GM R / D³)(2cosθ, −senθ) */
    function amp(a) { return GN * a.M * RT / Math.pow(a.D, 3); }
    /* altura da maré de equilíbrio, de Δh = (3/2) G M R² / (g D³) */
    function altura(a) {
      return 1.5 * GN * a.M * RT * RT / (g0 * Math.pow(a.D, 3));
    }

    /* o campo total, em unidades da amplitude lunar, no ponto de
       ângulo θ. A Lua fica em 0°; o Sol, no caso de quadratura, em 90° */
    function campo(th) {
      var AL = amp(ASTROS.lua), AS = amp(ASTROS.sol);
      function par(A, off) {
        var t = th - off;
        /* em coordenadas do eixo do astro, e depois de volta */
        var vx = A * 2 * Math.cos(t), vy = -A * Math.sin(t);
        var c = Math.cos(off), s = Math.sin(off);
        return [c * vx - s * vy, s * vx + c * vy];
      }
      if (est.caso === 'lua') return par(AL, 0);
      if (est.caso === 'sol') return par(AS, 0);
      if (est.caso === 'siz') {
        var a1 = par(AL, 0), b1 = par(AS, 0);
        return [a1[0] + b1[0], a1[1] + b1[1]];
      }
      var a2 = par(AL, 0), b2 = par(AS, Math.PI / 2);
      return [a2[0] + b2[0], a2[1] + b2[1]];
    }

    function desenhaCampo() {
      var alt = 330;
      var p = G.preparar(cv, alt), ct = p.ct, Lp = p.L;
      ct.clearRect(0, 0, Lp, alt);

      var R = Math.min((alt - 56) / 2.6, Lp * 0.2);
      var cx = Lp * 0.42, cy = alt / 2 + 6;

      /* a Terra */
      ct.beginPath(); ct.arc(cx, cy, R, 0, 2 * Math.PI);
      ct.fillStyle = 'rgba(23,107,93,.10)'; ct.fill();
      ct.strokeStyle = G.COR.mestra; ct.lineWidth = 2; ct.stroke();

      /* a direção dos astros */
      function astro(off, cor, nome) {
        var dx = Math.cos(off), dy = Math.sin(off);
        ct.beginPath();
        ct.moveTo(cx + dx * R * 1.1, cy - dy * R * 1.1);
        ct.lineTo(cx + dx * (Lp * 0.42), cy - dy * (Lp * 0.42));
        ct.strokeStyle = cor; ct.lineWidth = 1.4;
        ct.setLineDash([6, 4]); ct.stroke(); ct.setLineDash([]);
        var bx = cx + dx * R * 1.95, by = cy - dy * R * 1.95;
        if (bx < Lp - 18 && by > 14) {
          ct.beginPath(); ct.arc(bx, by, 9, 0, 2 * Math.PI);
          ct.fillStyle = cor; ct.fill();
          rotulo(ct, nome, bx, by - 18, cor);
        }
      }
      if (est.caso !== 'sol') astro(0, G.COR.suave, 'Lua');
      if (est.caso === 'sol') astro(0, G.COR.ambar, 'Sol');
      if (est.caso === 'siz') astro(0, G.COR.ambar, '');
      if (est.caso === 'qua') astro(Math.PI / 2, G.COR.ambar, 'Sol');

      /* o campo de maré na superfície */
      var AL = amp(ASTROS.lua);
      /* a maior seta ocupa 0,42 raio: mais que isso e o campo engole a
         Terra e sai do quadro */
      var esc = R * 0.21 / (est.caso === 'siz' ? 1.5 : 1) / AL;
      for (var k = 0; k < 36; k++) {
        var th = k * Math.PI / 18;
        var px = cx + R * Math.cos(th), py = cy - R * Math.sin(th);
        var v = campo(th);
        seta(ct, px, py, px + v[0] * esc, py - v[1] * esc, G.COR.vinho, 1.8);
      }

      /* o contorno deformado, bem exagerado */
      ct.beginPath();
      for (var j = 0; j <= 180; j++) {
        var t2 = j * Math.PI / 90, w = campo(t2);
        var ar = w[0] * Math.cos(t2) + w[1] * Math.sin(t2);
        var rr = R * (1 + 0.16 * ar / AL / 2);
        var qx = cx + rr * Math.cos(t2), qy = cy - rr * Math.sin(t2);
        (j ? ct.lineTo : ct.moveTo).call(ct, qx, qy);
      }
      ct.closePath();
      ct.strokeStyle = G.COR.azul; ct.lineWidth = 2;
      ct.setLineDash([4, 3]); ct.stroke(); ct.setLineDash([]);

      rotulo(ct, 'a água (deformação muito exagerada)', 10, 16, G.COR.azul, 'left');
      rotulo(ct, 'força de maré', 10, 32, G.COR.vinho, 'left');
    }

    function desenhaComp() {
      var AL = amp(ASTROS.lua);
      var gr = G.eixos(cv, {
        altura: 320, xmin: 0, xmax: 360,
        ymin: -2.2 * AL * 1e6, ymax: 2.6 * AL * 1e6,
        rotX: 'ângulo a partir da direção do astro (graus)',
        rotY: 'aceleração de maré (μm/s²)',
        marcasX: G.marcasLineares(0, 360, 6, 0),
        formataY: function (v) { return F.fmt(v, 1); }
      });
      var rad = function (d) {
        var t = d * Math.PI / 180, v = campo(t);
        return (v[0] * Math.cos(t) + v[1] * Math.sin(t)) * 1e6;
      };
      var tan = function (d) {
        var t = d * Math.PI / 180, v = campo(t);
        return (-v[0] * Math.sin(t) + v[1] * Math.cos(t)) * 1e6;
      };
      var ct = gr.ct;
      ct.strokeStyle = G.COR.grade; ct.lineWidth = 1.4;
      ct.beginPath(); ct.moveTo(gr.x0, gr.Y(0)); ct.lineTo(gr.x1, gr.Y(0)); ct.stroke();
      G.curva(gr, tan, G.COR.bronze, 2.4);
      G.curva(gr, rad, G.COR.vinho, 2.6);
      rotulo(ct, 'radial: puxa para fora em 0° e em 180°', gr.X(180),
        gr.Y(rad(180)) - 16, G.COR.vinho);
      rotulo(ct, 'tangencial: máxima em 45°, e é ela que move a água',
        gr.X(120), gr.Y(tan(120)) + 16, G.COR.bronze);
    }

    function desenhar() {
      if (est.vista === 'campo') desenhaCampo();
      else desenhaComp();

      var AL = amp(ASTROS.lua), AS = amp(ASTROS.sol);
      var hL = altura(ASTROS.lua), hS = altura(ASTROS.sol);
      var h = est.caso === 'lua' ? hL : est.caso === 'sol' ? hS
        : est.caso === 'siz' ? hL + hS : hL - hS;
      mostrar({
        al: F.fmt(AL * 2e6, 3) + ' μm/s²',
        as: F.fmt(AS * 2e6, 3) + ' μm/s²',
        raz: F.fmt(AL / AS, 2),
        fr: F.pct(2 * AL / g0, 6),
        h: F.fmt(h * 100, 1) + ' cm',
        sit: est.caso === 'siz' ? 'maré de sizígia: a maior'
          : est.caso === 'qua' ? 'maré de quadratura: a menor'
          : est.caso === 'lua' ? 'só a Lua' : 'só o Sol'
      });

      nota.innerHTML =
        '<p>A maré não é a atração da Lua: é o que <strong>sobra</strong> dessa atração '
        + 'depois de descontar a aceleração do centro da Terra, que também está caindo em '
        + 'direção à Lua. Esse desconto é precisamente a força de inércia de translação da '
        + 'seção 1, e é por isso que marés são assunto de referencial não inercial.</p>'
        + '\\[\\vet{F}_{\\rm maré}=-\\frac{GM_Lm}{d^2}\\vers{d}'
        + '+\\frac{GM_Lm}{D^2}\\vers{D}.\\]'
        + '<p>Expandindo em potências de \\(R/D\\), que vale 0,0166 para a Lua, os '
        + 'coeficientes que aparecem são os polinômios de Legendre, e o primeiro termo que '
        + 'sobrevive é o de \\(P_2\\). Em componentes, com \\(\\theta\\) medido a partir da '
        + 'direção do astro,</p>'
        + '\\[a_r=\\frac{GM_LR}{D^3}\\left(3\\cos^2\\theta-1\\right),\\qquad '
        + 'a_\\theta=-\\frac{3}{2}\\frac{GM_LR}{D^3}\\sen2\\theta.\\]'
        + '<p>A figura mostra o resultado, e ele explica de uma vez o fato que mais intriga '
        + 'quem estuda marés: <strong>há duas marés altas por dia, não uma</strong>. O campo '
        + 'é quadrupolar, com protuberâncias dos <em>dois</em> lados, porque a água do lado '
        + 'próximo é puxada mais que o centro e a do lado distante é puxada menos. Em ambos '
        + 'os casos ela se afasta do centro.</p>'
        + '<p>Repare também em qual componente faz o trabalho. A radial, de '
        + F.fmt(2 * AL * 1e6, 2) + ' μm/s², é ' + F.pct(2 * AL / g0, 6) + ' de \\(g\\): '
        + 'levantar o oceano contra a gravidade com isso seria impossível. Quem move a água é '
        + 'a componente <strong>tangencial</strong>, que não tem nada contra o que lutar e '
        + 'empurra a água horizontalmente rumo aos dois pontos de maré alta, ao longo de '
        + 'milhares de quilômetros.</p>'
        + '<p>A maré do Sol existe e não é desprezível. Como a amplitude vai com '
        + '\\(M/D^3\\), e não com \\(M/D^2\\), o Sol perde apesar de ter 27 milhões de vezes '
        + 'a massa da Lua: a razão é \\(\\left(M_L/M_S\\right)\\left(D_S/D_L\\right)^3='
        + F.fmt(AL / AS, 2) + '\\). Alinhados, os dois se somam e dão a maré de '
        + '<strong>sizígia</strong>; a 90°, se subtraem e dão a de '
        + '<strong>quadratura</strong>. Compare as duas nos botões.</p>'
        + '<p>A altura prevista aqui, de algumas dezenas de centímetros, é a da '
        + '<em>maré de equilíbrio</em>, que supõe um oceano global sem continentes. Marés '
        + 'reais de vários metros, como as da baía de Fundy, vêm de ressonância das bacias '
        + 'oceânicas e de estrangulamento em estreitos, efeitos de hidrodinâmica que esta '
        + 'conta não captura.</p>';
      tipografar(corpo);
    }

    registrarRedesenho(desenhar);
  };


  /* =================================================================
     23. Os dois tubos: a altura da maré por equilíbrio
     Redesenhado sobre a figura do autor (deck de Referenciais
     Não-Inerciais, slides 34 a 36): um tubo radial de altura h e um
     tubo tangencial de comprimento L, encaixados em L no mesmo ponto
     da superfície, com f_r e f_theta no vértice. À esquerda o globo
     com a protuberância; à direita o detalhe ampliado.
     ================================================================= */
  REGISTRO.tubos = function (raiz) {
    var GN = 6.67430e-11, RT = 6.371e6, g0 = 9.81, RHO = 1025;
    var LUA = { M: 7.342e22, D: 3.844e8 };
    var est = { th: 45 };

    var corpo = moldura(raiz, 'Os dois tubos: de onde sai a altura da maré');

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'posição do par de tubos', 2, 88, 1, 45,
      function (v) { est.th = v; desenhar(); }, function (v) { return v + '°'; });

    var mostrar = cartoes(corpo, [
      { rot: 'f_r aqui (radial)', k: 'fr' },
      { rot: 'f_θ aqui (tangencial)', k: 'ft' },
      { rot: 'f_r / g', k: 'raz' },
      { rot: 'h para L = 1000 km', k: 'hl' },
      { rot: 'desnível total h_dif', k: 'h' },
      { rot: 'pressão na base ρ g h', k: 'pr' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    var A0 = GN * LUA.M * RT / Math.pow(LUA.D, 3);   /* GM R / D³ */
    function fr(g) { return A0 * (3 * Math.pow(Math.cos(g * Math.PI / 180), 2) - 1); }
    function ft(g) { return 1.5 * A0 * Math.sin(2 * g * Math.PI / 180); }
    var HDIF = 1.5 * GN * LUA.M * RT * RT / (g0 * Math.pow(LUA.D, 3));

    /* um tubo é desenhado como duas paredes paralelas, à maneira da
       figura do deck: a lista pt dá a linha média, e lar a largura */
    function tubo(ct, pts, lar, cor) {
      /* um tubo é apenas um par de paredes paralelas, sem preenchimento:
         o que estiver atrás aparece por dentro dele, de modo que o trecho
         mergulhado no oceano fica cheio e o resto fica vazio */
      var i, lados = [[], []];
      for (i = 0; i < pts.length; i++) {
        var a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        var dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1;
        var nx = -dy / n * lar / 2, ny = dx / n * lar / 2;
        lados[0].push([pts[i][0] + nx, pts[i][1] + ny]);
        lados[1].push([pts[i][0] - nx, pts[i][1] - ny]);
      }
      ct.strokeStyle = cor; ct.lineWidth = 2.2; ct.lineCap = 'round';
      lados.forEach(function (lado) {
        ct.beginPath();
        lado.forEach(function (q, k) { (k ? ct.lineTo : ct.moveTo).call(ct, q[0], q[1]); });
        ct.stroke();
      });
    }

    /* cota de duas pontas, à maneira das figuras do deck */
    function cota(ct, a, b, desl, texto, cor) {
      var dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1;
      var px = -dy / n * desl, py = dx / n * desl;
      var A = [a[0] + px, a[1] + py], B = [b[0] + px, b[1] + py];
      seta(ct, A[0], A[1], B[0], B[1], cor, 1.6);
      seta(ct, B[0], B[1], A[0], A[1], cor, 1.6);
      rotulo(ct, texto, (A[0] + B[0]) / 2 + px * 0.55, (A[1] + B[1]) / 2 + py * 0.55, cor);
    }

    function desenhar() {
      var alt = 380;
      var p = G.preparar(cv, alt), ct = p.ct, Lp = p.L;
      ct.clearRect(0, 0, Lp, alt);

      var th = est.th * Math.PI / 180;

      /* ---------- painel da esquerda: o globo ---------- */
      var cx = Lp * 0.24, cy = alt * 0.47;
      var Re = Math.min(alt * 0.30, Lp * 0.17);
      var amp = Re * 0.22;
      function raio(g) { return Re + amp * (3 * Math.pow(Math.cos(g), 2) - 1) / 2; }
      function sup(g) { return [cx + raio(g) * Math.cos(g), cy - raio(g) * Math.sin(g)]; }

      /* a protuberância, preenchida, e a superfície deformada em tracejado */
      ct.beginPath();
      for (var i = 0; i <= 240; i++) {
        var g = i / 240 * 2 * Math.PI, q = sup(g);
        (i ? ct.lineTo : ct.moveTo).call(ct, q[0], q[1]);
      }
      ct.closePath();
      ct.fillStyle = 'rgba(123,184,171,.38)'; ct.fill();
      ct.strokeStyle = G.COR.clara; ct.lineWidth = 1.6;
      ct.setLineDash([6, 4]); ct.stroke(); ct.setLineDash([]);

      /* a Terra sem maré */
      ct.beginPath(); ct.arc(cx, cy, Re, 0, 2 * Math.PI);
      ct.fillStyle = '#fff'; ct.fill();
      ct.strokeStyle = G.COR.tinta; ct.lineWidth = 2.2; ct.stroke();

      function desenhaPar(ct2, ox, oy, RR, g, hpx, arco, lar, cor) {
        var nx = Math.cos(g), ny = -Math.sin(g);
        var base = [ox + RR * nx, oy + RR * ny];
        function radial(f) { return [base[0] + nx * hpx * f, base[1] + ny * hpx * f]; }
        function arcoPts(de, ate) {
          var pts = [];
          for (var k = 0; k <= 24; k++) {
            var gg = g - (de + (ate - de) * k / 24);
            pts.push([ox + RR * Math.cos(gg), oy - RR * Math.sin(gg)]);
          }
          return pts;
        }
        tubo(ct2, [radial(-0.15), radial(1.8)], lar, cor);
        tubo(ct2, arcoPts(-0.04 * arco, arco * 1.5), lar, cor);
      }

      /* o ângulo θ, medido a partir da direção da Lua */
      ct.strokeStyle = G.COR.suave; ct.lineWidth = 1.2;
      ct.setLineDash([4, 4]);
      ct.beginPath(); ct.moveTo(cx, cy); ct.lineTo(cx + Re + amp + 6, cy); ct.stroke();
      ct.beginPath();
      ct.moveTo(cx, cy);
      ct.lineTo(cx + (Re + 26) * Math.cos(th), cy - (Re + 26) * Math.sin(th));
      ct.stroke();
      ct.setLineDash([]);
      ct.beginPath(); ct.arc(cx, cy, Re * 0.42, -th, 0); ct.stroke();
      rotulo(ct, 'θ = ' + est.th + '°',
        cx + Re * 0.56 * Math.cos(th / 2), cy - Re * 0.56 * Math.sin(th / 2),
        G.COR.suave);

      desenhaPar(ct, cx, cy, Re, th, 26, 0.36, 7, G.COR.tinta);

      seta(ct, cx + Re + amp + 14, cy, Lp * 0.455, cy, G.COR.bronze, 2);
      rotulo(ct, 'para a Lua', Lp * 0.455, cy - 15, G.COR.bronze, 'right');
      rotulo(ct, 'maré alta', cx + Re + amp - 6, cy + 34, G.COR.mestra, 'right',
        'middle', '600 11px system-ui, sans-serif');
      rotulo(ct, 'Terra sem maré · superfície deformada em tracejado',
        cx, cy + Re + amp + 24, G.COR.suave);

      /* ---------- painel da direita: o detalhe ampliado ---------- */
      var dxc = Lp * 0.71, Rd = Lp * 0.40, dyc = alt * 0.80 + Rd;
      function pSup(a, dr) {
        return [dxc + (Rd + dr) * Math.sin(a), dyc - (Rd + dr) * Math.cos(a)];
      }
      /* o oceano é uma faixa de espessura variável, mais grossa do lado da
         maré alta, e a sua borda externa é a superfície deformada */
      var fx = 0.30;
      /* a faixa engrossa no sentido para onde f_θ empurra a água, isto é
         em direção ao ponto de maré alta */
      function espes(a) { return 18 + 22 * (a + fx) / (2 * fx); }
      var dentro = [], forav = [];
      for (var k2 = 0; k2 <= 60; k2++) {
        var a2 = -fx + 2 * fx * k2 / 60;
        dentro.push(pSup(a2, 0)); forav.push(pSup(a2, espes(a2)));
      }
      ct.beginPath();
      dentro.forEach(function (q, k) { (k ? ct.lineTo : ct.moveTo).call(ct, q[0], q[1]); });
      for (var k3 = forav.length - 1; k3 >= 0; k3--) ct.lineTo(forav[k3][0], forav[k3][1]);
      ct.closePath(); ct.fillStyle = 'rgba(123,184,171,.55)'; ct.fill();

      ct.beginPath();
      dentro.forEach(function (q, k) { (k ? ct.lineTo : ct.moveTo).call(ct, q[0], q[1]); });
      ct.strokeStyle = G.COR.tinta; ct.lineWidth = 2.6; ct.stroke();
      ct.beginPath();
      forav.forEach(function (q, k) { (k ? ct.lineTo : ct.moveTo).call(ct, q[0], q[1]); });
      ct.strokeStyle = G.COR.mestra; ct.lineWidth = 2;
      ct.setLineDash([9, 6]); ct.stroke(); ct.setLineDash([]);

      /* o vértice dos dois tubos, pousado no fundo */
      var aV = -0.055;
      var V = pSup(aV, 5);
      var r1 = pSup(aV, 105), nrm = [(r1[0] - V[0]) / 100, (r1[1] - V[1]) / 100];
      var tgt = [-nrm[1], nrm[0]];
      function gira(v, gr) {
        var c = Math.cos(gr), s = Math.sin(gr);
        return [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
      }
      /* um tubo quase radial, curto, e outro quase tangencial, longo */
      var dirH = gira(nrm, -0.30), dirL = gira(tgt, -0.26);
      var hv = 58, lL = 150;
      function ao(d, v) { return [V[0] + v[0] * d, V[1] + v[1] * d]; }

      tubo(ct, [V, ao(hv * 1.95, dirH)], 15, G.COR.tinta);
      tubo(ct, [V, ao(lL * 1.34, dirL)], 15, G.COR.tinta);
      ct.beginPath(); ct.arc(V[0], V[1], 4, 0, 2 * Math.PI);
      ct.fillStyle = G.COR.tinta; ct.fill();

      cota(ct, V, ao(hv, dirH), -26, 'h', G.COR.azul);
      cota(ct, V, ao(lL, dirL), -34, 'L', G.COR.azul);
      rotulo(ct, 'a água é empurrada para a maré alta →', Lp - 12, alt - 14,
        G.COR.mestra, 'right');

      /* as duas componentes da maré, em V, paralelas aos respectivos tubos */
      var O = ao(132, gira(nrm, -0.16)), Lf = 62;
      seta(ct, O[0], O[1], O[0] + dirH[0] * Lf, O[1] + dirH[1] * Lf, G.COR.vinho, 2.4);
      rotulo(ct, 'f_r', O[0] + dirH[0] * Lf * 0.6 - 16,
        O[1] + dirH[1] * Lf * 0.6 + 10, G.COR.vinho, 'right');
      seta(ct, O[0], O[1], O[0] + dirL[0] * Lf, O[1] + dirL[1] * Lf, G.COR.vinho, 2.4);
      rotulo(ct, 'f_θ', O[0] + dirL[0] * Lf * 0.6 + 12,
        O[1] + dirL[1] * Lf * 0.6 + 16, G.COR.vinho, 'left');

      rotulo(ct, 'detalhe: tubo radial de altura h e tubo tangencial de comprimento L',
        Lp * 0.71, 18, G.COR.suave);

      var f1 = fr(est.th), f2 = ft(est.th), hL = 1e6 * f2 / g0;
      mostrar({
        fr: F.fmt(f1 * 1e6, 3) + ' μm/s²',
        ft: F.fmt(f2 * 1e6, 3) + ' μm/s²',
        raz: '1 para ' + F.fmt(g0 / Math.abs(f1 || 1e-30) / 1e6, 2) + ' milhões',
        hl: F.fmt(hL * 100, 2) + ' cm',
        h: F.fmt(HDIF * 100, 1) + ' cm',
        pr: F.fmt(RHO * g0 * HDIF, 0) + ' Pa'
      });

      nota.innerHTML =
        '<p>Dois tubos imaginários, sem paredes e de seção \\(S\\): um <strong>radial</strong>, '
        + 'de altura \\(h\\), e um <strong>ao longo da superfície</strong>, de comprimento '
        + '\\(L\\), encaixados em L no mesmo ponto. As massas de água que eles contêm são '
        + '\\(m=\\varrho Sh\\) e \\(m\'=\\varrho SL\\).</p>'
        + '<p>A água do tubo radial sofre o próprio peso \\(mg\\) e a componente normal da '
        + 'maré, \\(F_r=mf_r\\). O balanço na base é</p>'
        + '\\[mg-F_r=\\varrho Sh\\left(g-\\frac{F_r}{m}\\right)=\\varrho Sh\\left(g-f_r\\right),\\]'
        + '<p>e essa diferença estabelece ali uma pressão excedente que empurra a água para '
        + 'dentro do tubo horizontal. Para que o tubo horizontal também fique estático, alguém '
        + 'tem de empurrar no sentido contrário, e esse alguém é a componente '
        + '<strong>tangencial</strong> \\(f_\\theta\\), desenhada em vinho. A condição de '
        + 'equilíbrio geral é</p>'
        + '\\[\\varrho h\\left(g-f_r\\right)=\\varrho L f_\\theta'
        + '\\qquad\\Longrightarrow\\qquad h=L\\,\\frac{f_\\theta}{g-f_r}.\\]'
        + '<p>Na Terra \\(f_r\\) é irrisória diante de \\(g\\): no ponto escolhido a razão é de '
        + 'uma parte em ' + F.fmt(g0 / Math.max(Math.abs(f1), 1e-30) / 1e6, 2) + ' milhões. '
        + 'Vale portanto \\(h\\simeq Lf_\\theta/g\\). Tomando o tubo horizontal como um arco '
        + 'infinitesimal, \\(L=R\\,d\\theta\\), o desnível acumulado ao longo da superfície é</p>'
        + '\\[dh\\simeq\\frac{Rf_\\theta}{g}\\,d\\theta'
        + '\\qquad\\Longrightarrow\\qquad '
        + 'h_{\\rm dif}=\\frac{R}{g}\\int_0^{\\pi/2}f_\\theta\\,d\\theta'
        + '=\\frac{3}{2}\\,\\frac{GM_LR^2}{g\\,D^3}=' + F.fmt(HDIF * 100, 1) + '\\ \\text{cm}.\\]'
        + '<p>Repare no que o argumento dispensa. Não houve dinâmica, nem equação de onda, nem '
        + 'atrito: só a exigência de que, no estado final, a água não tenha para onde '
        + 'escorrer. É um argumento de <strong>equilíbrio</strong>, e por isso o resultado se '
        + 'chama maré de equilíbrio. Os ' + F.fmt(RHO * g0 * HDIF, 0) + ' Pa de excesso na base '
        + 'correspondem a meio metro de coluna d\'água espalhado sobre '
        + F.fmt(Math.PI * RT / 2 / 1e3, 0) + ' km de arco: uma rampa de uma parte em vinte '
        + 'milhões, que é o quanto a maré realmente inclina o oceano.</p>';
      tipografar(corpo);
    }

    registrarRedesenho(desenhar);
  };

  /* =================================================================
     20. O que é um funcional
     A definição ("uma regra que associa um número a uma função
     inteira") é abstrata até se ver o número mudar enquanto a curva é
     deformada. A segunda vista é o ponto alto: J contra o parâmetro
     de deformação é uma curva comum, com mínimo comum, e δJ = 0 é
     apenas o fundo dela. Trocando o funcional sem trocar os extremos,
     o mínimo muda de lugar: a reta ganha em comprimento e em energia,
     e perde em tempo de descida.
     ================================================================= */
  REGISTRO.funcional = function (raiz) {
    var G0 = 9.80665;
    var FUNS = {
      comp: {
        n: 'comprimento', sim: 'L[y]', uni: 'm',
        f: function (y, yl) { return Math.sqrt(1 + yl * yl); },
        tex: '\\displaystyle L[y]=\\int_0^1\\sqrt{1+y\\,\'^2}\\,dx'
      },
      tempo: {
        n: 'tempo de descida', sim: 'T[y]', uni: 's',
        f: function (y, yl) {
          return Math.sqrt((1 + yl * yl) / (2 * G0 * Math.max(y, 1e-12)));
        },
        tex: '\\displaystyle T[y]=\\int_0^1\\frac{\\sqrt{1+y\\,\'^2}}'
           + '{\\sqrt{2gy}}\\,dx'
      },
      energia: {
        n: 'energia da corda', sim: 'U[y]', uni: 'J',
        f: function (y, yl) { return yl * yl; },
        tex: '\\displaystyle U[y]=\\int_0^1\\left(y\\,\'\\right)^2dx'
      }
    };
    var est = { vista: 'curva', fn: 'comp', a: 0.25 };

    var corpo = moldura(raiz, 'Um funcional é uma máquina: entra uma curva, sai um número');

    var c0 = el('div', { class: 'controles' });
    corpo.appendChild(c0);
    opcoes(c0, [
      { rot: 'A curva e o número', v: 'curva' },
      { rot: 'J contra a deformação', v: 'perfil' }
    ], 0, function (v) { est.vista = v; desenhar(); });

    var c1 = el('div', { class: 'controles' });
    corpo.appendChild(c1);
    c1.appendChild(el('span', { class: 'etiqueta', texto: 'funcional' }));
    opcoes(c1, Object.keys(FUNS).map(function (k) {
      return { rot: FUNS[k].n, v: k };
    }), 0, function (v) { est.fn = v; desenhar(); });

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'deformação a da curva', -0.35, 0.7, 0.01, 0.25,
      function (v) { est.a = v; desenhar(); }, function (v) { return F.fmt(v, 2); });

    var mostrar = cartoes(corpo, [
      { rot: 'funcional', k: 'qual' },
      { rot: 'valor para esta curva', k: 'val' },
      { rot: 'valor para a reta (a = 0)', k: 'reta' },
      { rot: 'diferença', k: 'dif' },
      { rot: 'a que minimiza', k: 'amin' },
      { rot: 'qual curva vence', k: 'quem' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    /* y medido para baixo, de (0,0) a (1,1); a deformação é um seno
       que se anula nas duas pontas, como manda a definição de variação */
    function curva(a) {
      return function (x) { return x + a * Math.sin(Math.PI * x); };
    }
    function derivada(a) {
      return function (x) { return 1 + a * Math.PI * Math.cos(Math.PI * x); };
    }
    /* a substituição x = u² remove a singularidade 1/√y na partida */
    function valor(k, a) {
      var y = curva(a), yl = derivada(a), f = FUNS[k].f, s = 0, N = 400;
      for (var i = 0; i < N; i++) {
        var u = (i + 0.5) / N, x = u * u;
        s += f(y(x), yl(x)) * 2 * u;
      }
      return s / N;
    }
    function minimiza(k) {
      /* o passo é contado por índice, e não acumulado, porque somar 0,005
         setenta vezes não devolve zero exatamente e o cartão acabaria
         exibindo o mínimo da reta como 2,7e-16 */
      var melhor = -0.35, vm = Infinity;
      for (var i = 0; i <= 210; i++) {
        var a = -0.35 + i * 0.005;
        var v = valor(k, a);
        if (v < vm) { vm = v; melhor = a; }
      }
      /* arredonda ao passo da varredura: sem isso o mínimo da reta sai como
         5,6e-17 em vez de zero */
      return Math.round(melhor * 1000) / 1000;
    }

    function desenhaCurva() {
      var alt = 310;
      var p = G.preparar(cv, alt), ct = p.ct, Lp = p.L;
      ct.clearRect(0, 0, Lp, alt);

      var esc = Math.min((alt - 70) / 1.4, (Lp - 120) / 1.3);
      var x0 = (Lp - esc) / 2, y0 = 34;
      var X = function (u) { return x0 + u * esc; };
      var Y = function (u) { return y0 + u * esc; };

      ct.strokeStyle = G.COR.grade; ct.lineWidth = 1;
      for (var g = 0; g <= 4; g++) {
        ct.beginPath(); ct.moveTo(X(g / 4), Y(0)); ct.lineTo(X(g / 4), Y(1.08)); ct.stroke();
        ct.beginPath(); ct.moveTo(X(-0.04), Y(g / 4)); ct.lineTo(X(1.04), Y(g / 4)); ct.stroke();
      }

      /* a reta, para comparar */
      ct.beginPath(); ct.moveTo(X(0), Y(0)); ct.lineTo(X(1), Y(1));
      ct.strokeStyle = G.COR.grade; ct.lineWidth = 2; ct.stroke();

      /* a curva de prova */
      var y = curva(est.a);
      ct.beginPath();
      for (var j = 0; j <= 120; j++) {
        var x = j / 120;
        (j ? ct.lineTo : ct.moveTo).call(ct, X(x), Y(y(x)));
      }
      ct.strokeStyle = G.COR.mestra; ct.lineWidth = 2.8; ct.stroke();

      /* a curva ótima deste funcional, tracejada */
      var am = minimiza(est.fn), yo = curva(am);
      ct.beginPath();
      for (var j2 = 0; j2 <= 120; j2++) {
        var x2 = j2 / 120;
        (j2 ? ct.lineTo : ct.moveTo).call(ct, X(x2), Y(yo(x2)));
      }
      ct.strokeStyle = G.COR.bronze; ct.lineWidth = 2;
      ct.setLineDash([6, 4]); ct.stroke(); ct.setLineDash([]);

      [[0, 0], [1, 1]].forEach(function (q) {
        ct.beginPath(); ct.arc(X(q[0]), Y(q[1]), 5, 0, 2 * Math.PI);
        ct.fillStyle = G.COR.tinta; ct.fill();
      });
      rotulo(ct, 'A', X(0) - 14, Y(0), G.COR.tinta);
      rotulo(ct, 'B', X(1) + 14, Y(1), G.COR.tinta);
      rotulo(ct, 'curva de prova', 10, 16, G.COR.mestra, 'left');
      rotulo(ct, 'a que minimiza este funcional', 10, 32, G.COR.bronze, 'left');
      rotulo(ct, 'y cresce para baixo', Lp - 10, alt - 12, G.COR.suave, 'right');
    }

    function desenhaPerfil() {
      var k = est.fn, am = minimiza(k);
      var v0 = valor(k, -0.35), v1 = valor(k, 0.7), vm = valor(k, am);
      var vmax = Math.max(v0, v1);
      var folga = (vmax - vm) * 0.18 + 1e-6;
      var gr = G.eixos(cv, {
        altura: 310, xmin: -0.35, xmax: 0.7,
        ymin: vm - folga, ymax: vmax + folga,
        rotX: 'deformação a', rotY: FUNS[k].sim + '  (' + FUNS[k].uni + ')',
        marcasX: G.marcasLineares(-0.35, 0.7, 7, 2),
        formataY: function (v) { return F.fmt(v, 3); }
      });
      G.curva(gr, function (a) { return valor(k, a); }, G.COR.mestra, 2.6);
      G.vertical(gr, est.a, G.COR.suave, '', true);
      var ct = gr.ct;
      ct.beginPath(); ct.arc(gr.X(am), gr.Y(vm), 5.5, 0, 2 * Math.PI);
      ct.fillStyle = G.COR.bronze; ct.fill();
      rotulo(ct, 'mínimo em a = ' + am.toFixed(2).replace('.', ',').replace('-0,00', '0,00'),
        gr.X(am), gr.Y(vm) - 16, G.COR.bronze);
      ct.beginPath(); ct.arc(gr.X(est.a), gr.Y(valor(k, est.a)), 5, 0, 2 * Math.PI);
      ct.fillStyle = G.COR.roxo; ct.fill();
      rotulo(ct, 'no fundo da curva, δJ = 0', gr.x1 - 8, gr.y0 + 14, G.COR.suave, 'right');
    }

    function desenhar() {
      var k = est.fn, F0 = FUNS[k];
      if (est.vista === 'curva') desenhaCurva();
      else desenhaPerfil();
      var v = valor(k, est.a), vr = valor(k, 0), am = minimiza(k);
      mostrar({
        qual: F0.n,
        val: F.fmt(v, 4) + ' ' + F0.uni,
        reta: F.fmt(vr, 4) + ' ' + F0.uni,
        dif: (v > vr ? '+' : '') + F.fmt(v - vr, 4),
        amin: F.fmt(am, 2),
        quem: Math.abs(am) < 0.01 ? 'a reta' : 'uma curva que afunda'
      });

      nota.innerHTML =
        '<p>Um <strong>funcional</strong> é uma regra que associa um número real a uma '
        + '<em>função inteira</em>, e não ao valor dela num ponto. Escreve-se '
        + '\\(J[y]\\), com colchetes, justamente para lembrar que a entrada é a curva toda. '
        + 'Aqui a entrada é uma curva de prova ligando os dois pontos fixos A e B, e o '
        + 'deslizante a deforma sem mexer nas pontas:</p>'
        + '\\[y(x)=x+a\\,\\sen\\pi x.\\]'
        + '<p>Escolhido o funcional, cada valor de \\(a\\) devolve um número. O atual é '
        + '<strong>' + F.fmt(v, 4) + ' ' + F0.uni + '</strong>, contra ' + F.fmt(vr, 4)
        + ' da reta.</p>'
        + '\\[' + F0.tex + '\\]'
        + '<p>A segunda vista desenha esse número contra \\(a\\), e aí o cálculo variacional '
        + 'perde o mistério: é uma curva comum, com um mínimo comum, e a condição '
        + '\\(\\delta J=0\\) é apenas a exigência de estar no fundo dela. A diferença para o '
        + 'cálculo de sempre é que o espaço de busca não tem uma dimensão, e sim infinitas, '
        + 'porque a curva pode ser deformada de infinitas maneiras. Esta família de um '
        + 'parâmetro é uma fatia desse espaço.</p>'
        + (Math.abs(am) < 0.01
          ? '<p>Para o ' + F0.n + ', o mínimo está em \\(a=0\\): <strong>a reta '
            + 'vence</strong>. Era de esperar no comprimento, e é o mesmo resultado na '
            + 'energia de uma corda esticada, cujo funcional também só penaliza '
            + 'inclinação.</p>'
          : '<p>Para o ' + F0.n + ', o mínimo <strong>não</strong> está na reta: ele cai em '
            + '\\(a=' + F.fmt(am, 2) + '\\), numa curva que afunda primeiro para ganhar '
            + 'velocidade e só depois se endireita. Os extremos são exatamente os mesmos de '
            + 'antes; o que mudou foi a pergunta. Essa é a braquistócrona de Johann '
            + 'Bernoulli, e a solução exata, uma ciclóide, sai no próximo módulo.</p>')
        + '<p>Troque entre os três funcionais com os mesmos dois pontos e repare que o '
        + 'vencedor muda. Não existe "a melhor curva": existe a melhor curva <em>para um '
        + 'funcional</em>.</p>';
      tipografar(corpo);
    }

    registrarRedesenho(desenhar);
  };

  /* =================================================================
     21. A corrida da braquistócrona
     O enunciado é de 1696 e continua contraintuitivo: a reta é o
     caminho mais curto e não é o mais rápido. Soltar as três contas ao
     mesmo tempo resolve a discussão em três segundos, e o fato de a
     ciclóide ainda ganhar do arco de círculo (que foi a resposta
     errada de Galileu) é o detalhe que mostra que não basta afundar.
     ================================================================= */
  REGISTRO.braquistocrona = function (raiz) {
    var G0 = 9.80665;
    var est = { xb: 1.4, t: 0, rodando: true };

    var corpo = moldura(raiz, 'A braquistócrona: o caminho mais curto não é o mais rápido');

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'afastamento horizontal de B', 0.4, 3, 0.05, 1.4,
      function (v) { est.xb = v; est.t = 0; },
      function (v) { return F.fmt(v, 2) + ' m'; });
    var bt = el('button', { type: 'button', texto: 'soltar de novo' });
    bt.addEventListener('click', function () { est.t = 0; est.rodando = true; });
    ctr.appendChild(bt);

    var mostrar = cartoes(corpo, [
      { rot: 'tempo pela reta', k: 'tr' },
      { rot: 'tempo pelo arco de círculo', k: 'tc' },
      { rot: 'tempo pela ciclóide', k: 'tq' },
      { rot: 'ganho da ciclóide sobre a reta', k: 'gan' },
      { rot: 'comprimento da reta', k: 'lr' },
      { rot: 'comprimento da ciclóide', k: 'lq' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    var YB = 1;                       // B está sempre 1 m abaixo de A

    /* resolve (1 − cos θ)/(θ − sen θ) = yB/xB para o parâmetro final */
    function thetaFinal() {
      var alvo = YB / est.xb, lo = 1e-4, hi = 2 * Math.PI - 1e-4;
      for (var i = 0; i < 70; i++) {
        var m = (lo + hi) / 2;
        var v = (1 - Math.cos(m)) / (m - Math.sin(m));
        if (v > alvo) lo = m; else hi = m;
      }
      return (lo + hi) / 2;
    }

    /* o arco de círculo de Galileu: circunferência por A e B com
       tangente vertical em A, parametrizada pelo ângulo central.
       Centro em (c, 0), sobre a horizontal que passa por A, de modo que o
       raio em A é horizontal e a tangente é vertical. Impor que B pertença
       à circunferência dá (xB − c)² + yB² = c², isto é c = (xB² + yB²)/2xB. */
    function arco() {
      var c = (est.xb * est.xb + YB * YB) / (2 * est.xb);
      var fiB = Math.atan2(YB, c - est.xb);
      return { r: c, fiB: fiB,
        pt: function (u) {
          var fi = fiB * u;
          return [c * (1 - Math.cos(fi)), c * Math.sin(fi)];
        } };
    }

    /* tabela tempo → posição ao longo de um caminho, por quadratura
       de dt = ds/√(2gy) com o ponto médio, que evita a singularidade */
    function tabela(pt) {
      var N = 4000, tt = [0], acc = 0, ant = pt(0);
      for (var i = 1; i <= N; i++) {
        var u = i / N, q = pt(u);
        var dx = q[0] - ant[0], dy = q[1] - ant[1];
        var ds = Math.sqrt(dx * dx + dy * dy);
        var ym = (q[1] + ant[1]) / 2;
        acc += ds / Math.sqrt(2 * G0 * Math.max(ym, 1e-9));
        tt.push(acc);
        ant = q;
      }
      return tt;
    }
    function posicao(pt, tt, t) {
      var N = tt.length - 1;
      if (t >= tt[N]) return pt(1);
      var lo = 0, hi = N;
      while (hi - lo > 1) {
        var m = (lo + hi) >> 1;
        if (tt[m] <= t) lo = m; else hi = m;
      }
      var f = (t - tt[lo]) / Math.max(1e-12, tt[hi] - tt[lo]);
      return pt((lo + f) / N);
    }
    function comprimento(pt) {
      var s = 0, ant = pt(0);
      for (var i = 1; i <= 400; i++) {
        var q = pt(i / 400);
        s += Math.hypot(q[0] - ant[0], q[1] - ant[1]);
        ant = q;
      }
      return s;
    }

    var guardado = { xb: null, ps: null };

    function pistas() {
      /* as tabelas de tempo são caras e só mudam com xB, de modo que vale
         guardá-las entre quadros da animação */
      if (guardado.xb === est.xb) return guardado.ps;
      var th1 = thetaFinal(), R = YB / (1 - Math.cos(th1)), A = arco();
      var ps = [
        { n: 'reta', cor: G.COR.vinho,
          pt: function (u) { return [est.xb * u, YB * u]; } },
        { n: 'arco de círculo', cor: G.COR.bronze, pt: A.pt },
        { n: 'ciclóide', cor: G.COR.mestra,
          pt: function (u) {
            var th = th1 * u;
            return [R * (th - Math.sin(th)), R * (1 - Math.cos(th))];
          } }
      ];
      ps.forEach(function (q) { q.tt = tabela(q.pt); q.T = q.tt[q.tt.length - 1]; });
      guardado = { xb: est.xb, ps: ps };
      return ps;
    }

    function desenhar() {
      var alt = 300;
      var p = G.preparar(cv, alt), ct = p.ct, Lp = p.L;
      ct.clearRect(0, 0, Lp, alt);

      var ps = pistas();
      var ymax = 1.05, xmax = est.xb;
      ps.forEach(function (q) {
        for (var i = 0; i <= 40; i++) {
          var r = q.pt(i / 40);
          if (r[1] > ymax) ymax = r[1];
          if (r[0] > xmax) xmax = r[0];
        }
      });
      var esc = Math.min((Lp - 80) / xmax, (alt - 74) / ymax);
      var x0 = (Lp - xmax * esc) / 2, y0 = 34;
      var X = function (u) { return x0 + u * esc; };
      var Y = function (u) { return y0 + u * esc; };

      ps.forEach(function (q) {
        var tt = q.tt;
        ct.beginPath();
        for (var i = 0; i <= 200; i++) {
          var r = q.pt(i / 200);
          (i ? ct.lineTo : ct.moveTo).call(ct, X(r[0]), Y(r[1]));
        }
        ct.strokeStyle = q.cor; ct.lineWidth = 2.2; ct.stroke();
        var b = posicao(q.pt, tt, est.t);
        ct.beginPath(); ct.arc(X(b[0]), Y(b[1]), 7, 0, 2 * Math.PI);
        ct.fillStyle = q.cor; ct.fill();
        ct.strokeStyle = '#fff'; ct.lineWidth = 1.6; ct.stroke();
        if (est.t >= q.T) {
          rotulo(ct, F.fmt(q.T, 3) + ' s', X(b[0]) + 12, Y(b[1]) + 14, q.cor, 'left');
        }
      });

      [[0, 0], [est.xb, YB]].forEach(function (q, i) {
        ct.beginPath(); ct.arc(X(q[0]), Y(q[1]), 5, 0, 2 * Math.PI);
        ct.fillStyle = G.COR.tinta; ct.fill();
        rotulo(ct, i ? 'B' : 'A', X(q[0]) + (i ? 14 : -14), Y(q[1]) - 10, G.COR.tinta);
      });

      ps.forEach(function (q, i) {
        ct.fillStyle = q.cor;
        ct.fillRect(10, 12 + i * 16 - 3, 14, 3);
        rotulo(ct, q.n, 29, 12 + i * 16, q.cor, 'left');
      });

      var tr = ps[0].T, tc = ps[1].T, tq = ps[2].T;
      mostrar({
        tr: F.fmt(tr, 4) + ' s', tc: F.fmt(tc, 4) + ' s', tq: F.fmt(tq, 4) + ' s',
        gan: F.pct(1 - tq / tr, 2),
        lr: F.fmt(comprimento(ps[0].pt), 3) + ' m',
        lq: F.fmt(comprimento(ps[2].pt), 3) + ' m'
      });
      return ps;
    }

    function texto(ps) {
      var tr = ps[0].T, tc = ps[1].T, tq = ps[2].T;
      nota.innerHTML =
        '<p>Em junho de 1696, Johann Bernoulli desafiou os matemáticos da Europa: dados dois '
        + 'pontos A e B, com B mais baixo mas não diretamente abaixo, qual é a curva ao longo '
        + 'da qual uma conta desliza sem atrito de A a B no menor tempo? Ele chamou a curva de '
        + '<em>braquistócrona</em>, do grego para "tempo mais curto".</p>'
        + '<p>Pela conservação de energia a rapidez vale \\(v=\\sqrt{2gy}\\), com \\(y\\) '
        + 'medido para baixo a partir de A, e o tempo total é o funcional</p>'
        + '\\[T[y]=\\int_A^B\\frac{ds}{v}'
        + '=\\int_{0}^{x_B}\\frac{\\sqrt{1+y\\,\'^2}}{\\sqrt{2gy}}\\,dx.\\]'
        + '<p>A reta é o caminho mais curto, e perde: ' + F.fmt(tr, 3) + ' s contra '
        + F.fmt(tq, 3) + ' s da ciclóide, uma diferença de ' + F.pct(1 - tq / tr, 1)
        + '. O motivo é que a conta parte do repouso, e afundar logo no começo compra '
        + 'velocidade que será usada no resto do percurso. Vale <strong>andar mais para '
        + 'chegar antes</strong>, e o comprimento da ciclóide é de fato maior.</p>'
        + '<p>O arco de círculo, que foi a resposta de Galileu em 1638, também afunda e '
        + 'também ganha da reta, com ' + F.fmt(tc, 3) + ' s. Mas perde para a ciclóide, e '
        + 'é esse o detalhe que mostra que não basta afundar: existe uma forma ótima de '
        + 'afundar, e achá-la é o que o cálculo variacional faz.</p>'
        + '<p>Newton recebeu o problema ao voltar da Casa da Moeda, resolveu-o durante a '
        + 'noite e enviou a solução sem assinatura. Bernoulli reconheceu o autor pelo '
        + 'estilo: <em>tanquam ex ungue leonem</em>, o leão pela garra. A dedução completa, '
        + 'com a integral de Beltrami, está no módulo 8.</p>';
      tipografar(corpo);
    }

    var chaveAnt = '';
    function quadro() {
      var ps = desenhar();
      if (est.rodando) {
        est.t += 0.012;
        if (est.t > ps[0].T + 0.9) est.t = 0;
      }
      var chave = F.fmt(est.xb, 2);
      if (chave !== chaveAnt) { chaveAnt = chave; texto(ps); }
      requestAnimationFrame(quadro);
    }

    requestAnimationFrame(quadro);
    registrarRedesenho(desenhar);
  };

  /* =================================================================
     22. O problema de Dido
     Problema isoperimétrico: com o perímetro fixo, qual curva fechada
     encerra mais área? A resposta é o círculo, e vê-la emergir de uma
     família de polígonos regulares à medida que os lados aumentam faz
     o resultado parecer inevitável, que é o que ele é.
     ================================================================= */
  REGISTRO.isoperimetrico = function (raiz) {
    var P = 1;                        // perímetro fixo
    var est = { n: 5, e: 0.55 };

    var corpo = moldura(raiz, 'O problema de Dido: perímetro fixo, área máxima');

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'lados do polígono regular', 3, 24, 1, 5,
      function (v) { est.n = v; desenhar(); },
      function (v) { return v >= 24 ? 'círculo' : v + ' lados'; });
    deslizante(ctr, 'razão entre os eixos da elipse', 0.15, 1, 0.01, 0.55,
      function (v) { est.e = v; desenhar(); },
      function (v) { return v >= 0.995 ? 'círculo' : F.fmt(v, 2); });

    var mostrar = cartoes(corpo, [
      { rot: 'área do polígono', k: 'ap' },
      { rot: 'área da elipse', k: 'ae' },
      { rot: 'área do círculo', k: 'ac' },
      { rot: 'polígono / círculo', k: 'rp' },
      { rot: 'elipse / círculo', k: 're' },
      { rot: '4πA/P² da melhor das duas', k: 'iso' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    function areaPoligono(n) {
      var l = P / n;
      return n * l * l / (4 * Math.tan(Math.PI / n));
    }
    /* elipse de semieixos a e b = e·a, com o perímetro ajustado a P
       pela aproximação de Ramanujan, invertida numericamente */
    function semieixos(e) {
      function per(a) {
        var b = e * a, h = Math.pow(a - b, 2) / Math.pow(a + b, 2);
        return Math.PI * (a + b) * (1 + 3 * h / (10 + Math.sqrt(4 - 3 * h)));
      }
      var lo = 1e-4, hi = 1;
      for (var i = 0; i < 60; i++) {
        var m = (lo + hi) / 2;
        if (per(m) < P) lo = m; else hi = m;
      }
      var a = (lo + hi) / 2;
      return [a, e * a];
    }

    function desenhar() {
      var alt = 300;
      var p = G.preparar(cv, alt), ct = p.ct, Lp = p.L;
      ct.clearRect(0, 0, Lp, alt);

      var Rc = P / (2 * Math.PI);
      var ab = semieixos(est.e);
      var esc = Math.min((alt - 56) / (2.3 * Rc), (Lp / 3 - 24) / (2.3 * Rc));
      var cy = alt / 2 - 4;

      function painel(cx, desenha, rot, cor, area) {
        desenha(cx);
        rotulo(ct, rot, cx, alt - 30, cor);
        rotulo(ct, 'A = ' + F.fmt(area, 5), cx, alt - 14, G.COR.suave, 'center',
          'middle', '600 10px system-ui, sans-serif');
      }

      painel(Lp / 6, function (cx) {
        ct.beginPath();
        for (var k = 0; k <= est.n; k++) {
          var a = -Math.PI / 2 + 2 * Math.PI * k / est.n;
          var r = P / (2 * est.n * Math.sin(Math.PI / est.n));
          var px = cx + r * esc * Math.cos(a), py = cy + r * esc * Math.sin(a);
          (k ? ct.lineTo : ct.moveTo).call(ct, px, py);
        }
        ct.closePath();
        ct.fillStyle = 'rgba(168,96,31,.18)'; ct.fill();
        ct.strokeStyle = G.COR.bronze; ct.lineWidth = 2.4; ct.stroke();
      }, est.n >= 24 ? 'círculo' : est.n + ' lados', G.COR.bronze, areaPoligono(est.n));

      painel(Lp / 2, function (cx) {
        ct.beginPath();
        ct.ellipse(cx, cy, ab[0] * esc, ab[1] * esc, 0, 0, 2 * Math.PI);
        ct.fillStyle = 'rgba(107,78,143,.18)'; ct.fill();
        ct.strokeStyle = G.COR.roxo; ct.lineWidth = 2.4; ct.stroke();
      }, 'elipse', G.COR.roxo, Math.PI * ab[0] * ab[1]);

      painel(Lp * 5 / 6, function (cx) {
        ct.beginPath(); ct.arc(cx, cy, Rc * esc, 0, 2 * Math.PI);
        ct.fillStyle = 'rgba(23,107,93,.2)'; ct.fill();
        ct.strokeStyle = G.COR.mestra; ct.lineWidth = 2.8; ct.stroke();
      }, 'círculo', G.COR.mestra, Math.PI * Rc * Rc);

      rotulo(ct, 'os três têm o mesmo perímetro', Lp / 2, 14, G.COR.suave);

      var Ap = areaPoligono(est.n), Ae = Math.PI * ab[0] * ab[1],
          Ac = Math.PI * Rc * Rc;
      mostrar({
        ap: F.fmt(Ap, 5), ae: F.fmt(Ae, 5), ac: F.fmt(Ac, 5),
        rp: F.pct(Ap / Ac, 2), re: F.pct(Ae / Ac, 2),
        iso: F.fmt(4 * Math.PI * Math.max(Ap, Ae) / (P * P), 4)
      });

      nota.innerHTML =
        '<p>Segundo a lenda, a princesa fenícia Dido comprou de um chefe local toda a terra '
        + 'que coubesse dentro de uma pele de boi. Ela cortou a pele em tiras finíssimas, '
        + 'emendou-as numa corda longa e fechou com ela a maior área possível, fundando ali '
        + 'Cartago. O problema que ela resolveu na prática é o '
        + '<strong>isoperimétrico</strong>: com o perímetro fixo, qual curva fechada encerra '
        + 'a maior área?</p>'
        + '<p>As três figuras têm exatamente o mesmo perímetro, e as áreas estão nos '
        + 'cartões. O polígono regular melhora à medida que ganha lados, e a elipse melhora '
        + 'à medida que fica menos achatada; nos dois casos o limite é o mesmo, e nenhum dos '
        + 'dois chega a superá-lo. A razão isoperimétrica</p>'
        + '\\[\\frac{4\\pi A}{P^2}\\leq1\\]'
        + '<p>vale 1 apenas para o círculo, e esse é o enunciado moderno do que Dido sabia.</p>'
        + '<p>O que torna este problema diferente dos outros desta aula é a '
        + '<strong>restrição</strong>: não se procura o extremo de um funcional qualquer, e '
        + 'sim o extremo de um funcional (a área) com outro funcional (o perímetro) mantido '
        + 'fixo. Problemas assim se chamam isoperimétricos e se resolvem com multiplicadores '
        + 'de Lagrange aplicados ao cálculo variacional, que é o assunto do módulo 9.</p>'
        + '<p>Note ainda que os gregos <em>sabiam</em> a resposta desde a Antiguidade, e não '
        + 'tinham como prová-la. A primeira demonstração completa só veio com Weierstrass, no '
        + 'século XIX, e precisou exatamente das ferramentas que esta aula começa a '
        + 'montar.</p>';
      tipografar(corpo);
    }

    registrarRedesenho(desenhar);
  };

  /* =================================================================
     27. O resíduo de Euler-Lagrange: o teste ponto a ponto
     A condição delta-J = 0 é global; a equação de Euler-Lagrange é a
     sua tradução local. O widget mostra as duas coisas ao mesmo tempo:
     o valor do funcional contra a deformação e o resíduo
     G(x) = f_y - d/dx(f_y') ao longo do intervalo.
     ================================================================= */
  REGISTRO.residuoel = function (raiz) {
    var CASOS = {
      comp: {
        n: 'comprimento', sim: 'L[y]',
        f: function (x, y, d) { return Math.sqrt(1 + d * d); },
        ex: function (x) { return x; },
        eq: 'y\'\' = 0', sol: 'a reta y = x'
      },
      quad: {
        n: 'quadrático com y²', sim: 'J[y]',
        f: function (x, y, d) { return d * d + y * y; },
        ex: function (x) { return Math.sinh(x) / Math.sinh(1); },
        eq: 'y\'\' = y', sol: 'y = senh x / senh 1'
      },
      forca: {
        n: 'com termo de fonte', sim: 'J[y]',
        f: function (x, y, d) { return d * d - 4 * x * y; },
        ex: function (x) { return x * x; },
        eq: 'y\'\' = -2x', sol: 'a parábola y = x²'
      }
    };
    var est = { k: 'comp', a: 0.25, vista: 'curva' };

    var corpo = moldura(raiz, 'A equação de Euler-Lagrange é o teste ponto a ponto');

    var c0 = el('div', { class: 'controles' });
    corpo.appendChild(c0);
    opcoes(c0, [
      { rot: 'A curva e o resíduo', v: 'curva' },
      { rot: 'J contra a deformação', v: 'perfil' }
    ], 0, function (v) { est.vista = v; desenhar(); });
    opcoes(c0, Object.keys(CASOS).map(function (k) {
      return { rot: CASOS[k].n, v: k };
    }), 0, function (v) { est.k = v; desenhar(); });

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'deformação a', -0.5, 0.5, 0.01, 0.25,
      function (v) { est.a = v; desenhar(); },
      function (v) { return F.fmt(v, 2); });

    var mostrar = cartoes(corpo, [
      { rot: 'equação de Euler-Lagrange', k: 'eq' },
      { rot: 'extremante', k: 'sol' },
      { rot: 'J para esta curva', k: 'j' },
      { rot: 'J para a extremante', k: 'j0' },
      { rot: 'maior resíduo |G|', k: 'res' },
      { rot: 'δJ para esta deformação', k: 'dj' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    function curva(a, x) { return CASOS[est.k].ex(x) + a * Math.sin(Math.PI * x); }
    function dcurva(a, x) {
      return (curva(a, x + 1e-5) - curva(a, x - 1e-5)) / 2e-5;
    }
    function valor(a) {
      var N = 600, s = 0;
      for (var i = 0; i < N; i++) {
        var x = (i + 0.5) / N;
        s += CASOS[est.k].f(x, curva(a, x), dcurva(a, x));
      }
      return s / N;
    }
    /* resíduo G(x) = f_y − d/dx(f_y'), por diferenças centradas */
    function residuo(a, x) {
      var f = CASOS[est.k].f, h = 1e-4;
      function fy(xx) {
        var y = curva(a, xx), d = dcurva(a, xx);
        return (f(xx, y + h, d) - f(xx, y - h, d)) / (2 * h);
      }
      function fd(xx) {
        var y = curva(a, xx), d = dcurva(a, xx);
        return (f(xx, y, d + h) - f(xx, y, d - h)) / (2 * h);
      }
      var dx = 2e-3;
      return fy(x) - (fd(x + dx) - fd(x - dx)) / (2 * dx);
    }
    function maiorResiduo(a) {
      var m = 0;
      for (var i = 1; i < 60; i++) m = Math.max(m, Math.abs(residuo(a, i / 60)));
      return m;
    }

    function desenhaCurva() {
      var alt = 320;
      var p = G.preparar(cv, alt), ct = p.ct, Lp = p.L;
      ct.clearRect(0, 0, Lp, alt);
      var meia = Lp / 2 - 10;

      /* painel 1: a curva de prova contra a extremante */
      var ymin = -0.4, ymax = 1.6;
      var g1 = G.eixos(cv, {
        altura: alt, xmin: 0, xmax: 1, ymin: ymin, ymax: ymax,
        rotX: 'x', rotY: 'y(x)',
        marcasX: G.marcasLineares(0, 1, 6, 1),
        limpar: false, margem: { e: 52, d: Lp - meia + 10, c: 16, b: 40 }
      });
      G.curva(g1, function (x) { return CASOS[est.k].ex(x); }, G.COR.bronze, 2.4, [6, 4]);
      G.curva(g1, function (x) { return curva(est.a, x); }, G.COR.mestra, 2.6);
      G.legenda(g1, [
        { texto: 'extremante', cor: G.COR.bronze },
        { texto: 'curva de prova', cor: G.COR.mestra }
      ]);

      /* painel 2: o resíduo ao longo do intervalo */
      var rm = Math.max(maiorResiduo(est.a), maiorResiduo(0.5)) * 1.15 + 1e-9;
      var g2 = G.eixos(cv, {
        altura: alt, xmin: 0, xmax: 1, ymin: -rm, ymax: rm,
        rotX: 'x', rotY: 'G(x)',
        marcasX: G.marcasLineares(0, 1, 6, 1),
        formataY: function (v) { return F.fmt(v, 1); },
        limpar: false, margem: { e: meia + 56, d: 16, c: 16, b: 40 }
      });
      G.curva(g2, function (x) { return 0; }, G.COR.grade, 1.6);
      G.curva(g2, function (x) { return residuo(0, x); }, G.COR.bronze, 2.2, [6, 4]);
      G.curva(g2, function (x) { return residuo(est.a, x); }, G.COR.vinho, 2.6);
      rotulo(g2.ct, 'resíduo da extremante: zero em todo x',
        g2.x1 - 6, g2.y0 + 12, G.COR.bronze, 'right');
    }

    function desenhaPerfil() {
      var v0 = valor(-0.5), v1 = valor(0.5), vm = valor(0);
      var vmax = Math.max(v0, v1), folga = (vmax - vm) * 0.2 + 1e-6;
      var gr = G.eixos(cv, {
        altura: 320, xmin: -0.5, xmax: 0.5,
        ymin: vm - folga, ymax: vmax + folga,
        rotX: 'deformação a', rotY: CASOS[est.k].sim,
        marcasX: G.marcasLineares(-0.5, 0.5, 6, 2),
        formataY: function (v) { return F.fmt(v, 3); }
      });
      G.curva(gr, valor, G.COR.mestra, 2.6);
      G.vertical(gr, est.a, G.COR.suave, '', true);
      var ct = gr.ct;
      ct.beginPath(); ct.arc(gr.X(0), gr.Y(vm), 5.5, 0, 2 * Math.PI);
      ct.fillStyle = G.COR.bronze; ct.fill();
      rotulo(ct, 'a = 0: a extremante', gr.X(0), gr.Y(vm) - 18, G.COR.bronze);
      ct.beginPath(); ct.arc(gr.X(est.a), gr.Y(valor(est.a)), 5, 0, 2 * Math.PI);
      ct.fillStyle = G.COR.roxo; ct.fill();
    }

    function desenhar() {
      var C0 = CASOS[est.k];
      if (est.vista === 'curva') desenhaCurva(); else desenhaPerfil();
      var h = 1e-3;
      var dj = (valor(est.a + h) - valor(est.a - h)) / (2 * h);
      mostrar({
        eq: C0.eq, sol: C0.sol,
        j: F.fmt(valor(est.a), 5),
        j0: F.fmt(valor(0), 5),
        res: F.fmt(maiorResiduo(est.a), 4),
        dj: F.fmt(dj, 4) + ' por unidade de a'
      });
      nota.innerHTML =
        '<p>A condição \\(\\delta J=0\\) é uma afirmação sobre a curva <em>inteira</em>: o '
        + 'número \\(J\\) tem de ficar estacionário diante de qualquer deformação. A equação '
        + 'de Euler-Lagrange é a tradução disso para cada ponto:</p>'
        + '\\[G(x)=\\pder{f}{y}-\\der{}{x}\\left(\\pder{f}{y\'}\\right)=0'
        + '\\qquad\\text{para todo } x.\\]'
        + '<p>O segundo painel desenha \\(G(x)\\) calculado numericamente. Para a extremante '
        + '(tracejado bronze) ele é nulo em todo o intervalo; para qualquer outra curva ele é '
        + 'diferente de zero em algum lugar, e o maior valor em módulo está no cartão. Repare '
        + 'que não basta \\(G\\) ser pequeno em média: o lema fundamental, demonstrado no '
        + 'módulo 7, exige que seja nulo ponto a ponto, porque a deformação pode ser '
        + 'concentrada em qualquer pedacinho.</p>'
        + '<p>A outra vista mostra a mesma coisa pelo lado global: \\(J\\) contra a deformação '
        + '\\(a\\), com o mínimo em \\(a=0\\). O cartão \\(\\delta J\\) é a inclinação dessa '
        + 'curva, que se anula exatamente onde o resíduo some.</p>'
        + '<p>Troque de funcional e compare as três equações resultantes. A primeira dá '
        + '\\(y\'\'=0\\) porque \\(f\\) não depende de \\(y\\); a segunda acopla \\(y\'\'\\) a '
        + '\\(y\\) e produz senos hiperbólicos; a terceira tem uma fonte \\(-4xy\\) que '
        + 'empurra a solução para a parábola.</p>';
      tipografar(corpo);
    }

    registrarRedesenho(desenhar);
  };

  /* =================================================================
     28. A ciclóide resolvida: Beltrami em ação
     Resolve o parâmetro da ciclóide para o ponto B escolhido e mostra
     que a combinação de Beltrami é constante ao longo dela e não ao
     longo da reta.
     ================================================================= */
  REGISTRO.cicloide = function (raiz) {
    var G0 = 9.80665;
    var est = { xb: 1.4, mostrarK: true };

    var corpo = moldura(raiz, 'A ciclóide: a integral de Beltrami resolve a braquistócrona');

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'afastamento horizontal de B', 0.4, 3, 0.05, 1.4,
      function (v) { est.xb = v; desenhar(); },
      function (v) { return F.fmt(v, 2) + ' m'; });

    var mostrar = cartoes(corpo, [
      { rot: 'parâmetro a da ciclóide', k: 'a' },
      { rot: 'ângulo final θ₁', k: 'th' },
      { rot: 'constante K = y(1+y\'²)', k: 'K' },
      { rot: 'K = 2a (verificação)', k: 'K2' },
      { rot: 'tempo pela ciclóide', k: 'tc' },
      { rot: 'tempo pela reta', k: 'tr' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    var YB = 1;
    function thetaFinal() {
      var alvo = YB / est.xb, lo = 1e-4, hi = 2 * Math.PI - 1e-4;
      for (var i = 0; i < 80; i++) {
        var m = (lo + hi) / 2;
        if ((1 - Math.cos(m)) / (m - Math.sin(m)) > alvo) lo = m; else hi = m;
      }
      return (lo + hi) / 2;
    }
    function tempo(pt) {
      var N = 4000, acc = 0, ant = pt(0);
      for (var i = 1; i <= N; i++) {
        var q = pt(i / N);
        var ds = Math.hypot(q[0] - ant[0], q[1] - ant[1]);
        acc += ds / Math.sqrt(2 * G0 * Math.max((q[1] + ant[1]) / 2, 1e-12));
        ant = q;
      }
      return acc;
    }

    function desenhar() {
      var th1 = thetaFinal(), a = YB / (1 - Math.cos(th1));
      function cic(u) {
        var th = th1 * u;
        return [a * (th - Math.sin(th)), a * (1 - Math.cos(th))];
      }
      function reta(u) { return [est.xb * u, YB * u]; }

      var alt = 320;
      var p = G.preparar(cv, alt), ct = p.ct, Lp = p.L;
      ct.clearRect(0, 0, Lp, alt);
      var meia = Lp * 0.52;

      /* painel 1: as duas curvas */
      var xmax = Math.max(est.xb, cic(1)[0]), ymax = 1.05;
      for (var i = 0; i <= 60; i++) ymax = Math.max(ymax, cic(i / 60)[1]);
      var esc = Math.min((meia - 70) / xmax, (alt - 74) / ymax);
      var x0 = 34, y0 = 34;
      function X(u) { return x0 + u * esc; }
      function Y(u) { return y0 + u * esc; }

      [[reta, G.COR.vinho, 'reta'], [cic, G.COR.mestra, 'ciclóide']].forEach(function (q, k) {
        ct.beginPath();
        for (var i2 = 0; i2 <= 240; i2++) {
          var r = q[0](i2 / 240);
          (i2 ? ct.lineTo : ct.moveTo).call(ct, X(r[0]), Y(r[1]));
        }
        ct.strokeStyle = q[1]; ct.lineWidth = 2.4; ct.stroke();
        ct.fillStyle = q[1];
        ct.fillRect(14, alt - 34 + k * 16 - 3, 13, 3);
        rotulo(ct, q[2], 32, alt - 34 + k * 16, q[1], 'left');
      });

      /* a roda que gera a ciclóide, no ponto médio */
      var tm = th1 * 0.5;
      var centro = [a * tm, a];
      ct.beginPath();
      ct.arc(X(centro[0]), Y(centro[1]), a * esc, 0, 2 * Math.PI);
      ct.strokeStyle = G.COR.clara; ct.lineWidth = 1.4;
      ct.setLineDash([5, 4]); ct.stroke(); ct.setLineDash([]);
      var pc = cic(0.5);
      ct.beginPath();
      ct.moveTo(X(centro[0]), Y(centro[1])); ct.lineTo(X(pc[0]), Y(pc[1]));
      ct.strokeStyle = G.COR.clara; ct.stroke();
      ct.beginPath(); ct.arc(X(pc[0]), Y(pc[1]), 5, 0, 2 * Math.PI);
      ct.fillStyle = G.COR.mestra; ct.fill();
      rotulo(ct, 'a roda que rola', X(centro[0]), Y(centro[1] - a) - 12, G.COR.clara);

      [[0, 0, 'A'], [est.xb, YB, 'B']].forEach(function (q) {
        ct.beginPath(); ct.arc(X(q[0]), Y(q[1]), 5, 0, 2 * Math.PI);
        ct.fillStyle = G.COR.tinta; ct.fill();
        rotulo(ct, q[2], X(q[0]) + 14, Y(q[1]) - 10, G.COR.tinta);
      });

      /* painel 2: a combinação de Beltrami ao longo de cada curva */
      function beltrami(pt, u) {
        var e = 1e-4;
        var q1 = pt(Math.max(0, u - e)), q2 = pt(Math.min(1, u + e));
        var dy = (q2[1] - q1[1]), dx = (q2[0] - q1[0]);
        var d = dx === 0 ? 1e6 : dy / dx;
        var y = pt(u)[1];
        return y * (1 + d * d);
      }
      var g2 = G.eixos(cv, {
        altura: alt, xmin: 0.02, xmax: 1, ymin: 0, ymax: 4 * a,
        rotX: 'fração do percurso', rotY: 'y (1 + y\'²)',
        marcasX: G.marcasLineares(0, 1, 5, 1),
        formataY: function (v) { return F.fmt(v, 2); },
        limpar: false, margem: { e: meia + 56, d: 16, c: 16, b: 40 }
      });
      G.curva(g2, function (u) { return beltrami(reta, u); }, G.COR.vinho, 2.4);
      G.curva(g2, function (u) { return beltrami(cic, u); }, G.COR.mestra, 2.8);
      G.curva(g2, function () { return 2 * a; }, G.COR.bronze, 1.8, [6, 4]);
      rotulo(g2.ct, 'K = 2a', g2.x1 - 6, g2.Y(2 * a) - 12, G.COR.bronze, 'right');

      mostrar({
        a: F.fmt(a, 4) + ' m',
        th: F.fmt(th1 * 180 / Math.PI, 1) + '°',
        K: F.fmt(beltrami(cic, 0.5), 4),
        K2: F.fmt(2 * a, 4),
        tc: F.fmt(tempo(cic), 4) + ' s',
        tr: F.fmt(tempo(reta), 4) + ' s'
      });

      nota.innerHTML =
        '<p>O integrando da braquistócrona, \\(f=\\sqrt{(1+y\'^2)/y}\\), não depende '
        + 'explicitamente de \\(x\\). Vale então a integral de Beltrami, e a conta se reduz '
        + 'a uma equação de primeira ordem:</p>'
        + '\\[f-y\'\\pder{f}{y\'}=\\frac{1}{\\sqrt{y\\left(1+y\'^2\\right)}}=C'
        + '\\qquad\\Longrightarrow\\qquad y\\left(1+y\'^2\\right)=K.\\]'
        + '<p>O segundo painel testa isso diretamente: ao longo da ciclóide a combinação '
        + '\\(y(1+y\'^2)\\) é a mesma em todo ponto, e vale exatamente \\(2a\\); ao longo da '
        + 'reta ela varia, e por isso a reta não resolve a equação. É a verificação numérica '
        + 'de uma conta feita à mão.</p>'
        + '<p>A substituição \\(y=\\tfrac{K}{2}(1-\\cos\\theta)\\) converte '
        + '\\(y\'=\\sqrt{(K-y)/y}\\) em \\(\\cotg(\\theta/2)\\), e integrar devolve '
        + '\\(x=\\tfrac{K}{2}(\\theta-\\sen\\theta)\\). Com \\(a=K/2\\),</p>'
        + '\\[x=a\\left(\\theta-\\sen\\theta\\right),\\qquad y=a\\left(1-\\cos\\theta\\right),\\]'
        + '<p>que é a ciclóide traçada pelo ponto de uma roda rolando sem deslizar, desenhada '
        + 'em tracejado no primeiro painel. O valor de \\(a\\) sai da exigência de que a curva '
        + 'passe por B, e com o B atual vale ' + F.fmt(a, 4) + ' m.</p>';
      tipografar(corpo);
    }

    registrarRedesenho(desenhar);
  };

  /* =================================================================
     29. A catenária e a parábola
     Resolve L = 2C senh(a/C) por bisseção e compara a forma com a
     parábola de mesma flecha, que é a resposta errada de Galileu e a
     resposta certa para uma ponte pênsil.
     ================================================================= */
  REGISTRO.catenaria = function (raiz) {
    var est = { L: 12, a: 5 };

    var corpo = moldura(raiz, 'A catenária contra a parábola');

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'comprimento da corrente', 10.4, 26, 0.2, 12,
      function (v) { est.L = v; desenhar(); },
      function (v) { return F.fmt(v, 1) + ' m'; });
    deslizante(ctr, 'meia distância entre os apoios', 3, 8, 0.1, 5,
      function (v) { est.a = v; desenhar(); },
      function (v) { return F.fmt(v, 1) + ' m'; });

    var mostrar = cartoes(corpo, [
      { rot: 'parâmetro C', k: 'C' },
      { rot: 'flecha da catenária', k: 'fl' },
      { rot: 'razão L / 2a', k: 'raz' },
      { rot: 'diferença no quarto do vão', k: 'dif' },
      { rot: 'tensão horizontal / peso', k: 'tens' },
      { rot: 'y / √(1+y\'²) (Beltrami)', k: 'bel' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    /* L = 2C senh(a/C): C grande dá L → 2a, C pequeno dá L enorme */
    function resolveC() {
      var lo = 1e-3, hi = 1e4;
      for (var i = 0; i < 200; i++) {
        var m = Math.sqrt(lo * hi);
        if (2 * m * Math.sinh(est.a / m) > est.L) lo = m; else hi = m;
      }
      return Math.sqrt(lo * hi);
    }

    function desenhar() {
      if (est.L <= 2 * est.a + 0.05) est.L = 2 * est.a + 0.4;
      var C = resolveC();
      var flecha = C * Math.cosh(est.a / C) - C;
      function cat(x) { return C * Math.cosh(x / C) - C; }
      function par(x) { return flecha * x * x / (est.a * est.a); }

      var gr = G.eixos(cv, {
        altura: 330, xmin: -est.a, xmax: est.a,
        ymin: -flecha * 0.08, ymax: flecha * 1.14 + 0.01,
        rotX: 'x (m)', rotY: 'altura acima do ponto mais baixo (m)',
        marcasX: G.marcasLineares(-est.a, est.a, 7, 1),
        formataY: function (v) { return F.fmt(v, 2); }
      });
      G.curva(gr, par, G.COR.bronze, 2.4, [6, 4]);
      G.curva(gr, cat, G.COR.mestra, 2.8);
      G.legenda(gr, [
        { texto: 'catenária C cosh(x/C)', cor: G.COR.mestra },
        { texto: 'parábola de mesma flecha', cor: G.COR.bronze }
      ]);
      var ct = gr.ct;
      [-est.a, est.a].forEach(function (x) {
        ct.beginPath(); ct.arc(gr.X(x), gr.Y(flecha), 5, 0, 2 * Math.PI);
        ct.fillStyle = G.COR.tinta; ct.fill();
      });
      var xq = est.a / 2;
      ct.beginPath();
      ct.moveTo(gr.X(xq), gr.Y(cat(xq))); ct.lineTo(gr.X(xq), gr.Y(par(xq)));
      ct.strokeStyle = G.COR.vinho; ct.lineWidth = 2; ct.stroke();
      rotulo(ct, 'diferença aqui', gr.X(xq) + 10,
        (gr.Y(cat(xq)) + gr.Y(par(xq))) / 2, G.COR.vinho, 'left');

      var d = Math.abs(cat(xq) - par(xq));
      var yq = C * Math.cosh(xq / C), dq = Math.sinh(xq / C);
      mostrar({
        C: F.fmt(C, 3) + ' m',
        fl: F.fmt(flecha, 3) + ' m',
        raz: F.fmt(est.L / (2 * est.a), 3),
        dif: F.fmt(d * 100, 1) + ' cm',
        tens: F.fmt(C / est.L, 3),
        bel: F.fmt(yq / Math.sqrt(1 + dq * dq), 4) + ' = C'
      });

      nota.innerHTML =
        '<p>A corrente assume a forma que minimiza a energia potencial, '
        + '\\(U=\\varrho g\\int y\\sqrt{1+y\'^2}\\,dx\\), com o comprimento mantido fixo. O '
        + 'integrando não depende de \\(x\\), e Beltrami dá de imediato</p>'
        + '\\[y\\sqrt{1+y\'^2}-y\'\\frac{y\\,y\'}{\\sqrt{1+y\'^2}}'
        + '=\\frac{y}{\\sqrt{1+y\'^2}}=C.\\]'
        + '<p>Isolando \\(y\'=\\sqrt{(y^2-C^2)}/C\\) e integrando sai '
        + '\\(x=C\\,\\mathrm{arccosh}(y/C)+K\\), ou seja a <strong>catenária</strong> '
        + '\\(y=C\\cosh\\left[(x-K)/C\\right]\\). O cartão de Beltrami mostra o valor dessa '
        + 'combinação medido no quarto do vão: dá \\(C\\), como deve.</p>'
        + '<p>Para apoios na mesma altura a simetria impõe \\(K=0\\), e o comprimento se '
        + 'calcula de uma vez, porque \\(\\sqrt{1+\\mathrm{senh}^2}=\\cosh\\):</p>'
        + '\\[L=\\int_{-a}^{a}\\cosh\\frac{x}{C}\\,dx=2C\\,\\mathrm{senh}\\frac{a}{C}.\\]'
        + '<p>Essa equação transcendental determina \\(C\\) a partir de \\(L\\) e \\(a\\), e é '
        + 'o que os deslizantes resolvem numericamente. Quanto mais folgada a corrente, menor '
        + 'o \\(C\\) e mais fundo o barrigão.</p>'
        + '<p>A parábola de mesma flecha está em tracejado. As duas curvas são parecidas e não '
        + 'são iguais: no quarto do vão elas diferem de ' + F.fmt(d * 100, 1) + ' cm. Galileu '
        + 'apostou na parábola em 1638 e errou; mas a parábola é a resposta <em>certa</em> '
        + 'para o cabo de uma ponte pênsil, que carrega um tabuleiro de peso distribuído '
        + 'horizontalmente em vez do próprio peso distribuído ao longo do arco.</p>';
      tipografar(corpo);
    }

    registrarRedesenho(desenhar);
  };

  /* =================================================================
     30. Fermat e a lei de Snell
     O ponto de cruzamento escolhido à mão, o caminho óptico como
     função dele, e a verificação de n1 sen t1 = n2 sen t2 no mínimo.
     ================================================================= */
  REGISTRO.snell = function (raiz) {
    var est = { x: 1.3, n1: 1.00, n2: 1.33 };
    var A = { x: 0, y: 1.2 }, B = { x: 3.0, y: -1.6 };

    var corpo = moldura(raiz, 'O princípio de Fermat e a lei de Snell');

    var c0 = el('div', { class: 'controles' });
    corpo.appendChild(c0);
    opcoes(c0, [
      { rot: 'ar e água (1,00 e 1,33)', v: 0 },
      { rot: 'ar e vidro (1,00 e 1,52)', v: 1 },
      { rot: 'vidro e ar (1,52 e 1,00)', v: 2 }
    ], 0, function (v) {
      est.n1 = [1.00, 1.00, 1.52][v];
      est.n2 = [1.33, 1.52, 1.00][v];
      desenhar();
    });

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    var slider = deslizante(ctr, 'ponto de cruzamento', 0.05, 2.95, 0.01, 1.3,
      function (v) { est.x = v; desenhar(); },
      function (v) { return F.fmt(v, 2) + ' m'; });
    var bt = el('button', { type: 'button', texto: 'ir para o mínimo' });
    bt.addEventListener('click', function () {
      slider.value = String(otimo()); slider.dispatchEvent(new Event('input'));
    });
    ctr.appendChild(bt);

    var mostrar = cartoes(corpo, [
      { rot: 'caminho óptico n₁d₁ + n₂d₂', k: 'co' },
      { rot: 'mínimo possível', k: 'min' },
      { rot: 'ângulo de incidência θ₁', k: 't1' },
      { rot: 'ângulo de refração θ₂', k: 't2' },
      { rot: 'n₁ sen θ₁', k: 's1' },
      { rot: 'n₂ sen θ₂', k: 's2' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    function caminho(x) {
      return est.n1 * Math.hypot(x - A.x, A.y) + est.n2 * Math.hypot(B.x - x, B.y);
    }
    function otimo() {
      var lo = 0.001, hi = 2.999;
      for (var i = 0; i < 120; i++) {
        var m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
        if (caminho(m1) < caminho(m2)) hi = m2; else lo = m1;
      }
      return Math.round((lo + hi) / 2 * 100) / 100;
    }

    function desenhar() {
      var alt = 330;
      var p = G.preparar(cv, alt), ct = p.ct, Lp = p.L;
      ct.clearRect(0, 0, Lp, alt);
      var meia = Lp * 0.54;

      var esc = Math.min((meia - 70) / 3.2, (alt - 60) / 3.2);
      var ox = 40, oy = alt / 2;
      function X(u) { return ox + u * esc; }
      function Y(u) { return oy - u * esc; }

      ct.fillStyle = 'rgba(123,184,171,.18)';
      ct.fillRect(0, oy, meia, alt - oy);
      ct.beginPath(); ct.moveTo(0, oy); ct.lineTo(meia, oy);
      ct.strokeStyle = G.COR.tinta; ct.lineWidth = 2; ct.stroke();
      rotulo(ct, 'n₁ = ' + F.fmt(est.n1, 2), 10, 16, G.COR.suave, 'left');
      rotulo(ct, 'n₂ = ' + F.fmt(est.n2, 2), 10, alt - 16, G.COR.azul, 'left');

      var P = { x: est.x, y: 0 };
      ct.beginPath();
      ct.moveTo(X(A.x), Y(A.y)); ct.lineTo(X(P.x), Y(0)); ct.lineTo(X(B.x), Y(B.y));
      ct.strokeStyle = G.COR.vinho; ct.lineWidth = 2.6; ct.stroke();

      var xo = otimo();
      ct.beginPath();
      ct.moveTo(X(A.x), Y(A.y)); ct.lineTo(X(xo), Y(0)); ct.lineTo(X(B.x), Y(B.y));
      ct.strokeStyle = G.COR.mestra; ct.lineWidth = 2;
      ct.setLineDash([6, 4]); ct.stroke(); ct.setLineDash([]);

      ct.beginPath();
      ct.moveTo(X(P.x), Y(1.0)); ct.lineTo(X(P.x), Y(-1.3));
      ct.strokeStyle = G.COR.suave; ct.lineWidth = 1.2;
      ct.setLineDash([4, 4]); ct.stroke(); ct.setLineDash([]);
      rotulo(ct, 'normal', X(P.x) + 8, Y(1.0) + 8, G.COR.suave, 'left');

      [[A, 'A'], [B, 'B']].forEach(function (q) {
        ct.beginPath(); ct.arc(X(q[0].x), Y(q[0].y), 5, 0, 2 * Math.PI);
        ct.fillStyle = G.COR.tinta; ct.fill();
        rotulo(ct, q[1], X(q[0].x) - 14, Y(q[0].y), G.COR.tinta, 'right');
      });
      ct.beginPath(); ct.arc(X(P.x), Y(0), 5, 0, 2 * Math.PI);
      ct.fillStyle = G.COR.vinho; ct.fill();

      var t1 = Math.atan2(Math.abs(P.x - A.x), A.y);
      var t2 = Math.atan2(Math.abs(B.x - P.x), Math.abs(B.y));
      rotulo(ct, 'θ₁', X(P.x) - 26, Y(0.52), G.COR.vinho, 'right');
      rotulo(ct, 'θ₂', X(P.x) + 26, Y(-0.52), G.COR.vinho, 'left');

      /* painel 2: o caminho óptico contra a posição do cruzamento */
      var vmin = caminho(xo), vmax = Math.max(caminho(0.05), caminho(2.95));
      var g2 = G.eixos(cv, {
        altura: alt, xmin: 0, xmax: 3,
        ymin: vmin - (vmax - vmin) * 0.12, ymax: vmax + (vmax - vmin) * 0.08,
        rotX: 'posição do cruzamento (m)', rotY: 'caminho óptico (m)',
        marcasX: G.marcasLineares(0, 3, 7, 1),
        formataY: function (v) { return F.fmt(v, 2); },
        limpar: false, margem: { e: meia + 60, d: 16, c: 16, b: 40 }
      });
      G.curva(g2, caminho, G.COR.mestra, 2.6);
      G.vertical(g2, est.x, G.COR.vinho, '', true);
      var c2 = g2.ct;
      c2.beginPath(); c2.arc(g2.X(xo), g2.Y(vmin), 5.5, 0, 2 * Math.PI);
      c2.fillStyle = G.COR.bronze; c2.fill();
      rotulo(c2, 'mínimo', g2.X(xo), g2.Y(vmin) - 18, G.COR.bronze);

      mostrar({
        co: F.fmt(caminho(est.x), 4) + ' m',
        min: F.fmt(vmin, 4) + ' m',
        t1: F.fmt(t1 * 180 / Math.PI, 2) + '°',
        t2: F.fmt(t2 * 180 / Math.PI, 2) + '°',
        s1: F.fmt(est.n1 * Math.sin(t1), 4),
        s2: F.fmt(est.n2 * Math.sin(t2), 4)
      });

      nota.innerHTML =
        '<p>A luz sai de A, cruza a interface num ponto de abscissa \\(x\\) e chega a B. Com '
        + '\\(d_1=\\sqrt{x^2+a^2}\\) e \\(d_2=\\sqrt{(b-x)^2+c^2}\\), o caminho óptico é</p>'
        + '\\[\\Lambda(x)=n_1\\sqrt{x^2+a^2}+n_2\\sqrt{(b-x)^2+c^2},\\]'
        + '<p>e aqui não é preciso cálculo variacional nenhum: a incógnita é um único número, '
        + 'e basta derivar. Impondo \\(d\\Lambda/dx=0\\),</p>'
        + '\\[n_1\\frac{x}{\\sqrt{x^2+a^2}}=n_2\\frac{b-x}{\\sqrt{(b-x)^2+c^2}}'
        + '\\qquad\\Longrightarrow\\qquad n_1\\sen\\theta_1=n_2\\sen\\theta_2.\\]'
        + '<p>Mova o cruzamento e compare os dois últimos cartões: eles só coincidem no '
        + 'mínimo do segundo painel. A lei de Snell não é uma regra empírica à parte, é a '
        + 'condição de estacionariedade do tempo de percurso.</p>'
        + '<p>Para um meio estratificado, com \\(n=n(y)\\), a conta vira variacional de '
        + 'verdade e o integrando \\(n(y)\\sqrt{1+y\'^2}\\) não depende de \\(x\\). Beltrami '
        + 'devolve \\(n(y)/\\sqrt{1+y\'^2}=\\) constante, isto é</p>'
        + '\\[n(y)\\,\\sen\\theta=\\text{constante ao longo do raio},\\]'
        + '<p>que é a lei de Snell escrita de forma contínua. É dessa invariante que saem as '
        + 'miragens: perto do asfalto quente o ar é menos denso, \\(n\\) cai, e o raio tem de '
        + 'inclinar-se até rasar o chão e voltar a subir.</p>';
      tipografar(corpo);
    }

    registrarRedesenho(desenhar);
  };

  /* =================================================================
     31. O princípio de Hamilton
     Um lançamento vertical, a ação calculada sobre caminhos de prova,
     e a demonstração de que o mínimo está na parábola de Galileu.
     ================================================================= */
  REGISTRO.acao = function (raiz) {
    var g0 = 9.80665, W = 2;          // W: frequência da mola, em rad/s
    var est = { a: 0.35, T: 2, modo: 'acao', pot: 'grav' };

    var corpo = moldura(raiz, 'O princípio de Hamilton: a ação sobre caminhos de prova');

    var c0 = el('div', { class: 'controles' });
    corpo.appendChild(c0);
    opcoes(c0, [
      { rot: 'ação S = ∫(T − V)dt', v: 'acao' },
      { rot: 'energia E = T + V', v: 'energia' }
    ], 0, function (v) { est.modo = v; desenhar(); });
    opcoes(c0, [
      { rot: 'queda livre', v: 'grav' },
      { rot: 'oscilador harmônico', v: 'mola' }
    ], 0, function (v) { est.pot = v; desenhar(); });

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'deformação do caminho', -1, 1, 0.02, 0.35,
      function (v) { est.a = v; desenhar(); },
      function (v) { return F.fmt(v, 2); });
    deslizante(ctr, 'duração do percurso', 1, 4, 0.1, 2,
      function (v) { est.T = v; desenhar(); },
      function (v) { return F.fmt(v, 1) + ' s'; });

    var mostrar = cartoes(corpo, [
      { rot: 'ação deste caminho', k: 'S' },
      { rot: 'ação do caminho real', k: 'S0' },
      { rot: 'diferença', k: 'dS' },
      { rot: 'natureza do extremo', k: 'hmax' },
      { rot: '⟨T⟩ do caminho real', k: 'Tm' },
      { rot: '⟨V⟩ do caminho real', k: 'Vm' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    /* caminho real: na gravidade, sobe e volta ao chão em T; na mola, um
       seno de amplitude 1 m. Em ambos os casos a deformação de prova se
       anula nas duas pontas, de modo que os extremos ficam fixos. */
    function real(t) {
      return est.pot === 'grav' ? g0 * t * (est.T - t) / 2 : Math.sin(W * t);
    }
    function pot(y) { return est.pot === 'grav' ? g0 * y : 0.5 * W * W * y * y; }
    function prova(a, t) { return real(t) + a * Math.sin(Math.PI * t / est.T); }
    function vel(a, t) {
      return (prova(a, t + 1e-5) - prova(a, t - 1e-5)) / 2e-5;
    }
    function acao(a) {
      var N = 1200, s = 0;
      for (var i = 0; i < N; i++) {
        var t = (i + 0.5) * est.T / N, v = vel(a, t);
        s += (0.5 * v * v - pot(prova(a, t))) * est.T / N;
      }
      return s;
    }
    function medias() {
      var N = 1200, cT = 0, cV = 0;
      for (var i = 0; i < N; i++) {
        var t = (i + 0.5) * est.T / N, v = vel(0, t);
        cT += 0.5 * v * v / N; cV += pot(prova(0, t)) / N;
      }
      return [cT, cV];
    }
    /* sinal da segunda variação ao longo da deformação escolhida */
    function tipoExtremo() {
      var h = 0.02;
      return acao(h) + acao(-h) - 2 * acao(0) > 0 ? 'mínimo' : 'ponto de sela';
    }

    function desenhar() {
      var alt = 330;
      var p = G.preparar(cv, alt), ct = p.ct, Lp = p.L;
      ct.clearRect(0, 0, Lp, alt);
      var meia = Lp * 0.52;

      var hmax = 0;
      for (var k0 = 0; k0 <= 60; k0++) {
        hmax = Math.max(hmax, Math.abs(prova(est.a, k0 * est.T / 60)),
          Math.abs(real(k0 * est.T / 60)));
      }
      var g1 = G.eixos(cv, {
        altura: alt, xmin: 0, xmax: est.T,
        ymin: est.pot === 'grav' ? -hmax * 0.3 - 0.1 : -hmax * 1.3 - 0.1,
        ymax: hmax * 1.35 + 0.1,
        rotX: 't (s)', rotY: 'altura (m)',
        marcasX: G.marcasLineares(0, est.T, 5, 1),
        formataY: function (v) { return F.fmt(v, 1); },
        limpar: false, margem: { e: 56, d: Lp - meia + 10, c: 16, b: 40 }
      });
      G.curva(g1, function (t) { return real(t); }, G.COR.bronze, 2.4, [6, 4]);
      G.curva(g1, function (t) { return prova(est.a, t); }, G.COR.mestra, 2.8);
      G.legenda(g1, [
        { texto: 'caminho real', cor: G.COR.bronze },
        { texto: 'caminho de prova', cor: G.COR.mestra }
      ]);

      if (est.modo === 'acao') {
        var sm = acao(0), sa = acao(-1), sb = acao(1);
        var s1 = Math.max(sa, sb, sm), s2 = Math.min(sa, sb, sm);
        var folga = (s1 - s2) * 0.14 + 0.01;
        var g2 = G.eixos(cv, {
          altura: alt, xmin: -1, xmax: 1,
          ymin: s2 - folga, ymax: s1 + folga,
          rotX: 'deformação a', rotY: 'S (J·s por kg)',
          marcasX: G.marcasLineares(-1, 1, 5, 1),
          formataY: function (v) { return F.fmt(v, 2); },
          limpar: false, margem: { e: meia + 60, d: 16, c: 16, b: 40 }
        });
        G.curva(g2, acao, G.COR.mestra, 2.6);
        G.vertical(g2, est.a, G.COR.suave, '', true);
        var c2 = g2.ct;
        c2.beginPath(); c2.arc(g2.X(0), g2.Y(sm), 5.5, 0, 2 * Math.PI);
        c2.fillStyle = G.COR.bronze; c2.fill();
        var ac = tipoExtremo();
        rotulo(c2, 'a = 0: o caminho real (' + ac + ')',
          g2.X(0), g2.Y(sm) + (ac === 'mínimo' ? -18 : 20), G.COR.bronze);
      } else {
        var emax = 0;
        for (var i = 0; i <= 40; i++) {
          var t = i * est.T / 40, v = vel(est.a, t);
          emax = Math.max(emax, 0.5 * v * v + pot(prova(est.a, t)));
        }
        var g3 = G.eixos(cv, {
          altura: alt, xmin: 0, xmax: est.T, ymin: 0, ymax: emax * 1.2,
          rotX: 't (s)', rotY: 'energia por kg (J/kg)',
          marcasX: G.marcasLineares(0, est.T, 5, 1),
          formataY: function (v) { return F.fmt(v, 0); },
          limpar: false, margem: { e: meia + 60, d: 16, c: 16, b: 40 }
        });
        G.curva(g3, function (t) {
          var v = vel(est.a, t); return 0.5 * v * v;
        }, G.COR.azul, 2.2);
        G.curva(g3, function (t) { return pot(prova(est.a, t)); }, G.COR.bronze, 2.2);
        G.curva(g3, function (t) {
          var v = vel(est.a, t); return 0.5 * v * v + pot(prova(est.a, t));
        }, G.COR.vinho, 2.8);
        G.legenda(g3, [
          { texto: 'T', cor: G.COR.azul },
          { texto: 'V', cor: G.COR.bronze },
          { texto: 'T + V', cor: G.COR.vinho }
        ]);
      }

      var md = medias();
      mostrar({
        S: F.fmt(acao(est.a), 4),
        S0: F.fmt(acao(0), 4),
        dS: (acao(est.a) > acao(0) ? '+' : '') + F.fmt(acao(est.a) - acao(0), 4),
        hmax: tipoExtremo(),
        Tm: F.fmt(md[0], 2) + ' J/kg',
        Vm: F.fmt(md[1], 2) + ' J/kg'
      });

      nota.innerHTML =
        '<p>Dois estados, dois instantes, e entre eles cabe qualquer história imaginável. O '
        + 'princípio de Hamilton associa a cada uma delas um número, a '
        + '<strong>ação</strong>:</p>'
        + '\\[\\Acao[q]=\\int_{t_1}^{t_2}\\Lag\\,dt,\\qquad\\Lag=T-V.\\]'
        + '<p>O deslizante deforma o caminho sem mexer nas pontas, e o segundo painel desenha '
        + '\\(\\Acao\\) contra essa deformação. O ponto \\(a=0\\) é sempre estacionário, e é '
        + 'ali que está o caminho que o sistema de fato percorre. Nenhuma lei de força foi '
        + 'imposta: a trajetória <em>saiu</em> da condição de extremo.</p>'
        + '<p>Na queda livre, \\(\\Lag=\\tfrac12m\\dot y^2-mgy\\), de modo que '
        + '\\(\\partial\\Lag/\\partial\\dot y=m\\dot y\\) e \\(\\partial\\Lag/\\partial y=-mg\\). '
        + 'A equação de Euler-Lagrange devolve</p>'
        + '\\[\\der{}{t}\\left(m\\dot y\\right)+mg=0\\qquad\\Longrightarrow\\qquad\\ddot y=-g,\\]'
        + '<p>que é a segunda lei de Newton. Na mola, com '
        + '\\(\\Lag=\\tfrac12m\\dot y^2-\\tfrac12m\\omega^2y^2\\), a mesma equação dá '
        + '\\(\\ddot y=-\\omega^2y\\). O princípio de Hamilton e as equações de Newton dizem a '
        + 'mesma coisa, e a diferença está em como dizem: uma fala de forças instante a '
        + 'instante, a outra fala do caminho inteiro de uma vez.</p>'
        + '<p>A vista de energia mostra por que o integrando é \\(T-V\\) e não \\(T+V\\). A '
        + 'energia total é constante ao longo do caminho real, e um funcional construído com '
        + 'ela não distinguiria caminho nenhum. É a <em>diferença</em> que carrega a '
        + 'informação dinâmica.</p>'
        + '<p>Agora a ressalva que a literatura costuma atropelar: a ação é '
        + '<strong>estacionária</strong>, e não necessariamente mínima. Na queda livre o '
        + 'potencial é linear em \\(y\\), a segunda variação vale '
        + '\\(\\int\\dot\\eta^2dt>0\\) e o caminho real é sempre mínimo, por mais longo que '
        + 'seja o percurso. Troque para o oscilador e aumente a duração: com '
        + '\\(\\eta=\\sen(\\pi t/T)\\) a segunda variação vale</p>'
        + '\\[\\delta^2\\Acao=\\frac{T}{2}\\left[\\left(\\frac{\\pi}{T}\\right)^2'
        + '-\\omega^2\\right],\\]'
        + '<p>que muda de sinal em \\(T=\\pi/\\omega\\), isto é, em meio período. Passado esse '
        + 'ponto, o caminho real continua estacionário e deixa de ser mínimo: o cartão da '
        + 'natureza do extremo acusa a troca. Com \\(\\omega=2\\) rad/s isso acontece em '
        + 'T = 1,57 s. O nome "princípio da mínima ação" é, nesse sentido, uma imprecisão '
        + 'consagrada.</p>';
      tipografar(corpo);
    }

    registrarRedesenho(desenhar);
  };

  /* =================================================================
     32. Newton contra Lagrange no pêndulo simples
     Mostra lado a lado o que cada formulação precisa escrever: a
     decomposição com a tração de um lado, uma linha de álgebra do
     outro. Integra a equação não-linear e compara com a linearizada.
     ================================================================= */
  REGISTRO.pendulolag = function (raiz) {
    var g0 = 9.80665;
    var est = { th0: 50, L: 1, t: 0, rodando: true };

    var corpo = moldura(raiz, 'O pêndulo: com tração e sem tração');

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'amplitude inicial', 5, 170, 1, 50,
      function (v) { est.th0 = v; est.t = 0; }, function (v) { return v + '°'; });
    deslizante(ctr, 'comprimento do fio', 0.3, 2, 0.05, 1,
      function (v) { est.L = v; est.t = 0; },
      function (v) { return F.fmt(v, 2) + ' m'; });

    var mostrar = cartoes(corpo, [
      { rot: 'período linearizado', k: 'T0' },
      { rot: 'período exato', k: 'Tex' },
      { rot: 'erro da linearização', k: 'err' },
      { rot: 'tração no ponto mais baixo', k: 'Tb' },
      { rot: 'tração no extremo', k: 'Te' },
      { rot: 'momento conjugado p_θ', k: 'p' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    /* período exato pela integral elíptica completa, por média
       aritmético-geométrica: T = 2π/agm(1, cos(θ0/2)) · √(L/g) */
    function periodoExato(th0, L) {
      var a = 1, b = Math.cos(th0 / 2);
      for (var i = 0; i < 40; i++) {
        var a2 = (a + b) / 2, b2 = Math.sqrt(a * b);
        a = a2; b = b2;
      }
      return 2 * Math.PI / a * Math.sqrt(L / g0);
    }
    /* integra θ'' = −(g/L) sen θ por Runge-Kutta 4 */
    function trajetoria(th0, L, T, N) {
      var h = T / N, th = th0, w = 0, saida = [[0, th0, 0]];
      function f(y) { return [y[1], -g0 / L * Math.sin(y[0])]; }
      var y = [th, w];
      for (var i = 1; i <= N; i++) {
        var k1 = f(y);
        var k2 = f([y[0] + h / 2 * k1[0], y[1] + h / 2 * k1[1]]);
        var k3 = f([y[0] + h / 2 * k2[0], y[1] + h / 2 * k2[1]]);
        var k4 = f([y[0] + h * k3[0], y[1] + h * k3[1]]);
        y = [y[0] + h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
             y[1] + h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])];
        saida.push([i * h, y[0], y[1]]);
      }
      return saida;
    }

    var cacheK = null, cacheV = null;
    function traj() {
      var k = est.th0 + ':' + est.L;
      if (k !== cacheK) {
        var Tex = periodoExato(est.th0 * Math.PI / 180, est.L);
        cacheV = { T: Tex, pts: trajetoria(est.th0 * Math.PI / 180, est.L, 2 * Tex, 1200) };
        cacheK = k;
      }
      return cacheV;
    }

    function desenhar() {
      var alt = 330;
      var p = G.preparar(cv, alt), ct = p.ct, Lp = p.L;
      ct.clearRect(0, 0, Lp, alt);
      var meia = Lp * 0.44;

      var tj = traj(), Tex = tj.T;
      var idx = Math.min(tj.pts.length - 1,
        Math.floor(est.t / (2 * Tex) * (tj.pts.length - 1)));
      var th = tj.pts[idx][1], w = tj.pts[idx][2];

      /* painel 1: o pêndulo, com as forças que Newton obriga a escrever */
      var px = meia * 0.5, py = 44;
      var Rp = Math.min(alt - 120, meia * 0.42);
      var bx = px + Rp * Math.sin(th), by = py + Rp * Math.cos(th);

      ct.beginPath(); ct.moveTo(px, py); ct.lineTo(px, py + Rp + 26);
      ct.strokeStyle = G.COR.grade; ct.lineWidth = 1.4;
      ct.setLineDash([5, 4]); ct.stroke(); ct.setLineDash([]);

      ct.beginPath(); ct.moveTo(px, py); ct.lineTo(bx, by);
      ct.strokeStyle = G.COR.tinta; ct.lineWidth = 2.4; ct.stroke();
      ct.beginPath(); ct.arc(px, py, 4, 0, 2 * Math.PI);
      ct.fillStyle = G.COR.tinta; ct.fill();

      /* tração e peso, decompostos */
      var trac = (3 * Math.cos(th) - 2 * Math.cos(est.th0 * Math.PI / 180));
      var esc = 42;
      seta(ct, bx, by, bx + (px - bx) / Rp * esc * Math.max(trac, 0.05),
        by + (py - by) / Rp * esc * Math.max(trac, 0.05), G.COR.vinho, 2.4);
      rotulo(ct, 'T', bx + (px - bx) / Rp * esc * trac - 14,
        by + (py - by) / Rp * esc * trac, G.COR.vinho, 'right');
      seta(ct, bx, by, bx, by + esc, G.COR.tinta, 2.4);
      rotulo(ct, 'mg', bx + 14, by + esc * 0.6, G.COR.tinta, 'left');
      /* a componente tangencial do peso, que é a única que move */
      seta(ct, bx, by, bx - esc * Math.cos(th) * Math.sin(th),
        by + esc * Math.cos(th) * Math.cos(th), G.COR.bronze, 2);
      rotulo(ct, 'mg sen θ', bx - esc * Math.cos(th) * Math.sin(th) - 8,
        by + esc * Math.cos(th) * Math.cos(th) + 16, G.COR.bronze, 'right');

      ct.beginPath(); ct.arc(bx, by, 10, 0, 2 * Math.PI);
      ct.fillStyle = G.COR.mestra; ct.fill();
      ct.strokeStyle = '#fff'; ct.lineWidth = 2; ct.stroke();

      rotulo(ct, 'θ = ' + F.fmt(th * 180 / Math.PI, 1) + '°', px, py - 24, G.COR.suave);
      rotulo(ct, 'Newton precisa das duas forças e da decomposição',
        12, alt - 14, G.COR.suave, 'left');

      /* painel 2: θ(t), exato contra linearizado */
      var A = est.th0 * Math.PI / 180, w0 = Math.sqrt(g0 / est.L);
      var g2 = G.eixos(cv, {
        altura: alt, xmin: 0, xmax: 2 * Tex,
        ymin: -A * 1.25 * 180 / Math.PI, ymax: A * 1.25 * 180 / Math.PI,
        rotX: 't (s)', rotY: 'θ (graus)',
        marcasX: G.marcasLineares(0, 2 * Tex, 5, 1),
        formataY: function (v) { return F.fmt(v, 0); },
        limpar: false, margem: { e: meia + 60, d: 16, c: 16, b: 40 }
      });
      G.curva(g2, function (t) {
        return A * Math.cos(w0 * t) * 180 / Math.PI;
      }, G.COR.bronze, 2.2, [6, 4]);
      var c2 = g2.ct;
      c2.beginPath();
      tj.pts.forEach(function (q, i) {
        var X = g2.X(q[0]), Y = g2.Y(q[1] * 180 / Math.PI);
        (i ? c2.lineTo : c2.moveTo).call(c2, X, Y);
      });
      c2.strokeStyle = G.COR.mestra; c2.lineWidth = 2.6; c2.stroke();
      G.legenda(g2, [
        { texto: 'exato', cor: G.COR.mestra },
        { texto: 'linearizado', cor: G.COR.bronze }
      ]);
      c2.beginPath();
      c2.arc(g2.X(tj.pts[idx][0]), g2.Y(th * 180 / Math.PI), 5, 0, 2 * Math.PI);
      c2.fillStyle = G.COR.roxo; c2.fill();

      var T0 = 2 * Math.PI / w0;
      var m = 1;
      mostrar({
        T0: F.fmt(T0, 4) + ' s',
        Tex: F.fmt(Tex, 4) + ' s',
        err: F.pct((Tex - T0) / T0, 2),
        Tb: F.fmt(m * g0 * (3 - 2 * Math.cos(A)), 3) + ' N por kg',
        Te: F.fmt(m * g0 * Math.cos(A), 3) + ' N por kg',
        p: F.fmt(m * est.L * est.L * w, 4) + ' kg·m²/s'
      });

      nota.innerHTML =
        '<p>Pela via de Newton é preciso escrever as duas forças que agem na massa, a tração '
        + '\\(\\vet{T}\\) e o peso \\(m\\vet{g}\\), projetar na direção tangencial, projetar '
        + 'na radial, e só então reconhecer que a equação radial serve apenas para determinar '
        + '\\(T\\). A tração é uma incógnita a mais, e ela aparece porque o fio é um '
        + '<strong>vínculo</strong>.</p>'
        + '<p>Pela via de Lagrange escolhe-se \\(\\theta\\), que já respeita o vínculo por '
        + 'construção. Com \\(x=\\ell\\sen\\theta\\) e \\(y=-\\ell\\cos\\theta\\),</p>'
        + '\\[T=\\tfrac12m\\left(\\dot x^2+\\dot y^2\\right)'
        + '=\\tfrac12m\\ell^2\\dot\\theta^2,\\qquad V=-mg\\ell\\cos\\theta,\\]'
        + '<p>de modo que \\(\\Lag=\\tfrac12m\\ell^2\\dot\\theta^2+mg\\ell\\cos\\theta\\). '
        + 'Daí</p>'
        + '\\[\\pder{\\Lag}{\\dot\\theta}=m\\ell^2\\dot\\theta,\\qquad'
        + '\\pder{\\Lag}{\\theta}=-mg\\ell\\sen\\theta'
        + '\\qquad\\Longrightarrow\\qquad'
        + '\\ddot\\theta+\\frac{g}{\\ell}\\sen\\theta=0.\\]'
        + '<p>A tração não aparece em lugar nenhum. Esse é o ganho central do formalismo: '
        + 'forças de vínculo que não realizam trabalho somem da conta quando as coordenadas '
        + 'já incorporam o vínculo. Se a tração for de fato necessária, há como recuperá-la, '
        + 'e o método está na seção dos multiplicadores.</p>'
        + '<p>O momento conjugado a \\(\\theta\\) vale '
        + '\\(p_\\theta=\\partial\\Lag/\\partial\\dot\\theta=m\\ell^2\\dot\\theta\\), que é o '
        + '<em>momento angular</em> em relação ao pivô. Momento conjugado não é sempre massa '
        + 'vezes velocidade: é o que a derivada da lagrangiana produzir, e as unidades '
        + 'acompanham a coordenada escolhida.</p>'
        + '<p>O segundo painel integra a equação completa e compara com a linearização '
        + '\\(\\sen\\theta\\simeq\\theta\\). Para amplitudes pequenas as duas curvas se '
        + 'confundem; aumentando a amplitude, o período exato cresce, porque a força '
        + 'restauradora fica proporcionalmente mais fraca longe do fundo. A '
        + '' + F.fmt(est.th0, 0) + '° o erro da fórmula elementar já é de '
        + F.pct((Tex - T0) / T0, 2) + '.</p>';
      tipografar(corpo);
    }

    registrarRedesenho(function () { desenhar(); });
    (function animar() {
      if (est.rodando) {
        est.t += 1 / 60;
        if (est.t > 2 * traj().T) est.t = 0;
        desenhar();
      }
      requestAnimationFrame(animar);
    })();
  };

  /* =================================================================
     33. Estacionar de ré: um vínculo não-holônomo
     O carro só anda na direção para onde aponta, e mesmo assim chega a
     qualquer lugar. É a diferença entre restringir velocidades e
     restringir configurações.
     ================================================================= */
  REGISTRO.estacionar = function (raiz) {
    var est = { s: 0, rodando: true };

    var corpo = moldura(raiz, 'Estacionar de ré: por que um vínculo de velocidade não tira grau de liberdade');

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    var sl = deslizante(ctr, 'manobra', 0, 1, 0.005, 0,
      function (v) { est.s = v; est.rodando = false; desenhar(); },
      function (v) { return F.pct(v, 0); });
    var bt = el('button', { type: 'button', texto: 'repetir a manobra' });
    bt.addEventListener('click', function () { est.s = 0; est.rodando = true; });
    ctr.appendChild(bt);

    var mostrar = cartoes(corpo, [
      { rot: 'coordenadas do carro', k: 'n' },
      { rot: 'vínculo', k: 'v' },
      { rot: 'tipo', k: 't' },
      { rot: 'graus de liberdade', k: 'gl' },
      { rot: 'deslocamento lateral obtido', k: 'd' },
      { rot: 'ângulo final', k: 'a' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    /* A manobra de baliza: dois arcos de ré, de curvatura oposta e mesmo
       comprimento. O primeiro gira o carro para dentro da vaga, o segundo
       desfaz o giro. O resultado é translação pura, apesar de o carro
       jamais ter andado de lado.
         fase 1:  dθ = +ds/R,  fase 2:  dθ = −ds/R, ambas em marcha a ré
       Integrando, x = −2R sen Δ e y = −2R(1 − cos Δ), com θ final nulo. */
    var RG = 1.25, DG = 0.78;          // raio de giro e guinada máxima (rad)
    function pose(s) {
      var x = 0, y = 0, th = 0;
      var N = 600, passos = Math.max(0, Math.round(s * N));
      var arco = RG * DG, ds = 2 * arco / N;
      for (var i = 0; i < passos; i++) {
        var curv = i < N / 2 ? -1 / RG : 1 / RG;
        th += curv * ds * -1;
        x += Math.cos(th) * ds * -1;
        y += Math.sin(th) * ds * -1;
      }
      return [x, y, th];
    }

    function desenhar() {
      var alt = 320;
      var p = G.preparar(cv, alt), ct = p.ct, Lp = p.L;
      ct.clearRect(0, 0, Lp, alt);

      var pf = pose(1), p0 = pose(0);
      var esc = Math.min(Lp / 5.6, alt / 2.4);
      var ox = Lp * 0.5 - (p0[0] + pf[0]) / 2 * esc;
      var oy = alt * 0.46 + (p0[1] + pf[1]) / 2 * esc;
      function X(u) { return ox + u * esc; }
      function Y(u) { return oy - u * esc; }

      var compr = 0.80, larg = 0.40;      // o carro, em unidades de mundo

      /* Onde pôr os carros parados: não basta medir a partir do destino,
         porque durante a manobra o carro gira e varre bem mais espaço do
         que ocupa parado. Percorremos a manobra inteira, tomamos os cantos
         do carro em cada instante e deixamos os vizinhos fora desse
         envelope, com uma folga. */
      function cantos(qq) {
        var c = Math.cos(qq[2]), sn = Math.sin(qq[2]);
        var lista = [];
        [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (sg) {
          var dx = sg[0] * compr / 2, dy = sg[1] * larg / 2;
          lista.push([qq[0] + dx * c - dy * sn, qq[1] + dx * sn + dy * c]);
        });
        return lista;
      }
      var xmin = Infinity, xmax = -Infinity;
      for (var kv = 0; kv <= 60; kv++) {
        cantos(pose(kv / 60)).forEach(function (c) {
          if (c[0] < xmin) xmin = c[0];
          if (c[0] > xmax) xmax = c[0];
        });
      }
      var folga = 0.10;
      var xTras = xmax + compr / 2 + folga;     // o que fica atrás da vaga
      var xFrente = xmin - compr / 2 - folga;   // o que fica à frente

      /* o meio-fio e os dois carros estacionados, posicionados em torno
         da vaga para onde a manobra leva */
      var ymf = pf[1] - larg * 0.72;
      ct.beginPath();
      ct.moveTo(0, Y(ymf)); ct.lineTo(Lp, Y(ymf));
      ct.strokeStyle = G.COR.tinta; ct.lineWidth = 2.4; ct.stroke();
      ct.fillStyle = 'rgba(27,31,36,.06)';
      ct.fillRect(0, Y(ymf), Lp, alt);
      rotulo(ct, 'meio-fio', Lp - 12, Y(ymf) + 16, G.COR.suave, 'right');

      function carro(q, cor, contorno) {
        ct.save();
        ct.translate(X(q[0]), Y(q[1]));
        ct.rotate(-q[2]);
        var w = compr * esc, h = larg * esc, r = 6;
        ct.beginPath();
        ct.moveTo(-w / 2 + r, -h / 2);
        ct.arcTo(w / 2, -h / 2, w / 2, h / 2, r);
        ct.arcTo(w / 2, h / 2, -w / 2, h / 2, r);
        ct.arcTo(-w / 2, h / 2, -w / 2, -h / 2, r);
        ct.arcTo(-w / 2, -h / 2, w / 2, -h / 2, r);
        ct.closePath();
        ct.fillStyle = cor; ct.fill();
        if (contorno) { ct.strokeStyle = contorno; ct.lineWidth = 1.6; ct.stroke(); }
        ct.fillStyle = 'rgba(255,255,255,.5)';
        ct.fillRect(-w * 0.06, -h / 2 + 3, w * 0.26, h - 6);
        ct.restore();
      }

      carro([xFrente, pf[1], 0], 'rgba(27,31,36,.17)');
      carro([xTras, pf[1], 0], 'rgba(27,31,36,.17)');

      /* a vaga, entre os dois */
      ct.strokeStyle = G.COR.clara; ct.lineWidth = 1.6;
      ct.setLineDash([6, 5]);
      ct.strokeRect(X(xFrente + compr / 2), Y(pf[1] + larg * 0.70),
        (xTras - xFrente - compr) * esc, larg * 1.40 * esc);
      ct.setLineDash([]);

      /* o rastro já percorrido */
      ct.beginPath();
      for (var i = 0; i <= 200; i++) {
        var q = pose(est.s * i / 200);
        (i ? ct.lineTo : ct.moveTo).call(ct, X(q[0]), Y(q[1]));
      }
      ct.strokeStyle = G.COR.bronze; ct.lineWidth = 2;
      ct.setLineDash([5, 4]); ct.stroke(); ct.setLineDash([]);

      carro(p0, 'rgba(23,107,93,.16)', G.COR.clara);
      var qa = pose(est.s);
      carro(qa, G.COR.mestra);

      /* a direção permitida e a proibida */
      seta(ct, X(qa[0]), Y(qa[1]),
        X(qa[0]) + Math.cos(qa[2]) * 0.62 * esc,
        Y(qa[1]) - Math.sin(qa[2]) * 0.62 * esc, G.COR.vinho, 2.2);
      rotulo(ct, 'única direção possível',
        X(qa[0]) + Math.cos(qa[2]) * 0.70 * esc + 10,
        Y(qa[1]) - Math.sin(qa[2]) * 0.70 * esc + 16, G.COR.vinho, 'left');
      ct.save();
      ct.strokeStyle = G.COR.bronze; ct.lineWidth = 2;
      ct.setLineDash([4, 4]);
      ct.beginPath();
      ct.moveTo(X(qa[0]), Y(qa[1]));
      ct.lineTo(X(qa[0]) - Math.sin(qa[2]) * 0.5 * esc,
        Y(qa[1]) - Math.cos(qa[2]) * 0.5 * esc);
      ct.stroke(); ct.setLineDash([]); ct.restore();
      rotulo(ct, 'direção proibida', X(qa[0]) - Math.sin(qa[2]) * 0.52 * esc - 12,
        Y(qa[1]) - Math.cos(qa[2]) * 0.52 * esc - 10, G.COR.bronze, 'right');

      rotulo(ct, 'dois arcos de ré, curvaturas opostas', 12, 16, G.COR.suave, 'left');

      var fim = pose(est.s);
      mostrar({
        n: 'x, y e θ: três',
        v: 'ẋ sen θ = ẏ cos θ',
        t: 'não-holônomo',
        gl: '2 de controle, 3 de configuração',
        d: F.fmt(Math.abs(fim[1]) / 0.8, 3) + ' comprimentos de carro',
        a: F.fmt(fim[2] * 180 / Math.PI, 1) + '° (volta ao inicial)'
      });

      nota.innerHTML =
        '<p>A configuração de um carro sobre o plano precisa de três números: a posição '
        + '\\(x\\), a posição \\(y\\) e a orientação \\(\\theta\\). Mas o carro não anda de '
        + 'lado: a velocidade é sempre paralela ao eixo longitudinal, o que impõe</p>'
        + '\\[\\dot x\\,\\sen\\theta-\\dot y\\,\\cos\\theta=0.\\]'
        + '<p>Esse vínculo relaciona <em>velocidades</em>, e não coordenadas. Não existe '
        + 'função \\(g(x,y,\\theta)\\) cuja derivada total reproduza a relação acima, e por '
        + 'isso ele é <strong>não-holônomo</strong>: não pode ser integrado.</p>'
        + '<p>A consequência é a que a manobra mostra. O carro tem apenas dois controles '
        + '(acelerar e esterçar) e mesmo assim alcança qualquer uma das três coordenadas de '
        + 'configuração. Combinando avanços e marchas a ré com esterços opostos, ele se '
        + 'desloca <strong>lateralmente</strong> sem nunca andar de lado, e volta à '
        + 'orientação inicial. Nenhuma configuração foi eliminada: o vínculo restringe os '
        + 'caminhos, não o destino.</p>'
        + '<p>Compare com um vínculo <strong>holônomo</strong>, como uma conta enfiada num '
        + 'aro de raio \\(R\\). Ali vale \\(x^2+y^2=R^2\\), uma relação entre coordenadas, e o '
        + 'espaço de configuração encolhe de dois para um: a conta jamais sai do aro. '
        + 'Holônomo elimina configurações; não-holônomo apenas proíbe direções '
        + 'instantâneas.</p>'
        + '<p>A diferença tem consequência prática no formalismo. Vínculos holônomos se '
        + 'resolvem escolhendo coordenadas generalizadas que já os respeitam, e aí o problema '
        + 'fica com menos equações. Vínculos não-holônomos não permitem essa eliminação, e '
        + 'exigem multiplicadores de Lagrange, com uma equação extra para cada vínculo.</p>';
      tipografar(corpo);
    }

    registrarRedesenho(desenhar);
    (function animar() {
      if (est.rodando) {
        est.s += 0.004;
        if (est.s > 1) { est.s = 0; }
        sl.value = String(est.s);
        desenhar();
      }
      requestAnimationFrame(animar);
    })();
  };

  /* =================================================================
     34. Multiplicadores: a força de vínculo de volta
     Partícula sobre a esfera e sobre o parabolóide. O multiplicador
     deixa de ser truque algébrico e vira a normal medida em newtons.
     ================================================================= */
  REGISTRO.multiplicador = function (raiz) {
    var g0 = 9.80665;
    var est = { caso: 'esfera', v: 4, pos: 35 };

    var corpo = moldura(raiz, 'O multiplicador de Lagrange é a força de vínculo');

    var c0 = el('div', { class: 'controles' });
    corpo.appendChild(c0);
    opcoes(c0, [
      { rot: 'conta na esfera', v: 'esfera' },
      { rot: 'conta no parabolóide', v: 'parab' }
    ], 0, function (v) { est.caso = v; desenhar(); });

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'rapidez da partícula', 0.5, 9, 0.1, 4,
      function (v) { est.v = v; desenhar(); },
      function (v) { return F.fmt(v, 1) + ' m/s'; });
    deslizante(ctr, 'posição sobre a superfície', 0, 80, 1, 35,
      function (v) { est.pos = v; desenhar(); },
      function (v) { return v + '%'; });

    var mostrar = cartoes(corpo, [
      { rot: 'vínculo g = 0', k: 'g' },
      { rot: 'gradiente ∇g', k: 'gr' },
      { rot: 'multiplicador λ', k: 'lam' },
      { rot: 'força de vínculo |λ∇g|', k: 'F' },
      { rot: 'comparação clássica', k: 'cl' },
      { rot: 'direção', k: 'dir' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    var R = 1.6;                      // raio da esfera, em metros
    function desenhar() {
      var alt = 320;
      var p = G.preparar(cv, alt), ct = p.ct, Lp = p.L;
      ct.clearRect(0, 0, Lp, alt);

      var esc = Math.min(Lp * 0.125, alt * 0.26);
      var ox = Lp * 0.22, oy = alt * 0.60;
      function X(u) { return ox + u * esc; }
      function Y(u) { return oy - u * esc; }

      var ang = (est.pos / 100) * Math.PI;    // 0 no topo
      var P, N, lam, Fv, clas;
      if (est.caso === 'esfera') {
        /* corte da esfera */
        ct.beginPath(); ct.arc(X(0), Y(0), R * esc, 0, 2 * Math.PI);
        ct.fillStyle = 'rgba(123,184,171,.18)'; ct.fill();
        ct.strokeStyle = G.COR.mestra; ct.lineWidth = 2.4; ct.stroke();
        P = [R * Math.sin(ang), R * Math.cos(ang)];
        N = [P[0] / R, P[1] / R];
        lam = -1 * est.v * est.v / (2 * R * R);             // por unidade de massa
        Fv = est.v * est.v / R;
        clas = 'mv²/R = ' + F.fmt(Fv, 3) + ' N por kg';
      } else {
        /* corte do parabolóide z = x² */
        ct.beginPath();
        for (var i = 0; i <= 120; i++) {
          var x = -1.9 + 3.8 * i / 120;
          (i ? ct.lineTo : ct.moveTo).call(ct, X(x), Y(x * x));
        }
        ct.strokeStyle = G.COR.mestra; ct.lineWidth = 2.4; ct.stroke();
        var xp = 1.9 * est.pos / 100;
        P = [xp, xp * xp];
        var nn = Math.hypot(-2 * xp, 1);
        N = [-2 * xp / nn, 1 / nn];
        lam = (2 * est.v * est.v + g0) / (1 + 4 * P[1]);
        Fv = lam * nn;
        clas = 'no vértice vale g = ' + F.fmt(g0, 2) + ' N por kg';
      }

      /* a partícula e as setas */
      ct.beginPath(); ct.arc(X(P[0]), Y(P[1]), 8, 0, 2 * Math.PI);
      ct.fillStyle = G.COR.tinta; ct.fill();
      /* na esfera a normal de vínculo aponta para dentro; no parabolóide,
         para fora, porque a superfície empurra a partícula para cima */
      var sN = 52, sinal = est.caso === 'esfera' ? -1 : 1;
      var qx = X(P[0]) + sinal * N[0] * sN, qy = Y(P[1]) - sinal * N[1] * sN;
      seta(ct, X(P[0]), Y(P[1]), qx, qy, G.COR.vinho, 2.6);
      rotulo(ct, 'λ∇g', qx + 16, qy, G.COR.vinho, 'left');
      seta(ct, X(P[0]), Y(P[1]), X(P[0]), Y(P[1]) + 44, G.COR.bronze, 2);
      rotulo(ct, 'peso', X(P[0]) - 14, Y(P[1]) + 30, G.COR.bronze, 'right');

      rotulo(ct, est.caso === 'esfera' ? 'corte da esfera' : 'corte do parabolóide',
        12, 16, G.COR.suave, 'left');

      /* painel 2: a força de vínculo ao longo da superfície */
      function forca(u) {
        if (est.caso === 'esfera') return est.v * est.v / R;
        var xu = 1.9 * u / 100, zu = xu * xu;
        return (2 * est.v * est.v + g0) / (1 + 4 * zu) * Math.hypot(-2 * xu, 1);
      }
      var fmax = 0;
      for (var k = 0; k <= 80; k++) fmax = Math.max(fmax, forca(k));
      fmax = fmax * 1.2 + 0.1;
      var g2 = G.eixos(cv, {
        altura: alt, xmin: 0, xmax: 80, ymin: 0, ymax: fmax,
        rotX: 'posição sobre a superfície (%)', rotY: 'força (N por kg)',
        marcasX: G.marcasLineares(0, 80, 5, 0),
        formataY: function (v) { return F.fmt(v, 1); },
        limpar: false, margem: { e: Lp * 0.56, d: 16, c: 16, b: 40 }
      });
      G.curva(g2, forca, G.COR.mestra, 2.6);
      G.vertical(g2, est.pos, G.COR.suave, '', true);

      mostrar({
        g: est.caso === 'esfera' ? 'x² + y² + z² − R² = 0' : 'z − x² − y² = 0',
        gr: est.caso === 'esfera' ? '2r, radial' : '(−2x, −2y, 1)',
        lam: F.fmt(lam, 4),
        F: F.fmt(Fv, 3) + ' N por kg',
        cl: clas,
        dir: est.caso === 'esfera' ? 'para dentro da esfera' : 'normal à superfície'
      });

      nota.innerHTML =
        '<p>Quando o vínculo é holônomo e escrito como \\(g=0\\), há duas saídas. A primeira '
        + 'é escolher coordenadas que já o respeitem, e então ele desaparece. A segunda é '
        + 'mantê-lo explícito com um <strong>multiplicador</strong>, somando-o à '
        + 'lagrangiana:</p>'
        + '\\[\\tilde\\Lag=\\Lag+\\lambda(t)\\,g\\left(x,y,z\\right).\\]'
        + '<p>Tratando \\(x\\), \\(y\\), \\(z\\) e \\(\\lambda\\) como independentes, as '
        + 'equações de Euler-Lagrange devolvem</p>'
        + '\\[m\\ddot{\\vet{r}}=\\vet{F}+\\lambda\\nabla g,\\]'
        + '<p>e a variação em \\(\\lambda\\) devolve o próprio vínculo. O termo extra é '
        + 'paralelo a \\(\\nabla g\\), que é normal à superfície: o multiplicador é, '
        + 'literalmente, a <strong>força de vínculo</strong>.</p>'
        + '<p>Na esfera, \\(g=x^2+y^2+z^2-R^2\\) e \\(\\nabla g=2\\vet{r}\\). Derivando o '
        + 'vínculo duas vezes no tempo vem \\(\\left|\\dot{\\vet{r}}\\right|^2'
        + '+\\vet{r}\\cdot\\ddot{\\vet{r}}=0\\), e substituindo a equação do movimento,</p>'
        + '\\[\\lambda=-\\frac{m}{2R^2}\\left|\\dot{\\vet{r}}\\right|^2'
        + '\\qquad\\Longrightarrow\\qquad'
        + '\\vet{F}_{\\rm vinc}=2\\lambda\\vet{r}=-\\frac{mv^2}{R}\\,\\vers{r}.\\]'
        + '<p>É exatamente a força centrípeta, com o módulo \\(mv^2/R\\) de sempre, apontando '
        + 'para dentro. A conta não supôs movimento circular em nenhum momento: ela saiu do '
        + 'formalismo.</p>'
        + '<p>No parabolóide \\(z=x^2+y^2\\) o resultado é mais rico, porque há gravidade. O '
        + 'mesmo procedimento dá</p>'
        + '\\[\\lambda=\\frac{m\\left[2\\left(\\dot x^2+\\dot y^2\\right)+g\\right]}{1+4z},\\]'
        + '<p>com duas parcelas de origem distinta: uma centrípeta, que cresce com a '
        + 'velocidade tangencial, e uma gravitacional, que sustenta o peso. As duas caem com '
        + 'a altura, porque a superfície vai ficando mais inclinada e a normal vai perdendo '
        + 'componente vertical. No vértice, com a partícula parada, sobra '
        + '\\(\\vet{F}=mg\\vers{z}\\): a normal de uma mesa horizontal.</p>';
      tipografar(corpo);
    }

    registrarRedesenho(desenhar);
  };

  /* =================================================================
     35. Coordenadas cíclicas: a órbita em coordenadas polares
     Phi não aparece na lagrangiana, logo p_phi se conserva. O widget
     integra a órbita e acompanha as duas quantidades.
     ================================================================= */
  REGISTRO.ciclica = function (raiz) {
    var est = { e: 0.5, t: 0, rodando: true };

    var corpo = moldura(raiz, 'Coordenada cíclica: φ não aparece, p_φ se conserva');

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'excentricidade da órbita', 0, 0.85, 0.01, 0.5,
      function (v) { est.e = v; est.t = 0; },
      function (v) { return F.fmt(v, 2); });

    var mostrar = cartoes(corpo, [
      { rot: 'momento p_r = m ṙ', k: 'pr' },
      { rot: 'momento p_φ = m r² φ̇', k: 'pf' },
      { rot: 'variação de p_φ no período', k: 'dpf' },
      { rot: 'distância atual r', k: 'r' },
      { rot: 'velocidade angular φ̇', k: 'w' },
      { rot: 'área varrida por unidade de tempo', k: 'A' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    /* órbita de Kepler com semieixo 1 e GM = 1: r = a(1−e²)/(1+e cos φ) */
    function raio(fi) { return (1 - est.e * est.e) / (1 + est.e * Math.cos(fi)); }
    var Lang = function () { return Math.sqrt(1 - est.e * est.e); };

    function desenhar() {
      var alt = 320;
      var p = G.preparar(cv, alt), ct = p.ct, Lp = p.L;
      ct.clearRect(0, 0, Lp, alt);

      /* avança φ com dφ/dt = L/r² */
      var fi = est.t;
      var esc = Math.min(Lp * 0.17, alt * 0.33) / (1 + est.e);
      var ox = Lp * 0.26 + est.e * esc, oy = alt * 0.52;
      function X(u) { return ox + u * esc; }
      function Y(u) { return oy - u * esc; }

      ct.beginPath();
      for (var i = 0; i <= 300; i++) {
        var f2 = i / 300 * 2 * Math.PI, r2 = raio(f2);
        (i ? ct.lineTo : ct.moveTo).call(ct, X(r2 * Math.cos(f2)), Y(r2 * Math.sin(f2)));
      }
      ct.closePath();
      ct.strokeStyle = G.COR.mestra; ct.lineWidth = 2.4; ct.stroke();

      var r = raio(fi), px = r * Math.cos(fi), py = r * Math.sin(fi);

      /* o setor varrido no último intervalo, que é sempre da mesma área */
      ct.beginPath();
      ct.moveTo(X(0), Y(0));
      for (var k = 0; k <= 30; k++) {
        var f3 = fi - 0.45 + 0.45 * k / 30, r3 = raio(f3);
        ct.lineTo(X(r3 * Math.cos(f3)), Y(r3 * Math.sin(f3)));
      }
      ct.closePath();
      ct.fillStyle = 'rgba(168,96,31,.22)'; ct.fill();

      ct.beginPath(); ct.moveTo(X(0), Y(0)); ct.lineTo(X(px), Y(py));
      ct.strokeStyle = G.COR.suave; ct.lineWidth = 1.4; ct.stroke();
      ct.beginPath(); ct.arc(X(0), Y(0), 7, 0, 2 * Math.PI);
      ct.fillStyle = G.COR.bronze; ct.fill();
      ct.beginPath(); ct.arc(X(px), Y(py), 7, 0, 2 * Math.PI);
      ct.fillStyle = G.COR.tinta; ct.fill();
      rotulo(ct, 'centro de força', X(0), Y(0) - 18, G.COR.bronze);
      rotulo(ct, 'setores de mesma área em tempos iguais', 12, alt - 14,
        G.COR.suave, 'left');

      /* painel 2: p_r e p_phi contra o tempo */
      var Lc = Lang();
      function pr(f) {
        var h = 1e-4;
        var rr1 = raio(f - h), rr2 = raio(f + h);
        var drdf = (rr2 - rr1) / (2 * h);
        return drdf * Lc / (raio(f) * raio(f));
      }
      var pmax = 0;
      for (var k2 = 0; k2 <= 60; k2++) {
        pmax = Math.max(pmax, Math.abs(pr(k2 / 60 * 2 * Math.PI)));
      }
      pmax = Math.max(pmax, Lc) * 1.25;
      var g2 = G.eixos(cv, {
        altura: alt, xmin: 0, xmax: 2 * Math.PI, ymin: -pmax, ymax: pmax,
        rotX: 'ângulo φ (rad)', rotY: 'momento (por unidade de massa)',
        marcasX: G.marcasLineares(0, 2 * Math.PI, 5, 1),
        formataY: function (v) { return F.fmt(v, 2); },
        limpar: false, margem: { e: Lp * 0.54, d: 16, c: 16, b: 40 }
      });
      G.curva(g2, function () { return Lc; }, G.COR.mestra, 2.8);
      G.curva(g2, pr, G.COR.vinho, 2.4);
      G.curva(g2, function () { return 0; }, G.COR.grade, 1.4);
      G.legenda(g2, [
        { texto: 'p_φ', cor: G.COR.mestra },
        { texto: 'p_r', cor: G.COR.vinho }
      ]);
      var fm = ((fi % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      G.vertical(g2, fm, G.COR.suave, '', true);

      mostrar({
        pr: F.fmt(pr(fi), 4),
        pf: F.fmt(Lc, 6),
        dpf: 'zero (é constante)',
        r: F.fmt(r, 4) + ' a',
        w: F.fmt(Lc / (r * r), 4) + ' rad por unidade de tempo',
        A: F.fmt(Lc / 2, 4) + ' (metade de p_φ)'
      });

      nota.innerHTML =
        '<p>Em coordenadas polares, uma partícula sob força central tem</p>'
        + '\\[\\Lag=\\tfrac12m\\left(\\dot r^2+r^2\\dot\\varphi^2\\right)-V(r).\\]'
        + '<p>Repare no que <em>não</em> está escrito: o ângulo \\(\\varphi\\) não aparece em '
        + 'lugar nenhum, só a sua derivada. Uma coordenada com essa propriedade chama-se '
        + '<strong>cíclica</strong>, e a equação de Lagrange para ela fica</p>'
        + '\\[\\der{}{t}\\left(\\pder{\\Lag}{\\dot\\varphi}\\right)=\\pder{\\Lag}{\\varphi}=0'
        + '\\qquad\\Longrightarrow\\qquad '
        + 'p_\\varphi=mr^2\\dot\\varphi=\\text{constante}.\\]'
        + '<p>O momento conjugado a \\(\\varphi\\) é o momento angular, e ele se conserva sem '
        + 'que seja preciso calcular torque nenhum: basta olhar para a lagrangiana e notar '
        + 'uma ausência. O segundo painel acompanha as duas quantidades ao longo da órbita. '
        + '\\(p_r\\) oscila, porque \\(r\\) é uma coordenada comum; \\(p_\\varphi\\) é uma '
        + 'reta horizontal.</p>'
        + '<p>A consequência geométrica é a segunda lei de Kepler. A área varrida pelo raio '
        + 'vetor por unidade de tempo vale \\(\\tfrac12r^2\\dot\\varphi=p_\\varphi/2m\\), que '
        + 'é constante: os setores desenhados em bronze têm todos a mesma área, mesmo sendo '
        + 'longos e finos no afélio e curtos e largos no periélio.</p>'
        + '<p>O padrão é geral, e o módulo 11 lhe dará nome. Toda coordenada ausente da '
        + 'lagrangiana corresponde a uma simetria, e toda simetria corresponde a uma '
        + 'quantidade conservada. Aqui a simetria é a invariância por rotação em torno do '
        + 'centro de força, e a quantidade é o momento angular; se \\(t\\) estiver ausente, a '
        + 'quantidade conservada é a energia.</p>';
      tipografar(corpo);
    }

    registrarRedesenho(desenhar);
    (function animar() {
      if (est.rodando) {
        var r = raio(est.t);
        est.t += 0.02 * Math.sqrt(1 - est.e * est.e) / (r * r);
        if (est.t > 2 * Math.PI) est.t -= 2 * Math.PI;
        desenhar();
      }
      requestAnimationFrame(animar);
    })();
  };

  /* =================================================================
     36. Euler-Poisson: a viga
     Um funcional com y'' produz equação de quarta ordem, e aqui ela é
     resolvida para as três condições de apoio usuais.
     ================================================================= */
  REGISTRO.viga = function (raiz) {
    var est = { apoio: 'biapoiada', q: 5, alfa: 0 };

    var corpo = moldura(raiz, 'Euler-Poisson: a linha elástica de uma viga');

    var c0 = el('div', { class: 'controles' });
    corpo.appendChild(c0);
    opcoes(c0, [
      { rot: 'biapoiada', v: 'biapoiada' },
      { rot: 'engastada nas duas pontas', v: 'biengastada' },
      { rot: 'em balanço', v: 'balanco' }
    ], 0, function (v) { est.apoio = v; desenhar(); });

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'carga uniforme q₀', 0, 12, 0.2, 5,
      function (v) { est.q = v; desenhar(); },
      function (v) { return F.fmt(v, 1) + ' kN/m'; });
    deslizante(ctr, 'crescimento linear da carga', 0, 10, 0.2, 0,
      function (v) { est.alfa = v; desenhar(); },
      function (v) { return F.fmt(v, 1) + ' kN/m²'; });

    var mostrar = cartoes(corpo, [
      { rot: 'equação', k: 'eq' },
      { rot: 'ordem do polinômio', k: 'ord' },
      { rot: 'condições de contorno', k: 'cc' },
      { rot: 'flecha máxima', k: 'fl' },
      { rot: 'posição da flecha', k: 'xf' },
      { rot: 'carga total sobre a viga', k: 'tot' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    var EI = 1200, Lv = 6;            // kN·m² e m

    /* y'''' = q(x)/EI, integrado quatro vezes e ajustado às condições */
    function solucao() {
      var q0 = est.q, al = est.alfa;
      function part(x) {
        return (q0 * Math.pow(x, 4) / 24 + al * Math.pow(x, 5) / 120) / EI;
      }
      function d1(x) { return (q0 * Math.pow(x, 3) / 6 + al * Math.pow(x, 4) / 24) / EI; }
      function d2(x) { return (q0 * x * x / 2 + al * Math.pow(x, 3) / 6) / EI; }
      function d3(x) { return (q0 * x + al * x * x / 2) / EI; }
      /* y = part + C1 x³/6 + C2 x²/2 + C3 x + C4, com quatro condições */
      var A = [], b = [];
      function linha(tipo, x) {
        if (tipo === 'y') return [x * x * x / 6, x * x / 2, x, 1];
        if (tipo === 'yl') return [x * x / 2, x, 1, 0];
        if (tipo === 'yll') return [x, 1, 0, 0];
        return [1, 0, 0, 0];
      }
      function valor(tipo, x) {
        if (tipo === 'y') return part(x);
        if (tipo === 'yl') return d1(x);
        if (tipo === 'yll') return d2(x);
        return d3(x);
      }
      var cond;
      if (est.apoio === 'biapoiada') {
        cond = [['y', 0], ['yll', 0], ['y', Lv], ['yll', Lv]];
      } else if (est.apoio === 'biengastada') {
        cond = [['y', 0], ['yl', 0], ['y', Lv], ['yl', Lv]];
      } else {
        cond = [['y', 0], ['yl', 0], ['yll', Lv], ['ylll', Lv]];
      }
      cond.forEach(function (c) {
        A.push(linha(c[0], c[1])); b.push(-valor(c[0], c[1]));
      });
      /* eliminação de Gauss 4x4 */
      for (var i = 0; i < 4; i++) {
        var piv = i;
        for (var r = i + 1; r < 4; r++) if (Math.abs(A[r][i]) > Math.abs(A[piv][i])) piv = r;
        var tA = A[i]; A[i] = A[piv]; A[piv] = tA;
        var tb = b[i]; b[i] = b[piv]; b[piv] = tb;
        for (var r2 = 0; r2 < 4; r2++) {
          if (r2 === i || Math.abs(A[i][i]) < 1e-14) continue;
          var f = A[r2][i] / A[i][i];
          for (var c2 = 0; c2 < 4; c2++) A[r2][c2] -= f * A[i][c2];
          b[r2] -= f * b[i];
        }
      }
      var C = [0, 0, 0, 0];
      for (var i2 = 0; i2 < 4; i2++) C[i2] = Math.abs(A[i2][i2]) < 1e-14 ? 0 : b[i2] / A[i2][i2];
      return function (x) {
        return part(x) + C[0] * x * x * x / 6 + C[1] * x * x / 2 + C[2] * x + C[3];
      };
    }

    function desenhar() {
      var y = solucao();
      var maxi = 0, xmaxi = 0;
      for (var i = 0; i <= 400; i++) {
        var x = Lv * i / 400;
        if (Math.abs(y(x)) > Math.abs(maxi)) { maxi = y(x); xmaxi = x; }
      }
      var amp = Math.abs(maxi) + 1e-9;
      var gr = G.eixos(cv, {
        altura: 300, xmin: 0, xmax: Lv,
        ymin: -amp * 1.5 - 0.001, ymax: amp * 0.6 + 0.001,
        rotX: 'posição ao longo da viga (m)', rotY: 'deflexão (m)',
        marcasX: G.marcasLineares(0, Lv, 6, 0),
        formataY: function (v) { return F.fmt(v, 3); }
      });
      G.curva(gr, function () { return 0; }, G.COR.grade, 1.6);
      G.curva(gr, function (x) { return -y(x); }, G.COR.mestra, 2.8);
      var ct = gr.ct;

      /* as setas da carga distribuída */
      for (var k = 0; k <= 12; k++) {
        var xk = Lv * k / 12;
        var qk = (est.q + est.alfa * xk) / Math.max(est.q + est.alfa * Lv, 0.1);
        if (qk <= 0.01) continue;
        seta(ct, gr.X(xk), gr.y0 + 6, gr.X(xk), gr.y0 + 6 + 26 * qk, G.COR.bronze, 1.6);
      }
      rotulo(ct, 'carga q(x)', gr.x0 + 6, gr.y0 + 44, G.COR.bronze, 'left');

      /* os apoios */
      function triangulo(x) {
        ct.beginPath();
        ct.moveTo(gr.X(x), gr.Y(0));
        ct.lineTo(gr.X(x) - 9, gr.Y(0) + 15);
        ct.lineTo(gr.X(x) + 9, gr.Y(0) + 15);
        ct.closePath(); ct.fillStyle = G.COR.tinta; ct.fill();
      }
      function engaste(x) {
        ct.fillStyle = G.COR.tinta;
        ct.fillRect(gr.X(x) - 5, gr.Y(0) - 18, 10, 36);
      }
      if (est.apoio === 'biapoiada') { triangulo(0); triangulo(Lv); }
      else if (est.apoio === 'biengastada') { engaste(0); engaste(Lv); }
      else { engaste(0); }

      ct.beginPath();
      ct.arc(gr.X(xmaxi), gr.Y(-maxi), 5, 0, 2 * Math.PI);
      ct.fillStyle = G.COR.vinho; ct.fill();

      mostrar({
        eq: 'EI y⁗ = q(x)',
        ord: est.alfa > 0 ? 'quinto grau' : 'quarto grau',
        cc: est.apoio === 'biapoiada' ? 'y = y″ = 0 nas duas pontas'
          : (est.apoio === 'biengastada' ? 'y = y′ = 0 nas duas pontas'
            : 'y = y′ = 0 à esquerda, y″ = y‴ = 0 à direita'),
        fl: F.fmt(Math.abs(maxi) * 1000, 2) + ' mm',
        xf: F.fmt(xmaxi, 2) + ' m',
        tot: F.fmt(est.q * Lv + est.alfa * Lv * Lv / 2, 1) + ' kN'
      });

      nota.innerHTML =
        '<p>A energia de uma viga de rigidez \\(EI\\) sob carga distribuída \\(q(x)\\) é a '
        + 'energia de flexão menos o trabalho da carga:</p>'
        + '\\[U[y]=\\int_0^{\\ell}\\left[\\tfrac12EI\\left(y\'\'\\right)^2-q(x)\\,y\\right]dx.\\]'
        + '<p>Aqui o integrando depende de \\(y\'\'\\), e a equação de Euler-Lagrange do '
        + 'módulo 8 não serve: é preciso integrar por partes <em>duas</em> vezes, o que '
        + 'introduz um termo com segunda derivada e troca o sinal de volta. O resultado é a '
        + 'equação de <strong>Euler-Poisson</strong>:</p>'
        + '\\[\\pder{f}{y}-\\der{}{x}\\left(\\pder{f}{y\'}\\right)'
        + '+\\dder{}{x}\\left(\\pder{f}{y\'\'}\\right)=0.\\]'
        + '<p>Com \\(\\partial f/\\partial y=-q\\), \\(\\partial f/\\partial y\'=0\\) e '
        + '\\(\\partial f/\\partial y\'\'=EIy\'\'\\), sai a equação da linha elástica de '
        + 'Euler-Bernoulli:</p>'
        + '\\[EI\\,y^{(4)}=q(x).\\]'
        + '<p>Note a contagem de condições de contorno. A equação é de quarta ordem e precisa '
        + 'de <strong>quatro</strong> condições, não duas, e a dedução avisa quais: para que '
        + 'os termos de fronteira sumissem foi preciso impor \\(\\eta=0\\) e \\(\\eta\'=0\\) '
        + 'nas duas pontas. Fisicamente, cada ponta oferece duas informações, e quais são '
        + 'depende do apoio: um apoio simples fixa a altura e deixa o momento nulo '
        + '(\\(y=y\'\'=0\\)); um engaste fixa a altura e a inclinação (\\(y=y\'=0\\)); uma '
        + 'ponta livre não fixa nada e impõe momento e cortante nulos '
        + '(\\(y\'\'=y\'\'\'=0\\)).</p>'
        + '<p>Troque o apoio e compare as flechas para a mesma carga. A viga biengastada é '
        + 'cinco vezes mais rígida que a biapoiada, e a viga em balanço é a mais flexível de '
        + 'todas por uma margem larga. É o mesmo material e a mesma carga: o que muda é '
        + 'apenas a condição de contorno de um problema variacional.</p>';
      tipografar(corpo);
    }

    registrarRedesenho(desenhar);
  };

  /* =================================================================
     37. O pêndulo duplo e a sensibilidade às condições iniciais
     Duas cópias com diferença inicial de um milésimo de grau. As
     equações saem de uma lagrangiana de duas linhas e o resultado é
     caos determinístico.
     ================================================================= */
  REGISTRO.duplo = function (raiz) {
    var g0 = 9.80665;
    var est = { th1: 120, th2: 60, delta: 1e-3, rodando: true, t: 0 };
    var m1 = 1, m2 = 1, L1 = 1, L2 = 1;
    var A = null, B = null, rastro = [];

    var corpo = moldura(raiz, 'O pêndulo duplo: duas linhas de lagrangiana, caos de sobra');

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'ângulo inicial de cima', 10, 175, 1, 120,
      function (v) { est.th1 = v; reiniciar(); }, function (v) { return v + '°'; });
    deslizante(ctr, 'ângulo inicial de baixo', 10, 175, 1, 60,
      function (v) { est.th2 = v; reiniciar(); }, function (v) { return v + '°'; });
    var bt = el('button', { type: 'button', texto: 'recomeçar' });
    bt.addEventListener('click', reiniciar);
    ctr.appendChild(bt);

    var mostrar = cartoes(corpo, [
      { rot: 'diferença inicial', k: 'd0' },
      { rot: 'diferença agora', k: 'd' },
      { rot: 'fator de ampliação', k: 'amp' },
      { rot: 'tempo decorrido', k: 't' },
      { rot: 'energia da cópia A', k: 'E' },
      { rot: 'desvio relativo da energia', k: 'dE' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    function energia(y) {
      var t1 = y[0], t2 = y[1], w1 = y[2], w2 = y[3];
      var T = 0.5 * (m1 + m2) * L1 * L1 * w1 * w1
        + 0.5 * m2 * L2 * L2 * w2 * w2
        + m2 * L1 * L2 * w1 * w2 * Math.cos(t1 - t2);
      var V = -(m1 + m2) * g0 * L1 * Math.cos(t1) - m2 * g0 * L2 * Math.cos(t2);
      return T + V;
    }
    /* as equações que saem das duas equações de Lagrange, já resolvidas
       para as acelerações angulares */
    function deriv(y) {
      var t1 = y[0], t2 = y[1], w1 = y[2], w2 = y[3];
      var d = t1 - t2, s = Math.sin(d), c = Math.cos(d);
      var den = m1 + m2 * s * s;
      var a1 = (-m2 * L1 * w1 * w1 * s * c
        - m2 * L2 * w2 * w2 * s
        + m2 * g0 * Math.sin(t2) * c
        - (m1 + m2) * g0 * Math.sin(t1)) / (L1 * den);
      var a2 = ((m1 + m2) * (L1 * w1 * w1 * s
        - g0 * Math.sin(t2) + g0 * Math.sin(t1) * c)
        + m2 * L2 * w2 * w2 * s * c) / (L2 * den);
      return [w1, w2, a1, a2];
    }
    function passo(y, h) {
      function soma(a, b, f) { return a.map(function (v, i) { return v + f * b[i]; }); }
      var k1 = deriv(y);
      var k2 = deriv(soma(y, k1, h / 2));
      var k3 = deriv(soma(y, k2, h / 2));
      var k4 = deriv(soma(y, k3, h));
      return y.map(function (v, i) {
        return v + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
      });
    }
    function reiniciar() {
      var r = Math.PI / 180;
      A = [est.th1 * r, est.th2 * r, 0, 0];
      B = [est.th1 * r + est.delta * r, est.th2 * r, 0, 0];
      est.t = 0; rastro = [];
      est.E0 = energia(A);
    }
    reiniciar();

    function pos(y) {
      var x1 = L1 * Math.sin(y[0]), y1 = L1 * Math.cos(y[0]);
      return [x1, y1, x1 + L2 * Math.sin(y[1]), y1 + L2 * Math.cos(y[1])];
    }

    function desenhar() {
      var alt = 340;
      var p = G.preparar(cv, alt), ct = p.ct, Lp = p.L;
      ct.clearRect(0, 0, Lp, alt);
      var meia = Lp * 0.46;

      var esc = Math.min(meia * 0.38, (alt - 70) / 2.6);
      var ox = meia * 0.5, oy = alt * 0.34;
      function X(u) { return ox + u * esc; }
      function Y(u) { return oy + u * esc; }

      /* o rastro da ponta da cópia A */
      ct.beginPath();
      rastro.forEach(function (q, i) {
        (i ? ct.lineTo : ct.moveTo).call(ct, X(q[0]), Y(q[1]));
      });
      ct.strokeStyle = 'rgba(123,184,171,.75)'; ct.lineWidth = 1.4; ct.stroke();

      [[B, G.COR.bronze, 0.55], [A, G.COR.mestra, 1]].forEach(function (par) {
        var q = pos(par[0]);
        ct.save();
        ct.globalAlpha = par[2];
        ct.beginPath();
        ct.moveTo(X(0), Y(0)); ct.lineTo(X(q[0]), Y(q[1])); ct.lineTo(X(q[2]), Y(q[3]));
        ct.strokeStyle = par[1]; ct.lineWidth = 2.6; ct.stroke();
        [[q[0], q[1], 7], [q[2], q[3], 9]].forEach(function (b) {
          ct.beginPath(); ct.arc(X(b[0]), Y(b[1]), b[2], 0, 2 * Math.PI);
          ct.fillStyle = par[1]; ct.fill();
        });
        ct.restore();
      });
      ct.beginPath(); ct.arc(X(0), Y(0), 4, 0, 2 * Math.PI);
      ct.fillStyle = G.COR.tinta; ct.fill();
      rotulo(ct, 'cópia A', 12, 16, G.COR.mestra, 'left');
      rotulo(ct, 'cópia B, deslocada de 0,001°', 12, 32, G.COR.bronze, 'left');

      /* painel 2: a separação entre as duas cópias, em escala log */
      var sep = Math.abs(A[0] - B[0]) + Math.abs(A[1] - B[1]) + 1e-16;
      hist.push([est.t, sep]);
      if (hist.length > 1500) hist.shift();
      var g2 = G.eixos(cv, {
        altura: alt, xmin: 0, xmax: Math.max(20, est.t),
        ymin: -8, ymax: 1,
        rotX: 't (s)', rotY: 'log₁₀ da separação (rad)',
        marcasX: G.marcasLineares(0, Math.max(20, est.t), 5, 0),
        formataY: function (v) { return F.fmt(v, 0); },
        limpar: false, margem: { e: meia + 62, d: 16, c: 16, b: 40 }
      });
      var c2 = g2.ct;
      c2.beginPath();
      hist.forEach(function (q, i) {
        var yy = Math.log(q[1]) / Math.LN10;
        (i ? c2.lineTo : c2.moveTo).call(c2,
          g2.X(q[0]), g2.Y(Math.max(-8, Math.min(1, yy))));
      });
      c2.strokeStyle = G.COR.vinho; c2.lineWidth = 2.2; c2.stroke();
      G.curva(g2, function () { return 0; }, G.COR.grade, 1.4);
      rotulo(c2, 'separação da ordem do próprio ângulo',
        g2.x1 - 6, g2.Y(0) - 12, G.COR.suave, 'right');

      var amp = sep / (est.delta * Math.PI / 180);
      mostrar({
        d0: '0,001° = 1,75×10⁻⁵ rad',
        d: F.fmt(sep, 6) + ' rad',
        amp: F.fmt(amp, 1) + ' vezes',
        t: F.fmt(est.t, 1) + ' s',
        E: F.fmt(energia(A), 4) + ' J por kg',
        dE: F.pct(Math.abs(energia(A) - est.E0) / Math.abs(est.E0), 4)
      });

      nota.innerHTML =
        '<p>Duas coordenadas bastam, \\(\\theta_1\\) e \\(\\theta_2\\), medidas a partir da '
        + 'vertical. As posições são \\(x_1=\\ell_1\\sen\\theta_1\\), '
        + '\\(y_1=-\\ell_1\\cos\\theta_1\\), e a segunda massa acompanha a primeira. '
        + 'Derivando e somando os quadrados, o termo cruzado sobrevive, e é dele que vem '
        + 'todo o acoplamento:</p>'
        + '\\[T=\\tfrac12\\left(m_1+m_2\\right)\\ell_1^2\\dot\\theta_1^2'
        + '+\\tfrac12m_2\\ell_2^2\\dot\\theta_2^2'
        + '+m_2\\ell_1\\ell_2\\dot\\theta_1\\dot\\theta_2'
        + '\\cos\\left(\\theta_1-\\theta_2\\right),\\]'
        + '\\[V=-\\left(m_1+m_2\\right)g\\ell_1\\cos\\theta_1-m_2g\\ell_2\\cos\\theta_2.\\]'
        + '<p>Duas equações de Lagrange saem daí por derivação direta. Pela via de Newton '
        + 'seriam necessárias as duas trações, com quatro equações e duas incógnitas a '
        + 'eliminar.</p>'
        + '<p>As duas cópias desenhadas começam separadas por um milésimo de grau, uma '
        + 'diferença de \\(1{,}75\\cruz10^{-5}\\) rad, abaixo do que qualquer experimento '
        + 'controla. O segundo painel acompanha a separação em escala logarítmica, e o '
        + 'trecho retilíneo que aparece no começo é o crescimento <strong>exponencial</strong> '
        + 'característico: a inclinação dessa reta é o expoente de Lyapunov. Quando a '
        + 'separação chega à ordem do próprio ângulo, as duas trajetórias não têm mais '
        + 'relação entre si.</p>'
        + '<p>Nada disso é aleatório. As equações são determinísticas, a integração é a mesma '
        + 'para as duas cópias, e o cartão do desvio de energia mostra que o método numérico '
        + 'está sob controle. O que há é sensibilidade às condições iniciais, e é essa a '
        + 'definição de <strong>caos determinístico</strong>. A consequência prática é que '
        + 'prever o estado do sistema daqui a um minuto exigiria conhecer o estado inicial com '
        + 'uma precisão que cresce exponencialmente com o horizonte de previsão.</p>';
      tipografar(corpo);
    }
    var hist = [];

    registrarRedesenho(desenhar);
    (function animar() {
      if (est.rodando) {
        for (var i = 0; i < 8; i++) {
          A = passo(A, 0.002); B = passo(B, 0.002); est.t += 0.002;
        }
        var q = pos(A);
        rastro.push([q[2], q[3]]);
        if (rastro.length > 900) rastro.shift();
        desenhar();
      }
      requestAnimationFrame(animar);
    })();
  };

  /* =================================================================
     38. O potencial efetivo do problema de Kepler
     O problema de duas coordenadas vira um de uma só, e o tipo de
     órbita se lê no gráfico antes de resolver equação nenhuma.
     ================================================================= */
  REGISTRO.potefetivo = function (raiz) {
    var est = { l: 1, E: -0.35 };

    var corpo = moldura(raiz, 'O potencial efetivo decide o tipo de órbita');

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'momento angular ℓ', 0.4, 1.8, 0.02, 1,
      function (v) { est.l = v; desenhar(); },
      function (v) { return F.fmt(v, 2); });
    deslizante(ctr, 'energia E', -1.2, 0.5, 0.01, -0.35,
      function (v) { est.E = v; desenhar(); },
      function (v) { return F.fmt(v, 2); });

    var mostrar = cartoes(corpo, [
      { rot: 'tipo de órbita', k: 'tipo' },
      { rot: 'excentricidade e', k: 'e' },
      { rot: 'periélio r₁', k: 'r1' },
      { rot: 'afélio r₂', k: 'r2' },
      { rot: 'raio da órbita circular', k: 'rc' },
      { rot: 'energia mínima possível', k: 'Em' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    /* m = k = 1, de modo que U_ef = l²/2r² − 1/r */
    function Uef(r) { return est.l * est.l / (2 * r * r) - 1 / r; }

    function desenhar() {
      var alt = 330;
      var p = G.preparar(cv, alt), ct = p.ct, Lp = p.L;
      ct.clearRect(0, 0, Lp, alt);
      var meia = Lp * 0.52;

      var rc = est.l * est.l;                 // mínimo de U_ef
      var Emin = -1 / (2 * est.l * est.l);
      var E = Math.max(est.E, Emin + 1e-6);
      var ecc = Math.sqrt(Math.max(0, 1 + 2 * E * est.l * est.l));
      /* pontos de retorno: raízes de E = U_ef */
      var r1 = null, r2 = null;
      if (E < 0) {
        var a = -1 / (2 * E);
        r1 = a * (1 - ecc); r2 = a * (1 + ecc);
      } else {
        r1 = est.l * est.l / (1 + ecc);
      }

      var rmax = 6;
      var g1 = G.eixos(cv, {
        altura: alt, xmin: 0.05, xmax: rmax, ymin: -1.3, ymax: 0.7,
        rotX: 'r', rotY: 'energia',
        marcasX: G.marcasLineares(0, rmax, 6, 0),
        formataY: function (v) { return F.fmt(v, 1); },
        margem: { e: 54, d: Lp - meia + 10, c: 16, b: 40 }
      });
      G.curva(g1, function (r) { return est.l * est.l / (2 * r * r); },
        G.COR.azul, 1.8, [5, 4]);
      G.curva(g1, function (r) { return -1 / r; }, G.COR.bronze, 1.8, [5, 4]);
      G.curva(g1, Uef, G.COR.mestra, 2.8);
      G.curva(g1, function () { return E; }, G.COR.vinho, 2.2);
      G.curva(g1, function () { return 0; }, G.COR.grade, 1.4);
      var c1 = g1.ct;
      [[r1, 'r₁'], [r2, 'r₂']].forEach(function (q) {
        if (q[0] === null || q[0] > rmax) return;
        c1.beginPath(); c1.arc(g1.X(q[0]), g1.Y(E), 5, 0, 2 * Math.PI);
        c1.fillStyle = G.COR.vinho; c1.fill();
        rotulo(c1, q[1], g1.X(q[0]), g1.Y(E) - 16, G.COR.vinho);
      });
      c1.beginPath(); c1.arc(g1.X(rc), g1.Y(Uef(rc)), 5, 0, 2 * Math.PI);
      c1.fillStyle = G.COR.tinta; c1.fill();
      G.legenda(g1, [
        { texto: 'U_ef', cor: G.COR.mestra },
        { texto: 'centrífugo', cor: G.COR.azul },
        { texto: '−1/r', cor: G.COR.bronze },
        { texto: 'E', cor: G.COR.vinho }
      ]);

      /* painel 2: a órbita correspondente */
      var esc = Math.min((Lp - meia) * 0.16, alt * 0.19);
      var ox = meia + (Lp - meia) * 0.52, oy = alt * 0.52;
      function X(u) { return ox + u * esc; }
      function Y(u) { return oy - u * esc; }
      var sl = est.l * est.l;                 // semi-latus rectum
      ct.beginPath();
      var ini = true;
      for (var i = 0; i <= 600; i++) {
        var fi = -Math.PI + 2 * Math.PI * i / 600;
        var den = 1 + ecc * Math.cos(fi);
        if (den <= 0.02) { ini = true; continue; }
        var r = sl / den;
        if (r > 40) { ini = true; continue; }
        var xx = X(r * Math.cos(fi)), yy = Y(r * Math.sin(fi));
        if (ini) { ct.moveTo(xx, yy); ini = false; } else ct.lineTo(xx, yy);
      }
      ct.strokeStyle = G.COR.mestra; ct.lineWidth = 2.6; ct.stroke();
      ct.beginPath(); ct.arc(X(0), Y(0), 7, 0, 2 * Math.PI);
      ct.fillStyle = G.COR.bronze; ct.fill();
      rotulo(ct, 'foco', X(0), Y(0) - 18, G.COR.bronze);
      rotulo(ct, ecc < 1e-3 ? 'circunferência'
        : (ecc < 1 ? 'elipse' : (ecc > 1.001 ? 'hipérbole' : 'parábola')),
        ox, 20, G.COR.suave);

      mostrar({
        tipo: ecc < 1e-3 ? 'circular' : (ecc < 1 ? 'elíptica'
          : (ecc > 1.001 ? 'hiperbólica' : 'parabólica')),
        e: F.fmt(ecc, 4),
        r1: F.fmt(r1, 4),
        r2: r2 === null ? 'não há (órbita aberta)' : F.fmt(r2, 4),
        rc: F.fmt(rc, 4),
        Em: F.fmt(Emin, 4)
      });

      nota.innerHTML =
        '<p>Para uma força central a lagrangiana no plano é '
        + '\\(\\Lag=\\tfrac12m\\left(\\dot r^2+r^2\\dot\\varphi^2\\right)-V(r)\\), e '
        + '\\(\\varphi\\) é cíclica, de modo que \\(\\ell=mr^2\\dot\\varphi\\) é constante. '
        + 'Levando isso à energia,</p>'
        + '\\[E=\\tfrac12m\\dot r^2+\\frac{\\ell^2}{2mr^2}+V(r)'
        + '=\\tfrac12m\\dot r^2+U_{\\rm ef}(r).\\]'
        + '<p>O problema de duas coordenadas virou um problema de <strong>uma só</strong>: uma '
        + 'partícula de massa \\(m\\) movendo-se em \\(r\\) sob o potencial efetivo</p>'
        + '\\[U_{\\rm ef}(r)=\\frac{\\ell^2}{2mr^2}-\\frac{k}{r}.\\]'
        + '<p>O primeiro termo é repulsivo e domina perto da origem: é a barreira '
        + 'centrífuga, e é ela que impede uma partícula com \\(\\ell\\neq0\\) de cair no '
        + 'centro. O segundo é a atração de sempre, e domina longe.</p>'
        + '<p>A partir daí o gráfico responde tudo sem resolver equação nenhuma. A reta '
        + 'horizontal é \\(E\\), e o movimento radial só acontece onde \\(E>U_{\\rm ef}\\), '
        + 'porque \\(\\tfrac12m\\dot r^2\\) não pode ser negativo. Os cruzamentos são os '
        + 'pontos de retorno, periélio e afélio.</p>'
        + '<ul><li>\\(E=U_{\\rm ef,min}\\): um único raio possível, órbita '
        + '<strong>circular</strong>;</li>'
        + '<li>\\(U_{\\rm ef,min}&lt;E&lt;0\\): dois pontos de retorno, órbita '
        + '<strong>elíptica</strong>;</li>'
        + '<li>\\(E=0\\): <strong>parabólica</strong>, no limiar do escape;</li>'
        + '<li>\\(E>0\\): um só ponto de retorno, órbita '
        + '<strong>hiperbólica</strong>.</li></ul>'
        + '<p>A excentricidade sai da mesma conta, '
        + '\\(e=\\sqrt{1+2E\\ell^2/mk^2}\\), e o segundo painel desenha a cônica '
        + 'correspondente. Mexa no momento angular e veja a barreira centrífuga subir: com '
        + '\\(\\ell\\) grande, a partícula não consegue chegar perto do centro por mais '
        + 'energia que tenha disponível na direção radial.</p>';
      tipografar(corpo);
    }

    registrarRedesenho(desenhar);
  };

  /* =================================================================
     39. Potencial generalizado: a força de Lorentz
     A força magnética depende da velocidade e ainda assim cabe no
     formalismo. O widget integra o movimento e separa o momento
     canônico do mecânico.
     ================================================================= */
  REGISTRO.lorentz = function (raiz) {
    var est = { B: 1, E: 0.35, v0: 1, t: 0, rodando: true };
    var q = 1, m = 1, s = null, rastro = [];

    var corpo = moldura(raiz, 'A força de Lorentz a partir de um potencial que depende da velocidade');

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'campo magnético B (para fora da tela)', 0.4, 2.5, 0.05, 1,
      function (v) { est.B = v; reiniciar(); },
      function (v) { return F.fmt(v, 2) + ' T'; });
    deslizante(ctr, 'campo elétrico E (para cima)', 0, 1.2, 0.05, 0.35,
      function (v) { est.E = v; reiniciar(); },
      function (v) { return F.fmt(v, 2) + ' V/m'; });
    deslizante(ctr, 'rapidez inicial', 0.2, 2.5, 0.05, 1,
      function (v) { est.v0 = v; reiniciar(); },
      function (v) { return F.fmt(v, 2) + ' m/s'; });

    var mostrar = cartoes(corpo, [
      { rot: 'raio de Larmor mv/qB', k: 'rl' },
      { rot: 'frequência de cíclotron qB/m', k: 'wc' },
      { rot: 'velocidade de deriva E/B', k: 'vd' },
      { rot: 'rapidez atual', k: 'v' },
      { rot: 'momento mecânico mv_x', k: 'pm' },
      { rot: 'momento canônico mv_x + qA_x', k: 'pc' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    function reiniciar() {
      s = [0, 0, est.v0, 0];
      rastro = []; est.t = 0;
    }
    reiniciar();

    function deriv(y) {
      /* B = B ẑ, E = E ŷ, de modo que v × B = (v_y B, −v_x B, 0) */
      return [y[2], y[3],
        q / m * (0 + y[3] * est.B),
        q / m * (est.E - y[2] * est.B)];
    }
    function passo(y, h) {
      function soma(a, b, f) { return a.map(function (v, i) { return v + f * b[i]; }); }
      var k1 = deriv(y), k2 = deriv(soma(y, k1, h / 2));
      var k3 = deriv(soma(y, k2, h / 2)), k4 = deriv(soma(y, k3, h));
      return y.map(function (v, i) {
        return v + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
      });
    }

    function desenhar() {
      var alt = 320;
      var p = G.preparar(cv, alt), ct = p.ct, Lp = p.L;
      ct.clearRect(0, 0, Lp, alt);

      var rl = m * est.v0 / (q * est.B), vd = est.E / est.B;
      var alcance = Math.max(4 * rl, Math.abs(s[0]) + 2 * rl, 3);
      var esc = Math.min(Lp * 0.42 / alcance, (alt - 70) / (4.2 * rl + 1));
      var ox = Lp * 0.12, oy = alt * 0.52;
      function X(u) { return ox + u * esc; }
      function Y(u) { return oy - u * esc; }

      /* a malha de pontos que marca B saindo da tela */
      ct.fillStyle = 'rgba(44,95,141,.35)';
      for (var i = 0; i < 90; i++) {
        var gx = 18 + (i % 15) * (Lp - 36) / 14;
        var gy = 24 + Math.floor(i / 15) * (alt - 60) / 5;
        ct.beginPath(); ct.arc(gx, gy, 1.8, 0, 2 * Math.PI); ct.fill();
      }
      rotulo(ct, 'B sai da tela', Lp - 12, 16, G.COR.azul, 'right');
      seta(ct, 20, alt - 20, 20, alt - 56, G.COR.bronze, 2);
      rotulo(ct, 'E', 30, alt - 40, G.COR.bronze, 'left');

      ct.beginPath();
      rastro.forEach(function (r, k) {
        (k ? ct.lineTo : ct.moveTo).call(ct, X(r[0]), Y(r[1]));
      });
      ct.strokeStyle = G.COR.mestra; ct.lineWidth = 2; ct.stroke();

      /* a deriva, em tracejado: o centro de giro caminha com E/B */
      if (est.E > 0) {
        ct.beginPath();
        ct.moveTo(X(0), Y(rl));
        ct.lineTo(X(vd * est.t), Y(rl));
        ct.strokeStyle = G.COR.bronze; ct.lineWidth = 1.8;
        ct.setLineDash([6, 5]); ct.stroke(); ct.setLineDash([]);
        rotulo(ct, 'deriva E×B', X(vd * est.t * 0.5), Y(rl) - 14, G.COR.bronze);
      }

      ct.beginPath(); ct.arc(X(s[0]), Y(s[1]), 8, 0, 2 * Math.PI);
      ct.fillStyle = G.COR.vinho; ct.fill();
      seta(ct, X(s[0]), Y(s[1]), X(s[0]) + s[2] * esc * 0.5,
        Y(s[1]) + s[3] * esc * 0.5, G.COR.tinta, 2);

      var v = Math.hypot(s[2], s[3]);
      /* no calibre simétrico A = (−By/2, Bx/2, 0) */
      var Ax = -est.B * s[1] / 2;
      mostrar({
        rl: F.fmt(rl, 4) + ' m',
        wc: F.fmt(q * est.B / m, 4) + ' rad/s',
        vd: F.fmt(vd, 4) + ' m/s',
        v: F.fmt(v, 4) + ' m/s',
        pm: F.fmt(m * s[2], 4),
        pc: F.fmt(m * s[2] + q * Ax, 4)
      });

      nota.innerHTML =
        '<p>A força magnética \\(q\\vet{v}\\cruz\\vet{B}\\) depende da velocidade, e por isso '
        + 'não vem de nenhum potencial \\(V(\\vet{r})\\). Ela também não realiza trabalho, '
        + 'porque é perpendicular a \\(\\vet{v}\\): muda a direção do movimento sem mudar a '
        + 'rapidez, como o cartão confirma a cada instante quando \\(E=0\\).</p>'
        + '<p>Mesmo assim ela cabe no formalismo, através de um <strong>potencial '
        + 'generalizado</strong>, isto é, um \\(U\\) que pode depender da velocidade. A '
        + 'definição é</p>'
        + '\\[F_i=-\\pder{U}{x_i}+\\der{}{t}\\left(\\pder{U}{\\dot x_i}\\right),\\]'
        + '<p>e para o eletromagnetismo a escolha que funciona é</p>'
        + '\\[U=q\\phi-q\\,\\vet{v}\\cdot\\vet{A}'
        + '\\qquad\\Longrightarrow\\qquad'
        + '\\Lag=\\tfrac12m v^2-q\\phi+q\\,\\vet{v}\\cdot\\vet{A}.\\]'
        + '<p>Aplicando Euler-Lagrange a essa lagrangiana e usando '
        + '\\(\\vet{E}=-\\nabla\\phi-\\partial\\vet{A}/\\partial t\\) e '
        + '\\(\\vet{B}=\\nabla\\cruz\\vet{A}\\), sai exatamente '
        + '\\(m\\ddot{\\vet{r}}=q\\left(\\vet{E}+\\vet{v}\\cruz\\vet{B}\\right)\\).</p>'
        + '<p>A consequência mais importante está no momento conjugado. Derivando a '
        + 'lagrangiana em \\(\\dot x\\),</p>'
        + '\\[p_x=\\pder{\\Lag}{\\dot x}=m\\dot x+qA_x,\\]'
        + '<p>que <em>não</em> é o momento mecânico. Os dois cartões do fim mostram a '
        + 'diferença. O momento canônico depende do calibre escolhido para \\(\\vet{A}\\), e '
        + 'portanto não é observável sozinho; o mecânico é. Essa distinção reaparece em '
        + 'mecânica quântica, na substituição mínima '
        + '\\(\\vet{p}\\to\\vet{p}-q\\vet{A}\\), e está por trás do efeito Aharonov-Bohm.</p>'
        + '<p>O movimento desenhado é a soma de duas coisas: o giro de cíclotron, de raio '
        + '\\(mv/qB\\) e frequência \\(qB/m\\), e a <strong>deriva</strong> do centro de giro, '
        + 'com velocidade \\(\\vet{E}\\cruz\\vet{B}/B^2\\). Repare que a deriva é '
        + 'perpendicular aos dois campos e independe da carga e da massa: íons e elétrons '
        + 'derivam juntos, no mesmo sentido, e é por isso que o processo não gera corrente. '
        + 'É o mecanismo que confina plasma em tokamaks e o que organiza os cinturões de Van '
        + 'Allen.</p>';
      tipografar(corpo);
    }

    registrarRedesenho(desenhar);
    (function animar() {
      if (est.rodando) {
        for (var i = 0; i < 6; i++) { s = passo(s, 0.006); est.t += 0.006; }
        rastro.push([s[0], s[1]]);
        if (rastro.length > 1400) rastro.shift();
        if (s[0] * 1 > 60) reiniciar();
        desenhar();
      }
      requestAnimationFrame(animar);
    })();
  };

  /* =================================================================
     40. A função de dissipação de Rayleigh
     Atrito viscoso dentro do formalismo, e a verificação numérica de
     que dE/dt = −2F.
     ================================================================= */
  REGISTRO.rayleigh = function (raiz) {
    var est = { b: 0.6, vista: 'x' };
    var m = 1, k = 4;                  // ω₀ = 2 rad/s

    var corpo = moldura(raiz, 'A função de Rayleigh: atrito dentro do formalismo');

    var c0 = el('div', { class: 'controles' });
    corpo.appendChild(c0);
    opcoes(c0, [
      { rot: 'posição x(t)', v: 'x' },
      { rot: 'energia e dissipação', v: 'E' }
    ], 0, function (v) { est.vista = v; desenhar(); });

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'coeficiente de amortecimento b', 0, 8, 0.05, 0.6,
      function (v) { est.b = v; desenhar(); },
      function (v) { return F.fmt(v, 2) + ' kg/s'; });

    var mostrar = cartoes(corpo, [
      { rot: 'regime', k: 'reg' },
      { rot: 'ω₀ = √(k/m)', k: 'w0' },
      { rot: 'γ = b/2m', k: 'gam' },
      { rot: 'ω′ = √(ω₀² − γ²)', k: 'wl' },
      { rot: 'tempo para cair a 1/e', k: 'tau' },
      { rot: 'fator de qualidade Q', k: 'Q' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    var T = 10;
    function solucao() {
      var g = est.b / (2 * m), w0 = Math.sqrt(k / m);
      if (Math.abs(g - w0) < 1e-6) {
        return function (t) { return (1 + w0 * t) * Math.exp(-g * t); };
      }
      if (g < w0) {
        var wl = Math.sqrt(w0 * w0 - g * g);
        return function (t) {
          return Math.exp(-g * t) * (Math.cos(wl * t) + g / wl * Math.sin(wl * t));
        };
      }
      var s = Math.sqrt(g * g - w0 * w0);
      var l1 = -g + s, l2 = -g - s;
      var A = -l2 / (l1 - l2), B = l1 / (l1 - l2);
      return function (t) { return A * Math.exp(l1 * t) + B * Math.exp(l2 * t); };
    }

    function desenhar() {
      var x = solucao();
      function vel(t) { return (x(t + 1e-5) - x(t - 1e-5)) / 2e-5; }
      function ener(t) { var v = vel(t); return 0.5 * m * v * v + 0.5 * k * x(t) * x(t); }
      function rayl(t) { var v = vel(t); return 0.5 * est.b * v * v; }

      var gr;
      if (est.vista === 'x') {
        gr = G.eixos(cv, {
          altura: 300, xmin: 0, xmax: T, ymin: -1.15, ymax: 1.15,
          rotX: 't (s)', rotY: 'x (m)',
          marcasX: G.marcasLineares(0, T, 5, 0),
          formataY: function (v) { return F.fmt(v, 1); }
        });
        var g = est.b / (2 * m);
        G.curva(gr, function (t) { return Math.exp(-g * t); }, G.COR.bronze, 1.8, [6, 4]);
        G.curva(gr, function (t) { return -Math.exp(-g * t); }, G.COR.bronze, 1.8, [6, 4]);
        G.curva(gr, function () { return 0; }, G.COR.grade, 1.4);
        G.curva(gr, x, G.COR.mestra, 2.8);
        G.legenda(gr, [
          { texto: 'x(t)', cor: G.COR.mestra },
          { texto: 'envoltória e^{−γt}', cor: G.COR.bronze }
        ]);
      } else {
        var emax = ener(0) * 1.1 + 1e-6;
        gr = G.eixos(cv, {
          altura: 300, xmin: 0, xmax: T, ymin: 0, ymax: emax,
          rotX: 't (s)', rotY: 'energia (J) e dissipação (W)',
          marcasX: G.marcasLineares(0, T, 5, 0),
          formataY: function (v) { return F.fmt(v, 1); }
        });
        G.curva(gr, ener, G.COR.mestra, 2.8);
        G.curva(gr, function (t) { return 2 * rayl(t); }, G.COR.vinho, 2.2);
        G.curva(gr, function (t) {
          return -(ener(t + 1e-3) - ener(t - 1e-3)) / 2e-3;
        }, G.COR.bronze, 2.6, [7, 5]);
        G.legenda(gr, [
          { texto: 'E(t)', cor: G.COR.mestra },
          { texto: '2ℱ', cor: G.COR.vinho },
          { texto: '−dE/dt', cor: G.COR.bronze }
        ]);
      }

      var g2 = est.b / (2 * m), w0 = Math.sqrt(k / m);
      var reg = Math.abs(g2 - w0) < 0.02 ? 'crítico'
        : (g2 < w0 ? 'subamortecido' : 'superamortecido');
      mostrar({
        reg: reg,
        w0: F.fmt(w0, 3) + ' rad/s',
        gam: F.fmt(g2, 3) + ' s⁻¹',
        wl: g2 < w0 ? F.fmt(Math.sqrt(w0 * w0 - g2 * g2), 3) + ' rad/s' : 'não há oscilação',
        tau: est.b > 0 ? F.fmt(1 / g2, 3) + ' s' : 'não decai',
        Q: est.b > 0 ? F.fmt(w0 / (2 * g2), 3) : 'infinito'
      });

      nota.innerHTML =
        '<p>Atrito viscoso não vem de potencial nenhum, e mesmo assim entra no formalismo sem '
        + 'estragá-lo. Para forças da forma \\(\\vet{F}_i=-b_i\\vet{v}_i\\), define-se a '
        + '<strong>função de dissipação de Rayleigh</strong></p>'
        + '\\[\\mathcal{F}=\\tfrac12\\sum_ib_iv_i^2,\\]'
        + '<p>com a propriedade de que a força generalizada dissipativa é '
        + '\\(Q_j=-\\partial\\mathcal{F}/\\partial\\dot q_j\\). As equações de Lagrange '
        + 'ganham então um lado direito:</p>'
        + '\\[\\der{}{t}\\left(\\pder{\\Lag}{\\dot q_j}\\right)-\\pder{\\Lag}{q_j}'
        + '=-\\pder{\\mathcal{F}}{\\dot q_j}.\\]'
        + '<p>Para a massa presa à mola, \\(\\Lag=\\tfrac12m\\dot x^2-\\tfrac12kx^2\\) e '
        + '\\(\\mathcal{F}=\\tfrac12b\\dot x^2\\), de modo que</p>'
        + '\\[m\\ddot x+b\\dot x+kx=0,\\]'
        + '<p>a equação do oscilador amortecido. Com \\(\\gamma=b/2m\\) e '
        + '\\(\\omega_0=\\sqrt{k/m}\\) há três regimes: subamortecido '
        + '(\\(\\gamma<\\omega_0\\)), com oscilação de frequência '
        + '\\(\\omega\'=\\sqrt{\\omega_0^2-\\gamma^2}\\) dentro de uma envoltória '
        + '\\(e^{-\\gamma t}\\); crítico (\\(\\gamma=\\omega_0\\)), que volta ao equilíbrio no '
        + 'menor tempo possível sem ultrapassá-lo, e é o que se projeta num amortecedor de '
        + 'automóvel; e superamortecido (\\(\\gamma>\\omega_0\\)), lento e sem oscilar.</p>'
        + '<p>O nome da função fica claro na segunda vista. A taxa com que o sistema perde '
        + 'energia é</p>'
        + '\\[\\der{E}{t}=-2\\mathcal{F},\\]'
        + '<p>e as duas curvas desenhadas, \\(-dE/dt\\) calculado numericamente e '
        + '\\(2\\mathcal{F}\\) calculado pela fórmula, coincidem ponto a ponto. O fator dois é '
        + 'convenção, pelo mesmo motivo do meio em \\(T=\\tfrac12mv^2\\): ele torna a '
        + 'derivada limpa.</p>'
        + '<p>A mesma estrutura descreve um circuito RLC, com \\(Q\\) no lugar de \\(x\\), '
        + '\\(L\\) no lugar de \\(m\\), \\(1/C\\) no lugar de \\(k\\) e \\(R\\) no lugar de '
        + '\\(b\\). A lagrangiana é \\(\\tfrac12L\\dot Q^2-Q^2/2C\\) e a função de Rayleigh é '
        + '\\(\\tfrac12R\\dot Q^2\\), com \\(2\\mathcal{F}=RI^2\\), que é a potência '
        + 'dissipada por efeito Joule. A analogia não é metáfora: são as mesmas equações.</p>';
      tipografar(corpo);
    }

    registrarRedesenho(desenhar);
  };

  /* =================================================================
     41. A transformação de Legendre, geometricamente
     Trocar a variável independente pela inclinação da tangente. O
     widget mostra que g(p) é menos o corte da tangente no eixo
     vertical, e que a transformação é involutiva.
     ================================================================= */
  REGISTRO.legendre = function (raiz) {
    var FUNS = {
      quad: {
        n: 'f = x²/2', f: function (x) { return x * x / 2; },
        d: function (x) { return x; }, inv: function (p) { return p; },
        g: 'g(p) = p²/2', obs: 'a parábola é levada noutra parábola'
      },
      quarta: {
        n: 'f = x⁴/4', f: function (x) { return Math.pow(x, 4) / 4; },
        d: function (x) { return Math.pow(x, 3); },
        inv: function (p) { return Math.cbrt(p); },
        g: 'g(p) = 3p^{4/3}/4', obs: 'expoentes conjugados: 4 e 4/3'
      },
      exp: {
        n: 'f = eˣ', f: function (x) { return Math.exp(x); },
        d: function (x) { return Math.exp(x); },
        inv: function (p) { return Math.log(Math.max(p, 1e-9)); },
        g: 'g(p) = p ln p − p', obs: 'a exponencial vira o logaritmo'
      }
    };
    var est = { k: 'quad', x: 1.1 };

    var corpo = moldura(raiz, 'A transformação de Legendre: de pontos para tangentes');

    var c0 = el('div', { class: 'controles' });
    corpo.appendChild(c0);
    opcoes(c0, Object.keys(FUNS).map(function (k) {
      return { rot: FUNS[k].n, v: k };
    }), 0, function (v) { est.k = v; desenhar(); });

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'ponto escolhido x', -1.8, 1.8, 0.02, 1.1,
      function (v) { est.x = v; desenhar(); },
      function (v) { return F.fmt(v, 2); });

    var mostrar = cartoes(corpo, [
      { rot: 'inclinação p = df/dx', k: 'p' },
      { rot: 'f(x)', k: 'f' },
      { rot: 'g(p) = p x − f(x)', k: 'g' },
      { rot: 'corte da tangente em x = 0', k: 'corte' },
      { rot: 'dg/dp (devolve x)', k: 'dg' },
      { rot: 'a transformada', k: 'form' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    function desenhar() {
      var C = FUNS[est.k];
      var x = est.k === 'exp' ? Math.max(est.x, -1.2) : est.x;
      var p = C.d(x), f = C.f(x), g = p * x - f;

      var alt = 320;
      var pp = G.preparar(cv, alt), ct = pp.ct, Lp = pp.L;
      ct.clearRect(0, 0, Lp, alt);
      var meia = Lp * 0.5;

      var ymax = est.k === 'exp' ? 5 : 2.2, ymin = est.k === 'exp' ? -1.5 : -2.2;
      var g1 = G.eixos(cv, {
        altura: alt, xmin: -1.9, xmax: 1.9, ymin: ymin, ymax: ymax,
        rotX: 'x', rotY: 'f(x)',
        marcasX: G.marcasLineares(-1.9, 1.9, 6, 1),
        formataY: function (v) { return F.fmt(v, 1); },
        margem: { e: 52, d: Lp - meia + 10, c: 16, b: 40 }
      });
      G.curva(g1, function () { return 0; }, G.COR.grade, 1.4);
      G.curva(g1, C.f, G.COR.mestra, 2.8);
      /* a tangente no ponto, e o seu corte no eixo vertical */
      G.curva(g1, function (u) { return f + p * (u - x); }, G.COR.vinho, 2);
      var c1 = g1.ct;
      c1.beginPath(); c1.arc(g1.X(x), g1.Y(f), 6, 0, 2 * Math.PI);
      c1.fillStyle = G.COR.mestra; c1.fill();
      var corte = f - p * x;
      if (corte > ymin && corte < ymax) {
        c1.beginPath(); c1.arc(g1.X(0), g1.Y(corte), 6, 0, 2 * Math.PI);
        c1.fillStyle = G.COR.bronze; c1.fill();
        c1.beginPath();
        c1.moveTo(g1.X(0), g1.Y(0)); c1.lineTo(g1.X(0), g1.Y(corte));
        c1.strokeStyle = G.COR.bronze; c1.lineWidth = 3; c1.stroke();
        rotulo(c1, '−g(p)', g1.X(0) - 10, g1.Y(corte / 2), G.COR.bronze, 'right');
      }
      rotulo(c1, 'tangente de inclinação p', g1.x1 - 6, g1.y0 + 12, G.COR.vinho, 'right');

      /* painel 2: a transformada g(p) */
      var pmin = -2, pmax = 2;
      if (est.k === 'exp') { pmin = 0.02; pmax = 5; }
      if (est.k === 'quarta') { pmin = -5; pmax = 5; }
      function gg(q) {
        var xx = C.inv(q);
        return q * xx - C.f(xx);
      }
      var gmin = 0, gmax = 0;
      for (var i = 0; i <= 60; i++) {
        var q = pmin + (pmax - pmin) * i / 60;
        gmax = Math.max(gmax, gg(q)); gmin = Math.min(gmin, gg(q));
      }
      var g2 = G.eixos(cv, {
        altura: alt, xmin: pmin, xmax: pmax,
        ymin: gmin - 0.2, ymax: gmax * 1.1 + 0.2,
        rotX: 'p', rotY: 'g(p)',
        marcasX: G.marcasLineares(pmin, pmax, 5, 1),
        formataY: function (v) { return F.fmt(v, 1); },
        limpar: false, margem: { e: meia + 56, d: 16, c: 16, b: 40 }
      });
      G.curva(g2, function () { return 0; }, G.COR.grade, 1.4);
      G.curva(g2, gg, G.COR.bronze, 2.8);
      var c2 = g2.ct;
      if (p > pmin && p < pmax) {
        c2.beginPath(); c2.arc(g2.X(p), g2.Y(g), 6, 0, 2 * Math.PI);
        c2.fillStyle = G.COR.bronze; c2.fill();
        G.vertical(g2, p, G.COR.suave, '', true);
      }

      var h = 1e-4;
      mostrar({
        p: F.fmt(p, 4),
        f: F.fmt(f, 4),
        g: F.fmt(g, 4),
        corte: F.fmt(corte, 4),
        dg: F.fmt((gg(p + h) - gg(p - h)) / (2 * h), 4) + ' contra x = ' + F.fmt(x, 2),
        form: C.g
      });

      nota.innerHTML =
        '<p>A transformação de Legendre troca a variável independente de \\(x\\) pela '
        + '<strong>inclinação</strong> \\(p=df/dx\\). A definição é</p>'
        + '\\[g(p)=p\\,x-f(x),\\qquad\\text{com }x=x(p)\\text{ obtido invertendo }'
        + 'p=\\der{f}{x}.\\]'
        + '<p>O painel da esquerda mostra o significado geométrico. A reta tangente no ponto '
        + 'escolhido tem equação \\(y=f(x)+p\\left(u-x\\right)\\), e o seu corte no eixo '
        + 'vertical vale \\(f(x)-px=-g(p)\\). Em outras palavras: \\(g(p)\\) é menos o '
        + 'intercepto da tangente de inclinação \\(p\\). O segmento em bronze mede '
        + 'exatamente isso.</p>'
        + '<p>As duas descrições guardam a mesma informação. Especificar a curva ponto a '
        + 'ponto, pelos pares \\(\\left(x,f\\right)\\), ou especificá-la como a envoltória de '
        + 'suas tangentes, pelos pares \\(\\left(p,g\\right)\\), são maneiras equivalentes de '
        + 'dizer a mesma coisa. Por isso nada se perde na troca, e o cartão de \\(dg/dp\\) '
        + 'confirma: derivar a transformada em \\(p\\) devolve \\(x\\).</p>'
        + '<p>A transformação é <strong>involutiva</strong>: aplicada duas vezes, volta ao '
        + 'ponto de partida. Ela existe sempre que \\(f\\) for convexa, porque aí '
        + '\\(p=df/dx\\) é monótona e pode ser invertida. Em várias variáveis, a condição é '
        + 'que a matriz hessiana \\(\\partial^2f/\\partial x_i\\partial x_j\\) seja '
        + 'invertível, o que em mecânica está garantido quando a energia cinética é uma forma '
        + 'quadrática definida positiva nas velocidades.</p>'
        + '<p>Troque de função e observe os pares conjugados: a parábola vai noutra parábola, '
        + '\\(x^4/4\\) vai em \\(3p^{4/3}/4\\), e a exponencial vai no logaritmo. ' + C.obs
        + '. Em termodinâmica a mesma operação leva a energia interna à energia livre de '
        + 'Helmholtz, trocando \\(S\\) por \\(T\\); em mecânica ela leva a lagrangiana à '
        + 'hamiltoniana, trocando \\(\\dot q\\) por \\(p\\).</p>';
      tipografar(corpo);
    }

    registrarRedesenho(desenhar);
  };

  /* =================================================================
     42. O fluxo no espaço de fase
     As equações de Hamilton são um campo de velocidades em (q, p). O
     widget desenha o campo, integra uma trajetória e mostra as curvas
     de nível de H, que são as próprias órbitas.
     ================================================================= */
  REGISTRO.fluxoh = function (raiz) {
    var SIS = {
      osc: {
        n: 'oscilador', H: function (q, p) { return p * p / 2 + q * q / 2; },
        dq: function (q, p) { return p; }, dp: function (q) { return -q; },
        qmax: 2.4, pmax: 2.4, exp: 'H = p²/2 + q²/2'
      },
      pend: {
        n: 'pêndulo', H: function (q, p) { return p * p / 2 + (1 - Math.cos(q)); },
        dq: function (q, p) { return p; }, dp: function (q) { return -Math.sin(q); },
        qmax: 7, pmax: 3.2, sep: 2, exp: 'H = p²/2 + (1 − cos q)'
      },
      queda: {
        n: 'queda livre', H: function (q, p) { return p * p / 2 + q; },
        dq: function (q, p) { return p; }, dp: function () { return -1; },
        qmax: 3, pmax: 2.6, exp: 'H = p²/2 + q'
      },
      poco: {
        n: 'poço duplo', H: function (q, p) { return p * p / 2 - q * q / 2 + q * q * q * q / 4; },
        dq: function (q, p) { return p; }, dp: function (q) { return q - q * q * q; },
        qmax: 2, pmax: 1.6, sep: 0, exp: 'H = p²/2 − q²/2 + q⁴/4'
      }
    };
    var est = { k: 'pend', q0: 0, p0: 1.6, t: 0, rodando: true };
    var traj = [], s = null;

    var corpo = moldura(raiz, 'As equações de Hamilton são um campo de velocidades em (q, p)');

    var c0 = el('div', { class: 'controles' });
    corpo.appendChild(c0);
    opcoes(c0, Object.keys(SIS).map(function (k) {
      return { rot: SIS[k].n, v: k };
    }), 1, function (v) { est.k = v; reiniciar(); });

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'q inicial', -3, 3, 0.05, 0,
      function (v) { est.q0 = v; reiniciar(); },
      function (v) { return F.fmt(v, 2); });
    deslizante(ctr, 'p inicial', -3, 3, 0.05, 1.6,
      function (v) { est.p0 = v; reiniciar(); },
      function (v) { return F.fmt(v, 2); });

    var mostrar = cartoes(corpo, [
      { rot: 'hamiltoniana', k: 'exp' },
      { rot: 'q̇ = ∂H/∂p', k: 'dq' },
      { rot: 'ṗ = −∂H/∂q', k: 'dp' },
      { rot: 'H agora', k: 'H' },
      { rot: 'H no início', k: 'H0' },
      { rot: 'regime', k: 'reg' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    function reiniciar() { s = [est.q0, est.p0]; traj = []; est.t = 0; est.H0 = SIS[est.k].H(s[0], s[1]); }
    reiniciar();

    function passo(y, h) {
      var C = SIS[est.k];
      function d(z) { return [C.dq(z[0], z[1]), C.dp(z[0], z[1])]; }
      function soma(a, b, f) { return [a[0] + f * b[0], a[1] + f * b[1]]; }
      var k1 = d(y), k2 = d(soma(y, k1, h / 2));
      var k3 = d(soma(y, k2, h / 2)), k4 = d(soma(y, k3, h));
      return [y[0] + h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
              y[1] + h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])];
    }

    function desenhar() {
      var C = SIS[est.k];
      var gr = G.eixos(cv, {
        altura: 340, xmin: -C.qmax, xmax: C.qmax, ymin: -C.pmax, ymax: C.pmax,
        rotX: 'coordenada q', rotY: 'momento p',
        marcasX: G.marcasLineares(-C.qmax, C.qmax, 6, 1),
        formataY: function (v) { return F.fmt(v, 1); }
      });
      var ct = gr.ct;

      /* curvas de nível de H, que são as próprias órbitas */
      function nivel(alvo, cor, esp) {
        ct.beginPath();
        var primeiro = true, i;
        for (i = 0; i <= 320; i++) {
          var q = -C.qmax + 2 * C.qmax * i / 320;
          var pot = C.H(q, 0);
          if (alvo < pot) { primeiro = true; continue; }
          var pv = Math.sqrt(2 * (alvo - pot));
          if (!isFinite(pv) || pv > C.pmax) { primeiro = true; continue; }
          if (primeiro) { ct.moveTo(gr.X(q), gr.Y(pv)); primeiro = false; }
          else ct.lineTo(gr.X(q), gr.Y(pv));
        }
        primeiro = true;
        for (i = 320; i >= 0; i--) {
          var q2 = -C.qmax + 2 * C.qmax * i / 320;
          var pot2 = C.H(q2, 0);
          if (alvo < pot2) { primeiro = true; continue; }
          var pv2 = -Math.sqrt(2 * (alvo - pot2));
          if (!isFinite(pv2) || pv2 < -C.pmax) { primeiro = true; continue; }
          if (primeiro) { ct.moveTo(gr.X(q2), gr.Y(pv2)); primeiro = false; }
          else ct.lineTo(gr.X(q2), gr.Y(pv2));
        }
        ct.strokeStyle = cor; ct.lineWidth = esp; ct.stroke();
      }
      var niveis = 11;
      for (var n = 0; n < niveis; n++) {
        nivel(C.H(0, 0) + (n + 0.5) / niveis * C.H(0, C.pmax) * 1.15,
          'rgba(123,184,171,.55)', 1.2);
      }
      /* a separatriz, onde houver: é ela que divide os regimes */
      if (C.sep !== undefined) {
        nivel(C.sep - 1e-9, G.COR.bronze, 2.2);
        rotulo(ct, 'separatriz', gr.x0 + 8, gr.y0 + 14, G.COR.bronze, 'left');
      }

      /* o campo de velocidades */
      var nx = 13, ny = 9;
      for (var a = 0; a < nx; a++) {
        for (var b = 0; b < ny; b++) {
          var q3 = -C.qmax + 2 * C.qmax * (a + 0.5) / nx;
          var p3 = -C.pmax + 2 * C.pmax * (b + 0.5) / ny;
          var vq = C.dq(q3, p3), vp = C.dp(q3, p3);
          var mod = Math.hypot(vq, vp) || 1;
          var L = 13;
          seta(ct, gr.X(q3), gr.Y(p3),
            gr.X(q3) + vq / mod * L, gr.Y(p3) - vp / mod * L,
            'rgba(27,31,36,.33)', 1.2);
        }
      }

      /* a trajetória integrada */
      ct.beginPath();
      traj.forEach(function (z, i) {
        (i ? ct.lineTo : ct.moveTo).call(ct, gr.X(z[0]), gr.Y(z[1]));
      });
      ct.strokeStyle = G.COR.vinho; ct.lineWidth = 2.6; ct.stroke();
      ct.beginPath(); ct.arc(gr.X(s[0]), gr.Y(s[1]), 7, 0, 2 * Math.PI);
      ct.fillStyle = G.COR.vinho; ct.fill();
      ct.strokeStyle = '#fff'; ct.lineWidth = 2; ct.stroke();

      var reg = '—';
      if (est.k === 'pend') {
        reg = est.H0 < 2 ? 'oscila (libração)'
          : (est.H0 > 2 ? 'dá voltas (rotação)' : 'separatriz');
      } else if (est.k === 'poco') {
        reg = est.H0 < 0 ? 'preso num dos poços' : 'passeia pelos dois';
      } else if (est.k === 'osc') {
        reg = 'elipse fechada';
      } else {
        reg = 'parábola aberta';
      }

      mostrar({
        exp: C.exp,
        dq: F.fmt(C.dq(s[0], s[1]), 4),
        dp: F.fmt(C.dp(s[0], s[1]), 4),
        H: F.fmt(C.H(s[0], s[1]), 6),
        H0: F.fmt(est.H0, 6),
        reg: reg
      });

      nota.innerHTML =
        '<p>A transformação de Legendre troca \\(n\\) equações de segunda ordem por '
        + '\\(2n\\) equações de <strong>primeira</strong> ordem:</p>'
        + '\\[\\dot q_j=\\pder{H}{p_j},\\qquad\\dot p_j=-\\pder{H}{q_j}.\\]'
        + '<p>A leitura geométrica é a que o desenho mostra. Em cada ponto do espaço de fase, '
        + 'as duas derivadas fornecem um <strong>vetor velocidade</strong>, e o estado do '
        + 'sistema escorre ao longo dele. As setinhas cinzas são esse campo; a curva em vinho '
        + 'é a trajetória que ele produz a partir do ponto inicial escolhido.</p>'
        + '<p>As curvas verde-claras são as linhas de nível de \\(H\\). Quando \\(H\\) não '
        + 'depende do tempo, ela é conservada, e portanto a trajetória nunca sai da curva de '
        + 'nível em que começou: no espaço de fase, <em>órbita e curva de nível são a mesma '
        + 'coisa</em>. Repare que o campo de velocidades é sempre tangente a essas curvas, e '
        + 'isso não é coincidência: o vetor \\(\\left(\\partial H/\\partial p,-\\partial '
        + 'H/\\partial q\\right)\\) é o gradiente de \\(H\\) girado de 90°, e portanto '
        + 'perpendicular a ele.</p>'
        + '<p>Cada sistema tem um retrato próprio. O oscilador dá elipses concêntricas, todas '
        + 'percorridas no mesmo período. A queda livre dá parábolas abertas. O pêndulo tem '
        + 'duas regiões separadas por uma curva especial, a <strong>separatriz</strong>: '
        + 'dentro dela o pêndulo oscila, fora dela ele dá voltas completas, e sobre ela ele '
        + 'leva tempo infinito para chegar ao ponto mais alto. O poço duplo tem dois centros '
        + 'e um ponto de sela entre eles, e a energia decide se a partícula fica presa num '
        + 'poço ou passeia pelos dois.</p>'
        + '<p>Os pontos onde o campo se anula são os <strong>equilíbrios</strong>. Mínimos de '
        + '\\(H\\) produzem centros, com órbitas fechadas ao redor; selas produzem '
        + 'equilíbrios instáveis, com trajetórias que se aproximam por uma direção e se '
        + 'afastam por outra. No pêndulo, \\(q=0\\) é centro e \\(q=\\pi\\) é sela, que é a '
        + 'maneira do espaço de fase dizer que o pêndulo de ponta-cabeça não para em pé.</p>';
      tipografar(corpo);
    }

    registrarRedesenho(desenhar);
    (function animar() {
      if (est.rodando) {
        for (var i = 0; i < 4; i++) { s = passo(s, 0.012); est.t += 0.012; }
        traj.push([s[0], s[1]]);
        if (traj.length > 1600) traj.shift();
        desenhar();
      }
      requestAnimationFrame(animar);
    })();
  };

  /* =================================================================
     43. Quando H não é a energia
     A conta na conta: um aro que gira com velocidade angular imposta.
     H se conserva e não é a energia; a energia varia e não se conserva.
     ================================================================= */
  REGISTRO.naoconserva = function (raiz) {
    var g0 = 9.80665, R = 1, mm = 1;
    var est = { W: 4, th0: 20, t: 0, rodando: true };
    var s = null, hist = [];

    var corpo = moldura(raiz, 'A conta no aro que gira: H se conserva, a energia não');

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'velocidade angular imposta Ω', 0, 6, 0.1, 4,
      function (v) { est.W = v; reiniciar(); },
      function (v) { return F.fmt(v, 1) + ' rad/s'; });
    deslizante(ctr, 'ângulo inicial', 2, 170, 1, 20,
      function (v) { est.th0 = v; reiniciar(); }, function (v) { return v + '°'; });

    var mostrar = cartoes(corpo, [
      { rot: 'H (conservada)', k: 'H' },
      { rot: 'E = T + V (varia)', k: 'E' },
      { rot: 'diferença E − H', k: 'dif' },
      { rot: 'Ω crítico √(g/R)', k: 'wc' },
      { rot: 'equilíbrio fora do fundo', k: 'eq' },
      { rot: 'potência do motor', k: 'pot' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    function reiniciar() {
      s = [est.th0 * Math.PI / 180, 0];
      hist = []; est.t = 0;
    }
    reiniciar();

    function Hfun(th, w) {
      return 0.5 * mm * R * R * w * w
        - 0.5 * mm * R * R * est.W * est.W * Math.pow(Math.sin(th), 2)
        - mm * g0 * R * Math.cos(th);
    }
    function Efun(th, w) {
      return 0.5 * mm * R * R * w * w
        + 0.5 * mm * R * R * est.W * est.W * Math.pow(Math.sin(th), 2)
        - mm * g0 * R * Math.cos(th);
    }
    function deriv(y) {
      return [y[1],
        est.W * est.W * Math.sin(y[0]) * Math.cos(y[0]) - g0 / R * Math.sin(y[0])];
    }
    function passo(y, h) {
      function soma(a, b, f) { return [a[0] + f * b[0], a[1] + f * b[1]]; }
      var k1 = deriv(y), k2 = deriv(soma(y, k1, h / 2));
      var k3 = deriv(soma(y, k2, h / 2)), k4 = deriv(soma(y, k3, h));
      return [y[0] + h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
              y[1] + h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])];
    }

    function desenhar() {
      var alt = 330;
      var p = G.preparar(cv, alt), ct = p.ct, Lp = p.L;
      ct.clearRect(0, 0, Lp, alt);
      var meia = Lp * 0.40;

      /* o aro visto de lado, com a conta */
      var esc = Math.min(meia * 0.34, alt * 0.30);
      var ox = meia * 0.5, oy = alt * 0.46;
      ct.beginPath(); ct.ellipse(ox, oy, esc * 0.42, esc, 0, 0, 2 * Math.PI);
      ct.strokeStyle = G.COR.clara; ct.lineWidth = 1.6;
      ct.setLineDash([5, 4]); ct.stroke(); ct.setLineDash([]);
      ct.beginPath(); ct.arc(ox, oy, esc, 0, 2 * Math.PI);
      ct.strokeStyle = G.COR.mestra; ct.lineWidth = 2.6; ct.stroke();
      ct.beginPath();
      ct.moveTo(ox, oy - esc * 1.25); ct.lineTo(ox, oy + esc * 1.25);
      ct.strokeStyle = G.COR.suave; ct.lineWidth = 1.4;
      ct.setLineDash([6, 4]); ct.stroke(); ct.setLineDash([]);
      rotulo(ct, 'eixo, girando a Ω', ox, oy - esc * 1.25 - 14, G.COR.suave);

      var bx = ox + esc * Math.sin(s[0]), by = oy + esc * Math.cos(s[0]);
      ct.beginPath(); ct.arc(bx, by, 9, 0, 2 * Math.PI);
      ct.fillStyle = G.COR.vinho; ct.fill();
      ct.strokeStyle = '#fff'; ct.lineWidth = 2; ct.stroke();
      rotulo(ct, 'θ = ' + F.fmt(s[0] * 180 / Math.PI, 1) + '°', ox, oy + esc * 1.25 + 16,
        G.COR.suave);

      /* painel 2: H e E ao longo do tempo */
      hist.push([est.t, Hfun(s[0], s[1]), Efun(s[0], s[1])]);
      if (hist.length > 1600) hist.shift();
      var vmin = 1e9, vmax = -1e9;
      hist.forEach(function (q) {
        vmin = Math.min(vmin, q[1], q[2]); vmax = Math.max(vmax, q[1], q[2]);
      });
      if (vmax - vmin < 1) { vmax += 0.5; vmin -= 0.5; }
      var g2 = G.eixos(cv, {
        altura: alt, xmin: Math.max(0, est.t - 12), xmax: Math.max(12, est.t),
        ymin: vmin - 0.5, ymax: vmax + 0.5,
        rotX: 't (s)', rotY: 'J por kg',
        marcasX: G.marcasLineares(Math.max(0, est.t - 12), Math.max(12, est.t), 6, 0),
        formataY: function (v) { return F.fmt(v, 1); },
        limpar: false, margem: { e: meia + 60, d: 16, c: 16, b: 40 }
      });
      var c2 = g2.ct;
      [[1, G.COR.mestra, 2.8], [2, G.COR.vinho, 2.2]].forEach(function (par) {
        c2.beginPath();
        var primeiro = true;
        hist.forEach(function (q) {
          if (q[0] < g2.xmin) { primeiro = true; return; }
          var X = g2.X(q[0]), Y = g2.Y(q[par[0]]);
          if (primeiro) { c2.moveTo(X, Y); primeiro = false; } else c2.lineTo(X, Y);
        });
        c2.strokeStyle = par[1]; c2.lineWidth = par[2]; c2.stroke();
      });
      G.legenda(g2, [
        { texto: 'H', cor: G.COR.mestra },
        { texto: 'E = T + V', cor: G.COR.vinho }
      ]);

      var wc = Math.sqrt(g0 / R);
      var temEq = est.W * est.W > g0 / R;
      mostrar({
        H: F.fmt(Hfun(s[0], s[1]), 5),
        E: F.fmt(Efun(s[0], s[1]), 5),
        dif: F.fmt(Efun(s[0], s[1]) - Hfun(s[0], s[1]), 5),
        wc: F.fmt(wc, 3) + ' rad/s',
        eq: temEq ? F.fmt(Math.acos(g0 / (R * est.W * est.W)) * 180 / Math.PI, 1) + '°'
          : 'não existe (Ω pequeno demais)',
        pot: F.fmt(mm * R * R * est.W * est.W * Math.sin(s[0]) * Math.cos(s[0]) * s[1], 4)
          + ' W por kg'
      });

      nota.innerHTML =
        '<p>Uma conta desliza sem atrito num aro de raio \\(R\\) que um motor obriga a girar '
        + 'com velocidade angular <strong>constante</strong> \\(\\Omega\\) em torno de um '
        + 'diâmetro vertical. Com \\(\\theta\\) medido a partir do fundo, a posição depende '
        + 'explicitamente do tempo, porque o aro gira:</p>'
        + '\\[x=R\\sen\\theta\\cos\\Omega t,\\quad y=R\\sen\\theta\\sen\\Omega t,'
        + '\\quad z=-R\\cos\\theta.\\]'
        + '<p>Mesmo assim a lagrangiana não contém \\(t\\) explicitamente, porque o giro entra '
        + 'apenas pelo quadrado:</p>'
        + '\\[\\Lag=\\tfrac12mR^2\\dot\\theta^2+\\tfrac12mR^2\\Omega^2\\sen^2\\theta'
        + '+mgR\\cos\\theta.\\]'
        + '<p>Com \\(p_\\theta=mR^2\\dot\\theta\\), a hamiltoniana fica</p>'
        + '\\[H=\\frac{p_\\theta^2}{2mR^2}-\\tfrac12mR^2\\Omega^2\\sen^2\\theta'
        + '-mgR\\cos\\theta,\\]'
        + '<p>enquanto a energia verdadeira é</p>'
        + '\\[E=T+V=\\frac{p_\\theta^2}{2mR^2}+\\tfrac12mR^2\\Omega^2\\sen^2\\theta'
        + '-mgR\\cos\\theta.\\]'
        + '<p>Repare no sinal do termo central: ele é o <em>mesmo</em> termo com sinais '
        + 'opostos. O gráfico mostra a consequência, e ela é desconcertante na primeira vez: '
        + '\\(H\\) é uma reta horizontal, perfeitamente conservada, e não é a energia; '
        + '\\(E\\) oscila, é a energia de verdade, e não se conserva.</p>'
        + '<p>A razão física é que o motor realiza trabalho. Para manter \\(\\Omega\\) '
        + 'constante enquanto a conta sobe e desce, ele precisa fornecer ou retirar energia, '
        + 'e o cartão da potência mede isso. O vínculo depende do tempo, e vínculos que '
        + 'dependem do tempo realizam trabalho.</p>'
        + '<p>A moral vale guardar: \\(H\\) se conserva quando \\(\\partial H/\\partial t=0\\), '
        + 'e \\(H\\) é a energia quando as transformações de coordenadas não dependem do tempo '
        + 'e \\(T\\) é quadrática nas velocidades. São duas condições <strong>independentes</strong>, '
        + 'e aqui a primeira vale e a segunda falha.</p>'
        + '<p>O termo negativo em \\(H\\) tem leitura própria: ele é um potencial '
        + 'centrífugo, e \\(U_{\\rm ef}=-\\tfrac12mR^2\\Omega^2\\sen^2\\theta-mgR\\cos\\theta\\) '
        + 'é o potencial efetivo visto do aro. Derivando, o fundo deixa de ser equilíbrio '
        + 'estável quando \\(\\Omega^2>g/R\\), e aparece um equilíbrio novo em '
        + '\\(\\cos\\theta_0=g/R\\Omega^2\\). Aumente o \\(\\Omega\\) além de '
        + F.fmt(Math.sqrt(g0 / R), 2) + ' rad/s e veja a conta passar a oscilar em torno de '
        + 'um ângulo que não é o fundo: é uma bifurcação, e é o mesmo mecanismo do regulador '
        + 'centrífugo das máquinas a vapor.</p>';
      tipografar(corpo);
    }

    registrarRedesenho(desenhar);
    (function animar() {
      if (est.rodando) {
        for (var i = 0; i < 5; i++) { s = passo(s, 0.004); est.t += 0.004; }
        desenhar();
      }
      requestAnimationFrame(animar);
    })();
  };

  /* ---------- inicialização ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    Array.prototype.forEach.call(document.querySelectorAll('[data-widget]'), function (n) {
      var f = REGISTRO[n.getAttribute('data-widget')];
      if (f) {
        try { f(n); }
        catch (e) {
          n.innerHTML = '<div class="saida">Não foi possível carregar este componente.</div>';
          if (window.console) console.error(e);
        }
      }
    });
  });
})();
