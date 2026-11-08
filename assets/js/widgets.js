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
  function rotulo(ct, texto, x, y, cor, al, bl, fonte) {
    ct.save();
    ct.font = fonte || '600 11px system-ui, sans-serif';
    ct.textAlign = al || 'center'; ct.textBaseline = bl || 'middle';
    ct.lineJoin = 'round'; ct.lineWidth = 3.5; ct.strokeStyle = '#fff';
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
