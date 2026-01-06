import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FormData } from '@/types';
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

interface ReportProgress {
  stage: string;
  percentage: number;
  message: string;
  timeRemaining: number | null;
}

interface ReportState {
  isGenerating: boolean;
  formData: FormData | null;
  progress: ReportProgress;
  reports: Report[];
  setIsGenerating: (isGenerating: boolean) => void;
  setFormData: (formData: FormData | null) => void;
  setProgress: (progress: Partial<ReportProgress>) => void;
  resetProgress: () => void;
  setReports: (reports: Report[]) => void;
  addReport: (report: Report) => void;
  deleteReport: (reportId: string) => void;
}

const initialProgress: ReportProgress = {
  stage: '',
  percentage: 0,
  message: '',
  timeRemaining: null,
};

export const useReportStore = create<ReportState>()(
  persist(
    (set) => ({
      isGenerating: false,
      formData: null,
      progress: initialProgress,
      reports: [], // Reports are NOT persisted - loaded from disk via Rust backend
      setIsGenerating: (isGenerating: boolean) => set((state) => ({ 
        ...state,
        isGenerating 
      })),
      setFormData: (formData: FormData | null) => {
        try {
          set((state) => ({ 
            ...state,
            formData 
          }));
        } catch (error: any) {
          // Handle storage quota exceeded
          if (error?.name === 'QuotaExceededError' || error?.message?.includes('quota')) {
            console.warn('Storage quota exceeded, clearing old data...');
            // Try to clear and retry
            try {
              localStorage.removeItem('report-store');
              set((state) => ({ 
                ...state,
                formData 
              }));
            } catch (retryError) {
              console.error('Failed to save form data after clearing storage:', retryError);
            }
          } else {
            throw error;
          }
        }
      },
      setProgress: (progress: Partial<ReportProgress>) => set((state) => ({ 
        ...state,
        progress: {
          ...state.progress,
          ...progress,
        }
      })),
      resetProgress: () => set((state) => ({ 
        ...state,
        progress: initialProgress 
      })),
      setReports: (reports: Report[]) => set((state) => ({ 
        ...state,
        reports 
      })),
      addReport: (report: Report) => 
        set((state: ReportState) => {
          // Check if report already exists
          const exists = state.reports.some(r => r.id === report.id);
          if (exists) {
            return state; // Return unchanged state if report exists
          }
          // Add new report to the beginning of the array
          return { 
            ...state,
            reports: [report, ...state.reports],
            isGenerating: false // Reset generating state
          };
        }),
      deleteReport: (reportId: string) => 
        set((state: ReportState) => ({
          ...state,
          reports: state.reports.filter((r: Report) => r.id !== reportId)
        })),
    }),
    {
      name: 'report-store',
      partialize: (state: ReportState) => ({
        // Only persist form data and generating state - NOT reports
        // Reports are already saved to disk via Rust backend
        // Persisting them causes localStorage quota exceeded errors
        formData: state.formData,
        isGenerating: state.isGenerating,
      }),
      // Add error handling for storage quota
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          console.error('Error rehydrating store:', error);
          // If storage is corrupted or quota exceeded, clear it
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('quota') || errorMessage.includes('QuotaExceededError')) {
            try {
              localStorage.removeItem('report-store');
              console.log('Cleared corrupted storage');
            } catch (clearError) {
              console.error('Failed to clear storage:', clearError);
            }
          }
        }
      },
    }
  )
); 