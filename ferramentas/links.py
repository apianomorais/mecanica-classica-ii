#!/usr/bin/env python3
"""Insere hyperlinks na primeira ocorrencia de cada nome ou conceito.

Uso:  python3 ferramentas/links.py
Roda a partir da raiz do site. So mexe no miolo de <main>, nunca no menu,
no rodape ou dentro de formulas. Cada termo e ligado uma vez por pagina.
Rodar de novo nao duplica nada, porque termos ja dentro de <a> sao
ignorados.
"""
import io
import os
import re

PT = 'https://pt.wikipedia.org/wiki/'
EN = 'https://en.wikipedia.org/wiki/'

# (expressao a casar, destino). A ordem importa: o que vem antes ganha,
# de modo que expressoes longas devem preceder os sobrenomes soltos.
TERMOS = [
    # ---- conceitos e fenomenos ----
    (r'polin[óo]mios de Legendre', PT + 'Polin%C3%B3mios_de_Legendre'),
    (r'transforma[çc][ãa]o de Legendre', PT + 'Transformada_de_Legendre'),
    (r'transformada de Legendre', PT + 'Transformada_de_Legendre'),
    (r'par[êe]nteses de Poisson', PT + 'Par%C3%AAnteses_de_Poisson'),
    (r'teorema de Liouville', PT + 'Teorema_de_Liouville_(mec%C3%A2nica_hamiltoniana)'),
    (r'equa[çc][ãa]o de Liouville', PT + 'Teorema_de_Liouville_(mec%C3%A2nica_hamiltoniana)'),
    (r'p[êe]ndulo de Foucault', PT + 'P%C3%AAndulo_de_Foucault'),
    (r'for[çc]a de Coriolis', PT + 'For%C3%A7a_de_Coriolis'),
    (r'limite de Roche', PT + 'Limite_de_Roche'),
    (r'raio de Schwarzschild', PT + 'Raio_de_Schwarzschild'),
    (r'espaguetifica[çc][ãa]o', EN + 'Spaghettification'),
    (r'cintur[õo]es de Van Allen', PT + 'Cintur%C3%A3o_de_Van_Allen'),
    (r'efeito Aharonov-Bohm', PT + 'Efeito_Aharonov-Bohm'),
    (r'expoente de Lyapunov', PT + 'Expoente_de_Lyapunov'),
    (r'teorema da recorr[êe]ncia de Poincar[ée]', PT + 'Teorema_da_recorr%C3%AAncia_de_Poincar%C3%A9'),
    (r'recorr[êe]ncia de Poincar[ée]', PT + 'Teorema_da_recorr%C3%AAncia_de_Poincar%C3%A9'),
    (r'caos determin[íi]stico', PT + 'Teoria_do_caos'),
    (r'm[áa]quina de Atwood', EN + 'Atwood_machine'),
    (r'braquist[óo]crona', PT + 'Braquist%C3%B3crona'),
    (r'cicl[óo]ide', PT + 'Cicl%C3%B3ide'),
    (r'taut[óo]crona', PT + 'Curva_tautocr%C3%B4nica'),
    (r'caten[áa]ria', PT + 'Caten%C3%A1ria'),
    (r'catenoide', EN + 'Catenoid'),
    (r'superf[íi]cie de menor [áa]rea', PT + 'Superf%C3%ADcie_m%C3%ADnima'),
    (r'superf[íi]cies m[íi]nimas', PT + 'Superf%C3%ADcie_m%C3%ADnima'),
    (r'equa[çc][ãa]o de Laplace', PT + 'Equa%C3%A7%C3%A3o_de_Laplace'),
    (r'for[çc]a de Lorentz', PT + 'For%C3%A7a_de_Lorentz'),
    (r'equa[çc][ãa]o de Klein-Gordon', PT + 'Equa%C3%A7%C3%A3o_de_Klein%E2%80%93Gordon'),
    (r'espa[çc]o de fase', PT + 'Espa%C3%A7o_f%C3%A1sico'),
    (r'[áa]lgebra de Lie', PT + '%C3%81lgebra_de_Lie'),
    (r'teorema de Noether', PT + 'Teorema_de_Noether'),
    (r'regulador centr[íi]fugo', PT + 'Governador_centr%C3%ADfugo'),
    (r'tokamaks?', PT + 'Tokamak'),
    (r'c[íi]clotron', PT + 'C%C3%ADclotron'),
    (r'efeito Joule', PT + 'Efeito_Joule'),
    (r'princ[íi]pio de Fermat', PT + 'Princ%C3%ADpio_de_Fermat'),
    (r'lei de Snell', PT + 'Lei_de_Snell'),
    (r'Laplace-Runge-Lenz', EN + 'Laplace%E2%80%93Runge%E2%80%93Lenz_vector'),
    (r'Hamilton-Jacobi', PT + 'Equa%C3%A7%C3%A3o_de_Hamilton%E2%80%93Jacobi'),
    (r'energia livre de Helmholtz', PT + 'Energia_livre_de_Helmholtz'),
    (r'energia livre de Gibbs', PT + 'Energia_de_Gibbs'),
    (r'teorema do virial', PT + 'Teorema_do_virial'),
    (r'velocidade de escape', PT + 'Velocidade_de_escape'),
    (r'massa reduzida', PT + 'Massa_reduzida'),
    (r'p[êe]ndulo duplo', PT + 'P%C3%AAndulo_duplo'),
    (r'matriz\s+<strong>simpl[ée]tica</strong>', EN + 'Symplectic_matrix'),
    (r'a[çc][ãa]o e [âa]ngulo', EN + 'Action-angle_coordinates'),
    (r'ponto conjugado', EN + 'Conjugate_points'),
    (r'p[êe]ndulo de Kapitza', EN + 'Kapitza%27s_pendulum'),
    (r'emit[âa]ncia', EN + 'Emittance'),
    (r'Sagit[áa]rio A\*', PT + 'Sagittarius_A*'),
    (r'ba[íi]a de Fundy', PT + 'Ba%C3%ADa_de_Fundy'),
    (r'ponte Herc[íi]lio Luz', PT + 'Ponte_Herc%C3%ADlio_Luz'),
    (r'an[ée]is de Saturno', PT + 'An%C3%A9is_de_Saturno'),
    (r'princ[íi]pio de equival[êe]ncia', PT + 'Princ%C3%ADpio_de_equival%C3%AAncia'),
    (r'teorema de Steiner', PT + 'Teorema_dos_eixos_paralelos'),
    (r'problema isoperim[ée]trico', EN + 'Isoperimetric_inequality'),
    (r'desigualdade isoperim[ée]trica', EN + 'Isoperimetric_inequality'),
    (r'identidade de Jacobi', PT + 'Identidade_de_Jacobi'),
    (r'Euler-Bernoulli', EN + 'Euler%E2%80%93Bernoulli_beam_theory'),
    (r'teorema de Euler para fun[çc][õo]es homog[êe]neas', PT + 'Teorema_de_Euler_para_fun%C3%A7%C3%B5es_homog%C3%AAneas'),

    # ---- artigos seminais e obras ----
    (r'Methodus inveniendi lineas curvas',
     'https://scholarlycommons.pacific.edu/euler-works/65/'),
    (r'M[ée]canique Analytique', 'https://gallica.bnf.fr/ark:/12148/bpt6k862625'),
    (r'M[ée]canique analytique', 'https://gallica.bnf.fr/ark:/12148/bpt6k862625'),

    (r'(?<=Entre )1834', 'https://doi.org/10.1098/rstl.1834.0017'),
    (r'(?<=qu[âa]ntica em )1925', 'https://doi.org/10.1098/rspa.1925.0150'),
    (r'1890', 'https://doi.org/10.1007/BF02392506'),

    # ---- pessoas ----
    (r'Johann Bernoulli', PT + 'Johann_Bernoulli'),
    (r'Jakob Bernoulli', PT + 'Jakob_Bernoulli'),
    (r"L'H[ôo]pital", PT + 'Guillaume_Fran%C3%A7ois_Antoine,_Marqu%C3%AAs_de_l%27H%C3%B4pital'),
    (r'Leonhard Euler', PT + 'Leonhard_Euler'),
    (r'Joseph-Louis Lagrange', PT + 'Joseph-Louis_Lagrange'),
    (r'William Rowan Hamilton', PT + 'William_Rowan_Hamilton'),
    (r'Newton', PT + 'Isaac_Newton'),
    (r'Leibniz', PT + 'Gottfried_Wilhelm_Leibniz'),
    (r'Galileu', PT + 'Galileu_Galilei'),
    (r'Huygens', PT + 'Christiaan_Huygens'),
    (r'Fermat', PT + 'Pierre_de_Fermat'),
    (r'Snell', PT + 'Willebrord_Snel_van_Royen'),
    (r'Dido', EN + 'Dido'),
    (r'Zenodoro', EN + 'Zenodorus_(mathematician)'),
    (r'Steiner', PT + 'Jakob_Steiner'),
    (r'Weierstrass', PT + 'Karl_Weierstrass'),
    (r'Hilbert', PT + 'David_Hilbert'),
    (r'Picard', PT + 'Charles_%C3%89mile_Picard'),
    (r'Courant', PT + 'Richard_Courant'),
    (r'Pontryagin', EN + 'Lev_Pontryagin'),
    (r'Poisson', PT + 'Sim%C3%A9on_Denis_Poisson'),
    (r'Liouville', PT + 'Joseph_Liouville'),
    (r'Poincar[ée]', PT + 'Jules_Henri_Poincar%C3%A9'),
    (r'Zermelo', PT + 'Ernst_Zermelo'),
    (r'Boltzmann', PT + 'Ludwig_Boltzmann'),
    (r'Kepler', PT + 'Johannes_Kepler'),
    (r'Coriolis', PT + 'Gaspard-Gustave_Coriolis'),
    (r'Foucault', PT + 'Jean_Bernard_L%C3%A9on_Foucault'),
    (r'Laplace', PT + 'Pierre-Simon_de_Laplace'),
    (r'Rayleigh', PT + 'John_William_Strutt'),
    (r'Dirac', PT + 'Paul_Dirac'),
    (r'Schr[öo]dinger', PT + 'Erwin_Schr%C3%B6dinger'),
    (r'Heisenberg', PT + 'Werner_Heisenberg'),
    (r'Bohr', PT + 'Niels_Henrick_David_Bohr'),
    (r'Sommerfeld', PT + 'Arnold_Sommerfeld'),
    (r'Lyapunov', EN + 'Aleksandr_Lyapunov'),
    (r'Watt', PT + 'James_Watt'),
    (r'Reich', EN + 'Ferdinand_Reich'),
    (r'Lawrence', PT + 'Ernest_Lawrence'),
    (r'Young', PT + 'Thomas_Young'),
    (r'Legendre', PT + 'Adrien-Marie_Legendre'),
    (r'Gibbs', PT + 'Josiah_Willard_Gibbs'),
    (r'Born', PT + 'Max_Born'),
    (r'Kronecker', PT + 'Leopold_Kronecker'),
    (r'Lorentz', PT + 'Hendrik_Lorentz'),
    (r'Roche', EN + '%C3%89douard_Roche'),
    (r'Schwarzschild', PT + 'Karl_Schwarzschild'),
    (r'Hooke', PT + 'Robert_Hooke'),
    (r'Beltrami', EN + 'Eugenio_Beltrami'),
    (r'Maxwell', PT + 'James_Clerk_Maxwell'),
    (r'Einstein', PT + 'Albert_Einstein'),
    (r'Larmor', EN + 'Joseph_Larmor'),
    (r'Cartago', PT + 'Cartago'),
    (r'Euler', PT + 'Leonhard_Euler'),
    (r'Lagrange', PT + 'Joseph-Louis_Lagrange'),
    (r'Hamilton', PT + 'William_Rowan_Hamilton'),
    (r'Jacobi', PT + 'Carl_Gustav_Jakob_Jacobi'),
]

