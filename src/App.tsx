/**
 * Main application entry point for the ROI Mailchimp Reporter
 * This file sets up the core application structure including routing, theming, and layout
 * 
 * Key features:
 * - React Router for navigation between main sections
 * - Material-UI theming with ROI brand colors
 * - Responsive layout with header and main content areas
 * - Date picker provider for report date selection
 */

import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { Snackbar, Alert, Button } from '@mui/material';
import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';
import roiLogo from './assets/ROI-white-logo.png';
import RunReport from './pages/RunReport';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import { useReportStore } from './store/reportStore';

/**
 * Global theme configuration using ROI's brand colors and styling preferences
 * This ensures consistent styling across all components and pages
 */
const theme = createTheme({
  palette: {
    primary: {
      main: '#001223', // ROI dark blue - primary brand color
    },
    background: {
      default: '#e5e9f2', // Light gray background for better readability
    },
  },
  typography: {
    h4: {
      fontSize: '1.5rem',
      fontWeight: 500,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 500,
    },
  },
});

/**
 * Navigation component that provides the main app navigation
 * Features:
 * - Responsive design with proper spacing
 * - Visual feedback for active route
 * - Smooth hover transitions
 * - Accessible navigation links
 */
const Navigation = () => {
  const location = useLocation();
  const isGenerating = useReportStore(state => state.isGenerating);
  
  return (
    <nav className="flex space-x-6">
      <Link 
        to="/" 
        className={`px-4 py-1.5 rounded-md text-base font-semibold transition-colors ${
          location.pathname === '/' 
            ? 'bg-[#e5e9f2] text-gray-900' // Active state styling
            : 'text-[#e5e9f2] hover:text-white' // Inactive with hover effect
        } ${isGenerating ? 'relative' : ''}`}
      >
        Run Report
        {isGenerating && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
        )}
      </Link>
      <Link 
        to="/reports" 
        className={`px-4 py-1.5 rounded-md text-base font-semibold transition-colors ${
          location.pathname === '/reports' 
            ? 'bg-[#e5e9f2] text-gray-900' 
            : 'text-[#e5e9f2] hover:text-white'
        }`}
      >
        Reports
      </Link>
      <Link 
        to="/settings" 
        className={`px-4 py-1.5 rounded-md text-base font-semibold transition-colors ${
          location.pathname === '/settings' 
            ? 'bg-[#e5e9f2] text-gray-900' 
            : 'text-[#e5e9f2] hover:text-white'
        }`}
      >
        Settings
      </Link>
    </nav>
  );
};

/**
 * Main App component that orchestrates the entire application
 * Provides:
 * - Material-UI theme provider for consistent styling
 * - Date picker functionality for report date selection
 * - Responsive layout with header and main content
 * - Route-based content rendering
 */
const App = () => {
  const [version, setVersion] = useState<string>('');
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [showUpdateAlert, setShowUpdateAlert] = useState(false);

  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const update = await invoke<{ available: boolean }>('plugin:updater|check');
        if (update.available) {
          setShowUpdateAlert(true);
        }
      } catch (error) {
        console.error('Failed to check for updates:', error);
        setUpdateError(error instanceof Error ? error.message : 'Unknown error');
      }
    };

    const getAppVersion = async () => {
      try {
        const ver = await getVersion();
        setVersion(ver);
      } catch (error) {
        console.error('Failed to get version:', error);
      }
    };

    getAppVersion();
    checkForUpdates();
  }, []);

  const handleUpdate = async () => {
    try {
      await invoke('plugin:updater|install');
      setShowUpdateAlert(false);
    } catch (error) {
      console.error('Failed to install update:', error);
      setUpdateError(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Router>
          <div className="min-h-screen bg-background flex flex-col">
            {/* Header section with logo and navigation */}
            <header className="bg-header shadow-lg">
              <div className="container mx-auto px-6 py-6 flex justify-between items-center">
                <div className="flex items-center space-x-16">
                  <img 
                    src={roiLogo}
                    alt="ROI Logo" 
                    className="h-[50px] w-auto"
                  />
                  <Navigation />
                </div>
                {/* Version display */}
                <div className="absolute top-2 right-4 text-sm text-gray-600">
                  v{version}
                </div>
              </div>
            </header>

            {/* Main content area with responsive container */}
            <main className="flex-1 container mx-auto px-6 pt-2 pb-4 mt-6">
              <div className="bg-white rounded-lg shadow-sm px-8 pt-4 pb-8 max-w-3xl mx-auto">
                <Routes>
                  <Route path="/" element={<RunReport />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </div>
            </main>

            {/* Update notification */}
            <Snackbar 
              open={showUpdateAlert} 
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
              <Alert 
                severity="info"
                action={
                  <Button 
                    color="inherit" 
                    size="small" 
                    onClick={handleUpdate}
                  >
                    Install Update
                  </Button>
                }
              >
                A new version is available
              </Alert>
            </Snackbar>

            {/* Error notification */}
            <Snackbar 
              open={!!updateError} 
              autoHideDuration={6000} 
              onClose={() => setUpdateError(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
              <Alert severity="error">
                {updateError}
              </Alert>
            </Snackbar>
          </div>
        </Router>
      </LocalizationProvider>
    </ThemeProvider>
  );
};

export default App;
 