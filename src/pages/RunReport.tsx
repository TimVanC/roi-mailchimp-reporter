/**
 * RunReport Component
 * 
 * This is the main report generation interface of the application.
 * It allows users to:
 * - Select newsletter types (AM/PM/Energy/Health Care/Breaking News)
 * - Choose advertisers from the configured list
 * - Add tracking URLs for campaign analysis
 * - Select date ranges for report generation
 * - Choose which metrics to include in the report
 * 
 * Features:
 * - Real-time progress updates during report generation
 * - Auto-syncing with settings changes
 * - Form validation and error handling
 * - Responsive design for all screen sizes
 */

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
import type { NewsletterType, FormData } from '@/types';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { invoke } from '@tauri-apps/api/core';
import { UnlistenFn, listen } from '@tauri-apps/api/event';
import { useReportStore } from '@/store/reportStore';

/**
 * Snackbar state interface for notifications
 */
interface SnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'info' | 'warning';
}

/**
 * Settings interface for loading application configuration
 * Used to retrieve the list of configured advertisers from the backend
 */
interface Settings {
  mailchimp_api_key: string;
  mailchimp_audience_id: string;
  advertisers: string[];
  download_directory: string;
}

/**
 * Available newsletter types supported by the application
 * These correspond to different campaign types in Mailchimp
 */
const NEWSLETTER_TYPES: NewsletterType[] = ['AM', 'PM', 'Energy', 'Health Care', 'Breaking News'];

/**
 * Progress update interface for tracking report generation status
 * Receives real-time updates from the Rust backend during processing
 */
interface ProgressUpdate {
  stage: string;
  progress: number;
  message: string;
  time_remaining: number | null;
}

/**
 * Progress state interface
 * Contains all necessary information about the progress of report generation
 */
interface ProgressState {
  stage: string;
  percentage: number;
  message: string;
  timeRemaining: number | null;
  currentCampaign: number;
  totalCampaigns: number;
}

/**
 * Response interface for the generate_report Rust function
 * Contains success status, messages, and the actual report data
 */
interface GenerateReportResponse {
  success: boolean;
  message: string;
  data: any;
  progress_updates: ProgressUpdate[];
}

/**
 * Main report generation component
 * Handles form state, data submission, and progress tracking
 */
