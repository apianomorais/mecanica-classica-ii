# -*- coding: utf-8 -*-
"""Vigas rígidas sobre apoios elásticos: o que a lei constitutiva decide.

O QUE RESOLVE
    1. Monta e resolve o sistema de dois graus de liberdade de uma viga
       rígida sobre um número qualquer de molas, e confere o resultado
       contra a minimização direta da energia potencial.
    2. A viga sobre três molas, com a carga passeando, até uma reação ficar
       negativa.
    3. A viga pendurada por três tirantes de materiais diferentes, em que a
       carga se reparte na razão das rigidezes.
    4. A mesa de quatro pernas, com três graus de liberdade e uma perna
       curta, resolvida com contato que só empurra.
    5. A base elástica contínua, e a regra do terço médio deduzida e depois
       localizada por medida.

A FISICA
    Uma viga rigida apoiada em mais de dois pontos e hiperestatica: ha mais
    reacoes do que equacoes de equilibrio, e a estatica do corpo rigido nao
    tem como decidir. A saida nao e matematica, e fisica: nenhum apoio e
    rigido de verdade, todos cedem, e quanto cada um cede decide quanto ele
    carrega.

    Admitindo que a viga permanece reta, o deslocamento dela e uma funcao
    linear da posicao, com dois parametros. Qualquer numero de molas cabe
    nesses dois parametros, e por isso o problema volta a ter solucao unica
    por mais apoios que existam. A chave nao e contar incognitas: e notar
    que o corpo rigido so tem dois graus de liberdade.

COMO CONFERIR SE ESTA CERTO
    1. As reacoes tem de satisfazer as duas equacoes de equilibrio em erro
       de maquina, e tem de coincidir com o minimo da energia potencial
       calculado por outro caminho.
    2. Carregando no centro de rigidez, a viga tem de descer sem girar.
    3. Com molas iguais e carga no meio, cada mola leva a mesma fracao.
    4. A regra do terco medio tem de aparecer sozinha quando se procura a
       excentricidade em que a pressao de borda chega a zero.

Prof. Apiano Morais - LFCA/URCA - Mecanica Classica II
"""

import numpy as np
from scipy.optimize import minimize


# ---------------------------------------------------------------------------
# o sistema de dois graus de liberdade
# ---------------------------------------------------------------------------


def resolve_viga(xs, ks, cargas):
    """Viga rígida sobre molas: devolve (a, b, reações).

    A viga permanece reta, de modo que o deslocamento para baixo vale
    w(x) = a + b x. Cada mola reage com R_i = k_i w(x_i). As duas equações
    de equilíbrio, em força e em momento, fecham o problema qualquer que
    seja o número de molas.

    `cargas` é uma lista de pares (posição, valor), com valor positivo para
    baixo.
    """
    xs = np.asarray(xs, float)
    ks = np.asarray(ks, float)
    s0 = ks.sum()
    s1 = (ks * xs).sum()
    s2 = (ks * xs ** 2).sum()
    P = sum(p for _, p in cargas)
    M = sum(p * x for x, p in cargas)
    a, b = np.linalg.solve(np.array([[s0, s1], [s1, s2]]), np.array([P, M]))
    return a, b, ks * (a + b * xs)


def energia(xs, ks, cargas, a, b):
    """Energia potencial total: a elástica das molas menos o trabalho da carga."""
    xs = np.asarray(xs, float)
    ks = np.asarray(ks, float)
    elastica = 0.5 * (ks * (a + b * xs) ** 2).sum()
    trabalho = sum(p * (a + b * x) for x, p in cargas)
    return elastica - trabalho


def por_energia(xs, ks, cargas, escala=1e-3):
    """O mesmo problema, resolvido minimizando a energia. Rota independente.

    A minimização é feita em variáveis escaladas: a e b valem milésimos, e
    um minimizador que não saiba disso para cedo demais e devolve uma
    concordância pior do que a real.
    """
    def f(v):
        return energia(xs, ks, cargas, v[0] * escala, v[1] * escala)
    r = minimize(f, x0=[0.0, 0.0], method='Nelder-Mead',
                 options={'xatol': 1e-13, 'fatol': 1e-13, 'maxiter': 100000,
                          'maxfev': 100000})
    return r.x * escala


