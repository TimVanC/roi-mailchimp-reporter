/**
 * Reports Component
 * 
 * This component manages the report history and provides tools for:
 * - Viewing saved reports
 * - Filtering reports by advertiser and type
 * - Exporting reports to Excel/CSV
 * - Managing report lifecycle (view/edit/delete)
 * - Batch operations (delete/export multiple reports)
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
  CircularProgress,
  Checkbox,
  Tooltip,
  ButtonGroup,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Delete as DeleteIcon,
  TableView as TableViewIcon,
  Refresh as RefreshIcon,
  FileDownload as FileDownloadIcon,
} from '@mui/icons-material';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import type { NewsletterType } from '@/types';
import { useReportStore } from '@/store/reportStore';

/**
 * Available newsletter types for filtering
 * These match the types supported in the Mailchimp campaigns
 */
const NEWSLETTER_TYPES: NewsletterType[] = ['AM', 'PM', 'Energy', 'Health Care', 'Breaking News'];

/**
 * Batch operation type for confirmation dialog
 */
type BatchOperation = 'delete' | 'download' | 'excel' | null;

/**
 * Main Reports component that handles report management and display
 */
const Reports = () => {
  // Get reports and actions from the global store
  const { reports, setReports, deleteReport: storeDeleteReport } = useReportStore();
  
  // Local state for filtering and UI
  const [advertisers, setAdvertisers] = useState<string[]>([]);
  const [selectedAdvertiser, setSelectedAdvertiser] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  // UI state for notifications and confirmations
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning';
  }>({ open: false, message: '', severity: 'success' });
  const [deleteDialog, setDeleteDialog] = useState<{ 
    open: boolean; 
    reportId: string | null 
  }>({ open: false, reportId: null });

  // Add new state for selected reports and batch operations
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [batchOperation, setBatchOperation] = useState<BatchOperation>(null);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  /**
   * Load reports with retry mechanism
   */
  const loadReportsWithRetry = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      
      const savedReports = await invoke<any[]>('load_reports');
      
      if (!savedReports || !Array.isArray(savedReports)) {
        throw new Error('Invalid reports data received');
      }
      
      setReports(savedReports);
      
      // Build unique advertiser list for filter dropdown
      const uniqueAdvertisers = Array.from(new Set(savedReports.map(r => r.advertiser)));
      setAdvertisers(uniqueAdvertisers);
      
      if (isRefresh) {
        setSnackbar({
          open: true,
          message: 'Reports refreshed successfully',
          severity: 'success'
        });
      }
      
      // Reset retry count on successful load
      setRetryCount(0);
      
    } catch (error) {
      console.error('Failed to load reports:', error);
      
      if (retryCount < 3) {
        // Retry after 1 second delay
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          loadReportsWithRetry(isRefresh);
        }, 1000);
      } else {
        setError('Failed to load reports. Please try refreshing the page.');
        setSnackbar({
          open: true,
          message: 'Failed to load reports after multiple attempts',
          severity: 'error'
        });
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  /**
   * Load reports when component mounts and set up event listeners
   */
  useEffect(() => {
    let unsubscribe: UnlistenFn | undefined;

    const initialize = async () => {
      try {
        // Initial load of reports
        await loadReportsWithRetry();
        
        // Set up event listener for new reports
        unsubscribe = await listen<{ report: any }>('report-generated', async (event) => {
          console.log('Received new report:', event.payload.report);
          const newReport = event.payload.report;
          
          try {
            // Add a small delay to ensure file is written
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Reload all reports to ensure we have the latest data
            await loadReportsWithRetry();
            
            // Update advertisers list if needed
            setAdvertisers(prev => {
              if (!prev.includes(newReport.advertiser)) {
                return [...prev, newReport.advertiser];
              }
              return prev;
            });
          } catch (error) {
            console.error('Failed to reload reports after new report generation:', error);
            setSnackbar({
              open: true,
              message: 'Report generated but failed to refresh list. Please try manually refreshing.',
              severity: 'warning'
            });
          }
        });
      } catch (error) {
        console.error('Failed to initialize Reports component:', error);
        setError('Failed to load reports. Please try refreshing the page.');
      }
    };

    initialize();

    // Cleanup function
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []); // Only run on mount

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

  /**
   * Handles selecting/deselecting all reports
   */
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedReports(filteredReports.map(report => report.id));
    } else {
      setSelectedReports([]);
    }
  };

  /**
   * Handles selecting/deselecting individual report
   */
  const handleSelectReport = (reportId: string) => {
    setSelectedReports(prev => {
      if (prev.includes(reportId)) {
        return prev.filter(id => id !== reportId);
      } else {
        return [...prev, reportId];
      }
    });
  };

  /**
   * Handles batch delete operation
   */
  const handleBatchDelete = async () => {
    setIsBatchProcessing(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const reportId of selectedReports) {
        try {
          await invoke('delete_report', { reportId });
          storeDeleteReport(reportId);
          successCount++;
        } catch (error) {
          console.error(`Failed to delete report ${reportId}:`, error);
          errorCount++;
        }
      }

      setSnackbar({
        open: true,
        message: `Successfully deleted ${successCount} reports${errorCount > 0 ? `, failed to delete ${errorCount} reports` : ''}`,
        severity: errorCount > 0 ? 'warning' : 'success'
      });

      setSelectedReports([]);
    } catch (error) {
      console.error('Batch delete error:', error);
      setSnackbar({
        open: true,
        message: 'Failed to complete batch delete operation',
        severity: 'error'
      });
    } finally {
      setIsBatchProcessing(false);
      setBatchOperation(null);
    }
  };

  /**
   * Handles batch download operation
   */
  const handleBatchDownload = async () => {
    setIsBatchProcessing(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const reportId of selectedReports) {
        const report = reports.find(r => r.id === reportId);
        if (!report) continue;

        try {
          await invoke<string>('download_csv', { reportData: report });
          successCount++;
        } catch (error) {
          console.error(`Failed to download report ${reportId}:`, error);
          errorCount++;
        }
      }

      setSnackbar({
        open: true,
        message: `Successfully downloaded ${successCount} reports${errorCount > 0 ? `, failed to download ${errorCount} reports` : ''}`,
        severity: errorCount > 0 ? 'warning' : 'success'
      });

      setSelectedReports([]);
    } catch (error) {
      console.error('Batch download error:', error);
      setSnackbar({
        open: true,
        message: 'Failed to complete batch download operation',
        severity: 'error'
      });
    } finally {
      setIsBatchProcessing(false);
      setBatchOperation(null);
    }
  };

  /**
   * Handles batch Excel open operation
   */
  const handleBatchExcel = async () => {
    setIsBatchProcessing(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const reportId of selectedReports) {
        const report = reports.find(r => r.id === reportId);
        if (!report) continue;

        try {
          const filePath = await invoke<string>('open_report_in_excel', { reportData: report });
          await invoke('opener_open', { path: filePath });
          successCount++;
        } catch (error) {
          console.error(`Failed to open report ${reportId} in Excel:`, error);
          errorCount++;
        }
      }

      setSnackbar({
        open: true,
        message: `Successfully opened ${successCount} reports in Excel${errorCount > 0 ? `, failed to open ${errorCount} reports` : ''}`,
        severity: errorCount > 0 ? 'warning' : 'success'
      });

      setSelectedReports([]);
    } catch (error) {
      console.error('Batch Excel open error:', error);
      setSnackbar({
        open: true,
        message: 'Failed to complete batch Excel operation',
        severity: 'error'
      });
    } finally {
      setIsBatchProcessing(false);
      setBatchOperation(null);
    }
  };

  /**
   * Handles confirming batch operations
   */
  const handleConfirmBatchOperation = () => {
    switch (batchOperation) {
      case 'delete':
        handleBatchDelete();
        break;
      case 'download':
        handleBatchDownload();
        break;
      case 'excel':
        handleBatchExcel();
        break;
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading reports...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-600 mb-4">⚠️</div>
          <p className="text-gray-800">{error}</p>
          <button
            onClick={() => loadReportsWithRetry(true)}
            className="mt-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
          >
            Retry Loading Reports
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="bg-white rounded-lg shadow-sm px-6 pt-2 pb-6">
        {/* Title section */}
        <div className="mb-3">
          <h2 className="text-[22px] font-semibold text-gray-900">Report History</h2>
          <p className="text-sm text-gray-600 mt-1">View, download, and manage your generated reports</p>
        </div>

        {/* Filter controls and batch actions */}
        <div className="flex gap-4 mb-4 items-center">
        <TextField
          select
          label="Filter by Advertiser"
          value={selectedAdvertiser}
          onChange={(e) => setSelectedAdvertiser(e.target.value)}
            className="w-48"
            size="small"
        >
          <MenuItem value="">All Advertisers</MenuItem>
          {advertisers.map((advertiser) => (
            <MenuItem key={advertiser} value={advertiser}>
              {advertiser}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          label="Filter by Type"
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
            className="w-48"
            size="small"
        >
          <MenuItem value="">All Types</MenuItem>
          {NEWSLETTER_TYPES.map((type) => (
            <MenuItem key={type} value={type}>
              {type}
            </MenuItem>
          ))}
        </TextField>

          <div className="flex-grow" />

          {/* Batch Action Buttons */}
          {selectedReports.length > 0 && (
            <ButtonGroup 
              variant="outlined" 
              size="small"
              className="mr-4"
            >
              <Tooltip title="Download selected reports as CSV">
                <Button
                  startIcon={<FileDownloadIcon />}
                  onClick={() => setBatchOperation('download')}
                  disabled={isBatchProcessing}
                >
                  Download ({selectedReports.length})
                </Button>
              </Tooltip>
              <Tooltip title="Open selected reports in Excel">
                <Button
                  startIcon={<TableViewIcon />}
                  onClick={() => setBatchOperation('excel')}
                  disabled={isBatchProcessing}
                >
                  Excel ({selectedReports.length})
                </Button>
              </Tooltip>
              <Tooltip title="Delete selected reports">
                <Button
                  startIcon={<DeleteIcon />}
                  onClick={() => setBatchOperation('delete')}
                  disabled={isBatchProcessing}
                  color="error"
                >
                  Delete ({selectedReports.length})
                </Button>
              </Tooltip>
            </ButtonGroup>
          )}

          {/* Refresh Button */}
          <Tooltip title="Refresh Reports">
            <IconButton 
              onClick={() => loadReportsWithRetry(true)}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <CircularProgress size={24} />
              ) : (
                <RefreshIcon />
              )}
            </IconButton>
          </Tooltip>
      </div>

      {/* Reports Table */}
        <TableContainer>
        <Table>
          <TableHead>
            <TableRow className="bg-gray-50">
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selectedReports.length > 0 && selectedReports.length < filteredReports.length}
                    checked={filteredReports.length > 0 && selectedReports.length === filteredReports.length}
                    onChange={handleSelectAll}
                    size="small"
                  />
                </TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Advertiser</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="center">Type</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Date Range</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="center">Created</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
              {filteredReports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" className="py-8">
                    <p className="text-gray-500">No reports found</p>
                    {(selectedAdvertiser || selectedType) && (
                      <p className="text-gray-400 text-sm mt-2">
                        Try adjusting your filters
                      </p>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filteredReports.map((report) => (
                  <TableRow 
                    key={report.id} 
                    className="hover:bg-gray-50"
                    selected={selectedReports.includes(report.id)}
                    sx={{
                      '&:last-child td, &:last-child th': {
                        border: 0
                      }
                    }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedReports.includes(report.id)}
                        onChange={() => handleSelectReport(report.id)}
                        size="small"
                      />
                    </TableCell>
                <TableCell>{report.advertiser}</TableCell>
                <TableCell align="center">{report.report_type}</TableCell>
                <TableCell>{formatDateRange(report.date_range)}</TableCell>
                <TableCell align="center">{report.created}</TableCell>
                    <TableCell>
                  <div className="flex justify-center gap-1">
                    <IconButton
                      size="small"
                      className="text-gray-600 hover:text-gray-900"
                      title="Open in Excel"
                      onClick={() => handleOpenInExcel(report)}
                    >
                      <TableViewIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      className="text-gray-600 hover:text-gray-900"
                      title="Download"
                      onClick={() => handleDownload(report)}
                    >
                      <DownloadIcon fontSize="small" />
                    </IconButton>
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
                ))
              )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteDialog.open}
          onClose={() => setDeleteDialog({ open: false, reportId: null })}
        >
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

        {/* Batch Operation Confirmation Dialog */}
        <Dialog
          open={batchOperation !== null}
          onClose={() => setBatchOperation(null)}
        >
          <DialogTitle>
            {batchOperation === 'delete' && 'Delete Multiple Reports'}
            {batchOperation === 'download' && 'Download Multiple Reports'}
            {batchOperation === 'excel' && 'Open Multiple Reports in Excel'}
          </DialogTitle>
          <DialogContent>
            {batchOperation === 'delete' && (
              <p>Are you sure you want to delete {selectedReports.length} reports?</p>
            )}
            {batchOperation === 'download' && (
              <p>Download {selectedReports.length} reports as CSV files?</p>
            )}
            {batchOperation === 'excel' && (
              <p>Open {selectedReports.length} reports in Excel?</p>
            )}
            {isBatchProcessing && (
              <div className="mt-4">
                <CircularProgress size={24} />
                <span className="ml-2">Processing...</span>
              </div>
            )}
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={() => setBatchOperation(null)}
              disabled={isBatchProcessing}
            >
              Cancel
            </Button>
            <Button
              color={batchOperation === 'delete' ? 'error' : 'primary'}
              onClick={handleConfirmBatchOperation}
              disabled={isBatchProcessing}
            >
              Confirm
            </Button>
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
    </div>
  );
};

export default Reports; 