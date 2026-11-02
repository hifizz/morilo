export type AgentColor = 'blue' | 'orange' | 'green' | 'purple' | 'teal' | 'gray' | 'red' | 'white' | 'yellow'

export interface Agent {
  id: string
  name: string
  color: AgentColor
  role: string
  description: string
  capabilities: string[]
  variant?: number
}

export interface ChatMessage {
  id: string
  sender: 'agent' | 'user' | 'event'
  text: string
  time?: string
  quote?: string
  code?: string
  taskTitle?: string
}

export interface AgentTask {
  id: string
  title: string
  status: 'running' | 'finished' | 'queued'
  detail: string
}

export interface Conversation {
  id: string
  agentId: string
  title: string
  preview: string
  time: string
  messages: ChatMessage[]
  tasks: AgentTask[]
  tag?: string
  pinned?: boolean
  unread?: boolean
  section?: string
  hidden?: boolean
}

export interface LibraryFile {
  id: string
  name: string
  type: 'Markdown' | 'Code' | 'Data'
  updated: string
  content: string
}
