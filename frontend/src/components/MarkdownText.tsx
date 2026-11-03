import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

const plugins = [remarkGfm]
const components: Components = {
  a: ({ href, children }) => <a href={href || undefined} target="_blank" rel="noopener noreferrer">{children}</a>,
  pre: ({ children }) => <pre className="message-code">{children}</pre>,
  table: ({ children }) => <div className="message-table"><table>{children}</table></div>,
  img: ({ alt }) => <span>{alt}</span>,
}

export function MarkdownText({ text }: { text: string }) {
  return <Markdown remarkPlugins={plugins} components={components} skipHtml>{text}</Markdown>
}
