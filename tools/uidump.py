import re
import subprocess
import sys
import time

name = '/sdcard/w_%d.xml' % int(time.time() * 1000)
env_extra = {'MSYS_NO_PATHCONV': '1'}
import os
env = dict(os.environ)
env.update(env_extra)
subprocess.run(['adb', 'shell', 'uiautomator', 'dump', name], capture_output=True, env=env)
subprocess.run(['adb', 'pull', name, '/tmp/w.xml'], capture_output=True, env=env)
xml = open('/tmp/w.xml', encoding='utf-8', errors='replace').read()
out = sys.stdout.buffer
for m in re.finditer(r'(?:text|content-desc)="([^"]+)"[^>]*class="([^"]+)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml):
    t = m.group(1).strip()
    if not t:
        continue
    x = (int(m.group(3)) + int(m.group(5))) // 2
    y = (int(m.group(4)) + int(m.group(6))) // 2
    cls = m.group(2).split('.')[-1]
    out.write(('%-68s%-14s(%d,%d)\n' % (t[:66], cls, x, y)).encode('utf-8', 'replace'))
