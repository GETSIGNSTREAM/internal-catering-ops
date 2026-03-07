import BottomNav from "@/components/ui/BottomNav";
import ViewAsBanner from "@/components/ui/ViewAsBanner";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ViewAsBanner />
      {children}
      <BottomNav />
      <div className="pb-20" />
    </>
  );
}
