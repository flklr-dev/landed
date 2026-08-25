// ─────────────────────────────────────────────────────────────────────────────
// Landed — Match Explainer Unit Tests
// Tests deterministic fallback variation, domain awareness, and async generator.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateDeterministicExplanation,
  generateMatchExplanation,
} from './match-explainer.js';

describe('Match Explainer & Breakdown Suite', () => {
  describe('1. Strong Compatibility Breakdown (4+ Matched Skills)', () => {
    it('generates high-conviction breakdown referencing all matched skills', () => {
      const input = {
        candidate: {
          skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Docker'],
          roles: ['Senior Full Stack Engineer'],
          yearsOfExperience: 6,
        },
        job: {
          company: 'Acme Corp',
          title: 'Senior Full Stack Engineer',
          requiredSkills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
          description: 'Join our fast-paced startup building cloud infrastructure for enterprise clients.',
        },
        match: {
          score: 95,
          matchedSkills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
          missingSkills: [],
        },
      };

      const explanation = generateDeterministicExplanation(input);

      assert.ok(explanation.includes('**Key Strengths:**'));
      assert.ok(explanation.includes('TypeScript, React, Node.js, PostgreSQL'));
      assert.ok(explanation.includes('Acme Corp'));
      assert.ok(explanation.includes('95% fit'));
      assert.ok(explanation.includes('**Skill Gaps & Strategy:**'));
      assert.ok(explanation.includes('**Recommended Talking Point:**'));
      assert.ok(explanation.includes('6+ years'), 'Should reference senior experience level');
    });
  });

  describe('2. Partial Compatibility with Specific Skill Gaps', () => {
    it('addresses missing skills with actionable interview strategies', () => {
      const input = {
        candidate: {
          skills: ['React', 'Node.js'],
          roles: ['Frontend Developer'],
          yearsOfExperience: 3,
        },
        job: {
          company: 'Stripe',
          title: 'Full Stack Engineer',
          requiredSkills: ['React', 'Node.js', 'Go', 'Kubernetes'],
          description: 'Build scalable backend systems and cloud infrastructure for payment processing.',
        },
        match: {
          score: 68,
          matchedSkills: ['React', 'Node.js'],
          missingSkills: ['Go', 'Kubernetes'],
        },
      };

      const explanation = generateDeterministicExplanation(input);

      assert.ok(explanation.includes('**Key Strengths:**'));
      assert.ok(explanation.includes('React and Node.js'), 'Should list 2 matched skills with "and"');
      assert.ok(explanation.includes('Go and Kubernetes'), 'Should specifically identify missing skills');
      assert.ok(explanation.includes('30-day learning plan'), 'Should give specific gap-closing advice');
    });
  });

  describe('3. Zero Matched Skills — Reach Role', () => {
    it('generates relevant advice even when no skills overlap', () => {
      const input = {
        candidate: {
          skills: ['Python', 'Django', 'PostgreSQL'],
          roles: ['Backend Developer'],
          yearsOfExperience: 4,
        },
        job: {
          company: 'Apple',
          title: 'iOS Developer',
          requiredSkills: ['Swift', 'SwiftUI', 'Objective-C', 'CoreData'],
          description: 'Develop cutting-edge mobile applications for the iOS platform.',
        },
        match: {
          score: 35,
          matchedSkills: [],
          missingSkills: ['Swift', 'SwiftUI', 'Objective-C', 'CoreData'],
        },
      };

      const explanation = generateDeterministicExplanation(input);

      assert.ok(explanation.includes('**Key Strengths:**'));
      assert.ok(explanation.includes('Python, Django, PostgreSQL'), 'Should reference candidate skills as transferable');
      assert.ok(explanation.includes('mobile development'), 'Should detect iOS domain from description');
      assert.ok(explanation.includes('35% fit'));
      assert.ok(explanation.includes('Swift and SwiftUI'), 'Should identify priority missing skills');
    });
  });

  describe('4. Different Jobs Produce Different Output', () => {
    it('generates meaningfully different explanations for different roles', () => {
      const candidate = {
        skills: ['JavaScript', 'React', 'Node.js', 'AWS'],
        roles: ['Full Stack Developer'],
        yearsOfExperience: 4,
      };

      const jobA = {
        candidate,
        job: {
          company: 'Netflix',
          title: 'Frontend Engineer',
          requiredSkills: ['React', 'TypeScript', 'GraphQL'],
          description: 'Build responsive, accessible UI components for our streaming platform.',
        },
        match: {
          score: 72,
          matchedSkills: ['React'],
          missingSkills: ['TypeScript', 'GraphQL'],
        },
      };

      const jobB = {
        candidate,
        job: {
          company: 'AWS',
          title: 'Cloud Solutions Architect',
          requiredSkills: ['AWS', 'Terraform', 'Kubernetes'],
          description: 'Design large-scale cloud infrastructure solutions for enterprise customers.',
        },
        match: {
          score: 55,
          matchedSkills: ['AWS'],
          missingSkills: ['Terraform', 'Kubernetes'],
        },
      };

      const explanationA = generateDeterministicExplanation(jobA);
      const explanationB = generateDeterministicExplanation(jobB);

      // They should be meaningfully different — not the same template with swapped names
      assert.ok(explanationA !== explanationB, 'Different jobs must produce different explanations');
      assert.ok(explanationA.includes('Netflix'));
      assert.ok(explanationB.includes('AWS'));
      assert.ok(explanationA.includes('frontend engineering'), 'Should detect frontend domain');
      assert.ok(explanationB.includes('cloud infrastructure'), 'Should detect cloud domain');
    });
  });

  describe('5. Job Description Domain Keywords Influence Output', () => {
    it('references detected domain context from the job description', () => {
      const input = {
        candidate: {
          skills: ['Python', 'TensorFlow'],
          roles: ['ML Engineer'],
          yearsOfExperience: 3,
        },
        job: {
          company: 'DeepMind',
          title: 'Research Engineer',
          requiredSkills: ['Python', 'PyTorch', 'CUDA'],
          description: 'Work on cutting-edge machine learning models and deep learning inference pipelines.',
        },
        match: {
          score: 60,
          matchedSkills: ['Python'],
          missingSkills: ['PyTorch', 'CUDA'],
        },
      };

      const explanation = generateDeterministicExplanation(input);

      assert.ok(
        explanation.includes('machine learning'),
        'Should detect ML domain from job description'
      );
    });
  });

  describe('6. Senior vs Junior Experience Variation', () => {
    it('produces different talking points for senior vs junior candidates', () => {
      const baseJob = {
        company: 'Google',
        title: 'Software Engineer',
        requiredSkills: ['Go', 'Kubernetes'],
        description: 'Build distributed systems at scale.',
      };

      const baseMatch = {
        score: 70,
        matchedSkills: ['Go'],
        missingSkills: ['Kubernetes'],
      };

      const seniorExplanation = generateDeterministicExplanation({
        candidate: {
          skills: ['Go', 'Python'],
          roles: ['Staff Engineer'],
          yearsOfExperience: 10,
        },
        job: baseJob,
        match: baseMatch,
      });

      const juniorExplanation = generateDeterministicExplanation({
        candidate: {
          skills: ['Go', 'Python'],
          roles: ['Junior Developer'],
          yearsOfExperience: 1,
        },
        job: baseJob,
        match: baseMatch,
      });

      assert.ok(seniorExplanation.includes('10+ years'), 'Senior should reference years');
      assert.ok(seniorExplanation.includes('mentored') || seniorExplanation.includes('architecture decisions'),
        'Senior advice should focus on leadership/impact');
      assert.ok(juniorExplanation.includes('curiosity') || juniorExplanation.includes('learning'),
        'Junior advice should focus on growth signals');
      assert.ok(seniorExplanation !== juniorExplanation, 'Different experience levels must produce different output');
    });
  });

  describe('7. Many Missing Skills (3+) Uses Priority Framing', () => {
    it('prioritizes top 2 gaps and frames remaining skills separately', () => {
      const input = {
        candidate: {
          skills: ['JavaScript'],
          roles: ['Web Developer'],
          yearsOfExperience: 2,
        },
        job: {
          company: 'Vercel',
          title: 'Platform Engineer',
          requiredSkills: ['Rust', 'Go', 'Kubernetes', 'Terraform'],
          description: 'Build edge compute platform infrastructure.',
        },
        match: {
          score: 30,
          matchedSkills: [],
          missingSkills: ['Rust', 'Go', 'Kubernetes', 'Terraform'],
        },
      };

      const explanation = generateDeterministicExplanation(input);

      assert.ok(explanation.includes('Rust and Go'), 'Should prioritize first 2 missing skills');
      assert.ok(explanation.includes('Kubernetes, Terraform'), 'Should mention remaining gaps');
      assert.ok(explanation.includes('rapid onboarding'), 'Should frame as onboarding capability');
    });
  });

  describe('8. Async Generator Returns Deterministic in Test', () => {
    it('returns formatted markdown with all 3 sections in test environment', async () => {
      const input = {
        candidate: {
          skills: ['Python', 'SQL'],
          roles: ['Data Analyst'],
          yearsOfExperience: 2,
        },
        job: {
          company: 'DataFlow',
          title: 'Analytics Engineer',
          requiredSkills: ['Python', 'SQL', 'dbt'],
        },
        match: {
          score: 74,
          matchedSkills: ['Python', 'SQL'],
          missingSkills: ['dbt'],
        },
      };

      const explanation = await generateMatchExplanation(input);

      assert.ok(typeof explanation === 'string');
      assert.ok(explanation.length > 50);
      assert.ok(explanation.includes('**Key Strengths:**'));
      assert.ok(explanation.includes('**Skill Gaps & Strategy:**'));
      assert.ok(explanation.includes('**Recommended Talking Point:**'));
    });
  });

  describe('9. Culture Signal Detection', () => {
    it('detects startup environment from job description', () => {
      const input = {
        candidate: {
          skills: ['React', 'TypeScript'],
          roles: ['Frontend Dev'],
          yearsOfExperience: 5,
        },
        job: {
          company: 'TechStartup',
          title: 'Senior Frontend Engineer',
          requiredSkills: ['React', 'TypeScript', 'Next.js'],
          description: 'Join our early-stage startup disrupting fintech with a fast-paced team.',
        },
        match: {
          score: 88,
          matchedSkills: ['React', 'TypeScript'],
          missingSkills: ['Next.js'],
        },
      };

      const explanation = generateDeterministicExplanation(input);

      assert.ok(
        explanation.includes('fast-paced startup'),
        'Should detect startup culture signal from description'
      );
    });
  });
});
