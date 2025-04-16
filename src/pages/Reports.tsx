import { useState } from 'react';
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
} from '@mui/material';
import {
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  TableView as TableViewIcon,
} from '@mui/icons-material';
import type { NewsletterType } from '@/types';

interface Report {
  id: string;
  name: string;  // Keep for download filename
  advertiser: string;
  type: NewsletterType;
  dateRange: {
    start: string;
    end: string;
  };
  created: string;
}

const NEWSLETTER_TYPES: NewsletterType[] = ['AM', 'PM', 'Energy', 'Health Care', 'Breaking News'];
const SAMPLE_ADVERTISERS = ['JCEDC', 'Choose New Jersey', 'Morgan Stanley', 'Englewood Health'];

const Reports = () => {
  const [reports] = useState<Report[]>([
    {
      id: '1',
      name: 'JCEDC-AM-2025-03-20',
      advertiser: 'JCEDC',
      type: 'AM',
      dateRange: {
        start: '2025-03-01',
        end: '2025-03-20'
      },
      created: '3/20/2025'
    },
    {
      id: '2',
      name: 'Choose New Jersey-PM-2025-03-20',
      advertiser: 'Choose New Jersey',
      type: 'PM',
      dateRange: {
        start: '2025-03-01',
        end: '2025-03-20'
      },
      created: '3/20/2025'
    },
    {
      id: '3',
      name: 'Test Advertiser-AM-2025-03-20-174248726954',
      advertiser: 'Test Advertiser',
      type: 'AM',
      dateRange: {
        start: '2025-03-01',
        end: '2025-03-20'
      },
      created: '3/20/2025'
    },
    {
      id: '4',
      name: 'Morgan Stanley-AM-2025-03-20',
      advertiser: 'Morgan Stanley',
      type: 'AM',
      dateRange: {
        start: '2025-03-01',
        end: '2025-03-20'
      },
      created: '3/20/2025'
    },
    {
      id: '5',
      name: 'Englewood Health-AM-2025-03-20',
      advertiser: 'Englewood Health',
      type: 'AM',
      dateRange: {
        start: '2025-03-01',
        end: '2025-03-20'
      },
      created: '3/20/2025'
    }
  ]);

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
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
          {SAMPLE_ADVERTISERS.map((advertiser) => (
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
            {reports.map((report) => (
              <TableRow key={report.id} className="hover:bg-gray-50">
                <TableCell>{report.advertiser}</TableCell>
                <TableCell align="center">{report.type}</TableCell>
                <TableCell>{formatDateRange(report.dateRange.start, report.dateRange.end)}</TableCell>
                <TableCell align="center">{report.created}</TableCell>
                <TableCell align="center">
                  <div className="flex justify-center gap-1">
                    <IconButton
                      size="small"
                      className="text-gray-600 hover:text-gray-900"
                      title="Open in Excel"
                    >
                      <TableViewIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      className="text-gray-600 hover:text-gray-900"
                      title="Download"
                    >
                      <DownloadIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      className="text-gray-600 hover:text-gray-900"
                      title="Edit"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      className="text-red-600 hover:text-red-800"
                      title="Delete"
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
    </div>
  );
};

export default Reports; 