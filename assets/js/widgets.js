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
     A derivação alternativa da altura da maré, que dispensa resolver
     hidrodinâmica: um tubo vertical na maré alta e um horizontal ao
     longo da superfície, e a condição de que a água não escoe de um
     para o outro. A figura mostra de onde vem cada termo da conta.
     ================================================================= */
  REGISTRO.tubos = function (raiz) {
    var GN = 6.67430e-11, RT = 6.371e6, g0 = 9.81;
    var LUA = { M: 7.342e22, D: 3.844e8 };
    var est = { th: 45, exa: 1 };

    var corpo = moldura(raiz, 'Os dois tubos: de onde sai a altura da maré');

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'posição do tubo vertical', 2, 88, 1, 45,
      function (v) { est.th = v; desenhar(); }, function (v) { return v + '°'; });

    var mostrar = cartoes(corpo, [
      { rot: 'força tangencial aqui', k: 'ft' },
      { rot: 'onde ela é máxima', k: 'max' },
      { rot: 'integral de 0 a 90°', k: 'int' },
      { rot: 'altura de equilíbrio h', k: 'h' },
      { rot: 'pressão na base ρgh', k: 'pr' },
      { rot: 'comprimento do arco', k: 'arco' }
    ]);
    var nota = el('div', { class: 'saida' });
    corpo.appendChild(nota);

    var A0 = GN * LUA.M * RT / Math.pow(LUA.D, 3);     // amplitude de maré
    function tang(thg) {
      return 1.5 * A0 * Math.sin(2 * thg * Math.PI / 180);
    }
    var H = 1.5 * GN * LUA.M * RT * RT / (g0 * Math.pow(LUA.D, 3));

    function desenhar() {
      var alt = 330;
      var p = G.preparar(cv, alt), ct = p.ct, Lp = p.L;
      ct.clearRect(0, 0, Lp, alt);

      /* um quadrante da Terra, do ponto sublunar (0°) à maré baixa (90°).
         O centro fica fora do quadro, embaixo à direita. */
      var R = Math.min(alt * 1.55, Lp * 0.78);
      var cx = Lp * 0.86, cy = alt + R * 0.34;
      var th0 = -Math.PI / 2, th9 = -Math.PI / 2 - Math.PI / 2 * 0.62;
      function sup(f) {               // f de 0 (maré alta) a 1 (maré baixa)
        var a = th0 + (th9 - th0) * f;
        return [cx + R * Math.cos(a), cy + R * Math.sin(a), a];
      }

      /* a superfície sem maré */
      ct.beginPath();
      for (var i = 0; i <= 120; i++) {
        var q = sup(i / 120);
        (i ? ct.lineTo : ct.moveTo).call(ct, q[0], q[1]);
      }
      ct.strokeStyle = G.COR.mestra; ct.lineWidth = 2.4; ct.stroke();
      ct.fillStyle = 'rgba(23,107,93,.07)';
      ct.lineTo(cx, cy); ct.closePath(); ct.fill();

      /* o tubo horizontal, colado à superfície */
      ct.beginPath();
      for (var i2 = 0; i2 <= 120; i2++) {
        var q2 = sup(i2 / 120), d = 13;
        ct.lineTo(q2[0] - d * Math.cos(q2[2]), q2[1] - d * Math.sin(q2[2]));
      }
      for (var i3 = 120; i3 >= 0; i3--) {
        var q3 = sup(i3 / 120);
        ct.lineTo(q3[0], q3[1]);
      }
      ct.closePath();
      ct.fillStyle = 'rgba(44,95,141,.16)'; ct.fill();
      ct.strokeStyle = G.COR.azul; ct.lineWidth = 1.4;
      ct.setLineDash([5, 4]); ct.stroke(); ct.setLineDash([]);

      /* a força tangencial ao longo do arco, apontando para a maré alta */
      for (var k = 1; k <= 11; k++) {
        var f = k / 12, q4 = sup(f);
        var thg = f * 90;
        var m = tang(thg) / (1.5 * A0);
        var tx = Math.sin(q4[2]), ty = -Math.cos(q4[2]);  // sentido de f decrescente
        var L2 = 10 + 30 * m;
        seta(ct, q4[0] - 6 * Math.cos(q4[2]), q4[1] - 6 * Math.sin(q4[2]),
          q4[0] - 6 * Math.cos(q4[2]) + tx * L2, q4[1] - 6 * Math.sin(q4[2]) + ty * L2,
          G.COR.vinho, 1.8);
      }

      /* o tubo vertical, na posição escolhida */
      var fv = est.th / 90, qv = sup(fv);
      var hpx = 74, larg = 17;
      var nx = Math.cos(qv[2]), ny = Math.sin(qv[2]);     // para fora
      var ux = -ny, uy = nx;                              // ao longo da superfície
      ct.beginPath();
      ct.moveTo(qv[0] - ux * larg / 2, qv[1] - uy * larg / 2);
      ct.lineTo(qv[0] - ux * larg / 2 + nx * hpx, qv[1] - uy * larg / 2 + ny * hpx);
      ct.lineTo(qv[0] + ux * larg / 2 + nx * hpx, qv[1] + uy * larg / 2 + ny * hpx);
      ct.lineTo(qv[0] + ux * larg / 2, qv[1] + uy * larg / 2);
      ct.closePath();
      ct.fillStyle = 'rgba(44,95,141,.3)'; ct.fill();
      ct.strokeStyle = G.COR.azul; ct.lineWidth = 2; ct.stroke();

      /* o peso da coluna e a pressão que ele estabelece na base */
      seta(ct, qv[0] + nx * hpx * 0.78, qv[1] + ny * hpx * 0.78,
        qv[0] + nx * hpx * 0.18, qv[1] + ny * hpx * 0.18, G.COR.tinta, 2.4);
      rotulo(ct, 'peso ρgh', qv[0] + nx * hpx * 0.55 + ux * 30,
        qv[1] + ny * hpx * 0.55 + uy * 30, G.COR.tinta);
      rotulo(ct, 'h', qv[0] + nx * hpx * 0.5 - ux * 26,
        qv[1] + ny * hpx * 0.5 - uy * 26, G.COR.azul);

      /* rótulos dos extremos */
      var qa = sup(0), qb = sup(1);
      rotulo(ct, 'maré alta', qa[0] + 2, qa[1] - 58, G.COR.mestra);
      rotulo(ct, '(aponta para a Lua)', qa[0] + 2, qa[1] - 42, G.COR.suave,
        'center', 'middle', '600 10px system-ui, sans-serif');
      rotulo(ct, 'maré baixa', qb[0] + 54, qb[1] + 6, G.COR.mestra, 'left');
      rotulo(ct, 'tubo horizontal, ao longo da superfície', 12, alt - 34,
        G.COR.azul, 'left');
      rotulo(ct, 'força de maré tangencial, que empurra a água', 12, alt - 16,
        G.COR.vinho, 'left');

      mostrar({
        ft: F.fmt(tang(est.th) * 1e6, 3) + ' μm/s²',
        max: '45°, com ' + F.fmt(1.5 * A0 * 1e6, 3) + ' μm/s²',
        int: F.fmt(1.5 * A0 * RT, 3) + ' J/kg',
        h: F.fmt(H * 100, 1) + ' cm',
        pr: F.fmt(1025 * g0 * H, 0) + ' Pa',
        arco: F.fmt(Math.PI * RT / 2 / 1e3, 0) + ' km'
      });

      nota.innerHTML =
        '<p>Imagine dois tubos sem paredes, cheios de água. Um é <strong>vertical</strong>, '
        + 'de altura \\(h\\), e o outro é <strong>horizontal</strong>, acompanhando a '
        + 'superfície do ponto de maré baixa até o de maré alta. Nenhum dos dois é real: são '
        + 'recortes imaginários do próprio oceano, e a pergunta é que altura \\(h\\) deixa a '
        + 'água em repouso nos dois.</p>'
        + '<p>A coluna vertical tem peso, e na sua base estabelece uma pressão excedente</p>'
        + '\\[\\Delta p=\\varrho\\,g\\,h.\\]'
        + '<p>Essa pressão empurra a água de volta para dentro do tubo horizontal. Para que '
        + 'nada escoe, alguém tem de empurrar a água no sentido contrário, e esse alguém é a '
        + '<strong>componente tangencial</strong> da força de maré, desenhada em vinho. Ela é '
        + 'nula nos dois extremos, máxima a 45°, e aponta sempre para o ponto de maré '
        + 'alta.</p>'
        + '<p>O trabalho dessa força por unidade de massa, ao longo do arco de quadrante, '
        + 'tem de igualar \\(gh\\):</p>'
        + '\\[g\\,h=\\int_0^{\\pi/2}a_\\theta\\,R\\,d\\theta'
        + '=\\int_0^{\\pi/2}\\frac{3}{2}\\frac{GM_LR}{D^3}\\sen2\\theta\\;R\\,d\\theta'
        + '=\\frac{3}{2}\\frac{GM_LR^2}{D^3},\\]'
        + '<p>de onde sai, sem resolver equação de movimento nenhuma,</p>'
        + '\\[h=\\frac{3}{2}\\,\\frac{GM_LR^2}{g\\,D^3}=' + F.fmt(H * 100, 1)
        + '\\ \\text{cm}.\\]'
        + '<p>Repare no que o argumento dispensa. Não houve dinâmica, nem equação de onda, '
        + 'nem atrito: só a exigência de que, no estado final, a água não tenha para onde '
        + 'escorrer. É um argumento de <strong>equilíbrio</strong>, e por isso o resultado se '
        + 'chama maré de equilíbrio. Os ' + F.fmt(1025 * g0 * H, 0) + ' Pa de pressão '
        + 'excedente na base correspondem a meio metro de coluna de água do mar sobre uma '
        + 'distância de ' + F.fmt(Math.PI * RT / 2 / 1e3, 0) + ' km de arco: uma rampa de uma '
        + 'parte em vinte milhões, que é o quanto a maré realmente inclina o oceano.</p>';
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
      var melhor = -0.35, vm = Infinity;
      for (var a = -0.35; a <= 0.701; a += 0.005) {
        var v = valor(k, a);
        if (v < vm) { vm = v; melhor = a; }
      }
      return melhor;
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
      rotulo(ct, 'mínimo em a = ' + F.fmt(am, 2), gr.X(am), gr.Y(vm) - 16, G.COR.bronze);
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

    /* cada caminho devolve y(x) e, por integração, o tempo acumulado */
    function caminhos() {
      var th1 = thetaFinal(), R = YB / (1 - Math.cos(th1));
      return [
        { n: 'reta', cor: G.COR.suave,
          pt: function (u) { return [est.xb * u, YB * u]; } },
        { n: 'arco de círculo', cor: G.COR.bronze,
          pt: function (u) {
            /* arco que passa por A e B com tangente vertical em A */
            var r = (est.xb * est.xb + YB * YB) / (2 * est.xb);
            var fi = u * Math.atan2(est.xb - 0, r - 0) * 0 + u * Math.acos(
              Math.max(-1, Math.min(1, (r - est.xb) / r * 0 + 1 - est.xb * est.xb /
                (2 * r * r) * 0)));
            return null;
          } },
        { n: 'ciclóide', cor: G.COR.mestra,
          pt: function (u) {
            var th = th1 * u;
            return [R * (th - Math.sin(th)), R * (1 - Math.cos(th))];
          } }
      ];
    }

    /* o arco de círculo de Galileu: circunferência por A e B com
       tangente vertical em A, parametrizada pelo ângulo central */
    function arco() {
      var r = (est.xb * est.xb + YB * YB) / (2 * YB);
      /* centro em (0, r); A = (0,0); B tem de estar na circunferência */
      var fiB = Math.atan2(est.xb, r - YB);
      return { r: r, fiB: fiB,
        pt: function (u) {
          var fi = fiB * u;
          return [r * Math.sin(fi), r * (1 - Math.cos(fi))];
        } };
    }

    /* tabela tempo → posição ao longo de um caminho, por quadratura
       de dt = ds/√(2gy) com o ponto médio, que evita a singularidade */
    function tabela(pt) {
      var N = 600, tt = [0], acc = 0, ant = pt(0);
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

    function pistas() {
      var th1 = thetaFinal(), R = YB / (1 - Math.cos(th1)), A = arco();
      return [
        { n: 'reta', cor: G.COR.vinho,
          pt: function (u) { return [est.xb * u, YB * u]; } },
        { n: 'arco de círculo', cor: G.COR.bronze, pt: A.pt },
        { n: 'ciclóide', cor: G.COR.mestra,
          pt: function (u) {
            var th = th1 * u;
            return [R * (th - Math.sin(th)), R * (1 - Math.cos(th))];
          } }
      ];
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
        var tt = tabela(q.pt);
        ct.beginPath();
        for (var i = 0; i <= 200; i++) {
          var r = q.pt(i / 200);
          (i ? ct.lineTo : ct.moveTo).call(ct, X(r[0]), Y(r[1]));
        }
        ct.strokeStyle = q.cor; ct.lineWidth = 2.2; ct.stroke();
        q.T = tt[tt.length - 1];
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
    var est = { n: 5, e: 1 };

    var corpo = moldura(raiz, 'O problema de Dido: perímetro fixo, área máxima');

    var cv = el('canvas');
    corpo.appendChild(cv);

    var ctr = el('div', { class: 'controles' });
    corpo.appendChild(ctr);
    deslizante(ctr, 'lados do polígono regular', 3, 24, 1, 5,
      function (v) { est.n = v; desenhar(); },
      function (v) { return v >= 24 ? 'círculo' : v + ' lados'; });
    deslizante(ctr, 'achatamento da elipse', 0.15, 1, 0.01, 1,
      function (v) { est.e = v; desenhar(); },
      function (v) { return v >= 0.995 ? 'círculo' : F.fmt(v, 2); });

    var mostrar = cartoes(corpo, [
      { rot: 'área do polígono', k: 'ap' },
      { rot: 'área da elipse', k: 'ae' },
      { rot: 'área do círculo', k: 'ac' },
      { rot: 'polígono / círculo', k: 'rp' },
      { rot: 'elipse / círculo', k: 're' },
      { rot: 'razão isoperimétrica 4πA/P²', k: 'iso' }
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
