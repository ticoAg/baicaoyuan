#!/usr/bin/env python3
"""生成 GitHub Release 的正文，打印到标准输出。推送版本 tag 后由 .github/workflows/android.yml 调用：

    python3 .github/scripts/release_notes.py v1.2.3 dist/baicaoyuan-1.2.3.apk

正文的样子在 .github/release-template.md。改动列表由 GitHub 按 .github/release.yml 分类生成，
要 gh 和有 contents: write 权限的 GH_TOKEN；签名证书指纹从环境变量 CERT_SHA256 读。
"""

import hashlib
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TEMPLATE = ROOT / '.github' / 'release-template.md'
STABLE = re.compile(r'v\d+\.\d+\.\d+')


def run(*args: str) -> str:
    return subprocess.run(args, cwd=ROOT, check=True, capture_output=True, text=True).stdout.strip()


def previous_tag(tag: str) -> str:
    """正式版和上一个正式版比，预发布版和上一个 tag 比。第一个版本返回空串。"""
    tags = run('git', '-c', 'versionsort.suffix=-', 'tag', '--list', 'v*', '--sort=v:refname').splitlines()
    if STABLE.fullmatch(tag):
        tags = [t for t in tags if STABLE.fullmatch(t)]
    if tag not in tags:
        sys.exit(f'本地没有 tag {tag}')
    before = tags[: tags.index(tag)]
    return before[-1] if before else ''


def tag_message(tag: str) -> str:
    """附注 tag 的说明；轻量 tag 没有说明。签名不算在内。"""
    if run('git', 'cat-file', '-t', f'refs/tags/{tag}') != 'tag':
        return ''
    return run('git', 'tag', '--list', '--format=%(contents:subject)%0a%0a%(contents:body)', tag)


def changes(tag: str, previous: str) -> str:
    """GitHub 生成的改动列表，英文的标题和套话换成中文。"""
    args = ['gh', 'api', f'repos/{os.environ["GITHUB_REPOSITORY"]}/releases/generate-notes', '-f', f'tag_name={tag}']
    if previous:
        args += ['-f', f'previous_tag_name={previous}']
    body = run(*args, '--jq', '.body')
    body = re.sub(r"^## What's Changed\n+", '', body, flags=re.M)
    body = re.sub(r'^## New Contributors$', '### 新贡献者', body, flags=re.M)
    # 链接后面不能紧跟中文标点，否则 GitHub 会把标点当成链接的一部分
    body = re.sub(r' by (@\S+) in (\S+)$', r' · \1 · \2', body, flags=re.M)
    body = re.sub(r'^\* (@\S+) made their first contribution in (\S+)$', r'* \1 首次贡献 · \2', body, flags=re.M)
    body = re.sub(r'^\*\*Full Changelog\*\*: ', '完整对比 ', body, flags=re.M)
    return body


def size(n: int) -> str:
    return f'{n / 1024:.0f} KB' if n < 1024 * 1024 else f'{n / 1024 / 1024:.1f} MB'


def render(template: str, values: dict[str, str]) -> str:
    text = re.sub(r'<!--.*?-->\n?', '', template, flags=re.S)
    unknown = sorted(set(re.findall(r'\{\{[#/]?(\w+)\}\}', text)) - values.keys())
    if unknown:
        sys.exit(f'模板里有不认识的名字：{", ".join(unknown)}')
    text = re.sub(
        r'\{\{#(\w+)\}\}\n?(.*?)\{\{/\1\}\}\n?',
        lambda m: m.group(2) if values[m.group(1)] else '',
        text,
        flags=re.S,
    )
    text = re.sub(r'\{\{(\w+)\}\}', lambda m: values[m.group(1)], text)
    return re.sub(r'\n{3,}', '\n\n', text).strip() + '\n'


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    tag, apk = sys.argv[1], Path(sys.argv[2])
    repo = os.environ['GITHUB_REPOSITORY']
    server = os.environ.get('GITHUB_SERVER_URL', 'https://github.com')
    previous = previous_tag(tag)
    version = tag.removeprefix('v')
    values = {
        'VERSION': version,
        'TAG': tag,
        'PREVIOUS': previous,
        'PRERELEASE': '是' if '-' in version else '',
        'HIGHLIGHTS': tag_message(tag),
        'APK': apk.name,
        'APK_URL': f'{server}/{repo}/releases/download/{tag}/{apk.name}',
        'APK_SIZE': size(apk.stat().st_size),
        'APK_SHA256': hashlib.sha256(apk.read_bytes()).hexdigest(),
        'CERT_SHA256': os.environ['CERT_SHA256'],
        'CHANGES': changes(tag, previous),
    }
    sys.stdout.write(render(TEMPLATE.read_text(encoding='utf-8'), values))


if __name__ == '__main__':
    main()