const RunReport = () => {
  const [snackbar, setSnackbar] = useState<SnackbarState>({ open: false, message: '', severity: 'info' });
  const [advertisers, setAdvertisers] = useState<string[]>([]);
  const [selectedAdvertiser, setSelectedAdvertiser] = useState<string>('');
  const [selectedNewsletterType, setSelectedNewsletterType] = useState<string>('');
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [trackingUrls, setTrackingUrls] = useState<string[]>(['']);
  
  // Get state and actions from the global store
  const {
    isGenerating,
    formData: savedFormData,
    progress,
    setIsGenerating,
    setFormData,
    setProgress,
    resetProgress
  } = useReportStore();

  // React Hook Form setup with persisted data
  const { control, handleSubmit, watch, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: savedFormData || {
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

  // Load saved form data when component mounts
  useEffect(() => {
    if (savedFormData) {
      reset(savedFormData);
      if (savedFormData.trackingUrls?.length > 0) {
        setTrackingUrls(savedFormData.trackingUrls);
      }
    }
  }, [savedFormData, reset]);

  // Save form data on field changes
  const onFieldChange = (name: string, value: any) => {
    const currentFormData = watch();
    setFormData({
      ...currentFormData,
      [name]: value
    } as FormData);
  };

  // Component initialization effect
  useEffect(() => {
    console.log('RunReport component mounted, loading settings...');
    loadSettings();
    setupProgressListener();
    
    // Listen for settings changes
    const setupSettingsListener = async () => {
      try {
        await listen<void>('settings-updated', () => {
          console.log('Settings updated, reloading...');
          loadSettings();
        });
      } catch (error) {
        console.error('Failed to set up settings listener:', error);
      }
    };
    
    setupSettingsListener();
  }, []);

  /**
   * Sets up real-time progress event listener
   * Handles:
   * - Registration of event listener
   * - Parsing of progress updates
   * - Extraction of campaign counting information
   * - Progress state updates
   */
  const setupProgressListener = async () => {
    try {
      const unlisten = await listen<ProgressUpdate>('report-progress', (event) => {
        const update = event.payload;
        console.log('Progress update received:', update);
        
        setProgress({
          stage: update.stage,
          percentage: update.progress,
          message: update.message,
          timeRemaining: typeof update.time_remaining === 'number' ? update.time_remaining : null,
          currentCampaign: progress.currentCampaign,
          totalCampaigns: progress.totalCampaigns
        });
      });
      return unlisten;
    } catch (error) {
      console.error("Failed to set up progress listener:", error);
    }
  };

  /**
   * Formats the remaining time into a human-readable string
   * Converts seconds into minutes:seconds format when appropriate
   */
  const formatTimeRemaining = (seconds: number | null): string => {
    if (seconds === null || seconds === undefined) {
      return 'Calculating time remaining...';
    }
    
    if (seconds === 0) {
      return 'Almost done...';
    }
    
    if (seconds < 60) {
      return `About ${Math.ceil(seconds)} seconds remaining`;
    } else {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.round(seconds % 60);
      if (minutes === 1) {
        return `About 1 minute ${remainingSeconds > 0 ? `and ${remainingSeconds} seconds` : ''} remaining`;
      }
      return `About ${minutes} minutes ${remainingSeconds > 0 ? `and ${remainingSeconds} seconds` : ''} remaining`;
    }
  };

  /**
   * Loads application settings from the backend
   * Updates advertiser list only if it has changed
   * Handles loading states and error logging
   */
  const loadSettings = async () => {
    try {
      console.log('Loading settings in RunReport...');
      const settings = await invoke<Settings>('load_settings');
      console.log('Loaded settings in RunReport:', settings);
      
      // Check if advertisers have changed before updating state
      if (JSON.stringify(settings.advertisers) !== JSON.stringify(advertisers)) {
        console.log('Advertisers have changed, updating state...');
        setAdvertisers(settings.advertisers);
      }
      
      console.log('Advertisers set to:', settings.advertisers);
    } catch (error) {
      console.error('Failed to load settings in RunReport:', error);
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
    try {
      // Save the complete form data
      setFormData(data);
      
      // Reset progress state
      resetProgress();
      
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

      // Set generating state to true to show loading indicator
      setIsGenerating(true);
      
      // Clean up empty tracking URLs
      const tracking_urls = data.trackingUrls.filter(url => url.trim() !== '');
      
      // Ensure we have at least one tracking URL
      if (tracking_urls.length === 0) {
        setSnackbar({
          open: true,
          message: 'Please add at least one advertisement URL or keyword',
          severity: 'error',
        });
        setIsGenerating(false);
        return;
      }

      // Generate the report by calling the Rust backend
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

      // Debug logging
      console.log('Full response:', JSON.stringify(response, null, 2));
      console.log('Response data type:', typeof response.data);
      console.log('Response data structure:', JSON.stringify(response.data, null, 2));

      if (response.success) {
        // Helper function to check if the data contains any campaign metrics
        const hasValidCampaignData = (data: any): boolean => {
          // Debug logging
          console.log('Checking data:', JSON.stringify(data, null, 2));
          
          // Check if data exists and is an object
          if (!data || typeof data !== 'object') {
            console.log('Data is null or not an object');
            return false;
          }

          // If it's an array, check each item
          if (Array.isArray(data)) {
            console.log('Data is an array of length:', data.length);
            if (data.length === 0) return false;
            return data.some(item => hasValidCampaignData(item));
          }

          // Check for campaign metrics
          const hasMetrics = 
            (typeof data.unique_opens === 'number' && data.unique_opens > 0) ||
            (typeof data.total_opens === 'number' && data.total_opens > 0) ||
            (typeof data.total_recipients === 'number' && data.total_recipients > 0) ||
            (typeof data.total_clicks === 'number' && data.total_clicks > 0);

          console.log('Metrics check:', {
            unique_opens: data.unique_opens,
            total_opens: data.total_opens,
            total_recipients: data.total_recipients,
            total_clicks: data.total_clicks,
            hasMetrics
          });

          // If this object has metrics, check if they're all zero
          if (hasMetrics) {
            const allZero = 
              (!data.unique_opens || data.unique_opens === 0) &&
              (!data.total_opens || data.total_opens === 0) &&
              (!data.total_recipients || data.total_recipients === 0) &&
              (!data.total_clicks || data.total_clicks === 0);
            
            console.log('All metrics zero check:', allZero);
            return !allZero;
          }

          // If no metrics found at this level, check nested objects
          const nestedCheck = Object.entries(data).some(([key, value]) => {
            console.log('Checking nested object key:', key);
            return typeof value === 'object' && value !== null && hasValidCampaignData(value);
          });
          console.log('Nested objects check result:', nestedCheck);
          return nestedCheck;
        };

        // Check if the response has any valid campaign data
        const hasValidData = hasValidCampaignData(response.data);
        console.log('Final validation result:', hasValidData);

        if (!hasValidData) {
          setSnackbar({
            open: true,
            message: `No matching campaign data found. This could mean:
              • No campaigns used these tracking URLs
              • No campaigns were sent in this date range
              • The tracking URLs might be misspelled
              • The advertiser name might be incorrect
              
              Try adjusting your search criteria and ensure tracking URLs match exactly.`,
            severity: 'warning',
          });
          setIsGenerating(false);
          return;
        }

        // First emit the report-generated event with the new report data
        await invoke('emit_event', {
          event: 'report-generated',
          payload: {
            report: response.data
          }
        });

        // Wait a short moment to ensure the event has been processed
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Show success message
        setSnackbar({
          open: true,
          message: 'Report generated successfully!',
          severity: 'success',
        });

        // Reset form and state after successful generation
        reset();
        setTrackingUrls(['']);
        setFormData(null);
        resetProgress();
        
        // Finally, set generating state to false
        setIsGenerating(false);
      } else {
        // Check if the error message indicates no data found
        if (response.message?.toLowerCase().includes('no data') || 
            response.message?.toLowerCase().includes('no results') ||
            response.message?.toLowerCase().includes('no campaigns')) {
          setSnackbar({
            open: true,
            message: `No matching campaign data found. This could mean:
              • No campaigns used these tracking URLs
              • No campaigns were sent in this date range
              • The tracking URLs might be misspelled
              • The advertiser name might be incorrect
              
              Try adjusting your search criteria and ensure tracking URLs match exactly.`,
            severity: 'warning',
          });
        } else {
          setSnackbar({
            open: true,
            message: `Failed to generate report: ${response.message}`,
            severity: 'error',
          });
        }
        setIsGenerating(false);
      }
    } catch (err: unknown) {
      console.error('Error generating report:', err);
      
      // Check if the error message indicates no data found
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.toLowerCase().includes('no data') || 
          errorMessage.toLowerCase().includes('no results') ||
          errorMessage.toLowerCase().includes('no campaigns')) {
        setSnackbar({
          open: true,
          message: `No matching campaign data found. This could mean:
            • No campaigns used these tracking URLs
            • No campaigns were sent in this date range
            • The tracking URLs might be misspelled
            • The advertiser name might be incorrect
            
            Try adjusting your search criteria and ensure tracking URLs match exactly.`,
          severity: 'warning',
        });
      } else {
        setSnackbar({
          open: true,
          message: `Error generating report: ${errorMessage}`,
          severity: 'error',
        });
      }
      setIsGenerating(false);
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
                  <RadioGroup 
                    row 
                    {...field} 
                    className="gap-3"
                    onChange={(e) => {
                      field.onChange(e);
                      onFieldChange('newsletterType', e.target.value);
                    }}
                  >
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
                    onChange={(_, value) => {
                      field.onChange(value);
                      onFieldChange('advertiser', value);
                    }}
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
                          onChange={(e) => {
                            field.onChange(e);
                            const newUrls = [...trackingUrls];
                            newUrls[index] = e.target.value;
                            onFieldChange('trackingUrls', newUrls);
                          }}
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
                        onClick={() => {
                          handleRemoveUrl(index);
                          const newUrls = trackingUrls.filter((_, i) => i !== index);
                          onFieldChange('trackingUrls', newUrls);
                        }}
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
                  onClick={() => {
                    handleAddUrl();
                    onFieldChange('trackingUrls', [...trackingUrls, '']);
                  }}
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
                    onChange={(date) => {
                      const dateStr = date?.format('YYYY-MM-DD');
                      field.onChange(dateStr);
                      onFieldChange('dateRange', {
                        ...watch('dateRange'),
                        startDate: dateStr
                      });
                    }}
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
                    onChange={(date) => {
                      const dateStr = date?.format('YYYY-MM-DD');
                      field.onChange(dateStr);
                      onFieldChange('dateRange', {
                        ...watch('dateRange'),
                        endDate: dateStr
                      });
                    }}
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
                          checked={field.value}
                          onChange={(e) => {
                            field.onChange(e);
                            onFieldChange('metrics', {
                              ...watch('metrics'),
                              uniqueOpens: e.target.checked
                            });
                          }}
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
                          checked={field.value}
                          onChange={(e) => {
                            field.onChange(e);
                            onFieldChange('metrics', {
                              ...watch('metrics'),
                              totalOpens: e.target.checked
                            });
                          }}
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
                          checked={field.value}
                          onChange={(e) => {
                            field.onChange(e);
                            onFieldChange('metrics', {
                              ...watch('metrics'),
                              totalRecipients: e.target.checked
                            });
                          }}
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
                          checked={field.value}
                          onChange={(e) => {
                            field.onChange(e);
                            onFieldChange('metrics', {
                              ...watch('metrics'),
                              totalClicks: e.target.checked
                            });
                          }}
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
                          checked={field.value}
                          onChange={(e) => {
                            field.onChange(e);
                            onFieldChange('metrics', {
                              ...watch('metrics'),
                              ctr: e.target.checked
                            });
                          }}
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
          {isGenerating && (
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
                {formatTimeRemaining(progress.timeRemaining)}
              </Typography>
            </Box>
          )}
          
          {/* Submit Button Section with loading state */}
          <div className="mt-6 flex justify-center">
            <Button
              type="submit"
              variant="contained"
              disabled={
                isGenerating || // Disable while generating
                !watch('advertiser') || // Require advertiser
                !watch('trackingUrls.0') || // Require at least one tracking URL
                !Object.values(watch('metrics')).some(value => value) // Require at least one metric
              }
              sx={{
                '&.MuiButton-contained': {
                  backgroundColor: isGenerating ? '#e5e7eb' : '#159581',
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
              startIcon={isGenerating ? <CircularProgress size={20} color="inherit" /> : null}
            >
              {isGenerating ? 'Generating...' : 'Generate Report'}
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