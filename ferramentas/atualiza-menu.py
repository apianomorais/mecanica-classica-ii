#!/usr/bin/env python3
"""Reescreve o menu de navegacao e a navegacao de rodape em todas as paginas.

Uso:  python3 ferramentas/atualiza-menu.py
Roda a partir da raiz do site. A unica fonte de verdade e a lista UNIDADES
abaixo: mudando a ordem ali, o menu do topo e as setas anterior/proximo de
todas as paginas se reorganizam sozinhos. Modulos ainda nao escritos sao
simplesmente ignorados, de modo que o site nunca aponta para pagina vazia.
"""
import glob
import os
import re

# (numero, titulo curto para o menu, titulo para a seta do rodape)
TITULOS = {
    1: ("Cinemática dos corpos rígidos", "Cinemática dos corpos rígidos"),
    2: ("Centro de massa e momentos de inércia", "Centro de massa e inércia"),
    3: ("Momento angular, torque e equações de movimento", "Momento angular e torque"),
    4: ("Conservação e equilíbrio estático", "Conservação e equilíbrio"),
    5: ("Vigas: cortante, momento fletor, linha elástica e torção", "Vigas e torção"),
    6: ("Matrizes de rotação e transformações de coordenadas", "Matrizes de rotação"),
    7: ("Referenciais em rotação e forças fictícias", "Referenciais em rotação"),
    8: ("Cálculo variacional: ação e caminhos extremos", "Cálculo variacional"),
    9: ("A equação de Euler-Lagrange e o princípio de Hamilton", "Euler-Lagrange"),
    10: ("Coordenadas generalizadas, vínculos e equações de Lagrange", "Equações de Lagrange"),
    11: ("Aplicações do formalismo lagrangiano", "Aplicações de Lagrange"),
    12: ("Transformação de Legendre e equações de Hamilton", "Equações de Hamilton"),
    13: ("Espaço de fase e o teorema de Liouville", "Liouville"),
}

UNIDADES = [
    ("Corpos rígidos", "Corpos rígidos", [1, 2, 3, 4, 5]),
    ("Sistemas de coordenadas em movimento", "Referenciais", [6, 7]),
    ("Noções de cálculo variacional", "Variacional", [8, 9]),
    ("Formalismo lagrangiano e hamiltoniano", "Lagrange e Hamilton", [10, 11, 12, 13]),
]

# o que vai no chapéu de cada página, logo acima do título
CHAPEU = {n: nome for nome, _curto, ns in UNIDADES for n in ns}

# ordem linear em que as setas anterior/proximo caminham
ORDEM = [n for _, _, ns in UNIDADES for n in ns]


def existentes():
    return {n for n in TITULOS if os.path.exists("aula%02d.html" % n)}


def monta_menu(pagina_atual):
    def link(href, texto, titulo=None, classe=""):
        at = ' class="%s"' % (classe + (" ativo" if href == pagina_atual else "")).strip() \
            if (classe or href == pagina_atual) else ""
        tt = ' title="%s"' % titulo if titulo else ""
        return '<a href="%s"%s%s>%s</a>' % (href, at, tt, texto)

    tem = existentes()
    partes = [link("index.html", "Início")]

    for _, curto, numeros in UNIDADES:
        presentes = [n for n in numeros if n in tem]
        if not presentes:
            continue
        partes.append('<span class="grupo">%s</span>' % curto)
        for n in presentes:
            partes.append(link("aula%02d.html" % n, str(n),
                               "Módulo %d: %s" % (n, TITULOS[n][0]), "num"))

    if os.path.exists("formulario.html"):
        partes.append(link("formulario.html", "Formulário"))
    return "\n      " + "\n      ".join(partes) + "\n    "


def monta_rodape(n):
    """Setas anterior/proximo para o modulo n, segundo ORDEM."""
    tem = existentes()
    seq = [m for m in ORDEM if m in tem]
    if n not in seq:
        return None
    i = seq.index(n)
    partes = []

    if i > 0:
        a = seq[i - 1]
        partes.append('<a href="aula%02d.html"><small>Módulo anterior</small>'
                      '← %d. %s</a>' % (a, a, TITULOS[a][1]))
    else:
        partes.append('<a href="index.html"><small>Voltar</small>← Início</a>')

    if i < len(seq) - 1:
        b = seq[i + 1]
        partes.append('<a class="prox" href="aula%02d.html"><small>Próximo módulo</small>'
                      '%d. %s →</a>' % (b, b, TITULOS[b][1]))
    else:
        prox = min((m for m in ORDEM if m not in tem), default=None)
        if prox:
            partes.append('<span class="em-breve"><small>Em preparação</small>'
                          '%d. %s</span>' % (prox, TITULOS[prox][1]))
        else:
            partes.append('<a class="prox" href="index.html">'
                          '<small>Voltar</small>Página inicial →</a>')

    return "\n    " + "\n    ".join(partes) + "\n  "


def main():
    paginas = sorted(glob.glob("*.html"))
    pad_menu = re.compile(r'<nav class="menu">.*?</nav>', re.S)
    pad_rod = re.compile(r'<nav class="nav-aulas">.*?</nav>', re.S)

    for p in paginas:
        texto = open(p, encoding="utf-8").read()
        original = texto

        if pad_menu.search(texto):
            novo = '<nav class="menu">%s</nav>' % monta_menu(p)
            texto = pad_menu.sub(lambda _: novo, texto, count=1)
        else:
            print('AVISO: nenhum <nav class="menu"> em', p)

        m = re.match(r'aula(\d{2})\.html$', p)
        if m:
            n = int(m.group(1))
            if n in CHAPEU:
                texto = re.sub(
                    r'(<p class="chapeu">)Módulo \d+[^<]*(</p>)',
                    lambda _: '<p class="chapeu">Módulo %d · %s</p>' % (n, CHAPEU[n]),
                    texto, count=1)
            if n in TITULOS:
                # o <title> também sai daqui: numa renumeração, esquecer dele
                # deixa a aba do navegador apontando para o módulo errado, que
                # é o tipo de erro que ninguém vê revisando a página
                texto = re.sub(
                    r'<title>Módulo \d+:[^<]*</title>',
                    lambda _: '<title>Módulo %d: %s | Mecânica Clássica II</title>'
                              % (n, TITULOS[n][0]),
                    texto, count=1)
            rod = monta_rodape(n)
            if rod and pad_rod.search(texto):
                novo = '<nav class="nav-aulas">%s</nav>' % rod
                texto = pad_rod.sub(lambda _: novo, texto, count=1)
            elif rod:
                print('AVISO: nenhum <nav class="nav-aulas"> em', p)

        if texto != original:
            open(p, "w", encoding="utf-8").write(texto)
            print("atualizado:", p)


if __name__ == "__main__":
    main()
