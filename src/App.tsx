import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';

// Import our page components
import RunReport from './pages/RunReport';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

const theme = createTheme({
  palette: {
    primary: {
      main: '#001223',
    },
    background: {
      default: '#e5e9f2',
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

const Navigation = () => {
  const location = useLocation();
  
  return (
    <nav className="flex space-x-6">
      <Link 
        to="/" 
        className={`px-4 py-1.5 rounded-md text-base font-semibold transition-colors ${
          location.pathname === '/' 
            ? 'bg-[#e5e9f2] text-gray-900' 
            : 'text-[#e5e9f2] hover:text-white'
        }`}
      >
        Run Report
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

const App = () => {
  return (
    <ThemeProvider theme={theme}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Router>
          <div className="min-h-screen bg-background flex flex-col">
            {/* Header */}
            <header className="bg-header shadow-lg">
              <div className="container mx-auto px-6 py-8 flex justify-between items-center">
                <div className="flex items-center space-x-16">
                  <img 
                    src="/assets/ROI-Logo.svg" 
                    alt="ROI Logo" 
                    className="h-14"
                  />
                  <Navigation />
                </div>
              </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 container mx-auto px-6 py-8">
              <div className="bg-white rounded-lg shadow-sm p-8 max-w-3xl mx-auto">
                <Routes>
                  <Route path="/" element={<RunReport />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </div>
            </main>
          </div>
        </Router>
      </LocalizationProvider>
    </ThemeProvider>
  );
};

export default App;
 