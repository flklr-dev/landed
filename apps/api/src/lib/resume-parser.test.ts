// ─────────────────────────────────────────────────────────────────────────────
// Landed — Resume Parser Unit Tests
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSkill,
  parseResumeDeterministically,
  parseResume,
  extractTextFromFileBuffer,
} from './resume-parser.js';

describe('Resume Parser & Skill Extraction Suite', () => {
  describe('1. Canonical Skill Normalization', () => {
    it('normalizes various casing and abbreviations accurately', () => {
      assert.equal(normalizeSkill('reactjs'), 'React');
      assert.equal(normalizeSkill('REACT.JS'), 'React');
      assert.equal(normalizeSkill('ts'), 'TypeScript');
      assert.equal(normalizeSkill('TypeScript'), 'TypeScript');
      assert.equal(normalizeSkill('node.js'), 'Node.js');
      assert.equal(normalizeSkill('nodejs'), 'Node.js');
      assert.equal(normalizeSkill('postgres'), 'PostgreSQL');
      assert.equal(normalizeSkill('postgresql'), 'PostgreSQL');
      assert.equal(normalizeSkill('k8s'), 'Kubernetes');
      assert.equal(normalizeSkill('kubernetes'), 'Kubernetes');
      assert.equal(normalizeSkill('aws'), 'AWS');
      assert.equal(normalizeSkill('amazon web services'), 'AWS');
      assert.equal(normalizeSkill('golang'), 'Go');
      assert.equal(normalizeSkill('tailwind'), 'Tailwind CSS');
    });

    it('falls back to title-casing for unknown skills', () => {
      assert.equal(normalizeSkill('solidity smart contracts'), 'Solidity Smart Contracts');
    });
  });

  describe('2. Text Extraction from File Buffer', () => {
    it('extracts plain text and markdown buffers directly', async () => {
      const textBuffer = Buffer.from('Senior Full Stack Developer skilled in React and Node.js with 5 years experience.');
      const result = await extractTextFromFileBuffer(textBuffer, 'text/plain', 'resume.txt');
      assert.ok(result.includes('Full Stack Developer'));
      assert.ok(result.includes('React and Node.js'));
    });

    it('extracts text from PDF buffer using PDFParse', async () => {
      const minPdf = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 44 >>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Candidate with React and TypeScript) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000202 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n298\n%%EOF'
      );
      const result = await extractTextFromFileBuffer(minPdf, 'application/pdf', 'resume.pdf');
      assert.ok(result.includes('Candidate with React and TypeScript') || result.includes('React'));
    });
  });

  describe('3. Deterministic Resume Parsing', () => {
    const sampleResume = `
      Alex Rivers
      Senior Full Stack Engineer | San Francisco, CA | alex.rivers@example.com

      Summary:
      Passionate engineer with 6+ years of experience architecting high-performance distributed web applications.

      Skills:
      Languages: TypeScript, JavaScript, Python, Go, SQL
      Frontend: React, Next.js, Tailwind CSS, Redux, HTML5, CSS3
      Backend: Node.js, Express, NestJS, PostgreSQL, Redis, Prisma, GraphQL
      Cloud & DevOps: AWS, Docker, Kubernetes, Terraform, CI/CD, GitHub Actions

      Experience:
      Senior Full Stack Engineer — TechCorp (2021 – Present)
      - Led migration of monolith to microservices using Next.js, Node.js, and PostgreSQL.
      - Automated CI/CD pipelines via GitHub Actions and deployed onto AWS with Docker and Kubernetes.

      Software Engineer — StartupInc (2018 – 2021)
      - Built real-time analytics dashboard using React, TypeScript, and Redis.
    `;

    it('extracts structured candidate skills', () => {
      const parsed = parseResumeDeterministically(sampleResume);

      // Verify core skills
      assert.ok(parsed.skills.includes('TypeScript'), 'Should contain TypeScript');
      assert.ok(parsed.skills.includes('React'), 'Should contain React');
      assert.ok(parsed.skills.includes('Next.js'), 'Should contain Next.js');
      assert.ok(parsed.skills.includes('Node.js'), 'Should contain Node.js');
      assert.ok(parsed.skills.includes('PostgreSQL'), 'Should contain PostgreSQL');
      assert.ok(parsed.skills.includes('AWS'), 'Should contain AWS');
      assert.ok(parsed.skills.includes('Docker'), 'Should contain Docker');
      assert.ok(parsed.skills.includes('Kubernetes'), 'Should contain Kubernetes');
      assert.ok(parsed.skills.includes('Python'), 'Should contain Python');
    });

    it('extracts primary target roles', () => {
      const parsed = parseResumeDeterministically(sampleResume);
      assert.ok(parsed.roles.includes('Senior Full Stack Engineer') || parsed.roles.includes('Software Engineer'));
    });

    it('extracts years of experience accurately', () => {
      const parsed = parseResumeDeterministically(sampleResume);
      assert.equal(parsed.yearsOfExperience, 6);
    });

    it('extracts summary accurately', () => {
      const parsed = parseResumeDeterministically(sampleResume);
      assert.ok(parsed.summary);
      assert.ok(parsed.summary.includes('Passionate engineer with 6+ years of experience'));
    });
  });

  describe('4. Edge Cases and Resilience', () => {
    it('throws when resume text is too short', async () => {
      await assert.rejects(async () => {
        await parseResume('Short text');
      }, /too short/i);
    });

    it('estimates experience from date ranges when explicit years are omitted', () => {
      const textWithoutExplicitYears = `
        Jane Doe
        Frontend Developer
        Skills: React, Vue.js, JavaScript, CSS
        Work History:
        Frontend Developer at Acme (2020 - Present)
        Junior Developer at Beta (2019 - 2020)
      `;
      const parsed = parseResumeDeterministically(textWithoutExplicitYears);
      assert.ok(parsed.yearsOfExperience && parsed.yearsOfExperience >= 5);
      assert.ok(parsed.skills.includes('React'));
      assert.ok(parsed.skills.includes('Vue.js'));
    });
  });
});
