"""Merge new Gradle dependency-verification components into the existing file.

`./gradlew --write-verification-metadata` rewrites the file with only what the
current invocation resolved, which silently drops entries other modules need.
So: keep the old file as the base and append only the genuinely new components.
"""
import os
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET

NS = '{https://schema.gradle.org/dependency-verification}'
SRC = 'C:/Free Fire turnament/android/gradle/verification-metadata.xml'
BACKUP = 'C:/Free Fire turnament/android/gradle/verification-metadata.backup.xml'


def key(component):
    return (component.get('group'), component.get('name'), component.get('version'))


def main(mode):
    if mode == 'save':
        shutil.copyfile(SRC, BACKUP)
        print(f'saved base -> {os.path.basename(BACKUP)}')
        return
    if mode != 'merge':
        raise SystemExit('usage: verify_merge.py save|merge')

    new_root = ET.parse(SRC).getroot()
    old_root = ET.parse(BACKUP).getroot()
    known = {key(c) for c in old_root.iter(NS + 'component')}
    added = [c for c in new_root.iter(NS + 'component') if key(c) not in known]

    parent = old_root.find(NS + 'components')
    for component in added:
        parent.append(component)

    ET.register_namespace('', NS.strip('{}'))
    ET.indent(old_root, space='   ')
    ET.ElementTree(old_root).write(SRC, encoding='UTF-8', xml_declaration=True)
    total = len(list(old_root.iter(NS + 'component')))
    print(f'merged {len(added)} new components, total {total}')
    for component in added[:20]:
        print('  +', key(component))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'merge')
