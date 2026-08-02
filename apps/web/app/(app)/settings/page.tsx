import type { Metadata } from 'next';
import { TopBar } from '@/components/features/TopBar';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { mockUser, mockResume } from '@/lib/mock-data';
import { Upload, AlertCircle, CheckCircle2 } from 'lucide-react';

export const metadata: Metadata = { title: 'Settings' };

export default function SettingsPage() {
  return (
    <>
      <TopBar title="Settings" subtitle="Account & subscription" />

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-2xl mx-auto space-y-8">

          {/* Subscription */}
          <section>
            <p className="text-[10px] font-mono uppercase tracking-widest text-ink-muted mb-4">
              Subscription
            </p>
            <div className="border border-line p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink capitalize">{mockUser.plan} Plan</p>
                  <p className="text-xs text-ink-muted mt-0.5">
                    {mockUser.plan === 'premium'
                      ? 'Best Matches, resume parsing, and AI explanations unlocked.'
                      : 'Upgrade to unlock Best Matches and resume-fit scoring.'}
                  </p>
                </div>
                <Badge
                  variant={mockUser.plan === 'premium' ? 'premium' : 'free'}
                  label={mockUser.plan}
                />
              </div>

              {mockUser.plan === 'premium' ? (
                <div className="flex items-center gap-2 text-green-700 text-xs bg-green-50 border border-green-200 px-3 py-2 rounded-md">
                  <CheckCircle2 size={14} />
                  Premium active — renews monthly. Manage billing via Stripe portal.
                </div>
              ) : (
                <Button className="w-full sm:w-auto">
                  Upgrade to Premium — $9/mo
                </Button>
              )}
            </div>
          </section>

          {/* Profile */}
          <section>
            <p className="text-[10px] font-mono uppercase tracking-widest text-ink-muted mb-4">
              Profile
            </p>
            <div className="border border-line p-5 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-ink/8 flex items-center justify-center">
                  <span className="text-lg font-semibold text-ink">
                    {mockUser.name.split(' ').map((n) => n[0]).join('')}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink">{mockUser.name}</p>
                  <p className="text-xs text-ink-muted">{mockUser.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Full Name"
                  defaultValue={mockUser.name}
                  placeholder="Your name"
                />
                <Input
                  label="Email"
                  type="email"
                  defaultValue={mockUser.email}
                  placeholder="your@email.com"
                />
              </div>
              <Button variant="secondary" size="sm">
                Save Profile
              </Button>
            </div>
          </section>

          {/* Resume */}
          <section>
            <p className="text-[10px] font-mono uppercase tracking-widest text-ink-muted mb-4">
              Resume
            </p>
            <div className="border border-line p-5 space-y-4">
              {mockResume ? (
                <>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-signal/10 rounded-sm flex items-center justify-center shrink-0">
                      <Upload size={15} className="text-signal" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink">{mockResume.fileName}</p>
                      <p className="text-xs text-ink-muted mt-0.5">
                        Uploaded{' '}
                        {new Date(mockResume.uploadedAt).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <Badge variant="default" label="Active" dot />
                  </div>

                  {/* Parsed skills */}
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-ink-muted mb-2">
                      Detected Skills ({mockResume.parsedSkills.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {mockResume.parsedSkills.map((skill) => (
                        <span
                          key={skill}
                          className="text-xs font-mono px-2 py-0.5 bg-ink/5 text-ink-muted border border-line rounded-sm"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <Button variant="secondary" size="sm">
                    <Upload size={13} />
                    Replace Resume
                  </Button>
                </>
              ) : (
                <div className="border border-dashed border-line rounded-none p-8 text-center space-y-3">
                  <Upload size={24} className="mx-auto text-ink-muted/40" />
                  <p className="text-sm text-ink-muted">No resume uploaded yet</p>
                  <Button size="sm">
                    <Upload size={13} />
                    Upload Resume
                  </Button>
                </div>
              )}
            </div>
          </section>

          {/* Danger zone */}
          <section>
            <p className="text-[10px] font-mono uppercase tracking-widest text-red-500 mb-4">
              Danger Zone
            </p>
            <div className="border border-red-200 p-5 space-y-3">
              <div className="flex items-start gap-2">
                <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-ink">Delete Account</p>
                  <p className="text-xs text-ink-muted mt-0.5">
                    Permanently delete your account and all tracked jobs. This cannot be undone.
                  </p>
                </div>
              </div>
              <Button variant="danger" size="sm">
                Delete Account
              </Button>
            </div>
          </section>

        </div>
      </div>
    </>
  );
}
