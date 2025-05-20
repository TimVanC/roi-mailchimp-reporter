import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Typography,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  Checkbox,
  Button,
  IconButton,
  FormControl,
  FormLabel,
  FormGroup,
  FormHelperText,
  Autocomplete,
  CssBaseline,
  Snackbar,
  Alert,
  CircularProgress,
  LinearProgress,
  Box,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import dayjs from 'dayjs';
import type { NewsletterType } from '@/types';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { invoke } from '@tauri-apps/api/core';
import { UnlistenFn, listen } from '@tauri-apps/api/event';

// Form data interface for React Hook Form
// This matches the structure expected by our Rust backend
interface FormData {
  newsletterType: NewsletterType;
  advertiser: string;
  trackingUrls: string[];
  dateRange: {
    startDate: string;
    endDate: string;
  };
  metrics: {
    uniqueOpens: boolean;
    totalOpens: boolean;
    totalRecipients: boolean;
    totalClicks: boolean;
    ctr: boolean;
  };
}

// Interface for application settings
// Needed to get the advertisers list from settings
interface Settings {
  mailchimp_api_key: string;
  mailchimp_audience_id: string;
  advertisers: string[];
}

// Newsletter types supported by the application
// These match the options in the Mailchimp data
const NEWSLETTER_TYPES: NewsletterType[] = ['AM', 'PM', 'Energy', 'Health Care', 'Breaking News'];

// Add a type for progress events from the backend
interface ProgressUpdate {
  stage: string;
  progress: number;
  message: string;
  timeRemaining: number | null;
}

// Add type for the response from generate_report
interface GenerateReportResponse {
  success: boolean;
  message: string;
  data: any;
  progress_updates: ProgressUpdate[];
}

