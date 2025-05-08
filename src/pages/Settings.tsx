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
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  Search as SearchIcon,
  ArrowUpward as SortAscIcon,
  ArrowDownward as SortDescIcon,
} from '@mui/icons-material';
import { invoke } from '@tauri-apps/api/core';

interface Settings {
  mailchimp_api_key: string;
  mailchimp_audience_id: string;
  advertisers: string[];
}

const Settings = () => {
  const [settings, setSettings] = useState<Settings>({
    mailchimp_api_key: '',
    mailchimp_audience_id: '',
    advertisers: [],
  });
  const [isAddAdvertiserOpen, setIsAddAdvertiserOpen] = useState(false);
  const [newAdvertiser, setNewAdvertiser] = useState('');
  const [settingsPath, setSettingsPath] = useState<string>('');
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const itemsPerPage = 10;

  useEffect(() => {
    loadSettings();
    getSettingsPath();
  }, []);

  const getSettingsPath = async () => {
    try {
      const path = await invoke<string>('get_settings_path');
      setSettingsPath(path);
      console.log('Settings path:', path);
    } catch (error) {
      console.error('Error getting settings path:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const loadedSettings = await invoke<Settings>('load_settings');
      console.log('Loaded settings:', loadedSettings);
      setSettings(loadedSettings);
    } catch (error) {
      console.error('Error loading settings:', error);
      setSnackbar({
        open: true,
        message: `Failed to load settings: ${error}`,
        severity: 'error',
      });
    }
  };

  const handleSaveSettings = async () => {
    try {
      console.log('Saving settings:', settings);
      await invoke('save_settings', { settings });
      console.log('Settings saved successfully');
      setSnackbar({
        open: true,
        message: 'Settings saved successfully',
        severity: 'success',
      });
      // Reload settings to verify they were saved correctly
      await loadSettings();
    } catch (error) {
      console.error('Error saving settings:', error);
      setSnackbar({
        open: true,
        message: `Failed to save settings: ${error}`,
        severity: 'error',
      });
    }
  };

  const handleAddAdvertiser = async () => {
    if (newAdvertiser.trim()) {
      console.log('Adding advertiser:', newAdvertiser.trim());
      
      // Create a new copy of the settings object with the new advertiser
      const updatedSettings = {
        ...settings,
        advertisers: [...settings.advertisers, newAdvertiser.trim()],
      };
      
      console.log('Updated settings before setState:', updatedSettings);
      
      // Update state with the new settings
      setSettings(updatedSettings);
      
      // Close dialog and clear input
      setNewAdvertiser('');
      setIsAddAdvertiserOpen(false);
      
      // Use a small timeout to ensure state is updated before saving
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Now save the settings - pass the updatedSettings directly instead of using state
      try {
        console.log('About to save settings with new advertiser:', updatedSettings);
        await invoke('save_settings', { settings: updatedSettings });
        console.log('Settings with new advertiser saved successfully');
        setSnackbar({
          open: true,
          message: 'Advertiser added successfully',
          severity: 'success',
        });
        
        // Reload settings to verify they were saved correctly
        await loadSettings();
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

  const handleDeleteAdvertiser = async (advertiser: string) => {
    console.log('Deleting advertiser:', advertiser);
    
    // Create updated settings without the deleted advertiser
    const updatedSettings = {
      ...settings,
      advertisers: settings.advertisers.filter(a => a !== advertiser),
    };
    
    console.log('Updated settings after delete:', updatedSettings);
    
    // Update state
    setSettings(updatedSettings);
    
    // Use a small timeout to ensure state is updated before saving
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Save the updated settings directly
    try {
      console.log('About to save settings after advertiser deletion:', updatedSettings);
      await invoke('save_settings', { settings: updatedSettings });
      console.log('Settings after advertiser deletion saved successfully');
      setSnackbar({
        open: true,
        message: 'Advertiser deleted successfully',
        severity: 'success',
      });
      
      // Reload settings to verify they were saved correctly
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

  // Get filtered and sorted advertisers
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
    
  // Get paginated advertisers
  const paginatedAdvertisers = filteredAdvertisers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
  // Calculate total pages
  const totalPages = Math.max(1, Math.ceil(filteredAdvertisers.length / itemsPerPage));
  
  // Handle page change
  const handlePageChange = (event: React.ChangeEvent<unknown>, page: number) => {
    setCurrentPage(page);
  };
  
  // Toggle sort direction
  const toggleSortDirection = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  };

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

  return (
    <div className="max-w-2xl mx-auto pt-8">
      {/* Mailchimp API Settings */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
        <h2 className="text-xl font-semibold mb-6">Mailchimp API Settings</h2>
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
          
          {/* Debug button to show settings path */}
          <div className="mt-2 text-xs text-gray-500">
            <p>Settings file: {settingsPath}</p>
            <Button 
              size="small" 
              variant="outlined"
              className="mt-1 text-xs"
              onClick={() => {
                setSnackbar({
                  open: true,
                  message: `Settings path: ${settingsPath}`,
                  severity: 'info',
                });
              }}
            >
              Debug Info
            </Button>
          </div>
        </div>
      </div>

      {/* Advertisers Management */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
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
        
        {/* Advertisers List */}
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
        
        {/* Pagination */}
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
    </div>
  );
};

export default Settings; 