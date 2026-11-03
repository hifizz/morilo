import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const server = await createServer({
  configFile: false,
  root: fileURLToPath(new URL('.', import.meta.url)),
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
  esbuild: { jsx: 'automatic' },
  logLevel: 'error',
})
try {
  const { MarkdownText } = await server.ssrLoadModule('/src/components/MarkdownText.tsx')
  const render = (text) => renderToStaticMarkup(React.createElement(MarkdownText, { text }))
  const formatted = render('**bold** and *emphasis* and `value`.\n\n- first\n- second\n\n```js\nconst tag = "<b>";\n```\n\n| A | B |\n| --- | --- |\n| 1 | 2 |')
  for (const expected of ['<strong>bold</strong>', '<em>emphasis</em>', '<code>value</code>', '<ul>', '<li>first</li>', 'class="message-code"', '&lt;b&gt;', '<table>']) assert.ok(formatted.includes(expected), expected)
  const link = render('[docs](https://example.com/docs)')
  assert.match(link, /target="_blank"/)
  assert.match(link, /rel="noopener noreferrer"/)
  const unsafe = render('[bad](javascript:alert%281%29)\n\n<script>alert(1)</script>\n\n![avatar](https://example.com/private.png)')
  assert.doesNotMatch(unsafe, /<script|<img|javascript:|onerror/i)
  assert.match(unsafe, /avatar/)
  assert.match(render('Use `GITHUB_GET_A_REPOSITORY` and `const value = 1;`.'), /GITHUB_GET_A_REPOSITORY/)
  assert.doesNotThrow(() => render('**incomplete'))
  assert.match(render('**complete**'), /<strong>complete<\/strong>/)
  console.log('Markdown rendering, streaming fragments, links, code preservation, and unsafe-content checks passed')
} finally {
  await server.close()
}
