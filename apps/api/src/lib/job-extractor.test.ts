import assert from 'node:assert/strict';
import test from 'node:test';
import { extractDeterministicJob, extractFromUrlSlug } from './deterministic-job-parser.js';
import { extractJobDetailsFromHtml } from './job-extractor.js';

test('extracts an escaped Next.js JobPosting and ignores platform metadata', () => {
  const posting = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: 'Product Specialist',
    hiringOrganization: { '@type': 'Organization', name: 'Your Simply Recycling LLC' },
    jobLocationType: 'TELECOMMUTE',
    employmentType: 'PART_TIME',
    baseSalary: {
      '@type': 'MonetaryAmount',
      currency: 'PHP',
      value: { '@type': 'QuantitativeValue', value: 250, unitText: 'HOUR' },
    },
    description:
      '<p>Strong internet research skills and excellent communication skills. Experience with IT hardware and networking.</p>',
  };
  const flightPayload = `22:${JSON.stringify(posting)}`;
  const html = `
    <html>
      <head>
        <title>User Researcher - bossjob</title>
        <meta property="og:title" content="User Researcher - bossjob">
        <meta property="og:site_name" content="bossjob - A Chat-first Career Platform for Professionals in Philippines">
      </head>
      <body>
        <h1>User Researcher</h1>
        <script>self.__next_f.push([1,${JSON.stringify(flightPayload)}])</script>
      </body>
    </html>
  `;

  const result = extractJobDetailsFromHtml(
    html,
    'https://bossjob.ph/en-us/job/product-specialist-remote-523592',
  );

  assert.equal(result.company, 'Your Simply Recycling LLC');
  assert.equal(result.title, 'Product Specialist');
  assert.equal(result.location, 'Remote');
  assert.equal(result.remoteType, 'remote', JSON.stringify(result));
  assert.equal(result.jobType, 'part-time');
  assert.equal(result.salaryRaw, '₱250/hour');
  assert.ok(result.requiredSkills.includes('Internet Research'));
  assert.ok(result.requiredSkills.includes('Communication'));
});

test('merges fields from JSON-LD, meta tags, and visible page text', () => {
  const html = `
    <html>
      <head>
        <meta property="og:title" content="Senior Accountant at Acme Corp">
        <meta name="description" content="A hybrid, full-time accounting role.">
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@graph": [{
              "@type": "JobPosting",
              "title": "Senior Accountant",
              "hiringOrganization": { "name": "Acme Corp" },
              "jobLocation": { "address": { "addressLocality": "Makati", "addressCountry": "PH" } }
            }]
          }
        </script>
      </head>
      <body>
        <h1>Senior Accountant</h1>
        <p>Hybrid full-time role. Salary ₱50,000–₱70,000/month. Requires accounting, Microsoft Excel, and QuickBooks.</p>
      </body>
    </html>
  `;

  const result = extractJobDetailsFromHtml(html, 'https://careers.acme.example/jobs/senior-accountant');

  assert.equal(result.company, 'Acme Corp');
  assert.equal(result.location, 'Makati, PH');
  assert.equal(result.remoteType, 'hybrid');
  assert.equal(result.jobType, 'full-time');
  assert.equal(result.salaryRaw, '₱50,000–₱70,000/month');
  assert.ok(result.requiredSkills.includes('Accounting'));
  assert.ok(result.requiredSkills.includes('Microsoft Excel'));
  assert.ok(result.requiredSkills.includes('QuickBooks'));
});

test('does not treat a job board brand as the employer', () => {
  const html = `
    <html>
      <head>
        <title>Frontend Developer - LinkedIn</title>
        <meta property="og:site_name" content="LinkedIn">
      </head>
      <body><h1>Frontend Developer</h1><p>Remote full-time role using React and TypeScript.</p></body>
    </html>
  `;

  const result = extractDeterministicJob(html, 'https://www.linkedin.com/jobs/view/123456').job;
  assert.equal(result.company, null);
  assert.equal(result.title, 'Frontend Developer');
  assert.equal(result.remoteType, 'remote', JSON.stringify(result));
  assert.ok(result.requiredSkills?.includes('React'));
});

test('extracts an employer from aggregator title metadata', () => {
  const html = `
    <html>
      <head>
        <title>Frontend Engineer | Acme Corp | LinkedIn</title>
        <meta property="og:title" content="Frontend Engineer | Acme Corp | LinkedIn">
        <meta property="og:site_name" content="LinkedIn">
      </head>
      <body><h1>Frontend Engineer</h1></body>
    </html>
  `;

  const result = extractJobDetailsFromHtml(html, 'https://www.linkedin.com/jobs/view/987654');
  assert.equal(result.title, 'Frontend Engineer');
  assert.equal(result.company, 'Acme Corp');
});

test('skips locale segments and reads useful information from a URL slug', () => {
  const result = extractFromUrlSlug(
    'https://bossjob.ph/en-us/job/product-specialist-remote-523592',
  );

  assert.equal(result.company, null);
  assert.equal(result.title, 'Product Specialist Remote');
  assert.equal(result.location, 'Remote');
  assert.equal(result.remoteType, 'remote');
});
