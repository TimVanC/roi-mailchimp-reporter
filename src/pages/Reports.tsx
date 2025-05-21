/**
 * Reports Component
 * 
 * This component manages the report history and provides tools for:
 * - Viewing saved reports
 * - Filtering reports by advertiser and type
 * - Exporting reports to Excel/CSV
 * - Managing report lifecycle (view/edit/delete)
 * 
 * Features:
 * - Sortable report list
 * - Multiple export options
 * - Filtering and search
 * - Batch operations
 * - Responsive table layout
 * - Real-time updates when new reports are generated
 */

import { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  TextField,
  MenuItem,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Delete as DeleteIcon,
  TableView as TableViewIcon,
} from '@mui/icons-material';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import type { NewsletterType } from '@/types';
import { useReportStore } from '@/store/reportStore';

/**
 * Report interface defining the structure of saved reports
 * Must match the SavedReport struct in the Rust backend (lib.rs)
 */
interface Report {
  id: string;                 // Unique identifier for the report
  name: string;               // Display name
  advertiser: string;         // Associated advertiser
  report_type: NewsletterType; // Type of newsletter (AM/PM/etc)
  date_range: {
    start_date: string;      // Report start date
    end_date: string;        // Report end date
  };
  created: string;           // Report creation timestamp
  data: any;                 // The actual report data
}

/**
 * Available newsletter types for filtering
 * These match the types supported in the Mailchimp campaigns
 */
const NEWSLETTER_TYPES: NewsletterType[] = ['AM', 'PM', 'Energy', 'Health Care', 'Breaking News'];

/**
 * Main Reports component that handles report management and display
 */
