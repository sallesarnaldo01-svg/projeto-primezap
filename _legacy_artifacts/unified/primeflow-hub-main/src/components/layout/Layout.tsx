import { useEffect, useMemo, useState } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { useUIStore } from "@/stores/ui";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { sidebarCollapsed } = useUIStore();
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth >= 768;
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const dynamicMarginLeft = useMemo(() => {
    if (!isDesktop) {
      return 0;
    }
    return sidebarCollapsed ? 80 : 280;
  }, [isDesktop, sidebarCollapsed]);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      <div
        className={cn(
          "flex flex-col transition-all duration-300"
        )}
        style={{
          marginLeft: dynamicMarginLeft,
        }}
      >
        <Header />

        <motion.main
          className="flex-1 p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
