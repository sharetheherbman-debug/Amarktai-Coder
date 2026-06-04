'use client';
import dynamic from 'next/dynamic';
import React from 'react';

const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

export function CodeEditor({
  value,
  language,
  onChange,
  height = '100%',
  readOnly,
}: {
  value: string;
  language?: string;
  onChange?: (v: string) => void;
  height?: string | number;
  readOnly?: boolean;
}) {
  return (
    <Editor
      height={height}
      language={language || 'plaintext'}
      value={value}
      onChange={(v) => onChange?.(v ?? '')}
      theme="vs-dark"
      options={{
        readOnly: !!readOnly,
        fontSize: 13,
        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
        minimap: { enabled: false },
        scrollbar: { vertical: 'auto', horizontal: 'auto' },
        wordWrap: 'on',
        smoothScrolling: true,
        renderLineHighlight: 'gutter',
      }}
    />
  );
}

const DiffEditor = dynamic(
  () => import('@monaco-editor/react').then((m) => m.DiffEditor),
  { ssr: false },
);

export function DiffView({
  before,
  after,
  language,
  height = '100%',
}: {
  before: string;
  after: string;
  language?: string;
  height?: string | number;
}) {
  return (
    <DiffEditor
      height={height}
      language={language || 'plaintext'}
      original={before}
      modified={after}
      theme="vs-dark"
      options={{
        readOnly: true,
        renderSideBySide: true,
        fontSize: 12,
        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
        minimap: { enabled: false },
        wordWrap: 'on',
      }}
    />
  );
}

export function languageFromPath(path?: string): string {
  if (!path) return 'plaintext';
  const ext = path.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', go: 'go', rs: 'rust', java: 'java', kt: 'kotlin',
    rb: 'ruby', php: 'php', c: 'c', h: 'c', cpp: 'cpp', cs: 'csharp',
    json: 'json', yaml: 'yaml', yml: 'yaml', xml: 'xml',
    md: 'markdown', html: 'html', css: 'css', scss: 'scss',
    sh: 'shell', bash: 'shell', toml: 'ini', ini: 'ini',
    sql: 'sql', dockerfile: 'dockerfile', prisma: 'sql',
  };
  if (ext && map[ext]) return map[ext];
  if (path.toLowerCase().endsWith('dockerfile')) return 'dockerfile';
  return 'plaintext';
}
