'use client';
import { useMemo, useState } from 'react';
import { File, Folder, ChevronRight } from 'lucide-react';

type Item = { path: string; type: 'tree' | 'blob' | string };

type Node = {
  name: string;
  path: string;
  type: 'tree' | 'blob';
  children?: Node[];
};

function build(items: Item[]): Node {
  const root: Node = { name: '', path: '', type: 'tree', children: [] };
  for (const it of items) {
    const parts = it.path.split('/');
    let cur = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const full = parts.slice(0, i + 1).join('/');
      const isLeaf = i === parts.length - 1;
      cur.children = cur.children || [];
      let next = cur.children.find((c) => c.name === part);
      if (!next) {
        next = {
          name: part,
          path: full,
          type: isLeaf ? (it.type === 'tree' ? 'tree' : 'blob') : 'tree',
          children: [],
        };
        cur.children.push(next);
      }
      cur = next;
    }
  }
  // sort: folders first, then files
  function sort(n: Node) {
    if (!n.children) return;
    n.children.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'tree' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    n.children.forEach(sort);
  }
  sort(root);
  return root;
}

export function FileTree({
  items,
  selected,
  onSelect,
}: {
  items: Item[];
  selected?: string | null;
  onSelect: (path: string) => void;
}) {
  const tree = useMemo(() => build(items.filter(i => i.type === 'blob' || i.type === 'tree')), [items]);
  return (
    <div className="text-sm" data-testid="file-tree">
      {(tree.children || []).map((c) => (
        <TreeNode key={c.path} node={c} depth={0} onSelect={onSelect} selected={selected} />
      ))}
    </div>
  );
}

function TreeNode({
  node, depth, onSelect, selected,
}: {
  node: Node; depth: number; onSelect: (p: string) => void; selected?: string | null;
}) {
  const [open, setOpen] = useState(depth < 1);
  if (node.type === 'tree') {
    return (
      <div>
        <button
          className="flex items-center w-full text-left px-2 py-1 rounded hover:bg-ink-800/60 text-muted hover:text-white"
          onClick={() => setOpen(!open)}
          style={{ paddingLeft: 8 + depth * 12 }}
        >
          <ChevronRight size={12} className={`mr-1 transition-transform ${open ? 'rotate-90' : ''}`} />
          <Folder size={13} className="mr-1.5" />
          <span className="font-mono text-xs truncate">{node.name}</span>
        </button>
        {open && (node.children || []).map((c) => (
          <TreeNode key={c.path} node={c} depth={depth + 1} onSelect={onSelect} selected={selected} />
        ))}
      </div>
    );
  }
  const active = selected === node.path;
  return (
    <button
      className={`flex items-center w-full text-left px-2 py-1 rounded hover:bg-ink-800/60 ${
        active ? 'bg-ink-800 text-accent' : 'text-muted hover:text-white'
      }`}
      onClick={() => onSelect(node.path)}
      style={{ paddingLeft: 8 + depth * 12 + 14 }}
      data-testid={`file-${node.path}`}
    >
      <File size={12} className="mr-1.5" />
      <span className="font-mono text-xs truncate">{node.name}</span>
    </button>
  );
}
