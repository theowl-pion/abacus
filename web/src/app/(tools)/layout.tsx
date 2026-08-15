import ToolsNav from "@/components/ToolsNav";

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <ToolsNav />
      <div className="flex-1">{children}</div>
    </div>
  );
}
