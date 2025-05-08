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
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import dayjs from 'dayjs';
import type { NewsletterType } from '@/types';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { invoke } from '@tauri-apps/api/core';

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

interface Settings {
  mailchimp_api_key: string;
  mailchimp_audience_id: string;
  advertisers: string[];
}

const NEWSLETTER_TYPES: NewsletterType[] = ['AM', 'PM', 'Energy', 'Health Care', 'Breaking News'];

const RunReport = () => {
  const [advertisers, setAdvertisers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Load settings including advertisers on component mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      console.log('Loading settings in RunReport...');
      const settings = await invoke<Settings>('load_settings');
      console.log('Loaded settings in RunReport:', settings);
      setAdvertisers(settings.advertisers);
      console.log('Advertisers set to:', settings.advertisers);
    } catch (error) {
      console.error('Failed to load settings in RunReport:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const [trackingUrls, setTrackingUrls] = useState<string[]>(['']);

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const handleAddUrl = () => {
    setTrackingUrls([...trackingUrls, '']);
  };

  const handleRemoveUrl = (index: number) => {
    if (trackingUrls.length > 1) {
      setTrackingUrls(trackingUrls.filter((_, i) => i !== index));
    }
  };

  const onSubmit = async (data: FormData) => {
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
      // Clean up empty tracking URLs
      const tracking_urls = data.trackingUrls.filter(url => url.trim() !== '');
      
      // Ensure we have at least one tracking URL
      if (tracking_urls.length === 0) {
        setSnackbar({
          open: true,
          message: 'Please add at least one advertisement URL or keyword',
          severity: 'error',
        });
        return;
      }

      const response = await invoke<{ success: boolean; message: string; data: any }>('generate_report', {
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

      setSnackbar({
        open: true,
        message: response.success ? 'Report generated successfully!' : `Failed to generate report: ${response.message}`,
        severity: response.success ? 'success' : 'error',
      });

      if (response.success) {
        // TODO: Navigate to reports page or show report data
        console.log('Report data:', response.data);
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Error generating report: ${error}`,
        severity: 'error',
      });
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div className="w-full">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Newsletter Type */}
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

          {/* Advertiser Information */}
          <div>
            <h3 className="text-[17.5px] font-semibold text-gray-900 tracking-wide uppercase mb-2.5">
              Advertiser Information
            </h3>
            <div className="space-y-4">
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

          {/* Date Range */}
          <div>
            <h3 className="text-[17.5px] font-semibold text-gray-900 tracking-wide uppercase mb-2.5">
              Date Range
            </h3>
            <div className="grid grid-cols-2 gap-4">
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

          {/* Metrics */}
          <div>
            <h3 className="text-[17.5px] font-semibold text-gray-900 tracking-wide uppercase mb-2.5">
              Metrics
            </h3>
            <div className="-mt-3">
              <FormGroup row className="gap-x-3 gap-y-2">
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

          {/* Submit Button */}
          <div className="flex justify-center mt-4">
            <Button
              type="submit"
              variant="contained"
              size="medium"
              disabled={
                !watch('advertiser') ||
                !watch('trackingUrls.0') ||
                !Object.values(watch('metrics')).some(value => value)
              }
              sx={{
                '&.MuiButton-contained': {
                  backgroundColor: '#159581',
                  fontWeight: 600,
                  letterSpacing: .8,
                  '&:hover': {
                    backgroundColor: '#138572'
                  },
                  '&.Mui-disabled': {
                    backgroundColor: '#e5e7eb'
                  }
                }
              }}
              className="px-8 py-2 rounded normal-case font-semibold"
            >
              Generate Report
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