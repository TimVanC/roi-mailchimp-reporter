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
  Edit as EditIcon,
  TableView as TableViewIcon,
} from '@mui/icons-material';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';
import { save } from '@tauri-apps/plugin-dialog';
import type { NewsletterType } from '@/types';

interface Report {
  id: string;
  name: string;
  advertiser: string;
  report_type: NewsletterType;
  date_range: {
    start_date: string;
    end_date: string;
  };
  created: string;
  data: any;
}

const NEWSLETTER_TYPES: NewsletterType[] = ['AM', 'PM', 'Energy', 'Health Care', 'Breaking News'];

const Reports = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [advertisers, setAdvertisers] = useState<string[]>([]);
  const [selectedAdvertiser, setSelectedAdvertiser] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; reportId: string | null }>({ open: false, reportId: null });

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const savedReports = await invoke<Report[]>('load_reports');
      setReports(savedReports);
      
      // Extract unique advertisers
      const uniqueAdvertisers = Array.from(new Set(savedReports.map(r => r.advertiser)));
      setAdvertisers(uniqueAdvertisers);
    } catch (error) {
      console.error('Failed to load reports:', error);
    }
  };

  // Sort reports by most recent created date (descending)
  const sortedReports = [...reports].sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

  const filteredReports = sortedReports.filter(report => {
    if (selectedAdvertiser && report.advertiser !== selectedAdvertiser) return false;
    if (selectedType && report.report_type !== selectedType) return false;
    return true;
  });

  const formatDateRange = (dateRange: Report['date_range']) => {
    const startDate = new Date(dateRange.start_date);
    const endDate = new Date(dateRange.end_date);
    return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
  };

  const handleOpenInExcel = async (report: Report) => {
    try {
      // Get the CSV file path from backend
      const filePath = await invoke<string>('open_report_in_excel', { reportData: report.data });
      // Instead of opening with shell, let's try using the opener plugin directly
      await invoke('opener_open', { path: filePath });
      setSnackbar({ open: true, message: 'CSV file generated. It should open in Excel.', severity: 'success' });
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Failed to open in Excel: ${error}`,
        severity: 'error',
      });
    }
  };

  const handleDownload = async (report: Report) => {
    try {
      const filePath = await save({
        defaultPath: `${report.name}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (filePath) {
        await invoke('write_report_file', { path: filePath, report });
        setSnackbar({ open: true, message: 'Report downloaded.', severity: 'success' });
      }
    } catch (error) {
      setSnackbar({ open: true, message: `Failed to download: ${error}`, severity: 'error' });
    }
  };

  const handleDelete = async (reportId: string) => {
    try {
      await invoke('delete_report', { report_id: reportId });
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      setSnackbar({ open: true, message: 'Report deleted.', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: `Failed to delete: ${error}`, severity: 'error' });
    }
  };

  return (
    <div className="max-w-7xl mx-auto pt-8">
      {/* Filters */}
      <div className="flex gap-4 mb-6">
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

      {/* Table */}
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
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Delete confirmation dialog */}
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

export default Reports; 