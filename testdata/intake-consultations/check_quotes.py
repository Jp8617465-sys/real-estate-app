"""Verify every backtick quote in expected/*.md tables is an exact substring of
a single cue (vtt) / speaker turn (txt) / line (notes) of its transcript.

Usage: python3 check_quotes.py <transcript dir> <expected dir>
Exits 1 if any quote fails. File 05 is treated as unlabelled agent notes."""
import sys, re, os, glob
D = sys.argv[1]; E = sys.argv[2]

def units_vtt(path):
    txt = open(path, encoding='utf-8').read()
    out = []
    for b in re.split(r'\n\s*\n', txt.strip()):
        lines = b.split('\n')
        ti = next((i for i, l in enumerate(lines) if '-->' in l), None)
        if ti is None: continue
        t = '\n'.join(lines[ti+1:])
        m = re.match(r'^<v ([^>]+)>(.*?)(</v>)?$', t, re.S)
        if m: out.append((m.group(1), m.group(2)))
        else:
            m = re.match(r'^([^:]{1,60}): (.*)$', t, re.S)
            out.append((m.group(1), m.group(2)) if m else ('?', t))
    return out

HDR = re.compile(r'^(Speaker \d+)(?:\s+\d+:\d+| \(\d+:\d+\):)\s*$')
def units_txt(path):
    out = []; cur = None; buf = []
    for line in open(path, encoding='utf-8').read().split('\n'):
        m = HDR.match(line)
        if m:
            if cur: out.append((cur, '\n'.join(buf).strip()))
            cur, buf = m.group(1), []
        else: buf.append(line)
    if cur: out.append((cur, '\n'.join(buf).strip()))
    return out

def units_notes(path):
    return [('(notes)', l) for l in open(path, encoding='utf-8').read().split('\n') if l.strip()]

def load(n):
    f = glob.glob(os.path.join(D, f'{n}-*'))[0]
    if f.endswith('.vtt'): return f, units_vtt(f)
    if n == '05': return f, units_notes(f)
    return f, units_txt(f)

def cells(line):
    s = line.strip()
    if s.startswith('|'): s = s[1:]
    if s.endswith('|'): s = s[:-1]
    return [c.strip().replace('\\|', '|') for c in re.split(r'(?<!\\)\|', s)]

total = fails = warns = 0
for md in sorted(glob.glob(os.path.join(E, '*-expected.md'))):
    n = os.path.basename(md)[:2]
    src, units = load(n)
    lines = open(md, encoding='utf-8').read().split('\n')
    hdr = None; section = ''
    for i, line in enumerate(lines, 1):
        if line.startswith('## '): section = line[3:]; hdr = None; continue
        if not line.strip().startswith('|'): hdr = None; continue
        c = cells(line)
        if hdr is None: hdr = [h.lower() for h in c]; continue
        if set(''.join(c)) <= set('-: '): continue
        if len(c) != len(hdr):
            print(f'FAIL {n} L{i}: {len(c)} cells vs {len(hdr)} headers'); fails += 1; continue
        qcols = [j for j, h in enumerate(hdr) if 'quote' in h]
        scol = hdr.index('speaker') if 'speaker' in hdr else None
        for j, cell in enumerate(c):
            spans = re.findall(r'`([^`]+)`', cell)
            if j not in qcols:
                if spans: print(f'WARN {n} L{i}: backtick span outside quote column: {spans}'); warns += 1
                continue
            if not spans and section not in ('Speakers',):
                print(f'WARN {n} L{i} [{section}] col "{hdr[j]}": no quote'); warns += 1
            for q in spans:
                total += 1
                hits = [(sp, t) for sp, t in units if q in t]
                if not hits:
                    # does it span units?
                    print(f'FAIL {n} L{i} [{section}]: not found in a single unit: {q!r}'); fails += 1; continue
                if len(hits) > 1:
                    print(f'WARN {n} L{i}: quote occurs in {len(hits)} units: {q!r}'); warns += 1
                wc = len(q.split())
                if wc < 4 or wc > 25:
                    print(f'WARN {n} L{i}: {wc} words: {q!r}'); warns += 1
                if scol is not None and n != '05':
                    if not any(sp in c[scol] for sp, _ in hits):
                        print(f'FAIL {n} L{i}: speaker {[sp for sp,_ in hits]} not in speaker cell {c[scol]!r} for {q!r}'); fails += 1
print(f'quotes checked={total} fails={fails} warns={warns}')
sys.exit(1 if fails else 0)
