// ─────────────────────────────────────────────────────────────────────────────
// Landed — Matching Engine Unit Tests
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateJobMatch } from './matching-engine.js';

describe('Hybrid Match Scoring Engine Suite', () => {
  const mockResume = {
    parsedSkills: ['TypeScript', 'React', 'Next.js', 'Node.js', 'PostgreSQL', 'Docker', 'AWS'],
    parsedRoles: ['Senior Full Stack Engineer', 'Software Engineer'],
    yearsOfExperience: 6,
  };

  describe('1. High Compatibility Scenario', () => {
    it('scores high (>= 85) when candidate matches all required skills and seniority', () => {
      const job = {
        title: 'Senior Full Stack Developer',
        requiredSkills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
        experienceLevel: 'Senior',
      };

      const result = calculateJobMatch(mockResume, job);

      assert.ok(result.score >= 85, `Expected score >= 85, got ${result.score}`);
      assert.equal(result.missingSkills.length, 0);
      assert.equal(result.matchedSkills.length, 4);
      assert.ok(result.matchedSkills.includes('React'));
      assert.ok(result.matchedSkills.includes('TypeScript'));
    });
  });

  describe('2. Partial Compatibility & Missing Skills', () => {
    it('categorizes matched vs missing skills accurately', () => {
      const job = {
        title: 'Full Stack Engineer',
        requiredSkills: ['React', 'Node.js', 'Rust', 'Solidity'],
        experienceLevel: 'Mid',
      };

      const result = calculateJobMatch(mockResume, job);

      assert.ok(result.score >= 50 && result.score <= 80, `Expected score between 50 and 80, got ${result.score}`);
      assert.deepEqual(result.matchedSkills.sort(), ['Node.js', 'React'].sort());
      assert.deepEqual(result.missingSkills.sort(), ['Rust', 'Solidity'].sort());
    });
  });

  describe('3. Low Compatibility Scenario', () => {
    it('scores lower and lists all skills as missing when candidate lacks required stack', () => {
      const job = {
        title: 'iOS Mobile Developer',
        requiredSkills: ['Swift', 'SwiftUI', 'Objective-C', 'CoreData'],
        experienceLevel: 'Senior',
      };

      const result = calculateJobMatch(mockResume, job);

      assert.ok(result.score <= 55, `Expected score <= 55 for mismatched stack, got ${result.score}`);
      assert.equal(result.matchedSkills.length, 0);
      assert.equal(result.missingSkills.length, 4);
    });
  });

  describe('4. Seniority and Experience Weighting', () => {
    it('gives higher score to experienced candidate for senior role', () => {
      const seniorJob = {
        title: 'Lead Software Architect',
        requiredSkills: ['TypeScript', 'AWS', 'Docker'],
        experienceLevel: 'Senior',
      };

      const seniorCandidate = {
        parsedSkills: ['TypeScript', 'AWS', 'Docker'],
        parsedRoles: ['Senior Software Engineer'],
        yearsOfExperience: 8,
      };

      const juniorCandidate = {
        parsedSkills: ['TypeScript', 'AWS', 'Docker'],
        parsedRoles: ['Junior Developer'],
        yearsOfExperience: 1,
      };

      const seniorResult = calculateJobMatch(seniorCandidate, seniorJob);
      const juniorResult = calculateJobMatch(juniorCandidate, seniorJob);

      assert.ok(seniorResult.score > juniorResult.score, 'Senior candidate should score higher for senior role');
    });
  });

  describe('5. Jobs with No Explicit Skills Specified', () => {
    it('evaluates description text keywords when requiredSkills array is empty', () => {
      const jobWithDescriptionOnly = {
        title: 'Full Stack Engineer',
        requiredSkills: [],
        description: 'Looking for a developer with experience in React, Node.js, and Docker to build cloud applications.',
      };

      const result = calculateJobMatch(mockResume, jobWithDescriptionOnly);

      assert.ok(result.score >= 65, `Expected score >= 65, got ${result.score}`);
      assert.ok(result.matchedSkills.length > 0);
    });

    it('returns a sensible neutral baseline score when description is also blank', () => {
      const blankJob = {
        title: 'Software Developer',
        requiredSkills: [],
        description: null,
      };

      const result = calculateJobMatch(mockResume, blankJob);

      assert.ok(result.score >= 50 && result.score <= 85);
      assert.equal(result.missingSkills.length, 0);
    });
  });

  describe('6. Skill Normalization Across Case and Formats', () => {
    it('matches skills regardless of case differences (e.g., nodejs vs Node.js)', () => {
      const unnormalizedResume = {
        parsedSkills: ['reactjs', 'k8s', 'postgres'],
        parsedRoles: ['Software Engineer'],
        yearsOfExperience: 3,
      };

      const jobWithFormalNames = {
        title: 'Software Engineer',
        requiredSkills: ['React', 'Kubernetes', 'PostgreSQL'],
      };

      const result = calculateJobMatch(unnormalizedResume, jobWithFormalNames);

      assert.equal(result.missingSkills.length, 0);
      assert.equal(result.matchedSkills.length, 3);
      assert.ok(result.score >= 80);
    });
  });

  describe('7. Score Range Boundaries', () => {
    it('always produces scores within 0 to 100', () => {
      const emptyResume = {
        parsedSkills: [],
        parsedRoles: [],
        yearsOfExperience: 0,
      };

      const highReqJob = {
        title: 'Staff AI Researcher',
        requiredSkills: ['PyTorch', 'TensorFlow', 'CUDA', 'C++', 'Linear Algebra'],
        experienceLevel: 'Staff',
      };

      const result = calculateJobMatch(emptyResume, highReqJob);
      assert.ok(result.score >= 0 && result.score <= 100);
    });
  });
});