const Reports = () => {
  // Get reports and actions from the global store
  const { reports, setReports, addReport, deleteReport: storeDeleteReport } = useReportStore();
  
  // Local state for filtering and UI
  const [advertisers, setAdvertisers] = useState<string[]>([]);
  const [selectedAdvertiser, setSelectedAdvertiser] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  
  // UI state for notifications and confirmations
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });
  const [deleteDialog, setDeleteDialog] = useState<{ 
    open: boolean; 
    reportId: string | null 
  }>({ open: false, reportId: null });

  /**
   * Load reports when component mounts and set up event listeners
   */
  useEffect(() => {
    let unsubscribe: UnlistenFn | undefined;

    const initialize = async () => {
      try {
        // Initial load of reports
        await loadReports();
        
        // Set up event listener for new reports
        unsubscribe = await listen<{ report: any }>('report-generated', (event) => {
          console.log('Received new report:', event.payload.report);
          addReport(event.payload.report);
          
          // Update advertisers list if needed
          const newAdvertiser = event.payload.report.advertiser;
          if (!advertisers.includes(newAdvertiser)) {
            setAdvertisers(prev => [...prev, newAdvertiser]);
          }
          
          // Show success notification
          setSnackbar({
            open: true,
            message: 'New report generated successfully!',
            severity: 'success'
          });
        });
      } catch (error) {
        console.error('Failed to initialize Reports component:', error);
      }
    };

    initialize();

    // Cleanup function
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [addReport, advertisers]);

  /**
   * Fetches reports from backend storage
   * Also extracts unique advertisers for filtering
   */
  const loadReports = async () => {
    try {
      const savedReports = await invoke<any[]>('load_reports');
      setReports(savedReports);
      
      // Build unique advertiser list for filter dropdown
      const uniqueAdvertisers = Array.from(new Set(savedReports.map(r => r.advertiser)));
      setAdvertisers(uniqueAdvertisers);
    } catch (error) {
      console.error('Failed to load reports:', error);
    }
  };

  /**
   * Sort reports by creation date (newest first)
   * This computed value is used in the render
   */
  const sortedReports = [...reports].sort((a, b) => 
    new Date(b.created).getTime() - new Date(a.created).getTime()
  );

  /**
   * Filter reports based on user selections
   * Applies both advertiser and type filters
   */
  const filteredReports = sortedReports.filter(report => {
    if (selectedAdvertiser && report.advertiser !== selectedAdvertiser) return false;
    if (selectedType && report.report_type !== selectedType) return false;
    return true;
  });

  /**
   * Format date range for display
   * Converts ISO dates to localized strings
   */
  const formatDateRange = (dateRange: { start_date: string; end_date: string }) => {
    const startDate = new Date(dateRange.start_date);
    const endDate = new Date(dateRange.end_date);
    return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
  };

  /**
   * Opens report in system's default spreadsheet application
   * Generates a temporary CSV file and launches it
   */
  const handleOpenInExcel = async (report: any) => {
    try {
      const filePath = await invoke<string>('open_report_in_excel', { reportData: report });
      await invoke('opener_open', { path: filePath });
      setSnackbar({ 
        open: true, 
        message: 'CSV file generated. It should open in Excel.', 
        severity: 'success' 
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Failed to open in Excel: ${error}`,
        severity: 'error',
      });
    }
  };

  /**
   * Downloads report as CSV to user's download directory
   * Uses the configured download path from settings
   */
  const handleDownload = async (report: any) => {
    try {
      const filePath = await invoke<string>('download_csv', { reportData: report });
      setSnackbar({ 
        open: true, 
        message: `CSV report downloaded to: ${filePath}`, 
        severity: 'success' 
      });
    } catch (error: any) {
      setSnackbar({ 
        open: true, 
        message: `Failed to download CSV: ${error}`, 
        severity: 'error' 
      });
    }
  };

  /**
   * Deletes a report after user confirmation
   * Updates both backend and store state
   */
  const handleDelete = async (reportId: string) => {
    try {
      await invoke('delete_report', { reportId: reportId });
      storeDeleteReport(reportId);
      setSnackbar({ open: true, message: 'Report deleted.', severity: 'success' });
    } catch (error) {
      console.error('Delete error:', error);
      setSnackbar({ 
        open: true, 
        message: `Failed to delete: ${error}`, 
        severity: 'error' 
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto pt-8">
      {/* Filter Controls */}
      <div className="flex gap-4 mb-6">
        {/* Advertiser Filter Dropdown */}
        <TextField
          select
          label="Filter by Advertiser"
          size="small"
          className="w-64"
          value={selectedAdvertiser}
          onChange={(e) => setSelectedAdvertiser(e.target.value)}
          sx={{
            '& .MuiOutlinedInput-root': {
              '&.Mui-focused': {
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(0, 0, 0, 0.23) !important',
                  borderWidth: '1px !important'
                }
              }
            }
          }}
        >
          <MenuItem value="">All Advertisers</MenuItem>
          {advertisers.map((advertiser) => (
            <MenuItem key={advertiser} value={advertiser}>
              {advertiser}
            </MenuItem>
          ))}
        </TextField>

        {/* Newsletter Type Filter Dropdown */}
        <TextField
          select
          label="Filter by Type"
          size="small"
          className="w-64"
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          sx={{
            '& .MuiOutlinedInput-root': {
              '&.Mui-focused': {
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(0, 0, 0, 0.23) !important',
                  borderWidth: '1px !important'
                }
              }
            }
          }}
        >
          <MenuItem value="">All Types</MenuItem>
          {NEWSLETTER_TYPES.map((type) => (
            <MenuItem key={type} value={type}>
              {type}
            </MenuItem>
          ))}
        </TextField>
      </div>

      {/* Reports Table */}
      <TableContainer className="border rounded-lg bg-white">
        <Table>
          <TableHead>
            <TableRow className="bg-gray-50">
              <TableCell sx={{ fontWeight: 600 }}>Advertiser</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="center">Type</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Date Range</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="center">Created</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredReports.map((report) => (
              <TableRow key={report.id} className="hover:bg-gray-50">
                <TableCell>{report.advertiser}</TableCell>
                <TableCell align="center">{report.report_type}</TableCell>
                <TableCell>{formatDateRange(report.date_range)}</TableCell>
                <TableCell align="center">{report.created}</TableCell>
                <TableCell align="center">
                  <div className="flex justify-center gap-1">
                    {/* Excel Button */}
                    <IconButton
                      size="small"
                      className="text-gray-600 hover:text-gray-900"
                      title="Open in Excel"
                      onClick={() => handleOpenInExcel(report)}
                    >
                      <TableViewIcon fontSize="small" />
                    </IconButton>
                    {/* Download Button */}
                    <IconButton
                      size="small"
                      className="text-gray-600 hover:text-gray-900"
                      title="Download"
                      onClick={() => handleDownload(report)}
                    >
                      <DownloadIcon fontSize="small" />
                    </IconButton>
                    {/* Delete Button */}
                    <IconButton
                      size="small"
                      className="text-red-600 hover:text-red-800"
                      title="Delete"
                      onClick={() => setDeleteDialog({ open: true, reportId: report.id })}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, reportId: null })}>
        <DialogTitle>Delete Report</DialogTitle>
        <DialogContent>Are you sure you want to delete this report?</DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, reportId: null })}>Cancel</Button>
          <Button color="error" onClick={() => {
            if (deleteDialog.reportId) handleDelete(deleteDialog.reportId);
            setDeleteDialog({ open: false, reportId: null });
          }}>Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Notification Snackbar */}
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

export default Reports; 