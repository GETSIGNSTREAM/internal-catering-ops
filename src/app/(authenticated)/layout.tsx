import BottomNav from "@/components/ui/BottomNav";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <BottomNav />
      <div className="pb-20" />
    </>
  );
}
