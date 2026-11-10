"""Fetch the public prompt injection datasets the guard benchmark uses and write
them as JSONL under bench/data (not committed). Needs pyarrow.

  python3 bench/fetch.py

Sources and licenses:
  deepset/prompt-injections (Apache-2.0): 662 short texts, labeled injection or not.
  Lakera/gandalf_ignore_instructions (MIT): 777 real attempts to make a model ignore its instructions.
  microsoft/BIPIA (MIT): indirect injection, attack instructions placed inside emails.
"""
import io, json, os, urllib.request
import pyarrow.parquet as pq

OUT = os.path.join(os.path.dirname(__file__), 'data')
os.makedirs(OUT, exist_ok=True)
HF = 'https://huggingface.co/datasets'
GH = 'https://raw.githubusercontent.com/microsoft/BIPIA/main/benchmark'

def get(url):
    with urllib.request.urlopen(url, timeout=60) as r:
        return r.read()

def write(name, rows):
    with open(os.path.join(OUT, name), 'w') as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')
    print(name, len(rows))

rows = []
for split, path in [('train', 'train-00000-of-00001-9564e8b05b4757ab.parquet'), ('test', 'test-00000-of-00001-701d16158af87368.parquet')]:
    t = pq.read_table(io.BytesIO(get(f'{HF}/deepset/prompt-injections/resolve/main/data/{path}'))).to_pylist()
    rows += [{'text': r['text'], 'injection': r['label'] == 1, 'split': split} for r in t]
write('deepset.jsonl', rows)

t = pq.read_table(io.BytesIO(get('https://huggingface.co/api/datasets/Lakera/gandalf_ignore_instructions/parquet/default/train/0.parquet'))).to_pylist()
write('gandalf.jsonl', [{'text': r['text'], 'injection': True} for r in t])

attacks = []
for split in ['train', 'test']:
    for category, items in json.loads(get(f'{GH}/text_attack_{split}.json')).items():
        attacks += [{'attack': a, 'category': category, 'split': split} for a in items]
emails = []
for split in ['train', 'test']:
    for line in get(f'{GH}/email/{split}.jsonl').decode().splitlines():
        if line.strip():
            e = json.loads(line)
            emails.append({'context': e['context'], 'question': e['question'], 'split': split})
write('bipia-attacks.jsonl', attacks)
write('bipia-emails.jsonl', emails)
