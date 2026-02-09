import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { SidebarProvider } from '@/components/layout/sidebar-context';

export default function PipelineLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col lg:pl-64">
          <Header />
          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