# Conteudo que o curso completo desenvolve (Mecanica Classica I, II e III,
# Fisica Estatistica e Fenomenos de Transporte) nao recebe hyperlink: o aluno aprende isso
# aqui, e nao na Wikipedia. A lista abaixo e a dos termos deliberadamente
# nao ligados, guardada para que a decisao fique registrada e para que seja
# facil mudar de ideia sobre qualquer um deles.
CURSO = [
    'transformacao de legendre', 'transformada de legendre',
    'polinomios de legendre', 'parenteses de poisson',
    'teorema de liouville', 'equacao de liouville', 'espaco de fase',
    'pendulo de foucault', 'forca de coriolis', 'maquina de atwood',
    'braquistocrona', 'cicloide', 'tautocrona', 'catenaria', 'catenoide',
    'superficie de menor area', 'superficies minimas',
    'problema isoperimetrico', 'desigualdade isoperimetrica',
    'principio de fermat', 'lei de snell', 'forca de lorentz',
    'teorema de steiner', 'massa reduzida', 'velocidade de escape',
    'teorema do virial', 'pendulo duplo', 'equacao de laplace',
    'energia livre de helmholtz', 'energia livre de gibbs',
    'teorema de noether', 'teorema de euler para funcoes homogeneas',
    'identidade de jacobi', 'algebra de lie', 'acao e angulo',
    'hamilton-jacobi', 'expoente de lyapunov', 'caos deterministico',
    'recorrencia de poincare', 'teorema da recorrencia de poincare',
    'matriz simpletica', 'ponto conjugado',
    'efeito joule',
]


