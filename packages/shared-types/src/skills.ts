// Shared skill ontology used by resume parsing, job extraction, API scoring,
// and worker-side evidence comparison. Keep normalization deterministic and
// idempotent: normalizeSkill(normalizeSkill(value)) must equal normalizeSkill(value).

const BASE_SKILL_ALIASES: Record<string, string> = {
  typescript: 'TypeScript',
  ts: 'TypeScript',
  javascript: 'JavaScript',
  js: 'JavaScript',
  python: 'Python',
  py: 'Python',
  golang: 'Go',
  go: 'Go',
  java: 'Java',
  csharp: 'C#',
  'c#': 'C#',
  cpp: 'C++',
  'c++': 'C++',
  ruby: 'Ruby',
  php: 'PHP',
  rust: 'Rust',
  swift: 'Swift',
  swiftui: 'SwiftUI',
  kotlin: 'Kotlin',
  sql: 'SQL',
  html: 'HTML',
  html5: 'HTML5',
  css: 'CSS',
  css3: 'CSS3',
  react: 'React',
  'react.js': 'React',
  reactjs: 'React',
  'next.js': 'Next.js',
  nextjs: 'Next.js',
  vue: 'Vue.js',
  'vue.js': 'Vue.js',
  vuejs: 'Vue.js',
  angular: 'Angular',
  svelte: 'Svelte',
  'svelte.js': 'Svelte',
  'tailwind css': 'Tailwind CSS',
  tailwind: 'Tailwind CSS',
  tailwindcss: 'Tailwind CSS',
  redux: 'Redux',
  zustand: 'Zustand',
  graphql: 'GraphQL',
  webpack: 'Webpack',
  vite: 'Vite',
  'node.js': 'Node.js',
  nodejs: 'Node.js',
  node: 'Node.js',
  express: 'Express',
  'express.js': 'Express',
  nestjs: 'NestJS',
  fastify: 'Fastify',
  django: 'Django',
  flask: 'Flask',
  fastapi: 'FastAPI',
  'spring boot': 'Spring Boot',
  spring: 'Spring Boot',
  laravel: 'Laravel',
  'ruby on rails': 'Ruby on Rails',
  rails: 'Ruby on Rails',
  grpc: 'gRPC',
  rest: 'REST APIs',
  'rest api': 'REST APIs',
  'rest APIs': 'REST APIs',
  'restful api': 'REST APIs',
  'restful apis': 'REST APIs',
  postgresql: 'PostgreSQL',
  postgres: 'PostgreSQL',
  psql: 'PostgreSQL',
  mysql: 'MySQL',
  mongodb: 'MongoDB',
  mongo: 'MongoDB',
  redis: 'Redis',
  sqlite: 'SQLite',
  dynamodb: 'DynamoDB',
  elasticsearch: 'Elasticsearch',
  prisma: 'Prisma',
  drizzle: 'Drizzle ORM',
  typeorm: 'TypeORM',
  aws: 'AWS',
  'amazon web services': 'AWS',
  gcp: 'GCP',
  'google cloud': 'GCP',
  azure: 'Azure',
  docker: 'Docker',
  kubernetes: 'Kubernetes',
  k8s: 'Kubernetes',
  terraform: 'Terraform',
  ansible: 'Ansible',
  'ci/cd': 'CI/CD',
  cicd: 'CI/CD',
  'github actions': 'GitHub Actions',
  gitlab: 'GitLab CI',
  linux: 'Linux',
  nginx: 'Nginx',
  microservices: 'Microservices',
  'event-driven': 'Event-Driven Architecture',
  'event driven': 'Event-Driven Architecture',
  webassembly: 'WebAssembly',
  wasm: 'WebAssembly',
  'objective-c': 'Objective-C',
  coredata: 'Core Data',
  'core data': 'Core Data',
  rag: 'RAG',
  llm: 'LLM',
  openai: 'OpenAI API',
  gemini: 'Gemini API',
  langchain: 'LangChain',
  llamaindex: 'LlamaIndex',
  pinecone: 'Pinecone',
  weaviate: 'Weaviate',
  pgvector: 'pgvector',
  quickbooks: 'QuickBooks',
  'microsoft excel': 'Microsoft Excel',
  'microsoft office': 'Microsoft Office',
  'power bi': 'Power BI',
  salesforce: 'Salesforce',
  hubspot: 'HubSpot',
  git: 'Git',
  github: 'GitHub',
  jira: 'Jira',
  agile: 'Agile',
  scrum: 'Scrum',
  jest: 'Jest',
  playwright: 'Playwright',
  cypress: 'Cypress',
  vitest: 'Vitest',
  figma: 'Figma',
};

function skillKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\w\s#+.-]/g, '')
    .replace(/\s+/g, ' ');
}

export const SKILL_ALIASES: Readonly<Record<string, string>> = Object.freeze(
  Object.values(BASE_SKILL_ALIASES).reduce<Record<string, string>>(
    (aliases, canonical) => {
      aliases[skillKey(canonical)] = canonical;
      return aliases;
    },
    Object.fromEntries(
      Object.entries(BASE_SKILL_ALIASES).map(([alias, canonical]) => [
        skillKey(alias),
        canonical,
      ])
    )
  )
);

export function normalizeSkill(rawSkill: string): string {
  const trimmed = rawSkill.trim();
  if (!trimmed) return '';

  const canonical = SKILL_ALIASES[skillKey(trimmed)];
  if (canonical) return canonical;

  return trimmed
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function normalizeSkills(skills: string[]): string[] {
  return [...new Set(skills.map(normalizeSkill).filter(Boolean))];
}

/** Generic soft/language skills that should not dominate engineering fit scoring. */
const GENERIC_SOFT_SKILLS = new Set(
  [
    'Communication',
    'Leadership',
    'Problem Solving',
    'Time Management',
    'Attention to Detail',
    'Teamwork',
    'English',
    'Spanish',
    'Mandarin',
    'Sales',
    'Marketing',
    'Customer Service',
    'Internet Research',
  ].map(normalizeSkill)
);

export function isGenericSoftSkill(skill: string): boolean {
  return GENERIC_SOFT_SKILLS.has(normalizeSkill(skill));
}

/** Soft skills are demoted out of required lists so they stop creating false gaps. */
export function partitionJobSkills(
  requiredSkills: string[] = [],
  preferredSkills: string[] = []
): { requiredSkills: string[]; preferredSkills: string[] } {
  const required: string[] = [];
  const preferred = new Set(normalizeSkills(preferredSkills));

  for (const skill of normalizeSkills(requiredSkills)) {
    if (isGenericSoftSkill(skill)) preferred.add(skill);
    else required.push(skill);
  }

  return {
    // Keep scoring focused — long extractor dumps should not dilute core fit.
    requiredSkills: required.slice(0, 8),
    preferredSkills: [...preferred].slice(0, 10),
  };
}

/** Soft skills are ignored for fit scoring (neither required nor preferred weight). */
export function skillsForScoring(
  requiredSkills: string[] = [],
  preferredSkills: string[] = []
): { requiredSkills: string[]; preferredSkills: string[] } {
  const required = normalizeSkills(requiredSkills)
    .filter((skill) => !isGenericSoftSkill(skill))
    .slice(0, 8);
  const preferred = normalizeSkills(preferredSkills)
    .filter((skill) => !isGenericSoftSkill(skill) && !required.includes(skill))
    .slice(0, 10);

  return { requiredSkills: required, preferredSkills: preferred };
}

// Conservative, explainable transfer credit. Exact aliases still receive 1.0.
const RELATED_SKILLS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  TypeScript: { JavaScript: 0.7 },
  JavaScript: { TypeScript: 0.5 },
  'Next.js': { React: 0.8, 'Node.js': 0.4 },
  React: { 'Next.js': 0.7, 'Vue.js': 0.35, Angular: 0.35 },
  'Vue.js': { React: 0.35, Angular: 0.35 },
  Angular: { React: 0.35, 'Vue.js': 0.35 },
  PostgreSQL: { SQL: 0.8, MySQL: 0.6 },
  MySQL: { SQL: 0.8, PostgreSQL: 0.6 },
  AWS: { GCP: 0.5, Azure: 0.5 },
  GCP: { AWS: 0.5, Azure: 0.5 },
  Azure: { AWS: 0.5, GCP: 0.5 },
  Kubernetes: { Docker: 0.5 },
  Docker: { Kubernetes: 0.35 },
};

export function skillEvidenceCredit(
  candidateSkills: Iterable<string>,
  requiredSkill: string
): number {
  const candidateSet = new Set([...candidateSkills].map(normalizeSkill));
  const required = normalizeSkill(requiredSkill);
  if (candidateSet.has(required)) return 1;

  let bestCredit = 0;
  for (const candidate of candidateSet) {
    bestCredit = Math.max(bestCredit, RELATED_SKILLS[candidate]?.[required] ?? 0);
  }
  return bestCredit;
}
