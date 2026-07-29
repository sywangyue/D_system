"""
rsc_flight.py — 解析 Next.js App Router 的 RSC flight payload

展查查（expofinder.com）的展会详情页是 App Router 服务端渲染，业务数据以
`self.__next_f.push([1,"..."])` 的形式内嵌在 HTML 里，比从 DOM 抠稳定得多。

payload 内部用 `$<rowId>:<path>` 做跨 chunk 引用。部分被引用的 row 并不会
单独发出（它嵌在 React 元素树里），所以解引用做了两级：先按 row id 走，
走不到再按路径末段的 key 名做全局索引兜底。
"""
import json
import re


def extract_flight(html: str) -> str:
    chunks = re.findall(r'self\.__next_f\.push\(\[1,\s*(".*?")\]\)', html, re.S)
    out = []
    for c in chunks:
        try:
            out.append(json.loads(c))
        except Exception:
            pass
    return "".join(out)


def parse_rows(flight: str) -> dict:
    """flight 是 `<id>:<payload>\n` 的连接体，payload 可能是 JSON 也可能是 I[...] 之类。"""
    rows = {}
    for m in re.finditer(r'(?m)^([0-9a-f]+):(.*)$', flight):
        rid, body = m.group(1), m.group(2)
        body = body.strip()
        if body[:1] in "[{":
            try:
                rows[rid] = json.loads(body)
                continue
            except Exception:
                pass
        if body[:2] in ('I[', 'T', 'H'):
            continue
        try:
            rows[rid] = json.loads(body)
        except Exception:
            rows[rid] = body
    return rows


_REF = re.compile(r'^\$([0-9a-f]+)(?::(.*))?$')


def balanced_objects(text: str):
    """扫出 flight 里所有配平的 JSON 对象（含嵌在 React 元素树里的 props）。"""
    out = []
    for m in re.finditer(r'\{"', text):
        s = m.start(); depth = 0; instr = False; esc = False
        for i in range(s, min(s + 200000, len(text))):
            ch = text[i]
            if esc: esc = False; continue
            if ch == '\\': esc = True; continue
            if ch == '"': instr = not instr; continue
            if instr: continue
            if ch == '{': depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    try: out.append(json.loads(text[s:i + 1]))
                    except Exception: pass
                    break
    return out


def build_key_index(objs):
    """key -> 值。同名取「信息量最大」的那个（RSC 里同一 key 常有占位与实值两份）。"""
    idx = {}
    def visit(o):
        if isinstance(o, dict):
            for k, v in o.items():
                if isinstance(v, str) and v.startswith("$"):
                    continue
                cur = idx.get(k)
                if cur is None or len(json.dumps(v, ensure_ascii=False)) > len(json.dumps(cur, ensure_ascii=False)):
                    idx[k] = v
                visit(v)
        elif isinstance(o, list):
            for v in o: visit(v)
    for o in objs: visit(o)
    return idx


def _walk(node, path):
    for seg in path:
        if node is None:
            return None
        if isinstance(node, list):
            try:
                node = node[int(seg)]
                continue
            except (ValueError, IndexError):
                return None
        if isinstance(node, dict):
            node = node.get(seg)
            continue
        return None
    return node


def resolve(value, rows, depth=0, key_index=None):
    if depth > 12:
        return value
    if isinstance(value, str):
        if value == "$undefined":
            return None
        m = _REF.match(value)
        if m:
            rid, path = m.group(1), m.group(2)
            base = rows.get(rid)
            if base is not None:
                got = _walk(base, path.split(":")) if path else base
                if got is not None:
                    return resolve(got, rows, depth + 1, key_index)
            # row 未单独发出（嵌在 React 元素树里）—— 按路径末段 key 全局索引兜底
            if key_index and path:
                got = key_index.get(path.split(":")[-1])
                if got is not None:
                    return resolve(got, rows, depth + 1, key_index)
            return None
        return value
    if isinstance(value, list):
        return [resolve(v, rows, depth + 1, key_index) for v in value]
    if isinstance(value, dict):
        return {k: resolve(v, rows, depth + 1, key_index) for k, v in value.items()}
    return value


def find_view_model(rows):
    """找出含 header/productCategories 的那个业务对象。"""
    best, best_len = None, 0
    def scan(node):
        nonlocal best, best_len
        if isinstance(node, dict):
            if "header" in node and any(k in node for k in
                                        ("productCategories", "currentExhibitors", "boothPricing")):
                n = len(json.dumps(node, ensure_ascii=False))
                if n > best_len:
                    best, best_len = node, n
            for v in node.values():
                scan(v)
        elif isinstance(node, list):
            for v in node:
                scan(v)
    for r in rows.values():
        scan(r)
    return best


def parse_detail(html: str) -> dict:
    flight = extract_flight(html)
    rows = parse_rows(flight)
    objs = balanced_objects(flight)
    kidx = build_key_index(objs)
    vm = find_view_model(rows) or find_view_model({"_": objs})
    return resolve(vm, rows, key_index=kidx) if vm else {}
