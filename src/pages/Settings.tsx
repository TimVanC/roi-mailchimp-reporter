/**
 * Settings Component
 * 
 * This component manages all application configuration including:
 * - Mailchimp API credentials
 * - Advertiser management (add/remove/search)
 * - Download directory selection
 * - Settings persistence
 * 
 * Features:
 * - Real-time settings validation
 * - Searchable advertiser list with pagination
 * - Secure credential storage
 * - User-friendly file system integration
 * - Error handling and user feedback
 */

import React, { useState, useEffect } from 'react';
import {
  TextField,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  Paper,
  InputAdornment,
  Pagination,
  Divider,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  Search as SearchIcon,
  ArrowUpward as SortAscIcon,
  ArrowDownward as SortDescIcon,
  FolderOpen as FolderOpenIcon,
} from '@mui/icons-material';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

/**
 * Settings interface that defines the structure of our application configuration
 * This must match the Rust backend's Settings struct exactly for proper serialization
 */
interface Settings {
  mailchimp_api_key: string;      // Mailchimp API authentication key
  mailchimp_audience_id: string;   // Target Mailchimp audience/list ID
  advertisers: string[];          // List of configured advertisers
  download_directory: string;     // Where generated reports will be saved
}

interface UpdateCheckResult {
  available: boolean;
  manifest?: {
    version: string;
    date: string;
    body: string;
  };
}

/**
 * Main Settings component that provides the configuration interface
 * Handles all settings-related operations and state management
 */
