import { Sidebar } from '@/components/features/Sidebar';
import { AIChatWidget } from '@/components/features/AIChatWidget';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-bg relative">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {children}
      </main>
      <AIChatWidget />
    </div>
  );
}