const RunReport = () => {
  // State for advertisers loaded from settings
  const [advertisers, setAdvertisers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  // Add loading state for report generation
  const [generating, setGenerating] = useState(false);
  
  // Add state for progress reporting
  const [progress, setProgress] = useState<{
    stage: string;
    percentage: number;
    message: string;
    timeRemaining: number | null;
    currentCampaign: number;
    totalCampaigns: number;
  }>({
    stage: '',
    percentage: 0,
    message: '',
    timeRemaining: null,
    currentCampaign: 0,
    totalCampaigns: 0,
  });

  // Add a reference to store the unlisten function for progress updates
  const [progressUnlisten, setProgressUnlisten] = useState<UnlistenFn | null>(null);

  // Load settings including advertisers on component mount
  // Also set up a polling mechanism to keep settings in sync
  useEffect(() => {
    console.log('RunReport component mounted, loading settings...');
    loadSettings();
    
    // Set up event listener for real-time progress updates
    setupProgressListener();
    
    // Add a timer to reload settings every few seconds while the component is mounted
    // This ensures any changes made in the Settings page are reflected here
    const intervalId = setInterval(() => {
      console.log('Reloading settings in RunReport...');
      loadSettings();
    }, 3000); // Reload every 3 seconds
    
    // Clean up interval and event listeners on unmount to prevent memory leaks
    return () => {
      clearInterval(intervalId);
      
      // Clean up the progress event listener
      if (progressUnlisten) {
        progressUnlisten();
      }
    };
  }, []);

  // Set up the progress listener for real-time updates
  const setupProgressListener = async () => {
    try {
      // Unregister any existing listener first
      if (progressUnlisten) {
        await progressUnlisten();
      }
      
      // Register new listener for "report-progress" events
      const unlisten = await listen("report-progress", (event) => {
        console.log("Received progress update:", event);
        
        // Extract progress data from the event payload
        const update = event.payload as ProgressUpdate;
        
        // Parse campaign count from message if available
        let currentCampaign = 0;
        let totalCampaigns = 0;
        
        // Try to extract current campaign and total from message using regex
        const campaignRegex = /Processing campaign (\d+) of (\d+)/;
        const match = update.message.match(campaignRegex);
        
        if (match && match.length >= 3) {
          currentCampaign = parseInt(match[1], 10);
          totalCampaigns = parseInt(match[2], 10);
        }
        
        // Update progress state with the new information
        setProgress({
          stage: update.stage,
          percentage: update.progress,
          message: update.message,
          timeRemaining: update.timeRemaining,
          currentCampaign,
          totalCampaigns,
        });
      });
      
      // Store the unlisten function for cleanup
      setProgressUnlisten(() => unlisten);
      console.log("Progress event listener registered");
      
    } catch (error) {
      console.error("Failed to set up progress listener:", error);
    }
  };

  // Function to format time remaining
  const formatTimeRemaining = (seconds: number | null): string => {
    if (seconds === null) return '';
    
    if (seconds < 60) {
      return `${Math.round(seconds)} seconds remaining`;
    } else {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.round(seconds % 60);
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')} minutes remaining`;
    }
  };

  // Load settings from the Tauri backend
  // Only update advertisers state if the list has actually changed
  const loadSettings = async () => {
    try {
      setLoading(true);
      console.log('Loading settings in RunReport...');
      const settings = await invoke<Settings>('load_settings');
      console.log('Loaded settings in RunReport:', settings);
      
      // Check if advertisers have changed before updating state
      // This prevents unnecessary re-renders
      if (JSON.stringify(settings.advertisers) !== JSON.stringify(advertisers)) {
        console.log('Advertisers have changed, updating state...');
        setAdvertisers(settings.advertisers);
      } else {
        console.log('Advertisers unchanged, keeping current state');
      }
      
      console.log('Advertisers set to:', settings.advertisers);
    } catch (error) {
      console.error('Failed to load settings in RunReport:', error);
    } finally {
      setLoading(false);
    }
  };

  // Custom MUI theme to match ROI brand style
  // Overrides focus styles to be more subtle
  const theme = createTheme({
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          '*': {
            outline: 'none !important',
            '&:focus': {
              outline: 'none !important',
              boxShadow: 'none !important'
            },
            '&:focus-visible': {
              outline: 'none !important',
              boxShadow: 'none !important'
            }
          },
          '.MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(0, 0, 0, 0.23) !important',
            borderWidth: '1px !important'
          },
          '.MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(0, 0, 0, 0.23) !important'
          }
        }
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            '&.Mui-focused': {
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(0, 0, 0, 0.23) !important',
                borderWidth: '1px !important',
                boxShadow: 'none !important'
              }
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: 'rgba(0, 0, 0, 0.23) !important'
            }
          },
          notchedOutline: {
            borderColor: 'rgba(0, 0, 0, 0.23) !important'
          }
        }
      },
      MuiInputBase: {
        styleOverrides: {
          root: {
            '&.Mui-focused': {
              outline: 'none !important',
              boxShadow: 'none !important'
            }
          }
        }
      },
      MuiTextField: {
        defaultProps: {
          variant: 'outlined'
        },
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              '&.Mui-focused': {
                outline: 'none !important',
                boxShadow: 'none !important',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(0, 0, 0, 0.23) !important',
                  borderWidth: '1px !important'
                }
              }
            }
          }
        }
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            '&.Mui-focused': {
              color: 'rgba(0, 0, 0, 0.87) !important'
            }
          }
        }
      },
      MuiAutocomplete: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              '&.Mui-focused': {
                outline: 'none !important',
                boxShadow: 'none !important',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(0, 0, 0, 0.23) !important',
                  borderWidth: '1px !important'
                }
              }
            }
          }
        }
      }
    },
    typography: {
      allVariants: {
        fontFamily: 'inherit'
      }
    },
    shape: {
      borderRadius: 4
    },
    palette: {
      background: {
        default: '#ffffff'
      }
    }
  });

  // React Hook Form setup
  // Using default values for a new report
  const { control, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      newsletterType: 'AM',
      advertiser: '',
      trackingUrls: [''],
      dateRange: {
        startDate: dayjs().format('YYYY-MM-DD'),
        endDate: dayjs().format('YYYY-MM-DD')
      },
      metrics: {
        uniqueOpens: false,
        totalOpens: false,
        totalRecipients: false,
        totalClicks: false,
        ctr: false
      }
    }
  });

  // State for tracking URLs - separate from form state for easier manipulation
  const [trackingUrls, setTrackingUrls] = useState<string[]>(['']);

  // Notification state
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Add a new tracking URL field
  const handleAddUrl = () => {
    setTrackingUrls([...trackingUrls, '']);
  };

  // Remove a tracking URL field
  // Always keep at least one field
  const handleRemoveUrl = (index: number) => {
    if (trackingUrls.length > 1) {
      setTrackingUrls(trackingUrls.filter((_, i) => i !== index));
    }
  };

  // Form submission handler - generate report
  const onSubmit = async (data: FormData) => {
    // Reset progress state
    setProgress({
      stage: '',
      percentage: 0,
      message: '',
      timeRemaining: null,
      currentCampaign: 0,
      totalCampaigns: 0,
    });
    
    // Validate at least one metric is selected
    const hasMetric = Object.values(data.metrics).some(value => value);
    if (!hasMetric) {
      setSnackbar({
        open: true,
        message: 'Please select at least one metric',
        severity: 'error',
      });
      return;
    }

    try {
      // Set generating state to true to show loading indicator
      setGenerating(true);
      
      // Clean up empty tracking URLs
      const tracking_urls = data.trackingUrls.filter(url => url.trim() !== '');
      
      // Ensure we have at least one tracking URL
      if (tracking_urls.length === 0) {
        setSnackbar({
          open: true,
          message: 'Please add at least one advertisement URL or keyword',
          severity: 'error',
        });
        setGenerating(false);
        return;
      }

      // Generate the report by calling the Rust backend
      // Converting from camelCase (JS) to snake_case (Rust)
      const response = await invoke<GenerateReportResponse>('generate_report', {
        request: {
          newsletter_type: data.newsletterType,
          advertiser: data.advertiser,
          tracking_urls: tracking_urls,
          date_range: {
            start_date: data.dateRange.startDate,
            end_date: data.dateRange.endDate,
          },
          metrics: {
            unique_opens: data.metrics.uniqueOpens,
            total_opens: data.metrics.totalOpens,
            total_recipients: data.metrics.totalRecipients,
            total_clicks: data.metrics.totalClicks,
            ctr: data.metrics.ctr,
          },
        }
      });

      // Process progress updates from the response
      if (response.progress_updates && response.progress_updates.length > 0) {
        // Get the last progress update
        const lastUpdate = response.progress_updates[response.progress_updates.length - 1];
        
        // Parse campaign info from message if available
        let currentCampaign = 0;
        let totalCampaigns = 0;
        
        const campaignRegex = /Processing campaign (\d+) of (\d+)/;
        const match = lastUpdate.message.match(campaignRegex);
        
        if (match && match.length >= 3) {
          currentCampaign = parseInt(match[1], 10);
          totalCampaigns = parseInt(match[2], 10);
        }
        
        setProgress({
          stage: lastUpdate.stage,
          percentage: lastUpdate.progress,
          message: lastUpdate.message,
          timeRemaining: lastUpdate.timeRemaining,
          currentCampaign,
          totalCampaigns,
        });
      }

      // Show success or error message
      setSnackbar({
        open: true,
        message: response.success ? 'Report generated successfully!' : `Failed to generate report: ${response.message}`,
        severity: response.success ? 'success' : 'error',
      });

      if (response.success) {
        // Report generated successfully
        console.log('Report data:', response.data);
      }
    } catch (error) {
      // Handle any unexpected errors
      setSnackbar({
        open: true,
        message: `Error generating report: ${error}`,
        severity: 'error',
      });
    } finally {
      // Reset generating state when done, whether successful or not
      setGenerating(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div className="w-full">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Newsletter Type Selection */}
          <div>
            <h3 className="text-[17.5px] font-semibold text-gray-900 tracking-wide uppercase mb-2.5">
              Newsletter Type
            </h3>
            <div className="-mt-3">
              <Controller
                name="newsletterType"
                control={control}
                render={({ field }) => (
                  <RadioGroup row {...field} className="gap-3">
                    {NEWSLETTER_TYPES.map((type) => (
                      <FormControlLabel
                        key={type}
                        value={type}
                        control={
                          <Radio
                            size="small"
                            value={type}
                            sx={{
                              '&.Mui-checked': {
                                color: '#159581',
                              },
                            }}
                          />
                        }
                        label={type}
                        className="mr-0"
                      />
                    ))}
                  </RadioGroup>
                )}
              />
            </div>
          </div>

          {/* Advertiser Information Section */}
          <div>
            <h3 className="text-[17.5px] font-semibold text-gray-900 tracking-wide uppercase mb-2.5">
              Advertiser Information
            </h3>
            <div className="space-y-4">
              {/* Advertiser dropdown populated from settings */}
              <Controller
                name="advertiser"
                control={control}
                render={({ field }) => (
                  <Autocomplete
                    {...field}
                    options={advertisers}
                    renderInput={(params) => (
                      <TextField {...params} label="Advertiser" size="small" />
                    )}
                    onChange={(_, value) => field.onChange(value)}
                    size="small"
                  />
                )}
              />
              {/* Dynamic tracking URLs section */}
              <div className="space-y-3">
                {trackingUrls.map((_, index) => (
                  <div key={index} className="flex gap-2">
                    <Controller
                      name={`trackingUrls.${index}`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          size="small"
                          label="Advertisement URL or Keyword"
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              '&.Mui-focused': {
                                outline: 'none !important',
                                boxShadow: 'none !important',
                                '& .MuiOutlinedInput-notchedOutline': {
                                  borderColor: 'rgba(0, 0, 0, 0.23) !important',
                                  borderWidth: '1px !important',
                                },
                              },
                            },
                          }}
                        />
                      )}
                    />
                    {/* Delete button - only show for items after the first one */}
                    {index > 0 && (
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveUrl(index)}
                        sx={{
                          color: '#951521'
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </div>
                ))}
                {/* Add URL button */}
                <Button
                  startIcon={<AddIcon />}
                  onClick={handleAddUrl}
                  variant="outlined"
                  size="small"
                  sx={{
                    color: '#159581',
                    borderColor: '#159581',
                    '&:hover': {
                      borderColor: '#159581',
                      backgroundColor: 'rgba(21, 149, 129, 0.05)'
                    }
                  }}
                  className="normal-case"
                >
                  Add URL or Keyword
                </Button>
              </div>
            </div>
          </div>

          {/* Date Range Picker Section */}
          <div>
            <h3 className="text-[17.5px] font-semibold text-gray-900 tracking-wide uppercase mb-2.5">
              Date Range
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Start Date Picker */}
              <Controller
                name="dateRange.startDate"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    label="Start Date"
                    value={dayjs(field.value)}
                    onChange={(date) => field.onChange(date?.format('YYYY-MM-DD'))}
                    slotProps={{ 
                      textField: { 
                        size: 'small',
                        sx: {
                          '& .MuiOutlinedInput-root': {
                            '&.Mui-focused': {
                              outline: 'none !important',
                              boxShadow: 'none !important',
                              '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'rgba(0, 0, 0, 0.23) !important',
                                borderWidth: '1px !important'
                              }
                            }
                          }
                        }
                      }
                    }}
                  />
                )}
              />
              {/* End Date Picker */}
              <Controller
                name="dateRange.endDate"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    label="End Date"
                    value={dayjs(field.value)}
                    onChange={(date) => field.onChange(date?.format('YYYY-MM-DD'))}
                    slotProps={{ 
                      textField: { 
                        size: 'small',
                        sx: {
                          '& .MuiOutlinedInput-root': {
                            '&.Mui-focused': {
                              outline: 'none !important',
                              boxShadow: 'none !important',
                              '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'rgba(0, 0, 0, 0.23) !important',
                                borderWidth: '1px !important'
                              }
                            }
                          }
                        }
                      }
                    }}
                  />
                )}
              />
            </div>
          </div>

          {/* Metrics Selection Section */}
          <div>
            <h3 className="text-[17.5px] font-semibold text-gray-900 tracking-wide uppercase mb-2.5">
              Metrics
            </h3>
            <div className="-mt-3">
              <FormGroup row className="gap-x-3 gap-y-2">
                {/* Unique Opens Checkbox */}
                <Controller
                  name="metrics.uniqueOpens"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Checkbox
                          {...field}
                          size="small"
                          value={field.value}
                          sx={{
                            '&.Mui-checked': {
                              color: '#159581',
                            },
                          }}
                        />
                      }
                      label="Unique Opens"
                      className="text-sm m-0"
                    />
                  )}
                />
                {/* Other metrics checkboxes */}
                <Controller
                  name="metrics.totalOpens"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Checkbox
                          {...field}
                          size="small"
                          value={field.value}
                          sx={{
                            '&.Mui-checked': {
                              color: '#159581',
                            },
                          }}
                        />
                      }
                      label="Total Opens"
                      className="text-sm m-0"
                    />
                  )}
                />
                <Controller
                  name="metrics.totalRecipients"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Checkbox
                          {...field}
                          size="small"
                          value={field.value}
                          sx={{
                            '&.Mui-checked': {
                              color: '#159581',
                            },
                          }}
                        />
                      }
                      label="Total Recipients"
                      className="text-sm m-0"
                    />
                  )}
                />
                <Controller
                  name="metrics.totalClicks"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Checkbox
                          {...field}
                          size="small"
                          value={field.value}
                          sx={{
                            '&.Mui-checked': {
                              color: '#159581',
                            },
                          }}
                        />
                      }
                      label="Total Clicks"
                      className="text-sm m-0"
                    />
                  )}
                />
                <Controller
                  name="metrics.ctr"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Checkbox
                          {...field}
                          size="small"
                          value={field.value}
                          sx={{
                            '&.Mui-checked': {
                              color: '#159581',
                            },
                          }}
                        />
                      }
                      label="CTR"
                      className="text-sm m-0"
                    />
                  )}
                />
              </FormGroup>
              <FormHelperText className="mt-2">Please select at least one metric</FormHelperText>
            </div>
          </div>

          {/* Progress indicator - only shown when generating a report */}
          {generating && (
            <Box sx={{ mt: 4, mb: 2 }}>
              <Box sx={{ mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  {progress.currentCampaign > 0 && progress.totalCampaigns > 0 
                    ? `Processing campaign ${progress.currentCampaign} of ${progress.totalCampaigns}` 
                    : progress.message}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {progress.percentage}%
                </Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={progress.percentage} 
                sx={{ 
                  height: 8, 
                  borderRadius: 4,
                  backgroundColor: 'rgba(0, 0, 0, 0.08)',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: '#159581',
                    borderRadius: 4,
                  }
                }}
              />
              <Typography 
                variant="caption" 
                color="text.secondary" 
                sx={{ 
                  display: 'block', 
                  mt: 0.5, 
                  textAlign: 'center', 
                  fontStyle: 'italic' 
                }}
              >
                {progress.stage === 'ProcessingCampaigns' 
                  ? (progress.timeRemaining ? formatTimeRemaining(progress.timeRemaining) : 'Calculating time remaining...') 
                  : ''}
              </Typography>
            </Box>
          )}
          
          {/* Submit Button Section with loading state */}
          <div className="mt-6 flex justify-center">
            <Button
              type="submit"
              variant="contained"
              disabled={
                generating || // Disable while generating
                !watch('advertiser') || // Require advertiser
                !watch('trackingUrls.0') || // Require at least one tracking URL
                !Object.values(watch('metrics')).some(value => value) // Require at least one metric
              }
              sx={{
                '&.MuiButton-contained': {
                  backgroundColor: generating ? '#e5e7eb' : '#159581',
                  fontWeight: 600,
                  letterSpacing: 0.8,
                  padding: '8px 24px',
                  '&:hover': {
                    backgroundColor: '#138572'
                  },
                  '&.Mui-disabled': {
                    backgroundColor: '#e5e7eb'
                  }
                }
              }}
              className="px-8 py-2 rounded normal-case font-semibold"
              startIcon={generating ? <CircularProgress size={20} color="inherit" /> : null}
            >
              {generating ? 'Generating...' : 'Generate Report'}
            </Button>
          </div>
        </form>

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
    </ThemeProvider>
  );
};

export default RunReport; 