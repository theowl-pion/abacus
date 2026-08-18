import ToolsNav from "@/components/ToolsNav";

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh gap-4 overflow-hidden p-4">
      <ToolsNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
