import { useState, useEffect } from 'react';
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
} from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
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
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const loadedSettings = await invoke<Settings>('load_settings');
      setSettings(loadedSettings);
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Failed to load settings: ${error}`,
        severity: 'error',
      });
    }
  };

  const handleSaveSettings = async () => {
    try {
      await invoke('save_settings', { settings });
      setSnackbar({
        open: true,
        message: 'Settings saved successfully',
        severity: 'success',
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Failed to save settings: ${error}`,
        severity: 'error',
      });
    }
  };

  const handleAddAdvertiser = () => {
    if (newAdvertiser.trim()) {
      const updatedSettings = {
        ...settings,
        advertisers: [...settings.advertisers, newAdvertiser.trim()],
      };
      setSettings(updatedSettings);
      setNewAdvertiser('');
      setIsAddAdvertiserOpen(false);
      handleSaveSettings();
    }
  };

  const handleDeleteAdvertiser = (advertiser: string) => {
    const updatedSettings = {
      ...settings,
      advertisers: settings.advertisers.filter(a => a !== advertiser),
    };
    setSettings(updatedSettings);
    handleSaveSettings();
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
        </div>
      </div>

      {/* Advertisers Management */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center mb-6">
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
        <List className="border rounded-lg">
          {settings.advertisers.map((advertiser) => (
            <ListItem
              key={advertiser}
              divider
              className="hover:bg-gray-50"
            >
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
          ))}
        </List>
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