def centro_rigidez(xs, ks):
    """Onde se pode carregar sem fazer a viga girar, e a rigidez à rotação."""
    xs = np.asarray(xs, float)
    ks = np.asarray(ks, float)
    xc = (ks * xs).sum() / ks.sum()
    ik = (ks * (xs - xc) ** 2).sum()
    return xc, ik


# ---------------------------------------------------------------------------
# a mesa: três graus de liberdade e contato que só empurra
# ---------------------------------------------------------------------------


def resolve_mesa(pts, ks, cargas, folgas=None):
    """Corpo rígido sobre apoios num plano: w(x,y) = a + b x + c y.

    `folgas` é o quanto cada pé é curto: ele só toca depois que o tampo
    desce isso. Pés que resultariam tracionados são removidos e o sistema é
    resolvido de novo, até que todos os que restam estejam comprimidos. É o
    contato unilateral, e sem ele a conta devolve um pé puxando o chão.
    """
    pts = np.asarray(pts, float)
    ks = np.asarray(ks, float)
    g = np.zeros(len(ks)) if folgas is None else np.asarray(folgas, float)
    ativos = np.ones(len(ks), bool)
    for _ in range(len(ks) + 1):
        A = np.zeros((3, 3))
        rhs = np.zeros(3)
        base = np.column_stack([np.ones(len(ks)), pts[:, 0], pts[:, 1]])
        for i in np.nonzero(ativos)[0]:
            A += ks[i] * np.outer(base[i], base[i])
            rhs += ks[i] * g[i] * base[i]
        for (x, y), p in cargas:
            rhs += p * np.array([1.0, x, y])
        if np.linalg.matrix_rank(A) < 3:
            return None, None, 'apoios insuficientes para sustentar o tampo'
        sol = np.linalg.solve(A, rhs)
        w = base @ sol
        R = np.where(ativos, ks * (w - g), 0.0)
        negativos = ativos & (R < -1e-9)
        if not negativos.any():
            return sol, R, 'ok'
        # tira UM apoio de cada vez, o mais tracionado. Tirar todos os
        # negativos de uma vez pode remover apoios que voltariam a
        # comprimir depois que o primeiro sair, e chega a deixar o tampo
        # com menos de tres apoios, sem solucao.
        pior = np.where(negativos, R, np.inf).argmin()
        ativos[pior] = False
    return None, None, 'nao convergiu'


# ---------------------------------------------------------------------------


