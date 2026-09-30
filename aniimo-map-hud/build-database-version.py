from pathlib import Path
import json,hashlib
root=Path(__file__).resolve().parent.parent/'egg-map'
paths=['maps.json','features.json','marker-layers.json']
for directory in ['maps','clean-maps','marker-icons']:
    paths += [p.relative_to(root).as_posix() for p in sorted((root/directory).rglob('*.webp'))]
files=[]
for name in paths:
    data=(root/name).read_bytes()
    files.append({'path':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
version=hashlib.sha256(json.dumps(files,sort_keys=True).encode()).hexdigest()[:24]
(root/'database-version.json').write_text(json.dumps({'schema':1,'version':version,'files':files},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Updated database-version.json:',version)