const Settings = () => {
  // Primary settings state with type-safe default values
  const [settings, setSettings] = useState<Settings>({
    mailchimp_api_key: '',
    mailchimp_audience_id: '6732b2b110',
    advertisers: [
      "ACG",
      "Caucus",
      "EisnerAmper",
      "Gibbons Law",
      "Grassi",
      "HBCB (Horizon Blue Cross Blue Shield)",
      "Jersey City Summit",
      "Local 825",
      "Mizuho",
      "MSU",
      "NJ American Water",
      "NJ Bankers",
      "NJUA",
      "Valley Health Systems",
      "Withum"
    ],
    download_directory: '',
  });
  
  // UI state management for modals, notifications, and user feedback
  const [isAddAdvertiserOpen, setIsAddAdvertiserOpen] = useState(false);
  const [newAdvertiser, setNewAdvertiser] = useState('');
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });
  
  // Advertiser list management with search, pagination, and sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const itemsPerPage = 10; // Number of advertisers shown per page

  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);

  /**
   * Initialize component by loading settings
   * This runs once when the component mounts
   */
  useEffect(() => {
    loadSettings();
  }, []);

  /**
   * Loads settings from the Rust backend's persistent storage
   * Updates component state with loaded values
   */
  const loadSettings = async () => {
    try {
      console.log('Starting to load settings...');
      const settingsPath = await invoke<string>('get_settings_path');
      console.log('Settings path:', settingsPath);
      
      const loadedSettings = await invoke<Settings>('load_settings');
      console.log('Loaded settings:', loadedSettings);
      
      // Preserve default values if loaded settings are empty
      const updatedSettings = {
        ...loadedSettings,
        mailchimp_audience_id: loadedSettings.mailchimp_audience_id || '6732b2b110',
        advertisers: loadedSettings.advertisers?.length > 0 
          ? loadedSettings.advertisers.sort((a, b) => a.localeCompare(b))
          : settings.advertisers
      };
      
      setSettings(updatedSettings);
    } catch (error) {
      console.error('Error loading settings:', error);
      setSnackbar({
        open: true,
        message: `Failed to load settings: ${error}`,
        severity: 'error',
      });
    }
  };

  /**
   * Persists current settings to storage via Rust backend
   * Provides user feedback and verifies save operation
   */
  const handleSaveSettings = async () => {
    try {
      console.log('Saving settings:', settings);
      await invoke('save_settings', { settings });
      console.log('Settings saved successfully');
      
      // Emit settings-updated event
      await invoke('emit_event', { 
        event: 'settings-updated',
        payload: null
      });
      
      setSnackbar({
        open: true,
        message: 'Settings saved successfully',
        severity: 'success',
      });
      await loadSettings(); // Verify save by reloading
    } catch (error) {
      console.error('Error saving settings:', error);
      setSnackbar({
        open: true,
        message: `Failed to save settings: ${error}`,
        severity: 'error',
      });
    }
  };

  /**
   * Opens system file picker for download directory selection
   * Updates settings with user's chosen directory
   */
  const handleSelectDirectory = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Download Directory',
      });
      
      if (selected) {
        setSettings({
          ...settings,
          download_directory: selected as string,
        });
        
        setSnackbar({
          open: true,
          message: 'Download directory updated',
          severity: 'success',
        });
      }
    } catch (error) {
      console.error('Error selecting directory:', error);
      setSnackbar({
        open: true,
        message: `Failed to select directory: ${error}`,
        severity: 'error',
      });
    }
  };

  /**
   * Adds a new advertiser to the settings
   * Uses a careful approach to prevent race conditions:
   * 1. Creates new settings object
   * 2. Updates state
   * 3. Waits for state update
   * 4. Persists to storage
   * 5. Verifies save by reloading
   */
  const handleAddAdvertiser = async () => {
    if (newAdvertiser.trim()) {
      console.log('Adding advertiser:', newAdvertiser.trim());
      
      const updatedSettings = {
        ...settings,
        advertisers: [...settings.advertisers, newAdvertiser.trim()],
      };
      
      console.log('Updated settings before setState:', updatedSettings);
      setSettings(updatedSettings);
      
      setNewAdvertiser('');
      setIsAddAdvertiserOpen(false);
      
      // Ensure state is updated before saving
      await new Promise(resolve => setTimeout(resolve, 100));
      
      try {
        console.log('About to save settings with new advertiser:', updatedSettings);
        await invoke('save_settings', { settings: updatedSettings });
        console.log('Settings with new advertiser saved successfully');
        
        // Emit settings-updated event
        await invoke('emit_event', { 
          event: 'settings-updated',
          payload: null
        });
        
        setSnackbar({
          open: true,
          message: 'Advertiser added successfully',
          severity: 'success',
        });
        
        await loadSettings(); // Verify save operation
      } catch (error) {
        console.error('Error saving settings with new advertiser:', error);
        setSnackbar({
          open: true,
          message: `Failed to save advertiser: ${error}`,
          severity: 'error',
        });
      }
    }
  };

  // Delete an advertiser from the list
  // Similar approach to adding - we update and save directly
  const handleDeleteAdvertiser = async (advertiser: string) => {
    console.log('Deleting advertiser:', advertiser);
    
    const updatedSettings = {
      ...settings,
      advertisers: settings.advertisers.filter(a => a !== advertiser),
    };
    
    console.log('Updated settings after delete:', updatedSettings);
    
    setSettings(updatedSettings);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      console.log('About to save settings after advertiser deletion:', updatedSettings);
      await invoke('save_settings', { settings: updatedSettings });
      console.log('Settings after advertiser deletion saved successfully');
      
      // Emit settings-updated event
      await invoke('emit_event', { 
        event: 'settings-updated',
        payload: null
      });
      
      setSnackbar({
        open: true,
        message: 'Advertiser deleted successfully',
        severity: 'success',
      });
      
      await loadSettings();
    } catch (error) {
      console.error('Error saving settings after advertiser deletion:', error);
      setSnackbar({
        open: true,
        message: `Failed to delete advertiser: ${error}`,
        severity: 'error',
      });
    }
  };

  // Filter and sort advertisers based on search term and sort direction
  const filteredAdvertisers = settings.advertisers
    .filter(advertiser => 
      advertiser.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (sortDirection === 'asc') {
        return a.localeCompare(b);
      } else {
        return b.localeCompare(a);
      }
    });
    
  // Get paginated subset of advertisers for current page
  const paginatedAdvertisers = filteredAdvertisers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
  // Calculate total pages for pagination
  const totalPages = Math.max(1, Math.ceil(filteredAdvertisers.length / itemsPerPage));
  
  // Handle pagination page changes
  const handlePageChange = (_event: unknown, page: number) => {
    setCurrentPage(page);
  };
  
  // Toggle sort direction between ascending and descending
  const toggleSortDirection = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  // Custom styles for TextField components
  const textFieldSx = {
    '& .MuiOutlinedInput-root': {
      '&.Mui-focused': {
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: 'rgba(0, 0, 0, 0.23) !important',
          borderWidth: '1px !important'
        }
      }
    },
    '& .MuiFormLabel-asterisk': {
      display: 'none'
    },
    '& .MuiInputBase-input': {
      '&:focus': {
        boxShadow: 'none',
        outline: 'none'
      }
    },
    '& .MuiOutlinedInput-input': {
      '&:focus': {
        boxShadow: 'none',
        outline: 'none'
      }
    }
  };

  const handleCheckUpdate = async () => {
    try {
      setIsCheckingUpdate(true);
      const { available, manifest } = await invoke<UpdateCheckResult>('plugin:updater|check');
      
      if (available && manifest) {
        console.log('Update available:', manifest);
        setUpdateAvailable(true);
      } else {
        setSnackbar({
          open: true,
          message: 'You are on the latest version!',
          severity: 'success',
        });
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
      setUpdateError('Failed to check for updates');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleInstallUpdate = async () => {
    try {
      setIsInstalling(true);
      await invoke('plugin:updater|install');
      await invoke('plugin:process|restart');
    } catch (error) {
      console.error('Error installing update:', error);
      setUpdateError('Failed to install update');
      setIsInstalling(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto pt-1">
      {/* Mailchimp API Settings */}
      <div className="bg-white rounded-lg border border-gray-200 px-6 py-3.5">
        <h2 className="text-xl font-semibold mb-2.5">Mailchimp API Settings</h2>
        <div className="space-y-4">
          <div>
            <TextField
              label="API Key"
              type="password"
              value={settings.mailchimp_api_key}
              onChange={(e) => setSettings({ ...settings, mailchimp_api_key: e.target.value })}
              fullWidth
              size="small"
              required
              sx={textFieldSx}
            />
          </div>
          <div>
            <TextField
              label="Audience ID"
              value={settings.mailchimp_audience_id}
              onChange={(e) => setSettings({ ...settings, mailchimp_audience_id: e.target.value })}
              fullWidth
              size="small"
              required
              sx={textFieldSx}
            />
          </div>
          <Button
            variant="contained"
            onClick={handleSaveSettings}
            className="bg-[#002E5D] hover:bg-[#159581]"
          >
            Save Configuration
          </Button>
        </div>
      </div>
      
      {/* Download Directory Settings */}
      <div className="bg-white rounded-lg border border-gray-200 px-6 py-3.5 mt-2.5">
        <h2 className="text-xl font-semibold mb-2.5">Download Directory</h2>
        <p className="text-sm text-gray-600 mb-4">
          Select where CSV reports and other downloads will be saved.
        </p>
        <div className="flex gap-2 items-center">
          <TextField
            label="Download Directory"
            value={settings.download_directory}
            onChange={(e) => setSettings({ ...settings, download_directory: e.target.value })}
            fullWidth
            size="small"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton 
                    onClick={handleSelectDirectory}
                    title="Browse for folder"
                    edge="end"
                  >
                    <FolderOpenIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={textFieldSx}
          />
        </div>
        <div className="mt-4">
          <Button
            variant="contained"
            onClick={handleSaveSettings}
            className="bg-[#002E5D] hover:bg-[#159581]"
            size="small"
          >
            Save Directory
          </Button>
        </div>
      </div>

      {/* Advertisers Management */}
      <div className="bg-white rounded-lg border border-gray-200 px-6 py-3.5 mt-2.5">
        <div className="flex justify-between items-center mb-3.5">
          <h2 className="text-xl font-semibold">Advertisers</h2>
          <Button
            startIcon={<AddIcon />}
            onClick={() => setIsAddAdvertiserOpen(true)}
            className="normal-case text-[#159581] border-[#159581] hover:bg-[#159581] hover:text-white hover:border-[#159581]"
            variant="outlined"
          >
            Add Advertiser
          </Button>
        </div>
        
        {/* Search and Sort Controls */}
        <div className="mb-4">
          <TextField
            fullWidth
            size="small"
            placeholder="Search advertisers..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1); // Reset to first page on search
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton 
                    size="small"
                    onClick={toggleSortDirection}
                    title={sortDirection === 'asc' ? 'Sort A-Z' : 'Sort Z-A'}
                  >
                    {sortDirection === 'asc' ? <SortAscIcon /> : <SortDescIcon />}
                  </IconButton>
                </InputAdornment>
              )
            }}
            sx={textFieldSx}
          />
        </div>
        
        {/* Advertisers Stats */}
        <div className="mb-3 flex justify-between items-center text-sm text-gray-500">
          <div>
            Total: <Chip 
              size="small" 
              label={settings.advertisers.length} 
              className="ml-1" 
              color="primary"
            />
          </div>
          <div>
            {searchTerm && (
              <>Matching: <Chip 
                size="small" 
                label={filteredAdvertisers.length} 
                className="ml-1"
                color="secondary"
              /></>
            )}
          </div>
        </div>
        
        {/* Advertisers List with Pagination */}
        <Paper elevation={0} variant="outlined" className="mb-3">
          {paginatedAdvertisers.length > 0 ? (
            <List disablePadding>
              {paginatedAdvertisers.map((advertiser, index) => (
                <React.Fragment key={advertiser}>
                  <ListItem className="hover:bg-gray-50 py-1">
                    <ListItemText primary={advertiser} />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() => handleDeleteAdvertiser(advertiser)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                  {index < paginatedAdvertisers.length - 1 && <Divider component="li" />}
                </React.Fragment>
              ))}
            </List>
          ) : (
            <div className="p-4 text-center text-gray-500">
              {settings.advertisers.length === 0 
                ? "No advertisers added yet" 
                : "No advertisers matching your search"}
            </div>
          )}
        </Paper>
        
        {/* Pagination Controls - only shown when needed */}
        {totalPages > 1 && (
          <div className="flex justify-center mt-4">
            <Pagination 
              count={totalPages} 
              page={currentPage} 
              onChange={handlePageChange}
              size="small"
              color="primary"
              shape="rounded"
            />
          </div>
        )}
      </div>

      {/* Add Advertiser Dialog */}
      <Dialog
        open={isAddAdvertiserOpen}
        onClose={() => setIsAddAdvertiserOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add New Advertiser</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Advertiser Name"
            fullWidth
            value={newAdvertiser}
            onChange={(e) => setNewAdvertiser(e.target.value)}
            size="small"
            sx={textFieldSx}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsAddAdvertiserOpen(false)} className="normal-case">
            Cancel
          </Button>
          <Button
            onClick={handleAddAdvertiser}
            variant="contained"
            className="bg-[#002E5D] hover:bg-[#159581] normal-case"
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      <div className="border-t pt-6">
        <h2 className="text-xl font-semibold mb-4">Updates</h2>
        <div className="flex items-center space-x-4">
          <Button
            variant="contained"
            onClick={handleCheckUpdate}
            disabled={isCheckingUpdate}
            startIcon={isCheckingUpdate ? <CircularProgress size={20} /> : null}
          >
            {isCheckingUpdate ? 'Checking...' : 'Check for Updates'}
          </Button>
          
          {updateAvailable && (
            <Button
              variant="contained"
              color="primary"
              onClick={handleInstallUpdate}
              disabled={isInstalling}
              startIcon={isInstalling ? <CircularProgress size={20} /> : null}
            >
              {isInstalling ? 'Installing...' : 'Install Update'}
            </Button>
          )}
        </div>
      </div>

      {/* Error notification */}
      <Snackbar 
        open={!!updateError} 
        autoHideDuration={6000} 
        onClose={() => setUpdateError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity="error" onClose={() => setUpdateError(null)}>
          {updateError}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default Settings; 