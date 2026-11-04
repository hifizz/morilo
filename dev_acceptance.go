package main

const devAcceptanceStart = `
if (!window.mygo) throw new Error('Acceptance requires the native MyGo app');
if (window.__moriloAcceptance?.started && !window.__moriloAcceptance.done) throw new Error('Acceptance is already running');
if (document.querySelector('.agent-status')) throw new Error('The current conversation is busy');
if (document.querySelector('.composer textarea')?.value.trim()) throw new Error('The composer has an unsent draft');
const waitFor = async (check) => {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const result = check();
    if (result) return result;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Acceptance UI condition timed out');
};
const fill = (element, value) => {
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value').set.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
};
const prompt = '请通过我在“连接应用”里已经绑定的 GitHub 和 Vercel 做一次只读查询，并用中文汇总：\n1. 查询 GitHub 当前授权账号的用户名。\n2. 列出一个我可访问的 GitHub 仓库。\n3. 再查询这个仓库的详情，给出默认分支和描述。\n4. 查询这个仓库的一条 Issue，给出编号和标题；没有就明确说没有。\n5. 列出一个 Vercel 项目。\n6. 查询这个项目最近的一条部署，给出部署 ID 和状态。\n请让每一项都有本次真实工具查询的依据，失败要如实说明。只读取，不修改、创建、删除、部署任何资源，也不要读取或展示密钥和环境变量。';
const state = window.__moriloAcceptance = { started: false, done: false, events: [], prompt, startedAt: new Date().toISOString() };
const restores = [];
try {
  document.querySelector('.integration-dialog .ds-dialog__floating-close')?.click();
  await waitFor(() => !document.querySelector('[role="dialog"]'));
  const newBot = document.querySelector('button[aria-label="新增 Bot"],button[aria-label="New bot"]');
  if (!newBot) throw new Error('New Bot button is not available');
  newBot.click();
  const name = await waitFor(() => document.querySelector('.new-bot-dialog input'));
  fill(name, '集成验收 · 展示修正');
  const create = await waitFor(() => [...document.querySelectorAll('.new-bot-dialog .dialog-footer button')].find(button => /^(创建|Create)$/.test(button.textContent.trim()) && !button.disabled));
  create.click();
  await waitFor(() => !document.querySelector('.new-bot-dialog'));
  state.conversationId = location.hash.slice(1);
  const moduleURLs = performance.getEntriesByType('resource').map(entry => entry.name).filter(name => new URL(name, location.href).pathname === '/src/mygo.ts');
  moduleURLs.push(new URL('/src/mygo.ts', location.href).href);
  const clients = new Set();
  for (const url of new Set(moduleURLs)) clients.add((await import(url)).Chat);
  for (const client of clients) {
    const original = client.send;
    const wrapped = function (profileID, conversationID, text, channel) {
      if (text !== prompt) return original.call(client, profileID, conversationID, text, channel);
      state.started = true;
      state.profileId = profileID;
      state.conversationId = conversationID;
      const onmessage = channel.onmessage;
      channel.onmessage = (event) => {
        if (event.type !== 'thinking') state.events.push(event);
        onmessage?.(event);
      };
      return original.call(client, profileID, conversationID, text, channel)
        .catch(error => { state.error = String(error.message || error); throw error; })
        .finally(() => {
          state.done = true;
          state.finishedAt = new Date().toISOString();
          restores.forEach(restore => restore());
        });
    };
    client.send = wrapped;
    restores.push(() => { if (client.send === wrapped) client.send = original; });
  }
  const textarea = await waitFor(() => document.querySelector('.composer textarea'));
  fill(textarea, prompt);
  const send = await waitFor(() => document.querySelector('.composer__send:not(:disabled)'));
  send.click();
  await waitFor(() => state.started);
  return { started: state.started, conversationId: state.conversationId, profileId: state.profileId };
} catch (error) {
  restores.forEach(restore => restore());
  state.error = String(error.message || error);
  state.done = true;
  throw error;
}
`

const devAcceptanceStatus = `
const state = window.__moriloAcceptance;
if (!state) return { started: false, done: false };
return {
  ...state,
  visibleConversationId: location.hash.slice(1),
  userMessages: [...document.querySelectorAll('.message-row--user .message-text')].map(element => element.textContent),
  agentMessages: [...document.querySelectorAll('.message-row--agent .message-text')].map(element => element.textContent),
  progressVisible: !!document.querySelector('.agent-status'),
  progressText: document.querySelector('.agent-status')?.textContent || '',
  rawEventRows: document.querySelectorAll('.task-event,.message-time').length,
  composerCleared: document.querySelector('.composer textarea')?.value === '',
  markdown: {
    strong: document.querySelectorAll('.message-row--agent .message-text strong').length,
    listItems: document.querySelectorAll('.message-row--agent .message-text li').length,
    inlineCode: document.querySelectorAll('.message-row--agent .message-text :not(pre) > code').length,
    codeBlocks: document.querySelectorAll('.message-row--agent .message-text pre').length,
    tables: document.querySelectorAll('.message-row--agent .message-text table').length
  }
};
`
