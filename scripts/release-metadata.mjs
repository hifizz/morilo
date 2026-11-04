import { appendFileSync, readFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const ref = process.env.GITHUB_REF_NAME || 'local'
const isTag = process.env.GITHUB_REF_TYPE === 'tag'
const versionTag = isTag && /^v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/.exec(ref)
if (versionTag && versionTag[1] !== version) {
  throw new Error(`Tag ${ref} does not match package.json version ${version}`)
}
const sha = (process.env.GITHUB_SHA || 'local').slice(0, 8)
const label = `${ref.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 80)}-${sha}`
const metadata = {
  version,
  label,
  release: String(Boolean(versionTag)),
  prerelease: String(Boolean(versionTag && versionTag[1].includes('-'))),
}
for (const [key, value] of Object.entries(metadata)) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`)
  else console.log(`${key}=${value}`)
}
