
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SecurityProvider } from "@/contexts/SecurityContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { WeatherProvider } from "@/contexts/WeatherContext";
import InstallPrompt from "@/components/InstallPrompt";
import UpdateNotification from "@/components/UpdateNotification";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { useState, useEffect } from "react";
import { getCurrentVersion, getStoredVersion } from "@/utils/versionManager";
import WhatsNewModal from "@/components/WhatsNewModal";

const queryClient = new QueryClient();

const App = () => {
  const [showWhatsNew, setShowWhatsNew] = useState(false);

  useEffect(() => {
    // Check if we should show "What's New" modal
    const checkVersion = async () => {
      const currentVersion = await getCurrentVersion();
      const storedVersion = getStoredVersion();
      
      if (!storedVersion || storedVersion !== currentVersion) {
        setShowWhatsNew(true);
      }
    };
    
    checkVersion();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SecurityProvider>
          <SettingsProvider>
            <WeatherProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <InstallPrompt />
                <UpdateNotification />
                <WhatsNewModal 
                  open={showWhatsNew} 
                  onOpenChange={setShowWhatsNew} 
                />
                <BrowserRouter>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </BrowserRouter>
              </TooltipProvider>
            </WeatherProvider>
          </SettingsProvider>
        </SecurityProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
