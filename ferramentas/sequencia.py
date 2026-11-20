# -*- coding: utf-8 -*-
"""Liga entre si os três sites da sequência de Mecânica Clássica.

O QUE FAZ
    Põe, logo abaixo do cabeçalho de todas as páginas, uma faixa com os três
    sites da sequência (I, II e III), com o site atual marcado e os outros
    dois como link.

USO
    python3 ferramentas/sequencia.py        (a partir da raiz do site)

    Rodar de novo substitui o conteúdo entre os marcadores <!--SEQ--> e
    <!--/SEQ-->, em vez de duplicá-lo. Este arquivo é o MESMO nos três
    repositórios, e descobre sozinho em qual deles está.

POR QUE
    As três disciplinas são uma sequência de três semestres, com a I como
    pré-requisito da II, e um aluno que chega a uma delas pela busca não tem
    como saber que as outras existem. A faixa resolve isso sem competir com
    o menu de módulos, que já ocupa o topo.

Prof. Apiano Morais - LFCA/URCA
"""
import glob
import os
import re
import subprocess

SEQUENCIA = [
    ('mecanica-classica-i', 'I', 'Newton, oscilações e forças centrais'),
    ('mecanica-classica-ii', 'II', 'Corpo rígido, Lagrange e Hamilton'),
    ('mecanica-classica-iii', 'III', 'Tensores, modos normais e ondas'),
]
BASE = 'https://apianomorais.github.io/%s/'


def daqui():
    try:
        url = subprocess.check_output(
            ['git', 'config', '--get', 'remote.origin.url'],
            stderr=subprocess.DEVNULL).decode().strip()
        nome = url.rstrip('/').split('/')[-1]
        if nome.endswith('.git'):
            nome = nome[:-4]
        if nome in [s[0] for s in SEQUENCIA]:
            return nome
    except Exception:
        pass
    return os.path.basename(os.path.abspath('.'))


def faixa(aqui=None):
    aqui = aqui or daqui()
    partes = []
    for chave, num, descricao in SEQUENCIA:
        if chave == aqui:
            partes.append('<span class="aqui" title="%s">Mecânica Clássica %s'
                          '</span>' % (descricao, num))
        else:
            partes.append('<a href="%s" title="%s">Mecânica Clássica %s</a>'
                          % (BASE % chave, descricao, num))
    return ('<!--SEQ-->\n<div class="sequencia">\n'
            '  <div class="sequencia-interno">\n'
            '    <span class="rot">Sequência de três semestres</span>\n'
            '    %s\n'
            '  </div>\n</div>\n<!--/SEQ-->' % '\n    '.join(partes))


def aplica(caminho, aqui=None):
    h = open(caminho, encoding='utf-8').read()
    nova = faixa(aqui)
    padrao = re.compile(r'<!--SEQ-->.*?<!--/SEQ-->', re.S)
    if padrao.search(h):
        novo = padrao.sub(lambda _: nova, h, count=1)
    elif '</header>' in h:
        novo = h.replace('</header>', '</header>\n\n%s' % nova, 1)
    else:
        return False
    if novo == h:
        return False
    open(caminho, 'w', encoding='utf-8').write(novo)
    return True


def main():
    aqui = daqui()
    print('site atual: %s' % aqui)
    n = 0
    for pg in sorted(glob.glob('*.html')):
        if aplica(pg, aqui):
            n += 1
    print('  faixa da sequência em %d página(s)' % n)


if __name__ == '__main__':
    main()
