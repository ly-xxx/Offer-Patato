function splitPathname(input: string) {
  const [pathname] = input.split('?')
  return pathname
}

export function assertDemoRequestAllowed(method: string) {
  const normalizedMethod = method.toUpperCase()
  if (normalizedMethod === 'GET' || normalizedMethod === 'HEAD') {
    return
  }
  throw new Error('Demo 模式已禁用写操作，不会触发模型 token 消耗。')
}

export function mapDemoApiInput(input: string) {
  const pathname = splitPathname(input)
  if (!pathname.startsWith('/api/')) {
    return input
  }

  if (pathname === '/api/meta') {
    return '/demo-api/meta.json'
  }
  if (pathname === '/api/settings/sources') {
    return '/demo-api/settings-sources.json'
  }
  if (pathname === '/api/questions') {
    return '/demo-api/questions.json'
  }
  if (pathname.startsWith('/api/questions/')) {
    const id = pathname.slice('/api/questions/'.length)
    return `/demo-api/questions/${id}.json`
  }
  if (pathname === '/api/documents') {
    return '/demo-api/documents.json'
  }
  if (pathname.startsWith('/api/documents/')) {
    const id = pathname.slice('/api/documents/'.length)
    return `/demo-api/documents/${id}.json`
  }
  if (pathname === '/api/search') {
    return '/demo-api/search.json'
  }
  if (pathname === '/api/work-projects') {
    return '/demo-api/work-projects.json'
  }
  if (pathname.startsWith('/api/work-projects/')) {
    const id = pathname.slice('/api/work-projects/'.length)
    return `/demo-api/work-projects/${id}.json`
  }
  if (pathname === '/api/agents/jobs') {
    return '/demo-api/agents-jobs.json'
  }
  if (pathname.startsWith('/api/agents/jobs/')) {
    return '/demo-api/agent-job.json'
  }
  if (pathname.startsWith('/api/jobs/')) {
    return '/demo-api/answer-job.json'
  }

  throw new Error(`Demo 模式缺少接口映射: ${pathname}`)
}
