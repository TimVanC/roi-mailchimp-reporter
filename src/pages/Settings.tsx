import { useState } from 'react';
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
} from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';

const Settings = () => {
  const [apiKey, setApiKey] = useState('');
  const [audienceId, setAudienceId] = useState('');
  const [advertisers, setAdvertisers] = useState<string[]>([
    'JCEDC',
    'Choose New Jersey',
    'Morgan Stanley',
    'Englewood Health'
  ]);
  const [isAddAdvertiserOpen, setIsAddAdvertiserOpen] = useState(false);
  const [newAdvertiser, setNewAdvertiser] = useState('');

  const handleSaveSettings = () => {
    // TODO: Save API settings
  };

  const handleAddAdvertiser = () => {
    if (newAdvertiser.trim()) {
      setAdvertisers([...advertisers, newAdvertiser.trim()]);
      setNewAdvertiser('');
      setIsAddAdvertiserOpen(false);
    }
  };

  const handleDeleteAdvertiser = (advertiser: string) => {
    setAdvertisers(advertisers.filter(a => a !== advertiser));
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
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              fullWidth
              size="small"
              required
              sx={textFieldSx}
            />
          </div>
          <div>
            <TextField
              label="Audience ID"
              value={audienceId}
              onChange={(e) => setAudienceId(e.target.value)}
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
          {advertisers.map((advertiser) => (
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
    </div>
  );
};

export default Settings; 