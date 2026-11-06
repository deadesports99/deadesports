import os
import re
import subprocess
import sys

env = dict(os.environ)
env['MSYS_NO_PATHCONV'] = '1'


def dump():
    name = '/sdcard/ff_%d.xml' % (os.getpid() + abs(hash(sys.argv[0])) % 1000)
    subprocess.run(['adb', 'shell', 'uiautomator', 'dump', name], capture_output=True, env=env)
    subprocess.run(['adb', 'pull', name, '/tmp/ff.xml'], capture_output=True, env=env)
    return open('/tmp/ff.xml', encoding='utf-8', errors='replace').read()


def edit_fields():
    xml = dump()
    fields = []
    for m in re.finditer(
        r'class="android.widget.EditText"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml
    ):
        x = (int(m.group(1)) + int(m.group(3))) // 2
        y = (int(m.group(2)) + int(m.group(4))) // 2
        fields.append((x, y))
    fields.sort(key=lambda p: p[1])
    return fields


def sh(*args):
    subprocess.run(['adb', 'shell'] + list(args), capture_output=True, env=env)


def fill(index, value):
    fields = edit_fields()
    if index >= len(fields):
        print('only %d fields' % len(fields))
        return
    x, y = fields[index]
    sh('input', 'tap', str(x), str(y))
    import time
    time.sleep(0.6)
    sh('input', 'keyevent', '123')  # MOVE_END
    for _ in range(24):
        sh('input', 'keyevent', '67')  # DEL
    if value:
        sh('input', 'text', value.replace(' ', '%s'))
    time.sleep(0.4)
    sh('input', 'keyevent', '111')  # ESCAPE to hide keyboard
    print('filled field %d at (%d,%d)' % (index, x, y))


if __name__ == '__main__':
    if len(sys.argv) >= 3:
        fill(int(sys.argv[1]), sys.argv[2])
    else:
        for i, p in enumerate(edit_fields()):
            print(i, p)
