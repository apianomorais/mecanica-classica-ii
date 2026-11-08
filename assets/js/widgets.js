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

    /* ---- álgebra de matrizes 3×3 ---- */
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
    /* ângulo e eixo de uma rotação, pelo traço e pela parte antissimétrica */
    function anguloEixo(A) {
      var tr = A[0][0] + A[1][1] + A[2][2];
      var c = Math.max(-1, Math.min(1, (tr - 1) / 2));
      var ang = Math.acos(c);
      var e = [A[2][1] - A[1][2], A[0][2] - A[2][0], A[1][0] - A[0][1]];
      var n = Math.sqrt(e[0] * e[0] + e[1] * e[1] + e[2] * e[2]);
      if (n < 1e-9) return { ang: ang, eixo: null };
      return { ang: ang, eixo: [e[0] / n, e[1] / n, e[2] / n] };
    }

    /* ---- o cubo e a sua projeção ---- */
    var VIS = mul(Rz(-0.62), Rx(-1.14));   // ponto de vista fixo
    var FACES = [
      { v: [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]], c: '#c9e2dc', r: 'D' },
      { v: [[-1, -1, -1], [-1, 1, -1], [-1, 1, 1], [-1, -1, 1]], c: '#e9e2cf', r: 'E' },
      { v: [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]], c: '#f0d9d6', r: 'T' },
      { v: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]], c: '#d9d6ea', r: 'F' },
      { v: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], c: '#ffffff', r: 'C' },
      { v: [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1]], c: '#dfe4e2', r: 'B' }
    ];

    function cubo(ct, cx, cy, s, R) {
      var faces = FACES.map(function (f) {
        var pts = f.v.map(function (v) { return apl(mul(VIS, R), v); });
        var prof = pts.reduce(function (a, p) { return a + p[1]; }, 0) / 4;
        return { pts: pts, prof: prof, c: f.c, r: f.r };
      });
      faces.sort(function (a, b) { return b.prof - a.prof; });
      faces.forEach(function (f) {
        ct.beginPath();
        f.pts.forEach(function (p, i) {
          var x = cx + p[0] * s, y = cy - p[2] * s;
          (i ? ct.lineTo : ct.moveTo).call(ct, x, y);
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