def nome(alvo):
    """reduz a expressao a um nome simples, para comparar com CURSO"""
    s = re.sub(r'\(\?<=[^)]*\)', '', alvo)
    s = re.sub(r'<[^>]*>', '', s)
    s = re.sub(r'\\s\+', ' ', s)
    s = re.sub(r'\[([^\]]).*?\]', r'\1', s)
    s = s.replace('?', '').replace('\\', '')
    import unicodedata
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return s.strip().lower()


# regioes onde nunca se mexe: titulos, tags, formulas e links ja existentes.
# Os titulos ficam de fora porque a validacao le deles o numero da secao e
# porque um titulo com link dentro fica pesado na pagina.
PROIBIDO = re.compile(
    r'<h[1-6]\b.*?</h[1-6]>|<a\b.*?</a>|<[^>]*>'
    r'|\\\(.*?\\\)|\\\[.*?\\\]', re.S)


def mascara(texto):
    """devolve um vetor de booleanos: True onde nao se pode mexer"""
    livre = [True] * len(texto)
    for m in PROIBIDO.finditer(texto):
        for i in range(m.start(), m.end()):
            livre[i] = False
    return livre


def liga(texto, alvo, url):
    """liga a primeira ocorrencia livre de alvo; devolve (texto, mexeu)"""
    livre = mascara(texto)
    # nao casar dentro de uma palavra maior nem em compostos com hifen
    padrao = re.compile(r'(?<![\wÀ-ÿ-])(' + alvo + r')(?![\wÀ-ÿ-])')
    for m in padrao.finditer(texto):
        if not all(livre[m.start():m.end()]):
            continue
        novo = '<a href="%s">%s</a>' % (url, m.group(1))
        return texto[:m.start()] + novo + texto[m.end():], True
    return texto, False


def processa(caminho):
    t = io.open(caminho, encoding='utf-8').read()
    i = t.find('<main')
    j = t.find('</main>')
    if i < 0 or j < 0:
        return 0
    i = t.index('>', i) + 1
    miolo, n = t[i:j], 0
    for alvo, url in TERMOS:
        if ('"' + url + '"') in t:
            continue
        miolo, mexeu = liga(miolo, alvo, url)
        if mexeu:
            n += 1
    io.open(caminho, 'w', encoding='utf-8').write(t[:i] + miolo + t[j:])
    return n


if __name__ == '__main__':
    import glob
    TERMOS[:] = [q for q in TERMOS if nome(q[0]) not in CURSO]
    total = 0
    for f in sorted(glob.glob('aula*.html')) + ['index.html']:
        n = processa(f)
        total += n
        print('%-14s %3d ligações' % (f, n))
    print('total: %d' % total)