def main():
    print('=' * 72)
    print('1. O SISTEMA DE DOIS GRAUS DE LIBERDADE, CONFERIDO POR ENERGIA')
    print('=' * 72)
    xs = [0.0, 0.9, 2.4]
    ks = [4.0e6, 7.0e6, 4.0e6]
    cargas = [(1.6, 60.0e3)]
    a, b, R = resolve_viga(xs, ks, cargas)
    ae, be = por_energia(xs, ks, cargas)
    print('   Tres molas em x = 0,0 / 0,9 / 2,4 m, de 4 / 7 / 4 MN/m,')
    print('   com 60 kN em x = 1,6 m.')
    print()
    print('      pelo equilibrio:   a = %.9e m   b = %.9e' % (a, b))
    print('      pela energia:      a = %.9e m   b = %.9e' % (ae, be))
    print('      diferenca relativa: %.2e e %.2e'
          % (abs(ae / a - 1), abs(be / b - 1)))
    print()
    print('      reacoes: ' + '  '.join('%.3f kN' % (r / 1e3) for r in R))
    print('      soma das reacoes:    %.6f kN   (carga: %.6f kN)'
          % (R.sum() / 1e3, 60.0))
    print('      soma dos momentos:   %.3e N m   (residuo)'
          % (sum(r * x for r, x in zip(R, xs)) - 60.0e3 * 1.6))
    print()
    print('   Os dois caminhos dao o mesmo, como tem de dar: resolver o')
    print('   equilibrio com a lei constitutiva E minimizar a energia sao a')
    print('   mesma coisa dita de dois jeitos. O segundo caminho nao usa')
    print('   nenhuma equacao de equilibrio, e por isso serve de conferencia')
    print('   de verdade, e nao de repeticao da mesma conta.')
    print()

    print('=' * 72)
    print('2. O CENTRO DE RIGIDEZ')
    print('=' * 72)
    xc, ik = centro_rigidez(xs, ks)
    print('   Para as tres molas acima:')
    print('      centro de rigidez x_c = %.6f m' % xc)
    print('      rigidez a rotacao I_k = %.4e N m' % ik)
    print()
    print('      carga em x        giro b          desce igual?')
    for xp in (0.0, 1.0, xc, 1.5, 2.4):
        aa, bb, _ = resolve_viga(xs, ks, [(xp, 60.0e3)])
        print('      %8.4f   %+14.3e   %s'
              % (xp, bb, 'SIM, nao gira' if abs(bb) < 1e-15 else 'gira'))
    print()
    print('   Carregando exatamente no centro de rigidez a viga desce sem')
    print('   girar. O paralelo com o centro de massa e exato, trocando a')
    print('   massa pela rigidez, e o I_k faz o papel do momento de inercia:')
    print('   a viga gira em torno de x_c com "inercia" I_k.')
    print()

    print('=' * 72)
    print('3. EXEMPLO 1: VIGA RIGIDA SOBRE TRES MOLAS IGUAIS')
    print('=' * 72)
    L = 2.4
    xs1 = [0.0, L / 2, L]
    k = 4.0e6
    ks1 = [k, k, k]
    P = 60.0e3
    xc1, ik1 = centro_rigidez(xs1, ks1)
    print('   Molas iguais de %.0f MN/m em 0, %.1f e %.1f m, carga de %.0f kN.'
          % (k / 1e6, L / 2, L, P / 1e3))
    print('   Centro de rigidez em %.3f m, I_k = %.4e N m' % (xc1, ik1))
    print()
    print('      carga em x    R1 (kN)    R2 (kN)    R3 (kN)   recalque max')
    for xp in (0.0, 0.6, 1.2, 1.8, 2.4):
        aa, bb, RR = resolve_viga(xs1, ks1, [(xp, P)])
        w = aa + bb * np.array(xs1)
        print('      %8.2f  %9.3f  %9.3f  %9.3f   %8.4f mm'
              % (xp, RR[0] / 1e3, RR[1] / 1e3, RR[2] / 1e3, 1e3 * w.max()))
    print()
    print('   Com a carga no meio, cada mola leva exatamente um terco, e')
    print('   nao e obvio: numa viga FLEXIVEL sobre tres apoios rigidos o')
    print('   apoio do meio leva 11/16 da carga, muito mais que um terco. A')
    print('   diferenca nao e detalhe de conta, sao dois problemas')
    print('   diferentes, e qual deles vale depende de a viga ser rigida')
    print('   perto dos apoios ou nao.')
    print()
    aa, bb, RR = resolve_viga(xs1, ks1, [(L, P)])
    print('   Com a carga na ponta, a primeira reacao da %.3f kN: NEGATIVA.'
          % (RR[0] / 1e3))
    print('   Uma mola parafusada puxa mesmo, e o numero esta certo. Um')
    print('   simples calco apoiado nao puxa: ali a viga descola, o apoio')
    print('   sai da conta, e sobram dois apoios, o que ja e isostatico.')
    print('   Refazendo so com os dois ultimos:')
    aa2, bb2, RR2 = resolve_viga(xs1[1:], ks1[1:], [(L, P)])
    print('      R2 = %.3f kN, R3 = %.3f kN, soma = %.3f kN'
          % (RR2[0] / 1e3 + 0.0, RR2[1] / 1e3, RR2.sum() / 1e3))
    print('   e repare que agora as reacoes nao dependem mais das rigidezes:')
    print('   com dois apoios o problema voltou a ser isostatico.')
    print()

    print('=' * 72)
    print('4. EXEMPLO 2: VIGA PENDURADA POR TRES TIRANTES')
    print('=' * 72)
    print('   Uma viga rigida de 3 m pendurada por tres tirantes nas')
    print('   posicoes 0, 1,0 e 3,0 m. Cada tirante e uma mola de rigidez')
    print('   k = E A / L, e e so isso que a viga enxerga deles.')
    print()
    tir = [('aco    ', 200e9, 1.0e-4, 2.0, 0.0),
           ('aluminio', 70e9, 2.0e-4, 2.0, 1.0),
           ('aco    ', 200e9, 0.5e-4, 1.0, 3.0)]
    xs2, ks2 = [], []
    print('      material      E (GPa)  A (cm2)  L (m)   k = EA/L (MN/m)')
    for nome, E, A, Lt, x in tir:
        kk = E * A / Lt
        xs2.append(x)
        ks2.append(kk)
        print('      %-10s %8.0f %8.1f %6.1f %16.1f'
              % (nome, E / 1e9, A * 1e4, Lt, kk / 1e6))
    Pt = 90.0e3
    aa, bb, RR = resolve_viga(xs2, ks2, [(1.5, Pt)])
    print()
    print('   Carga de %.0f kN no meio (x = 1,5 m):' % (Pt / 1e3))
    print()
    print('      tirante      forca (kN)   fracao da carga   fracao da rigidez')
    st = sum(ks2)
    for (nome, E, A, Lt, x), r, kk in zip(tir, RR, ks2):
        print('      %-10s %10.3f %16.4f %18.4f'
              % (nome, r / 1e3, r / Pt, kk / st))
    print()
    print('   Com a carga no centro GEOMETRICO, que aqui nao e o centro de')
    print('   rigidez, a reparticao nao segue exatamente as rigidezes. Mas')
    print('   carregando no centro de rigidez ela segue:')
    xc2, _ = centro_rigidez(xs2, ks2)
    aa, bb, RR = resolve_viga(xs2, ks2, [(xc2, Pt)])
    print('      centro de rigidez em x = %.4f m' % xc2)
    for (nome, E, A, Lt, x), r, kk in zip(tir, RR, ks2):
        print('      %-10s %10.3f kN   fracao %.6f   rigidez %.6f'
              % (nome, r / 1e3, r / Pt, kk / st))
    print()
    print('   A licao e a que mais custa caro na pratica: a carga procura o')
    print('   caminho mais RIGIDO, nao o mais forte. O tirante de aluminio')
    print('   tem o dobro da area do primeiro e ainda assim puxa menos, e o')
    print('   terceiro, que e o mais fino de todos, e o que mais carrega, so')
    print('   porque e curto. Dimensionar pelos esforcos sem olhar as')
    print('   rigidezes e dimensionar o problema errado.')
    print()

    print('=' * 72)
    print('5. EXEMPLO 3: A MESA DE QUATRO PERNAS')
    print('=' * 72)
    a_, b_ = 1.2, 0.8
    pts = [(0.0, 0.0), (a_, 0.0), (a_, b_), (0.0, b_)]
    kp = [1.0e7] * 4
    print('   Tampo rigido de %.1f por %.1f m, quatro pernas de %.0f MN/m.'
          % (a_, b_, kp[0] / 1e6))
    print()
    sol, R, st_ = resolve_mesa(pts, kp, [((a_ / 2, b_ / 2), 400.0)])
    print('   Carga de 400 N bem no centro, chao perfeito:')
    print('      reacoes: ' + '  '.join('%.2f N' % r for r in R))
    print()
    sol, R, st_ = resolve_mesa(pts, kp, [((0.8, 0.25), 400.0)])
    print('   A mesma carga em (0,80, 0,25), fora do centro:')
    print('      reacoes: ' + '  '.join('%.2f N' % r for r in R))
    print('      soma: %.4f N' % R.sum())
    print()
    print('   Quatro reacoes, tres equacoes de equilibrio: sem a elasticidade')
    print('   das pernas o problema nao teria resposta. Com ela tem, e uma so.')
    print()
    print('   AGORA UMA PERNA CURTA, QUE E O CASO DE TODA MESA REAL')
    print()
    for curta in (0.0, 0.00002, 0.0001, 0.0005):
        sol, R, st_ = resolve_mesa(pts, kp, [((0.5, 0.3), 400.0)],
                                   folgas=[0.0, 0.0, curta, 0.0])
        marca = '' if (R > 1e-9).all() else '   <- uma perna no ar'
        print('      perna 3 curta em %.2f mm: %s%s'
              % (curta * 1e3, '  '.join('%6.1f N' % r for r in R), marca))
    lo, hi = 0.0, 1e-3
    for _ in range(60):
        m = 0.5 * (lo + hi)
        _, R, _ = resolve_mesa(pts, kp, [((0.5, 0.3), 400.0)],
                               folgas=[0.0, 0.0, m, 0.0])
        if R[2] > 1e-9:
            lo = m
        else:
            hi = m
    print()
    print('      procurando por bisseccao a folga em que a perna descola:')
    print('      ela sai do chao com %.4f mm, isto e, com um quadragesimo'
          % (lo * 1e3))
    print('      de milimetro: uma folha de papel comum, com os seus 0,1 mm,')
    print('      e quatro vezes mais grossa que a folga que basta.')
    print()
    print('   Bastam dois centesimos de milimetro para a mesa apoiar em tres')
    print('   pernas. A quarta nao fica com reacao pequena: fica com reacao')
    print('   NULA, porque um pe nao puxa o chao. Dai o balanco: a mesa cai')
    print('   para um lado ou para o outro, e os dois estados sao de')
    print('   equilibrio. O programa trata isso removendo os apoios que')
    print('   dariam reacao negativa e refazendo a conta.')
    print()

    print('=' * 72)
    print('6. EXEMPLO 4: BASE ELASTICA CONTINUA E O TERCO MEDIO')
    print('=' * 72)
    Lb = 3.0
    kw = 2.0e7              # N/m por metro de comprimento
    Pb = 300.0e3
    print('   Sapata rigida de %.1f m sobre solo de modulo %.0f MN/m por' % (Lb, kw / 1e6))
    print('   metro, com carga de %.0f kN a uma distancia e do centro.' % (Pb / 1e3))
    print()
    print('   As somas viram integrais, e o sistema e o mesmo de duas')
    print('   incognitas. A pressao sob a sapata sai LINEAR em x:')
    print('      p(x) = P/L + 12 P e (x - L/2)/L^3')
    print()
    print('      e (m)    e/L      p(0) (kPa)   p(L) (kPa)   borda levanta?')
    for e in (0.0, 0.25, 0.5, Lb / 6, 0.55, 0.75):
        p0 = Pb / Lb - 6 * Pb * e / Lb ** 2
        pL = Pb / Lb + 6 * Pb * e / Lb ** 2
        print('      %.4f  %.5f  %11.2f  %11.2f   %s'
              % (e, e / Lb, p0 / 1e3, pL / 1e3,
                 'SIM' if p0 < -1e-9 else ('no limite' if abs(p0) < 1e-9 else 'nao')))
    print()
    # localiza por busca o e em que p(0) chega a zero
    lo, hi = 0.0, Lb / 2
    for _ in range(80):
        m = 0.5 * (lo + hi)
        if Pb / Lb - 6 * Pb * m / Lb ** 2 > 0:
            lo = m
        else:
            hi = m
    print('   Procurando por bisseccao o e em que a pressao de borda zera:')
    print('      e limite medido: %.9f m' % lo)
    print('      L/6:             %.9f m' % (Lb / 6))
    print('      razao:           %.12f' % (lo / (Lb / 6)))
    print()
    print('   O limite e exatamente L/6 para cada lado, isto e, a carga tem')
    print('   de cair no TERCO MEDIO da base. Fora dele a sapata levanta de')
    print('   um lado, a area de contato diminui, e a pressao no outro lado')
    print('   sobe mais depressa do que a formula linear preve. E a regra do')
    print('   terco medio da engenharia de fundacoes, e ela sai inteira das')
    print('   mesmas duas equacoes dos exemplos anteriores: nao ha nada de')
    print('   novo aqui alem de trocar somas por integrais.')
    print()
    print('   O resultado tambem nao depende de k. Dobrar a rigidez do solo')
    print('   dobra as pressoes e dobra os recalques, e deixa o terco medio')
    print('   onde estava, porque ele e geometria.')
    print()


if __name__ == '__main__':
    main()
